'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Download, FileText, Loader2, Maximize2, RefreshCw, ShieldAlert } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import type { DocumentMeta } from '@/types'

interface SecureViewerProps {
  document: DocumentMeta
  token: string
  email?: string
  name?: string
}

const RETRY_DELAYS_MS = [800, 2000, 4000]

// A 503 means the page is rendered/watermarked on demand and is briefly
// "not ready yet" (page still processing or watermark transiently failed).
// We keep polling these for a generous window with capped backoff so the
// viewer recovers on its own instead of forcing the user to refresh.
const PREPARING_MAX_ATTEMPTS = 45
const PREPARING_BACKOFF_MS = [600, 800, 1000, 1500, 2000, 3000]
// Transient network/decode failures get a small bounded number of retries.
const TRANSIENT_MAX_RETRIES = RETRY_DELAYS_MS.length

export function SecureViewer({ document: documentMeta, token, email, name }: SecureViewerProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [isBlurred, setIsBlurred] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [isPreparing, setIsPreparing] = useState(false)
  const [loadError, setLoadError] = useState(false)
  const [sessionId] = useState(() => uuidv4())
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)
  const abortRef = useRef<AbortController | null>(null)

  // Block context menu, drag, keyboard shortcuts
  useEffect(() => {
    const block = (e: Event) => e.preventDefault()
    const blockKeys = (e: KeyboardEvent) => {
      const forbidden = [
        e.ctrlKey && e.key === 'p', // print
        e.ctrlKey && e.key === 's', // save
        e.ctrlKey && e.key === 'c', // copy
        e.ctrlKey && e.key === 'u', // view source
        e.ctrlKey && e.shiftKey && e.key === 'I', // devtools
        e.key === 'PrintScreen',
        e.metaKey && e.key === 'p',
        e.metaKey && e.key === 's',
      ]
      if (!documentMeta.allowPrint && (e.ctrlKey || e.metaKey) && e.key === 'p') {
        e.preventDefault()
        return
      }
      if (!documentMeta.allowCopy && (e.ctrlKey || e.metaKey) && e.key === 'c') {
        e.preventDefault()
        return
      }
      if (forbidden.some(Boolean)) e.preventDefault()
    }

    window.document.addEventListener('contextmenu', block)
    window.addEventListener('keydown', blockKeys)
    window.addEventListener('dragstart', block)

    return () => {
      window.document.removeEventListener('contextmenu', block)
      window.removeEventListener('keydown', blockKeys)
      window.removeEventListener('dragstart', block)
    }
  }, [documentMeta.allowPrint, documentMeta.allowCopy])

  // Blur on tab switch
  useEffect(() => {
    const handleVisibility = () => {
      setIsBlurred(window.document.hidden)
    }
    window.document.addEventListener('visibilitychange', handleVisibility)
    return () => window.document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // DevTools detection via console timing
  useEffect(() => {
    let devToolsOpen = false
    const check = () => {
      const before = performance.now()
      console.profile()
      console.profileEnd()
      if (performance.now() - before > 160 && !devToolsOpen) {
        devToolsOpen = true
        fetch('/api/viewer/suspicious', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ token, type: 'DEVTOOLS_DETECTED', sessionId }),
        }).catch(() => {})
      }
    }
    const id = setInterval(check, 3000)
    return () => clearInterval(id)
  }, [token, sessionId])

  const loadPage = useCallback(
    async (page: number) => {
      // Cancel any in-flight request for a previous page
      abortRef.current?.abort()
      const controller = new AbortController()
      abortRef.current = controller

      setIsLoading(true)
      setIsPreparing(false)
      setLoadError(false)

      const canvas = canvasRef.current
      if (!canvas) return

      const params = new URLSearchParams({
        token,
        pageNumber: String(page),
        sessionId,
        ...(email && { email }),
        ...(name && { name }),
      })

      const wait = (ms: number) =>
        new Promise<void>((resolve) => setTimeout(resolve, ms))

      const renderBlob = (blob: Blob) =>
        new Promise<void>((resolve, reject) => {
          const url = URL.createObjectURL(blob)
          const img = new Image()
          img.onload = () => {
            if (controller.signal.aborted) {
              URL.revokeObjectURL(url)
              reject(new DOMException('Aborted', 'AbortError'))
              return
            }
            const ctx = canvas.getContext('2d')
            if (!ctx) {
              URL.revokeObjectURL(url)
              reject(new Error('Canvas context unavailable'))
              return
            }
            canvas.width = img.naturalWidth
            canvas.height = img.naturalHeight
            ctx.clearRect(0, 0, canvas.width, canvas.height)
            ctx.drawImage(img, 0, 0)
            URL.revokeObjectURL(url)
            resolve()
          }
          img.onerror = () => {
            URL.revokeObjectURL(url)
            reject(new Error('Image decode failed'))
          }
          img.src = url
        })

      let preparingAttempts = 0
      let transientRetries = 0

      // Single resilient loop: 503 (page/watermark not ready yet) is retried
      // persistently with capped backoff; other failures get a few retries.
      // eslint-disable-next-line no-constant-condition
      while (true) {
        if (controller.signal.aborted) return

        try {
          const res = await fetch(`/api/viewer/page?${params}`, {
            signal: controller.signal,
          })

          if (res.status === 503) {
            // Still preparing — keep waiting and show a dedicated state.
            preparingAttempts++
            if (preparingAttempts > PREPARING_MAX_ATTEMPTS) {
              throw new Error('Preparation timed out')
            }
            if (!controller.signal.aborted) setIsPreparing(true)
            const delay =
              PREPARING_BACKOFF_MS[Math.min(preparingAttempts - 1, PREPARING_BACKOFF_MS.length - 1)]
            await wait(delay)
            continue
          }

          if (!res.ok) {
            // 403/404/410 etc. are terminal — no point retrying.
            throw new Error(`HTTP ${res.status}`)
          }

          const blob = await res.blob()
          await renderBlob(blob)

          if (!controller.signal.aborted) {
            setIsLoading(false)
            setIsPreparing(false)
            setLoadError(false)
          }
          return
        } catch (e) {
          if ((e as Error).name === 'AbortError') return

          // Bounded retries for transient network/decode errors.
          const message = (e as Error).message
          const isHttp = message.startsWith('HTTP ')
          if (!isHttp && transientRetries < TRANSIENT_MAX_RETRIES) {
            await wait(RETRY_DELAYS_MS[transientRetries])
            transientRetries++
            continue
          }

          if (!controller.signal.aborted) {
            setIsLoading(false)
            setIsPreparing(false)
            setLoadError(true)
          }
          return
        }
      }
    },
    [token, sessionId, email, name],
  )

  useEffect(() => {
    loadPage(currentPage)
    return () => {
      abortRef.current?.abort()
    }
  }, [currentPage, loadPage])

  const goTo = (page: number) => {
    if (page >= 1 && page <= documentMeta.pageCount) setCurrentPage(page)
  }

  const downloadUrl = `/api/viewer/download?${new URLSearchParams({
    token,
    sessionId,
  })}`

  return (
    <div
      ref={containerRef}
      className="flex h-dvh flex-col select-none overflow-hidden bg-slate-950"
      style={{ userSelect: 'none', WebkitUserSelect: 'none' }}
      onContextMenu={(e) => e.preventDefault()}
    >
      <header className="z-20 flex shrink-0 flex-col gap-3 border-b border-slate-800/80 bg-slate-950/90 px-4 py-3 backdrop-blur-xl sm:flex-row sm:items-center sm:justify-between">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-teal-400/10 text-teal-300 ring-1 ring-teal-400/20">
            <FileText className="h-5 w-5" />
          </div>
          <div className="min-w-0">
            <span className="block truncate font-semibold text-white">{documentMeta.title}</span>
            <span className="text-xs text-slate-500">Session-bound secure preview</span>
          </div>
        </div>
        <div className="flex shrink-0 flex-wrap items-center gap-2 text-sm text-slate-400">
          <span className="rounded-lg border border-slate-800 bg-slate-900 px-3 py-1.5 text-xs">
            Page {currentPage} / {documentMeta.pageCount}
          </span>
          <button
            type="button"
            onClick={() => containerRef.current?.requestFullscreen?.()}
            className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-slate-800 bg-slate-900 text-slate-300 transition-colors hover:bg-slate-800 focus-ring"
            aria-label="Fullscreen"
          >
            <Maximize2 className="h-4 w-4" />
          </button>
          {documentMeta.allowDownload && (
            <a
              href={downloadUrl}
              className="inline-flex min-h-8 items-center gap-1.5 rounded-lg bg-teal-500 px-3 text-xs font-medium text-slate-950 transition-colors hover:bg-teal-400 focus-ring"
            >
              <Download className="h-3.5 w-3.5" />
              Download
            </a>
          )}
        </div>
      </header>

      <main className="relative flex min-h-0 flex-1 items-center justify-center overflow-auto bg-[radial-gradient(circle_at_center,rgba(15,23,42,0.9),#020617_72%)] p-3 sm:p-5">
        {isBlurred && (
          <div className="absolute inset-0 z-50 flex items-center justify-center bg-slate-950/90 p-4 backdrop-blur-xl">
            <div className="max-w-sm rounded-2xl border border-slate-800 bg-slate-900 p-6 text-center shadow-2xl">
              <ShieldAlert className="mx-auto mb-3 h-9 w-9 text-amber-300" />
              <p className="text-lg font-semibold text-white">Viewing paused</p>
              <p className="mt-1 text-sm text-slate-500">The document is hidden while this tab is inactive.</p>
              <button onClick={() => setIsBlurred(false)} className="mt-5 min-h-10 rounded-lg bg-teal-500 px-4 text-sm font-medium text-slate-950 hover:bg-teal-400 focus-ring">
                Resume viewing
              </button>
            </div>
          </div>
        )}

        <div
          className="relative rounded-lg bg-white shadow-2xl shadow-slate-950/60 ring-1 ring-slate-700/70"
          style={{ pointerEvents: isBlurred ? 'none' : 'auto', minWidth: 320, minHeight: 450 }}
          onClick={() => setIsBlurred(false)}
        >
          <canvas
            ref={canvasRef}
            className="block max-h-[calc(100dvh-230px)] max-w-full rounded-lg object-contain sm:max-h-[calc(100dvh-172px)]"
          />

          {/* Loading overlay */}
          {isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 rounded-lg bg-slate-900/80 backdrop-blur-sm">
              <Loader2 className="h-8 w-8 animate-spin text-teal-400" />
              <span className="text-sm text-slate-400">
                {isPreparing ? `Preparing secure page ${currentPage}…` : `Loading page ${currentPage}…`}
              </span>
              {isPreparing && (
                <span className="text-xs text-slate-500">Rendering watermark &amp; protected preview</span>
              )}
            </div>
          )}

          {/* Error overlay */}
          {loadError && !isLoading && (
            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-lg bg-slate-900/90 backdrop-blur-sm">
              <ShieldAlert className="h-8 w-8 text-red-400" />
              <div className="text-center">
                <p className="text-sm font-medium text-white">Failed to load page</p>
                <p className="mt-1 text-xs text-slate-500">A temporary error occurred while rendering the page.</p>
              </div>
              <button
                type="button"
                onClick={() => loadPage(currentPage)}
                className="inline-flex items-center gap-2 rounded-lg bg-teal-500 px-4 py-2 text-sm font-medium text-slate-950 transition-colors hover:bg-teal-400 focus-ring"
              >
                <RefreshCw className="h-4 w-4" />
                Retry
              </button>
            </div>
          )}

          {/* Anti-screenshot overlay — transparent but breaks copy-paste */}
          <div
            className="absolute inset-0 pointer-events-none"
            style={{ mixBlendMode: 'multiply', opacity: 0.001, background: 'white' }}
          />
        </div>
      </main>

      <footer className="z-20 flex shrink-0 flex-wrap items-center justify-center gap-2 border-t border-slate-800/80 bg-slate-950/90 px-3 py-3 backdrop-blur-xl sm:gap-3 sm:px-4">
        <button
          onClick={() => goTo(1)}
          disabled={currentPage === 1 || isLoading}
          className="min-h-9 rounded-lg border border-slate-800 bg-slate-900 px-3 text-sm text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-40 focus-ring"
        >
          First
        </button>
        <button
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage === 1 || isLoading}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3 text-sm text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-40 focus-ring"
        >
          <ChevronLeft className="h-4 w-4" />
          Prev
        </button>

        <div className="flex items-center gap-1">
          <input
            type="number"
            min={1}
            max={documentMeta.pageCount}
            value={currentPage}
            onChange={(e) => goTo(parseInt(e.target.value) || 1)}
            className="h-9 w-16 rounded-lg border border-slate-700 bg-slate-900 px-2 text-center text-sm text-white focus:border-teal-400 focus:outline-none focus:ring-2 focus:ring-teal-400/60"
          />
          <span className="text-slate-500 text-sm">/ {documentMeta.pageCount}</span>
        </div>

        <button
          onClick={() => goTo(currentPage + 1)}
          disabled={currentPage === documentMeta.pageCount || isLoading}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3 text-sm text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-40 focus-ring"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => goTo(documentMeta.pageCount)}
          disabled={currentPage === documentMeta.pageCount || isLoading}
          className="min-h-9 rounded-lg border border-slate-800 bg-slate-900 px-3 text-sm text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-40 focus-ring"
        >
          Last
        </button>
      </footer>
    </div>
  )
}
