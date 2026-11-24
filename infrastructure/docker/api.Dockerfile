# syntax=docker/dockerfile:1.7
# HisabKhata API: build from the repository root:
#   docker build -f infrastructure/docker/api.Dockerfile -t hisabkhata-api .
FROM node:22-bookworm-slim AS base
ENV PNPM_HOME=/pnpm PATH=/pnpm:$PATH CI=true
RUN corepack enable && apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates && rm -rf /var/lib/apt/lists/*
WORKDIR /repo

FROM base AS build
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc* ./
COPY packages/config/package.json packages/config/
COPY packages/shared/package.json packages/shared/
COPY apps/api/package.json apps/api/
RUN --mount=type=cache,id=pnpm,target=/pnpm/store pnpm install --frozen-lockfile --filter @hisabkhata/api... --ignore-scripts
COPY packages packages
COPY apps/api apps/api
RUN pnpm rebuild argon2 \
 && pnpm --filter @hisabkhata/shared build \
 && pnpm --filter @hisabkhata/api exec prisma generate \
 && pnpm --filter @hisabkhata/api build

FROM base AS runtime
ENV NODE_ENV=production PORT=4000
COPY --from=build /repo /repo
WORKDIR /repo/apps/api
RUN useradd --system --uid 10001 hisab && mkdir -p storage && chown -R hisab storage
USER hisab
EXPOSE 4000
HEALTHCHECK --interval=30s --timeout=5s --start-period=40s --retries=3 \
  CMD node -e "fetch('http://127.0.0.1:'+(process.env.PORT||4000)+'/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"
CMD ["sh", "-c", "npx prisma migrate deploy && node dist/main.js"]
