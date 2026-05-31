import { Link2, Share2 } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { formatDate } from '@/lib/utils'
import { clampPage, getPage, getPageCount, Pagination } from '@/components/ui/pagination'
import { EmptyState, PageHeader, PageShell, StatusBadge, Surface } from '@/components/ui/surface'

export const metadata = { title: 'Shares | SBC Files' }

const PAGE_SIZE = 12

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function SharesPage({ searchParams }: Props) {
  const session = await getSession()
  if (!session) return null

  const { page: pageParam } = await searchParams
  const where = { document: { userId: session.sub } }
  const totalShares = await prisma.share.count({ where })
  const pageCount = getPageCount(totalShares, PAGE_SIZE)
  const page = clampPage(getPage(pageParam), pageCount)

  const shares = await prisma.share.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    include: {
      document: { select: { title: true } },
      recipients: { select: { email: true, viewCount: true } },
    },
  })

  return (
    <PageShell>
      <PageHeader
        eyebrow="Access Control"
        title="Shares"
        description={`Manage ${totalShares} secure link${totalShares !== 1 ? 's' : ''}, recipients, expiry windows and view limits across your documents.`}
      />

      {shares.length === 0 ? (
        <EmptyState icon={Share2} title="No shares yet" description="Open a document and generate a secure link with watermarking, OTP and revocation controls." />
      ) : (
        <Surface className="overflow-hidden">
          <div className="divide-y divide-slate-800/80 md:hidden">
            {shares.map((share: typeof shares[number]) => (
              <div key={share.id} className="p-4">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300 ring-1 ring-slate-700">
                    <Link2 className="h-4 w-4" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 break-words text-sm font-semibold leading-5 text-slate-100">{share.document.title}</p>
                    <p className="mt-1 break-all text-xs leading-5 text-slate-500">{share.recipientEmail ?? share.recipients[0]?.email ?? 'Anyone with link'}</p>
                  </div>
                  <StatusBadge className={share.status === 'ACTIVE' ? 'bg-emerald-400/10 text-emerald-300' : share.status === 'REVOKED' ? 'bg-red-400/10 text-red-300' : 'bg-slate-800 text-slate-400'}>
                    {share.status}
                  </StatusBadge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/35 p-3">
                    <p className="text-xs text-slate-600">Views</p>
                    <p className="mt-1 font-medium text-slate-300">{share.currentViews}{share.maxViews ? `/${share.maxViews}` : ''}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/35 p-3">
                    <p className="text-xs text-slate-600">Created</p>
                    <p className="mt-1 text-slate-300">{formatDate(share.createdAt)}</p>
                  </div>
                  <div className="col-span-2 rounded-lg border border-slate-800 bg-slate-950/35 p-3">
                    <p className="text-xs text-slate-600">Expires</p>
                    <p className="mt-1 text-slate-300">{share.expiresAt ? formatDate(share.expiresAt) : 'No expiry'}</p>
                  </div>
                </div>
              </div>
            ))}
          </div>

          <div className="hidden md:block">
            <table className="w-full min-w-[780px] text-sm">
              <thead className="bg-slate-950/35">
                <tr className="border-b border-slate-800/80">
                  <th className="px-5 py-3 text-left font-medium text-slate-400">Document</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-400">Recipient</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-400">Status</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-400">Views</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-400">Expires</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-400">Created</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {shares.map((share: typeof shares[number]) => (
                  <tr key={share.id} className="transition-colors hover:bg-slate-800/35">
                    <td className="px-5 py-4">
                      <div className="flex min-w-0 items-center gap-3">
                        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300 ring-1 ring-slate-700">
                          <Link2 className="h-4 w-4" />
                        </div>
                        <span className="max-w-xs truncate font-medium text-slate-100">{share.document.title}</span>
                      </div>
                    </td>
                    <td className="max-w-xs truncate px-5 py-4 text-slate-400">{share.recipientEmail ?? share.recipients[0]?.email ?? 'Anyone with link'}</td>
                    <td className="px-5 py-4">
                      <StatusBadge className={share.status === 'ACTIVE' ? 'bg-emerald-400/10 text-emerald-300' : share.status === 'REVOKED' ? 'bg-red-400/10 text-red-300' : 'bg-slate-800 text-slate-400'}>
                        {share.status}
                      </StatusBadge>
                    </td>
                    <td className="px-5 py-4 text-slate-400">{share.currentViews}{share.maxViews ? `/${share.maxViews}` : ''}</td>
                    <td className="px-5 py-4 text-slate-400">{share.expiresAt ? formatDate(share.expiresAt) : 'No expiry'}</td>
                    <td className="px-5 py-4 text-slate-500">{formatDate(share.createdAt)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageCount={pageCount} totalItems={totalShares} pageSize={PAGE_SIZE} basePath="/shares" />
        </Surface>
      )}
    </PageShell>
  )
}
