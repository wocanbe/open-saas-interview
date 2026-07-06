import OpenAI from "openai";
import type { AnimationJob } from "wasp/entities";
import { env, HttpError, prisma } from "wasp/server";
import type {
  CreateAnimationJob,
  GetAllAnimationJobsByUser,
  GetAnimationJobById,
  RetryAnimationJob,
  UpdateAnimationJobStatus,
} from "wasp/server/operations";
import * as z from "zod";
import { ensureArgsSchemaOrThrowHttpError } from "../server/validation";

const openAi = new OpenAI({ apiKey: env.OPENAI_API_KEY });

export type AnimationStatus = "pending" | "generating" | "recording" | "processing" | "completed" | "failed";

const MAX_RETRY_COUNT = 3;
const RECORDING_TIMEOUT_MS = 60000;

const createAnimationJobInputSchema = z.object({
  prompt: z.string().nonempty(),
});

type CreateAnimationJobInput = z.infer<typeof createAnimationJobInputSchema>;

export const createAnimationJob: CreateAnimationJob<
  CreateAnimationJobInput,
  AnimationJob
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const { prompt } = ensureArgsSchemaOrThrowHttpError(
    createAnimationJobInputSchema,
    rawArgs,
  );

  const job = await context.entities.AnimationJob.create({
    data: {
      user: { connect: { id: context.user.id } },
      prompt,
      status: "pending",
    },
  });

  await processAnimationJob(job.id);

  return job;
};

const retryAnimationJobInputSchema = z.object({
  id: z.string().nonempty(),
});

type RetryAnimationJobInput = z.infer<typeof retryAnimationJobInputSchema>;

export const retryAnimationJob: RetryAnimationJob<
  RetryAnimationJobInput,
  AnimationJob
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const { id } = ensureArgsSchemaOrThrowHttpError(
    retryAnimationJobInputSchema,
    rawArgs,
  );

  const job = await context.entities.AnimationJob.findUnique({
    where: {
      id,
      user: { id: context.user.id },
    },
  });

  if (!job) {
    throw new HttpError(404, "Animation job not found");
  }

  if (job.status === "completed") {
    throw new HttpError(400, "Cannot retry a completed job");
  }

  if (job.retryCount >= MAX_RETRY_COUNT) {
    throw new HttpError(400, `Max retry count (${MAX_RETRY_COUNT}) exceeded`);
  }

  await prisma.animationJob.update({
    where: { id },
    data: {
      status: "pending",
      error: null,
    },
  });

  await processAnimationJob(id);

  return job;
};

async function processAnimationJob(jobId: string) {
  try {
    const job = await prisma.animationJob.findUnique({ where: { id: jobId } });
    if (!job) return;

    await prisma.animationJob.update({
      where: { id: jobId },
      data: { status: "generating" as AnimationStatus },
    });

    const htmlContent = await generateAnimationHtml(job.prompt);
    if (!htmlContent) {
      throw new Error("Failed to generate HTML content");
    }

    await prisma.animationJob.update({
      where: { id: jobId },
      data: { 
        status: "recording" as AnimationStatus,
        htmlContent 
      },
    });

    await submitToRecordingService(jobId, htmlContent);

  } catch (error) {
    console.error("Animation job processing failed:", error);
    
    await prisma.animationJob.update({
      where: { id: jobId },
      data: { 
        status: "failed" as AnimationStatus,
        error: error instanceof Error ? error.message : "Unknown error",
        retryCount: { increment: 1 }
      },
    });

    await attemptRetry(jobId);
  }
}

async function attemptRetry(jobId: string) {
  const job = await prisma.animationJob.findUnique({ where: { id: jobId } });
  if (!job) return;

  if (job.retryCount < MAX_RETRY_COUNT) {
    console.log(`Retrying job ${jobId}, attempt ${job.retryCount + 1}/${MAX_RETRY_COUNT}`);
    
    setTimeout(async () => {
      try {
        await prisma.animationJob.update({
          where: { id: jobId },
          data: { status: "pending" as AnimationStatus },
        });
        await processAnimationJob(jobId);
      } catch (retryError) {
        console.error(`Retry failed for job ${jobId}:`, retryError);
      }
    }, 5000 * job.retryCount);
  }
}

