import { decrypt } from './crypto.js'
import { assertSafeUrl } from './ssrf-guard.js'
import { writeAuditLog } from './audit.js'
import { AppError } from './app-error.js'

export interface IxcListParams {
  qtype: string
  query: string
  oper: '=' | 'like' | '!=' | '>' | '<'
  page: string
  rp: string
  sortname: string
  sortorder: 'asc' | 'desc'
}

export interface IxcListResponse<T> {
  type?: string
  msg: T[]
  total: string
  page?: string
  registros?: T[]
}

export interface FnAreceberItem {
  id: string
  status: string
  filial_id: string
  id_cliente: string
  id_contrato: string
  id_contrato_avulso: string
  id_contrato_principal: string
  data_emissao: string
  data_vencimento: string
  valor: string
  valor_recebido: string
  valor_aberto: string
  valor_juros: string
  valor_multas: string
  valor_cancelado: string
  pagamento_data: string
  baixa_data: string
  tipo_recebimento: string
  forma_recebimento?: string
  recebido_via_pix: string
  titulo_renegociado: string
  documento: string
  nn_boleto: string
  id_carteira_cobranca: string
  obs: string
  liberado: string
  previsao: string
  nparcela: string
  ultima_atualizacao: string
}

export interface ClienteContratoItem {
  id: string
  id_cliente: string
  id_filial: string
  status: string
  status_internet: string
  contrato: string
  data_ativacao: string
  data_expiracao: string
  data_renovacao: string
  situacao_financeira_contrato: string
  pago_ate_data: string
  fidelidade: string
  taxa_instalacao: string
  desconto_fidelidade: string
  bloqueio_automatico: string
  contrato_suspenso: string
  id_vd_contrato: string
  id_tipo_contrato: string
  id_carteira_cobranca: string
  id_vendedor: string
  tipo_cobranca: string
  renovacao_automatica: string
  ultima_atualizacao: string
}

export interface ClienteItem {
  id: string
  razao: string
  fantasia: string
  cnpj_cpf: string
  tipo_pessoa: string
  ativo: string
  email: string
  hotsite_email: string
  telefone_celular: string
  fone: string
  endereco: string
  numero: string
  complemento: string
  bairro: string
  cep: string
  cidade: string
  uf: string
  filial_id: string
  data_nascimento: string
  data_cadastro: string
  ultima_atualizacao: string
}

const ALLOWED_QTYPES = new Set([
  'fn_areceber.id',
  'fn_areceber.status',
  'fn_areceber.id_cliente',
  'fn_areceber.data_vencimento',
  'cliente_contrato.id',
  'cliente_contrato.id_cliente',
  'cliente.id',
  'cliente.cnpj_cpf',
  'cliente.razao',
])

const ALLOWED_OPERS = new Set(['=', 'like', '!=', '>', '<'])

export interface TenantCredentials {
  ixcBaseUrl: string
  ixcUser: string
  ixcTokenEnc: Buffer
  ixcTokenIv: Buffer
  tenantId: string
  userId?: string
  ixcConnectionId?: string
}

export interface IxcWriteOptions {
  method?: 'POST' | 'PUT' | 'PATCH'
  action?: string
}

function buildIxcRequestHeaders(creds: TenantCredentials, token: string, ixcsoft = 'listar') {
  const basicAuth = Buffer.from(`${creds.ixcUser}:${token}`).toString('base64')

  return {
    Authorization: `Basic ${basicAuth}`,
    ixcsoft,
    'Content-Type': 'application/json',
  }
}

function extractIxcHtmlError(text: string): string | null {
  const normalized = text.trim()
  if (!normalized.startsWith('<')) return null

  const withoutTags = normalized
    .replace(/<style[\s\S]*?<\/style>/gi, ' ')
    .replace(/<script[\s\S]*?<\/script>/gi, ' ')
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()

  return withoutTags || 'IXC returned HTML instead of JSON'
}

function extractIxcApplicationError(data: unknown): string | null {
  const source = (data ?? {}) as Record<string, unknown>
  const type = typeof source.type === 'string' ? source.type.trim().toLowerCase() : null
  const status = typeof source.status === 'string' ? source.status.trim().toLowerCase() : null
  const message =
    typeof source.message === 'string' ? source.message :
    typeof source.mensagem === 'string' ? source.mensagem :
    typeof source.error === 'string' ? source.error :
    typeof source.erro === 'string' ? source.erro :
    null

  const failed =
    type === 'error' ||
    type === 'erro' ||
    status === 'error' ||
    status === 'erro' ||
    status === 'falha' ||
    status === 'failed' ||
    source.success === false ||
    source.sucesso === false

  if (!failed) return null
  return message?.trim() || 'IXC application error'
}

async function parseIxcResponseBody<T>(response: Response): Promise<T> {
  const text = await response.text()
  const htmlError = extractIxcHtmlError(text)
  if (htmlError) {
    throw new AppError(502, htmlError)
  }

  try {
    const data = JSON.parse(text) as T
    const applicationError = extractIxcApplicationError(data)
    if (applicationError) {
      throw new AppError(502, applicationError)
    }
    return data
  } catch (error) {
    if (error instanceof AppError) {
      throw error
    }
    throw new AppError(502, 'Invalid IXC response payload')
  }
}

function normalizeIxcListResponse<T>(data: unknown): IxcListResponse<T> {
  const source = (data ?? {}) as Record<string, unknown>
  const msg = Array.isArray(source.msg)
    ? (source.msg as T[])
    : Array.isArray(source.registros)
      ? (source.registros as T[])
      : []

  const totalValue = source.total
  const total =
    typeof totalValue === 'number'
      ? String(totalValue)
      : typeof totalValue === 'string'
        ? totalValue
        : String(msg.length)

  return {
    type: typeof source.type === 'string' ? source.type : undefined,
    page: typeof source.page === 'string' ? source.page : undefined,
    msg,
    registros: msg,
    total,
  }
}

