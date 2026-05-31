```text
You are a senior enterprise software architect and security engineer.

I want you to build a production-grade Secure Document Sharing and DRM Platform similar to Digify, DocSend, and enterprise virtual data rooms.

The platform must be modern, scalable, secure, modular, and designed for highly sensitive business documents.

Tech Stack:
- Next.js 16 (App Router)
- React 19
- TypeScript
- Tailwind CSS
- shadcn/ui
- PostgreSQL
- Prisma ORM
- Redis
- MinIO or S3-compatible storage
- Dockerized architecture
- Queue processing
- SSE/WebSocket for realtime updates
- Production-ready clean architecture

Project Name:
SBC Files

Main Goal:
Allow users to securely upload and share sensitive documents with advanced restrictions such as:
- expiry dates
- view-only access
- watermarking
- no download
- no print
- no copy
- OTP verification
- audit logs
- access revocation
- secure preview rendering

====================================================
CORE FEATURES
====================================================

1. Authentication & Security
- Email/password authentication
- OTP verification via email
- JWT access tokens
- Refresh token rotation
- Device/session management
- Optional 2FA
- IP-based access restrictions
- Rate limiting
- CSRF/XSS protection
- Secure headers
- Content Security Policy
- Encrypted storage references
- Hashed secure sharing tokens

2. Secure Document Upload
Support:
- PDF
- DOCX
- XLSX
- Images

Requirements:
- Virus scan hook
- File validation
- Size limits
- MIME validation
- Metadata extraction
- Encrypted file storage
- Original file should NEVER be directly exposed publicly

3. PDF Secure Rendering Engine
VERY IMPORTANT:

Do NOT expose raw PDF files directly to the browser.

Instead:
- Convert PDF pages into secure image previews
- Render pages progressively
- Store rendered pages securely
- Stream previews to frontend

Each page preview must contain:
- Dynamic watermark
- Anti-copy overlay
- Session-bound rendering

4. Dynamic Watermark System
Generate realtime watermark overlays containing:
- recipient name
- recipient email
- IP address
- current timestamp
- unique session ID

Watermark must:
- appear diagonally
- repeat across the page
- have configurable opacity
- update dynamically

5. Secure Sharing System
Users can:
- share documents via email
- generate secure links
- define recipient permissions

Permissions:
- view only
- allow download
- allow print
- allow copy
- allow screen capture warning
- expiration date
- maximum view count
- revoke access anytime

6. OTP Access Verification
Before opening sensitive documents:
- recipient must verify via OTP email
- OTP expiration
- brute-force protection
- device tracking

7. Secure Viewer
Build custom secure viewer with:
- disabled right click
- disabled text selection
- disabled drag
- disabled save shortcuts
- disabled print shortcuts
- blurred view on inactive tab
- screen recording detection warning if possible
- fullscreen mode
- progressive rendering
- realtime watermarking

8. Audit Logs & Monitoring
Track everything:
- document opened
- pages viewed
- duration viewed
- IP address
- browser/device
- failed attempts
- suspicious activity
- revoked access attempts
- expired access attempts
- downloads
- prints

Create enterprise-grade activity dashboard.

9. Admin Dashboard
Dashboard should include:
- uploaded documents
- active shares
- recipient management
- activity analytics
- suspicious activity alerts
- revoke access
- document expiration management
- realtime online viewers

10. Realtime System
Use SSE or WebSocket for:
- realtime viewer tracking
- live access notifications
- revocation updates
- suspicious activity alerts

11. Database Design
Design complete scalable PostgreSQL schema.

Required tables:
- users
- documents
- document_pages
- recipients
- shares
- permissions
- access_logs
- otp_codes
- sessions
- suspicious_events
- notifications

Add:
- indexes
- relations
- soft delete
- audit fields
- optimized queries

12. Background Processing
Implement queue workers for:
- PDF conversion
- image optimization
- watermark generation
- email sending
- cleanup jobs
- expiration checks
- suspicious activity analysis

13. Docker Architecture
Create complete production Docker setup:
- Next.js app
- PostgreSQL
- Redis
- MinIO
- Worker services
- Nginx reverse proxy

Include:
- docker-compose.yml
- health checks
- restart policies
- volume persistence
- environment variables
- production optimizations

14. API Architecture
Build clean enterprise APIs:
- REST API
- typed responses
- centralized error handling
- validation layer
- RBAC middleware
- structured logging

15. UI/UX Requirements
Design style:
- enterprise SaaS
- modern
- minimal
- premium
- dark/light mode
- smooth animations
- responsive

Use:
- shadcn/ui
- Tailwind CSS
- Framer Motion

Pages:
- Login
- Dashboard
- Upload Center
- Document Viewer
- Share Management
- Activity Logs
- Admin Panel
- Settings

16. Security Hardening
Implement:
- secure cookies
- CSP
- anti-clickjacking
- anti-hotlinking
- signed URLs
- temporary asset URLs
- encrypted secrets
- environment separation
- rate limiting
- WAF-ready architecture

17. Performance Requirements
Optimize for:
- large PDFs
- concurrent viewers
- streaming
- caching
- lazy loading
- pagination
- async rendering
- worker scalability

18. Future AI Features Preparation
Architecture must support future AI integrations:
- AI document classification
- AI leak detection
- AI OCR
- AI risk analysis
- AI summarization

====================================================
DELIVERABLES
====================================================

I want:
1. Full project architecture
2. Folder structure
3. Database schema
4. Prisma schema
5. API routes
6. Security architecture
7. Docker architecture
8. Worker architecture
9. Secure rendering strategy
10. UI architecture
11. Realtime architecture
12. Access control design
13. Step-by-step implementation roadmap
14. Production deployment guide
15. Scaling recommendations
16. Enterprise best practices
17. Suggested libraries/packages
18. Code examples
19. Threat model analysis
20. Security limitations explanation

====================================================
IMPORTANT NOTES
====================================================

No DRM system can fully prevent:
- screenshots
- phone camera recording

Therefore focus heavily on:
- watermarking
- traceability
- audit logs
- access control
- behavioral monitoring
- deterrence

The architecture must be:
- enterprise-grade
- scalable
- secure
- modular
- maintainable
- production-ready

Act like a principal software architect designing a premium SaaS platform used by banks, insurance companies, enterprise legal firms, and governments.
```
