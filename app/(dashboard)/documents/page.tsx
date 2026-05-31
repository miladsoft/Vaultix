import Link from 'next/link'
import { FileText, Upload } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { formatBytes, formatDate } from '@/lib/utils'
import { clampPage, getPage, getPageCount, Pagination } from '@/components/ui/pagination'
import { EmptyState, PageHeader, PageShell, StatusBadge, Surface } from '@/components/ui/surface'

export const metadata = { title: 'Documents | SBC Files' }

const PAGE_SIZE = 12

interface Props {
  searchParams: Promise<{ page?: string }>
}

export default async function DocumentsPage({ searchParams }: Props) {
  const session = await getSession()
  if (!session) return null

  const { page: pageParam } = await searchParams
  const where = { userId: session.sub, deletedAt: null }
  const totalDocuments = await prisma.document.count({ where })
  const pageCount = getPageCount(totalDocuments, PAGE_SIZE)
  const page = clampPage(getPage(pageParam), pageCount)

  const documents = await prisma.document.findMany({
    where,
    orderBy: { createdAt: 'desc' },
    skip: (page - 1) * PAGE_SIZE,
    take: PAGE_SIZE,
    select: {
      id: true,
      title: true,
      originalFilename: true,
      mimeType: true,
      fileSize: true,
      pageCount: true,
      status: true,
      tags: true,
      createdAt: true,
      _count: { select: { shares: true } },
    },
  })

  const statusStyle: Record<string, string> = {
    READY: 'bg-emerald-400/10 text-emerald-300',
    PROCESSING: 'bg-amber-400/10 text-amber-300',
    PENDING: 'bg-slate-800 text-slate-400',
    FAILED: 'bg-red-400/10 text-red-300',
  }

  return (
    <PageShell>
      <PageHeader
        eyebrow="Repository"
        title="Documents"
        description={`${totalDocuments} protected document${totalDocuments !== 1 ? 's' : ''} in your secure workspace.`}
        action={
          <Link
            href="/upload"
            className="inline-flex min-h-10 items-center gap-2 rounded-lg bg-teal-500 px-4 text-sm font-medium text-slate-950 transition-colors hover:bg-teal-400 focus-ring"
          >
            <Upload className="h-4 w-4" />
            Upload
          </Link>
        }
      />

      {documents.length === 0 ? (
        <EmptyState
          icon={FileText}
          title="No documents yet"
          description="Upload confidential PDFs, Office files or images to create traceable, revocable sharing workflows."
          href="/upload"
          action="Upload document"
        />
      ) : (
        <Surface className="overflow-hidden">
          <div className="divide-y divide-slate-800/80 md:hidden">
            {documents.map((doc: typeof documents[number]) => (
              <Link key={doc.id} href={`/documents/${doc.id}`} className="block p-4 transition-colors hover:bg-slate-800/30 focus-ring">
                <div className="flex items-start gap-3">
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300 ring-1 ring-slate-700">
                    <FileText className="h-5 w-5" />
                  </div>
                  <div className="min-w-0 flex-1">
                    <p className="line-clamp-2 break-words text-sm font-semibold leading-5 text-slate-100">{doc.title}</p>
                    <p className="mt-1 break-all text-xs leading-5 text-slate-600">{doc.originalFilename}</p>
                  </div>
                  <StatusBadge className={statusStyle[doc.status] ?? 'bg-slate-800 text-slate-400'}>{doc.status}</StatusBadge>
                </div>

                <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                  <div className="rounded-lg border border-slate-800 bg-slate-950/35 p-3">
                    <p className="text-xs text-slate-600">Size</p>
                    <p className="mt-1 font-medium text-slate-300">{formatBytes(Number(doc.fileSize))}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/35 p-3">
                    <p className="text-xs text-slate-600">Pages</p>
                    <p className="mt-1 font-medium text-slate-300">{doc.pageCount || '-'}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/35 p-3">
                    <p className="text-xs text-slate-600">Shares</p>
                    <p className="mt-1 font-medium text-slate-300">{doc._count.shares}</p>
                  </div>
                  <div className="rounded-lg border border-slate-800 bg-slate-950/35 p-3">
                    <p className="text-xs text-slate-600">Uploaded</p>
                    <p className="mt-1 text-slate-300">{formatDate(doc.createdAt)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>

          <div className="hidden md:block">
            <table className="w-full min-w-[860px] text-sm">
              <thead className="bg-slate-950/35">
                <tr className="border-b border-slate-800/80">
                  <th className="px-5 py-3 text-left font-medium text-slate-400">Title</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-400">Size</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-400">Pages</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-400">Status</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-400">Shares</th>
                  <th className="px-5 py-3 text-left font-medium text-slate-400">Uploaded</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-800/80">
                {documents.map((doc: typeof documents[number]) => (
                  <tr key={doc.id} className="group transition-colors hover:bg-slate-800/35">
                    <td className="px-5 py-4">
                      <div className="flex items-center gap-3">
                        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-lg bg-slate-800 text-slate-300 ring-1 ring-slate-700">
                          <FileText className="h-5 w-5" />
                        </div>
                        <div className="min-w-0">
                          <p className="max-w-xs truncate font-medium text-slate-100">{doc.title}</p>
                          <p className="max-w-xs truncate text-xs text-slate-600">{doc.originalFilename}</p>
                        </div>
                      </div>
                    </td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-400">{formatBytes(Number(doc.fileSize))}</td>
                    <td className="px-5 py-4 text-slate-400">{doc.pageCount || '-'}</td>
                    <td className="px-5 py-4">
                      <StatusBadge className={statusStyle[doc.status] ?? 'bg-slate-800 text-slate-400'}>{doc.status}</StatusBadge>
                    </td>
                    <td className="px-5 py-4 text-slate-400">{doc._count.shares}</td>
                    <td className="whitespace-nowrap px-5 py-4 text-slate-500">{formatDate(doc.createdAt)}</td>
                    <td className="px-5 py-4 text-right">
                      <Link href={`/documents/${doc.id}`} className="text-xs font-medium text-teal-300 opacity-100 transition-opacity hover:text-teal-200 sm:opacity-0 sm:group-hover:opacity-100">
                        Open
                      </Link>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
          <Pagination page={page} pageCount={pageCount} totalItems={totalDocuments} pageSize={PAGE_SIZE} basePath="/documents" />
        </Surface>
      )}
    </PageShell>
  )
}
