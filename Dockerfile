# KD Legacy svetainė
FROM node:22-bookworm-slim

ENV NODE_ENV=production \
    MALLOC_ARENA_MAX=2 \
    PORT=3000 \
    DATA_DIR=/data

WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci --omit=dev && npm cache clean --force

COPY . .

RUN mkdir -p /data && chown -R node:node /data
USER node

VOLUME ["/data"]
EXPOSE 3000
CMD ["node", "server.js"]
