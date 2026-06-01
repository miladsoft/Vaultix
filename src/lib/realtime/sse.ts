import { Redis } from 'ioredis'

let pub: Redis | null = null
let sub: Redis | null = null

function getPub(): Redis {
  if (!pub) pub = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
  return pub
}

function getSub(): Redis {
  if (!sub) sub = new Redis(process.env.REDIS_URL ?? 'redis://localhost:6379')
  return sub
}

export type RealtimeEvent =
  | { type: 'viewer_joined'; shareId: string; sessionId: string; email?: string }
  | { type: 'viewer_left'; shareId: string; sessionId: string }
  | { type: 'page_viewed'; shareId: string; sessionId: string; page: number }
  | { type: 'access_revoked'; shareId: string }
  | { type: 'suspicious_activity'; shareId: string; eventType: string }
  | { type: 'document_status'; documentId: string; status: 'PENDING' | 'PROCESSING' | 'READY' | 'FAILED'; pageCount?: number }

export async function publishEvent(
  channelKey: string,
  event: RealtimeEvent,
): Promise<void> {
  await getPub().publish(channelKey, JSON.stringify(event))
}

export function createSSEStream(channelKey: string): ReadableStream {
  const subscriber = getSub().duplicate()

  return new ReadableStream({
    start(controller) {
      const encoder = new TextEncoder()

      subscriber.subscribe(channelKey, (err) => {
        if (err) {
          controller.error(err)
        }
      })

      subscriber.on('message', (_channel: string, message: string) => {
        controller.enqueue(encoder.encode(`data: ${message}\n\n`))
      })

      // Heartbeat every 30s to keep connection alive
      const heartbeat = setInterval(() => {
        try {
          controller.enqueue(encoder.encode(': heartbeat\n\n'))
        } catch {
          clearInterval(heartbeat)
        }
      }, 30_000)
    },
    cancel() {
      subscriber.unsubscribe()
      subscriber.disconnect()
    },
  })
}

export function documentChannel(documentId: string): string {
  return `doc:${documentId}`
}

export function shareChannel(shareId: string): string {
  return `share:${shareId}`
}

export function userChannel(userId: string): string {
  return `user:${userId}`
}
