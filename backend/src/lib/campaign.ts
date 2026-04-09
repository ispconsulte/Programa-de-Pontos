import { pool } from '../db/pool.js'
import { AppError } from './app-error.js'
import type { ClienteContratoItem, ClienteItem, FnAreceberItem } from './ixc-proxy.js'
import { getPaymentCategory, isActualPayment, resolveContractId } from './business-rules.js'

export type CampaignEventType = 'payment' | 'upgrade' | 'sva' | 'loyalty_renewal'
export type CampaignEventSource = 'ixc' | 'manual' | 'system'

export interface CustomerIdentityInput {
  tenantId: string
  sourceType: string
  sourceConnectionId?: string | null
  externalCustomerId: string
  externalContractId?: string | null
  displayName?: string | null
  documentNumber?: string | null
  email?: string | null
  phone?: string | null
  metadata?: Record<string, unknown>
}

export interface CampaignRule {
  id?: string
  tenant_id?: string
  event_type: CampaignEventType
  rule_code: string
  points: number
  description: string
  active?: boolean
  starts_at?: string | null
  ends_at?: string | null
  priority?: number
  metadata?: Record<string, unknown>
}

export interface RecordCampaignEventInput {
  tenantId: string
  ixcConnectionId?: string | null
  customerId?: string | null
  customerProfileId?: string | null
  contractId?: string | null
  eventType: CampaignEventType
  eventSource: CampaignEventSource | string
  sourceReferenceType?: string | null
  sourceReferenceId?: string | null
  occurredAt?: string | Date
  points?: number
  ruleCode?: string | null
  description?: string | null
  idempotencyKey: string
  payload?: Record<string, unknown>
  createdBy?: string | null
}

export interface RecordRewardRedemptionInput {
  tenantId: string
  ixcConnectionId?: string | null
  customerId: string
  customerProfileId?: string | null
  rewardCode: string
  pointsSpent: number
  idempotencyKey: string
  status?: string
  description?: string | null
  payload?: Record<string, unknown>
  createdBy?: string | null
}

export interface CampaignReward {
  id: string
  tenant_id: string
  reward_code: string
  name: string
  points_required: number
  active: boolean
  metadata?: Record<string, unknown>
}

export interface CampaignLedgerSummary {
  earnedPoints: number
  spentPoints: number
  balance: number
  eventsCount: number
  redemptionsCount: number
}

export interface CampaignMonthlySummary {
  monthlyPoints: number
  monthlyEventsCount: number
  cycleStart: string
  cycleEnd: string
}

export interface CustomerCampaignSummary {
  customerId: string
  customerProfileId: string | null
  accumulatedPoints: number
  monthlyPoints: number
  campaignStatus: 'active' | 'inactive'
  lastRedemptionAt: string | null
  redemptionEligible: boolean
  availablePoints: number
  cycleStart: string
  cycleEnd: string
}

export interface ProcessPaymentCampaignInput {
  tenantId: string
  ixcConnectionId?: string | null
  receivable: FnAreceberItem
  customer: ClienteItem
  contract?: ClienteContratoItem | null
  createdBy?: string | null
}

const DEFAULT_RULES: CampaignRule[] = [
  {
    event_type: 'payment',
    rule_code: 'payment_before_due_up_to_3_days',
    points: 5,
    description: 'Pagamento realizado com até 3 dias de antecedencia do vencimento',
    priority: 10,
  },
  {
    event_type: 'payment',
    rule_code: 'payment_on_due_date',
    points: 4,
    description: 'Pagamento realizado na data do vencimento',
    priority: 20,
  },
  {
    event_type: 'payment',
    rule_code: 'payment_after_due_date',
    points: 2,
    description: 'Pagamento realizado apos o vencimento',
    priority: 30,
  },
  {
    event_type: 'upgrade',
    rule_code: 'upgrade_default',
    points: 5,
    description: 'Upgrade elegivel para pontuacao',
    priority: 10,
  },
  {
    event_type: 'sva',
    rule_code: 'sva_default',
    points: 3,
    description: 'Adesao de SVA elegivel para pontuacao',
    priority: 10,
  },
  {
    event_type: 'loyalty_renewal',
    rule_code: 'loyalty_renewal_default',
    points: 3,
    description: 'Renovacao de fidelidade elegivel para pontuacao',
    priority: 10,
  },
]

