import puppeteer from "puppeteer";
import { exec } from "child_process";
import { promisify } from "util";
import * as fs from "fs";
import * as path from "path";
const execPromise = promisify(exec);
const OUTPUT_DIR = process.env.OUTPUT_DIR || "/app/output";
const FRAME_RATE = 30;
async function wait(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
export async function recordAnimation(jobId, htmlContent, duration) {
    let browser = null;
    let page = null;
    try {
        if (!fs.existsSync(OUTPUT_DIR)) {
            fs.mkdirSync(OUTPUT_DIR, { recursive: true });
        }
        const framesDir = path.join(OUTPUT_DIR, `${jobId}_frames`);
        if (!fs.existsSync(framesDir)) {
            fs.mkdirSync(framesDir, { recursive: true });
        }
        browser = await puppeteer.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                "--window-size=1280,720",
            ],
            executablePath: process.env.PUPPETEER_EXECUTABLE_PATH,
        });
        page = await browser.newPage();
        await page.setViewport({ width: 1280, height: 720 });
        await page.setContent(htmlContent, { waitUntil: "networkidle0" });
        await wait(1000);
        console.log(`Recording started for ${duration} seconds at ${FRAME_RATE} fps...`);
        const totalFrames = duration * FRAME_RATE;
        const frameInterval = 1000 / FRAME_RATE;
        for (let i = 0; i < totalFrames; i++) {
            const framePath = path.join(framesDir, `frame_${i.toString().padStart(5, "0")}.png`);
            await page.screenshot({
                path: framePath,
                fullPage: false,
            });
            await wait(frameInterval);
        }
        console.log(`Captured ${totalFrames} frames`);
        const webmPath = path.join(OUTPUT_DIR, `${jobId}.webm`);
        await convertFramesToWebm(jobId, framesDir, webmPath);
        await fs.promises.rm(framesDir, { recursive: true });
        const result = { webmPath };
        const m3u8Result = await convertToHLS(jobId, webmPath);
        if (m3u8Result.m3u8Path) {
            result.m3u8Path = m3u8Result.m3u8Path;
            result.tsPaths = m3u8Result.tsPaths;
        }
        return result;
    }
    catch (error) {
        console.error("Recording error:", error);
        throw error;
    }
    finally {
        if (page) {
            await page.close();
        }
        if (browser) {
            await browser.close();
        }
    }
}
async function convertFramesToWebm(jobId, framesDir, webmPath) {
    try {
        console.log("Converting frames to WebM...");
        const framePattern = path.join(framesDir, "frame_%05d.png");
        const ffmpegCommand = `ffmpeg -framerate ${FRAME_RATE} -i "${framePattern}" -c:v libvpx-vp9 -crf 30 -b:v 0 -pix_fmt yuv420p "${webmPath}"`;
        await execPromise(ffmpegCommand);
        console.log(`WebM conversion completed: ${webmPath}`);
    }
    catch (error) {
        console.error("WebM conversion failed:", error);
        throw error;
    }
}
async function convertToHLS(jobId, webmPath) {
    try {
        const m3u8Path = path.join(OUTPUT_DIR, `${jobId}.m3u8`);
        const tsPattern = path.join(OUTPUT_DIR, `${jobId}_%03d.ts`);
        console.log("Converting to HLS format...");
        const ffmpegCommand = `ffmpeg -i ${webmPath} -c:v libx264 -c:a aac -strict -2 -hls_time 2 -hls_list_size 0 -hls_segment_filename "${tsPattern}" "${m3u8Path}"`;
        await execPromise(ffmpegCommand);
        console.log(`HLS conversion completed: ${m3u8Path}`);
        const tsPaths = fs.readdirSync(OUTPUT_DIR)
            .filter(file => file.startsWith(`${jobId}_`) && file.endsWith(".ts"))
            .map(file => path.join(OUTPUT_DIR, file));
        return { m3u8Path, tsPaths };
    }
    catch (error) {
        console.error("HLS conversion failed:", error);
        return {};
    }
}