async function generateAnimationHtml(prompt: string): Promise<string | null> {
  try {
    const completion = await openAi.chat.completions.create({
      model: "gpt-3.5-turbo",
      messages: [
        {
          role: "system",
          content: `You are an expert HTML/CSS animation developer. Create a standalone HTML page with CSS animations based on the user's prompt.
          
Requirements:
1. Output ONLY the complete HTML file content (no markdown, no extra text)
2. Include all CSS inline in <style> tags
3. Include simple JavaScript if needed for animation control
4. Make animations auto-play and loop
5. Use modern CSS features like keyframes, transforms, transitions
6. The page should be self-contained - no external dependencies
7. Output a single HTML file that renders a visually appealing animation`,
        },
        {
          role: "user",
          content: `Create an HTML animation for: ${prompt}`,
        },
      ],
      temperature: 0.7,
    });

    const response = completion.choices[0].message.content;
    return response || null;
  } catch (error) {
    console.error("OpenAI API error:", error);
    return null;
  }
}

async function submitToRecordingService(jobId: string, htmlContent: string) {
  const recordingServiceUrl = env.RECORDING_SERVICE_URL || "http://localhost:3001";
  
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), RECORDING_TIMEOUT_MS);

    const response = await fetch(`${recordingServiceUrl}/api/record`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        jobId,
        htmlContent,
        duration: 10,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Recording service returned ${response.status}`);
    }

    const result = await response.json();
    console.log("Recording submitted:", result);

  } catch (error) {
    console.error("Failed to submit to recording service:", error);
    throw error;
  }
}

export const getAllAnimationJobsByUser: GetAllAnimationJobsByUser<void, AnimationJob[]> = async (
  _args,
  context,
) => {
  if (!context.user) {
    throw new HttpError(401);
  }
  return context.entities.AnimationJob.findMany({
    where: {
      user: {
        id: context.user.id,
      },
    },
    orderBy: {
      createdAt: "desc",
    },
  });
};

const getAnimationJobByIdInputSchema = z.object({
  id: z.string().nonempty(),
});

type GetAnimationJobByIdInput = z.infer<typeof getAnimationJobByIdInputSchema>;

export const getAnimationJobById: GetAnimationJobById<
  GetAnimationJobByIdInput,
  AnimationJob | null
> = async (rawArgs, context) => {
  if (!context.user) {
    throw new HttpError(401);
  }

  const { id } = ensureArgsSchemaOrThrowHttpError(
    getAnimationJobByIdInputSchema,
    rawArgs,
  );

  return context.entities.AnimationJob.findUnique({
    where: {
      id,
      user: {
        id: context.user.id,
      },
    },
  });
};

const updateAnimationJobStatusInputSchema = z.object({
  id: z.string().nonempty(),
  status: z.enum(["pending", "generating", "recording", "processing", "completed", "failed"]),
  webmS3Key: z.string().optional(),
  m3u8S3Key: z.string().optional(),
  error: z.string().optional(),
});

type UpdateAnimationJobStatusInput = z.infer<typeof updateAnimationJobStatusInputSchema>;

export const updateAnimationJobStatus: UpdateAnimationJobStatus<
  UpdateAnimationJobStatusInput,
  AnimationJob
> = async (rawArgs) => {
  const { id, status, webmS3Key, m3u8S3Key, error } = ensureArgsSchemaOrThrowHttpError(
    updateAnimationJobStatusInputSchema,
    rawArgs,
  );

  return prisma.animationJob.update({
    where: { id },
    data: {
      status,
      webmS3Key,
      m3u8S3Key,
      error,
    },
  });
};