const DEFAULT_MISSIONS = [
  {
    code: 'payments_in_sequence',
    name: 'Sequencia em dia',
    description: 'Acumule pagamentos elegiveis para desbloquear bonus adicional.',
    event_type: 'payment',
    target_value: 3,
    reward_points: 10,
    metadata: { mode: 'count' },
  },
  {
    code: 'upgrade_once',
    name: 'Evolucao de plano',
    description: 'Realize um upgrade elegivel e receba bonus.',
    event_type: 'upgrade',
    target_value: 1,
    reward_points: 5,
    metadata: { mode: 'count' },
  },
  {
    code: 'sva_once',
    name: 'Ativacao adicional',
    description: 'Ative um SVA elegivel e receba bonus.',
    event_type: 'sva',
    target_value: 1,
    reward_points: 3,
    metadata: { mode: 'count' },
  },
]

function toIsoDate(value?: string | Date | null): string | null {
  if (!value) return null
  return new Date(value).toISOString()
}

function getUtcDay(value: string | Date): number {
  const date = new Date(value)
  return Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), date.getUTCDate())
}

export function evaluatePaymentRule(paymentDate: string | Date, dueDate: string | Date): CampaignRule {
  const diffDays = Math.round((getUtcDay(dueDate) - getUtcDay(paymentDate)) / 86400000)

  if (diffDays >= 1 && diffDays <= 3) {
    return DEFAULT_RULES.find((rule) => rule.rule_code === 'payment_before_due_up_to_3_days') as CampaignRule
  }
  if (diffDays === 0) {
    return DEFAULT_RULES.find((rule) => rule.rule_code === 'payment_on_due_date') as CampaignRule
  }
  if (diffDays < 0) {
    return DEFAULT_RULES.find((rule) => rule.rule_code === 'payment_after_due_date') as CampaignRule
  }
  return DEFAULT_RULES.find((rule) => rule.rule_code === 'payment_before_due_up_to_3_days') as CampaignRule
}

export function describeRewardRedemption(rewardCode: string, pointsSpent: number): string {
  return `Resgate ${rewardCode} concluido com ${pointsSpent} pontos`
}

export function describePaymentCampaignEvent(points: number, paymentDate: string | Date, dueDate: string | Date): string {
  const fmtBR = (d: string | Date) => {
    const iso = new Date(d).toISOString().slice(0, 10)
    const [y, m, day] = iso.split('-')
    return `${day}/${m}/${y}`
  }
  return `Pagamento pontuado com ${points} pontos (${fmtBR(paymentDate)} / vencimento ${fmtBR(dueDate)})`
}

function getMonthBounds(referenceDate?: string | Date) {
  const date = referenceDate ? new Date(referenceDate) : new Date()
  const start = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth(), 1, 0, 0, 0, 0))
  const end = new Date(Date.UTC(date.getUTCFullYear(), date.getUTCMonth() + 1, 0, 23, 59, 59, 999))

  return {
    start: start.toISOString(),
    end: end.toISOString(),
  }
}

function normalizeCustomerActiveFlag(value?: string | null): boolean {
  if (!value) return false
  const normalized = value.trim().toLowerCase()
  return normalized === 's' || normalized === 'sim' || normalized === '1' || normalized === 'true' || normalized === 'ativo'
}

export function buildCustomerCampaignStatus(isActiveCustomer: boolean): 'active' | 'inactive' {
  return isActiveCustomer ? 'active' : 'inactive'
}

export function buildIxcCustomerCampaignFieldPreview(summary: CustomerCampaignSummary) {
  return {
    accumulatedScore: summary.accumulatedPoints,
    monthlyScore: summary.monthlyPoints,
    campaignStatus: summary.campaignStatus,
    lastRedemptionDate: summary.lastRedemptionAt,
  }
}

export function buildRedemptionObservationEntry(input: {
  rewardCode: string
  pointsSpent: number
  createdAt?: string | Date
  balanceAfter?: number | null
}) {
  const createdAt = toIsoDate(input.createdAt) ?? new Date().toISOString()
  const balanceAfter =
    typeof input.balanceAfter === 'number'
      ? ` saldo_restante=${input.balanceAfter}`
      : ''

  return `[campaign] ${createdAt} resgate=${input.rewardCode} pontos=${input.pointsSpent}${balanceAfter}`
}

