import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AppError } from '../../lib/app-error.js'
import { writeAuditLog } from '../../lib/audit.js'
import { supabaseAdmin } from '../../lib/supabase-admin.js'
import { authenticate, isAdminRole, requireAdmin } from '../../middleware/auth.js'

const managedRoleSchema = z.enum(['admin', 'operator', 'full_admin'])

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1).max(120).optional(),
  role: managedRoleSchema.default('operator'),
  tenantId: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
})

const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: managedRoleSchema.optional(),
  password: z.string().min(8).optional(),
  isActive: z.boolean().optional(),
  tenantId: z.string().uuid().optional(),
  tenant_id: z.string().uuid().optional(),
})

interface TenantUserRow {
  id: string
  tenant_id: string | null
  email: string
  role: string
  created_at: string
  is_active: boolean
  is_full_admin: boolean
  session_revoked_at: string | null
  updated_at: string
  tenant_name?: string | null
}

function normalizeDisplayName(user: {
  email?: string | null
  user_metadata?: Record<string, unknown> | null
}): string {
  const metadata = user.user_metadata ?? {}
  const candidates = [
    metadata.full_name,
    metadata.name,
    metadata.display_name,
  ]

  for (const candidate of candidates) {
    if (typeof candidate === 'string' && candidate.trim()) {
      return candidate.trim()
    }
  }

  const email = typeof user.email === 'string' ? user.email : ''
  return email.split('@')[0] || 'Usuário'
}

async function loadTenantUsers(tenantId: string): Promise<TenantUserRow[]> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, tenant_id, email, role, created_at, is_active, is_full_admin, session_revoked_at, updated_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })
    .limit(100)

  if (error) {
    throw new AppError(500, error.message)
  }

  return attachTenantNames((data ?? []) as TenantUserRow[])
}

async function loadTenantUserById(tenantId: string, userId: string): Promise<TenantUserRow> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, tenant_id, email, role, created_at, is_active, is_full_admin, session_revoked_at, updated_at')
    .eq('tenant_id', tenantId)
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new AppError(500, error.message)
  }
  if (!data) {
    throw new AppError(404, 'Usuário não encontrado')
  }

  return data as TenantUserRow
}

async function loadUserById(userId: string): Promise<TenantUserRow> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, role, created_at, is_active, is_full_admin, session_revoked_at, updated_at, tenant_id')
    .eq('id', userId)
    .maybeSingle()

  if (error) {
    throw new AppError(500, error.message)
  }
  if (!data) {
    throw new AppError(404, 'Usuário não encontrado')
  }

  return data as TenantUserRow
}

async function loadAllUsers(): Promise<TenantUserRow[]> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, role, created_at, is_active, is_full_admin, session_revoked_at, updated_at, tenant_id')
    .order('tenant_id', { ascending: true })
    .order('created_at', { ascending: true })
    .limit(500)

  if (error) {
    throw new AppError(500, error.message)
  }

  return attachTenantNames((data ?? []) as TenantUserRow[])
}

async function attachTenantNames(users: TenantUserRow[]): Promise<TenantUserRow[]> {
  const tenantIds = [...new Set(users.map((user) => user.tenant_id).filter(Boolean))] as string[]
  if (tenantIds.length === 0) {
    return users
  }

  const { data, error } = await supabaseAdmin
    .from('tenants')
    .select('id, name')
    .in('id', tenantIds)

  if (error) {
    throw new AppError(500, error.message)
  }

  const tenantNames = new Map((data ?? []).map((tenant: any) => [tenant.id, tenant.name ?? null]))
  return users.map((user) => ({
    ...user,
    tenant_name: user.tenant_id ? tenantNames.get(user.tenant_id) ?? null : null,
  }))
}

async function loadTargetUserForRequest(request: any, userId: string): Promise<TenantUserRow> {
  return request.isFullAdmin
    ? loadUserById(userId)
    : loadTenantUserById(request.tenantId, userId)
}

