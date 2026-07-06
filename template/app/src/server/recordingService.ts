import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
import { env, prisma } from "wasp/server";

const execPromise = promisify(exec);

const OUTPUT_DIR = env.RECORDING_OUTPUT_DIR || "/app/recording-output";
const DOCKER_IMAGE = env.PUPPETEER_IMAGE || "ghcr.io/puppeteer/puppeteer:latest";

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

    await runPuppeteerContainer(jobId, jobDir, htmlFilePath, webmPath, duration);

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

async function runPuppeteerContainer(
  jobId: string,
  jobDir: string,
  htmlFilePath: string,
  webmPath: string,
  duration: number
): Promise<void> {
  console.log(`Starting Docker container for job: ${jobId}`);

  const frameRate = 30;
  const framesDir = "/tmp/frames";
  
  const dockerCommand = `docker run --rm \
    -v ${jobDir}:/workspace \
    -e PUPPETEER_EXECUTABLE_PATH=/usr/bin/google-chrome-stable \
    ${DOCKER_IMAGE} \
    bash -c "
      mkdir -p ${framesDir} && \
      node -e \"
        const puppeteer = require('puppeteer');
        const fs = require('fs');
        const path = require('path');
        
        async function run() {
          const browser = await puppeteer.launch({
            headless: true,
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage', '--disable-gpu', '--window-size=1280,720']
          });
          const page = await browser.newPage();
          await page.setViewport({ width: 1280, height: 720 });
          await page.goto('file:///workspace/index.html', { waitUntil: 'networkidle0' });
          await new Promise(r => setTimeout(r, 1000));
          
          const totalFrames = ${duration} * ${frameRate};
          const frameInterval = 1000 / ${frameRate};
          
          for (let i = 0; i < totalFrames; i++) {
            await page.screenshot({ path: path.join('${framesDir}', \\\"frame_\\\" + i.toString().padStart(5, '0') + '.png') });
            await new Promise(r => setTimeout(r, frameInterval));
          }
          
          await browser.close();
        }
        run().catch(e => { console.error(e); process.exit(1); });
      \" && \
      ffmpeg -framerate ${frameRate} -i ${framesDir}/frame_%05d.png -c:v libvpx-vp9 -crf 30 -b:v 0 -pix_fmt yuv420p /workspace/${jobId}.webm && \
      ffmpeg -i /workspace/${jobId}.webm -c:v libx264 -c:a aac -strict -2 -hls_time 2 -hls_list_size 0 -hls_segment_filename /workspace/${jobId}_%03d.ts /workspace/${jobId}.m3u8
    "`;

  console.log("Running Docker command...");
  
  const { stdout, stderr } = await execPromise(dockerCommand, {
    timeout: duration * 1000 + 60000,
  });

  if (stdout) {
    console.log("Docker stdout:", stdout);
  }
  if (stderr) {
    console.log("Docker stderr:", stderr);
  }

  console.log("Docker container completed");
}
