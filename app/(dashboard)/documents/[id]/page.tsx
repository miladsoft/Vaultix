import Link from 'next/link'
import { notFound, redirect } from 'next/navigation'
import { ArrowLeft, CalendarClock, CheckCircle2, Download, Eye, FileText, Fingerprint, LockKeyhole, Share2, ShieldCheck } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { formatBytes, formatDate } from '@/lib/utils'
import { clampPage, getPage, getPageCount, Pagination } from '@/components/ui/pagination'
import { EmptyState, PageHeader, PageShell, StatusBadge, Surface } from '@/components/ui/surface'
import { DocumentStatusWatcher } from '@/components/dashboard/DocumentStatusWatcher'

export const metadata = { title: 'Document | SBC Files' }

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ sharesPage?: string }>
}

const SHARES_PAGE_SIZE = 6

export default async function DocumentPage({ params, searchParams }: Props) {
  const session = await getSession()
  if (!session) redirect('/login')

  const [{ id }, { sharesPage: sharesPageParam }] = await Promise.all([params, searchParams])

  const doc = await prisma.document.findFirst({
    where: {
      id,
      deletedAt: null,
      ...(session.role !== 'ADMIN' && { userId: session.sub }),
    },
    include: {
      pages: { select: { pageNumber: true, isRendered: true }, orderBy: { pageNumber: 'asc' } },
    },
  })

  if (!doc) return notFound()

  const totalShares = await prisma.share.count({ where: { documentId: doc.id, status: 'ACTIVE' } })
  const sharesPageCount = getPageCount(totalShares, SHARES_PAGE_SIZE)
  const sharesPage = clampPage(getPage(sharesPageParam), sharesPageCount)
  const shares = await prisma.share.findMany({
    where: { documentId: doc.id, status: 'ACTIVE' },
    select: {
      id: true,
      recipientEmail: true,
      recipientName: true,
      expiresAt: true,
      currentViews: true,
      maxViews: true,
      allowDownload: true,
      allowPrint: true,
      showWatermark: true,
      requiresOtp: true,
      createdAt: true,
    },
    orderBy: { createdAt: 'desc' },
    skip: (sharesPage - 1) * SHARES_PAGE_SIZE,
    take: SHARES_PAGE_SIZE,
  })

  const renderedPages = doc.pages.filter((page) => page.isRendered).length
  const renderPercent = doc.pages.length > 0 ? Math.round((renderedPages / doc.pages.length) * 100) : 0

  const statusStyle: Record<string, string> = {
    READY: 'bg-emerald-400/10 text-emerald-300',
    PROCESSING: 'bg-amber-400/10 text-amber-300',
    PENDING: 'bg-slate-800 text-slate-400',
    FAILED: 'bg-red-400/10 text-red-300',
    DELETED: 'bg-red-400/10 text-red-300',
  }

  const detailItems = [
    { label: 'Original file', value: doc.originalFilename, icon: FileText },
    { label: 'File size', value: formatBytes(Number(doc.fileSize)), icon: Download },
    { label: 'MIME type', value: doc.mimeType, icon: ShieldCheck },
    { label: 'Pages', value: doc.pageCount || '-', icon: Eye },
    { label: 'Uploaded', value: formatDate(doc.createdAt), icon: CalendarClock },
    { label: 'Checksum', value: doc.checksum ? `${doc.checksum.slice(0, 18)}...` : '-', icon: Fingerprint },
  ]

  return (
    <PageShell className="max-w-6xl">
      <DocumentStatusWatcher
        documentId={doc.id}
        active={doc.status === 'PENDING' || doc.status === 'PROCESSING'}
      />
      <div className="mb-5">
        <Link href="/documents" className="inline-flex items-center gap-2 text-sm font-medium text-slate-500 transition-colors hover:text-teal-300 focus-ring">
          <ArrowLeft className="h-4 w-4" />
          Back to documents
        </Link>
      </div>

      <PageHeader
        eyebrow="Document Control"
        title={doc.title}
        description={doc.description || 'Review document metadata, rendered preview readiness and active sharing policy.'}
        action={<StatusBadge className={statusStyle[doc.status] ?? 'bg-slate-800 text-slate-400'}>{doc.status}</StatusBadge>}
      />

      <div className="grid gap-6 lg:grid-cols-[1fr_340px]">
        <div className="space-y-6">
          <Surface className="overflow-hidden">
            <div className="border-b border-slate-800/80 p-5">
              <h2 className="font-semibold text-white">Document details</h2>
              <p className="mt-1 text-sm text-slate-500">Technical and audit-relevant properties for this protected file.</p>
            </div>
            <dl className="grid gap-px bg-slate-800/60 sm:grid-cols-2">
              {detailItems.map(({ label, value, icon: Icon }) => (
                <div key={label} className="bg-slate-900/80 p-5">
                  <dt className="flex items-center gap-2 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">
                    <Icon className="h-4 w-4 text-slate-400" />
                    {label}
                  </dt>
                  <dd className="mt-2 truncate font-mono text-sm text-slate-200">{value}</dd>
                </div>
              ))}
            </dl>
            {doc.tags.length > 0 && (
              <div className="border-t border-slate-800/80 p-5">
                <p className="mb-3 text-xs font-medium uppercase tracking-[0.14em] text-slate-500">Tags</p>
                <div className="flex flex-wrap gap-2">
                  {doc.tags.map((tag: string) => (
                    <span key={tag} className="rounded-full bg-slate-800 px-2.5 py-1 text-xs text-slate-300 ring-1 ring-slate-700">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            )}
          </Surface>

          {doc.pages.length > 0 && (
            <Surface className="p-5">
              <div className="mb-4 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="font-semibold text-white">Secure previews</h2>
                  <p className="mt-1 text-sm text-slate-500">{renderedPages} of {doc.pages.length} pages rendered for image-only viewing.</p>
                </div>
                <StatusBadge className={renderPercent === 100 ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300'}>
                  {renderPercent}%
                </StatusBadge>
              </div>
              <div className="mb-4 h-2.5 overflow-hidden rounded-full bg-slate-800">
                <div className="h-full rounded-full bg-teal-400 transition-all" style={{ width: `${renderPercent}%` }} />
              </div>
              <div className="grid grid-cols-8 gap-2 sm:grid-cols-12 md:grid-cols-16">
                {doc.pages.map((p: typeof doc.pages[number]) => (
                  <span
                    key={p.pageNumber}
                    className={`flex aspect-square min-h-8 items-center justify-center rounded-lg text-xs font-medium ring-1 ${
                      p.isRendered ? 'bg-emerald-400/10 text-emerald-300 ring-emerald-400/15' : 'bg-slate-800 text-slate-500 ring-slate-700'
                    }`}
                    title={p.isRendered ? 'Rendered' : 'Pending'}
                  >
                    {p.pageNumber}
                  </span>
                ))}
              </div>
            </Surface>
          )}

          <Surface className="overflow-hidden">
            <div className="flex items-center justify-between border-b border-slate-800/80 p-5">
              <div>
                <h2 className="font-semibold text-white">Active shares</h2>
                <p className="mt-1 text-sm text-slate-500">Recipients currently able to access this document.</p>
              </div>
              <StatusBadge className="bg-slate-800 text-slate-300">{totalShares}</StatusBadge>
            </div>
            {totalShares === 0 ? (
              <div className="p-5">
                <EmptyState icon={Share2} title="No active shares" description="Generate a secure link to give a recipient controlled access to this document." />
              </div>
            ) : (
              <div className="divide-y divide-slate-800/80">
                {shares.map((share: typeof shares[number]) => (
                  <div key={share.id} className="flex flex-col gap-3 px-5 py-4 transition-colors hover:bg-slate-800/30 sm:flex-row sm:items-center sm:justify-between">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-100">{share.recipientName || share.recipientEmail || 'Anyone with link'}</p>
                      <p className="mt-0.5 truncate text-xs text-slate-500">
                        {share.recipientEmail ?? 'Open link'} · {share.currentViews}{share.maxViews ? `/${share.maxViews}` : ''} views
                        {share.expiresAt ? ` · expires ${formatDate(share.expiresAt)}` : ''}
                      </p>
                    </div>
                    <div className="flex flex-wrap items-center gap-2 text-xs sm:flex-shrink-0">
                      {share.showWatermark && <StatusBadge className="bg-teal-400/10 text-teal-300">Watermark</StatusBadge>}
                      {share.requiresOtp && <StatusBadge className="bg-amber-400/10 text-amber-300">OTP</StatusBadge>}
                      {share.allowDownload && <StatusBadge className="bg-indigo-400/10 text-indigo-300">Download</StatusBadge>}
                    </div>
                  </div>
                ))}
              </div>
            )}
            <Pagination
              page={sharesPage}
              pageCount={sharesPageCount}
              totalItems={totalShares}
              pageSize={SHARES_PAGE_SIZE}
              basePath={`/documents/${id}`}
              pageParam="sharesPage"
            />
          </Surface>
        </div>

        <aside className="space-y-6">
          <Surface className="p-5">
            <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-xl bg-teal-400/10 text-teal-300 ring-1 ring-teal-400/20">
              <LockKeyhole className="h-6 w-6" />
            </div>
            <h2 className="font-semibold text-white">Access actions</h2>
            <p className="mt-2 text-sm leading-6 text-slate-500">Create a secure recipient link with expiry, OTP, view limits and watermark controls.</p>
            <Link
              href={`/documents/${id}/share`}
              className="mt-5 inline-flex min-h-10 w-full items-center justify-center gap-2 rounded-lg bg-teal-500 px-4 text-sm font-medium text-slate-950 transition-colors hover:bg-teal-400 focus-ring"
            >
              <Share2 className="h-4 w-4" />
              Share Document
            </Link>
          </Surface>

          <Surface className="p-5">
            <h2 className="font-semibold text-white">Readiness</h2>
            <div className="mt-4 space-y-3 text-sm">
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2">
                <span className="text-slate-500">Document status</span>
                <StatusBadge className={statusStyle[doc.status] ?? 'bg-slate-800 text-slate-400'}>{doc.status}</StatusBadge>
              </div>
              <div className="flex items-center justify-between gap-3 rounded-lg border border-slate-800 bg-slate-950/30 px-3 py-2">
                <span className="text-slate-500">Preview pages</span>
                <span className="text-slate-300">{renderedPages}/{doc.pages.length || doc.pageCount || 0}</span>
              </div>
              {doc.status === 'READY' && (
                <div className="flex items-center gap-2 rounded-lg border border-emerald-400/15 bg-emerald-400/5 px-3 py-2 text-emerald-300">
                  <CheckCircle2 className="h-4 w-4" />
                  Ready to share
                </div>
              )}
              {(doc.status === 'PENDING' || doc.status === 'PROCESSING') && (
                <p className="rounded-lg border border-amber-400/15 bg-amber-400/5 px-3 py-2 text-sm text-amber-300">Processing previews. Refresh in a moment.</p>
              )}
              {doc.status === 'FAILED' && (
                <p className="rounded-lg border border-red-400/15 bg-red-400/5 px-3 py-2 text-sm text-red-300">Rendering failed.</p>
              )}
            </div>
          </Surface>
        </aside>
      </div>
    </PageShell>
  )
}
