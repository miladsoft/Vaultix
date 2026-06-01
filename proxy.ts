import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

const LOGIN_REDIRECT_COOKIE = 'sbcfiles_login_redirect'

const PUBLIC_PATHS = [
  '/login',
  '/register',
  '/view/',
  '/api/auth/',
  '/api/viewer/',
  '/api/health',
]

const PUBLIC_ASSET_PATTERNS = [
  /^\/icons\//,
  /^\/\.well-known\//,
  /^\/sw\.js$/,
  /^\/manifest\.webmanifest$/,
  /^\/file\.(png|svg)$/,
  /\.(png|svg|jpg|jpeg|webp|ico|json|webmanifest|txt|xml)$/i,
]

export function proxy(request: NextRequest): NextResponse {
  const { pathname } = request.nextUrl

  // Always allow public paths
  if (PUBLIC_PATHS.some((p) => pathname.startsWith(p))) {
    return NextResponse.next()
  }

  // Static assets from /public or well-known endpoints must bypass auth.
  if (PUBLIC_ASSET_PATTERNS.some((pattern) => pattern.test(pathname))) {
    return NextResponse.next()
  }

  const accessToken = request.cookies.get('sbcfiles_access')?.value

  // Redirect unauthenticated users to login
  if (!accessToken && !pathname.startsWith('/api/')) {
    const loginUrl = request.nextUrl.clone()
    const redirectTarget = `${pathname}${request.nextUrl.search}`

    loginUrl.pathname = '/login'
    loginUrl.search = ''

    const response = NextResponse.redirect(loginUrl)
    response.cookies.set(LOGIN_REDIRECT_COOKIE, redirectTarget, {
      httpOnly: true,
      sameSite: 'lax',
      secure: process.env.NODE_ENV === 'production',
      path: '/',
      maxAge: 10 * 60,
    })
    return response
  }

  // API 401 for unauthenticated requests
  if (!accessToken && pathname.startsWith('/api/')) {
    return NextResponse.json({ success: false, error: 'Unauthorized' }, { status: 401 })
  }

  return NextResponse.next()
}

export const config = {
  matcher: [
    '/((?!_next/static|_next/image|favicon.ico).*)',
  ],
}
