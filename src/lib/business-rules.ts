import type { FnAreceberItem } from './ixc-proxy.js'

export function isActualPayment(item: FnAreceberItem): boolean {
  if (item.status !== 'R') return false
  if (!item.valor_recebido) return false
  if (parseFloat(item.valor_recebido) === 0) return false
  return true
}

export type PaymentCategory = 'received' | 'renegotiated' | 'open' | 'cancelled'

export function getPaymentCategory(item: FnAreceberItem): PaymentCategory {
  if (item.status === 'C') return 'cancelled'
  if (item.status === 'A') return 'open'
  if (item.status === 'R') {
    return isActualPayment(item) ? 'received' : 'renegotiated'
  }
  return 'open'
}

export function resolveContractId(item: FnAreceberItem): string | null {
  return item.id_contrato || item.id_contrato_avulso || item.id_contrato_principal || null
}
