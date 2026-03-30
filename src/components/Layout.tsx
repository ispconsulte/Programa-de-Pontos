import { Link, useLocation } from 'react-router-dom'
import {
  Bell,
  ChevronDown,
  ChevronRight,
  Coins,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Search,
  Settings,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import logoBonifica from '@/assets/logo-bonifica.png'
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

const pageTitles: Record<string, string> = {
  '/dashboard': 'Página Inicial',
  '/clients': 'Clientes',
  '/receivables': 'Pontuação',
  '/settings': 'Ajustes',
}

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
            'group relative flex w-full items-center gap-3 rounded-lg px-3 py-2 text-left transition-all duration-200',
            isChildActive
              ? 'bg-primary/[0.08] text-white'
              : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'
          )}
        >
          {isChildActive && (
            <div className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-primary" />
          )}
          <item.icon className={cn(
            'h-4 w-4 flex-shrink-0 transition-colors',
            isChildActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
          )} />
          <span className="flex-1 text-[13px] font-medium">{item.label}</span>
          {open
            ? <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/60" />
            : <ChevronRight className="h-3.5 w-3.5 text-muted-foreground/60" />
          }
        </button>
        {open && (
          <div className="ml-[22px] mt-0.5 space-y-0.5 border-l border-white/[0.06] pl-3">
            {item.children!.map(child => {
              const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
              return (
                <Link
                  key={child.href}
                  to={child.href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2 rounded-md px-2.5 py-1.5 text-[12.5px] font-medium transition-all duration-200',
                    childActive
                      ? 'bg-primary/[0.12] text-white'
                      : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'
                  )}
                >
                  <child.icon className={cn('h-3.5 w-3.5 flex-shrink-0', childActive ? 'text-primary' : '')} />
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
        'group relative flex items-center gap-3 rounded-lg px-3 py-2 transition-all duration-200',
        isActive
          ? 'bg-primary/[0.08] text-white'
          : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'
      )}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 h-4 w-[2px] -translate-y-1/2 rounded-r-full bg-primary" />
      )}
      <item.icon className={cn(
        'h-4 w-4 flex-shrink-0 transition-colors',
        isActive ? 'text-primary' : 'text-muted-foreground group-hover:text-foreground'
      )} />
      <span className="text-[13px] font-medium">{item.label}</span>
    </Link>
  )
}

function getPageTitle(pathname: string): string {
  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname === path || pathname.startsWith(path + '/')) return title
  }
  return 'Painel'
}

export default function Layout({ children }: LayoutProps) {
  const { pathname } = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const closeSidebar = () => setSidebarOpen(false)

  const handleLogout = async () => {
    await logout()
  }

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
        />
      )}

      {/* Sidebar */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col border-r border-white/[0.06] bg-[hsl(var(--sidebar))] transition-transform duration-300 ease-in-out lg:relative lg:z-auto lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* Logo */}
        <div className="flex h-16 flex-shrink-0 items-center gap-3 border-b border-white/[0.06] px-5">
          <img src={logoBonifica} alt="Logo" className="h-9 w-9 flex-shrink-0 object-contain" />
          <div className="min-w-0">
            <p className="truncate text-sm font-bold tracking-tight text-white">Programa de Pontos</p>
            <p className="truncate text-[10px] font-medium text-muted-foreground">Gestão de bônus</p>
          </div>
          <button
            onClick={closeSidebar}
            className="ml-auto rounded-md p-1 text-muted-foreground transition-colors hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 overflow-y-auto scrollable-content px-3 py-5">
          <div className="space-y-6">
            {navGroups.map((group) => (
              <div key={group.label}>
                <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/40">
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
        <div className="flex-shrink-0 border-t border-white/[0.06] p-3 space-y-2">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-full bg-gradient-to-br from-primary/30 to-primary/10 text-[11px] font-bold text-primary ring-1 ring-primary/20">
              U
            </div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-[12.5px] font-semibold text-white">Usuário</p>
              <p className="truncate text-[10.5px] text-muted-foreground">usuario@email.com</p>
            </div>
          </div>
          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2 rounded-lg px-3 py-2 text-[12.5px] font-medium text-muted-foreground transition-all duration-200 hover:bg-destructive/[0.08] hover:text-destructive"
          >
            <LogOut className="h-3.5 w-3.5" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* Main */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Top bar */}
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-white/[0.06] bg-[hsl(var(--surface-1))] px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setSidebarOpen(true)}
              className="rounded-lg p-2 text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-white lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden items-center gap-2 text-sm lg:flex">
              <span className="text-muted-foreground">Programa de Pontos</span>
              <span className="text-muted-foreground/40">/</span>
              <span className="font-medium text-foreground">{getPageTitle(pathname)}</span>
            </div>
            <div className="flex items-center gap-2 lg:hidden">
              <img src={logoBonifica} alt="Logo" className="h-5 w-5 object-contain" />
              <span className="text-sm font-semibold text-white">{getPageTitle(pathname)}</span>
            </div>
          </div>

          <div className="flex items-center gap-2">
            <button className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground">
              <Search className="h-4 w-4" />
            </button>
            <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>
          </div>
        </header>

        {/* Page content */}
        <main className="flex-1 overflow-y-auto scrollable-content bg-background">
          <div className="mx-auto max-w-[1440px] px-4 py-6 sm:px-6 lg:px-8 lg:py-8">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