function requireTargetTenantId(targetUser: TenantUserRow): string {
  if (!targetUser.tenant_id) {
    throw new AppError(400, 'Usuário alvo sem tenant associado')
  }

  return targetUser.tenant_id
}

function toStoredRole(role: z.infer<typeof managedRoleSchema>): 'admin' | 'operator' {
  return role === 'full_admin' ? 'admin' : role
}

function toFullAdminFlag(role: z.infer<typeof managedRoleSchema>): boolean {
  return role === 'full_admin'
}

function isDuplicateUserError(error: { code?: string; message?: string } | null | undefined): boolean {
  const message = String(error?.message ?? '').toLowerCase()
  return error?.code === '23505'
    || message.includes('duplicate')
    || message.includes('already registered')
    || message.includes('already exists')
    || message.includes('já existe')
}

async function listAllAuthUsers() {
  const users: Array<any> = []
  let page = 1
  const perPage = 200

  while (true) {
    const result = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    })

    if (result.error) {
      throw new AppError(500, result.error.message)
    }

    const batch = result.data.users ?? []
    users.push(...batch)

    if (batch.length < perPage) {
      return users
    }

    page += 1
  }
}

async function ensureAnotherAdminRemains(tenantId: string, excludedUserId: string) {
  const { count, error } = await supabaseAdmin
    .from('users')
    .select('id', { count: 'exact', head: true })
    .eq('tenant_id', tenantId)
    .eq('is_active', true)
    .in('role', ['admin', 'owner', 'manager'])
    .neq('id', excludedUserId)

  if (error) {
    throw new AppError(500, error.message)
  }
  if (!count || count < 1) {
    throw new AppError(400, 'O tenant precisa manter ao menos um usuário administrador ativo')
  }
}

