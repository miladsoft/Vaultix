'use client'

import { useEffect, useRef } from 'react'
import { useRouter } from 'next/navigation'

interface DocumentStatusWatcherProps {
  /**
   * When provided, only listens to a single document channel.
   * Otherwise listens to the current user's channel (all their documents).
   */
  documentId?: string
  /**
   * Whether any document on the page is still processing. When false, no SSE
   * connection is opened — avoids idle streams once everything is READY.
   */
  active?: boolean
}

/**
 * Subscribes to realtime document status events and refreshes the current
 * route when a document finishes processing (PROCESSING -> READY/FAILED),
 * so statuses flip to "Ready" live without a manual page refresh.
 */
export function DocumentStatusWatcher({ documentId, active = true }: DocumentStatusWatcherProps) {
  const router = useRouter()
  const refreshTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    if (!active) return

    const url = documentId ? `/api/realtime?documentId=${encodeURIComponent(documentId)}` : '/api/realtime'
    const source = new EventSource(url)

    const scheduleRefresh = () => {
      // Debounce bursts of events (e.g. several documents finishing together).
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      refreshTimer.current = setTimeout(() => router.refresh(), 300)
    }

    source.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data)
        if (data?.type === 'document_status' && (data.status === 'READY' || data.status === 'FAILED')) {
          scheduleRefresh()
        }
      } catch {
        // ignore heartbeats / malformed frames
      }
    }

    source.onerror = () => {
      // EventSource auto-reconnects; nothing to do here.
    }

    return () => {
      if (refreshTimer.current) clearTimeout(refreshTimer.current)
      source.close()
    }
  }, [documentId, active, router])

  return null
}