export async function ixcList<T>(
  creds: TenantCredentials,
  endpoint: string,
  params: IxcListParams,
  ipAddr?: string
): Promise<IxcListResponse<T>> {
  if (!ALLOWED_QTYPES.has(params.qtype)) {
    throw new AppError(400, 'Invalid query parameter')
  }
  if (!ALLOWED_OPERS.has(params.oper)) {
    throw new AppError(400, 'Invalid operator')
  }
  const rp = parseInt(params.rp, 10)
  if (rp > 50 || rp < 1) {
    throw new AppError(400, 'rp must be between 1 and 50')
  }

  const baseUrl = creds.ixcBaseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/webservice/v1/${endpoint}`

  await assertSafeUrl(url)

  const token = decrypt(creds.ixcTokenEnc, creds.ixcTokenIv)
  const body = JSON.stringify(params)

  let httpStatus = 0
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    const response = await fetch(url, {
      method: 'POST',
      headers: buildIxcRequestHeaders(creds, token, 'listar'),
      body,
      redirect: 'manual',
      signal: controller.signal,
    })
    clearTimeout(timeout)
    httpStatus = response.status

    await writeAuditLog({
      tenantId: creds.tenantId,
      userId: creds.userId,
      action: 'ixc_list',
      ixcEndpoint: endpoint,
      httpStatus,
      ipAddr,
    })

    if (!response.ok) {
      throw new AppError(502, 'IXC upstream error')
    }

    const data = await parseIxcResponseBody<unknown>(response)
    return normalizeIxcListResponse<T>(data)
  } catch (err) {
    if (!(err instanceof AppError)) {
      await writeAuditLog({
        tenantId: creds.tenantId,
        userId: creds.userId,
        action: 'ixc_list_error',
        ixcEndpoint: endpoint,
        httpStatus,
        ipAddr,
      }).catch(() => {})
    }
    throw err
  }
}

export async function ixcGet<T>(
  creds: TenantCredentials,
  endpoint: string,
  id: string,
  ipAddr?: string
): Promise<T> {
  const baseUrl = creds.ixcBaseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/webservice/v1/${endpoint}/${id}`

  await assertSafeUrl(`${baseUrl}/webservice/v1/${endpoint}`)

  const token = decrypt(creds.ixcTokenEnc, creds.ixcTokenIv)

  let httpStatus = 0
  const controller = new AbortController()
  const timeout = setTimeout(() => controller.abort(), 30_000)
  const response = await fetch(url, {
    method: 'GET',
    headers: buildIxcRequestHeaders(creds, token, 'listar'),
    redirect: 'manual',
    signal: controller.signal,
  })
  clearTimeout(timeout)
  httpStatus = response.status

  await writeAuditLog({
    tenantId: creds.tenantId,
    userId: creds.userId,
    action: 'ixc_get',
    ixcEndpoint: `${endpoint}/${id}`,
    httpStatus,
    ipAddr,
  })

  if (!response.ok) {
    throw new AppError(502, 'IXC upstream error')
  }

  return parseIxcResponseBody<T>(response)
}

export async function ixcFindOneByField<T>(
  creds: TenantCredentials,
  endpoint: string,
  params: Pick<IxcListParams, 'qtype' | 'query' | 'oper'> & Partial<Pick<IxcListParams, 'sortname' | 'sortorder'>>,
  ipAddr?: string
): Promise<T | null> {
  const response = await ixcList<T>(creds, endpoint, {
    qtype: params.qtype,
    query: params.query,
    oper: params.oper,
    page: '1',
    rp: '1',
    sortname: params.sortname ?? 'id',
    sortorder: params.sortorder ?? 'asc',
  }, ipAddr)

  return (response.msg ?? [])[0] ?? null
}

export async function ixcWrite<T = unknown>(
  creds: TenantCredentials,
  endpoint: string,
  payload: Record<string, unknown>,
  options?: IxcWriteOptions,
  ipAddr?: string
): Promise<T> {
  const baseUrl = creds.ixcBaseUrl.replace(/\/$/, '')
  const url = `${baseUrl}/webservice/v1/${endpoint}`

  await assertSafeUrl(url)

  const token = decrypt(creds.ixcTokenEnc, creds.ixcTokenIv)
  const method = options?.method ?? 'POST'
  const action = options?.action ?? 'ixc_write'
  const body = JSON.stringify(payload)

  let httpStatus = 0
  try {
    const controller = new AbortController()
    const timeout = setTimeout(() => controller.abort(), 30_000)
    const response = await fetch(url, {
      method,
      headers: buildIxcRequestHeaders(creds, token, 'editar'),
      body,
      redirect: 'manual',
      signal: controller.signal,
    })
    clearTimeout(timeout)
    httpStatus = response.status

    await writeAuditLog({
      tenantId: creds.tenantId,
      userId: creds.userId,
      action,
      ixcEndpoint: endpoint,
      httpStatus,
      ipAddr,
    })

    if (!response.ok) {
      throw new AppError(502, 'IXC upstream error')
    }

    return parseIxcResponseBody<T>(response)
  } catch (err) {
    if (!(err instanceof AppError)) {
      await writeAuditLog({
        tenantId: creds.tenantId,
        userId: creds.userId,
        action: `${action}_error`,
        ixcEndpoint: endpoint,
        httpStatus,
        ipAddr,
      }).catch(() => {})
    }
    throw err
  }
}
