FROM node:18-slim
WORKDIR /usr/src/app

# 安装 Python3 + pip（edge-tts 依赖）
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-pip \
    && rm -rf /var/lib/apt/lists/* \
    && pip3 install --no-cache-dir --break-system-packages edge-tts

# 先复制源代码，再安装依赖（依赖没变可缓存）
COPY . ./
RUN npm install --only=production
EXPOSE 80
CMD ["node", "index.js"]
