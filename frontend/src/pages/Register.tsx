import { useState, FormEvent } from 'react'
import { useNavigate, Link } from 'react-router-dom'
import { Eye, EyeOff, AlertCircle, ArrowLeft, ArrowRight, Trophy } from 'lucide-react'
import { supabase } from '@/lib/supabase-client'
import Spinner from '@/components/Spinner'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'

export default function RegisterPage() {
  const navigate = useNavigate()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [fieldErrors, setFieldErrors] = useState<{ email?: string; password?: string }>({})

  const validate = () => {
    const errors: { email?: string; password?: string } = {}
    if (!email.trim()) errors.email = 'E-mail é obrigatório.'
    if (!password) errors.password = 'Senha é obrigatória.'
    else if (password.length < 8) errors.password = 'Mínimo de 8 caracteres.'
    setFieldErrors(errors)
    return Object.keys(errors).length === 0
  }

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault()
    setError('')
    if (!validate()) return

    setLoading(true)
    try {
      // 1. Criar usuário no Supabase Auth
      const { data, error: signUpError } = await supabase.auth.signUp({ email, password })
      if (signUpError) {
        const msg = signUpError.message?.toLowerCase() ?? ''
        if (msg.includes('already') || msg.includes('duplicate')) {
          setError('Este e-mail já está cadastrado. Tente fazer login.')
        } else if (msg.includes('password') && msg.includes('short')) {
          setError('A senha precisa ter no mínimo 8 caracteres.')
        } else {
          setError('Não foi possível criar a conta. Tente novamente.')
        }
        return
      }
      }

      // 2. Se tiver sessão, chamar a Edge Function bootstrap-tenant
      //    que cria o registro na tabela tenants e users
      if (data.session?.access_token) {
        const { error: bootstrapError } = await supabase.functions.invoke('bootstrap-tenant', {
          body: {},
        })

        if (bootstrapError) {
          setError('Conta criada, mas falhou ao iniciar o tenant. Contate o suporte.')
          return
        }
      }

      await supabase.auth.signOut()
      navigate('/login?registered=1')
    } catch {
      setError('Erro de conexão. Verifique sua internet e tente novamente.')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background px-6 py-12">
      <div className="w-full max-w-[380px]">
        <Link
          to="/login"
          className="mb-8 inline-flex items-center gap-1.5 text-sm text-muted-foreground transition-colors hover:text-foreground"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Voltar para login
        </Link>

        <div className="mb-8 flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/15">
            <Trophy className="h-[18px] w-[18px] text-primary" />
          </div>
          <span className="text-sm font-bold text-foreground">Programa de Pontos</span>
        </div>

        <div className="mb-8">
          <h1 className="text-2xl font-bold tracking-tight text-foreground font-heading">Criar conta</h1>
          <p className="mt-2 text-sm text-muted-foreground">Preencha os dados para começar.</p>
        </div>

        <div className="rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] p-6">
          <form onSubmit={handleSubmit} className="space-y-5">
            {error && (
              <div className="flex items-center gap-2.5 rounded-lg border border-destructive/20 bg-destructive/[0.06] px-4 py-3">
                <AlertCircle className="h-4 w-4 flex-shrink-0 text-destructive" />
                <p className="text-sm text-foreground">{error}</p>
              </div>
            )}

            <div className="space-y-2">
              <Label htmlFor="email" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">E-mail</Label>
              <Input
                id="email"
                type="email"
                value={email}
                onChange={(e) => { setEmail(e.target.value); setFieldErrors((p) => ({ ...p, email: undefined })) }}
                placeholder="admin@empresa.com"
                autoComplete="email"
                className={fieldErrors.email ? 'border-destructive/50' : ''}
              />
              {fieldErrors.email && <p className="text-xs text-destructive">{fieldErrors.email}</p>}
            </div>

            <div className="space-y-2">
              <Label htmlFor="password" className="text-xs font-medium uppercase tracking-wider text-muted-foreground">Senha</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? 'text' : 'password'}
                  value={password}
                  onChange={(e) => { setPassword(e.target.value); setFieldErrors((p) => ({ ...p, password: undefined })) }}
                  placeholder="Mínimo de 8 caracteres"
                  autoComplete="new-password"
                  className={`pr-10 ${fieldErrors.password ? 'border-destructive/50' : ''}`}
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground transition-colors hover:text-foreground"
                  tabIndex={-1}
                >
                  {showPassword ? <EyeOff className="h-4 w-4" /> : <Eye className="h-4 w-4" />}
                </button>
              </div>
              {fieldErrors.password && <p className="text-xs text-destructive">{fieldErrors.password}</p>}
            </div>

            <Button type="submit" disabled={loading} className="w-full">
              {loading ? <Spinner size="sm" /> : <ArrowRight className="h-4 w-4" />}
              {loading ? 'Criando...' : 'Criar conta'}
            </Button>
          </form>
        </div>

        <p className="mt-6 text-center text-sm text-muted-foreground">
          Já tem conta?{' '}
          <Link to="/login" className="font-medium text-primary transition-colors hover:text-primary/80">
            Fazer login
          </Link>
        </p>
      </div>
    </div>
  )
}
