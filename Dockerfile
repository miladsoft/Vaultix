# ─── Builder ─────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

ENV CI=true

ARG NEXT_PUBLIC_APP_URL=https://file.sbc.om
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

# Install ghostscript for PDF rendering + openssl for Prisma
RUN apk add --no-cache ghostscript openssl openssl-dev

COPY package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./
COPY prisma ./prisma
RUN npm install -g pnpm@10 && \
    pnpm config set minimum-release-age 0 && \
    pnpm install --frozen-lockfile

COPY . .

RUN ./node_modules/.bin/prisma generate && \
    node -e "try { require('./node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node'); console.log('OK') } catch(e) { console.error('FAIL:', e.message) }" && \
    pnpm build

# ─── Runner ──────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

RUN apk add --no-cache ghostscript curl openssl postgresql-client

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

RUN addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

# Next.js standalone output (includes traced runtime node_modules)
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static

# Prisma schema + pre-built seed script
COPY --from=builder /app/prisma ./prisma

# Runtime dependencies not always included in Next.js standalone traces.
# Keep pnpm's symlinked dependency layout intact for Prisma CLI engines and seed dependencies.
COPY --from=builder /app/node_modules ./node_modules

# Startup script
COPY scripts/entrypoint.sh ./entrypoint.sh

RUN chown -R nextjs:nodejs /app && \
    chmod +x /app/entrypoint.sh

USER nextjs

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["sh", "entrypoint.sh"]
