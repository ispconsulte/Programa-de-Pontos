import { backendRequest } from '@/lib/backend-client'
import type { CampaignClientRow } from '@/lib/supabase-queries'

export interface RewardCatalogInput {
  name: string
  description?: string | null
  requiredPoints: number
  stock?: number | null
  active?: boolean
  imageUrl?: string | null
  reason?: string | null
  expectedUpdatedAt?: string | null
}

export interface RewardCatalogRow {
  id: string
  nome: string
  descricao: string | null
  pontos_necessarios: number
  ativo: boolean
  estoque: number | null
  imagem_url: string | null
  updated_at?: string
}

export async function fetchRewardCatalogItems(): Promise<RewardCatalogRow[]> {
  return backendRequest<RewardCatalogRow[]>('/campaign/catalog', {
    method: 'GET',
  })
}

export interface ManualPointsInput {
  client: CampaignClientRow
  points: number
  reason: string
  adjustmentType: 'credit' | 'debit'
}

export interface RewardRedemptionInput {
  isActiveCustomer: boolean
  client?: CampaignClientRow | null
  leadName?: string
  leadPhone?: string
  reward: RewardCatalogRow
  quantity: number
  responsible: string
  notes?: string
}

export interface RewardRedemptionResult {
  redemption: {
    id: string
    brinde_nome: string
    pontos_utilizados: number
    status_resgate: string
  }
  remainingPoints: number | null
  remainingStock: number | null
}

function buildIdempotencyKey(scope: string): string {
  if (typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function') {
    return `${scope}:${crypto.randomUUID()}`
  }

  if (typeof crypto !== 'undefined' && typeof crypto.getRandomValues === 'function') {
    const bytes = new Uint8Array(16)
    crypto.getRandomValues(bytes)
    const randomHex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, '0')).join('')
    return `${scope}:${randomHex}`
  }

  throw new Error('Secure randomness is unavailable in this environment.')
}

const ALLOWED_IMAGE_TYPES = new Set(['image/jpeg', 'image/png', 'image/webp'])

function hasAllowedImageSignature(file: File, bytes: Uint8Array): boolean {
  if (file.type === 'image/jpeg') {
    return bytes.length >= 3 && bytes[0] === 0xff && bytes[1] === 0xd8 && bytes[2] === 0xff
  }

  if (file.type === 'image/png') {
    return bytes.length >= 8
      && bytes[0] === 0x89
      && bytes[1] === 0x50
      && bytes[2] === 0x4e
      && bytes[3] === 0x47
      && bytes[4] === 0x0d
      && bytes[5] === 0x0a
      && bytes[6] === 0x1a
      && bytes[7] === 0x0a
  }

  if (file.type === 'image/webp') {
    return bytes.length >= 12
      && bytes[0] === 0x52
      && bytes[1] === 0x49
      && bytes[2] === 0x46
      && bytes[3] === 0x46
      && bytes[8] === 0x57
      && bytes[9] === 0x45
      && bytes[10] === 0x42
      && bytes[11] === 0x50
  }

  return false
}

export async function readImageAsDataUrl(file: File): Promise<string> {
  const maxBytes = 1_500_000
  if (file.size > maxBytes) {
    throw new Error('A imagem precisa ter no máximo 1,5 MB para ser salva no catálogo.')
  }

  if (!ALLOWED_IMAGE_TYPES.has(file.type)) {
    throw new Error('Formato inválido. Envie imagens nos formatos JPG, PNG ou WebP.')
  }

  const fileBytes = new Uint8Array(await file.arrayBuffer())
  if (!hasAllowedImageSignature(file, fileBytes)) {
    throw new Error('O arquivo enviado não corresponde a uma imagem JPG, PNG ou WebP válida.')
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'))
    reader.onload = () => {
      if (typeof reader.result !== 'string' || !reader.result.startsWith('data:image/')) {
        reject(new Error('Selecione um arquivo de imagem válido.'))
        return
      }
      resolve(reader.result)
    }
    reader.readAsDataURL(file)
  })
}

export async function createRewardCatalogItem(input: RewardCatalogInput): Promise<RewardCatalogRow> {
  return backendRequest<RewardCatalogRow>('/campaign/catalog', {
    method: 'POST',
    body: JSON.stringify({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      requiredPoints: Math.max(1, Math.trunc(input.requiredPoints)),
      stock: input.stock == null ? null : Math.max(0, Math.trunc(input.stock)),
      imageUrl: input.imageUrl?.trim() || null,
      active: input.active ?? true,
      reason: input.reason?.trim() || null,
      idempotencyKey: buildIdempotencyKey('catalog-create'),
    }),
  })
}

export async function updateRewardCatalogItem(id: string, input: RewardCatalogInput): Promise<RewardCatalogRow> {
  return backendRequest<RewardCatalogRow>(`/campaign/catalog/${id}`, {
    method: 'PUT',
    body: JSON.stringify({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      requiredPoints: Math.max(1, Math.trunc(input.requiredPoints)),
      stock: input.stock == null ? null : Math.max(0, Math.trunc(input.stock)),
      imageUrl: input.imageUrl?.trim() || null,
      active: input.active ?? true,
      reason: input.reason?.trim() || null,
      expectedUpdatedAt: input.expectedUpdatedAt ?? null,
      idempotencyKey: buildIdempotencyKey(`catalog-update:${id}`),
    }),
  })
}

export async function deleteRewardCatalogItem(id: string, options?: {
  expectedUpdatedAt?: string | null
  reason?: string | null
}): Promise<void> {
  await backendRequest(`/campaign/catalog/${id}`, {
    method: 'DELETE',
    body: JSON.stringify({
      expectedUpdatedAt: options?.expectedUpdatedAt ?? null,
      reason: options?.reason?.trim() || null,
      idempotencyKey: buildIdempotencyKey(`catalog-delete:${id}`),
    }),
  })
}

export async function grantManualPoints(input: ManualPointsInput): Promise<void> {
  await backendRequest('/campaign/manual-points', {
    method: 'POST',
    body: JSON.stringify({
      clientId: input.client.id,
      points: Math.max(1, Math.trunc(input.points)),
      reason: input.reason.trim(),
      adjustmentType: input.adjustmentType,
      idempotencyKey: buildIdempotencyKey(`manual-points:${input.client.id}`),
    }),
  })
}

export async function registerRewardRedemption(input: RewardRedemptionInput): Promise<RewardRedemptionResult> {
  return backendRequest<RewardRedemptionResult>('/campaign/legacy-redemptions', {
    method: 'POST',
    body: JSON.stringify({
      isActiveCustomer: input.isActiveCustomer,
      clientId: input.isActiveCustomer ? input.client?.id ?? null : null,
      leadName: input.isActiveCustomer ? null : input.leadName?.trim() || null,
      leadPhone: input.isActiveCustomer ? null : input.leadPhone?.trim() || null,
      rewardId: input.reward.id,
      quantity: Math.max(1, Math.trunc(input.quantity)),
      responsible: input.responsible.trim(),
      notes: input.notes?.trim() || null,
      idempotencyKey: buildIdempotencyKey(`rescue-create:${input.reward.id}`),
    }),
  })
}
