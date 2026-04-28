import { FormEvent, useMemo, useState } from 'react'
import { ArrowRight, CheckCircle2, KeyRound, Link as LinkIcon, ShieldCheck, Sparkles } from 'lucide-react'

import logoBonifica from '@/assets/logo-bonifica.png'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs'

type AccessMode = 'magic-link' | 'verification-code'

const steps = [
  'Confirme sua identidade com poucos dados.',
  'Receba um link seguro ou um codigo de verificacao.',
  'Acompanhe seus pontos e resgates com tranquilidade.',
]

export default function PortalAccessPage() {
  
  const [mode, setMode] = useState<AccessMode>('magic-link')
  const [magicIdentifier, setMagicIdentifier] = useState('')
  const [documentValue, setDocumentValue] = useState('')
  const [verificationCode, setVerificationCode] = useState('')

  const normalizedDocument = useMemo(
    () => documentValue.replace(/\D/g, ''),
    [documentValue],
  )

  const handleMagicLinkSubmit = (event: FormEvent) => {
    event.preventDefault()
    // TODO: implement actual magic link verification
    // For now, don't navigate — show placeholder message
  }

  const handleVerificationSubmit = (event: FormEvent) => {
    event.preventDefault()
    // TODO: implement actual verification code check
    // For now, don't navigate — show placeholder message
  }

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(34,197,94,0.12),_transparent_30%),linear-gradient(180deg,hsl(222,47%,8%),hsl(224,42%,6%))] px-4 py-8 sm:px-6 lg:px-8">
      <div className="mx-auto flex min-h-[calc(100vh-4rem)] w-full max-w-6xl items-center">
        <div className="grid w-full gap-8 lg:grid-cols-[1.05fr_0.95fr] lg:gap-10">
          <section className="flex flex-col justify-center">
            <div className="inline-flex w-fit items-center gap-3 rounded-full border border-emerald-400/20 bg-emerald-400/10 px-4 py-2 text-sm text-emerald-100">
              <ShieldCheck className="h-4 w-4" />
              Acesso seguro ao portal do cliente
            </div>

            <div className="mt-6 flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/10 bg-white/5 shadow-lg shadow-black/20">
                <img src={logoBonifica} alt="Bonifica" className="h-9 w-9 object-contain" />
              </div>
              <div>
                <p className="text-sm font-medium uppercase tracking-[0.24em] text-emerald-100/70">
                  Cliente em Dia
                </p>
                <h1 className="mt-1 text-4xl font-semibold tracking-tight text-white sm:text-5xl">
                  Entre no seu portal com seguranca e simplicidade.
                </h1>
              </div>
            </div>

            <p className="mt-6 max-w-xl text-base leading-7 text-slate-300">
              Consulte sua participação na campanha, acompanhe pontos disponíveis e veja seus resgates
              sem precisar lembrar senha.
            </p>

            <div className="mt-8 grid gap-3 sm:max-w-xl">
              {steps.map((step, index) => (
                <div
                  key={step}
                  className="flex items-start gap-3 rounded-2xl border border-white/8 bg-[hsl(var(--surface-2))] px-4 py-4 backdrop-blur-sm"
                >
                  <div className="mt-0.5 flex h-7 w-7 items-center justify-center rounded-full bg-emerald-400/15 text-sm font-semibold text-emerald-200">
                    {index + 1}
                  </div>
                  <p className="text-sm leading-6 text-slate-200">{step}</p>
                </div>
              ))}
            </div>
          </section>

          <section className="flex items-center">
            <Card className="w-full border-white/10 bg-[rgba(8,15,20,0.86)] shadow-2xl shadow-black/30 backdrop-blur-xl">
              <CardHeader className="space-y-4">
                <div className="flex items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-2xl">Acessar portal</CardTitle>
                    <CardDescription className="mt-2 max-w-md text-sm leading-6">
                      Escolha a forma mais conveniente para entrar. Este acesso e restrito ao titular da conta.
                    </CardDescription>
                  </div>
                  <div className="hidden h-12 w-12 items-center justify-center rounded-2xl bg-emerald-400/12 text-emerald-200 sm:flex">
                    <Sparkles className="h-5 w-5" />
                  </div>
                </div>
              </CardHeader>

              <CardContent className="space-y-6">
                <Tabs value={mode} onValueChange={(value) => setMode(value as AccessMode)} className="w-full">
                  <TabsList className="grid h-auto w-full grid-cols-2 rounded-2xl border-white/10 bg-[hsl(var(--surface-3))] p-1.5">
                    <TabsTrigger value="magic-link" className="h-11 rounded-xl">
                      <LinkIcon className="h-4 w-4" />
                      Link magico
                    </TabsTrigger>
                    <TabsTrigger value="verification-code" className="h-11 rounded-xl">
                      <KeyRound className="h-4 w-4" />
                      CPF/CNPJ + codigo
                    </TabsTrigger>
                  </TabsList>

                  <TabsContent value="magic-link">
                    <form onSubmit={handleMagicLinkSubmit} className="space-y-5">
                      <div className="rounded-2xl border border-emerald-400/15 bg-emerald-400/[0.06] px-4 py-4 text-sm leading-6 text-emerald-50">
                        Enviaremos um link de acesso temporario para o seu e-mail ou telefone cadastrado.
                      </div>

                      <div className="space-y-2">
                        <Label htmlFor="magic-identifier">E-mail ou celular cadastrado</Label>
                        <Input
                          id="magic-identifier"
                          value={magicIdentifier}
                          onChange={(event) => setMagicIdentifier(event.target.value)}
                          placeholder="nome@exemplo.com ou (11) 99999-9999"
                        />
                      </div>

                      <Button type="submit" variant="success" className="w-full" size="lg">
                        <ArrowRight className="h-4 w-4" />
                        Enviar link de acesso
                      </Button>
                    </form>
                  </TabsContent>

                  <TabsContent value="verification-code">
                    <form onSubmit={handleVerificationSubmit} className="space-y-5">
                      <div className="grid gap-5 sm:grid-cols-2">
                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="document">CPF ou CNPJ</Label>
                          <Input
                            id="document"
                            value={documentValue}
                            onChange={(event) => setDocumentValue(event.target.value)}
                            placeholder="Digite apenas números ou com pontuação"
                          />
                        </div>

                        <div className="space-y-2 sm:col-span-2">
                          <Label htmlFor="verification-code">Codigo de verificacao</Label>
                          <Input
                            id="verification-code"
                            value={verificationCode}
                            onChange={(event) => setVerificationCode(event.target.value)}
                            placeholder="Informe o codigo recebido"
                          />
                        </div>
                      </div>

                      <div className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-2))] px-4 py-4 text-sm leading-6 text-slate-300">
                        Use o codigo enviado para seu canal cadastrado. {normalizedDocument.length > 0 ? 'Documento identificado para validacao segura.' : 'Informe seu CPF ou CNPJ para continuar.'}
                      </div>

                      <div className="flex flex-col gap-3 sm:flex-row">
                        <Button type="button" variant="outline" className="flex-1" disabled>
                          Solicitar codigo
                        </Button>
                        <Button type="submit" variant="success" className="flex-1">
                          <CheckCircle2 className="h-4 w-4" />
                          Validar e entrar
                        </Button>
                      </div>
                    </form>
                  </TabsContent>
                </Tabs>

                <div className="rounded-2xl border border-white/8 bg-[hsl(var(--surface-2))] px-4 py-4 text-sm leading-6 text-slate-400">
                  Se precisar de ajuda, fale com o time responsável pela campanha. Seus dados são utilizados somente para validar o acesso.
                </div>
              </CardContent>
            </Card>
          </section>
        </div>
      </div>
    </div>
  )
}
