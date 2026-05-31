import { cookies } from 'next/headers'
import { verifyAccessToken } from './jwt'
import type { JwtPayload } from '@/types'

const ACCESS_COOKIE = 'sbcfiles_access'
const REFRESH_COOKIE = 'sbcfiles_refresh'

export async function getSession(): Promise<JwtPayload | null> {
  const store = await cookies()
  const token = store.get(ACCESS_COOKIE)?.value
  if (!token) return null
  try {
    return verifyAccessToken(token)
  } catch {
    return null
  }
}

export async function requireSession(): Promise<JwtPayload> {
  const session = await getSession()
  if (!session) throw new Error('Unauthorized')
  return session
}

export function cookieOptions(maxAge: number) {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? ''
  const isLocalHttp = appUrl.startsWith('http://localhost') || appUrl.startsWith('http://127.0.0.1')

  return {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production' && !isLocalHttp,
    sameSite: 'lax' as const,
    path: '/',
    maxAge,
  }
}

export { ACCESS_COOKIE, REFRESH_COOKIE }
