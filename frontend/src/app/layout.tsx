import type { Metadata } from 'next'
import { Manrope, Sora } from 'next/font/google'
import './globals.css'

const manrope = Manrope({
  subsets: ['latin'],
  variable: '--font-manrope',
})

const sora = Sora({
  subsets: ['latin'],
  variable: '--font-sora',
})

export const metadata: Metadata = {
  title: 'Programa de Pontos',
  description: 'Programa de Pontos — Gestão de bonificações e pontuação',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="pt-BR">
      <body className={`${manrope.variable} ${sora.variable} min-h-screen bg-background text-foreground antialiased`}>
        {children}
      </body>
    </html>
  )
}
