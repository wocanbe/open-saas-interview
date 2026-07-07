const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { pathToFileURL } = require("url");
async function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function ensureDir(dir) {
    if (!fs.existsSync(dir)) {
        fs.mkdirSync(dir, { recursive: true });
    }
}
function removeDir(dir) {
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
        const full = path.join(dir, file);
        const stat = fs.lstatSync(full);
        if (stat.isDirectory()) {
            removeDir(full);
        } else {
            fs.unlinkSync(full);
        }
    }
    fs.rmdirSync(dir);
}
function runCommand(cmd, args) {
    return new Promise((resolve, reject) => {
        const p = spawn(cmd, args, {
            stdio: "inherit"
        });
        p.on("close", code => {
            if (code === 0) {
                resolve();
            } else {
                reject(new Error(`${cmd} exited with ${code}`));
            }
        });
    });
}
async function captureFrames(page, frameDir, fps, duration) {
    const totalFrames = fps * duration;
    const interval = 1000 / fps;
    console.log(`Capture ${totalFrames} frames`);
    for (let i = 0; i < totalFrames; i++) {
        const file = path.join(
            frameDir,
            `frame_${String(i).padStart(5, "0")}.png`
        );
        await page.screenshot({
            path: file,
            type: "png"
        });
        process.stdout.write(
            `\rCapture ${i + 1}/${totalFrames}`
        );
        await sleep(interval);
    }
    console.log();
}
async function pngToMp4(frameDir, outputMp4, fps) {
    await runCommand("ffmpeg", [
        "-y",
        "-framerate",
        String(fps),
        "-i",
        path.join(frameDir, "frame_%05d.png"),
        "-c:v",
        "libx264",
        "-pix_fmt",
        "yuv420p",
        outputMp4
    ]);
}
async function mp4ToHls(mp4, outputDir, jobId) {
    await runCommand("ffmpeg", [
        "-y",
        "-i",
        mp4,
        "-c:v",
        "copy",
        "-hls_time",
        "2",
        "-hls_list_size",
        "0",
        "-hls_segment_filename",
        path.join(outputDir, `${jobId}_%03d.ts`),
        path.join(outputDir, `${jobId}.m3u8`)
    ]);
}
async function main() {
    const args = process.argv.slice(2);
    if (args.length < 3) {
        console.log(
            "Usage: node recorder.js jobId html duration [fps] [width] [height] [output]"
        );
        process.exit(1);
    }
    const jobId = args[0];
    const html = path.resolve(args[1]);
    const duration = Number(args[2]);
    const fps = Number(args[3] || 30);
    const width = Number(args[4] || 1280);
    const height = Number(args[5] || 720);
    const outputRoot = path.resolve(args[6] || "/home/pptruser/output");
    if (!fs.existsSync(html)) {
        console.error("HTML not found:", html);
        process.exit(1);
    }
    const jobDir = path.join("/home/pptruser/tmp/render", jobId);
    const frameDir = path.join(jobDir, "frames");
    ensureDir(jobDir);
    ensureDir(frameDir);
    ensureDir(outputRoot);
    const mp4 = path.join(outputRoot, `${jobId}.mp4`);
    const browser = await puppeteer.launch({
        headless: true,
        args: [
            "--no-sandbox",
            "--disable-setuid-sandbox",
            "--disable-dev-shm-usage",
            "--disable-gpu"
        ]
    });    try {
        console.log("Launching browser...");
        const page = await browser.newPage();
        await page.setViewport({
            width,
            height,
            deviceScaleFactor: 1
        });
        const url = pathToFileURL(html).href;
        console.log("Loading:", url);
        await page.goto(url, {
            waitUntil: "networkidle0"
        });
        await sleep(1000);
        console.log("Capturing...");
        await captureFrames(
            page,
            frameDir,
            fps,
            duration
        );
        console.log("Encoding MP4...");
        await pngToMp4(
            frameDir,
            mp4,
            fps
        );
        console.log("Generating HLS...");
        await mp4ToHls(
            mp4,
            outputRoot,
            jobId
        );
        console.log("Cleaning...");
        removeDir(frameDir);
        console.log("Done.");
        console.log("MP4 :", mp4);
        console.log(
            "M3U8:",
            path.join(outputRoot, `${jobId}.m3u8`)
        );
    } finally {
        await browser.close();
    }
}
main().catch(err => {
    console.error(err);
    process.exit(1);
});