'use client'

import { useEffect, useRef, useState, useCallback } from 'react'
import { ChevronLeft, ChevronRight, Download, FileText, Maximize2, ShieldAlert } from 'lucide-react'
import { v4 as uuidv4 } from 'uuid'
import type { DocumentMeta } from '@/types'

interface SecureViewerProps {
  document: DocumentMeta
  token: string
  email?: string
  name?: string
}

export function SecureViewer({ document: documentMeta, token, email, name }: SecureViewerProps) {
  const [currentPage, setCurrentPage] = useState(1)
  const [isBlurred, setIsBlurred] = useState(false)
  const [sessionId] = useState(() => uuidv4())
  const containerRef = useRef<HTMLDivElement>(null)
  const canvasRef = useRef<HTMLCanvasElement>(null)

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
      if (window.document.hidden) {
        setIsBlurred(true)
      } else {
        setIsBlurred(false)
      }
    }
    window.document.addEventListener('visibilitychange', handleVisibility)
    return () => window.document.removeEventListener('visibilitychange', handleVisibility)
  }, [])

  // DevTools detection via console timing
  useEffect(() => {
    let devToolsOpen = false
    const threshold = 160

    const check = () => {
      const before = performance.now()
      console.profile()
      console.profileEnd()
      const after = performance.now()
      if (after - before > threshold && !devToolsOpen) {
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
      const canvas = canvasRef.current
      if (!canvas) return

      const params = new URLSearchParams({
        token,
        pageNumber: String(page),
        sessionId,
        ...(email && { email }),
        ...(name && { name }),
      })

      const res = await fetch(`/api/viewer/page?${params}`)
      if (!res.ok) return

      const blob = await res.blob()
      const url = URL.createObjectURL(blob)
      const img = new Image()

      img.onload = () => {
        const ctx = canvas.getContext('2d')
        if (!ctx) return
        canvas.width = img.width
        canvas.height = img.height
        ctx.drawImage(img, 0, 0)
        URL.revokeObjectURL(url)
      }
      img.src = url
    },
    [token, sessionId, email, name],
  )

  useEffect(() => {
    loadPage(currentPage)
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
          style={{ pointerEvents: isBlurred ? 'none' : 'auto' }}
          onClick={() => setIsBlurred(false)}
        >
          <canvas
            ref={canvasRef}
            className="block max-h-[calc(100dvh-230px)] max-w-full rounded-lg object-contain sm:max-h-[calc(100dvh-172px)]"
          />
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
          disabled={currentPage === 1}
          className="min-h-9 rounded-lg border border-slate-800 bg-slate-900 px-3 text-sm text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-40 focus-ring"
        >
          First
        </button>
        <button
          onClick={() => goTo(currentPage - 1)}
          disabled={currentPage === 1}
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
          disabled={currentPage === documentMeta.pageCount}
          className="inline-flex min-h-9 items-center gap-1 rounded-lg border border-slate-800 bg-slate-900 px-3 text-sm text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-40 focus-ring"
        >
          Next
          <ChevronRight className="h-4 w-4" />
        </button>
        <button
          onClick={() => goTo(documentMeta.pageCount)}
          disabled={currentPage === documentMeta.pageCount}
          className="min-h-9 rounded-lg border border-slate-800 bg-slate-900 px-3 text-sm text-slate-300 transition-colors hover:bg-slate-800 disabled:opacity-40 focus-ring"
        >
          Last
        </button>
      </footer>
    </div>
  )
}
