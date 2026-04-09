/**
 * Translates raw/technical error messages into user-friendly Portuguese messages.
 * Used across admin pages and data fetching to ensure the end user never sees
 * cryptic system details.
 */

const ERROR_MAP: Array<{ test: (msg: string) => boolean; friendly: string }> = [
  {
    test: (m) => /failed to fetch|networkerror|load failed|err_connection/i.test(m),
    friendly: 'Não foi possível conectar ao servidor. Verifique sua conexão e tente novamente.',
  },
  {
    test: (m) => /timeout|aborted|timed out/i.test(m),
    friendly: 'A requisição demorou demais. Tente novamente em alguns instantes.',
  },
  {
    test: (m) => /unauthorized|jwt expired|jwt.+invalid|session.+invalid/i.test(m),
    friendly: 'Sua sessão expirou ou é inválida. Faça login novamente.',
  },
  {
    test: (m) => /forbidden|user disabled|sem permissão/i.test(m),
    friendly: 'Você não tem permissão para realizar esta ação.',
  },
  {
    test: (m) => /not found|404/i.test(m),
    friendly: 'O recurso solicitado não foi encontrado.',
  },
  {
    test: (m) => /ixc.+not configured|409/i.test(m),
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
    test: (m) => /500|internal server/i.test(m),
    friendly: 'Ocorreu um erro interno no servidor. Tente novamente em alguns instantes.',
  },
]

/**
 * Converts a raw error (from Supabase, backend, or network) into a
 * user-friendly message in Portuguese.
 */
export function friendlyError(error: unknown): string {
  if (!error) return 'Ocorreu um erro inesperado. Tente novamente.'

  const raw = error instanceof Error ? error.message : String(error)
  if (!raw.trim()) return 'Ocorreu um erro inesperado. Tente novamente.'

  for (const { test, friendly } of ERROR_MAP) {
    if (test(raw)) return friendly
  }

  // If it looks like it's already in Portuguese and short, keep it
  if (/^[A-ZÁÉÍÓÚÃÕÂÊÎÔÛÇ]/.test(raw) && raw.length < 200 && !/\b(select|insert|update|delete|from|where|column|table|schema|null|undefined)\b/i.test(raw)) {
    return raw
  }

  return 'Ocorreu um erro inesperado. Tente novamente.'
}
