import { showFloodWarning } from './antiFlood'

const SIMULTANEOUS_LIMIT = 6
const LOOP_LIMIT = 10
const LOOP_WINDOW_MS = 5_000

const activeByType = new Map<string, number>()
const timestampsByEndpoint = new Map<string, number[]>()
let reloadScheduled = false

function isProduction() {
  return import.meta.env.PROD
}

function normalizeUrl(input: RequestInfo | URL) {
  const raw = typeof input === 'string'
    ? input
    : input instanceof URL
      ? input.toString()
      : input.url

  try {
    const url = new URL(raw, window.location.origin)
    return `${url.origin}${url.pathname}`
  } catch {
    return raw.split('?')[0]
  }
}

function inferRequestType(input: RequestInfo | URL, init?: RequestInit) {
  const method = init?.method?.toUpperCase() ?? 'GET'
  const endpoint = normalizeUrl(input).toLowerCase()

  if (endpoint.includes('refresh') || endpoint.includes('version')) return 'refresh'
  if (method !== 'GET') return 'submit'
  if (endpoint.includes('search') || endpoint.includes('buscar')) return 'search'
  return 'load'
}

function scheduleLoopRecovery() {
  if (reloadScheduled || typeof window === 'undefined') return
  reloadScheduled = true
  showFloodWarning(3, 'Detectamos uma instabilidade. A página será recarregada automaticamente em 5 segundos.')
  window.setTimeout(() => window.location.reload(), 5_000)
}

export function startWatchedRequest(type: string) {
  const current = activeByType.get(type) ?? 0
  const next = current + 1
  activeByType.set(type, next)

  if (next > SIMULTANEOUS_LIMIT) {
    const message = `[WATCHDOG] Possível loop detectado: ${type} tem ${next} instâncias simultâneas`
    console.warn(message)

    if (isProduction()) {
      activeByType.set(type, current)
      return false
    }

    console.error(new Error(message))
  }

  return true
}

export function finishWatchedRequest(type: string) {
  const current = activeByType.get(type) ?? 0
  if (current <= 1) {
    activeByType.delete(type)
    return
  }
  activeByType.set(type, current - 1)
}

export function registerEndpointHit(endpoint: string) {
  const now = Date.now()
  const previous = timestampsByEndpoint.get(endpoint) ?? []
  const next = [...previous.filter((timestamp) => now - timestamp <= LOOP_WINDOW_MS), now]
  timestampsByEndpoint.set(endpoint, next)

  if (next.length > LOOP_LIMIT) {
    console.warn(`[LOOP-DETECTED] Endpoint ${endpoint} chamado ${next.length}x em ${LOOP_WINDOW_MS}ms — possível loop`)
    scheduleLoopRecovery()
    return false
  }

  return true
}

export async function watchdogFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  type = inferRequestType(input, init)
) {
  const endpoint = normalizeUrl(input)

  if (!registerEndpointHit(endpoint) || !startWatchedRequest(type)) {
    throw new DOMException('Request cancelled by loop watchdog', 'AbortError')
  }

  try {
    return await fetch(input, init)
  } finally {
    finishWatchedRequest(type)
  }
}
