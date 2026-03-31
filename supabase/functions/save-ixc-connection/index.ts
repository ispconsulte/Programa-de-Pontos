import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

function json(status: number, body: unknown) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  })
}

function getEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing environment variable: ${name}`)
  return value
}

async function encryptToken(plaintext: string): Promise<{ enc: Uint8Array; iv: Uint8Array }> {
  const encryptionKeyHex = getEnv('ENCRYPTION_KEY')
  const rawKey = Uint8Array.from(encryptionKeyHex.match(/.{1,2}/g)!.map((pair: string) => parseInt(pair, 16)))
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(16))
  const encoded = new TextEncoder().encode(plaintext)
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded)
  return { enc: new Uint8Array(encrypted), iv }
}

function toHex(bytes: Uint8Array): string {
  return '\\x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseAuth = createClient(
      getEnv('SUPABASE_URL'),
      getEnv('SUPABASE_ANON_KEY'),
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const supabaseAdmin = createClient(
      getEnv('SUPABASE_URL'),
      getEnv('SUPABASE_SERVICE_ROLE_KEY')
    )

    // Auth
    const { data: { user }, error: authError } = await supabaseAuth.auth.getUser()
    if (authError || !user) return json(401, { error: 'Não autorizado' })

    const { data: userRow } = await supabaseAdmin
      .from('users')
      .select('id, tenant_id, role')
      .eq('id', user.id)
      .maybeSingle()

    if (!userRow) return json(403, { error: 'Usuário não encontrado' })

    const tenantId = userRow.tenant_id

    // Parse body
    const body = await req.json()
    const { connectionId, ixcBaseUrl, ixcUser, ixcToken, tenantName } = body as {
      connectionId?: string | null
      ixcBaseUrl: string
      ixcUser: string
      ixcToken?: string
      tenantName?: string
    }

    if (!ixcBaseUrl || !ixcUser) {
      return json(400, { error: 'ixcBaseUrl e ixcUser são obrigatórios' })
    }

    // Update tenant name if provided
    if (tenantName?.trim()) {
      await supabaseAdmin
        .from('tenants')
        .update({ name: tenantName.trim() })
        .eq('id', tenantId)
    }

    if (connectionId) {
      // Update existing connection
      const updateData: Record<string, unknown> = {
        ixc_base_url: ixcBaseUrl,
        ixc_user: ixcUser,
      }

      if (ixcToken) {
        const { enc, iv } = await encryptToken(ixcToken)
        updateData.ixc_token_enc = toHex(enc)
        updateData.ixc_token_iv = toHex(iv)
      }

      const { error } = await supabaseAdmin
        .from('ixc_connections')
        .update(updateData)
        .eq('id', connectionId)
        .eq('tenant_id', tenantId)

      if (error) throw new Error(error.message)
    } else {
      // Insert new connection
      if (!ixcToken) {
        return json(400, { error: 'Token é obrigatório para nova conexão' })
      }

      const { enc, iv } = await encryptToken(ixcToken)

      const { error } = await supabaseAdmin
        .from('ixc_connections')
        .insert({
          tenant_id: tenantId,
          name: tenantName || 'Integração Padrão',
          ixc_base_url: ixcBaseUrl,
          ixc_user: ixcUser,
          ixc_token_enc: toHex(enc),
          ixc_token_iv: toHex(iv),
          active: true,
        })

      if (error) throw new Error(error.message)
    }

    // Also mirror to tenant table for legacy
    const tenantUpdate: Record<string, unknown> = {
      ixc_base_url: ixcBaseUrl,
      ixc_user: ixcUser,
    }
    if (ixcToken) {
      const { enc, iv } = await encryptToken(ixcToken)
      tenantUpdate.ixc_token_enc = toHex(enc)
      tenantUpdate.ixc_token_iv = toHex(iv)
    }
    await supabaseAdmin
      .from('tenants')
      .update(tenantUpdate)
      .eq('id', tenantId)

    return json(200, { message: 'Configurações salvas com sucesso' })
  } catch (error) {
    console.error('save-ixc-connection error:', error)
    return json(500, { error: (error as Error).message })
  }
})