export async function resolveCustomerProfile(input: CustomerIdentityInput) {
  const existingIdentity = await pool.query(
    `
      SELECT
        ci.id,
        ci.customer_profile_id,
        cp.display_name,
        cp.document_number,
        cp.email,
        cp.phone
      FROM customer_identities ci
      INNER JOIN customer_profiles cp ON cp.id = ci.customer_profile_id
      WHERE
        ci.tenant_id = $1 AND
        ci.source_type = $2 AND
        (
          (ci.source_connection_id = $3) OR
          (ci.source_connection_id IS NULL AND $3 IS NULL)
        ) AND
        ci.external_customer_id = $4
      LIMIT 1
    `,
    [input.tenantId, input.sourceType, input.sourceConnectionId ?? null, input.externalCustomerId]
  )

  if (existingIdentity.rows[0]) {
    const profileId = existingIdentity.rows[0].customer_profile_id as string
    await pool.query(
      `
        UPDATE customer_profiles
        SET
          display_name = COALESCE($1, display_name),
          document_number = COALESCE($2, document_number),
          email = COALESCE($3, email),
          phone = COALESCE($4, phone),
          metadata = metadata || $5::jsonb,
          updated_at = now()
        WHERE id = $6
      `,
      [
        input.displayName ?? null,
        input.documentNumber ?? null,
        input.email ?? null,
        input.phone ?? null,
        JSON.stringify(input.metadata ?? {}),
        profileId,
      ]
    )

    await pool.query(
      `
        UPDATE customer_identities
        SET
          external_contract_id = COALESCE($1, external_contract_id),
          metadata = metadata || $2::jsonb,
          updated_at = now()
        WHERE id = $3
      `,
      [
        input.externalContractId ?? null,
        JSON.stringify(input.metadata ?? {}),
        existingIdentity.rows[0].id,
      ]
    )

    return {
      profileId,
      identityId: existingIdentity.rows[0].id as string,
    }
  }

  const documentNumber = input.documentNumber?.trim() || null
  const email = input.email?.trim() || null
  const phone = input.phone?.trim() || null

  const reusableProfile = await pool.query(
    `
      SELECT id
      FROM customer_profiles
      WHERE tenant_id = $1
        AND (
          ($2::text IS NOT NULL AND document_number = $2) OR
          ($3::text IS NOT NULL AND email = $3) OR
          ($4::text IS NOT NULL AND phone = $4)
        )
      ORDER BY created_at ASC
      LIMIT 1
    `,
    [input.tenantId, documentNumber, email, phone]
  )

  let profileId = reusableProfile.rows[0]?.id as string | undefined
  if (!profileId) {
    const createdProfile = await pool.query(
      `
        INSERT INTO customer_profiles (
          tenant_id,
          display_name,
          document_number,
          email,
          phone,
          metadata
        )
        VALUES ($1, $2, $3, $4, $5, $6::jsonb)
        RETURNING id
      `,
      [
        input.tenantId,
        input.displayName ?? null,
        documentNumber,
        email,
        phone,
        JSON.stringify(input.metadata ?? {}),
      ]
    )

    profileId = createdProfile.rows[0].id as string
  } else {
    await pool.query(
      `
        UPDATE customer_profiles
        SET
          display_name = COALESCE($1, display_name),
          document_number = COALESCE($2, document_number),
          email = COALESCE($3, email),
          phone = COALESCE($4, phone),
          metadata = metadata || $5::jsonb,
          updated_at = now()
        WHERE id = $6
      `,
      [
        input.displayName ?? null,
        documentNumber,
        email,
        phone,
        JSON.stringify(input.metadata ?? {}),
        profileId,
      ]
    )
  }

  const createdIdentity = await pool.query(
    `
      INSERT INTO customer_identities (
        tenant_id,
        customer_profile_id,
        source_type,
        source_connection_id,
        external_customer_id,
        external_contract_id,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7::jsonb)
      ON CONFLICT (tenant_id, source_type, source_connection_id, external_customer_id)
      DO UPDATE SET
        external_contract_id = COALESCE(EXCLUDED.external_contract_id, customer_identities.external_contract_id),
        metadata = customer_identities.metadata || EXCLUDED.metadata,
        updated_at = now()
      RETURNING id
    `,
    [
      input.tenantId,
      profileId,
      input.sourceType,
      input.sourceConnectionId ?? null,
      input.externalCustomerId,
      input.externalContractId ?? null,
      JSON.stringify(input.metadata ?? {}),
    ]
  )

  return {
    profileId,
    identityId: createdIdentity.rows[0].id as string,
  }
}

