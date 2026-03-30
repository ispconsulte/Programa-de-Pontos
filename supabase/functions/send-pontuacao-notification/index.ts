// deno-lint-ignore-file no-explicit-any
import { createClient, type SupabaseClient } from 'npm:@supabase/supabase-js@2'
type AnySupabase = SupabaseClient<any, any, any>

type Json =
  | string
  | number
  | boolean
  | null
  | { [key: string]: Json | undefined }
  | Json[]

type NotificationEventType = 'points_awarded' | 'reward_available' | 'points_expiring'
type NotificationChannel = 'email' | 'sms' | 'whatsapp'

interface NotificationPayload {
  eventType: NotificationEventType
  channel?: NotificationChannel
  customerId?: string
  campanhaClienteId?: string
  referenceId?: string
  idempotencyKey?: string
  contact?: {
    name?: string
    email?: string
    phone?: string
  }
  points?: number
  availablePoints?: number
  rewardName?: string
  expiresAt?: string
}

interface UserRow {
  id: string
  tenant_id: string
  role: string
}

interface CampaignCustomerRow {
  id: string
  ixc_cliente_id: string
  nome_cliente: string
  email: string | null
  telefone: string | null
}

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: Json) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      ...corsHeaders,
      'Content-Type': 'application/json',
    },
  })
}

function getEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

function optionalEnv(name: string): string | null {
  const value = Deno.env.get(name)
  return value && value.trim() ? value.trim() : null
}

function normalizeText(value: unknown): string | null {
  if (value === null || value === undefined) return null
  const text = String(value).trim()
  return text ? text : null
}

function isValidEmail(email: string | null): boolean {
  return !!email && /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)
}

function normalizePhone(phone: string | null): string | null {
  if (!phone) return null
  const digits = phone.replace(/\D/g, '')
  return digits.length >= 10 ? digits : null
}

function resolveChannel(payload: NotificationPayload): NotificationChannel {
  if (payload.channel) return payload.channel
  if (isValidEmail(normalizeText(payload.contact?.email))) return 'email'
  return 'whatsapp'
}

function buildMessage(payload: NotificationPayload, customerName: string | null): string {
  const firstName = customerName?.split(' ')[0] ?? 'Cliente'

  switch (payload.eventType) {
    case 'points_awarded':
      return `${firstName}, voce recebeu ${payload.points ?? 0} pontos no Cliente em Dia.`
    case 'reward_available':
      return `${firstName}, voce ja pode resgatar ${payload.rewardName ?? 'um brinde'} no Cliente em Dia.`
    case 'points_expiring': {
      const expiry = normalizeText(payload.expiresAt)?.slice(0, 10)
      return expiry
        ? `${firstName}, seus pontos expiram em ${expiry}. Use antes disso.`
        : `${firstName}, seus pontos expiram em janeiro/2027. Use antes disso.`
    }
  }
}

async function sha256(input: string): Promise<string> {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(input))
  return Array.from(new Uint8Array(digest)).map((byte) => byte.toString(16).padStart(2, '0')).join('')
}

async function getAuthenticatedUser(supabase: ReturnType<typeof createClient>, request: Request): Promise<UserRow> {
  const authHeader = request.headers.get('Authorization')
  const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : ''
  if (!jwt) throw new Error('Authorization header is required')

  const { data: authData, error: authError } = await supabase.auth.getUser(jwt)
  if (authError || !authData.user) throw new Error(authError?.message ?? 'Unauthorized')

  const { data: userRow, error: userError } = await supabase
    .from('users')
    .select('id, tenant_id, role')
    .eq('id', authData.user.id)
    .maybeSingle()

  if (userError) throw new Error(userError.message)
  if (!userRow) throw new Error('User not found')
  if (!['admin', 'owner', 'manager'].includes(userRow.role)) throw new Error('Forbidden')

  return userRow as UserRow
}

async function writeAuditLog(
  supabase: AnySupabase,
  tenantId: string,
  userId: string | null,
  action: string,
  endpoint: string,
  httpStatus?: number | null,
) {
  await supabase.from('audit_logs').insert({
    tenant_id: tenantId,
    user_id: userId,
    action,
    ixc_endpoint: endpoint,
    http_status: httpStatus ?? null,
  })
}

async function loadCampaignCustomer(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  payload: NotificationPayload,
): Promise<CampaignCustomerRow | null> {
  let query = supabase
    .from('pontuacao_campanha_clientes')
    .select('id, ixc_cliente_id, nome_cliente, email, telefone')
    .eq('tenant_id', tenantId)

  if (payload.campanhaClienteId) {
    query = query.eq('id', payload.campanhaClienteId)
  } else if (payload.customerId) {
    query = query.eq('ixc_cliente_id', payload.customerId)
  } else {
    return null
  }

  const { data, error } = await query.maybeSingle()
  if (error) throw new Error(error.message)
  return (data as CampaignCustomerRow | null) ?? null
}

