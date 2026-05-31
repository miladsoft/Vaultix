# SBC Files — Enterprise Secure Document Sharing Platform

A production-grade DRM platform for sharing sensitive documents with advanced access control, watermarking, audit trails, and secure rendering. Similar to Digify, DocSend, and enterprise virtual data rooms.

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────┐
│                    Nginx (TLS termination)               │
│              Rate limiting / Anti-hotlinking             │
└─────────────────────┬───────────────────────────────────┘
                      │
          ┌───────────▼───────────┐
          │   Next.js 16 App      │   ← Server Components + Route Handlers
          │   (App Router)        │   ← JWT cookies, CSRF-safe
          └───┬───────────────┬───┘
              │               │
     ┌────────▼────┐  ┌───────▼────────┐
     │ PostgreSQL  │  │ Redis           │
     │ (Prisma 5)  │  │ (Rate limit +  │
     │             │  │  SSE pub/sub +  │
     └─────────────┘  │  BullMQ jobs)  │
                      └───────▲────────┘
                              │
              ┌───────────────┴──────────────┐
              │        BullMQ Workers         │
              │  pdf-processor  │  cleanup    │
              │  (Ghostscript)  │  (cron)     │
              └───────────────┬──────────────┘
                              │
                    ┌─────────▼────────┐
                    │  MinIO (S3)       │
                    │  AES-256 server   │
                    │  side encryption  │
                    └──────────────────┘
```

## Security Model

| Threat | Mitigation |
|---|---|
| Raw file exposure | PDFs converted to JPEG images; raw files only in MinIO |
| Token enumeration | SHA-256 hashed tokens; 256-bit entropy |
| Storage key leaks | AES-256-GCM encrypted storage key references in DB |
| Screenshot / recording | Dynamic watermarks (name, email, IP, session, timestamp) |
| OTP brute force | 5-attempt limit + Redis rate limiting (5/5min per IP) |
| API abuse | Sliding window rate limits per IP per endpoint |
| Tab switching | Canvas blurred on `visibilitychange` |
| DevTools | Console timing detection; reports to suspicious events |
| Hotlinking | Signed presigned URLs; Nginx referer checks |
| Clickjacking | `X-Frame-Options: DENY` + CSP `frame-ancestors 'none'` |

## Key Features

- **Zero raw-file exposure** — PDFs are never streamed directly to browsers
- **Dynamic per-session watermarks** via Sharp SVG compositing
- **OTP gate** — email verification before document access
- **Expiry, view-limit, IP & email allowlisting** per share
- **One-click revocation** with SSE push to active viewers
- **Complete audit trail** — every page view, access attempt, print, download
- **Suspicious activity detection** — DevTools, rapid paging, multiple sessions
- **Admin dashboard** — user management, suspicious events, platform analytics
- **BullMQ workers** — async PDF processing, cleanup, email delivery
- **Redis SSE** — real-time viewer tracking per document

## Project Structure

```
sbcfiles/
├── app/                          # Next.js App Router
│   ├── (auth)/                   # Login / Register (unauthenticated)
│   ├── (dashboard)/              # Protected dashboard pages
│   ├── (admin)/                  # Admin-only pages
│   ├── view/[token]/             # Public secure viewer
│   └── api/
│       ├── auth/                 # Login, register, OTP, logout
│       ├── documents/            # CRUD + upload
│       ├── shares/               # Share management + revoke
│       ├── viewer/               # Page streaming, OTP, suspicious events
│       ├── admin/                # Analytics
│       ├── realtime/             # SSE stream
│       └── health/               # Health check
├── src/
│   ├── lib/
│   │   ├── auth/                 # JWT, sessions, OTP
│   │   ├── crypto/               # AES-256-GCM, token hashing
│   │   ├── db/                   # Prisma client singleton
│   │   ├── storage/              # S3/MinIO operations
│   │   ├── watermark/            # Dynamic watermark via Sharp
│   │   ├── audit/                # Audit log writer
│   │   ├── realtime/             # Redis SSE pub/sub
│   │   ├── queue/                # BullMQ queue definitions
│   │   ├── email/                # Nodemailer
│   │   ├── rate-limit/           # Sliding window via Redis
│   │   ├── validation/           # File magic-byte validation
│   │   └── api/                  # Response helpers
│   ├── components/
│   │   ├── viewer/               # SecureViewer, OtpGate
│   │   ├── upload/               # UploadZone
│   │   ├── layout/               # Sidebar
│   │   └── ui/                   # Button, Input
│   └── types/                    # Shared TypeScript types
├── workers/
│   ├── pdf-processor.ts          # PDF → JPEG via Ghostscript
│   └── cleanup.ts                # Expired shares, deleted docs, OTPs
├── prisma/schema.prisma           # Full DB schema
├── nginx/nginx.conf               # Production reverse proxy
├── docker-compose.yml             # Full production stack
├── Dockerfile                     # Next.js app image
└── Dockerfile.worker              # Worker image
```

## Quick Start (Docker)

### Prerequisites
- Docker & Docker Compose
- Node.js 22+ (for local dev)

### 1. Configure environment

```bash
cp .env.example .env
# Edit .env — generate secrets:
openssl rand -hex 64   # JWT secrets
openssl rand -hex 32   # ENCRYPTION_KEY
```

### 2. Start services

```bash
docker compose up -d
```

### 3. Run migrations

```bash
docker compose exec app pnpm db:migrate
```

### 4. Create MinIO bucket

```bash
# Via MinIO console at http://localhost:9001
# Or via mc:
docker compose exec minio mc mb local/sbcfiles-documents
```

The app is now running at `http://localhost` (via Nginx).

