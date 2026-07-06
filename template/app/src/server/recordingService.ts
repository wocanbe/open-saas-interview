import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { env, prisma } from "wasp/server";

const execPromise = promisify(exec);

const OUTPUT_DIR = env.RECORDING_OUTPUT_DIR || "/app/recording-output";
const DOCKER_IMAGE = env.PUPPETEER_IMAGE || "video-recoder:latest";

export interface RecordingResult {
  webmPath: string;
  m3u8Path?: string;
  tsPaths?: string[];
}

export async function recordAnimation(
  jobId: string,
  htmlContent: string,
  duration: number = 10
): Promise<RecordingResult> {
  try {
    if (!fs.existsSync(OUTPUT_DIR)) {
      fs.mkdirSync(OUTPUT_DIR, { recursive: true });
    }

    const jobDir = path.join(OUTPUT_DIR, jobId);
    if (!fs.existsSync(jobDir)) {
      fs.mkdirSync(jobDir, { recursive: true });
    }

    const htmlFilePath = path.join(jobDir, "index.html");
    await fs.promises.writeFile(htmlFilePath, htmlContent, "utf-8");

    console.log(`HTML file written to: ${htmlFilePath}`);

    const webmPath = path.join(jobDir, `${jobId}.webm`);
    const m3u8Path = path.join(jobDir, `${jobId}.m3u8`);

    await runVideoRecoderContainer(jobId, jobDir, htmlFilePath, duration);

    console.log(`Recording completed for job: ${jobId}`);

    const result: RecordingResult = { webmPath };

    if (fs.existsSync(m3u8Path)) {
      result.m3u8Path = m3u8Path;
      
      const tsPaths = fs.readdirSync(jobDir)
        .filter(file => file.startsWith(`${jobId}_`) && file.endsWith(".ts"))
        .map(file => path.join(jobDir, file));
      result.tsPaths = tsPaths;
    }

    return result;
  } catch (error) {
    console.error("Recording error:", error);
    throw error;
  }
}

async function runVideoRecoderContainer(
  jobId: string,
  jobDir: string,
  htmlFilePath: string,
  duration: number
): Promise<void> {
  console.log(`Starting video-recoder container for job: ${jobId}`);

  const dockerCommand = `docker run --rm \
    -v ${jobDir}:/workspace \
    -e PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    ${DOCKER_IMAGE} \
    ${jobId} /workspace/index.html ${duration}`;

  console.log("Running Docker command:", dockerCommand);
  
  const { stdout, stderr } = await execPromise(dockerCommand, {
    timeout: duration * 1000 + 120000,
  });

  if (stdout) {
    console.log("Docker stdout:", stdout);
  }
  if (stderr) {
    console.log("Docker stderr:", stderr);
  }

  console.log("Docker container completed");
}
