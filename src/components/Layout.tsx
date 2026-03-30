import { Link, useLocation } from 'react-router-dom'
import {
  ChevronDown,
  ChevronRight,
  Coins,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Settings,
  Trophy,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { useState } from 'react'
import { logout } from '@/lib/auth-client'
import { cn } from '@/lib/utils'

interface LayoutProps {
  children: React.ReactNode
}

interface NavGroup {
  label: string
  items: NavItem[]
}

interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  children?: { href: string; label: string; icon: React.ElementType }[]
}

const navGroups: NavGroup[] = [
  {
    label: 'PRINCIPAL',
    items: [
      { href: '/dashboard', label: 'Página Inicial', icon: Home },
    ],
  },
  {
    label: 'GESTÃO',
    items: [
      {
        href: '/clients',
        label: 'Gestão',
        icon: LayoutDashboard,
        children: [
          { href: '/clients', label: 'Clientes', icon: Users },
        ],
      },
    ],
  },
  {
    label: 'FERRAMENTAS',
    items: [
      {
        href: '/receivables',
        label: 'Ferramentas',
        icon: Wrench,
        children: [
          { href: '/receivables', label: 'Pontuação', icon: Coins },
        ],
      },
    ],
  },
  {
    label: 'ADMINISTRAÇÃO',
    items: [
      {
        href: '/settings',
        label: 'Painel Admin',
        icon: Settings,
        children: [
          { href: '/settings', label: 'Ajustes', icon: Settings },
        ],
      },
    ],
  },
]

function NavItemComponent({ item, pathname, onNavigate }: { item: NavItem; pathname: string; onNavigate: () => void }) {
  const hasChildren = item.children && item.children.length > 0
  const isChildActive = hasChildren && item.children!.some(c => pathname === c.href || pathname.startsWith(c.href + '/'))
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const [open, setOpen] = useState(isChildActive || isActive)

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-150',
            isChildActive
              ? 'bg-primary/[0.12] text-white'
              : 'text-muted-foreground hover:bg-white/[0.05] hover:text-white'
          )}
        >
          {isChildActive && (
            <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
          )}
          <item.icon className={cn('h-[18px] w-[18px] flex-shrink-0', isChildActive ? 'text-primary' : 'group-hover:text-white')} />
          <span className="flex-1 text-[13px] font-medium">{item.label}</span>
          {open ? <ChevronDown className="h-4 w-4 text-muted-foreground" /> : <ChevronRight className="h-4 w-4 text-muted-foreground" />}
        </button>
        {open && (
          <div className="ml-4 mt-1 space-y-0.5 border-l border-white/[0.06] pl-3">
            {item.children!.map(child => {
              const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
              return (
                <Link
                  key={child.href}
                  to={child.href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2.5 rounded-lg px-3 py-2 text-[12.5px] font-medium transition-all duration-150',
                    childActive
                      ? 'bg-primary/20 text-white'
                      : 'text-muted-foreground hover:bg-white/[0.05] hover:text-white'
                  )}
                >
                  <child.icon className={cn('h-4 w-4 flex-shrink-0', childActive ? 'text-primary' : '')} />
                  <span>{child.label}</span>
                </Link>
              )
            })}
          </div>
        )}
      </div>
    )
  }

  return (
    <Link
      to={item.href}
      onClick={onNavigate}
      className={cn(
        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-150',
        isActive
          ? 'bg-primary/[0.12] text-white'
          : 'text-muted-foreground hover:bg-white/[0.05] hover:text-white'
      )}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
      )}
      <item.icon className={cn('h-[18px] w-[18px] flex-shrink-0', isActive ? 'text-primary' : 'group-hover:text-white')} />
      <span className="text-[13px] font-medium">{item.label}</span>
    </Link>
  )
}

export default function Layout({ children }: LayoutProps) {
  const { pathname } = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)

  const handleLogout = async () => {
    await logout()
  }

  const closeSidebar = () => setSidebarOpen(false)

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[260px] flex-col bg-[hsl(222,44%,4.5%)] transition-all duration-300 ease-in-out lg:relative lg:z-auto lg:translate-x-0',
          sidebarOpen ? 'translate-x-0 shadow-2xl shadow-black/40' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-[72px] flex-shrink-0 items-center gap-3 border-b border-white/[0.06] px-5">
          <div className="flex h-10 w-10 flex-shrink-0 items-center justify-center rounded-xl bg-primary/15 animate-float">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <p className="truncate text-[15px] font-bold tracking-tight text-white">Programa</p>
            <p className="truncate text-[15px] font-bold tracking-tight text-white">de Pontos</p>
          </div>
          <button
            onClick={closeSidebar}
            className="ml-auto rounded-lg p-1.5 text-muted-foreground transition-colors hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollable-content px-3 py-4">
          <div className="space-y-5">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/50">
                  {group.label}
                </p>
                <div className="space-y-0.5">
                  {group.items.map((item) => (
                    <NavItemComponent
                      key={item.href + item.label}
                      item={item}
                      pathname={pathname}
                      onNavigate={closeSidebar}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* User + Logout */}
        <div className="flex-shrink-0 border-t border-white/[0.06] px-4 py-4 space-y-3">
          <div className="flex items-center gap-3 px-1">
            <div className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-full bg-primary/20 text-[13px] font-bold text-primary">
              U
            </div>
            <div className="min-w-0">
              <p className="truncate text-[13px] font-semibold text-white">Usuário</p>
              <p className="truncate text-[11px] text-muted-foreground/70">usuario@email.com</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-all duration-200 hover:bg-white/[0.05] hover:text-white"
          >
            <LogOut className="h-4 w-4" />
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
