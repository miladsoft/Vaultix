import { requireSession } from '@/lib/auth/session'
import { createSSEStream, documentChannel, userChannel } from '@/lib/realtime/sse'
import { unauthorized } from '@/lib/api/response'

export const dynamic = 'force-dynamic'

export async function GET(req: Request): Promise<Response> {
  const session = await requireSession().catch(() => null)
  if (!session) return unauthorized()

  const url = new URL(req.url)
  const documentId = url.searchParams.get('documentId')

  // Subscribe to a single document channel, or fall back to the
  // session user's channel for live updates across all their documents.
  const channel = documentId ? documentChannel(documentId) : userChannel(session.sub)
  const stream = createSSEStream(channel)

  return new Response(stream, {
    headers: {
      'Content-Type': 'text/event-stream',
      'Cache-Control': 'no-cache',
      Connection: 'keep-alive',
      'X-Accel-Buffering': 'no',
    },
  })
}