export async function listCustomerProfiles(tenantId: string, limit = 50) {
  const { rows } = await pool.query(
    `
      SELECT *
      FROM customer_profiles
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [tenantId, limit]
  )
  return rows
}

export async function getCustomerProfileByIdentity(
  tenantId: string,
  sourceType: string,
  sourceConnectionId: string | null | undefined,
  externalCustomerId: string
) {
  const { rows } = await pool.query(
    `
      SELECT
        cp.*,
        ci.id AS identity_id,
        ci.source_type,
        ci.source_connection_id,
        ci.external_customer_id,
        ci.external_contract_id
      FROM customer_identities ci
      INNER JOIN customer_profiles cp ON cp.id = ci.customer_profile_id
      WHERE
        ci.tenant_id = $1 AND
        ci.source_type = $2 AND
        (
          (ci.source_connection_id = $3) OR
          (ci.source_connection_id IS NULL AND $3 IS NULL)
        ) AND
        ci.external_customer_id = $4
      LIMIT 1
    `,
    [tenantId, sourceType, sourceConnectionId ?? null, externalCustomerId]
  )

  return rows[0] ?? null
}

export async function ensureDefaultCampaignRules(tenantId: string) {
  for (const rule of DEFAULT_RULES) {
    await pool.query(
      `
        INSERT INTO campaign_rules (
          tenant_id,
          event_type,
          rule_code,
          points,
          description,
          active,
          priority,
          metadata
        )
        SELECT $1, $2, $3, $4, $5, true, $6, $7::jsonb
        WHERE NOT EXISTS (
          SELECT 1
          FROM campaign_rules
          WHERE tenant_id = $1 AND rule_code = $3
        )
      `,
      [
        tenantId,
        rule.event_type,
        rule.rule_code,
        rule.points,
        rule.description,
        rule.priority ?? 100,
        JSON.stringify(rule.metadata ?? {}),
      ]
    )
  }
}

export async function listCampaignRules(tenantId: string, eventType?: CampaignEventType, when?: string | Date) {
  await ensureDefaultCampaignRules(tenantId)
  const effectiveAt = toIsoDate(when) ?? new Date().toISOString()

  const params = eventType ? [tenantId, eventType, effectiveAt] : [tenantId, effectiveAt]
  const query = eventType
    ? `
        SELECT *
        FROM campaign_rules
        WHERE
          tenant_id = $1 AND
          event_type = $2 AND
          active = true AND
          (starts_at IS NULL OR starts_at <= $3::timestamptz) AND
          (ends_at IS NULL OR ends_at >= $3::timestamptz)
        ORDER BY priority ASC, created_at ASC
      `
    : `
        SELECT *
        FROM campaign_rules
        WHERE
          tenant_id = $1 AND
          active = true AND
          (starts_at IS NULL OR starts_at <= $2::timestamptz) AND
          (ends_at IS NULL OR ends_at >= $2::timestamptz)
        ORDER BY event_type ASC, priority ASC, created_at ASC
      `

  const { rows } = await pool.query(query, params)
  return rows
}

export async function resolveCampaignRule(
  tenantId: string,
  eventType: CampaignEventType,
  options?: {
    occurredAt?: string | Date
    paymentDate?: string | Date
    dueDate?: string | Date
  }
) {
  const activeRules = await listCampaignRules(tenantId, eventType, options?.occurredAt)

  if (eventType === 'payment' && options?.paymentDate && options?.dueDate) {
    const defaultMatch = evaluatePaymentRule(options.paymentDate, options.dueDate)
    const matched = activeRules.find((rule) => rule.rule_code === defaultMatch.rule_code)
    return (matched as CampaignRule | undefined) ?? defaultMatch
  }

  const first = activeRules[0] as CampaignRule | undefined
  if (first) return first

  return DEFAULT_RULES.find((rule) => rule.event_type === eventType) as CampaignRule
}

export async function upsertCampaignRule(
  tenantId: string,
  rule: CampaignRule
) {
  const { rows } = await pool.query(
    `
      INSERT INTO campaign_rules (
        tenant_id,
        event_type,
        rule_code,
        points,
        description,
        active,
        starts_at,
        ends_at,
        priority,
        metadata
      )
      VALUES ($1, $2, $3, $4, $5, COALESCE($6, true), $7, $8, $9, $10::jsonb)
      ON CONFLICT (id) DO NOTHING
      RETURNING *
    `,
    [
      tenantId,
      rule.event_type,
      rule.rule_code,
      rule.points,
      rule.description,
      rule.active ?? true,
      toIsoDate(rule.starts_at) ?? null,
      toIsoDate(rule.ends_at) ?? null,
      rule.priority ?? 100,
      JSON.stringify(rule.metadata ?? {}),
    ]
  )

  return rows[0]
}

export async function recordCampaignEvent(input: RecordCampaignEventInput) {
  const payload = input.payload ?? {}
  const occurredAt = toIsoDate(input.occurredAt) ?? new Date().toISOString()
  const resolvedRule =
    input.points !== undefined && input.description
      ? null
      : await resolveCampaignRule(input.tenantId, input.eventType, { occurredAt })

  const points = input.points ?? resolvedRule?.points ?? 0
  const description = input.description ?? resolvedRule?.description ?? `${input.eventType} registrado`
  const ruleCode = input.ruleCode ?? resolvedRule?.rule_code ?? null

  const insert = await pool.query(
    `
      INSERT INTO campaign_events (
        tenant_id,
        ixc_connection_id,
        customer_id,
        customer_profile_id,
        contract_id,
        event_type,
        event_source,
        source_reference_type,
        source_reference_id,
        occurred_at,
        points,
        idempotency_key,
        payload,
        created_by,
        description,
        rule_code
      )
      VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13::jsonb, $14, $15, $16
      )
      ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
      RETURNING *
    `,
    [
      input.tenantId,
      input.ixcConnectionId ?? null,
      input.customerId ?? null,
      input.customerProfileId ?? null,
      input.contractId ?? null,
      input.eventType,
      input.eventSource,
      input.sourceReferenceType ?? null,
      input.sourceReferenceId ?? null,
      occurredAt,
      points,
      input.idempotencyKey,
      JSON.stringify(payload),
      input.createdBy ?? null,
      description,
      ruleCode,
    ]
  )

  const event = insert.rows[0] ?? (
    await pool.query(
      `
        SELECT *
        FROM campaign_events
        WHERE tenant_id = $1 AND idempotency_key = $2
        LIMIT 1
      `,
      [input.tenantId, input.idempotencyKey]
    )
  ).rows[0]

  if (event?.customer_profile_id) {
    await refreshMissionProgressForCustomer(input.tenantId, event.customer_profile_id)
  }

  return event
}

export async function recordRewardRedemption(input: RecordRewardRedemptionInput) {
  const payload = input.payload ?? {}
  const description = input.description ?? describeRewardRedemption(input.rewardCode, input.pointsSpent)

  const insert = await pool.query(
    `
      INSERT INTO reward_redemptions (
        tenant_id,
        ixc_connection_id,
        customer_id,
        customer_profile_id,
        reward_code,
        points_spent,
        status,
        idempotency_key,
        payload,
        created_by,
        description
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9::jsonb, $10, $11)
      ON CONFLICT (tenant_id, idempotency_key) DO NOTHING
      RETURNING *
    `,
    [
      input.tenantId,
      input.ixcConnectionId ?? null,
      input.customerId,
      input.customerProfileId ?? null,
      input.rewardCode,
      input.pointsSpent,
      input.status ?? 'completed',
      input.idempotencyKey,
      JSON.stringify(payload),
      input.createdBy ?? null,
      description,
    ]
  )

  if (insert.rows[0]) {
    return insert.rows[0]
  }

  const existing = await pool.query(
    `
      SELECT *
      FROM reward_redemptions
      WHERE tenant_id = $1 AND idempotency_key = $2
      LIMIT 1
    `,
    [input.tenantId, input.idempotencyKey]
  )

  return existing.rows[0]
}

export async function getCampaignRewardByCode(tenantId: string, rewardCode: string): Promise<CampaignReward | null> {
  const { rows } = await pool.query(
    `
      SELECT
        id,
        tenant_id,
        reward_code,
        name,
        points_required,
        active,
        metadata
      FROM campaign_rewards
      WHERE tenant_id = $1 AND reward_code = $2 AND active = true
      LIMIT 1
    `,
    [tenantId, rewardCode]
  )

  return (rows[0] as CampaignReward | undefined) ?? null
}

export async function listCampaignEvents(tenantId: string, options?: {
  customerId?: string
  customerProfileId?: string
  limit?: number
}) {
  const limit = options?.limit ?? 50

  if (options?.customerProfileId) {
    const { rows } = await pool.query(
      `
        SELECT *
        FROM campaign_events
        WHERE tenant_id = $1 AND customer_profile_id = $2
        ORDER BY created_at DESC
        LIMIT $3
      `,
      [tenantId, options.customerProfileId, limit]
    )
    return rows
  }

  if (options?.customerId) {
    const { rows } = await pool.query(
      `
        SELECT *
        FROM campaign_events
        WHERE tenant_id = $1 AND customer_id = $2
        ORDER BY created_at DESC
        LIMIT $3
      `,
      [tenantId, options.customerId, limit]
    )
    return rows
  }

  const { rows } = await pool.query(
    `
      SELECT *
      FROM campaign_events
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [tenantId, limit]
  )
  return rows
}

