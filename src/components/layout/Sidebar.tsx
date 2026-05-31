'use client'

import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import {
  Activity,
  FileText,
  Gauge,
  LogOut,
  Search,
  Settings,
  Share2,
  Shield,
  Sparkles,
  Upload,
} from 'lucide-react'
import { cn } from '@/lib/utils'

const nav = [
  { href: '/dashboard', label: 'Dashboard', icon: Gauge },
  { href: '/upload', label: 'Upload', icon: Upload },
  { href: '/documents', label: 'Documents', icon: FileText },
  { href: '/shares', label: 'Shares', icon: Share2 },
  { href: '/activity', label: 'Activity', icon: Activity },
  { href: '/settings', label: 'Settings', icon: Settings },
]

export function Sidebar() {
  const pathname = usePathname()
  const router = useRouter()

  async function signOut() {
    await fetch('/api/auth/logout', { method: 'POST' }).catch(() => {})
    router.replace('/login')
    router.refresh()
  }

  const isActive = (href: string) =>
    pathname.startsWith(href) && href !== '/dashboard'
      ? true
      : pathname === href && href === '/dashboard'

  return (
    <>
      <header className="fixed inset-x-0 top-0 z-40 flex h-16 items-center justify-between border-b border-slate-800/80 bg-slate-950/85 px-4 backdrop-blur-xl md:hidden">
        <Link href="/dashboard" className="flex items-center gap-2">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-400 text-slate-950 shadow-lg shadow-teal-950/30">
            <Shield className="h-5 w-5" />
          </div>
          <div>
            <span className="block font-semibold leading-none text-white">SBC Files</span>
            <span className="text-[11px] text-slate-500">Secure data room</span>
          </div>
        </Link>
        <button
          type="button"
          onClick={signOut}
          className="flex h-9 w-9 items-center justify-center rounded-lg text-slate-400 transition-colors hover:bg-red-950/40 hover:text-red-400 focus-ring"
          aria-label="Sign out"
        >
          <LogOut className="h-4 w-4" />
        </button>
      </header>

      <aside className="hidden h-full w-72 flex-shrink-0 flex-col border-r border-slate-800/80 bg-slate-950/70 backdrop-blur-xl md:flex">
        <div className="border-b border-slate-800/80 p-5">
          <Link href="/dashboard" className="flex items-center gap-2">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-teal-400 text-slate-950 shadow-lg shadow-teal-950/30">
              <Shield className="h-5 w-5" />
            </div>
            <div>
              <span className="block text-lg font-semibold leading-none text-white">SBC Files</span>
              <span className="text-xs text-slate-500">Enterprise document DRM</span>
            </div>
          </Link>
        </div>

        <div className="mx-4 mt-4 flex min-h-10 items-center gap-2 rounded-lg border border-slate-800 bg-slate-900/70 px-3 text-sm text-slate-500">
          <Search className="h-4 w-4" />
          <span>Search documents</span>
        </div>

        <nav className="flex-1 space-y-1 p-4">
          {nav.map(({ href, label, icon: Icon }) => (
            <Link
              key={href}
              href={href}
              className={cn(
                'flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors focus-ring',
                isActive(href)
                  ? 'bg-teal-400/10 text-teal-200 ring-1 ring-teal-400/20'
                  : 'text-slate-400 hover:bg-slate-900 hover:text-slate-100',
              )}
            >
              <Icon className="h-4 w-4" />
              {label}
            </Link>
          ))}
        </nav>

        <div className="m-4 rounded-xl border border-teal-400/15 bg-teal-400/5 p-4">
          <div className="mb-2 flex items-center gap-2 text-sm font-medium text-teal-200">
            <Sparkles className="h-4 w-4" />
            Protected workspace
          </div>
          <p className="text-xs leading-5 text-slate-500">Watermarked previews, revocable links, OTP gates and audit trails are active.</p>
        </div>

        <div className="border-t border-slate-800/80 p-4">
          <button
            type="button"
            onClick={signOut}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm text-slate-400 transition-colors hover:bg-red-950/30 hover:text-red-400 focus-ring"
          >
            <LogOut className="h-4 w-4" />
            Sign out
          </button>
        </div>
      </aside>

      <nav className="fixed inset-x-0 bottom-0 z-40 grid grid-cols-5 border-t border-slate-800/80 bg-slate-950/85 px-1 pb-[calc(env(safe-area-inset-bottom)+4px)] pt-1 backdrop-blur-xl md:hidden">
        {nav.slice(0, 5).map(({ href, label, icon: Icon }) => (
          <Link
            key={href}
            href={href}
            className={cn(
              'flex min-h-12 flex-col items-center justify-center gap-1 rounded-lg text-[11px] transition-colors focus-ring',
              isActive(href) ? 'bg-teal-400/10 text-teal-200' : 'text-slate-500 hover:text-slate-200',
            )}
          >
            <Icon className="h-4 w-4" />
            <span className="leading-none">{label}</span>
          </Link>
        ))}
      </nav>
    </>
  )
}
