function applySecurityHeaders(response: any): void {
  if (typeof response?.setHeader !== 'function') {
    return
  }

  response.setHeader('Strict-Transport-Security', 'max-age=31536000; includeSubDomains')
  response.setHeader('Content-Security-Policy', "default-src 'none'; frame-ancestors 'none'; base-uri 'none'; form-action 'none'")
  response.setHeader('X-Frame-Options', 'DENY')
  response.setHeader('X-Content-Type-Options', 'nosniff')
  response.setHeader('Referrer-Policy', 'no-referrer')
  response.setHeader('Permissions-Policy', 'accelerometer=(), camera=(), geolocation=(), gyroscope=(), magnetometer=(), microphone=(), payment=(), usb=()')
}

export function sendInternalError(response: any): void {
  applySecurityHeaders(response)
  response.status(500).json({ error: 'Internal Server Error' })
}

export function sendException(response: any, error: unknown): void {
  if (error instanceof Error) {
    if (error.message === 'Unauthorized') {
      sendJson(response, 401, { error: 'Unauthorized' })
      return
    }

    if (error.message === 'Forbidden') {
      sendJson(response, 403, { error: 'Forbidden' })
      return
    }
  }

  sendInternalError(response)
}

export function sendJson(response: any, status: number, payload: unknown): void {
  applySecurityHeaders(response)
  response.status(status).json(payload)
}

export function sendNoContent(response: any): void {
  applySecurityHeaders(response)
  response.status(204).end()
}

export function methodNotAllowed(response: any): void {
  sendJson(response, 405, { error: 'Method Not Allowed' })
}

export function parseBearerToken(request: any): string {
  const auth = String(request.headers.authorization ?? '')
  if (!auth.startsWith('Bearer ')) {
    throw new Error('Unauthorized')
  }

  const token = auth.slice('Bearer '.length).trim()
  if (!token) {
    throw new Error('Unauthorized')
  }

  return token
}
