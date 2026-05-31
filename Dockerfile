# ─── Builder ─────────────────────────────────────────────────
FROM node:22-alpine AS builder

WORKDIR /app

ENV CI=true
ENV NEXT_TELEMETRY_DISABLED=1

ARG NEXT_PUBLIC_APP_URL=https://file.sbc.om
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL

RUN apk add --no-cache ghostscript openssl openssl-dev

COPY package.json pnpm-lock.yaml .npmrc pnpm-workspace.yaml ./
COPY prisma ./prisma

RUN npm install -g pnpm@10 && \
    pnpm config set minimum-release-age 0 && \
    pnpm install --frozen-lockfile

COPY . .

RUN pnpm prisma generate && pnpm build


# ─── Runner ──────────────────────────────────────────────────
FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

RUN apk add --no-cache ghostscript curl openssl postgresql-client && \
    addgroup --system --gid 1001 nodejs && \
    adduser --system --uid 1001 nextjs

COPY --chown=nextjs:nodejs --from=builder /app/public ./public
COPY --chown=nextjs:nodejs --from=builder /app/.next/standalone ./
COPY --chown=nextjs:nodejs --from=builder /app/.next/static ./.next/static
COPY --chown=nextjs:nodejs --from=builder /app/prisma ./prisma
COPY --chown=nextjs:nodejs scripts/entrypoint.sh ./entrypoint.sh

RUN chmod +x /app/entrypoint.sh

USER nextjs

EXPOSE 3000

CMD ["sh", "entrypoint.sh"]