export async function listRewardRedemptions(tenantId: string, options?: {
  customerId?: string
  customerProfileId?: string
  limit?: number
}) {
  const limit = options?.limit ?? 50

  if (options?.customerProfileId) {
    const { rows } = await pool.query(
      `
        SELECT *
        FROM reward_redemptions
        WHERE tenant_id = $1 AND customer_profile_id = $2
        ORDER BY created_at DESC
        LIMIT $3
      `,
      [tenantId, options.customerProfileId, limit]
    )
    return rows
  }

  if (options?.customerId) {
    const { rows } = await pool.query(
      `
        SELECT *
        FROM reward_redemptions
        WHERE tenant_id = $1 AND customer_id = $2
        ORDER BY created_at DESC
        LIMIT $3
      `,
      [tenantId, options.customerId, limit]
    )
    return rows
  }

  const { rows } = await pool.query(
    `
      SELECT *
      FROM reward_redemptions
      WHERE tenant_id = $1
      ORDER BY created_at DESC
      LIMIT $2
    `,
    [tenantId, limit]
  )
  return rows
}

export async function getCampaignLedgerSummary(
  tenantId: string,
  options: {
    customerProfileId?: string
    customerId?: string
  }
): Promise<CampaignLedgerSummary> {
  const filterField = options.customerProfileId ? 'customer_profile_id' : 'customer_id'
  const filterValue = options.customerProfileId ?? options.customerId ?? null

  if (!filterValue) {
    return {
      earnedPoints: 0,
      spentPoints: 0,
      balance: 0,
      eventsCount: 0,
      redemptionsCount: 0,
    }
  }

  const eventsResult = await pool.query(
    `
      SELECT
        COALESCE(SUM(points), 0)::int AS earned_points,
        COUNT(*)::int AS events_count
      FROM campaign_events
      WHERE tenant_id = $1 AND ${filterField} = $2
    `,
    [tenantId, filterValue]
  )

  const redemptionsResult = await pool.query(
    `
      SELECT
        COALESCE(SUM(points_spent), 0)::int AS spent_points,
        COUNT(*)::int AS redemptions_count
      FROM reward_redemptions
      WHERE tenant_id = $1 AND ${filterField} = $2
    `,
    [tenantId, filterValue]
  )

  const earnedPoints = eventsResult.rows[0]?.earned_points ?? 0
  const spentPoints = redemptionsResult.rows[0]?.spent_points ?? 0
  const eventsCount = eventsResult.rows[0]?.events_count ?? 0
  const redemptionsCount = redemptionsResult.rows[0]?.redemptions_count ?? 0

  return {
    earnedPoints,
    spentPoints,
    balance: earnedPoints - spentPoints,
    eventsCount,
    redemptionsCount,
  }
}

