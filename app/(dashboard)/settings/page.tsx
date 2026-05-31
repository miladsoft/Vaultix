import { Database, ShieldCheck, UserRound } from 'lucide-react'
import { getSession } from '@/lib/auth/session'
import { prisma } from '@/lib/db/client'
import { formatBytes } from '@/lib/utils'
import { PageHeader, PageShell, StatusBadge, Surface } from '@/components/ui/surface'

export const metadata = { title: 'Settings | SBC Files' }

export default async function SettingsPage() {
  const session = await getSession()
  if (!session) return null

  const user = await prisma.user.findUnique({
    where: { id: session.sub },
    select: { name: true, email: true, role: true, storageUsed: true, storageLimit: true, createdAt: true, emailVerified: true },
  })

  if (!user) return null

  const storagePercent = Math.min(100, Math.round((Number(user.storageUsed) / Number(user.storageLimit)) * 100))

  return (
    <PageShell className="max-w-4xl">
      <PageHeader eyebrow="Workspace" title="Settings" description="Review account identity, role and storage usage for your secure workspace." />

      <div className="grid gap-6 lg:grid-cols-[1fr_0.85fr]">
        <Surface className="p-5 sm:p-6">
          <div className="mb-5 flex items-center gap-2">
            <UserRound className="h-5 w-5 text-teal-300" />
            <h2 className="font-semibold text-white">Profile</h2>
          </div>
          <dl className="space-y-4 text-sm">
            <div className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-950/30 p-3 sm:flex-row sm:justify-between">
              <dt className="text-slate-500">Name</dt>
              <dd className="break-words font-medium text-slate-200 sm:text-right">{user.name}</dd>
            </div>
            <div className="flex flex-col gap-1 rounded-lg border border-slate-800 bg-slate-950/30 p-3 sm:flex-row sm:justify-between">
              <dt className="text-slate-500">Email</dt>
              <dd className="break-all font-medium text-slate-200 sm:text-right">{user.email}</dd>
            </div>
            <div className="flex items-start justify-between gap-4 rounded-lg border border-slate-800 bg-slate-950/30 p-3">
              <dt className="text-slate-500">Role</dt>
              <dd>
                <StatusBadge className={user.role === 'ADMIN' ? 'bg-teal-400/10 text-teal-300' : 'bg-slate-800 text-slate-300'}>{user.role}</StatusBadge>
              </dd>
            </div>
          </dl>
        </Surface>

        <div className="space-y-6">
          <Surface className="p-5 sm:p-6">
            <div className="mb-5 flex items-center gap-2">
              <Database className="h-5 w-5 text-amber-300" />
              <h2 className="font-semibold text-white">Storage</h2>
            </div>
            <div className="mb-3 flex flex-col gap-1 text-sm sm:flex-row sm:justify-between">
              <span className="text-slate-500">Used</span>
              <span className="text-slate-300 sm:text-right">{formatBytes(Number(user.storageUsed))} / {formatBytes(Number(user.storageLimit))}</span>
            </div>
            <div className="h-2.5 overflow-hidden rounded-full bg-slate-800">
              <div
                className={`h-full rounded-full transition-all ${storagePercent > 90 ? 'bg-red-400' : storagePercent > 70 ? 'bg-amber-400' : 'bg-teal-400'}`}
                style={{ width: `${storagePercent}%` }}
              />
            </div>
            <p className="mt-2 text-xs text-slate-600">{storagePercent}% used</p>
          </Surface>

          <Surface className="p-5 sm:p-6">
            <div className="mb-4 flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-emerald-300" />
              <h2 className="font-semibold text-white">Security status</h2>
            </div>
            <div className="flex items-center justify-between rounded-lg border border-slate-800 bg-slate-950/30 p-3 text-sm">
              <span className="text-slate-500">Email verification</span>
              <StatusBadge className={user.emailVerified ? 'bg-emerald-400/10 text-emerald-300' : 'bg-amber-400/10 text-amber-300'}>
                {user.emailVerified ? 'Verified' : 'Pending'}
              </StatusBadge>
            </div>
          </Surface>
        </div>
      </div>
    </PageShell>
  )
}
