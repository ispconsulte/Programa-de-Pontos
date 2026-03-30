import { Link, useLocation } from 'react-router-dom'
import {
  Bell,
  Camera,
  ChevronDown,
  ChevronRight,
  Coins,
  Gift,
  Home,
  LayoutDashboard,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sparkles,
  Sun,
  Users,
  Wrench,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import logoBonifica from '@/assets/logo-bonifica.png'
import { logout } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase-client'

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
          { href: '/cliente-em-dia', label: 'Cliente em Dia', icon: Gift },
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
  '/cliente-em-dia': 'Cliente em Dia',
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
            'group relative flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200',
            isChildActive
              ? 'bg-primary/[0.08] text-white'
              : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'
          )}
        >
          {isChildActive && (
            <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
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
          <div className="ml-[22px] mt-1 space-y-1 border-l border-white/[0.06] pl-3">
            {item.children!.map(child => {
              const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
              return (
                <Link
                  key={child.href}
                  to={child.href}
                  onClick={onNavigate}
                  className={cn(
                    'flex items-center gap-2 rounded-lg px-2.5 py-2 text-[12.5px] font-medium transition-all duration-200',
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
        'group relative flex items-center gap-3 rounded-xl px-3 py-2.5 transition-all duration-200',
        isActive
          ? 'bg-primary/[0.08] text-white'
          : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground'
      )}
    >
      {isActive && (
        <div className="absolute left-0 top-1/2 h-5 w-[3px] -translate-y-1/2 rounded-r-full bg-primary" />
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
  const [searchTerm, setSearchTerm] = useState('')
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark'
    const savedTheme = window.localStorage.getItem('bonifica-theme')
    return savedTheme === 'light' ? 'light' : 'dark'
  })
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem('bonifica-avatar')
  })
  const [profile, setProfile] = useState({ name: 'Usuário', email: 'Sem e-mail' })
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  const closeSidebar = () => setSidebarOpen(false)

  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('light', theme === 'light')
    root.style.colorScheme = theme
    window.localStorage.setItem('bonifica-theme', theme)
  }, [theme])

  useEffect(() => {
    let mounted = true

    const applySessionProfile = async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return

      const user = data.session?.user
      const metadata = user?.user_metadata ?? {}
      const derivedName =
        metadata.full_name ||
        metadata.name ||
        metadata.display_name ||
        user?.email?.split('@')[0] ||
        'Usuário'

      setProfile({
        name: String(derivedName),
        email: user?.email || 'Sem e-mail',
      })
    }

    applySessionProfile()

    const { data: subscription } = supabase.auth.onAuthStateChange((_event, session) => {
      const user = session?.user
      const metadata = user?.user_metadata ?? {}
      const derivedName =
        metadata.full_name ||
        metadata.name ||
        metadata.display_name ||
        user?.email?.split('@')[0] ||
        'Usuário'

      setProfile({
        name: String(derivedName),
        email: user?.email || 'Sem e-mail',
      })
    })

    return () => {
      mounted = false
      subscription.subscription.unsubscribe()
    }
  }, [])

  const filteredNavGroups = useMemo(() => {
    const normalizedSearch = searchTerm.trim().toLowerCase()

    if (!normalizedSearch) return navGroups

    return navGroups
      .map((group) => {
        const items = group.items
          .map((item) => {
            const matchesParent = item.label.toLowerCase().includes(normalizedSearch)
            const children = item.children?.filter((child) =>
              child.label.toLowerCase().includes(normalizedSearch)
            )

            if (matchesParent) return item
            if (children?.length) return { ...item, children }
            return null
          })
          .filter((item): item is NavItem => item !== null)

        return { ...group, items }
      })
      .filter((group) => group.items.length > 0)
  }, [searchTerm])

  const handleLogout = async () => {
    await logout()
  }

  const triggerAvatarUpload = () => {
    fileInputRef.current?.click()
  }

  const handleAvatarChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0]
    if (!file) return

    const reader = new FileReader()
    reader.onload = () => {
      const result = typeof reader.result === 'string' ? reader.result : null
      setAvatarUrl(result)
      if (result) {
        window.localStorage.setItem('bonifica-avatar', result)
      }
    }
    reader.readAsDataURL(file)
  }

  const profileInitial = profile.name.trim().charAt(0).toUpperCase() || 'U'

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {sidebarOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/70 backdrop-blur-sm lg:hidden"
          onClick={closeSidebar}
        />
      )}

      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[288px] flex-col border-r border-white/[0.06] bg-[linear-gradient(180deg,hsl(var(--sidebar)),hsl(var(--surface-1)))] transition-transform duration-300 ease-in-out lg:relative lg:z-auto lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        <div className="relative flex flex-shrink-0 flex-col items-center justify-center overflow-hidden border-b border-white/[0.06] px-5 py-6">
          <div className="absolute inset-x-6 top-0 h-px bg-gradient-to-r from-transparent via-primary/40 to-transparent" />
          <div className="absolute inset-x-10 bottom-0 h-20 rounded-full bg-primary/10 blur-3xl" />
          <div className="relative z-10 flex h-24 w-24 items-center justify-center rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,hsl(var(--surface-1)),hsl(var(--surface-2)))] p-4 shadow-[0_20px_40px_rgba(0,0,0,0.22)]">
            <div className="absolute inset-2 rounded-[22px] border border-primary/10" />
            <img src={logoBonifica} alt="Bonifica" className="relative h-16 w-16 object-contain" />
          </div>
          <div className="relative z-10 mt-4 text-center">
            <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-primary/80">Bonifica</p>
            <p className="mt-1 text-sm font-semibold text-foreground">Programa de Pontos</p>
            <p className="mt-1 text-[12px] text-muted-foreground">Cliente em Dia 2026</p>
          </div>
          <button
            onClick={closeSidebar}
            className="absolute right-4 top-4 rounded-md p-1 text-muted-foreground transition-colors hover:text-white lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-4 pt-4">
          <label className="group flex items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.03] px-3 py-3 transition-colors focus-within:border-primary/40 focus-within:bg-white/[0.05]">
            <Search className="h-4 w-4 text-muted-foreground transition-colors group-focus-within:text-primary" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Buscar menu"
              className="h-6 w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
            />
          </label>
        </div>

        <nav className="flex-1 overflow-y-auto scrollable-content px-3 py-5">
          <div className="space-y-6">
            {filteredNavGroups.map((group) => (
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
            {filteredNavGroups.length === 0 && (
              <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-6 text-center">
                <p className="text-sm font-medium text-foreground">Nenhum item encontrado</p>
                <p className="mt-1 text-xs text-muted-foreground">Tente outro termo na busca do menu.</p>
              </div>
            )}
          </div>
        </nav>

        <div className="flex-shrink-0 space-y-3 border-t border-white/[0.06] p-3">
          <div className="rounded-2xl border border-white/10 bg-gradient-to-br from-white/[0.04] to-white/[0.02] p-3.5 shadow-[0_12px_30px_rgba(0,0,0,0.18)]">
            <div className="flex items-start gap-3">
              <div className="flex-shrink-0">
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={profile.name}
                    className="h-14 w-14 rounded-2xl object-cover ring-1 ring-white/10"
                  />
                ) : (
                  <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-primary/30 to-primary/10 text-lg font-bold text-primary ring-1 ring-primary/20">
                    {profileInitial}
                  </div>
                )}
              </div>
              <div className="min-w-0 flex-1">
                <div className="flex items-start justify-between gap-3">
                  <div className="min-w-0">
                    <p className="truncate text-sm font-semibold leading-tight text-foreground">{profile.name}</p>
                    <p className="mt-1 truncate text-[11px] leading-tight text-muted-foreground">{profile.email}</p>
                  </div>
                  <button
                    type="button"
                    onClick={triggerAvatarUpload}
                    className="flex h-9 w-9 flex-shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03] text-muted-foreground transition-colors hover:bg-white/[0.06] hover:text-foreground"
                    aria-label="Alterar foto"
                  >
                    <Camera className="h-3.5 w-3.5" />
                  </button>
                </div>
                <div className="mt-3 flex items-center justify-between gap-2">
                  <div className="inline-flex min-w-0 items-center gap-1.5 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.12em] text-primary">
                    <Sparkles className="h-3 w-3 flex-shrink-0" />
                    <span className="truncate">Ambiente Bonifica</span>
                  </div>
                </div>
              </div>
            </div>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleAvatarChange}
              className="hidden"
            />
          </div>

          <button
            type="button"
            onClick={() => setTheme((currentTheme) => currentTheme === 'dark' ? 'light' : 'dark')}
            className="flex w-full items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-3.5 py-3 text-sm font-medium text-foreground transition-colors hover:bg-white/[0.05]"
          >
            <span className="flex min-w-0 items-center gap-2.5">
              <span className="flex h-8 w-8 flex-shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
                {theme === 'dark' ? <Moon className="h-4 w-4" /> : <Sun className="h-4 w-4" />}
              </span>
              <span className="truncate">{theme === 'dark' ? 'Tema escuro' : 'Tema claro'}</span>
            </span>
            <span className="rounded-full border border-white/10 px-2 py-1 text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
              alternar
            </span>
          </button>

          <button
            onClick={handleLogout}
            className="flex w-full items-center gap-2.5 rounded-2xl px-3.5 py-3 text-[13px] font-medium text-muted-foreground transition-all duration-200 hover:bg-destructive/[0.08] hover:text-destructive"
          >
            <span className="flex h-8 w-8 items-center justify-center rounded-xl border border-white/10 bg-white/[0.03]">
              <LogOut className="h-3.5 w-3.5" />
            </span>
            <span>Sair</span>
          </button>
        </div>
      </aside>

      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        <header className="flex h-auto flex-shrink-0 flex-col gap-3 border-b border-white/[0.06] bg-[hsl(var(--surface-1))] px-4 py-3 lg:h-16 lg:flex-row lg:items-center lg:justify-between lg:px-6 lg:py-0">
          <div className="flex min-w-0 items-center gap-3">
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

          <div className="flex w-full items-center gap-2 lg:w-auto">
            <label className="flex h-11 min-w-0 flex-1 items-center gap-3 rounded-xl border border-white/10 bg-background/60 px-3 lg:w-[320px] lg:flex-none">
              <Search className="h-4 w-4 text-muted-foreground" />
              <input
                value={searchTerm}
                onChange={(event) => setSearchTerm(event.target.value)}
                placeholder="Buscar páginas e atalhos"
                className="w-full bg-transparent text-sm text-foreground outline-none placeholder:text-muted-foreground"
              />
            </label>
            <button className="relative flex h-11 w-11 items-center justify-center rounded-xl border border-white/10 text-muted-foreground transition-colors hover:bg-white/[0.05] hover:text-foreground">
              <Bell className="h-4 w-4" />
              <span className="absolute right-3.5 top-3.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scrollable-content bg-background">
          <div className="page-shell">
            {children}
          </div>
        </main>
      </div>
    </div>
  )
}
