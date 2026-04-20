type AnyFunction<TArgs extends unknown[]> = (...args: TArgs) => void

type ButtonGuardOptions = {
  userId?: string | null
  softMessage?: string
  calmMessage?: string
  blockMessage?: string
}

type ButtonGuardState = {
  attempts: number[]
  blockedUntil: number
  inFlight: boolean
}

const DEFAULT_SOFT_MESSAGE = 'Já estamos processando sua solicitação, aguarde um momento.'
const DEFAULT_CALM_MESSAGE = 'Calma! Já estamos atualizando, em instantes estará pronto.'
const DEFAULT_BLOCK_MESSAGE = 'Muitas tentativas detectadas. Aguarde 10 segundos antes de tentar novamente.'
const guardState = new Map<string, ButtonGuardState>()

function getGuardState(buttonId: string): ButtonGuardState {
  const current = guardState.get(buttonId)
  if (current) return current
  const next = { attempts: [], blockedUntil: 0, inFlight: false }
  guardState.set(buttonId, next)
  return next
}

/**
 * Executes a function immediately, then ignores repeated calls until delay ends.
 */
export function throttle<TArgs extends unknown[]>(fn: AnyFunction<TArgs>, delay: number): AnyFunction<TArgs> {
  let lastRun = 0

  return (...args: TArgs) => {
    const now = Date.now()
    if (now - lastRun < delay) return
    lastRun = now
    fn(...args)
  }
}

/**
 * Delays execution until calls stop for the configured delay.
 */
export function debounce<TArgs extends unknown[]>(fn: AnyFunction<TArgs>, delay: number): AnyFunction<TArgs> {
  let timer: ReturnType<typeof setTimeout> | null = null

  return (...args: TArgs) => {
    if (timer) clearTimeout(timer)
    timer = setTimeout(() => fn(...args), delay)
  }
}

/**
 * Shows a friendly non-intrusive anti-flood warning.
 */
export function showFloodWarning(level: 1 | 2 | 3, message: string): void {
  if (typeof document === 'undefined') return

  const containerId = 'anti-flood-toast-container'
  let container = document.getElementById(containerId)
  if (!container) {
    container = document.createElement('div')
    container.id = containerId
    container.setAttribute('aria-live', 'polite')
    container.style.position = 'fixed'
    container.style.right = '16px'
    container.style.bottom = '16px'
    container.style.zIndex = '9999'
    container.style.display = 'grid'
    container.style.gap = '8px'
    document.body.appendChild(container)
  }

  const toast = document.createElement('div')
  toast.textContent = message
  toast.style.maxWidth = '360px'
  toast.style.borderRadius = '14px'
  toast.style.padding = '12px 14px'
  toast.style.boxShadow = '0 16px 48px rgba(0,0,0,0.28)'
  toast.style.fontSize = '13px'
  toast.style.lineHeight = '1.45'
  toast.style.color = level === 3 ? '#fff7ed' : '#f8fafc'
  toast.style.background = level === 3
    ? 'rgba(154, 52, 18, 0.96)'
    : level === 2
      ? 'rgba(30, 64, 175, 0.96)'
      : 'rgba(15, 23, 42, 0.96)'
  toast.style.border = '1px solid rgba(255,255,255,0.12)'
  container.appendChild(toast)

  setTimeout(() => {
    toast.style.opacity = '0'
    toast.style.transition = 'opacity 180ms ease'
    setTimeout(() => toast.remove(), 220)
  }, level === 3 ? 5200 : 3200)
}

/**
 * Creates a reusable guard for a request-triggering button.
 * `canExecute()` returns false while blocked or already in-flight.
 */
export function createButtonGuard(buttonId: string, options: ButtonGuardOptions = {}) {
  const state = getGuardState(buttonId)

  const registerAttempt = () => {
    const now = Date.now()
    state.attempts = state.attempts.filter((time) => now - time <= 30_000)
    state.attempts.push(now)

    const attemptsInFiveSeconds = state.attempts.filter((time) => now - time <= 5_000).length
    if (state.attempts.length >= 10) {
      state.blockedUntil = now + 60_000
      console.warn(`[ANTI-FLOOD] Usuário ${options.userId || 'anônimo'} excedeu limite de cliques no botão ${buttonId}.`)
      showFloodWarning(3, 'Muitas tentativas detectadas. Aguarde 60 segundos antes de tentar novamente.')
      return
    }

    if (attemptsInFiveSeconds >= 5) {
      state.blockedUntil = now + 10_000
      showFloodWarning(3, options.blockMessage ?? DEFAULT_BLOCK_MESSAGE)
      return
    }

    if (attemptsInFiveSeconds >= 3) {
      showFloodWarning(2, options.calmMessage ?? DEFAULT_CALM_MESSAGE)
      return
    }

    if (state.inFlight) {
      showFloodWarning(1, options.softMessage ?? DEFAULT_SOFT_MESSAGE)
    }
  }

  return {
    canExecute() {
      const now = Date.now()
      registerAttempt()
      if (state.blockedUntil > now || state.inFlight) return false
      state.inFlight = true
      return true
    },
    registerAttempt,
    getStatus() {
      return {
        attempts: state.attempts.length,
        blockedUntil: state.blockedUntil,
        inFlight: state.inFlight,
      }
    },
    reset() {
      state.attempts = []
      state.blockedUntil = 0
      state.inFlight = false
    },
    finish() {
      state.inFlight = false
    },
  }
}
