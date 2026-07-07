# HTML Animation to Video Generation System

## Project Overview

This project implements an **AI-powered HTML-to-Video generation system**.

The system allows AI-generated web pages (HTML/CSS/JavaScript animations) to be automatically rendered in a real browser environment and converted into video files.

The core idea is:

> **HTML Animation → Browser Rendering → Video Capture → Video Distribution**

Instead of generating videos from traditional graphics pipelines, this project treats modern web pages as a new form of dynamic video content.

Potential use cases include:

* AI-generated marketing videos
* Animated presentations
* Interactive content generation
* Automated social media content creation
* AI creative tools

---

# Technology Selection

## Why Not Generate Videos Directly with Canvas?

Canvas is a powerful graphics rendering solution and can be directly recorded using browser APIs such as `MediaRecorder`.

However, Canvas has limitations when the goal is to support arbitrary AI-generated web content.

Modern web pages are not limited to canvas rendering. They may contain:

* HTML DOM elements
* CSS animations
* SVG graphics
* Web fonts
* Images
* Video elements
* WebGL content
* Third-party web components

For example:

```html
<div class="title">
  Hello AI
</div>

<style>
.title {
  animation: fadeIn 2s;
}
</style>
```

This type of animation is controlled by the browser rendering engine rather than Canvas.

Supporting all HTML capabilities through Canvas would require rebuilding a browser rendering engine, which is impractical.

Therefore, this project uses:

> **Chromium as the rendering engine and captures the actual browser output.**

Advantages:

* Full Web Standard support
* Native CSS animation support
* JavaScript execution
* SVG/WebGL compatibility
* Pixel-level consistency with user-visible browser output

---

# Video Format Decision

## Why MP4 Instead of WebM?

Browser-based recording commonly produces:

```
WebM + VP8/VP9
```

However, this project outputs:

```
MP4 + H.264
```

because of better ecosystem compatibility.

## HLS / M3U8 Compatibility

The future video delivery pipeline is designed as:

```
MP4
 |
 ↓
FFmpeg
 |
 ↓
HLS
 |
 ↓
m3u8 playlist + segments
 |
 ↓
CDN streaming
```

The HLS ecosystem has much stronger support for:

* H.264
* AAC
* MP4 containers

WebM has limited support in traditional HLS workflows, especially for:

* Mobile devices
* Smart TVs
* Legacy players
* CDN video pipelines

Therefore, MP4 provides better compatibility for large-scale video distribution.

---

# System Workflow

The complete workflow:

```
AI generates HTML animation
          |
          ↓
Video Generation API
          |
          ↓
Create Video Job
          |
          ↓
Task Queue
          |
          ↓
Launch Video Worker Container
          |
          ↓
Puppeteer + Chromium Rendering
          |
          ↓
Capture Frames
          |
          ↓
FFmpeg Encoding
          |
          ↓
Generate MP4 Video
          |
          ↓
Upload to Object Storage
          |
          ↓
Return Video URL
```

---

# System Architecture

```
                    User
                     |
                     |
               API Service
                     |
                     |
             Job Management Service
                     |
                     |
          -------------------------
          |                       |
      Database              Message Queue
                                  |
                                  |
                         Video Worker Container
                                  |
                     -------------------------
                     |                       |
                Puppeteer                 FFmpeg
                     |
                 Chromium
                     |
              HTML/CSS/JS Renderer


                                  |
                                  ↓

                         Object Storage
                         (S3/OSS/MinIO)

                                  |
                                  ↓

                                  CDN

                                  |
                                  ↓

                            Video Playback
```

---

# Core Implementation

## 1. Browser Rendering with Puppeteer

The system uses Chromium Headless through Puppeteer.

Responsibilities:

* Load generated HTML pages
* Execute JavaScript animations
* Render CSS transitions
* Control browser lifecycle
* Capture visual output

Example:

```javascript
await page.goto(url);

await page.waitForTimeout(duration);
```

This ensures the final video matches the actual browser rendering result.

---

## 2. Video Encoding with FFmpeg

FFmpeg handles:

* Frame processing
* Video encoding
* Resolution configuration
* Frame rate control
* H.264 compression

Pipeline:

```
frame_00001.png
frame_00002.png
frame_00003.png
        |
        ↓
     FFmpeg
        |
        ↓
   output.mp4
```

---

# Containerized Video Worker

The video generation environment runs as an isolated container:

```
video-worker-container
```

Including:

* Chromium
* Puppeteer
* Node.js
* FFmpeg

Benefits:

## Environment Isolation

Avoid conflicts between:

* Browser versions
* System dependencies
* FFmpeg libraries
* Node runtime versions

## Horizontal Scaling

The architecture can scale horizontally:

```
             Job Queue

                 |
        -------------------
        |        |        |
     Worker   Worker   Worker
```

Multiple workers can process video generation jobs concurrently.

---

# Future Improvements

## 1. Separate Video Generation Service

Current:

```
API Service
      |
      ↓
Generate Video
```

Future:

```
API Service

      |
      ↓

Video Generation Service

      |
      ↓

Worker Cluster
```

Benefits:

* Independent scaling
* Better fault isolation
* Higher throughput
* Easier maintenance

---

## 2. Record Specific DOM Regions

Current implementation captures the full browser viewport.

Future support:

```json
{
  "selector": "#animation",
  "width": 800,
  "height": 600
}
```

Possible applications:

* AI-generated posters
* Presentation slides
* Product demos
* Social media clips

---

## 3. Configurable Video Parameters

Allow users to customize:

### Resolution

```
1920x1080
1280x720
1080x1080
```

### Frame Rate

```
24 FPS
30 FPS
60 FPS
```

### Duration

```
5 seconds
10 seconds
30 seconds
```

### Codec

```
H.264
H.265
AV1
```

---

## 4. Improve Capture Performance

Current pipeline:

```
Browser
   |
Screenshot Frames
   |
FFmpeg Encoding
```

Future optimization:

```
Chromium
   |
Native Capture Pipeline
   |
FFmpeg
```

Goals:

* Reduce CPU usage
* Increase rendering speed
* Support longer videos
* Improve stability

---

## 5. Job Status Management

Introduce a complete job lifecycle:

```
CREATED

   ↓

RUNNING

   ↓

PROCESSING

   ↓

SUCCESS

   ↓

FAILED
```

Additional features:

* Progress tracking
* Retry mechanism
* Error logging
* Task monitoring

---

# Project Highlights

1. **Browser-level rendering solution supporting full HTML/CSS/JavaScript animation capabilities**

2. **Containerized video workers enabling isolation and horizontal scaling**

3. **MP4/H.264 output optimized for video distribution and future HLS streaming**

4. **Asynchronous job architecture suitable for AI-generated content workflows**

5. **Extensible foundation for an AI-powered video generation platform**

---

## Project Positioning

This project is not just a screen recording tool.

It is:

> **An AI-powered Web-to-Video rendering platform that transforms HTML as a creative medium into distributable video content through browser automation and cloud-native processing.**
