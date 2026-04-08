export function sendJson(response: any, status: number, payload: unknown): void {
  response.status(status).json(payload)
}

export function sendNoContent(response: any): void {
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
