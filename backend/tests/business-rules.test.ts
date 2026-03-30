import { describe, it, expect } from 'vitest'
import { isActualPayment, getPaymentCategory, resolveContractId } from '../src/lib/business-rules.js'
import type { FnAreceberItem } from '../src/lib/ixc-proxy.js'

function makeItem(overrides: Partial<FnAreceberItem>): FnAreceberItem {
  return {
    id: '1',
    status: 'R',
    filial_id: '',
    id_cliente: '1',
    id_contrato: '',
    id_contrato_avulso: '',
    id_contrato_principal: '',
    data_emissao: '',
    data_vencimento: '',
    valor: '0',
    valor_recebido: '',
    valor_aberto: '',
    valor_juros: '',
    valor_multas: '',
    valor_cancelado: '',
    pagamento_data: '',
    baixa_data: '',
    tipo_recebimento: '',
    recebido_via_pix: 'N',
    titulo_renegociado: 'N',
    documento: '',
    nn_boleto: '',
    id_carteira_cobranca: '',
    obs: '',
    liberado: '',
    previsao: '',
    nparcela: '',
    ultima_atualizacao: '',
    ...overrides,
  }
}

describe('isActualPayment', () => {
  it('returns false when status=R and valor_recebido is empty', () => {
    expect(isActualPayment(makeItem({ status: 'R', valor_recebido: '' }))).toBe(false)
  })

  it('returns false when status=R and valor_recebido is "0.00"', () => {
    expect(isActualPayment(makeItem({ status: 'R', valor_recebido: '0.00' }))).toBe(false)
  })

  it('returns true when status=R and valor_recebido is "99.90"', () => {
    expect(isActualPayment(makeItem({ status: 'R', valor_recebido: '99.90' }))).toBe(true)
  })
})

describe('getPaymentCategory', () => {
  it('returns renegotiated when status=R and valor_recebido is empty', () => {
    expect(getPaymentCategory(makeItem({ status: 'R', valor_recebido: '' }))).toBe('renegotiated')
  })

  it('returns received when status=R and valor_recebido is "99.90"', () => {
    expect(getPaymentCategory(makeItem({ status: 'R', valor_recebido: '99.90' }))).toBe('received')
  })

  it('returns cancelled when status=C', () => {
    expect(getPaymentCategory(makeItem({ status: 'C' }))).toBe('cancelled')
  })

  it('returns open when status=A', () => {
    expect(getPaymentCategory(makeItem({ status: 'A' }))).toBe('open')
  })
})

describe('resolveContractId', () => {
  it('returns id_contrato_avulso when id_contrato is empty', () => {
    expect(
      resolveContractId(makeItem({ id_contrato: '', id_contrato_avulso: '2276', id_contrato_principal: '' }))
    ).toBe('2276')
  })

  it('returns null when all contract fields are empty', () => {
    expect(
      resolveContractId(makeItem({ id_contrato: '', id_contrato_avulso: '', id_contrato_principal: '' }))
    ).toBeNull()
  })

  it('returns id_contrato when present', () => {
    expect(
      resolveContractId(makeItem({ id_contrato: '100', id_contrato_avulso: '200', id_contrato_principal: '300' }))
    ).toBe('100')
  })
})
