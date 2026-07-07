const puppeteer = require('puppeteer');
const fs = require('fs');
const path = require('path');
const { exec } = require('child_process');
const { pathToFileURL } = require('url');

async function run() {
  const args = process.argv.slice(2);

  if (args.length < 3) {
    console.error('Usage: node recorder.js <jobId> <htmlFilePath> <duration> [outputDir]');
    process.exit(1);
  }

  const jobId = args[0];
  const htmlFilePath = args[1];
  const duration = parseInt(args[2], 10);
  const outputDir = args[3] || '/output';
  const frameRate = 30;
  const framesDir = '/tmp/frames';

  if (!fs.existsSync(htmlFilePath)) {
    console.error('File not found:', htmlFilePath);
    process.exit(1);
  }

  let browser = null;

  try {
    console.log(`Starting recording for job: ${jobId}, duration: ${duration}s`);
    console.log(`Output directory: ${outputDir}`);

    if (!fs.existsSync(framesDir)) {
      fs.mkdirSync(framesDir, { recursive: true });
    }

    if (!fs.existsSync(outputDir)) {
      fs.mkdirSync(outputDir, { recursive: true });
    }

    const launchOptions = {
      headless: true,
      args: [
        '--no-sandbox',
        '--disable-setuid-sandbox',
        '--disable-dev-shm-usage',
        '--disable-gpu',
        '--window-size=1280,720'
      ]
    };

    if (process.env.PUPPETEER_EXECUTABLE_PATH) {
      launchOptions.executablePath = process.env.PUPPETEER_EXECUTABLE_PATH;
    }

    browser = await puppeteer.launch(launchOptions);

    const page = await browser.newPage();
    await page.setViewport({ width: 1280, height: 720 });

    const fileUrl = pathToFileURL(htmlFilePath).href;
    console.log('Navigating to:', fileUrl);
    await page.goto(fileUrl, { waitUntil: 'networkidle0' });
    await new Promise(r => setTimeout(r, 1000));

    console.log('Capturing frames...');
    const totalFrames = duration * frameRate;
    const frameInterval = 1000 / frameRate;

    for (let i = 0; i < totalFrames; i++) {
      const framePath = path.join(framesDir, `frame_${i.toString().padStart(5, '0')}.png`);
      await page.screenshot({ path: framePath });
      await new Promise(r => setTimeout(r, frameInterval));
    }

    console.log(`Captured ${totalFrames} frames`);

    const webmPath = path.join(outputDir, `${jobId}.webm`);
    const m3u8Path = path.join(outputDir, `${jobId}.m3u8`);
    const tsPattern = path.join(outputDir, `${jobId}_%03d.ts`);

    console.log('Converting frames to WebM...');
    await execCommand(`ffmpeg -framerate ${frameRate} -i ${framesDir}/frame_%05d.png -c:v libvpx-vp9 -crf 30 -b:v 0 -pix_fmt yuv420p ${webmPath}`);
    console.log(`WebM created: ${webmPath}`);

    console.log('Converting to HLS...');
    await execCommand(`ffmpeg -i ${webmPath} -c:v libx264 -c:a aac -strict -2 -hls_time 2 -hls_list_size 0 -hls_segment_filename "${tsPattern}" "${m3u8Path}"`);
    console.log(`HLS created: ${m3u8Path}`);

    console.log('Recording completed successfully');

  } catch (error) {
    console.error('Recording failed:', error);
    process.exit(1);
  } finally {
    if (browser) {
      await browser.close();
    }
  }
}

function execCommand(command) {
  return new Promise((resolve, reject) => {
    exec(command, (error, stdout, stderr) => {
      if (error) {
        reject(error);
        return;
      }
      if (stdout) {
        console.log('stdout:', stdout);
      }
      if (stderr) {
        console.log('stderr:', stderr);
      }
      resolve();
    });
  });
}

run();
