# syntax=docker/dockerfile:1

# 1. Base: محیط پایه
FROM node:22-bookworm-slim AS base

RUN apt-get update -y \
    && apt-get install -y --no-install-recommends openssl ca-certificates \
    && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# 2. Dependencies: نصب وابستگی‌ها
FROM base AS deps

COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./

# آدرس موقت فقط برای مراحل Build
ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"

RUN --mount=type=cache,target=/root/.npm npm ci --registry=https://package-mirror.liara.ir/repository/npm/
# 3. Builder: ساخت نسخه Production
FROM base AS builder

COPY --from=deps /app/node_modules ./node_modules
COPY . .

ENV DATABASE_URL="postgresql://build:build@localhost:5432/build"
ENV NEXT_PUBLIC_SITE_URL="http://localhost:3000"
ENV NEXT_TELEMETRY_DISABLED=1

RUN npx prisma generate
RUN JWT_SECRET="docker-build-only-not-a-real-secret-change-at-runtime" npm run build

# 4. Runner: محیط نهایی اجرا
FROM base AS runner

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

COPY --from=builder --chown=node:node /app/public ./public
COPY --from=builder --chown=node:node /app/.next/standalone ./
COPY --from=builder --chown=node:node /app/.next/static ./.next/static

USER node

EXPOSE 3000

CMD ["node", "server.js"]