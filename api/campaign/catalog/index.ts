import { z } from 'zod'
import { authenticateRequest, assertAdmin } from '../../_lib/auth'
import { methodNotAllowed, sendJson } from '../../_lib/http'
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

    if (request.method === 'GET') {
      const query = supabaseAdmin
        .from('pontuacao_catalogo_brindes')
        .select('*')
        .order('ativo', { ascending: false })
        .order('pontos_necessarios', { ascending: true })
        .order('nome', { ascending: true })

      const listResult = await (auth.userRole && ['admin', 'owner', 'manager'].includes(auth.userRole.toLowerCase())
        ? query
        : query.eq('ativo', true))

      if (listResult.error) {
        return sendJson(response, 500, { error: listResult.error.message })
      }

      return sendJson(response, 200, listResult.data ?? [])
    }

    if (request.method !== 'POST') {
      return methodNotAllowed(response)
    }

    assertAdmin(auth.userRole)

    const body = catalogRewardSchema.parse(getBody(request))

    const insertResult = await supabaseAdmin
      .from('pontuacao_catalogo_brindes')
      .insert({
        nome: body.name,
        descricao: body.description?.trim() || null,
        pontos_necessarios: body.requiredPoints,
        estoque: body.stock ?? null,
        imagem_url: body.imageUrl?.trim() || null,
        ativo: body.active ?? true,
      })
      .select('*')
      .single()

    if (insertResult.error || !insertResult.data) {
      return sendJson(response, 500, { error: insertResult.error?.message ?? 'Não foi possível criar o brinde' })
    }

    return sendJson(response, 201, insertResult.data)
  } catch (error) {
    if (error instanceof z.ZodError) {
      return sendJson(response, 400, { error: 'Validation error' })
    }

    const message = error instanceof Error ? error.message : 'Internal Server Error'
    const status = message === 'Unauthorized' ? 401 : message === 'Forbidden' ? 403 : 500
    return sendJson(response, status, { error: message })
  }
}
