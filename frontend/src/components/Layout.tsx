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
  Users,
  X,
} from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
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
    label: '',
    items: [
      { href: '/dashboard', label: 'Início', icon: Home },
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
    label: '',
    items: [
      { href: '/settings', label: 'Configurações', icon: Settings },
    ],
  },
]

const pageTitles: Record<string, string> = {
  '/dashboard': 'Início',
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
            'group flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-left transition-all duration-150',
            active
              ? 'bg-white/[0.06] text-foreground'
              : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground/90'
          )}
        >
          <Icon className={cn('h-[15px] w-[15px] flex-shrink-0', active ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-muted-foreground')} />
          <span className="flex-1 text-[13px] font-medium">{item.label}</span>
          {open
            ? <ChevronDown className="h-3 w-3 text-muted-foreground/50" />
            : <ChevronRight className="h-3 w-3 text-muted-foreground/50" />}
        </button>
        {open && (
          <div className="ml-[15px] mt-0.5 space-y-px border-l border-white/[0.05] pl-2.5">
            {item.children!.map(child => {
              const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
              return (
                <Link
                  key={child.href}
                  to={child.href}
                  onClick={onNav}
                  className={cn(
                    'block rounded-md px-2.5 py-[6px] text-[12.5px] font-medium transition-all duration-150',
                    childActive
                      ? 'bg-primary/[0.1] text-primary'
                      : 'text-muted-foreground/70 hover:bg-white/[0.03] hover:text-foreground/80'
                  )}
                >
                  {child.label}
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
      onClick={onNav}
      className={cn(
        'group flex items-center gap-2.5 rounded-lg px-2.5 py-[7px] transition-all duration-150',
        isActive
          ? 'bg-white/[0.06] text-foreground'
          : 'text-muted-foreground hover:bg-white/[0.04] hover:text-foreground/90'
      )}
    >
      {isActive && (
        <div className="absolute left-0 h-4 w-[2px] rounded-r-full bg-primary" />
      )}
      <Icon className={cn('h-[15px] w-[15px] flex-shrink-0', isActive ? 'text-primary' : 'text-muted-foreground/70 group-hover:text-muted-foreground')} />
      <span className="text-[13px] font-medium">{item.label}</span>
    </Link>
  )
}

/* ── Layout ── */
export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()
  const [sidebarOpen, setSidebarOpen] = useState(false)
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

  const filteredSections = useMemo(() => {
    const q = searchTerm.trim().toLowerCase()
    if (!q) return navSections
    return navSections
      .map(s => ({
        ...s,
        items: s.items.filter(i =>
          i.label.toLowerCase().includes(q) ||
          i.children?.some(c => c.label.toLowerCase().includes(q))
        ),
      }))
      .filter(s => s.items.length > 0)
  }, [searchTerm])

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
          'fixed inset-y-0 left-0 z-50 flex w-[252px] flex-col bg-[hsl(var(--sidebar))] transition-transform duration-300 ease-out lg:relative lg:z-auto lg:translate-x-0',
          sidebarOpen ? 'translate-x-0' : '-translate-x-full'
        )}
      >
        {/* ── Brand ── */}
        <div className="relative flex h-14 flex-shrink-0 items-center gap-3 border-b border-white/[0.05] px-4">
          <img
            src={logoBonifica}
            alt="Bonifica"
            className="h-7 w-7 flex-shrink-0"
            style={{
              objectFit: 'contain',
              background: 'transparent',
              mixBlendMode: 'normal',
              filter: 'drop-shadow(0 0 1px hsl(var(--primary) / 0.3))',
            }}
          />
          <div className="min-w-0">
            <p className="truncate text-[13px] font-semibold text-foreground">Bonifica</p>
          </div>
          <button onClick={closeSidebar} className="ml-auto rounded-md p-1 text-muted-foreground hover:text-foreground lg:hidden">
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* ── Navigation ── */}
        <nav className="flex-1 overflow-y-auto scrollable-content px-3 py-3">
          <div className="flex h-full flex-col justify-between">
            {/* Primary nav */}
            <div className="space-y-0.5">
              {(filteredSections[0]?.items ?? []).map(item => (
                <SidebarItem key={item.href} item={item} pathname={pathname} onNav={closeSidebar} />
              ))}
            </div>

            {/* Secondary nav (bottom-pinned) */}
            <div className="mt-4 space-y-0.5 border-t border-white/[0.04] pt-3">
              {(filteredSections[1]?.items ?? []).map(item => (
                <SidebarItem key={item.href} item={item} pathname={pathname} onNav={closeSidebar} />
              ))}
            </div>
          </div>
        </nav>

        {/* ── Footer ── */}
        <div className="flex-shrink-0 border-t border-white/[0.05] p-3">
          <button
            onClick={() => logout()}
            className="flex w-full items-center gap-2.5 rounded-lg px-2.5 py-[7px] text-[12.5px] font-medium text-muted-foreground transition-all duration-150 hover:bg-destructive/[0.08] hover:text-destructive"
          >
            <LogOut className="h-[15px] w-[15px]" />
            <span>Sair</span>
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="flex h-14 flex-shrink-0 items-center justify-between border-b border-white/[0.05] bg-[hsl(var(--surface-1))] px-4 lg:px-6">
          <div className="flex items-center gap-3">
            <button onClick={() => setSidebarOpen(true)} className="rounded-md p-1.5 text-muted-foreground hover:text-foreground lg:hidden">
              <Menu className="h-5 w-5" />
            </button>
            {/* Breadcrumb */}
            <div className="hidden items-center gap-1.5 text-[13px] lg:flex">
              <span className="text-muted-foreground/60">Bonifica</span>
              <span className="text-muted-foreground/30">/</span>
              <span className="font-medium text-foreground">{getPageTitle(pathname)}</span>
            </div>
            {/* Mobile title */}
            <div className="flex items-center gap-2 lg:hidden">
              <img src={logoBonifica} alt="Logo" className="h-5 w-5 object-contain" />
              <span className="text-[13px] font-semibold text-foreground">{getPageTitle(pathname)}</span>
            </div>
          </div>

          {/* ── Right actions ── */}
          <div className="flex items-center gap-1">
            {/* Search (desktop) */}
            <label className="hidden items-center gap-2 rounded-lg border border-white/[0.06] bg-white/[0.02] px-2.5 py-1.5 transition-colors focus-within:border-primary/30 focus-within:bg-white/[0.04] lg:flex">
              <Search className="h-3.5 w-3.5 text-muted-foreground/50" />
              <input
                placeholder="Buscar…"
                className="w-36 bg-transparent text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground/40"
              />
            </label>

            <div className="mx-1 hidden h-5 w-px bg-white/[0.06] lg:block" />

            {/* Notifications */}
            <button className="relative flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground">
              <Bell className="h-[15px] w-[15px]" />
              <span className="absolute right-2 top-1.5 h-1.5 w-1.5 rounded-full bg-primary" />
            </button>

            {/* Theme toggle */}
            <button
              onClick={() => setTheme(t => t === 'dark' ? 'light' : 'dark')}
              className="flex h-8 w-8 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-white/[0.04] hover:text-foreground"
              title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            >
              {theme === 'dark' ? <Moon className="h-[15px] w-[15px]" /> : <Sun className="h-[15px] w-[15px]" />}
            </button>

            <div className="mx-1 h-5 w-px bg-white/[0.06]" />

            {/* User avatar */}
            <button
              onClick={() => fileInputRef.current?.click()}
              className="relative flex h-8 w-8 items-center justify-center rounded-lg transition-colors hover:bg-white/[0.04]"
              title={profile.name}
            >
              {avatarUrl ? (
                <img src={avatarUrl} alt={profile.name} className="h-7 w-7 rounded-md object-cover" />
              ) : (
                <div className="flex h-7 w-7 items-center justify-center rounded-md bg-primary/15 text-[11px] font-bold text-primary">
                  {initial}
                </div>
              )}
            </button>
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
