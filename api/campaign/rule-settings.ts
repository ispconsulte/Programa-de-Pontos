import { z } from 'zod'
import { authenticateRequest, assertAdmin } from '../_lib/auth'
import { methodNotAllowed, sendException, sendJson, sendInternalError, sendNoContent } from '../_lib/http'
import { supabaseAdmin } from '../_lib/supabase'

const campaignRuleSettingsSchema = z.object({
  campaignId: z.string().uuid().optional().nullable(),
  campaignName: z.string().trim().min(1).max(160),
  active: z.boolean().optional(),
  thresholdEarlyDays: z.coerce.number().int().min(0),
  pointsEarly: z.coerce.number().int().min(0),
  pointsOnDue: z.coerce.number().int().min(0),
  pointsLate: z.coerce.number().int().min(0),
})

function getBody(request: any): unknown {
  if (typeof request.body === 'string' && request.body.trim()) {
    return JSON.parse(request.body)
  }
  return request.body ?? {}
}

function mapCampaignRuleSettings(campaign: any, rules: any[]) {
  const byCode = new Map(rules.map((rule) => [String(rule.regra_codigo), rule]))
  return {
    campaignId: String(campaign.id),
    campaignName: String(campaign.nome ?? 'Campanha padrão'),
    active: Boolean(campaign.ativa),
    thresholdEarlyDays: Number(byCode.get('antecipado')?.dias_antecedencia_min ?? 5),
    pointsEarly: Number(byCode.get('antecipado')?.pontos ?? 5),
    pointsOnDue: Number(byCode.get('no_vencimento')?.pontos ?? 4),
    pointsLate: Number(byCode.get('apos_vencimento')?.pontos ?? 2),
  }
}

export default async function handler(request: any, response: any) {
  try {
    const auth = await authenticateRequest(request)
    assertAdmin(auth.userRole, auth.isFullAdmin)

    if (request.method === 'GET') {
      const campaignsResult = await supabaseAdmin
        .from('pontuacao_campanhas')
        .select('id, nome, ativa, updated_at, created_at')
        .eq('tenant_id', auth.tenantId)
        .order('ativa', { ascending: false })
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false, nullsFirst: false })

      if (campaignsResult.error) return sendInternalError(response)
      const campaigns = campaignsResult.data ?? []
      if (!campaigns.length) return sendJson(response, 200, { data: [] })

      const rulesResult = await supabaseAdmin
        .from('pontuacao_campanha_regras')
        .select('campanha_id, regra_codigo, dias_antecedencia_min, pontos, ativo')
        .eq('tenant_id', auth.tenantId)
        .in('campanha_id', campaigns.map((campaign) => String(campaign.id)))
        .eq('ativo', true)

      if (rulesResult.error) return sendInternalError(response)

      const rulesByCampaign = new Map<string, any[]>()
      for (const rule of rulesResult.data ?? []) {
        const campaignId = String(rule.campanha_id ?? '')
        if (!campaignId) continue
        rulesByCampaign.set(campaignId, [...(rulesByCampaign.get(campaignId) ?? []), rule])
      }

      return sendJson(response, 200, {
        data: campaigns.map((campaign) => mapCampaignRuleSettings(campaign, rulesByCampaign.get(String(campaign.id)) ?? [])),
      })
    }

    if (request.method === 'POST') {
      const body = campaignRuleSettingsSchema.parse(getBody(request))
      let campaignId = body.campaignId ?? null
      const campaignName = body.campaignName.trim() || 'Campanha padrão'

      if (campaignId) {
        const updateResult = await supabaseAdmin
          .from('pontuacao_campanhas')
          .update({ nome: campaignName })
          .eq('tenant_id', auth.tenantId)
          .eq('id', campaignId)
        if (updateResult.error) return sendInternalError(response)
      } else {
        const insertResult = await supabaseAdmin
          .from('pontuacao_campanhas')
          .insert({ tenant_id: auth.tenantId, nome: campaignName, ativa: false })
          .select('id')
          .single()
        if (insertResult.error || !insertResult.data) return sendInternalError(response)
        campaignId = String(insertResult.data.id)
      }

      const deactivateResult = await supabaseAdmin
        .from('pontuacao_campanhas')
        .update({ ativa: false })
        .eq('tenant_id', auth.tenantId)
        .neq('id', campaignId)
      if (deactivateResult.error) return sendInternalError(response)

      const activateResult = await supabaseAdmin
        .from('pontuacao_campanhas')
        .update({ ativa: true })
        .eq('tenant_id', auth.tenantId)
        .eq('id', campaignId)
      if (activateResult.error) return sendInternalError(response)

      const rules = [
        { tenant_id: auth.tenantId, campanha_id: campaignId, regra_codigo: 'antecipado', dias_antecedencia_min: body.thresholdEarlyDays, pontos: body.pointsEarly, ativo: true },
        { tenant_id: auth.tenantId, campanha_id: campaignId, regra_codigo: 'no_vencimento', dias_antecedencia_min: null, pontos: body.pointsOnDue, ativo: true },
        { tenant_id: auth.tenantId, campanha_id: campaignId, regra_codigo: 'apos_vencimento', dias_antecedencia_min: null, pontos: body.pointsLate, ativo: true },
      ]
      const rulesResult = await supabaseAdmin
        .from('pontuacao_campanha_regras')
        .upsert(rules, { onConflict: 'campanha_id,regra_codigo' })
      if (rulesResult.error) return sendInternalError(response)

      return sendNoContent(response)
    }

    return methodNotAllowed(response)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendJson(response, 400, { error: error.issues[0]?.message ?? 'Validation error' })
    }
    return sendException(response, error)
  }
}
