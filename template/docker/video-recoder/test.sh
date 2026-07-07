#!/bin/bash
set -e
JOB_ID=test-$(date +%s)
# docker build -t video-recoder:latest .

MSYS_NO_PATHCONV=1 docker run --rm \
    -v "./output:/home/pptruser/output" \
    video-recoder \
    "$JOB_ID" \
    /home/pptruser/myapp/demo.html \
    10 \
    30 \
    1280 \
    720 \
    /home/pptruser/output
echo
echo "========================="
echo "Render Finished"
echo "========================="
echo
ls -lh output
echo
echo "MP4 : output/${JOB_ID}.mp4"
echo "M3U8: output/${JOB_ID}.m3u8"