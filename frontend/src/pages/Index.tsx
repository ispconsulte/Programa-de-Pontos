import { useEffect } from 'react'
import { useNavigate } from 'react-router-dom'
import { isSupabaseConfigured, supabase } from '@/lib/supabase-client'
import Spinner from '@/components/Spinner'

export default function RootPage() {
  const navigate = useNavigate()

  useEffect(() => {
    if (!isSupabaseConfigured) {
      navigate('/login', { replace: true })
      return
    }

    const routeBySession = async () => {
      const { data: { session } } = await supabase.auth.getSession()
      if (session) {
        navigate('/operacao', { replace: true })
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
