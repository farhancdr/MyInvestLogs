# Single-container local app: builds the client, then serves it and the API
# from one Node process.
#
# Debian rather than Alpine: better-sqlite3 ships glibc prebuilds, so there is
# no native compile step and no build toolchain in the image.
FROM node:22-bookworm-slim

WORKDIR /app

# sqlite3 CLI is used by `npm run dump` for readable snapshots.
RUN apt-get update \
  && apt-get install -y --no-install-recommends sqlite3 \
  && rm -rf /var/lib/apt/lists/*

COPY package*.json ./
RUN npm ci

COPY tsconfig.json vite.config.ts vitest.config.ts ./
COPY src ./src
COPY scripts ./scripts
COPY test ./test

RUN npm run build

ENV NODE_ENV=production
ENV PORT=3000
ENV DB_PATH=/app/data/tracker.db

EXPOSE 3000
CMD ["npm", "start"]
