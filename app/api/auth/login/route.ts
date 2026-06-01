import { z } from 'zod'
import bcrypt from 'bcryptjs'
import { cookies } from 'next/headers'
import { prisma } from '@/lib/db/client'
import { signAccessToken } from '@/lib/auth/jwt'
import { hashToken, generateSecureToken } from '@/lib/crypto/encryption'
import { checkApiRateLimit } from '@/lib/rate-limit/limiter'
import { logAudit, extractRequestMeta } from '@/lib/audit/logger'
import { ok, err, unauthorized, tooManyRequests } from '@/lib/api/response'
import { ACCESS_COOKIE, REFRESH_COOKIE, cookieOptions } from '@/lib/auth/session'

const LOGIN_REDIRECT_COOKIE = 'sbcfiles_login_redirect'

function sanitizeRedirect(raw: string | undefined): string {
  if (!raw || !raw.startsWith('/')) return '/dashboard'
  if (raw.startsWith('//') || raw.startsWith('/login') || raw.startsWith('/register')) return '/dashboard'
  return raw
}

const schema = z.object({
  email: z.string().email(),
  password: z.string().min(8).max(128),
})

export async function POST(req: Request): Promise<Response> {
  const { ipAddress, userAgent } = extractRequestMeta(req)

  const limit = await checkApiRateLimit(`login:${ipAddress}`)
  if (!limit.allowed) return tooManyRequests()

  const body = await req.json().catch(() => null)
  const parsed = schema.safeParse(body)
  if (!parsed.success) return err('Invalid request body')

  const { email, password } = parsed.data

  const user = await prisma.user.findUnique({
    where: { email: email.toLowerCase(), deletedAt: null },
  })

  // Constant-time check even when user not found
  const dummyHash = '$2a$12$invalidhashplaceholder00000000000000000'
  const hash = user?.passwordHash ?? dummyHash
  const valid = await bcrypt.compare(password, hash)

  if (!user || !valid || !user.isActive) {
    return unauthorized()
  }

  // Create session
  const rawRefresh = generateSecureToken()
  const hashedRefresh = hashToken(rawRefresh)
  const sessionId = generateSecureToken()
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000)

  await prisma.session.create({
    data: {
      userId: user.id,
      refreshToken: hashedRefresh,
      ipAddress,
      userAgent,
      expiresAt,
    },
  })

  const accessToken = signAccessToken({
    sub: user.id,
    email: user.email,
    role: user.role,
    sessionId,
  })
  const store = await cookies()
  const redirectTo = sanitizeRedirect(store.get(LOGIN_REDIRECT_COOKIE)?.value)
  store.set(ACCESS_COOKIE, accessToken, cookieOptions(15 * 60))
  store.set(REFRESH_COOKIE, rawRefresh, cookieOptions(7 * 24 * 60 * 60))
  store.delete(LOGIN_REDIRECT_COOKIE)

  await logAudit({
    action: 'SESSION_STARTED',
    userId: user.id,
    ipAddress,
    userAgent,
    sessionId,
  })

  return ok({ userId: user.id, name: user.name, email: user.email, role: user.role, redirectTo })
}