export async function getCampaignMonthlySummary(
  tenantId: string,
  options: {
    customerProfileId?: string
    customerId?: string
    referenceDate?: string | Date
  }
): Promise<CampaignMonthlySummary> {
  const filterField = options.customerProfileId ? 'customer_profile_id' : 'customer_id'
  const filterValue = options.customerProfileId ?? options.customerId ?? null
  const cycle = getMonthBounds(options.referenceDate)

  if (!filterValue) {
    return {
      monthlyPoints: 0,
      monthlyEventsCount: 0,
      cycleStart: cycle.start,
      cycleEnd: cycle.end,
    }
  }

  const { rows } = await pool.query(
    `
      SELECT
        COALESCE(SUM(points), 0)::int AS monthly_points,
        COUNT(*)::int AS monthly_events_count
      FROM campaign_events
      WHERE
        tenant_id = $1 AND
        ${filterField} = $2 AND
        occurred_at >= $3::timestamptz AND
        occurred_at <= $4::timestamptz
    `,
    [tenantId, filterValue, cycle.start, cycle.end]
  )

  return {
    monthlyPoints: rows[0]?.monthly_points ?? 0,
    monthlyEventsCount: rows[0]?.monthly_events_count ?? 0,
    cycleStart: cycle.start,
    cycleEnd: cycle.end,
  }
}

export async function getLastRewardRedemptionAt(
  tenantId: string,
  options: {
    customerProfileId?: string
    customerId?: string
  }
) {
  const filterField = options.customerProfileId ? 'customer_profile_id' : 'customer_id'
  const filterValue = options.customerProfileId ?? options.customerId ?? null

  if (!filterValue) return null

  const { rows } = await pool.query(
    `
      SELECT created_at
      FROM reward_redemptions
      WHERE tenant_id = $1 AND ${filterField} = $2
      ORDER BY created_at DESC
      LIMIT 1
    `,
    [tenantId, filterValue]
  )

  return (rows[0]?.created_at as string | undefined) ?? null
}

