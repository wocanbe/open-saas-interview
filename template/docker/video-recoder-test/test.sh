#!/bin/bash

set -e

# echo "=== Building Docker image ==="
# cd "$(dirname "$0")/../video-recoder"
# docker build -t video-recoder:latest .

echo "=== Running test ==="
cd "$(dirname "$0")"
docker run --rm \
  -v "$(pwd):/workspace" \
  video-recoder:latest \
  12345 /workspace/demo.html 10

echo "=== Test completed ==="
ls -la
