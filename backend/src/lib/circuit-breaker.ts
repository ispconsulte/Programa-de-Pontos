import { AppError } from './app-error.js'

type CircuitState = {
  state: 'closed' | 'open' | 'half-open'
  failures: number[]
  openedAt: number
}

const circuits = new Map<string, CircuitState>()
const FAILURE_WINDOW_MS = 30_000
const OPEN_TIMEOUT_MS = 60_000
const FAILURE_THRESHOLD = 3

function getCircuit(serviceName: string) {
  const current = circuits.get(serviceName)
  if (current) return current

  const created: CircuitState = { state: 'closed', failures: [], openedAt: 0 }
  circuits.set(serviceName, created)
  return created
}

function assertCircuitCanRun(serviceName: string) {
  const circuit = getCircuit(serviceName)
  if (circuit.state !== 'open') return

  if (Date.now() - circuit.openedAt >= OPEN_TIMEOUT_MS) {
    circuit.state = 'half-open'
    return
  }

  const retryAfter = Math.ceil((OPEN_TIMEOUT_MS - (Date.now() - circuit.openedAt)) / 1000)
  throw new AppError(503, `Serviço externo temporariamente indisponível. Tente novamente em ${retryAfter}s.`)
}

export function recordCircuitBreakerFailure(serviceName: string) {
  const circuit = getCircuit(serviceName)
  const now = Date.now()
  circuit.failures = [...circuit.failures.filter(timestamp => now - timestamp <= FAILURE_WINDOW_MS), now]

  if (circuit.failures.length >= FAILURE_THRESHOLD || circuit.state === 'half-open') {
    circuit.state = 'open'
    circuit.openedAt = now
    console.warn(`[CIRCUIT-BREAKER] Serviço ${serviceName} indisponível.`)
  }
}

export function recordCircuitBreakerSuccess(serviceName: string) {
  const circuit = getCircuit(serviceName)
  circuit.state = 'closed'
  circuit.failures = []
  circuit.openedAt = 0
}

export async function runWithCircuitBreaker<T>(
  serviceName: string,
  operation: () => Promise<T>
) {
  assertCircuitCanRun(serviceName)

  try {
    return await operation()
  } catch (error) {
    recordCircuitBreakerFailure(serviceName)
    throw error
  }
}
