import { authenticateRequest, assertAdmin } from '../_lib/auth'
import { methodNotAllowed, sendException, sendNoContent, sendInternalError } from '../_lib/http'
import { supabaseAdmin } from '../_lib/supabase'
import {
  ensureAnotherAdminRemains,
  HttpError,
  isDuplicateUserError,
  loadTargetUser,
  requireTargetTenantId,
  shouldKeepAnotherAdmin,
  toFullAdminFlag,
  toStoredRole,
  updateUserSchema,
} from './_shared'

export default async function handler(request: any, response: any) {
  try {
    if (!['PATCH', 'DELETE', 'POST'].includes(request.method)) {
      return methodNotAllowed(response)
    }

    const auth = await authenticateRequest(request)
    assertAdmin(auth.userRole, auth.isFullAdmin)

    const id = String(request.query.id ?? '')
    if (!id) {
      throw new HttpError(400, 'Usuário não informado')
    }

    const targetUser = await loadTargetUser(auth, id)
    const targetTenantId = requireTargetTenantId(targetUser)
    if (!auth.isFullAdmin && targetUser.is_full_admin) {
      throw new HttpError(403, 'Forbidden')
    }

    // POST → disconnect (revoke session)
    if (request.method === 'POST') {
      const { error } = await supabaseAdmin
        .from('users')
        .update({ session_revoked_at: new Date().toISOString() })
        .eq('tenant_id', targetTenantId)
        .eq('id', id)

      if (error) {
        return sendInternalError(response)
      }

      return sendNoContent(response)
    }

    if (request.method === 'DELETE') {
      if (id === auth.userId) {
        throw new HttpError(400, 'Não é permitido excluir o próprio usuário por esta tela')
      }
      if (shouldKeepAnotherAdmin(targetUser, 'operator', false)) {
        await ensureAnotherAdminRemains(targetTenantId, targetUser.id)
      }

      const authDeleteResult = await supabaseAdmin.auth.admin.deleteUser(id)
      if (authDeleteResult.error) {
        return sendInternalError(response)
      }

      const deleteResult = await supabaseAdmin
        .from('users')
        .delete()
        .eq('tenant_id', targetTenantId)
        .eq('id', id)

      if (deleteResult.error) {
        return sendInternalError(response)
      }

      return sendNoContent(response)
    }

    const body = updateUserSchema.parse(request.body)
    if (!auth.isFullAdmin && body.role === 'full_admin') {
      throw new HttpError(403, 'Forbidden')
    }

    const requestedTenantId = body.tenantId ?? body.tenant_id
    if (!auth.isFullAdmin && requestedTenantId && requestedTenantId !== targetTenantId) {
      throw new HttpError(403, 'Forbidden')
    }

    const nextTenantId = auth.isFullAdmin && requestedTenantId ? requestedTenantId : targetTenantId
    const nextRole = body.role ? toStoredRole(body.role) : targetUser.role
    const nextIsFullAdmin = body.role ? toFullAdminFlag(body.role) : targetUser.is_full_admin
    const nextIsActive = body.isActive ?? targetUser.is_active

    if (shouldKeepAnotherAdmin(targetUser, nextRole, nextIsActive)) {
      await ensureAnotherAdminRemains(targetTenantId, targetUser.id)
    }
    if (nextTenantId !== targetTenantId) {
      const existingUser = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('tenant_id', nextTenantId)
        .eq('email', targetUser.email)
        .neq('id', id)
        .maybeSingle()

      if (existingUser.error) {
        return sendInternalError(response)
      }
      if (existingUser.data) {
        throw new HttpError(409, 'Já existe um usuário com esse e-mail neste tenant')
      }
    }

    const authUpdates: Record<string, unknown> = {}
    if (body.password) authUpdates.password = body.password
    if (body.name) {
      authUpdates.user_metadata = {
        full_name: body.name.trim(),
      }
    }
    if (body.role || nextTenantId !== targetTenantId) {
      authUpdates.app_metadata = {
        role: nextRole,
        tenant_id: nextTenantId,
        is_full_admin: nextIsFullAdmin,
      }
    }
    if (body.isActive === false) authUpdates.ban_duration = '876000h'
    if (body.isActive === true) authUpdates.ban_duration = 'none'

    if (Object.keys(authUpdates).length > 0) {
      const authUpdateResult = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates)
      if (authUpdateResult.error) {
        if (isDuplicateUserError(authUpdateResult.error)) {
          throw new HttpError(409, 'Já existe um usuário com esse e-mail')
        }
        return sendInternalError(response)
      }
    }

    const updatePayload: Record<string, unknown> = {}
    if (body.role) {
      updatePayload.role = nextRole
      updatePayload.is_full_admin = nextIsFullAdmin
    }
    if (nextTenantId !== targetTenantId) updatePayload.tenant_id = nextTenantId
    if (body.isActive !== undefined) {
      updatePayload.is_active = body.isActive
      if (!body.isActive) {
        updatePayload.session_revoked_at = new Date().toISOString()
      }
    }

    if (Object.keys(updatePayload).length > 0) {
      const updateResult = await supabaseAdmin
        .from('users')
        .update(updatePayload)
        .eq('id', id)
        .eq('tenant_id', targetTenantId)

      if (updateResult.error) {
        if (isDuplicateUserError(updateResult.error)) {
          throw new HttpError(409, 'Já existe um usuário com esse e-mail neste tenant')
        }
        return sendInternalError(response)
      }
    }

    return sendNoContent(response)
  } catch (error) {
    return sendException(response, error)
  }
}
