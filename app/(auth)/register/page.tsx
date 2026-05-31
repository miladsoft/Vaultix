'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { motion } from 'framer-motion'
import { ShieldCheck, UserPlus } from 'lucide-react'
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

export default function RegisterPage() {
  const router = useRouter()
  const [form, setForm] = useState({ name: '', email: '', password: '' })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  async function handleRegister(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    try {
      const res = await fetch('/api/auth/register', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      })
      if (res.ok) {
        router.push('/login')
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
    <div className="grid min-h-dvh app-bg lg:grid-cols-[0.95fr_1.05fr]">
      <section className="flex min-h-dvh items-center justify-center p-4 sm:p-8">
        <motion.div
          className="w-full max-w-md"
          initial={{ opacity: 0, y: 18, scale: 0.98 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          transition={{ duration: 0.45, ease: 'easeOut' }}
        >
          <div className="mb-8 text-center">
            <div className="mb-3 inline-flex items-center gap-2">
              <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-teal-400 text-slate-950">
                <ShieldCheck className="h-5 w-5" />
              </div>
              <span className="text-xl font-semibold text-white">SBC Files</span>
            </div>
            <p className="text-sm text-slate-400">Secure workspace</p>
          </div>

          <div className="surface rounded-2xl p-5 backdrop-blur transition-all duration-300 hover:border-teal-400/30 sm:p-8">
            <div className="mb-6">
              <div className="mb-4 flex h-11 w-11 items-center justify-center rounded-xl bg-teal-400/10 text-teal-300 ring-1 ring-teal-400/20">
                <UserPlus className="h-5 w-5" />
              </div>
              <h1 className="text-xl font-semibold text-white">Create account</h1>
              <p className="mt-1 text-sm text-slate-500">Get started.</p>
            </div>
            <form onSubmit={handleRegister} className="space-y-4">
              <Input
                label="Name"
                type="text"
                placeholder="Your name"
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                required
                autoComplete="name"
              />
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
                autoComplete="new-password"
              />
              {error && (
                <p className="rounded-lg border border-red-900/50 bg-red-950/40 px-3 py-2 text-sm text-red-300">{error}</p>
              )}
              <Button type="submit" loading={loading} className="w-full">
                Continue
              </Button>
            </form>
            <p className="mt-6 text-center text-sm text-slate-500">
              Already registered?{' '}
              <Link href="/login" className="font-medium text-teal-300 hover:text-teal-200">Sign in</Link>
            </p>
          </div>
        </motion.div>
      </section>

      <section className="relative hidden min-h-dvh overflow-hidden border-l border-slate-800/70 p-8 lg:block">
        <motion.div
          className="absolute inset-y-12 left-1/2 w-px bg-gradient-to-b from-transparent via-teal-300/30 to-transparent"
          animate={{ opacity: [0.2, 0.75, 0.2], x: [-140, 140, -140] }}
          transition={{ duration: 9, repeat: Infinity, ease: 'easeInOut' }}
        />
        <div className="relative z-10 flex min-h-[calc(100dvh-4rem)] flex-col justify-between">
          <motion.div
            className="ml-auto grid w-52 grid-cols-2 gap-3 text-sm"
            initial={{ opacity: 0, y: -12 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.45 }}
          >
            {['OTP', 'Audit', 'Links', 'DRM'].map((item, index) => (
              <motion.div
                key={item}
                className="rounded-lg border border-slate-800 bg-slate-900/55 p-4 text-center text-slate-300"
                initial={{ opacity: 0, scale: 0.94 }}
                animate={{ opacity: 1, scale: 1 }}
                transition={{ duration: 0.35, delay: index * 0.07 }}
              >
                {item}
              </motion.div>
            ))}
          </motion.div>
          <motion.div
            className="max-w-xl"
            initial={{ opacity: 0, y: 18 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.55, delay: 0.1 }}
          >
            <p className="mb-4 text-xs font-semibold uppercase text-teal-300">Protected Sharing</p>
            <h2 className="text-5xl font-semibold text-white">Start secure.</h2>
            <p className="mt-5 text-base leading-7 text-slate-400">Create your workspace and share confidential files with control.</p>
          </motion.div>
          <motion.p
            className="text-xs text-slate-600"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ duration: 0.45, delay: 0.45 }}
          >
            Private documents stay private.
          </motion.p>
        </div>
      </section>
    </div>
  )
}
