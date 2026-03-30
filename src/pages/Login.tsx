import { useState, FormEvent, useEffect } from 'react'
import { useNavigate, Link, useSearchParams } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle, CheckCircle, ArrowRight, Gift, Star, TrendingUp, Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase-client'
import Spinner from '@/components/Spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

const BASE_URL = (import.meta.env.VITE_API_URL || 'http://localhost:3000').replace(/\/+$/, '')

export default function LoginPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const [registered, setRegistered] = useState(false)

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')

  useEffect(() => {
    setRegistered(searchParams.get('registered') === '1')
  }, [searchParams])

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')

    if (!email.trim()) {
      setError('E-mail é obrigatório.')
      return
    }
    if (!password.trim()) {
      setError('Senha é obrigatória.')
      return
    }

    setLoading(true)
    try {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password,
      })

      if (signInError || !data.session?.access_token) {
        setError(signInError?.message || 'Credenciais inválidas.')
        return
      }

      try {
        const res = await fetch(`${BASE_URL}/auth/register`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${data.session.access_token}`,
          },
          body: JSON.stringify({}),
        })
        if (!res.ok) {
          const body = await res.json().catch(() => ({}))
          console.warn('Tenant bootstrap failed:', body.error || res.status)
        }
      } catch (bootstrapErr) {
        console.warn('Tenant bootstrap unreachable:', bootstrapErr)
      }

      navigate('/dashboard', { replace: true })
    } catch (err) {
      const message = err instanceof Error ? err.message : ''
      setError(message || 'Erro ao fazer login. Tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  const features = [
    { icon: Gift, label: 'Gestão completa de bônus e recompensas', desc: 'Controle total sobre campanhas e resgates' },
    { icon: TrendingUp, label: 'Pontuação em tempo real', desc: 'Acompanhe o desempenho dos seus clientes' },
    { icon: Star, label: 'Fidelização estratégica', desc: 'Campanhas de resgate e engajamento' },
  ]

  return (
    <div className="flex min-h-screen bg-background">
      {/* Left panel — Brand */}
      <div className="relative hidden w-1/2 overflow-hidden lg:flex lg:items-center lg:justify-center">
        <div className="absolute inset-0 bg-gradient-to-br from-[hsl(222,47%,4%)] via-[hsl(222,42%,7%)] to-[hsl(225,40%,5%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_80%_60%_at_30%_20%,_rgba(59,130,246,0.08)_0%,_transparent_60%)]" />
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_50%_40%_at_70%_80%,_rgba(59,130,246,0.05)_0%,_transparent_50%)]" />
        <div className="absolute inset-0 opacity-[0.025]" style={{ backgroundImage: 'radial-gradient(circle at 1px 1px, white 0.5px, transparent 0.5px)', backgroundSize: '28px 28px' }} />
        <div className="absolute left-0 right-0 top-0 h-px bg-gradient-to-r from-transparent via-primary/25 to-transparent" />

        <div className="relative z-10 w-full max-w-[540px] px-8">
          <div className="mb-10 flex justify-center animate-float">
            <div className="inline-flex h-16 w-16 items-center justify-center rounded-2xl bg-primary/[0.12] ring-1 ring-primary/20 shadow-lg shadow-primary/10">
              <Trophy className="h-8 w-8 text-primary" />
            </div>
          </div>

          <h2 className="text-center text-[30px] font-bold leading-[1.2] tracking-tight text-white font-heading">
            Gestão inteligente<br />
            de bonificações
          </h2>
          <p className="mt-5 text-center text-[15px] leading-relaxed text-slate-400">
            Acompanhe pontuações, gerencie recompensas e fidelize seus clientes com uma plataforma pensada para resultados.
          </p>

          <div className="mt-10 space-y-2.5">
            {features.map((feature, i) => {
              const Icon = feature.icon
              return (
                <div
                  key={feature.label}
                  className="group flex items-center gap-4 rounded-xl border border-white/[0.06] bg-gradient-to-r from-white/[0.03] to-transparent px-5 py-4 transition-all duration-300 hover:border-primary/20 hover:from-primary/[0.07] hover:to-primary/[0.02] hover:shadow-lg hover:shadow-primary/5 animate-build-in"
                  style={{ animationDelay: `${400 + i * 250}ms` }}
                >
                  <div className="flex h-11 w-11 flex-shrink-0 items-center justify-center rounded-xl bg-primary/[0.1] ring-1 ring-primary/20 transition-all duration-300 group-hover:bg-primary/[0.18] group-hover:ring-primary/30 group-hover:shadow-md group-hover:shadow-primary/10">
                    <Icon className="h-5 w-5 text-primary transition-transform duration-300 group-hover:scale-110" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-[13px] font-semibold text-white">{feature.label}</p>
                    <p className="mt-0.5 text-[12px] text-slate-400/80">{feature.desc}</p>
                  </div>
                </div>
              )
            })}
          </div>
        </div>
      </div>

      {/* Right panel — Login form */}
      <div className="relative flex w-full items-center justify-center px-6 py-12 lg:w-1/2 lg:px-12 xl:px-20">
        <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_50%_at_50%_40%,_rgba(59,130,246,0.03)_0%,_transparent_60%)] lg:bg-none" />

        <div className="relative z-10 w-full max-w-[500px] xl:max-w-[540px]">
          <div className="mb-10 flex items-center gap-3 lg:hidden">
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/15 animate-float">
              <Trophy className="h-5 w-5 text-primary" />
            </div>
            <span className="text-sm font-bold text-white">Programa de Pontos</span>
          </div>

          <div className="mb-8 text-center">
            <h1 className="text-2xl font-bold tracking-tight text-white font-heading">Bem-vindo de volta</h1>
            <p className="mt-2 text-sm text-muted-foreground">Entre com suas credenciais para continuar.</p>
          </div>

          {registered && (
            <div className="mb-5 flex items-center gap-2.5 rounded-xl border border-emerald-500/20 bg-emerald-500/[0.06] px-4 py-3 animate-enter">
              <CheckCircle className="h-4 w-4 flex-shrink-0 text-emerald-400" />
              <p className="text-sm text-emerald-300">Conta criada. Faça login para continuar.</p>
            </div>
          )}

          <div className="rounded-xl border border-white/[0.06] bg-white/[0.02] p-6 lg:p-8 shadow-xl shadow-black/10">
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="flex items-center gap-2.5 rounded-lg border border-destructive/20 bg-destructive/[0.06] px-4 py-3 animate-enter">
                  <AlertCircle className="h-4 w-4 flex-shrink-0 text-destructive" />
                  <p className="text-sm text-red-300">{error}</p>
                </div>
              )}

              <div className="space-y-2">
                <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">E-mail</Label>
                <Input
                  id="email"
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="seu@email.com"
                  autoComplete="email"
                />
              </div>

              <div className="space-y-2">
                <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Senha</Label>
                <div className="relative">
                  <Input
                    id="password"
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Digite sua senha"
                    autoComplete="current-password"
                    className="pr-10"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-white"
                    tabIndex={-1}
                  >
                    {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                  </button>
                </div>
              </div>

              <Button type="submit" disabled={loading} className="w-full" size="lg">
                {loading ? <Spinner size="sm" /> : <ArrowRight className="h-4 w-4" />}
                {loading ? 'Entrando...' : 'Entrar'}
              </Button>
            </form>
          </div>

          <p className="mt-6 text-center text-sm text-muted-foreground">
            Não tem conta?{' '}
            <Link to="/register" className="font-medium text-primary transition-colors hover:text-primary/80">
              Criar conta
            </Link>
          </p>
        </div>
      </div>
    </div>
  )
}
