# syntax=docker/dockerfile:1.7
# Multi-stage build for self-hosting off Vercel (see the self-hosting migration
# plan). Uses next.config.ts's `output: "standalone"` so the runtime stage
# only needs the traced server bundle, not the full node_modules tree.
#
# node:22-slim (Debian/glibc) is required, not an alpine base — sharp (pinned
# via package.json's `overrides`) ships prebuilt glibc binaries; musl would
# force a slower from-source build and risks a mismatched binary if the build
# and runtime stages ever diverge.
FROM node:22-slim AS base
# Prisma's query engine needs a real openssl on Debian, or it silently
# guesses a libssl version and can fail to load at runtime.
RUN apt-get update && apt-get install -y --no-install-recommends openssl ca-certificates \
	&& rm -rf /var/lib/apt/lists/*

FROM base AS deps
WORKDIR /app
COPY package.json package-lock.json ./
COPY prisma ./prisma
COPY prisma.config.ts ./
# prisma.config.ts's datasource.url calls env("DATABASE_URL") eagerly on load
# (postinstall's `prisma generate` loads it too, not just `migrate deploy`),
# so it must resolve to *something* even though generate never connects.
# --mount=type=secret mounts it as a file under /run/secrets/ visible only to
# this RUN's process, not baked into the image's layer history like ARG/ENV.
RUN --mount=type=secret,id=database_url \
	DATABASE_URL="$(cat /run/secrets/database_url)" npm ci

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

# `npm run build` runs `prisma migrate deploy` against the real DB and (via
# build-search-index.ts) writes the persisted search index through
# getImageStorage() — both need real credentials at build time, same as they
# already do on Vercel. DATABASE_URL points at the `db` compose service's
# published port via docker-compose.yml's `build: network: host` (no
# DIRECT_URL — local Postgres has no pooler, so prisma.config.ts's fallback
# to DATABASE_URL applies, same as local dev). The R2_* secrets make the
# build write the search index to R2 rather than this stage's disposable
# local disk. See docker-compose.yml for how each secret id below is sourced
# from the deploying host's own env.
#
# IMAGE_STORAGE_DRIVER isn't a secret (just a mode switch) so it stays a
# plain ARG — override to empty (`--build-arg IMAGE_STORAGE_DRIVER=`) for a
# local test build that writes the search index to this stage's disposable
# local disk instead of touching a real R2 bucket.
ARG IMAGE_STORAGE_DRIVER=r2
RUN --mount=type=secret,id=database_url \
	--mount=type=secret,id=r2_account_id \
	--mount=type=secret,id=r2_access_key_id \
	--mount=type=secret,id=r2_secret_access_key \
	--mount=type=secret,id=r2_bucket_name \
	--mount=type=secret,id=r2_public_url \
	DATABASE_URL="$(cat /run/secrets/database_url)" \
	R2_ACCOUNT_ID="$(cat /run/secrets/r2_account_id)" \
	R2_ACCESS_KEY_ID="$(cat /run/secrets/r2_access_key_id)" \
	R2_SECRET_ACCESS_KEY="$(cat /run/secrets/r2_secret_access_key)" \
	R2_BUCKET_NAME="$(cat /run/secrets/r2_bucket_name)" \
	R2_PUBLIC_URL="$(cat /run/secrets/r2_public_url)" \
	IMAGE_STORAGE_DRIVER="$IMAGE_STORAGE_DRIVER" NEXT_TELEMETRY_DISABLED=1 npm run build

# Not part of the `app` image — see docker-compose.yml's `maintenance`
# service. Reuses `deps`'s already-installed full node_modules (incl.
# devDependencies like tsx/typescript, needed to run these scripts directly
# from source) and generated Prisma client, without running the production
# `next build`.
FROM base AS maintenance
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production \
	NEXT_TELEMETRY_DISABLED=1

RUN groupadd --system --gid 1001 nodejs \
	&& useradd --system --uid 1001 --gid nodejs nextjs

COPY --from=builder /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

USER nextjs
EXPOSE 3000
ENV PORT=3000 HOSTNAME=0.0.0.0

CMD ["node", "server.js"]
