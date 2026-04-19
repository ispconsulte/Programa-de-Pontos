import { supabaseAdmin } from './supabase-admin.js'

interface AuditLogEntry {
  tenantId: string
  userId?: string
  action: string
  ixcEndpoint: string
  httpStatus?: number
  ipAddr?: string
}

export async function writeAuditLog(entry: AuditLogEntry): Promise<void> {
  const { error } = await supabaseAdmin
    .from('audit_logs')
    .insert({
      tenant_id: entry.tenantId,
      user_id: entry.userId ?? null,
      action: entry.action,
      ixc_endpoint: entry.ixcEndpoint,
      http_status: entry.httpStatus ?? null,
      ip_addr: entry.ipAddr ?? null,
    })

  if (error) {
    // Audit failure should never crash core flows
    console.error('Failed to write audit log')
  }
}
