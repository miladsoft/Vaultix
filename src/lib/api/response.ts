import type { ApiResponse } from '@/types'

function serializeForJson<T>(value: T): T {
  return JSON.parse(
    JSON.stringify(value, (_key, currentValue) =>
      typeof currentValue === 'bigint' ? currentValue.toString() : currentValue,
    ),
  ) as T
}

export function ok<T>(data: T, status = 200): Response {
  const body: ApiResponse<T> = { success: true, data: serializeForJson(data) }
  return Response.json(body, { status })
}

export function err(message: string, status = 400): Response {
  const body: ApiResponse = { success: false, error: message }
  return Response.json(body, { status })
}

export function unauthorized(): Response {
  return err('Unauthorized', 401)
}

export function forbidden(): Response {
  return err('Forbidden', 403)
}

export function notFound(resource = 'Resource'): Response {
  return err(`${resource} not found`, 404)
}

export function tooManyRequests(): Response {
  return err('Too many requests. Please try again later.', 429)
}

export function serverError(message = 'Internal server error'): Response {
  return err(message, 500)
}

export function withSecureHeaders(response: Response): Response {
  const headers = new Headers(response.headers)
  headers.set('X-Content-Type-Options', 'nosniff')
  headers.set('X-Frame-Options', 'DENY')
  headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')
  return new Response(response.body, {
    status: response.status,
    headers,
  })
}
