import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase-client'
import {
  clearCurrentUserProfileCache,
  fetchCurrentUserProfile,
  getCachedCurrentUserProfile,
  isAdminUiRole,
} from '@/lib/user-management'
import { clearCurrentTenantIdCache } from '@/lib/supabase-queries'
import Spinner from './Spinner'

interface ProtectedRouteProps {
  children: React.ReactNode
  allowRoles?: Array<'admin' | 'operator'>
  redirectTo?: string
}

export default function ProtectedRoute({
  children,
  allowRoles,
  redirectTo = '/operacao',
}: ProtectedRouteProps) {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(() => !getCachedCurrentUserProfile())

  useEffect(() => {
    let mounted = true

    const validateSession = async () => {
      const { data: { session }, error } = await supabase.auth.getSession()
      if (!mounted) return

      if (error || !session) {
        clearCurrentUserProfileCache()
        clearCurrentTenantIdCache()
        navigate('/login', { replace: true })
        return
      }

      try {
        const profile = await fetchCurrentUserProfile()
        const normalizedRole: 'admin' | 'operator' = isAdminUiRole(profile.role) ? 'admin' : 'operator'

        if (allowRoles?.length && !allowRoles.includes(normalizedRole)) {
          navigate(redirectTo, { replace: true })
          return
        }
      } catch (profileError) {
        const message = profileError instanceof Error ? profileError.message.toLowerCase() : ''
        if (message.includes('unauthorized') || message.includes('session revoked') || message.includes('user disabled') || message.includes('forbidden')) {
          await supabase.auth.signOut()
          if (mounted) {
            navigate('/login', { replace: true })
          }
          return
        }
      }

      if (mounted) {
        setChecking(false)
      }
    }

    void validateSession()

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      clearCurrentUserProfileCache()
      clearCurrentTenantIdCache()
      if (!session?.access_token) {
        navigate('/login', { replace: true })
        return
      }
      if (mounted) {
        setChecking(false)
      }
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [navigate])

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    )
  }

  return <>{children}</>
}
