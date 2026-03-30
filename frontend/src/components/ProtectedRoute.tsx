'use client'

import { useEffect, useState } from 'react'
import { useRouter } from 'next/navigation'
import { supabase } from '@/lib/supabase'
import { getAccessToken, getCachedAccessToken } from '@/lib/auth'
import Spinner from './Spinner'

interface ProtectedRouteProps {
  children: React.ReactNode
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const router = useRouter()
  const [checking, setChecking] = useState(() => getCachedAccessToken() === undefined)

  useEffect(() => {
    let mounted = true

    const validateSession = async () => {
      const token = await getAccessToken()
      if (!mounted) return

      if (!token) {
        router.replace('/login')
        return
      }

      setChecking(false)
    }

    void validateSession()

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      if (!session?.access_token) {
        router.replace('/login')
      }
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [router])

  if (checking) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background">
        <Spinner size="lg" />
      </div>
    )
  }

  return <>{children}</>
}
