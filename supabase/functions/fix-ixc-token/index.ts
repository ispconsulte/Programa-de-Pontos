import { createClient } from 'npm:@supabase/supabase-js@2'

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

function getEnv(name: string): string {
  const value = Deno.env.get(name)
  if (!value) throw new Error(`Missing env: ${name}`)
  return value
}

async function encryptToken(plaintext: string): Promise<{ enc: Uint8Array; iv: Uint8Array }> {
  const hex = getEnv('ENCRYPTION_KEY')
  const rawKey = Uint8Array.from(hex.match(/.{1,2}/g)!.map((p: string) => parseInt(p, 16)))
  const key = await crypto.subtle.importKey('raw', rawKey, 'AES-GCM', false, ['encrypt'])
  const iv = crypto.getRandomValues(new Uint8Array(16))
  const encrypted = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, new TextEncoder().encode(plaintext))
  return { enc: new Uint8Array(encrypted), iv }
}

function toHex(bytes: Uint8Array): string {
  return '\\x' + Array.from(bytes).map(b => b.toString(16).padStart(2, '0')).join('')
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders })

  try {
    const { connectionId, token, ixcUser } = await req.json()
    if (!connectionId || !token) {
      return new Response(JSON.stringify({ error: 'connectionId and token required' }), { status: 400, headers: corsHeaders })
    }

    const { enc, iv } = await encryptToken(token)
    const supabase = createClient(getEnv('SUPABASE_URL'), getEnv('SUPABASE_SERVICE_ROLE_KEY'))

    const updateData: Record<string, unknown> = {
      ixc_token_enc: toHex(enc),
      ixc_token_iv: toHex(iv),
    }
    if (ixcUser) updateData.ixc_user = ixcUser

    const { error } = await supabase.from('ixc_connections').update(updateData).eq('id', connectionId)
    if (error) throw error

    // Verify decryption
    const { data: row } = await supabase.from('ixc_connections').select('ixc_token_enc, ixc_token_iv').eq('id', connectionId).single()
    
    return new Response(JSON.stringify({ success: true, enc_preview: toHex(enc).substring(0, 20) }), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (e) {
    return new Response(JSON.stringify({ error: (e as Error).message }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
