import { Link, useLocation } from 'react-router-dom'
import {
  Bell,
  Camera,
  ChevronDown,
  ChevronRight,
  Coins,
  Gift,
  Home,
  LogOut,
  Menu,
  Moon,
  Search,
  Settings,
  Sun,
  User,
  Users,
  X,
} from 'lucide-react'
import { useEffect, useRef, useState } from 'react'
import logoBonifica from '@/assets/logo-bonifica.png'
import { logout } from '@/lib/auth-client'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase-client'

/* ── Navigation config ── */
interface NavItem {
  href: string
  label: string
  icon: React.ElementType
  children?: { href: string; label: string }[]
}

interface NavSection {
  label: string
  items: NavItem[]
}

const navSections: NavSection[] = [
  {
    label: 'DASHBOARD',
    items: [
      { href: '/dashboard', label: 'Dashboard', icon: Home },
    ],
  },
  {
    label: 'GESTÃO',
    items: [
      { href: '/clients', label: 'Clientes', icon: Users },
      { href: '/receivables', label: 'Pontuação', icon: Coins },
      {
        href: '/cliente-em-dia',
        label: 'Cliente em Dia',
        icon: Gift,
        children: [
          { href: '/cliente-em-dia', label: 'Visão Geral' },
          { href: '/cliente-em-dia/resgates', label: 'Resgates' },
        ],
      },
    ],
  },
  {
    label: 'CONFIGURAÇÕES',
    items: [
      { href: '/settings', label: 'Configurações', icon: Settings },
    ],
  },
]

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/clients': 'Clientes',
  '/cliente-em-dia': 'Cliente em Dia',
  '/cliente-em-dia/resgates': 'Resgates',
  '/receivables': 'Pontuação',
  '/settings': 'Configurações',
}

function getPageTitle(pathname: string): string {
  for (const [path, title] of Object.entries(pageTitles)) {
    if (pathname === path || pathname.startsWith(path + '/')) return title
  }
  return 'Painel'
}

/* ── Nav item component ── */
function SidebarItem({
  item,
  pathname,
  onNav,
}: {
  item: NavItem
  pathname: string
  onNav: () => void
}) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const hasChildren = !!item.children?.length
  const isChildActive = hasChildren && item.children!.some(c => pathname === c.href || pathname.startsWith(c.href + '/'))
  const [open, setOpen] = useState(isActive || isChildActive)

  const Icon = item.icon
  const active = isActive || isChildActive

  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'group flex w-full items-center gap-3 rounded-lg px-3 py-[9px] text-left transition-all duration-150',
            active
              ? 'text-foreground'
              : 'text-muted-foreground hover:text-foreground/90'
          )}
        >
          <Icon className={cn('h-[18px] w-[18px] flex-shrink-0', active ? 'text-primary' : 'text-muted-foreground/50')} />
          <span className="flex-1 text-[13.5px] font-medium">{item.label}</span>
          <div className={cn('transition-transform duration-200', open && 'rotate-180')}>
            <ChevronDown className="h-3.5 w-3.5 text-muted-foreground/30" />
          </div>
        </button>
        <div className={cn(
          'ml-[18px] mt-0.5 space-y-0.5 border-l border-[hsl(var(--border))] pl-4 transition-all duration-200',
          open ? 'max-h-40 opacity-100' : 'max-h-0 overflow-hidden opacity-0'
        )}>
          {item.children!.map(child => {
            const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
            return (
              <Link
                key={child.href}
                to={child.href}
                onClick={onNav}
                className={cn(
                  'block rounded-md px-3 py-[7px] text-[13px] font-medium transition-all duration-150',
                  childActive
                    ? 'text-primary'
                    : 'text-muted-foreground/50 hover:text-foreground/80'
                )}
              >
                {child.label}
              </Link>
            )
          })}
        </div>
      </div>
    )
  }

  return (
    <Link
      to={item.href}
      onClick={onNav}
      className={cn(
        'group flex items-center gap-3 rounded-lg px-3 py-[9px] transition-all duration-150',
        isActive
          ? 'text-foreground'
          : 'text-muted-foreground hover:text-foreground/90'
      )}
    >
      <Icon className={cn('h-[18px] w-[18px] flex-shrink-0', isActive ? 'text-primary' : 'text-muted-foreground/50')} />
      <span className="text-[13.5px] font-medium">{item.label}</span>
    </Link>
  )
}

