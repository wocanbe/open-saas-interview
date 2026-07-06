import express, { Express, Request, Response } from "express";
import { recordAnimation } from "./recorder";
import * as fs from "fs";

const app: Express = express();
const port = process.env.PORT || 3001;

app.use(express.json({ limit: "10mb" }));

app.post("/api/record", async (req: Request, res: Response) => {
  const { jobId, htmlContent, duration = 10 } = req.body;

  try {
    if (!jobId || !htmlContent) {
      return res.status(400).json({ error: "jobId and htmlContent are required" });
    }

    console.log(`Starting recording for job: ${jobId}, duration: ${duration}s`);

    const result = await recordAnimation(jobId, htmlContent, duration);

    const statusData: Record<string, unknown> = {
      webmS3Key: result.webmPath,
    };
    
    if (result.m3u8Path) {
      statusData.m3u8S3Key = result.m3u8Path;
    }

    await updateWaspJobStatus(jobId, "completed", statusData);

    res.status(200).json({
      message: "Recording completed successfully",
      jobId,
      ...result,
    });
  } catch (error) {
    console.error("Recording failed:", error);
    
    if (jobId) {
      await updateWaspJobStatus(jobId, "failed", {
        error: error instanceof Error ? error.message : "Unknown error",
      });
    }

    res.status(500).json({
      error: error instanceof Error ? error.message : "Recording failed",
    });
  }
});

async function updateWaspJobStatus(jobId: string, status: string, data: Record<string, unknown>) {
  const waspUrl = process.env.WASP_API_URL || "http://localhost:3000";
  
  try {
    await fetch(`${waspUrl}/api/actions/updateAnimationJobStatus`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        id: jobId,
        status,
        ...data,
      }),
    });
  } catch (error) {
    console.error("Failed to update Wasp job status:", error);
  }
}

app.get("/health", (req: Request, res: Response) => {
  res.status(200).json({ status: "ok" });
});

app.listen(port, () => {
  console.log(`Recording service running on port ${port}`);
});
