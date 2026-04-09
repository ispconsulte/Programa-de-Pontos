import { backendRequest } from '@/lib/backend-client'
import type { CampaignClientRow } from '@/lib/supabase-queries'

export interface RewardCatalogInput {
  name: string
  description?: string | null
  requiredPoints: number
  stock?: number | null
  active?: boolean
  imageUrl?: string | null
}

export interface RewardCatalogRow {
  id: string
  nome: string
  descricao: string | null
  pontos_necessarios: number
  ativo: boolean
  estoque: number | null
  imagem_url: string | null
}

export async function fetchRewardCatalogItems(): Promise<RewardCatalogRow[]> {
  return backendRequest<RewardCatalogRow[]>('/campaign/catalog', {
    method: 'GET',
  })
}

export interface ManualPointsInput {
  client: CampaignClientRow
  points: number
  description: string
  actorName: string
}

export interface RewardRedemptionInput {
  client: CampaignClientRow
  reward: RewardCatalogRow
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
  remainingPoints: number
  remainingStock: number | null
}

export async function readImageAsDataUrl(file: File): Promise<string> {
  const maxBytes = 1_500_000
  if (file.size > maxBytes) {
    throw new Error('A imagem precisa ter no máximo 1,5 MB para ser salva no catálogo.')
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
    }),
  })
}

export async function updateRewardCatalogItem(id: string, input: RewardCatalogInput): Promise<RewardCatalogRow> {
  return backendRequest<RewardCatalogRow>(`/campaign/catalog/${id}`, {
    method: 'PATCH',
    body: JSON.stringify({
      name: input.name.trim(),
      description: input.description?.trim() || null,
      requiredPoints: Math.max(1, Math.trunc(input.requiredPoints)),
      stock: input.stock == null ? null : Math.max(0, Math.trunc(input.stock)),
      imageUrl: input.imageUrl?.trim() || null,
      active: input.active ?? true,
    }),
  })
}

export async function deleteRewardCatalogItem(id: string): Promise<void> {
  await backendRequest(`/campaign/catalog/${id}`, {
    method: 'DELETE',
  })
}

export async function grantManualPoints(input: ManualPointsInput): Promise<void> {
  await backendRequest('/campaign/manual-points', {
    method: 'POST',
    body: JSON.stringify({
      clientId: input.client.id,
      points: Math.max(1, Math.trunc(input.points)),
      description: input.description.trim(),
      actorName: input.actorName.trim() || 'operacao_manual',
    }),
  })
}

export async function registerRewardRedemption(input: RewardRedemptionInput): Promise<RewardRedemptionResult> {
  return backendRequest<RewardRedemptionResult>('/campaign/legacy-redemptions', {
    method: 'POST',
    body: JSON.stringify({
      clientId: input.client.id,
      rewardId: input.reward.id,
      responsible: input.responsible.trim(),
      notes: input.notes?.trim() || null,
    }),
  })
}
