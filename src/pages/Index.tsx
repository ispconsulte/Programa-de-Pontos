import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { getCachedAccessToken, isAuthenticatedAsync } from '@/lib/auth-client'
import Spinner from '@/components/Spinner'

export default function RootPage() {
  const navigate = useNavigate()

  useEffect(() => {
    const routeBySession = async () => {
      const cachedToken = getCachedAccessToken()
      if (cachedToken) {
        navigate('/dashboard', { replace: true })
        return
      }
      if (cachedToken === null) {
        navigate('/login', { replace: true })
        return
      }

      const authenticated = await isAuthenticatedAsync()
      if (authenticated) {
        navigate('/dashboard', { replace: true })
      } else {
        navigate('/login', { replace: true })
      }
    }

    void routeBySession()
  }, [navigate])

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <Spinner size="lg" />
    </div>
  )
}
