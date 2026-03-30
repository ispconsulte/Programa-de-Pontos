import { describe, expect, it } from 'vitest'
import {
  buildCustomerCampaignStatus,
  buildIxcCustomerCampaignFieldPreview,
  buildRedemptionObservationEntry,
  describeRewardRedemption,
  evaluatePaymentRule,
} from '../src/lib/campaign.js'

describe('evaluatePaymentRule', () => {
  it('returns early payment rule when payment happens up to 3 days before due date', () => {
    const rule = evaluatePaymentRule('2026-03-10', '2026-03-12')
    expect(rule.rule_code).toBe('payment_before_due_up_to_3_days')
    expect(rule.points).toBe(5)
  })

  it('returns due date rule when payment happens on due date', () => {
    const rule = evaluatePaymentRule('2026-03-12', '2026-03-12')
    expect(rule.rule_code).toBe('payment_on_due_date')
    expect(rule.points).toBe(4)
  })

  it('returns late payment rule when payment happens after due date', () => {
    const rule = evaluatePaymentRule('2026-03-13', '2026-03-12')
    expect(rule.rule_code).toBe('payment_after_due_date')
    expect(rule.points).toBe(2)
  })
})

describe('describeRewardRedemption', () => {
  it('returns a readable redemption description', () => {
    expect(describeRewardRedemption('gift_card', 50)).toBe('Resgate gift_card concluido com 50 pontos')
  })
})

describe('buildCustomerCampaignStatus', () => {
  it('returns active when the customer is active', () => {
    expect(buildCustomerCampaignStatus(true)).toBe('active')
  })

  it('returns inactive when the customer is inactive', () => {
    expect(buildCustomerCampaignStatus(false)).toBe('inactive')
  })
})

describe('buildIxcCustomerCampaignFieldPreview', () => {
  it('returns the customer campaign fields expected by IXC sync preparation', () => {
    expect(buildIxcCustomerCampaignFieldPreview({
      customerId: '1',
      customerProfileId: 'profile-1',
      accumulatedPoints: 32,
      monthlyPoints: 11,
      campaignStatus: 'active',
      lastRedemptionAt: '2026-03-25T12:00:00.000Z',
      redemptionEligible: true,
      availablePoints: 32,
      cycleStart: '2026-03-01T00:00:00.000Z',
      cycleEnd: '2026-03-31T23:59:59.999Z',
    })).toEqual({
      accumulatedScore: 32,
      monthlyScore: 11,
      campaignStatus: 'active',
      lastRedemptionDate: '2026-03-25T12:00:00.000Z',
    })
  })
})

describe('buildRedemptionObservationEntry', () => {
  it('returns a governance-ready observation entry', () => {
    expect(buildRedemptionObservationEntry({
      rewardCode: 'gift_card',
      pointsSpent: 50,
      createdAt: '2026-03-26T10:00:00.000Z',
      balanceAfter: 12,
    })).toBe('[campaign] 2026-03-26T10:00:00.000Z resgate=gift_card pontos=50 saldo_restante=12')
  })
})
