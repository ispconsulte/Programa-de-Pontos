/**
 * Translates raw/technical error messages into user-friendly Portuguese messages.
 * Used across admin pages and data fetching to ensure the end user never sees
 * cryptic system details.
 */

type ErrorAction = 'load' | 'save' | 'delete' | 'auth' | 'default'

interface FriendlyErrorOptions {
  action?: ErrorAction
  status?: number
  path?: string
}

let currentViewerIsFullAdmin = false

export function setErrorViewerIsFullAdmin(isFullAdmin: boolean): void {
  currentViewerIsFullAdmin = isFullAdmin
}

const ACTION_FALLBACKS: Record<ErrorAction, string> = {
  load: 'Não foi possível carregar os dados agora. Tente novamente em alguns instantes.',
  save: 'Não foi possível salvar. Revise os dados e tente novamente.',
  delete: 'Não foi possível excluir agora. Tente novamente em alguns instantes.',
  auth: 'Sua sessão expirou ou é inválida. Faça login novamente.',
  default: 'Ocorreu uma falha temporária. Se continuar, avise o suporte.',
}

const ERROR_MAP: Array<{ test: (msg: string, status?: number) => boolean; friendly: string }> = [
  {
    test: (m) => /failed to fetch|networkerror|load failed|err_connection/i.test(m),
    friendly: 'Não foi possível conectar ao serviço agora. Tente novamente em alguns instantes.',
  },
  {
    test: (m) => /timeout|aborted|timed out/i.test(m),
    friendly: 'A requisição demorou demais. Tente novamente em alguns instantes.',
  },
  {
    test: (m, status) => status === 401 || /unauthorized|jwt expired|jwt.+invalid|session.+invalid/i.test(m),
    friendly: 'Sua sessão expirou ou é inválida. Faça login novamente.',
  },
  {
    test: (m, status) => status === 403 || /forbidden|user disabled|sem permissão/i.test(m),
    friendly: 'Você não tem permissão para realizar esta ação.',
  },
  {
    test: (_m, status) => status === 404,
    friendly: 'O recurso solicitado não foi encontrado.',
  },
  {
    test: (m, status) => status === 409 && /ixc|config|integra/i.test(m),
    friendly: 'A integração IXC ainda não foi configurada. Acesse Administração > Empresa para configurar.',
  },
  {
    test: (m) => /violates row.level security|rls|permission denied/i.test(m),
    friendly: 'Permissão negada. Seu usuário não tem acesso a esses dados.',
  },
  {
    test: (m) => /duplicate key|unique.+constraint|already exists/i.test(m),
    friendly: 'Este registro já existe. Verifique os dados e tente novamente.',
  },
  {
    test: (_m, status) => !!status && status >= 500,
    friendly: 'Ocorreu uma falha temporária. Se continuar, avise o suporte.',
  },
]

function rawErrorMessage(error: unknown): string {
  if (!error) return ''
  return error instanceof Error ? error.message : String(error)
}

function formatTechnicalDetails(raw: string, options: FriendlyErrorOptions): string {
  const details = [
    options.status ? `status ${options.status}` : null,
    options.path ? `endpoint ${options.path}` : null,
    raw.trim() || null,
  ].filter(Boolean)

  return details.length ? details.join(' • ') : 'Detalhes técnicos indisponíveis'
}

/**
 * Converts a raw error (from Supabase, backend, or network) into a
 * user-friendly message in Portuguese.
 */
export function friendlyError(error: unknown, options: FriendlyErrorOptions = {}): string {
  const action = options.action ?? 'default'
  if (!error) return ACTION_FALLBACKS[action]

  const raw = rawErrorMessage(error)
  if (!raw.trim()) return ACTION_FALLBACKS[action]

  for (const { test, friendly } of ERROR_MAP) {
    if (test(raw, options.status)) {
      return currentViewerIsFullAdmin
        ? `${friendly} (${formatTechnicalDetails(raw, options)})`
        : friendly
    }
  }

  // If it looks like it's already in Portuguese and short, keep it
  if (/^[A-ZÁÉÍÓÚÃÕÂÊÎÔÛÇ]/.test(raw) && raw.length < 200 && !/\b(select|insert|update|delete|from|where|column|table|schema|null|undefined|backend|endpoint|\/api|\/users|\/campaign|stack)\b/i.test(raw)) {
    return raw
  }

  return currentViewerIsFullAdmin
    ? `${ACTION_FALLBACKS[action]} (${formatTechnicalDetails(raw, options)})`
    : ACTION_FALLBACKS[action]
}
