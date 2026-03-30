import { Link, useLocation } from 'react-router-dom'
import {
  Coins,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Trophy,
  Users,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { logout } from '@/lib/auth-client'
import { cn } from '@/lib/utils'

interface LayoutProps {
  children: React.ReactNode
}

const navItems = [
  { href: '/dashboard', label: 'Painel', icon: LayoutDashboard },
  { href: '/receivables', label: 'Pontuação', icon: Coins },
  { href: '/clients', label: 'Clientes', icon: Users },
  { href: '/settings', label: 'Ajustes', icon: Settings },
]

export default function Layout({ children }: LayoutProps) {
  const { pathname } = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[220px] flex-col bg-[hsl(222,44%,4.5%)] transition-all duration-300 ease-in-out lg:relative lg:z-auto lg:translate-x-0',
          sidebarOpen ? 'translate-x-0 shadow-2xl shadow-black/40' : '-translate-x-full'
        )}
      >
        <div className="flex h-[60px] flex-shrink-0 items-center gap-3 border-b border-white/[0.06] px-5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/15 animate-float">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[13px] font-bold tracking-tight text-white">Programa de Pontos</p>
            <p className="text-[10px] font-medium text-muted-foreground/70">Gestão de bônus</p>
          </div>
          <button
            onClick={() => setSidebarOpen(false)}
            className="ml-auto rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <nav className="flex-1 overflow-y-auto px-3 py-5">
          <div className="space-y-1">
            {navItems.map((item) => {
              const Icon = item.icon
              const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
              return (
                <Link
                  key={item.href}
                  to={item.href}
                  onClick={() => setSidebarOpen(false)}
                  className={cn(
                    'group relative flex items-center gap-3 rounded-lg px-3 py-2.5 transition-all duration-150',
                    isActive
                      ? 'bg-primary/[0.12] text-white'
                      : 'text-muted-foreground hover:bg-white/[0.05] hover:text-white'
                  )}
                >
                  {isActive && (
                    <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
                  )}
                  <Icon className={cn(
                    'h-[18px] w-[18px] flex-shrink-0 transition-colors',
                    isActive ? 'text-primary' : 'group-hover:text-white'
                  )} />
                  <span className="text-[13px] font-medium">{item.label}</span>
                </Link>
              )
            })}
          </div>
        </nav>

        <div className="flex-shrink-0 border-t border-white/[0.06] px-3 py-3">
          <button
            onClick={handleLogout}
            className="flex w-full items-center justify-center gap-2.5 rounded-lg bg-red-500/[0.06] py-2.5 text-[13px] font-medium text-red-400/80 transition-all duration-200 hover:bg-red-500/[0.12] hover:text-red-400"
          >
            <LogOut className="h-[16px] w-[16px]" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-14 flex-shrink-0 items-center border-b border-white/[0.06] px-4 lg:hidden">
          <button
            onClick={() => setSidebarOpen(true)}
            className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-white"
          >
            <Menu className="h-5 w-5" />
          </button>
          <div className="ml-3 flex items-center gap-2">
            <Trophy className="h-4 w-4 text-primary" />
            <span className="text-sm font-semibold text-white">Programa de Pontos</span>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto">
          <div className="mx-auto max-w-[1600px] px-5 py-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
