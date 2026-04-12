import { backendRequest } from '@/lib/backend-client'
import { supabase } from '@/lib/supabase-client'

const DEV_AREA_STORAGE_PREFIX = 'dev-area-access'

function buildStorageKey(area: 'codano' | 'contas') {
  return `${DEV_AREA_STORAGE_PREFIX}:${area}`
}

async function getSessionFingerprint(): Promise<string | null> {
  const { data } = await supabase.auth.getSession()
  const session = data.session
  const userId = session?.user?.id?.trim()
  const lastSignInAt = session?.user?.last_sign_in_at?.trim()

  if (!userId || !lastSignInAt) {
    return null
  }

  return `${userId}:${lastSignInAt}`
}

export async function hasDevelopmentAreaAccess(area: 'codano' | 'contas'): Promise<boolean> {
  const fingerprint = await getSessionFingerprint()
  if (!fingerprint || typeof window === 'undefined') {
    return false
  }

  return window.sessionStorage.getItem(buildStorageKey(area)) === fingerprint
}

export async function unlockDevelopmentArea(area: 'codano' | 'contas', password: string): Promise<void> {
  await backendRequest('/users/dev-area/unlock', {
    method: 'POST',
    body: JSON.stringify({ area, password }),
  })

  const fingerprint = await getSessionFingerprint()
  if (!fingerprint || typeof window === 'undefined') {
    return
  }

  window.sessionStorage.setItem(buildStorageKey(area), fingerprint)
}

export function clearDevelopmentAreaAccess(): void {
  if (typeof window === 'undefined') {
    return
  }

  for (const key of Object.keys(window.sessionStorage)) {
    if (key.startsWith(`${DEV_AREA_STORAGE_PREFIX}:`)) {
      window.sessionStorage.removeItem(key)
    }
  }
}
