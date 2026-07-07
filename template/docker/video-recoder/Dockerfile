FROM ghcr.io/puppeteer/puppeteer:latest

USER root

RUN sed -i 's|http://deb.debian.org|https://mirrors.tuna.tsinghua.edu.cn|g' /etc/apt/sources.list.d/*.sources \
 && sed -i 's|http://security.debian.org|https://mirrors.tuna.tsinghua.edu.cn/debian-security|g' /etc/apt/sources.list.d/*.sources || true

RUN apt-get update && apt-get install -y --no-install-recommends ffmpeg
RUN rm -rf /var/lib/apt/lists/*

RUN mkdir -p /app && chown -R pptruser:pptruser /app
RUN mkdir -p /tmp/frames && chown pptruser:pptruser /tmp/frames

USER pptruser


WORKDIR /app

COPY package*.json ./

RUN npm config set registry https://registry.npmmirror.com
RUN npm ci --omit=dev

COPY . .

ENTRYPOINT ["node", "recorder.js"]
