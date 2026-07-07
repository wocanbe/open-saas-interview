const puppeteer = require("puppeteer");
const fs = require("fs");
const path = require("path");
const { spawn } = require("child_process");
const { pathToFileURL } = require("url");
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
function mkdir(dir) {
    fs.mkdirSync(dir, { recursive: true });
}
function remove(dir) {
    if (!fs.existsSync(dir)) return;
    for (const file of fs.readdirSync(dir)) {
        const full = path.join(dir, file);
        if (fs.statSync(full).isDirectory()) {
            remove(full);
        } else {
            fs.unlinkSync(full);
        }
    }
    fs.rmdirSync(dir);
}
function exec(cmd, args) {
    return new Promise((resolve, reject) => {
        const p = spawn(cmd, args, {
            stdio: "inherit"
        });
        p.on("error", reject);
        p.on("close", code => {
            if (code === 0)
                resolve();
            else
                reject(new Error(`${cmd} exited ${code}`));
        });
    });
}
async function main() {
    const argv = process.argv.slice(2);
    if (argv.length < 3) {
        console.log(
            "Usage: node recorder.js <jobId> <html> <duration> [fps] [width] [height] [output]"
        );
        process.exit(1);
    }
    const jobId = argv[0];
    const html = path.resolve(argv[1]);
    const duration = Number(argv[2]);
    const fps = Number(argv[3] || 30);
    const width = Number(argv[4] || 1280);
    const height = Number(argv[5] || 720);
    const outputDir = path.resolve(argv[6] || "/home/pptruser/output");
    if (!fs.existsSync(html)) {
        console.error("HTML not found:", html);
        process.exit(1);
    }
    const workDir = path.join("/home/pptruser/tmp/render", jobId);
    const frameDir = path.join(workDir, "frames");
    mkdir(workDir);
    mkdir(frameDir);
    mkdir(outputDir);
    const mp4 = path.join(outputDir, `${jobId}.mp4`);
    const m3u8 = path.join(outputDir, `${jobId}.m3u8`);
    let browser;
    try {
        browser = await puppeteer.launch({
            headless: true,
            args: [
                "--no-sandbox",
                "--disable-setuid-sandbox",
                "--disable-dev-shm-usage",
                "--disable-gpu",
                `--window-size=${width},${height}`
            ]
        });
        const page = await browser.newPage();
        await page.setViewport({
            width,
            height,
            deviceScaleFactor: 1
        });
        const url = pathToFileURL(html).href;
        console.log("Loading", url);
        await page.goto(url, {
            waitUntil: "networkidle0"
        });
        await sleep(1000);
        const total = duration * fps;
        console.log(`Capture ${total} frames`);
        for (let i = 0; i < total; i++) {
            const file = path.join(
                frameDir,
                `frame_${String(i).padStart(5, "0")}.png`
            );
            await page.screenshot({
                path: file,
                type: "png"
            });
            process.stdout.write(
                `\r${i + 1}/${total}`
            );
            await sleep(1000 / fps);
        }
        console.log();
        console.log("Encoding MP4");
        await exec("ffmpeg", [
            "-y",
            "-framerate",
            String(fps),
            "-i",
            path.join(frameDir, "frame_%05d.png"),
            "-c:v",
            "libx264",
            "-pix_fmt",
            "yuv420p",
            mp4
        ]);
        console.log("Generating HLS");
        await exec("ffmpeg", [
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
            m3u8
        ]);
        console.log("Cleaning");
        remove(frameDir);
        try {
            fs.rmdirSync(workDir);
        } catch (_) {
        }
        console.log();
        console.log("Finished");
        console.log("MP4 :", mp4);
        console.log("M3U8:", m3u8);
    } catch (err) {
        console.error(err);
        process.exitCode = 1;
    } finally {
        if (browser) {
            try {
                await browser.close();
            } catch (_) {
            }
        }
    }
}
main();