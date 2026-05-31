import { redirect } from 'next/navigation'
import { AlertTriangle, FileText, Share2, ShieldAlert, Users } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { formatDate } from '@/lib/utils'
import { clampPage, getPage, getPageCount, Pagination } from '@/components/ui/pagination'
import { MetricCard, PageHeader, PageShell, StatusBadge, Surface } from '@/components/ui/surface'

export const metadata = { title: 'Admin | SBC Files' }

const USERS_PAGE_SIZE = 12
const ALERTS_PAGE_SIZE = 8

interface Props {
  searchParams: Promise<{ usersPage?: string; alertsPage?: string }>
}

export default async function AdminPage({ searchParams }: Props) {
  const session = await getSession()
  if (!session || session.role !== 'ADMIN') redirect('/dashboard')

  const { usersPage: usersPageParam, alertsPage: alertsPageParam } = await searchParams
  const [totalUsers, totalAlerts, totalDocs, activeShares] = await Promise.all([
    prisma.user.count({ where: { deletedAt: null } }),
    prisma.suspiciousEvent.count({ where: { resolved: false } }),
    prisma.document.count({ where: { deletedAt: null } }),
    prisma.share.count({ where: { status: 'ACTIVE' } }),
  ])

  const usersPageCount = getPageCount(totalUsers, USERS_PAGE_SIZE)
  const usersPage = clampPage(getPage(usersPageParam), usersPageCount)
  const alertsPageCount = getPageCount(totalAlerts, ALERTS_PAGE_SIZE)
  const alertsPage = clampPage(getPage(alertsPageParam), alertsPageCount)

  const [users, suspiciousEvents] = await Promise.all([
    prisma.user.findMany({
      where: { deletedAt: null },
      orderBy: { createdAt: 'desc' },
      skip: (usersPage - 1) * USERS_PAGE_SIZE,
      take: USERS_PAGE_SIZE,
      select: { id: true, name: true, email: true, role: true, isActive: true, createdAt: true, storageUsed: true, _count: { select: { documents: true } } },
    }),
    prisma.suspiciousEvent.findMany({
      where: { resolved: false },
      orderBy: { createdAt: 'desc' },
      skip: (alertsPage - 1) * ALERTS_PAGE_SIZE,
      take: ALERTS_PAGE_SIZE,
    }),
  ])

  return (
    <PageShell>
      <PageHeader
        eyebrow="Administration"
        title="Admin Panel"
        description="Platform-wide security, user activity and operational monitoring."
      />

      <div className="mb-8 grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <MetricCard label="Total Users" value={totalUsers} helper="Registered accounts" icon={Users} tone="teal" />
        <MetricCard label="Total Documents" value={totalDocs} helper="Stored assets" icon={FileText} tone="indigo" />
        <MetricCard label="Active Shares" value={activeShares} helper="Live links" icon={Share2} tone="emerald" />
        <MetricCard label="Unresolved Alerts" value={totalAlerts} helper="Needs review" icon={ShieldAlert} tone={totalAlerts > 0 ? 'red' : 'amber'} />
      </div>

      {totalAlerts > 0 && (
        <Surface className="mb-8 border-red-900/40 bg-red-950/20 p-5">
          <div className="mb-4 flex items-center gap-2">
            <AlertTriangle className="h-5 w-5 text-red-300" />
            <h2 className="font-semibold text-red-300">Suspicious Activity Alerts</h2>
          </div>
          <div className="space-y-2">
            {suspiciousEvents.map((ev: typeof suspiciousEvents[number]) => (
              <div key={ev.id} className="grid gap-2 rounded-lg border border-red-900/20 bg-slate-950/40 px-4 py-3 text-sm sm:grid-cols-[1fr_auto] sm:items-center">
                <div className="min-w-0">
                  <p className="break-words font-medium text-red-300">{ev.type}</p>
                  <p className="mt-1 break-all text-xs text-slate-500">
                    {ev.ipAddress}{ev.email ? ` · ${ev.email}` : ''}
                  </p>
                </div>
                <span className="text-xs text-slate-600 sm:text-right">{formatDate(ev.createdAt)}</span>
              </div>
            ))}
          </div>
          <Pagination
            page={alertsPage}
            pageCount={alertsPageCount}
            totalItems={totalAlerts}
            pageSize={ALERTS_PAGE_SIZE}
            basePath="/admin"
            pageParam="alertsPage"
            preserveParams={{ usersPage: usersPage > 1 ? usersPage : undefined }}
          />
        </Surface>
      )}

      <Surface className="overflow-hidden">
        <div className="border-b border-slate-800/80 p-5">
          <h2 className="font-semibold text-white">Users</h2>
          <p className="mt-1 text-sm text-slate-500">{totalUsers} account{totalUsers !== 1 ? 's' : ''} and their document activity.</p>
        </div>

        <div className="divide-y divide-slate-800/80 md:hidden">
          {users.map((u: typeof users[number]) => (
            <div key={u.id} className="p-4">
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="break-words text-sm font-semibold text-slate-100">{u.name}</p>
                  <p className="mt-1 break-all text-xs text-slate-500">{u.email}</p>
                </div>
                <StatusBadge className={u.isActive ? 'bg-emerald-400/10 text-emerald-300' : 'bg-red-400/10 text-red-300'}>
                  {u.isActive ? 'Active' : 'Disabled'}
                </StatusBadge>
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3 text-sm">
                <div className="rounded-lg border border-slate-800 bg-slate-950/35 p-3">
                  <p className="text-xs text-slate-600">Role</p>
                  <StatusBadge className={u.role === 'ADMIN' ? 'mt-1 bg-teal-400/10 text-teal-300' : 'mt-1 bg-slate-800 text-slate-300'}>
                    {u.role}
                  </StatusBadge>
                </div>
                <div className="rounded-lg border border-slate-800 bg-slate-950/35 p-3">
                  <p className="text-xs text-slate-600">Documents</p>
                  <p className="mt-1 font-medium text-slate-300">{u._count.documents}</p>
                </div>
                <div className="col-span-2 rounded-lg border border-slate-800 bg-slate-950/35 p-3">
                  <p className="text-xs text-slate-600">Joined</p>
                  <p className="mt-1 text-slate-300">{formatDate(u.createdAt)}</p>
                </div>
              </div>
            </div>
          ))}
        </div>

        <div className="hidden md:block">
          <table className="w-full min-w-[760px] text-sm">
            <thead className="bg-slate-950/35">
              <tr className="border-b border-slate-800/80">
                <th className="px-5 py-3 text-left font-medium text-slate-400">Name</th>
                <th className="px-5 py-3 text-left font-medium text-slate-400">Email</th>
                <th className="px-5 py-3 text-left font-medium text-slate-400">Role</th>
                <th className="px-5 py-3 text-left font-medium text-slate-400">Docs</th>
                <th className="px-5 py-3 text-left font-medium text-slate-400">Status</th>
                <th className="px-5 py-3 text-left font-medium text-slate-400">Joined</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/80">
              {users.map((u: typeof users[number]) => (
                <tr key={u.id} className="transition-colors hover:bg-slate-800/30">
                  <td className="px-5 py-4 font-medium text-slate-200">{u.name}</td>
                  <td className="px-5 py-4 text-slate-400">{u.email}</td>
                  <td className="px-5 py-4">
                    <StatusBadge className={u.role === 'ADMIN' ? 'bg-teal-400/10 text-teal-300' : 'bg-slate-800 text-slate-300'}>
                      {u.role}
                    </StatusBadge>
                  </td>
                  <td className="px-5 py-4 text-slate-400">{u._count.documents}</td>
                  <td className="px-5 py-4">
                    <StatusBadge className={u.isActive ? 'bg-emerald-400/10 text-emerald-300' : 'bg-red-400/10 text-red-300'}>
                      {u.isActive ? 'Active' : 'Disabled'}
                    </StatusBadge>
                  </td>
                  <td className="px-5 py-4 text-slate-500">{formatDate(u.createdAt)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <Pagination
          page={usersPage}
          pageCount={usersPageCount}
          totalItems={totalUsers}
          pageSize={USERS_PAGE_SIZE}
          basePath="/admin"
          pageParam="usersPage"
          preserveParams={{ alertsPage: alertsPage > 1 ? alertsPage : undefined }}
        />
      </Surface>
    </PageShell>
  )
}
