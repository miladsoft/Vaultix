import { z } from 'zod'
import { prisma } from '@/lib/db/client'
import { hashToken, decryptStorageKey } from '@/lib/crypto/encryption'
import { downloadFile } from '@/lib/storage/s3'
import { applyWatermark, buildWatermarkText } from '@/lib/watermark/generator'
import { logAudit, extractRequestMeta } from '@/lib/audit/logger'
import { publishEvent, shareChannel } from '@/lib/realtime/sse'
import { checkApiRateLimit } from '@/lib/rate-limit/limiter'
import { err, forbidden, tooManyRequests } from '@/lib/api/response'

const schema = z.object({
  token: z.string().min(32),
  pageNumber: z.coerce.number().int().min(1).max(2000),
  sessionId: z.string().min(8),
  email: z.string().email().optional(),
  name: z.string().optional(),
})

// Returns a watermarked page image — never raw PDF
export async function GET(req: Request): Promise<Response> {
  const { ipAddress, userAgent } = extractRequestMeta(req)

  const limit = await checkApiRateLimit(`page:${ipAddress}`)
  if (!limit.allowed) return tooManyRequests()

  const url = new URL(req.url)
  const parsed = schema.safeParse(Object.fromEntries(url.searchParams))
  if (!parsed.success) return err('Invalid parameters')

  const { token, pageNumber, sessionId, email, name } = parsed.data
  const hashedToken = hashToken(token)

  const share = await prisma.share.findUnique({
    where: { token: hashedToken },
    include: { document: { select: { id: true, pageCount: true, status: true } } },
  })

  if (!share || share.status !== 'ACTIVE') return forbidden()
  if (share.expiresAt && share.expiresAt < new Date()) {
    await prisma.share.update({ where: { id: share.id }, data: { status: 'EXPIRED' } }).catch(() => {})
    return err('This link has expired', 410)
  }
  if (share.maxViews !== null && share.currentViews > share.maxViews) {
    return err('Maximum view limit reached', 410)
  }
  if (pageNumber > share.document.pageCount) return err('Page not found', 404)

  const page = await prisma.documentPage.findUnique({
    where: { documentId_pageNumber: { documentId: share.document.id, pageNumber } },
  })

  if (!page || !page.isRendered) return err('Page not ready', 503)

  const rawKey = decryptStorageKey(page.storageKey)
  const pageBuffer = await downloadFile(rawKey)

  let imageBuffer = pageBuffer

  if (share.showWatermark) {
    const watermarkConfig = buildWatermarkText(
      name ?? share.recipientName ?? 'Viewer',
      email ?? share.recipientEmail ?? ipAddress,
      ipAddress,
      sessionId,
    )

    let watermarkApplied = false
    for (let attempt = 0; attempt < 2; attempt++) {
      try {
        imageBuffer = await applyWatermark(pageBuffer, watermarkConfig)
        watermarkApplied = true
        break
      } catch (e) {
        console.error(`[watermark] attempt ${attempt + 1} failed for page ${pageNumber} of share ${share.id}:`, e)
      }
    }

    if (!watermarkApplied) {
      return err('Page temporarily unavailable — watermark could not be applied', 503)
    }
  }

  await logAudit({
    action: 'PAGE_VIEWED',
    shareId: share.id,
    documentId: share.document.id,
    ipAddress,
    userAgent,
    pageNumber,
    sessionId,
  })

  await publishEvent(shareChannel(share.id), {
    type: 'page_viewed',
    shareId: share.id,
    sessionId,
    page: pageNumber,
  })

  return new Response(new Uint8Array(imageBuffer), {
    headers: {
      'Content-Type': 'image/jpeg',
      'Cache-Control': 'no-store, no-cache, must-revalidate, private',
      'X-Content-Type-Options': 'nosniff',
      'X-Frame-Options': 'DENY',
      'Content-Disposition': 'inline',
      Pragma: 'no-cache',
    },
  })
}