## Local Development

Requires Node.js 18+ and local PostgreSQL, Redis, MinIO.

```bash
pnpm install
cp .env.example .env.local  # set DATABASE_URL, REDIS_URL, S3_*, JWT_*, ENCRYPTION_KEY

pnpm db:push        # sync schema to local DB
pnpm dev            # Next.js dev server on :3000

# In separate terminals:
pnpm worker:pdf     # PDF processing worker
pnpm worker:cleanup # Cleanup worker
```

> **Note:** Ghostscript must be installed for PDF processing (`apt install ghostscript` / `brew install ghostscript`).

## Database Schema

11 tables: `User`, `Session`, `OtpCode`, `Document`, `DocumentPage`, `Share`, `Recipient`, `AuditLog`, `SuspiciousEvent`, `Notification` — all with soft-delete, audit timestamps, and indexes.

## API Reference

| Method | Path | Description |
|---|---|---|
| POST | /api/auth/register | Create account |
| POST | /api/auth/login | Authenticate, set cookies |
| POST | /api/auth/logout | Invalidate session |
| POST | /api/auth/verify-otp | Verify email / doc access OTP |
| GET | /api/documents | List user documents |
| POST | /api/documents | Upload document |
| GET | /api/documents/:id | Get document details |
| DELETE | /api/documents/:id | Soft-delete document |
| GET | /api/shares | List shares |
| POST | /api/shares | Create share link |
| POST | /api/shares/:id/revoke | Revoke access |
| POST | /api/viewer/access | Validate share token, get metadata |
| GET | /api/viewer/page | Stream watermarked page image |
| POST | /api/viewer/suspicious | Report suspicious client event |
| POST | /api/viewer/resend-otp | Resend OTP to viewer |
| GET | /api/realtime | SSE stream for document activity |
| GET | /api/admin/analytics | Admin platform analytics |
| GET | /api/health | Health check |

## Security Limitations

No DRM system can fully prevent:
- **Phone camera recording** — deterred by watermarks containing session/IP/email
- **Screenshots** — OS-level; mitigated by watermarks and behavioral monitoring
- **Memory dumping** — out of scope for web-based DRM

Focus is on **deterrence**, **traceability**, and **audit** rather than absolute prevention.

## Scaling

- **Horizontal scaling**: App containers are stateless — add replicas behind Nginx
- **Workers**: Scale `worker-pdf` independently based on queue depth
- **Redis**: Use Redis Sentinel or Redis Cluster for HA
- **PostgreSQL**: Read replicas for analytics queries; connection pooling via PgBouncer
- **MinIO**: Multi-node distributed mode for production storage HA
- **CDN**: Not used for secure pages — all viewer traffic must go through the app for watermarking

## License

MIT
