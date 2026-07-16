# syntax=docker/dockerfile:1
# Build self-host (target Docker/server RS — SDD Build/Deployment, PPD D1).
# Satu artefak: output Next.js `standalone` (di-gate NEXT_OUTPUT_STANDALONE=true).
# Env runtime (DATABASE_URL, SESSION_SECRET, ADMIN_PASSWORD_HASH, …) diinjeksi
# saat run — env.ts memvalidasi gagal-cepat. Di env langsung (bukan berkas .env)
# hash argon2 TIDAK perlu di-escape `\$`.

FROM node:24-alpine AS base
RUN corepack enable
WORKDIR /app

# ── Dependencies ──────────────────────────────────────────────────────────────
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
RUN pnpm install --frozen-lockfile

# ── Build (standalone) ────────────────────────────────────────────────────────
FROM base AS build
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV NEXT_OUTPUT_STANDALONE=true
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm build

# ── Runner ────────────────────────────────────────────────────────────────────
FROM base AS runner
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
RUN addgroup -g 1001 nodejs && adduser -u 1001 -G nodejs -S nextjs

# Standalone server + aset statis + public. Migrasi Drizzle disertakan agar
# `node scripts` opsional bisa menjalankannya (lihat docs/DEPLOY.md).
COPY --from=build /app/public ./public
COPY --from=build --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/.next/static ./.next/static
COPY --from=build --chown=nextjs:nodejs /app/drizzle ./drizzle

# Direktori bukti media (STORAGE_DRIVER=local) — mount volume di produksi.
RUN mkdir -p /app/.storage && chown -R nextjs:nodejs /app/.storage

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
