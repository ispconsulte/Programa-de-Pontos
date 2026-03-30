import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '@/lib/supabase-client'
import { getAccessToken, getCachedAccessToken } from '@/lib/auth-client'
import Spinner from './Spinner'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const navigate = useNavigate()
  const [checking, setChecking] = useState(() => getCachedAccessToken() === undefined)

  useEffect(() => {
    let mounted = true

    const validateSession = async () => {
      const token = await getAccessToken()
      if (!mounted) return

      if (!token) {
        navigate('/login', { replace: true })
        return
      }

      setChecking(false)
    }

    void validateSession()

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.access_token) {
        navigate('/login', { replace: true })
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
