import type { FastifyInstance } from 'fastify'
import { z } from 'zod'
import { AppError } from '../../lib/app-error.js'
import { writeAuditLog } from '../../lib/audit.js'
import { supabaseAdmin } from '../../lib/supabase-admin.js'
import { authenticate, isAdminRole, requireAdmin } from '../../middleware/auth.js'

const managedRoleSchema = z.enum(['admin', 'operator'])

const createUserSchema = z.object({
  email: z.string().email(),
  password: z.string().min(8),
  name: z.string().trim().min(1).max(120).optional(),
  role: managedRoleSchema.default('operator'),
})

const updateUserSchema = z.object({
  name: z.string().trim().min(1).max(120).optional(),
  role: managedRoleSchema.optional(),
  password: z.string().min(8).optional(),
  isActive: z.boolean().optional(),
})

interface TenantUserRow {
  id: string
  email: string
  role: string
  created_at: string
  is_active: boolean
  session_revoked_at: string | null
  updated_at: string
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
    .select('id, email, role, created_at, is_active, session_revoked_at, updated_at')
    .eq('tenant_id', tenantId)
    .order('created_at', { ascending: true })

  if (error) {
    throw new AppError(500, error.message)
  }

  return (data ?? []) as TenantUserRow[]
}

async function loadTenantUserById(tenantId: string, userId: string): Promise<TenantUserRow> {
  const { data, error } = await supabaseAdmin
    .from('users')
    .select('id, email, role, created_at, is_active, session_revoked_at, updated_at')
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
      throw new AppError(500, userResult.error?.message ?? 'Falha ao carregar perfil')
    }

    const dbUser = await loadTenantUserById(request.tenantId, request.userId)
    const authUser = userResult.data.user

    return reply.send({
      id: dbUser.id,
      tenant_id: request.tenantId,
      email: dbUser.email,
      role: dbUser.role,
      is_active: dbUser.is_active,
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
      const tenantUsers = await loadTenantUsers(request.tenantId)
      const authUsersResult = await supabaseAdmin.auth.admin.listUsers({
        page: 1,
        perPage: 1000,
      })

      if (authUsersResult.error) {
        throw new AppError(500, authUsersResult.error.message)
      }

      const authUsersById = new Map(
        (authUsersResult.data.users ?? []).map((user) => [user.id, user]),
      )

      return reply.send({
        data: tenantUsers.map((user) => {
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

      const existingUser = await supabaseAdmin
        .from('users')
        .select('id')
        .eq('tenant_id', request.tenantId)
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
          role: body.role,
          tenant_id: request.tenantId,
        },
      })

      if (createdAuthUser.error || !createdAuthUser.data.user) {
        throw new AppError(500, createdAuthUser.error?.message ?? 'Falha ao criar usuário')
      }

      const authUserId = createdAuthUser.data.user.id
      const insertResult = await supabaseAdmin
        .from('users')
        .insert({
          id: authUserId,
          tenant_id: request.tenantId,
          email: body.email,
          role: body.role,
          is_active: true,
        })

      if (insertResult.error) {
        await supabaseAdmin.auth.admin.deleteUser(authUserId)
        throw new AppError(500, insertResult.error.message)
      }

      await writeAuditLog({
        tenantId: request.tenantId,
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
      const targetUser = await loadTenantUserById(request.tenantId, id)

      const nextRole = body.role ?? targetUser.role
      const nextIsActive = body.isActive ?? targetUser.is_active
      const targetIsAdmin = isAdminRole(targetUser.role)
      const nextIsAdmin = isAdminRole(nextRole)

      if (targetIsAdmin && (!nextIsAdmin || !nextIsActive)) {
        await ensureAnotherAdminRemains(request.tenantId, targetUser.id)
      }

      const authUpdates: Record<string, unknown> = {}
      if (body.password) authUpdates.password = body.password
      if (body.name) {
        authUpdates.user_metadata = {
          full_name: body.name.trim(),
        }
      }
      if (body.role) {
        authUpdates.app_metadata = {
          role: body.role,
          tenant_id: request.tenantId,
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
          throw new AppError(500, authUpdateResult.error.message)
        }
      }

      const updatePayload: Record<string, unknown> = {}
      if (body.role) updatePayload.role = body.role
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
          .eq('tenant_id', request.tenantId)
          .eq('id', id)

        if (updateResult.error) {
          throw new AppError(500, updateResult.error.message)
        }
      }

      await writeAuditLog({
        tenantId: request.tenantId,
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
      const targetUser = await loadTenantUserById(request.tenantId, id)

      const { error } = await supabaseAdmin
        .from('users')
        .update({
          session_revoked_at: new Date().toISOString(),
        })
        .eq('tenant_id', request.tenantId)
        .eq('id', id)

      if (error) {
        throw new AppError(500, error.message)
      }

      await writeAuditLog({
        tenantId: request.tenantId,
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

      const targetUser = await loadTenantUserById(request.tenantId, id)
      if (isAdminRole(targetUser.role)) {
        await ensureAnotherAdminRemains(request.tenantId, targetUser.id)
      }

      const authDeleteResult = await supabaseAdmin.auth.admin.deleteUser(id)
      if (authDeleteResult.error) {
        throw new AppError(500, authDeleteResult.error.message)
      }

      const deleteResult = await supabaseAdmin
        .from('users')
        .delete()
        .eq('tenant_id', request.tenantId)
        .eq('id', id)

      if (deleteResult.error) {
        throw new AppError(500, deleteResult.error.message)
      }

      await writeAuditLog({
        tenantId: request.tenantId,
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
