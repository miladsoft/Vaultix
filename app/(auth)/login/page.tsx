'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { LockKeyhole } from 'lucide-react'
import { AppLogo } from '@/components/layout/AppLogo'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

async function readApiError(res: Response): Promise<string> {
  const contentType = res.headers.get('content-type') ?? ''
  if (contentType.includes('application/json')) {
    const data = await res.json()
    return data.error ?? `Request failed with status ${res.status}`
  }
  return `Server error (${res.status}). Check the terminal logs.`
}

interface LoginSuccessPayload {
  success: boolean
  data?: {
    redirectTo?: string
  }
}

export default function LoginPage() {
  const router = useRouter()
  const [form, setForm] = useState({ email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/login', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        const payload = (await res.json()) as LoginSuccessPayload
        router.push(payload.data?.redirectTo || '/dashboard')
        router.refresh()
      } else {
        setError(await readApiError(res))
      }
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="grid min-h-dvh app-bg lg:grid-cols-[1.05fr_0.95fr]">
      <section className="relative hidden min-h-dvh overflow-hidden border-r border-slate-800/70 p-8 lg:block">
        <motion.div
          className="absolute inset-x-10 top-1/2 h-px bg-gradient-to-r from-transparent via-teal-300/30 to-transparent"
          animate={{ opacity: [0.2, 0.8, 0.2], y: [-120, 120, -120] }}
          transition={{ duration: 8, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative z-10 flex min-h-[calc(100dvh-4rem)] flex-col justify-between">
          <motion.div
            className="flex items-center gap-3"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            <AppLogo size="lg" />
          </motion.div>

          <motion.div
            className="max-w-xl"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
          >
            <p className="mb-4 text-xs font-semibold uppercase text-teal-300">Secure Access</p>
            <h1 className="text-5xl font-semibold text-white">Welcome back.</h1>
            <p className="mt-5 text-base leading-7 text-slate-400">Sign in to manage secure documents, links and activity.</p>
            <div className="mt-8 grid grid-cols-3 gap-3 text-sm">
              {['Preview', 'Share', 'Track'].map((item, index) => (
                <motion.div
                  key={item}
                  className="rounded-lg border border-slate-800 bg-slate-900/55 p-4 text-slate-300"
                  initial={{ opacity: 0, y: 12 }}
                  animate={{ opacity: 1, y: 0 }}
                  transition={{ duration: 0.4, delay: 0.25 + index * 0.08 }}
                >
                  {item}
                </motion.div>
              ))}
            </div>
          </motion.div>

          <motion.p
            className="text-xs text-slate-600"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.45 }}
          >
            Protected access for sensitive work.
          </motion.p>
        </div>
      </section>

      <section className="flex min-h-dvh items-center justify-center p-4 sm:p-8">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <div className="mb-8 text-center lg:hidden">
            <div className="mb-3 flex justify-center">
              <AppLogo size="sm" showSubtitle={false} titleClassName="text-xl" />
            </div>
            <p className="text-sm text-slate-400">Secure workspace</p>
          </div>

          <div className="surface rounded-2xl p-5 backdrop-blur transition-all duration-300 hover:border-teal-400/30 sm:p-8">
            <div className="mb-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-400/10 text-teal-300 ring-1 ring-teal-400/20">
                <LockKeyhole className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-semibold text-white">Sign in</h1>
              <p className="mt-1 text-sm text-slate-500">Welcome back.</p>
            </div>

            <form onSubmit={handleSubmit} className="space-y-4">
              <Input
                label="Email"
                type="email"
                placeholder="you@company.com"
                value={form.email}
                onChange={(e) => setForm({ ...form, email: e.target.value })}
                required
                autoComplete="email"
              />
              <Input
                label="Password"
                type="password"
                placeholder="••••••••"
                value={form.password}
                onChange={(e) => setForm({ ...form, password: e.target.value })}
                required
                autoComplete="current-password"
              />

              {error && (
                <p className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">
                  {error}
                </p>
              )}

              <Button type="submit" loading={loading} className="w-full">
                Continue
              </Button>
            </form>

            <p className="mt-6 text-center text-sm text-slate-500">
              New here?{' '}
              <Link href="/register" className="font-medium text-teal-300 hover:text-teal-200">
                Create account
              </Link>
            </p>
          </div>

          <p className="mt-6 text-center text-xs text-slate-600">Protected by encryption</p>
        </motion.div>
      </section>
    </div>
  )
}