/* ── Layout ── */
export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement | null>(null)
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark'
    return window.localStorage.getItem('bonifica-theme') === 'light' ? 'light' : 'dark'
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
    const apply = async () => {
      const { data } = await supabase.auth.getSession()
      if (!mounted) return
      const user = data.session?.user
      const m = user?.user_metadata ?? {}
      setProfile({
        name: String(m.full_name || m.name || m.display_name || user?.email?.split('@')[0] || 'Usuário'),
        email: user?.email || 'Sem e-mail',
      })
    }
    apply()
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      const user = session?.user
      const m = user?.user_metadata ?? {}
      setProfile({
        name: String(m.full_name || m.name || m.display_name || user?.email?.split('@')[0] || 'Usuário'),
        email: user?.email || 'Sem e-mail',
      })
    })
    return () => { mounted = false; sub.subscription.unsubscribe() }
  }, [])

  // Close user menu on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (userMenuRef.current && !userMenuRef.current.contains(e.target as Node)) {
        setUserMenuOpen(false)
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [])

  const handleAvatarChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0]
    if (!file) return
    const reader = new FileReader()
    reader.onload = () => {
      const r = typeof reader.result === 'string' ? reader.result : null
      setAvatarUrl(r)
      if (r) window.localStorage.setItem('bonifica-avatar', r)
    }
    reader.readAsDataURL(file)
  }

  const initial = profile.name.trim().charAt(0).toUpperCase() || 'U'

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* Mobile overlay */}
      {sidebarOpen && (
        <div className="fixed inset-0 z-40 bg-black/60 backdrop-blur-sm lg:hidden" onClick={closeSidebar} />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex w-[240px] flex-col border-r border-[hsl(var(--sidebar-border))] bg-[hsl(var(--sidebar))] transition-transform duration-300 ease-out lg:relative lg:z-auto lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* ── Brand ── */}
        <div className="flex h-[68px] flex-shrink-0 items-center justify-center px-5">
          <img
            src={logoBonifica}
            alt="Bonifica"
            className="h-14 w-14 flex-shrink-0"
            style={{
              objectFit: 'contain',
              filter: 'drop-shadow(0 0 8px hsl(var(--primary) / 0.3))',
            }}
          />
          <button onClick={closeSidebar} className="absolute right-3 rounded-md p-1 text-muted-foreground hover:text-foreground lg:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto scrollable-content px-4 pt-2 pb-4">
          <div className="space-y-6">
            {navSections.map((section, si) => (
              <div key={section.label || si}>
                {section.label && (
                  <p className="mb-2 px-3 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-muted-foreground/30">
                    {section.label}
                  </p>
                )}
                <div className="space-y-0.5">
                  {section.items.map(item => (
                    <SidebarItem key={item.href} item={item} pathname={pathname} onNav={closeSidebar} />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        {/* ── Footer ── */}
        <div className="flex-shrink-0 px-4 pb-4">
          <button
            onClick={() => logout()}
            className="group flex w-full items-center gap-3 rounded-lg px-3 py-[9px] text-[13.5px] font-medium text-muted-foreground/50 transition-all duration-150 hover:text-destructive"
          >
            <LogOut className="h-[18px] w-[18px] transition-colors group-hover:text-destructive" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-[52px] flex-shrink-0 items-center border-b border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] px-4 lg:px-5">
          {/* Left: mobile menu + user name */}
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            <div className="hidden items-center gap-2 lg:flex">
              <User className="h-4 w-4 text-muted-foreground/50" />
              <span className="text-[13px] font-medium text-foreground/90">{profile.name}</span>
            </div>
            {/* Mobile title */}
            <div className="flex items-center gap-2 lg:hidden">
              <span className="text-[13px] font-semibold text-foreground">{getPageTitle(pathname)}</span>
            </div>
          </div>

          {/* Center: search */}
          <div className="mx-auto hidden max-w-[400px] flex-1 px-8 lg:block">
            <label className="flex items-center gap-2.5 rounded-lg border border-[hsl(var(--border))] bg-[hsl(var(--surface-2))] px-3 py-[7px] transition-colors focus-within:border-primary/30 focus-within:bg-[hsl(var(--surface-3))]">
              <Search className="h-3.5 w-3.5 text-muted-foreground/40" />
              <input
                placeholder="Buscar páginas, clientes..."
                className="w-full bg-transparent text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground/35"
              />
            </label>
          </div>

          {/* Right: actions */}
          <div className="flex items-center gap-1">
            {/* Notifications */}
            <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[hsl(var(--muted))] hover:text-foreground">
              <Bell className="h-4 w-4" />
              <span className="absolute right-1.5 top-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[9px] font-bold text-primary-foreground">4</span>
            </button>

            {/* Theme toggle */}
            <button
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-[hsl(var(--muted))] hover:text-foreground"
              title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* User avatar + dropdown */}
            <div className="relative ml-1" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen(o => !o)}
                className="flex h-8 w-8 items-center justify-center rounded-full ring-2 ring-transparent transition-all hover:ring-primary/30"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={profile.name} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                    {initial}
                  </div>
                )}
              </button>

              {/* Dropdown */}
              {userMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-56 overflow-hidden rounded-xl border border-[hsl(var(--border))] bg-[hsl(var(--surface-1))] shadow-xl shadow-black/20">
                  {/* User info */}
                  <div className="border-b border-[hsl(var(--border))] px-4 py-3">
                    <p className="truncate text-[13px] font-medium text-foreground">{profile.name}</p>
                    <p className="truncate text-[11.5px] text-muted-foreground">{profile.email}</p>
                  </div>
                  {/* Menu items */}
                  <div className="p-1.5">
                    <button
                      onClick={() => { fileInputRef.current?.click(); setUserMenuOpen(false) }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
                    >
                      <Camera className="h-4 w-4" />
                      Alterar foto
                    </button>
                    <Link
                      to="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
                    >
                      <Settings className="h-4 w-4" />
                      Configurações
                    </Link>
                  </div>
                  {/* Logout */}
                  <div className="border-t border-white/[0.05] p-1.5">
                    <button
                      onClick={() => { logout(); setUserMenuOpen(false) }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-destructive/[0.06] hover:text-destructive"
                    >
                      <LogOut className="h-4 w-4" />
                      Sair
                    </button>
                  </div>
                </div>
              )}
            </div>
            <input ref={fileInputRef} type="file" accept="image/*" onChange={handleAvatarChange} className="hidden" />
          </div>
        </header>

        <main className="flex-1 overflow-y-auto scrollable-content bg-background">
          <div className="page-shell">{children}</div>
        </main>
      </div>
    </div>
  )
}
