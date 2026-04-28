import { authenticateRequest, assertAdmin } from '../_lib/auth'
import { methodNotAllowed, sendException, sendJson, sendInternalError } from '../_lib/http'
import { normalizeDisplayName, supabaseAdmin } from '../_lib/supabase'
import { createUserSchema, HttpError, isDuplicateUserError, toFullAdminFlag, toStoredRole } from './_shared'

async function listAllAuthUsers() {
  const users: Array<any> = []
  let page = 1
  const perPage = 200

  while (true) {
    const result = await supabaseAdmin.auth.admin.listUsers({ page, perPage })
    if (result.error) {
      return result
    }

    const batch = result.data.users ?? []
    users.push(...batch)

    if (batch.length < perPage) {
      return {
        data: { users },
        error: null,
      }
    }

    page += 1
  }
}

async function loadTenantNames(tenantIds: string[]) {
  if (tenantIds.length === 0) {
    return new Map<string, string | null>()
  }

  const tenants = await supabaseAdmin
    .from('tenants')
    .select('id, name')
    .in('id', tenantIds)

  if (tenants.error) {
    return tenants
  }

  return {
    data: new Map((tenants.data ?? []).map((tenant: any) => [tenant.id, tenant.name ?? null])),
    error: null,
  }
}

export default async function handler(request: any, response: any) {
  try {
    if (!['GET', 'POST'].includes(request.method)) {
      return methodNotAllowed(response)
    }

    const auth = await authenticateRequest(request)

    // GET ?__me=1 → /users/me profile endpoint
    if (request.method === 'GET' && request.query.__me === '1') {
      const authUser = await supabaseAdmin.auth.admin.getUserById(auth.userId)

      const dbUserQuery = auth.isFullAdmin
        ? supabaseAdmin
            .from('users')
            .select('id, tenant_id, email, role, is_active, is_full_admin, created_at, updated_at')
            .eq('id', auth.userId)
            .maybeSingle()
        : supabaseAdmin
            .from('users')
            .select('id, tenant_id, email, role, is_active, is_full_admin, created_at, updated_at')
            .eq('tenant_id', auth.tenantId)
            .eq('id', auth.userId)
            .maybeSingle()

      const dbUser = await dbUserQuery

      if (authUser.error || !authUser.data.user) {
        return sendJson(response, 401, { error: 'Unauthorized' })
      }

      if (dbUser.error) {
        return sendJson(response, 503, { error: 'Perfil indisponível no momento' })
      }

      if (!dbUser.data) {
        return sendJson(response, 401, { error: 'Unauthorized' })
      }

      return sendJson(response, 200, {
        id: dbUser.data.id,
        tenant_id: dbUser.data.tenant_id ?? auth.tenantId,
        email: dbUser.data.email,
        role: dbUser.data.role,
        is_active: dbUser.data.is_active,
        is_full_admin: dbUser.data.is_full_admin === true,
        name: normalizeDisplayName(authUser.data.user),
        last_sign_in_at: authUser.data.user.last_sign_in_at ?? null,
        created_at: dbUser.data.created_at,
        updated_at: dbUser.data.updated_at,
      })
    }

    assertAdmin(auth.userRole, auth.isFullAdmin)

    if (request.method === 'POST') {
      const body = createUserSchema.parse(request.body)
      if (!auth.isFullAdmin && body.role === 'full_admin') {
        throw new HttpError(403, 'Forbidden')
      }

      const requestedTenantId = body.tenantId ?? body.tenant_id
      if (!auth.isFullAdmin && requestedTenantId && requestedTenantId !== auth.tenantId) {
        throw new HttpError(403, 'Forbidden')
      }

      const effectiveTenantId = auth.isFullAdmin && requestedTenantId ? requestedTenantId : auth.tenantId
      const storedRole = toStoredRole(body.role)
      const isFullAdmin = toFullAdminFlag(body.role)

      if (!effectiveTenantId) {
        throw new HttpError(400, 'Tenant não identificado para criação do usuário')
      }

      const existingUser = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('tenant_id', effectiveTenantId)
        .eq('email', body.email)
        .maybeSingle()

      if (existingUser.error) {
        return sendInternalError(response)
      }
      if (existingUser.data) {
        throw new HttpError(409, 'Já existe um usuário com esse e-mail neste tenant')
      }

      const createdAuthUser = await supabaseAdmin.auth.admin.createUser({
        email: body.email,
        password: body.password,
        email_confirm: true,
        user_metadata: {
          full_name: body.name?.trim() || undefined,
        },
        app_metadata: {
          role: storedRole,
          tenant_id: effectiveTenantId,
          is_full_admin: isFullAdmin,
        },
      })

      if (createdAuthUser.error || !createdAuthUser.data.user) {
        if (isDuplicateUserError(createdAuthUser.error)) {
          throw new HttpError(409, 'Já existe um usuário com esse e-mail')
        }
        return sendInternalError(response)
      }

      const authUserId = createdAuthUser.data.user.id
      const insertResult = await supabaseAdmin
        .from('users')
        .insert({
          id: authUserId,
          tenant_id: effectiveTenantId,
          email: body.email,
          role: storedRole,
          is_full_admin: isFullAdmin,
          is_active: true,
        })

      if (insertResult.error) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId)
        if (isDuplicateUserError(insertResult.error)) {
          throw new HttpError(409, 'Já existe um usuário com esse e-mail neste tenant')
        }
        return sendInternalError(response)
      }

      return sendJson(response, 201, { id: authUserId })
    }

    const tenantUsersQuery = auth.isFullAdmin
      ? supabaseAdmin
          .from('users')
          .select('id, email, role, created_at, is_active, session_revoked_at, updated_at, is_full_admin, tenant_id')
          .order('tenant_id', { ascending: true })
          .order('created_at', { ascending: true })
          .limit(500)
      : supabaseAdmin
          .from('users')
          .select('id, email, role, created_at, is_active, session_revoked_at, updated_at, is_full_admin, tenant_id')
          .eq('tenant_id', auth.tenantId)
          .order('created_at', { ascending: true })

    const tenantUsers = await tenantUsersQuery
    const authUsers = await listAllAuthUsers()
    const tenantNamesResult = await loadTenantNames([
      ...new Set((tenantUsers.data ?? []).map((user) => user.tenant_id).filter(Boolean)),
    ] as string[])

    if (tenantUsers.error || authUsers.error || tenantNamesResult.error) {
      return sendInternalError(response)
    }

    const tenantNamesMap: Map<string, string | null> = tenantNamesResult.data instanceof Map
      ? tenantNamesResult.data
      : new Map()

    const authUsersById = new Map((authUsers.data.users ?? []).map((user) => [user.id, user]))

    return sendJson(response, 200, {
      data: (tenantUsers.data ?? []).map((user) => {
        const authUser = authUsersById.get(user.id)
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          is_active: user.is_active,
          is_full_admin: (user as any).is_full_admin === true,
          tenant_id: (user as any).tenant_id ?? null,
          tenant_name: user.tenant_id ? tenantNamesMap.get(user.tenant_id) ?? null : null,
          name: normalizeDisplayName(authUser ?? user),
          created_at: user.created_at,
          updated_at: user.updated_at,
          last_sign_in_at: authUser?.last_sign_in_at ?? null,
          session_revoked_at: user.session_revoked_at,
          is_current_user: user.id === auth.userId,
        }
      }),
    })
  } catch (error) {
    return sendException(response, error)
  }
}