export async function usersRoutes(app: FastifyInstance) {
  app.get('/me', {
    onRequest: authenticate,
    schema: {
      tags: ['Users'],
      summary: 'Obter perfil do usuário autenticado',
      security: [{ bearerAuth: [] }],
    },
  }, async (request, reply) => {
    const userResult = await supabaseAdmin.auth.admin.getUserById(request.userId)
    if (userResult.error || !userResult.data.user) {
      throw new AppError(401, 'Usuário autenticado não encontrado')
    }

    const dbUser = request.isFullAdmin
      ? await loadUserById(request.userId)
      : await loadTenantUserById(request.tenantId, request.userId)
    const authUser = userResult.data.user

    return reply.send({
      id: dbUser.id,
      tenant_id: dbUser.tenant_id ?? request.tenantId,
      email: dbUser.email,
      role: dbUser.role,
      is_active: dbUser.is_active,
      is_full_admin: request.isFullAdmin,
      name: normalizeDisplayName(authUser),
      last_sign_in_at: authUser.last_sign_in_at ?? null,
      created_at: dbUser.created_at,
      updated_at: dbUser.updated_at,
    })
  })

  app.register(async function adminUserRoutes(adminApp) {
    adminApp.addHook('onRequest', authenticate)
    adminApp.addHook('preHandler', requireAdmin)

    adminApp.get('/', {
      schema: {
        tags: ['Users'],
        summary: 'Listar usuários do tenant',
        security: [{ bearerAuth: [] }],
      },
    }, async (request, reply) => {
      const tenantUsers = request.isFullAdmin
        ? await loadAllUsers()
        : await loadTenantUsers(request.tenantId)
      const authUsers = await listAllAuthUsers()

      const authUsersById = new Map(
        authUsers.map((user) => [user.id, user]),
      )

      return reply.send({
        data: tenantUsers.map((user) => {
          const authUser = authUsersById.get(user.id)
          return {
            id: user.id,
            email: user.email,
            role: user.role,
            is_active: user.is_active,
            is_full_admin: (user as any).is_full_admin === true,
            tenant_id: (user as any).tenant_id ?? null,
            tenant_name: user.tenant_name ?? null,
            name: normalizeDisplayName(authUser ?? user),
            created_at: user.created_at,
            updated_at: user.updated_at,
            last_sign_in_at: authUser?.last_sign_in_at ?? null,
            session_revoked_at: user.session_revoked_at,
            is_current_user: user.id === request.userId,
          }
        }),
      })
    })

    adminApp.post('/', {
      schema: {
        tags: ['Users'],
        summary: 'Criar usuário no tenant',
        security: [{ bearerAuth: [] }],
      },
    }, async (request, reply) => {
      const body = createUserSchema.parse(request.body)
      if (!request.isFullAdmin && body.role === 'full_admin') {
        throw new AppError(403, 'Forbidden')
      }

      const requestedTenantId = body.tenantId ?? body.tenant_id
      if (!request.isFullAdmin && requestedTenantId && requestedTenantId !== request.tenantId) {
        throw new AppError(403, 'Forbidden')
      }

      const effectiveTenantId = request.isFullAdmin && requestedTenantId
        ? requestedTenantId
        : request.tenantId
      const storedRole = toStoredRole(body.role)
      const isFullAdmin = toFullAdminFlag(body.role)

      if (!effectiveTenantId) {
        throw new AppError(400, 'Tenant não identificado para criação do usuário')
      }

      const existingUser = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('tenant_id', effectiveTenantId)
        .eq('email', body.email)
        .maybeSingle()

      if (existingUser.error) {
        throw new AppError(500, existingUser.error.message)
      }
      if (existingUser.data) {
        throw new AppError(409, 'Já existe um usuário com esse e-mail neste tenant')
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
          throw new AppError(409, 'Já existe um usuário com esse e-mail')
        }
        throw new AppError(500, createdAuthUser.error?.message ?? 'Falha ao criar usuário')
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
          throw new AppError(409, 'Já existe um usuário com esse e-mail neste tenant')
        }
        throw new AppError(500, insertResult.error.message)
      }

      await writeAuditLog({
        tenantId: effectiveTenantId,
        userId: request.userId,
        action: `user.create:${body.email}`,
        ixcEndpoint: 'users',
        httpStatus: 201,
        ipAddr: request.ip,
      })

      return reply.status(201).send({
        id: authUserId,
      })
    })

    adminApp.patch('/:id', {
      schema: {
        tags: ['Users'],
        summary: 'Editar usuário do tenant',
        security: [{ bearerAuth: [] }],
      },
    }, async (request, reply) => {
      const { id } = request.params as { id: string }
      const body = updateUserSchema.parse(request.body)
      if (!request.isFullAdmin && body.role === 'full_admin') {
        throw new AppError(403, 'Forbidden')
      }

      const targetUser = await loadTargetUserForRequest(request, id)
      const targetTenantId = requireTargetTenantId(targetUser)
      if (!request.isFullAdmin && targetUser.is_full_admin) {
        throw new AppError(403, 'Forbidden')
      }
      const requestedTenantId = body.tenantId ?? body.tenant_id
      if (!request.isFullAdmin && requestedTenantId && requestedTenantId !== targetTenantId) {
        throw new AppError(403, 'Forbidden')
      }

      const nextTenantId = request.isFullAdmin && requestedTenantId ? requestedTenantId : targetTenantId
      const nextRole = body.role ? toStoredRole(body.role) : targetUser.role
      const nextIsFullAdmin = body.role ? toFullAdminFlag(body.role) : targetUser.is_full_admin
      const nextIsActive = body.isActive ?? targetUser.is_active
      const targetIsAdmin = isAdminRole(targetUser.role)
      const nextIsAdmin = isAdminRole(nextRole)

      if (targetIsAdmin && (!nextIsAdmin || !nextIsActive)) {
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
          throw new AppError(500, existingUser.error.message)
        }
        if (existingUser.data) {
          throw new AppError(409, 'Já existe um usuário com esse e-mail neste tenant')
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
      if (body.isActive === false) {
        authUpdates.ban_duration = '876000h'
      }
      if (body.isActive === true) {
        authUpdates.ban_duration = 'none'
      }

      if (Object.keys(authUpdates).length > 0) {
        const authUpdateResult = await supabaseAdmin.auth.admin.updateUserById(id, authUpdates)
        if (authUpdateResult.error) {
          if (isDuplicateUserError(authUpdateResult.error)) {
            throw new AppError(409, 'Já existe um usuário com esse e-mail')
          }
          throw new AppError(500, authUpdateResult.error.message)
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
          .eq('tenant_id', targetTenantId)
          .eq('id', id)

        if (updateResult.error) {
          if (isDuplicateUserError(updateResult.error)) {
            throw new AppError(409, 'Já existe um usuário com esse e-mail neste tenant')
          }
          throw new AppError(500, updateResult.error.message)
        }
      }

      await writeAuditLog({
        tenantId: targetTenantId,
        userId: request.userId,
        action: `user.update:${targetUser.email}`,
        ixcEndpoint: `users/${id}`,
        httpStatus: 204,
        ipAddr: request.ip,
      })

      return reply.status(204).send()
    })

    adminApp.post('/:id/disconnect', {
      schema: {
        tags: ['Users'],
        summary: 'Revogar sessão do usuário do tenant',
        security: [{ bearerAuth: [] }],
      },
    }, async (request, reply) => {
      const { id } = request.params as { id: string }
      const targetUser = await loadTargetUserForRequest(request, id)
      const targetTenantId = requireTargetTenantId(targetUser)
      if (!request.isFullAdmin && targetUser.is_full_admin) {
        throw new AppError(403, 'Forbidden')
      }

      const { error } = await supabaseAdmin
        .from('users')
        .update({
          session_revoked_at: new Date().toISOString(),
        })
        .eq('tenant_id', targetTenantId)
        .eq('id', id)

      if (error) {
        throw new AppError(500, error.message)
      }

      await writeAuditLog({
        tenantId: targetTenantId,
        userId: request.userId,
        action: `user.disconnect:${targetUser.email}`,
        ixcEndpoint: `users/${id}/disconnect`,
        httpStatus: 204,
        ipAddr: request.ip,
      })

      return reply.status(204).send()
    })

    adminApp.delete('/:id', {
      schema: {
        tags: ['Users'],
        summary: 'Excluir usuário do tenant',
        security: [{ bearerAuth: [] }],
      },
    }, async (request, reply) => {
      const { id } = request.params as { id: string }
      if (id === request.userId) {
        throw new AppError(400, 'Não é permitido excluir o próprio usuário por esta tela')
      }

      const targetUser = await loadTargetUserForRequest(request, id)
      const targetTenantId = requireTargetTenantId(targetUser)
      if (!request.isFullAdmin && targetUser.is_full_admin) {
        throw new AppError(403, 'Forbidden')
      }
      if (isAdminRole(targetUser.role)) {
        await ensureAnotherAdminRemains(targetTenantId, targetUser.id)
      }

      const authDeleteResult = await supabaseAdmin.auth.admin.deleteUser(id)
      if (authDeleteResult.error) {
        throw new AppError(500, authDeleteResult.error.message)
      }

      const deleteResult = await supabaseAdmin
        .from('users')
        .delete()
        .eq('tenant_id', targetTenantId)
        .eq('id', id)

      if (deleteResult.error) {
        throw new AppError(500, deleteResult.error.message)
      }

      await writeAuditLog({
        tenantId: targetTenantId,
        userId: request.userId,
        action: `user.delete:${targetUser.email}`,
        ixcEndpoint: `users/${id}`,
        httpStatus: 204,
        ipAddr: request.ip,
      })

      return reply.status(204).send()
    })
  })
}
