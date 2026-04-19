import { authenticateRequest, assertAdmin } from '../_lib/auth'
import { methodNotAllowed, sendException, sendJson, sendInternalError } from '../_lib/http'
import { normalizeDisplayName, supabaseAdmin } from '../_lib/supabase'

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

export default async function handler(request: any, response: any) {
  try {
    if (request.method !== 'GET') {
      return methodNotAllowed(response)
    }

    const auth = await authenticateRequest(request)
    assertAdmin(auth.userRole)

    const tenantUsers = await supabaseAdmin
      .from('users')
      .select('id, email, role, created_at, is_active, session_revoked_at, updated_at')
      .eq('tenant_id', auth.tenantId)
      .order('created_at', { ascending: true })

    const authUsers = await listAllAuthUsers()

    if (tenantUsers.error || authUsers.error) {
      return sendInternalError(response)
    }

    const authUsersById = new Map((authUsers.data.users ?? []).map((user) => [user.id, user]))

    return sendJson(response, 200, {
      data: (tenantUsers.data ?? []).map((user) => {
        const authUser = authUsersById.get(user.id)
        return {
          id: user.id,
          email: user.email,
          role: user.role,
          is_active: user.is_active,
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
