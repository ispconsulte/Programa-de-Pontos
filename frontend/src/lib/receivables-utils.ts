export interface ScoreableReceivable {
  categoria?: string | null
  categoria_codigo?: string | null
  data_vencimento?: string | null
  data_pagamento?: string | null
  valor?: string | number | null
  valor_recebido?: string | number | null
}

function startOfDay(dateStr?: string | null) {
  if (!dateStr) return null
  const date = new Date(dateStr.includes('T') ? dateStr : `${dateStr}T00:00:00`)
  if (Number.isNaN(date.getTime())) return null
  date.setHours(0, 0, 0, 0)
  return date
}

export function diffInDays(from?: string | null, to?: string | null) {
  const fromDate = startOfDay(from)
  const toDate = startOfDay(to)
  if (!fromDate || !toDate) return null
  return Math.round((toDate.getTime() - fromDate.getTime()) / 86_400_000)
}

export function getPaymentScore(receivable: ScoreableReceivable) {
  const categoryCode = receivable.categoria_codigo?.trim().toLowerCase()
  const categoryLabel = receivable.categoria?.trim().toLowerCase()
  const isReceived = categoryCode === 'received' || categoryLabel === 'recebido'
  if (!isReceived) return 0

  const daysFromPaymentToDue = diffInDays(receivable.data_pagamento, receivable.data_vencimento)
  if (daysFromPaymentToDue === null) return 0
  if (daysFromPaymentToDue >= 1 && daysFromPaymentToDue <= 3) return 5
  if (daysFromPaymentToDue === 0) return 4
  return 2
}

export function getPaymentBehaviorLabel(receivable: ScoreableReceivable) {
  const categoryCode = receivable.categoria_codigo?.trim().toLowerCase()
  const categoryLabel = receivable.categoria?.trim().toLowerCase()
  const isReceived = categoryCode === 'received' || categoryLabel === 'recebido'
  if (!isReceived) return receivable.categoria || 'Movimento registrado'

  const daysFromPaymentToDue = diffInDays(receivable.data_pagamento, receivable.data_vencimento)
  if (daysFromPaymentToDue === null) return 'Pagamento confirmado'
  if (daysFromPaymentToDue >= 1 && daysFromPaymentToDue <= 3) return 'Pagamento antecipado'
  if (daysFromPaymentToDue === 0) return 'Pagamento no vencimento'
  return 'Pagamento após o vencimento'
}

export function getCampaignRuleLabel(points: number) {
  if (points === 5) return 'Pagamento ate 3 dias antes do vencimento'
  if (points === 4) return 'Pagamento no dia do vencimento'
  if (points === 2) return 'Pagamento apos o vencimento'
  return 'Regra nao identificada'
}

export function toNumber(value: string | number | null | undefined) {
  if (value === null || value === undefined || value === '') return null
  const num = typeof value === 'string' ? parseFloat(value) : value
  return Number.isNaN(num) ? null : num
}