export async function getCustomerCampaignSummary(
  tenantId: string,
  options: {
    customerId: string
    customerProfileId?: string | null
    isActiveCustomer?: boolean
    referenceDate?: string | Date
  }
): Promise<CustomerCampaignSummary> {
  const ledger = await getCampaignLedgerSummary(tenantId, {
    customerId: options.customerProfileId ? undefined : options.customerId,
    customerProfileId: options.customerProfileId ?? undefined,
  })

  const monthly = await getCampaignMonthlySummary(tenantId, {
    customerId: options.customerProfileId ? undefined : options.customerId,
    customerProfileId: options.customerProfileId ?? undefined,
    referenceDate: options.referenceDate,
  })

  const lastRedemptionAt = await getLastRewardRedemptionAt(tenantId, {
    customerId: options.customerProfileId ? undefined : options.customerId,
    customerProfileId: options.customerProfileId ?? undefined,
  })

  const campaignStatus = buildCustomerCampaignStatus(Boolean(options.isActiveCustomer))

  return {
    customerId: options.customerId,
    customerProfileId: options.customerProfileId ?? null,
    accumulatedPoints: ledger.balance,
    monthlyPoints: monthly.monthlyPoints,
    campaignStatus,
    lastRedemptionAt,
    redemptionEligible: campaignStatus === 'active' && ledger.balance > 0,
    availablePoints: ledger.balance,
    cycleStart: monthly.cycleStart,
    cycleEnd: monthly.cycleEnd,
  }
}

export async function getCampaignSummaryFromCustomer(
  tenantId: string,
  customer: ClienteItem,
  options?: {
    sourceConnectionId?: string | null
    customerProfileId?: string | null
    referenceDate?: string | Date
  }
) {
  let customerProfileId = options?.customerProfileId ?? null

  if (!customerProfileId) {
    const existing = await getCustomerProfileByIdentity(
      tenantId,
      'ixc',
      options?.sourceConnectionId ?? null,
      customer.id
    )
    customerProfileId = existing?.id ?? null
  }

  return getCustomerCampaignSummary(tenantId, {
    customerId: customer.id,
    customerProfileId,
    isActiveCustomer: normalizeCustomerActiveFlag(customer.ativo),
    referenceDate: options?.referenceDate,
  })
}

export async function processPaymentCampaignEvent(input: ProcessPaymentCampaignInput) {
  const category = getPaymentCategory(input.receivable)
  if (category !== 'received' || !isActualPayment(input.receivable)) {
    throw new AppError(409, 'Receivable is not eligible for payment scoring')
  }

  const contractId = input.contract?.id ?? resolveContractId(input.receivable) ?? null
  const customerIdentity = await resolveCustomerProfile({
    tenantId: input.tenantId,
    sourceType: 'ixc',
    sourceConnectionId: input.ixcConnectionId ?? null,
    externalCustomerId: input.customer.id,
    externalContractId: contractId,
    displayName: input.customer.razao || input.customer.fantasia || null,
    documentNumber: input.customer.cnpj_cpf || null,
    email: input.customer.email || input.customer.hotsite_email || null,
    phone: input.customer.telefone_celular || input.customer.fone || null,
    metadata: {
      filialId: input.customer.filial_id,
      receivableId: input.receivable.id,
      contractId,
    },
  })

  const paymentDate =
    input.receivable.pagamento_data ||
    input.receivable.baixa_data ||
    input.receivable.ultima_atualizacao ||
    new Date().toISOString()

  const rule = await resolveCampaignRule(input.tenantId, 'payment', {
    occurredAt: paymentDate,
    paymentDate,
    dueDate: input.receivable.data_vencimento,
  })

  const idempotencyKey = [
    'payment',
    input.ixcConnectionId ?? 'default',
    input.receivable.id,
    input.customer.id,
  ].join(':')

  const event = await recordCampaignEvent({
    tenantId: input.tenantId,
    ixcConnectionId: input.ixcConnectionId ?? null,
    customerId: input.customer.id,
    customerProfileId: customerIdentity.profileId,
    contractId,
    eventType: 'payment',
    eventSource: 'ixc',
    sourceReferenceType: 'fn_areceber',
    sourceReferenceId: input.receivable.id,
    occurredAt: paymentDate,
    idempotencyKey,
    points: rule.points,
    ruleCode: rule.rule_code,
    description: describePaymentCampaignEvent(rule.points, paymentDate, input.receivable.data_vencimento),
    payload: {
      category,
      receivableId: input.receivable.id,
      customerId: input.customer.id,
      contractId,
      dueDate: input.receivable.data_vencimento,
      paymentDate,
      amountReceived: input.receivable.valor_recebido,
      document: input.receivable.documento,
    },
    createdBy: input.createdBy ?? null,
  })

  const summary = await getCustomerCampaignSummary(input.tenantId, {
    customerId: input.customer.id,
    customerProfileId: customerIdentity.profileId,
    isActiveCustomer: normalizeCustomerActiveFlag(input.customer.ativo),
    referenceDate: paymentDate,
  })

  return {
    customerProfileId: customerIdentity.profileId,
    event,
    summary,
    ixcCustomerFieldPreview: buildIxcCustomerCampaignFieldPreview(summary),
  }
}