function buildContact(payload: NotificationPayload, campaignCustomer: CampaignCustomerRow | null, channel: NotificationChannel) {
  const email = normalizeText(payload.contact?.email) ?? normalizeText(campaignCustomer?.email)
  const phone = normalizePhone(normalizeText(payload.contact?.phone) ?? normalizeText(campaignCustomer?.telefone))
  const name = normalizeText(payload.contact?.name) ?? normalizeText(campaignCustomer?.nome_cliente)

  if (channel === 'email' && isValidEmail(email)) {
    return { channel, destination: email!, name }
  }

  if ((channel === 'sms' || channel === 'whatsapp') && phone) {
    return { channel, destination: phone, name }
  }

  return null
}

async function alreadySent(
  supabase: ReturnType<typeof createClient>,
  tenantId: string,
  idempotencyKey: string,
): Promise<boolean> {
  const { data, error } = await supabase
    .from('audit_logs')
    .select('id')
    .eq('tenant_id', tenantId)
    .eq('action', 'send_pontuacao_notification_success')
    .eq('ixc_endpoint', `notification:${idempotencyKey}`)
    .limit(1)

  if (error) throw new Error(error.message)
  return (data ?? []).length > 0
}

async function sendViaCurrentProvider(input: {
  channel: NotificationChannel
  destination: string
  message: string
  payload: NotificationPayload
}) {
  const provider = optionalEnv('NOTIFICATION_PROVIDER') ?? 'webhook'
  if (provider !== 'webhook') {
    throw new Error(`Unsupported notification provider: ${provider}`)
  }

  const webhookUrl = getEnv('NOTIFICATION_WEBHOOK_URL')
  const webhookToken = optionalEnv('NOTIFICATION_WEBHOOK_TOKEN')

  const response = await fetch(webhookUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(webhookToken ? { Authorization: `Bearer ${webhookToken}` } : {}),
    },
    body: JSON.stringify({
      channel: input.channel,
      to: input.destination,
      message: input.message,
      eventType: input.payload.eventType,
      referenceId: input.payload.referenceId ?? null,
    }),
  })

  if (!response.ok) {
    throw new Error(`Notification provider failed with status ${response.status}`)
  }

  return response.status
}

Deno.serve(async (request) => {
  if (request.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  if (request.method !== 'POST') {
    return json(405, { error: 'Method not allowed' })
  }

  const supabase = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'))

  try {
    const payload = (await request.json()) as NotificationPayload
    const user = await getAuthenticatedUser(supabase, request)
    const campaignCustomer = await loadCampaignCustomer(supabase, user.tenant_id, payload)
    const channel = resolveChannel(payload)
    const contact = buildContact(payload, campaignCustomer, channel)

    if (!contact) {
      await writeAuditLog(supabase, user.tenant_id, user.id, 'send_pontuacao_notification_invalid_contact', 'notification:invalid_contact', 422)
      return json(200, { status: 'skipped' })
    }

    const idempotencyKey = payload.idempotencyKey ?? await sha256([
      user.tenant_id,
      payload.eventType,
      payload.referenceId ?? '',
      campaignCustomer?.id ?? '',
      contact.channel,
      contact.destination,
      payload.points ?? '',
      payload.availablePoints ?? '',
      payload.rewardName ?? '',
      payload.expiresAt ?? '',
    ].join(':'))

    if (await alreadySent(supabase, user.tenant_id, idempotencyKey)) {
      return json(200, { status: 'skipped' })
    }

    const message = buildMessage(payload, contact.name)
    const providerStatus = await sendViaCurrentProvider({
      channel: contact.channel,
      destination: contact.destination,
      message,
      payload,
    })

    await writeAuditLog(
      supabase,
      user.tenant_id,
      user.id,
      'send_pontuacao_notification_success',
      `notification:${idempotencyKey}`,
      providerStatus,
    )

    return json(200, { status: 'sent' })
  } catch (error) {
    try {
      const authHeader = request.headers.get('Authorization')
      const jwt = authHeader?.startsWith('Bearer ') ? authHeader.slice('Bearer '.length).trim() : ''
      if (jwt) {
        const { data: authData } = await supabase.auth.getUser(jwt)
        if (authData.user) {
          const { data: userRow } = await supabase
            .from('users')
            .select('id, tenant_id')
            .eq('id', authData.user.id)
            .maybeSingle()

          if (userRow) {
            await writeAuditLog(
              supabase,
              userRow.tenant_id,
              userRow.id,
              'send_pontuacao_notification_error',
              'notification:error',
              500,
            )
          }
        }
      }
    } catch {
      // Ignore audit fallback failures.
    }

    return json(500, { status: 'error' })
  }
})
