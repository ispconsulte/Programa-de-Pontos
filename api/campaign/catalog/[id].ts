import { z } from 'zod'
import { authenticateRequest, assertAdmin } from '../../_lib/auth'
import { methodNotAllowed, sendJson, sendNoContent } from '../../_lib/http'
import { supabaseAdmin } from '../../_lib/supabase'

const catalogRewardSchema = z.object({
  name: z.string().trim().min(1).max(160),
  description: z.string().trim().max(400).optional().nullable(),
  requiredPoints: z.coerce.number().int().positive(),
  stock: z.coerce.number().int().min(0).optional().nullable(),
  imageUrl: z.string().trim().optional().nullable(),
  active: z.boolean().optional(),
})

function getBody(request: any): unknown {
  if (typeof request.body === 'string' && request.body.trim()) {
    return JSON.parse(request.body)
  }
  return request.body ?? {}
}

export default async function handler(request: any, response: any) {
  try {
    const auth = await authenticateRequest(request)
    assertAdmin(auth.userRole)
    const id = String(request.query.id ?? '')

    if (!id) {
      return sendJson(response, 400, { error: 'Brinde inválido' })
    }

    if (request.method === 'PATCH') {
      const body = catalogRewardSchema.parse(getBody(request))

      const updateResult = await supabaseAdmin
        .from('pontuacao_catalogo_brindes')
        .update({
          nome: body.name,
          descricao: body.description?.trim() || null,
          pontos_necessarios: body.requiredPoints,
          estoque: body.stock ?? null,
          imagem_url: body.imageUrl?.trim() || null,
          ativo: body.active ?? true,
        })
        .eq('id', id)
        .select('*')
        .single()

      if (updateResult.error || !updateResult.data) {
        return sendJson(response, 500, { error: updateResult.error?.message ?? 'Não foi possível atualizar o brinde' })
      }

      return sendJson(response, 200, updateResult.data)
    }

    if (request.method === 'DELETE') {
      const deleteResult = await supabaseAdmin
        .from('pontuacao_catalogo_brindes')
        .delete()
        .eq('id', id)

      if (deleteResult.error) {
        return sendJson(response, 500, { error: deleteResult.error.message })
      }

      return sendNoContent(response)
    }

    return methodNotAllowed(response)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendJson(response, 400, { error: 'Validation error' })
    }

    const message = error instanceof Error ? error.message : 'Internal Server Error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return sendJson(response, status, { error: message })
  }
}
