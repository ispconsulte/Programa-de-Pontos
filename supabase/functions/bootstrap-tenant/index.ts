import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

const SHARED_COMPANY_EMAIL = 'contatoispconsulte@gmail.com'

serve(async (req) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const supabaseClientAuth = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_ANON_KEY') ?? '',
      { global: { headers: { Authorization: req.headers.get('Authorization')! } } }
    )

    const supabaseAdmin = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? ''
    )

    const { data: { user }, error: userError } = await supabaseClientAuth.auth.getUser()

    if (userError || !user) {
      return new Response(JSON.stringify({ error: 'Não autorizado' }), {
        status: 401,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const { data: existingUser } = await supabaseAdmin
      .from('users')
      .select('id, tenant_id')
      .eq('id', user.id)
      .maybeSingle()

    const { data: sharedUser, error: sharedUserError } = await supabaseAdmin
      .from('users')
      .select('tenant_id')
      .eq('email', SHARED_COMPANY_EMAIL)
      .limit(1)
      .maybeSingle()

    if (sharedUserError) throw sharedUserError

    if (existingUser) {
      if (sharedUser?.tenant_id && existingUser.tenant_id !== sharedUser.tenant_id) {
        const { error: remapError } = await supabaseAdmin
          .from('users')
          .update({ tenant_id: sharedUser.tenant_id })
          .eq('id', existingUser.id)

        if (remapError) throw remapError

        existingUser.tenant_id = sharedUser.tenant_id
      }

      return new Response(JSON.stringify({ message: 'Tenant já criado para este usuário.', tenant: existingUser }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    const tenantName = user.email ? `Empresa de ${user.email.split('@')[0]}` : 'Nova Empresa'
    let tenantId = sharedUser?.tenant_id ?? null

    if (!tenantId) {
      const { data: newTenant, error: insertTenantError } = await supabaseAdmin
        .from('tenants')
        .insert({
          name: tenantName,
        })
        .select('id')
        .single()

      if (insertTenantError) throw insertTenantError
      tenantId = newTenant.id
    }

    const { error: insertUserError } = await supabaseAdmin
      .from('users')
      .insert({
        id: user.id,
        tenant_id: tenantId,
        email: user.email,
        password_hash: '$2b$10$dummyhash', 
        role: 'admin'
      })

    if (insertUserError) throw insertUserError

    return new Response(JSON.stringify({ message: 'Tenant criado com sucesso', tenant_id: tenantId }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    return new Response(JSON.stringify({ error: (error as Error).message }), {
      status: 400,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  }
})
