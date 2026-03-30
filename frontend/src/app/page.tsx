'use client'

import { useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { getCachedAccessToken, isAuthenticatedAsync } from '@/lib/auth'
import Spinner from '@/components/Spinner'

export default function RootPage() {
  const router = useRouter()

  useEffect(() => {
    const routeBySession = async () => {
      const cachedToken = getCachedAccessToken()
      if (cachedToken) {
        router.replace('/dashboard')
        return
      }
      if (cachedToken === null) {
        router.replace('/login')
        return
      }

      const authenticated = await isAuthenticatedAsync()
      if (authenticated) {
        router.replace('/dashboard')
      } else {
        router.replace('/login')
      }
    }

    void routeBySession()
  }, [router])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Spinner size="lg" />
    </div>
  )
}
