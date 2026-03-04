FROM node:20-alpine AS base
RUN corepack enable && corepack prepare pnpm@9.15.0 --activate

# Install dependencies
FROM base AS deps
WORKDIR /app
COPY pnpm-workspace.yaml package.json pnpm-lock.yaml ./
COPY packages/shared/package.json ./packages/shared/
COPY packages/database/package.json ./packages/database/
COPY packages/ai/package.json ./packages/ai/
COPY packages/tools/package.json ./packages/tools/
COPY packages/agents/package.json ./packages/agents/
COPY packages/backend/package.json ./packages/backend/
RUN pnpm install --frozen-lockfile

# Build
FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/packages/shared/node_modules ./packages/shared/node_modules
COPY --from=deps /app/packages/database/node_modules ./packages/database/node_modules
COPY --from=deps /app/packages/ai/node_modules ./packages/ai/node_modules
COPY --from=deps /app/packages/tools/node_modules ./packages/tools/node_modules
COPY --from=deps /app/packages/agents/node_modules ./packages/agents/node_modules
COPY --from=deps /app/packages/backend/node_modules ./packages/backend/node_modules
COPY . .
RUN pnpm --filter @onera/database run generate
RUN pnpm --filter @onera/database run build
RUN pnpm --filter @onera/shared run build
RUN pnpm --filter @onera/ai run build
RUN pnpm --filter @onera/tools run build
RUN pnpm --filter @onera/agents run build
RUN pnpm --filter @onera/backend run build

# Production
FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages ./packages
COPY --from=builder /app/pnpm-workspace.yaml ./
COPY --from=builder /app/package.json ./

EXPOSE 3001
CMD ["sh", "-c", "node node_modules/.bin/prisma db push --schema packages/database/prisma/schema.prisma --skip-generate && node packages/backend/dist/index.js"]