export async function redeemCampaignReward(
  input: RecordRewardRedemptionInput & {
    isActiveCustomer?: boolean
    referenceDate?: string | Date
  }
) {
  const reward = await getCampaignRewardByCode(input.tenantId, input.rewardCode)
  if (!reward) {
    throw new AppError(404, 'Reward not found')
  }

  const summaryBefore = await getCustomerCampaignSummary(input.tenantId, {
    customerId: input.customerId,
    customerProfileId: input.customerProfileId ?? null,
    isActiveCustomer: input.isActiveCustomer ?? true,
    referenceDate: input.referenceDate,
  })

  const pointsSpent = reward.points_required

  if (summaryBefore.availablePoints < pointsSpent) {
    throw new AppError(409, 'Insufficient points for redemption')
  }

  const redemption = await recordRewardRedemption({
    ...input,
    pointsSpent,
    status: input.status ?? 'requested',
    description: input.description ?? describeRewardRedemption(reward.name, pointsSpent),
  })
  const summaryAfter = await getCustomerCampaignSummary(input.tenantId, {
    customerId: input.customerId,
    customerProfileId: input.customerProfileId ?? null,
    isActiveCustomer: input.isActiveCustomer ?? true,
    referenceDate: input.referenceDate,
  })

  return {
    redemption,
    summary: summaryAfter,
    observationEntry: buildRedemptionObservationEntry({
      rewardCode: reward.reward_code,
      pointsSpent,
      createdAt: redemption?.created_at,
      balanceAfter: summaryAfter.availablePoints,
    }),
    ixcCustomerFieldPreview: buildIxcCustomerCampaignFieldPreview(summaryAfter),
  }
}

export async function ensureDefaultMissions(tenantId: string) {
  for (const mission of DEFAULT_MISSIONS) {
    await pool.query(
      `
        INSERT INTO campaign_missions (
          tenant_id,
          code,
          name,
          description,
          event_type,
          target_value,
          reward_points,
          active,
          metadata
        )
        SELECT $1, $2, $3, $4, $5, $6, $7, true, $8::jsonb
        WHERE NOT EXISTS (
          SELECT 1
          FROM campaign_missions
          WHERE tenant_id = $1 AND code = $2
        )
      `,
      [
        tenantId,
        mission.code,
        mission.name,
        mission.description,
        mission.event_type,
        mission.target_value,
        mission.reward_points,
        JSON.stringify(mission.metadata),
      ]
    )
  }
}

export async function listCampaignMissions(tenantId: string, customerProfileId?: string) {
  await ensureDefaultMissions(tenantId)

  const { rows } = await pool.query(
    `
      SELECT
        m.*,
        mp.id AS progress_id,
        mp.progress_value,
        mp.completed,
        mp.completed_at
      FROM campaign_missions m
      LEFT JOIN campaign_mission_progress mp
        ON mp.mission_id = m.id
        AND mp.tenant_id = m.tenant_id
        AND ($2::uuid IS NOT NULL AND mp.customer_profile_id = $2::uuid)
      WHERE m.tenant_id = $1
      ORDER BY m.created_at ASC
    `,
    [tenantId, customerProfileId ?? null]
  )

  return rows
}

export async function refreshMissionProgressForCustomer(tenantId: string, customerProfileId: string) {
  await ensureDefaultMissions(tenantId)
  const missions = await listCampaignMissions(tenantId, customerProfileId)

  for (const mission of missions) {
    const eventsCount = await pool.query(
      `
        SELECT COUNT(*)::int AS total
        FROM campaign_events
        WHERE
          tenant_id = $1 AND
          customer_profile_id = $2 AND
          event_type = $3
      `,
      [tenantId, customerProfileId, mission.event_type]
    )

    const progressValue = eventsCount.rows[0]?.total ?? 0
    const completed = progressValue >= mission.target_value

    await pool.query(
      `
        INSERT INTO campaign_mission_progress (
          tenant_id,
          mission_id,
          customer_profile_id,
          progress_value,
          completed,
          completed_at,
          metadata,
          updated_at
        )
        VALUES ($1, $2, $3, $4, $5, $6, '{}'::jsonb, now())
        ON CONFLICT (tenant_id, mission_id, customer_profile_id)
        DO UPDATE SET
          progress_value = EXCLUDED.progress_value,
          completed = EXCLUDED.completed,
          completed_at = EXCLUDED.completed_at,
          updated_at = now()
      `,
      [
        tenantId,
        mission.id,
        customerProfileId,
        progressValue,
        completed,
        completed ? new Date().toISOString() : null,
      ]
    )
  }
}
