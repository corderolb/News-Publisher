# Debian-based (not Alpine): better-sqlite3 ships prebuilt native bindings for
# both glibc and musl, but Debian avoids any doubt and keeps this consistent
# with the most common self-hosting setups.
FROM node:22-bookworm-slim AS deps
WORKDIR /app
# better-sqlite3 ships prebuilt bindings, but npm's default lifecycle still
# runs `node-gyp rebuild` on install for any package with a binding.gyp and
# no explicit install script (which better-sqlite3 doesn't define) - so a
# working Python + a C++ toolchain must be present even though the prebuilt
# .node file usually ends up unused.
RUN apt-get update && apt-get install -y --no-install-recommends python3 make g++ \
    && rm -rf /var/lib/apt/lists/*
COPY package.json package-lock.json ./
COPY prisma ./prisma
RUN npm ci

FROM node:22-bookworm-slim AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build

# The runtime image ships the full node_modules (not just Next's traced
# output) - `prisma migrate deploy` runs on every container start (see
# docker-entrypoint.sh) and needs the prisma CLI + its own dependency tree,
# which Next's standalone build tracer only follows for the app server
# itself and would otherwise miss.
FROM node:22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production

# Without this, Prisma can't detect a libssl version at runtime and falls
# back to a compatibility guess (harmless here, but noisy and worth avoiding).
RUN apt-get update && apt-get install -y --no-install-recommends openssl \
    && rm -rf /var/lib/apt/lists/*

COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/.next ./.next
COPY --from=builder /app/public ./public
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/package.json ./package.json
COPY --from=builder /app/next.config.ts ./next.config.ts
COPY --from=builder /app/prisma.config.ts ./prisma.config.ts
COPY docker-entrypoint.sh ./docker-entrypoint.sh

# Runs as root - simplest option for a single-tenant, self-hosted app where
# the SQLite DB lives on a bind-mounted host volume. A non-root user here
# just trades this for host-side UID/permission friction on that mount,
# which is worse for the "let other people install this" goal.
RUN chmod +x ./docker-entrypoint.sh

EXPOSE 3000
ENV PORT=3000

ENTRYPOINT ["./docker-entrypoint.sh"]
