import { Activity, CircleDot } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { formatDate } from '@/lib/utils'
import { clampPage, getPage, getPageCount, Pagination } from '@/components/ui/pagination'
import { EmptyState, PageHeader, PageShell, Surface } from '@/components/ui/surface'

export const metadata = { title: 'Activity Log | SBC Files' }

const ACTION_LABELS: Record<string, { label: string; color: string }> = {
  DOCUMENT_VIEWED: { label: 'Viewed', color: 'text-blue-300' },
  DOCUMENT_DOWNLOADED: { label: 'Downloaded', color: 'text-indigo-300' },
  DOCUMENT_PRINTED: { label: 'Printed', color: 'text-violet-300' },
  PAGE_VIEWED: { label: 'Page viewed', color: 'text-slate-300' },
  SHARE_CREATED: { label: 'Share created', color: 'text-emerald-300' },
  SHARE_REVOKED: { label: 'Share revoked', color: 'text-red-300' },
  ACCESS_GRANTED: { label: 'Access granted', color: 'text-emerald-300' },
  ACCESS_DENIED: { label: 'Access denied', color: 'text-red-300' },
  OTP_VERIFIED: { label: 'OTP verified', color: 'text-emerald-300' },
  OTP_FAILED: { label: 'OTP failed', color: 'text-red-300' },
  UPLOAD_COMPLETED: { label: 'Uploaded', color: 'text-teal-300' },
  DOCUMENT_DELETED: { label: 'Deleted', color: 'text-red-300' },
  SESSION_STARTED: { label: 'Signed in', color: 'text-emerald-300' },
  SESSION_ENDED: { label: 'Signed out', color: 'text-slate-300' },
}

const PAGE_SIZE = 20

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function ActivityPage({ searchParams }: Props) {
  const session = await getSession()
  if (!session) return null

  const { page: pageParam } = await searchParams
  const where = { userId: session.sub }
  const totalLogs = await prisma.auditLog.count({ where })
  const pageCount = getPageCount(totalLogs, PAGE_SIZE)
  const page = clampPage(getPage(pageParam), pageCount)

  const logs = await prisma.auditLog.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      document: { select: { title: true } },
      share: { select: { recipientEmail: true } },
    },
  })

  return (
    <PageShell>
      <PageHeader
        eyebrow="Audit Trail"
        title="Activity Log"
        description={`A chronological record of ${totalLogs} document view${totalLogs !== 1 ? 's' : ''}, access decisions, OTP events and recipient activity.`}
      />

      {logs.length === 0 ? (
        <EmptyState icon={Activity} title="No activity yet" description="Document and access events will appear here as recipients interact with your shares." />
      ) : (
        <Surface className="overflow-hidden">
          <div className="divide-y divide-slate-800/80">
            {logs.map((log: typeof logs[number]) => {
              const meta = ACTION_LABELS[log.action]
              return (
                <div key={log.id} className="grid gap-3 px-5 py-4 transition-colors hover:bg-slate-800/30 sm:grid-cols-[auto_1fr_auto] sm:items-center sm:gap-4">
                  <div className="hidden h-9 w-9 items-center justify-center rounded-lg bg-slate-800 text-slate-400 ring-1 ring-slate-700 sm:flex">
                    <CircleDot className="h-4 w-4" />
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className={`text-sm font-semibold ${meta?.color ?? 'text-slate-300'}`}>{meta?.label ?? log.action}</span>
                      {log.document?.title && <span className="truncate text-sm text-slate-400">- {log.document.title}</span>}
                      {log.pageNumber && <span className="rounded bg-slate-800 px-1.5 py-0.5 text-xs text-slate-500">p.{log.pageNumber}</span>}
                    </div>
                    <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1 text-xs text-slate-600">
                      <span className="break-all">{log.ipAddress}</span>
                      {log.share?.recipientEmail && <span className="break-all">{log.share.recipientEmail}</span>}
                    </div>
                  </div>
                  <span className="text-xs text-slate-600 sm:text-right">{formatDate(log.createdAt)}</span>
                </div>
              )
            })}
          </div>
          <Pagination page={page} pageCount={pageCount} totalItems={totalLogs} pageSize={PAGE_SIZE} basePath="/activity" />
        </Surface>
      )}
    </PageShell>
  )
}
