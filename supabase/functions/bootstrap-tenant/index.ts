import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "https://esm.sh/@supabase/supabase-js@2"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

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

    if (existingUser) {
      return new Response(JSON.stringify({ message: 'Tenant já criado para este usuário.', tenant: existingUser }), {
        status: 200,
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
      })
    }

    let bodyCompanyName: string | undefined
    try {
      const body = await req.json()
      if (body && typeof body.companyName === 'string' && body.companyName.trim()) {
        bodyCompanyName = body.companyName.trim()
      }
    } catch {
      // no body is fine
    }

    const emailDomain = user.email ? user.email.split('@')[1]?.split('.')[0] : undefined
    const tenantName = bodyCompanyName ?? (emailDomain ? emailDomain.charAt(0).toUpperCase() + emailDomain.slice(1) : 'Nova Empresa')

    const { data: newTenant, error: insertTenantError } = await supabaseAdmin
      .from('tenants')
      .insert({ name: tenantName })
      .select('id')
      .single()

    if (insertTenantError) throw insertTenantError

    const { error: insertUserError } = await supabaseAdmin
      .from('users')
      .insert({
        id: user.id,
        tenant_id: newTenant.id,
        email: user.email,
        role: 'admin',
      })

    if (insertUserError) throw insertUserError

    return new Response(JSON.stringify({ message: 'Tenant criado com sucesso', tenant_id: newTenant.id }), {
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
