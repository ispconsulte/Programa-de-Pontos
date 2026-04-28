import { z } from 'zod'
import { authenticateRequest, assertAdmin } from '../../_lib/auth'
import { methodNotAllowed, sendException, sendJson, sendInternalError, sendNoContent } from '../../_lib/http'
import { supabaseAdmin } from '../../_lib/supabase'

const paramsSchema = z.object({
  id: z.string().uuid(),
})

export default async function handler(request: any, response: any) {
  try {
    const auth = await authenticateRequest(request)
    assertAdmin(auth.userRole, auth.isFullAdmin)
    const { id } = paramsSchema.parse(request.query ?? request.params ?? {})

    if (request.method !== 'DELETE') {
      return methodNotAllowed(response)
    }

    const currentResult = await supabaseAdmin
      .from('pontuacao_campanhas')
      .select('id, ativa')
      .eq('tenant_id', auth.tenantId)
      .eq('id', id)
      .maybeSingle()
    if (currentResult.error) return sendInternalError(response)
    if (!currentResult.data) return sendNoContent(response)

    const rulesResult = await supabaseAdmin
      .from('pontuacao_campanha_regras')
      .delete()
      .eq('tenant_id', auth.tenantId)
      .eq('campanha_id', id)
    if (rulesResult.error) return sendInternalError(response)

    const campaignResult = await supabaseAdmin
      .from('pontuacao_campanhas')
      .delete()
      .eq('tenant_id', auth.tenantId)
      .eq('id', id)
    if (campaignResult.error) return sendInternalError(response)

    if (currentResult.data.ativa) {
      const replacementResult = await supabaseAdmin
        .from('pontuacao_campanhas')
        .select('id')
        .eq('tenant_id', auth.tenantId)
        .order('updated_at', { ascending: false, nullsFirst: false })
        .order('created_at', { ascending: false, nullsFirst: false })
        .limit(1)
        .maybeSingle()
      if (replacementResult.error) return sendInternalError(response)
      if (replacementResult.data) {
        const activateReplacementResult = await supabaseAdmin
          .from('pontuacao_campanhas')
          .update({ ativa: true })
          .eq('tenant_id', auth.tenantId)
          .eq('id', replacementResult.data.id)
        if (activateReplacementResult.error) return sendInternalError(response)
      }
    }

    return sendNoContent(response)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendJson(response, 400, { error: error.issues[0]?.message ?? 'Validation error' })
    }
    return sendException(response, error)
  }
}
