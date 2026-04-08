import { Link, useLocation } from 'react-router-dom'
import {
  Camera,
  ChevronDown,
  ChevronsLeft,
  ChevronsRight,
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
import { useEffect, useMemo, useRef, useState } from 'react'
import AnimatedGiftBox from '@/components/AnimatedGiftBox'
import { cn } from '@/lib/utils'
import { supabase } from '@/lib/supabase-client'
import {
  clearCurrentUserProfileCache,
  fetchCurrentUserProfile,
  getCachedCurrentUserProfile,
  isAdminUiRole,
} from '@/lib/user-management'
import { clearCurrentTenantIdCache } from '@/lib/supabase-queries'

export type DashboardSearchType = 'name' | 'cpfCnpj' | 'id'
export const DASHBOARD_CLIENT_SEARCH_EVENT = 'dashboard:client-search'

/* ─── Nav data ─── */
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

const baseNavSections: NavSection[] = [
  {
    label: 'DASHBOARD',
    items: [{ href: '/dashboard', label: 'Dashboard', icon: Home }],
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
    items: [{
      href: '/settings',
        label: 'Configurações',
        icon: Settings,
        children: [
          { href: '/settings', label: 'Integrações' },
          { href: '/settings/campaigns', label: 'Campanhas' },
          { href: '/settings/users', label: 'Usuários' },
        ],
      }],
  },
]

const pageTitles: Record<string, string> = {
  '/dashboard': 'Dashboard',
  '/clients': 'Clientes',
  '/cliente-em-dia': 'Cliente em Dia',
  '/cliente-em-dia/resgates': 'Resgates',
  '/receivables': 'Pontuação',
  '/settings': 'Configurações',
  '/settings/campaigns': 'Campanhas',
  '/settings/users': 'Usuários',
}

function getPageTitle(pathname: string): string {
  const entries = Object.entries(pageTitles).sort((a, b) => b[0].length - a[0].length)
  for (const [path, title] of entries) {
    if (pathname === path || pathname.startsWith(path + '/')) return title
  }
  return 'Painel'
}

/* ─── Sidebar item ─── */
function SidebarItem({
  item,
  pathname,
  onNav,
  collapsed,
}: {
  item: NavItem
  pathname: string
  onNav: () => void
  collapsed?: boolean
}) {
  const isActive = pathname === item.href || pathname.startsWith(item.href + '/')
  const hasChildren = !!item.children?.length
  const isChildActive = hasChildren && item.children!.some((c) => pathname === c.href || pathname.startsWith(c.href + '/'))
  const [open, setOpen] = useState(isActive || isChildActive)

  useEffect(() => {
    if (isActive || isChildActive) setOpen(true)
  }, [isActive, isChildActive])

  const Icon = item.icon
  const active = isActive || isChildActive

  /* Collapsed with children → single icon link */
  if (hasChildren && collapsed) {
    return (
      <Link
        to={item.href}
        onClick={onNav}
        title={item.label}
        className={cn(
          'group flex items-center justify-center rounded-xl p-2.5 transition-all duration-200',
          active
            ? 'bg-primary/12 text-primary shadow-sm'
            : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
        )}
      >
        <Icon className="h-[18px] w-[18px] flex-shrink-0" />
      </Link>
    )
  }

  /* Expanded with children → accordion */
  if (hasChildren) {
    return (
      <div>
        <button
          onClick={() => setOpen(!open)}
          className={cn(
            'group flex w-full items-center gap-3 rounded-xl px-3 py-2.5 text-left transition-all duration-200',
            active
              ? 'bg-primary/12 text-primary shadow-sm'
              : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
          )}
        >
          <Icon className="h-[18px] w-[18px] flex-shrink-0" />
          <span className="flex-1 text-[13px] font-medium">{item.label}</span>
          <ChevronDown
            className={cn(
              'h-3.5 w-3.5 text-muted-foreground transition-transform duration-200',
              open && 'rotate-180'
            )}
          />
        </button>

        <div
          className={cn(
            'ml-[18px] mt-0.5 space-y-0.5 overflow-hidden border-l border-border pl-3.5 transition-all duration-200',
            open ? 'max-h-40 opacity-100' : 'max-h-0 opacity-0'
          )}
        >
          {item.children!.map((child) => {
            const childActive = pathname === child.href || pathname.startsWith(child.href + '/')
            return (
              <Link
                key={child.href}
                to={child.href}
                onClick={onNav}
                className={cn(
                  'block rounded-lg px-3 py-2 text-[12.5px] font-medium transition-all duration-150',
                  childActive
                    ? 'bg-primary/10 text-primary'
                    : 'text-muted-foreground hover:bg-muted/50 hover:text-foreground'
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

  /* Simple item */
  return (
    <Link
      to={item.href}
      onClick={onNav}
      title={collapsed ? item.label : undefined}
      className={cn(
        'group flex items-center rounded-xl transition-all duration-200',
        collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5',
        isActive
          ? 'bg-primary/12 text-primary shadow-sm'
          : 'text-muted-foreground hover:bg-muted/70 hover:text-foreground'
      )}
    >
      <Icon className="h-[18px] w-[18px] flex-shrink-0" />
      {!collapsed && <span className="text-[13px] font-medium">{item.label}</span>}
    </Link>
  )
}

/* ─── Main Layout ─── */
export default function Layout({ children }: { children: React.ReactNode }) {
  const { pathname } = useLocation()

  /* Sidebar state */
  const [mobileOpen, setMobileOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(() => {
    if (typeof window === 'undefined') return false
    return window.localStorage.getItem('bonifica-sidebar-collapsed') === 'true'
  })

  /* Theme */
  const [theme, setTheme] = useState<'dark' | 'light'>(() => {
    if (typeof window === 'undefined') return 'dark'
    return window.localStorage.getItem('bonifica-theme') === 'light' ? 'light' : 'dark'
  })

  /* User menu */
  const [userMenuOpen, setUserMenuOpen] = useState(false)
  const userMenuRef = useRef<HTMLDivElement | null>(null)

  /* Avatar */
  const [avatarUrl, setAvatarUrl] = useState<string | null>(() => {
    if (typeof window === 'undefined') return null
    return window.localStorage.getItem('bonifica-avatar')
  })
  const fileInputRef = useRef<HTMLInputElement | null>(null)

  /* Profile */
  const [profile, setProfile] = useState(() => {
    const cachedProfile = getCachedCurrentUserProfile()
    if (!cachedProfile) {
      return { name: 'Usuário', email: 'Sem e-mail', role: 'operator' }
    }
    return {
      name: cachedProfile.name,
      email: cachedProfile.email,
      role: cachedProfile.role,
    }
  })
  const [headerSearchType, setHeaderSearchType] = useState<DashboardSearchType>('name')
  const [headerSearchValue, setHeaderSearchValue] = useState('')
  const navSections = useMemo(() => {
    if (isAdminUiRole(profile.role)) return baseNavSections

    return baseNavSections.map((section) => ({
      ...section,
      items: section.items.map((item) => ({
        ...item,
        children: item.children?.filter((child) => child.href !== '/settings/users'),
      })),
    }))
  }, [profile.role])

  const toggleCollapse = () => {
    setCollapsed((prev) => {
      const next = !prev
      window.localStorage.setItem('bonifica-sidebar-collapsed', String(next))
      return next
    })
  }

  /* Theme sync */
  useEffect(() => {
    const root = document.documentElement
    root.classList.toggle('light', theme === 'light')
    root.style.colorScheme = theme
    window.localStorage.setItem('bonifica-theme', theme)
  }, [theme])

  /* Profile from auth */
  useEffect(() => {
    let mounted = true
    const apply = async () => {
      try {
        const currentUser = await fetchCurrentUserProfile()
        if (!mounted) return
        setProfile({
          name: currentUser.name,
          email: currentUser.email,
          role: currentUser.role,
        })
      } catch {
        const { data } = await supabase.auth.getSession()
        if (!mounted) return
        const user = data.session?.user
        const m = user?.user_metadata ?? {}
        setProfile({
          name: String(m.full_name || m.name || m.display_name || user?.email?.split('@')[0] || 'Usuário'),
          email: user?.email || 'Sem e-mail',
          role: 'operator',
        })
      }
    }
    apply()
    const { data: sub } = supabase.auth.onAuthStateChange((_e, session) => {
      clearCurrentUserProfileCache()
      clearCurrentTenantIdCache()
      const user = session?.user
      const m = user?.user_metadata ?? {}
      setProfile({
        name: String(m.full_name || m.name || m.display_name || user?.email?.split('@')[0] || 'Usuário'),
        email: user?.email || 'Sem e-mail',
        role: 'operator',
      })
    })
    return () => {
      mounted = false
      sub.subscription.unsubscribe()
    }
  }, [])

  /* Close user menu on outside click */
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

  useEffect(() => {
    const timer = window.setTimeout(() => {
      window.dispatchEvent(new CustomEvent(DASHBOARD_CLIENT_SEARCH_EVENT, {
        detail: {
          searchType: headerSearchType,
          query: headerSearchValue,
        },
      }))
    }, 280)

    return () => window.clearTimeout(timer)
  }, [headerSearchType, headerSearchValue])

  return (
    <div className="flex h-screen overflow-hidden bg-background text-foreground">
      {/* ── Mobile overlay ── */}
      {mobileOpen && (
        <div
          className="fixed inset-0 z-40 bg-black/50 backdrop-blur-sm transition-opacity lg:hidden"
          onClick={() => setMobileOpen(false)}
        />
      )}

      {/* ── Sidebar ── */}
      <aside
        className={cn(
          'fixed inset-y-0 left-0 z-50 flex flex-col border-r border-sidebar-border bg-sidebar transition-all duration-300 ease-out',
          'lg:relative lg:z-auto lg:translate-x-0',
          mobileOpen
            ? 'translate-x-0 shadow-2xl shadow-black/30'
            : '-translate-x-full'
        )}
        style={{ width: collapsed ? '4rem' : mobileOpen ? '18rem' : '16rem' }}
      >
        {/* Logo area */}
        <div className={cn(
          'relative flex flex-shrink-0 items-center justify-center border-b border-sidebar-border transition-all duration-300',
          collapsed ? 'h-20 px-2' : 'h-36 px-4'
        )}>
          <div className={cn(
            'relative flex items-center justify-center transition-all duration-300',
            collapsed ? 'h-10 w-10' : 'h-28 w-28'
          )}>
            <AnimatedGiftBox size={collapsed ? 40 : 110} />
          </div>

          {/* Mobile close */}
          <button
            onClick={() => setMobileOpen(false)}
            className="absolute right-3 top-1/2 -translate-y-1/2 rounded-lg p-1.5 text-muted-foreground hover:text-foreground lg:hidden"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        {/* Nav */}
        <nav className={cn(
          'flex-1 overflow-y-auto scrollable-content py-4',
          collapsed ? 'px-2' : 'px-3'
        )}>
          <div className="space-y-6">
            {navSections.map((section: NavSection, si: number) => (
              <div key={section.label || si}>
                {/* Section label */}
                {section.label && !collapsed && (
                  <p className="mb-2 px-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-muted-foreground">
                    {section.label}
                  </p>
                )}
                {section.label && collapsed && (
                  <div className="mx-auto mb-2 h-px w-5 bg-border" />
                )}

                <div className="space-y-0.5">
                  {section.items.map((item: NavItem) => (
                    <SidebarItem
                      key={item.href}
                      item={item}
                      pathname={pathname}
                      onNav={() => setMobileOpen(false)}
                      collapsed={collapsed}
                    />
                  ))}
                </div>
              </div>
            ))}
          </div>
        </nav>

        <div className={cn('flex-shrink-0 border-t border-sidebar-border py-3', collapsed ? 'px-2' : 'px-3')}>
          <button
            onClick={() => supabase.auth.signOut()}
            title={collapsed ? 'Sair' : undefined}
            className={cn(
              'group flex w-full items-center rounded-xl text-[13px] font-medium text-muted-foreground transition-all duration-200 hover:bg-destructive/[0.08] hover:text-destructive',
              collapsed ? 'justify-center p-2.5' : 'gap-3 px-3 py-2.5'
            )}
          >
            <LogOut className="h-[18px] w-[18px]" />
            {!collapsed && <span>Sair</span>}
          </button>
        </div>
      </aside>

      {/* ── Main area ── */}
      <div className="flex min-w-0 flex-1 flex-col overflow-hidden">
        {/* Header */}
        <header className="sticky top-0 z-30 flex h-16 flex-shrink-0 items-center gap-3 border-b border-border bg-surface-1/90 backdrop-blur-xl px-4 lg:px-5">
          {/* Left: toggle + title */}
          <div className="flex items-center gap-2">
            {/* Desktop collapse toggle */}
            <button
              onClick={toggleCollapse}
              className="hidden lg:flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/70 hover:text-foreground"
              title={collapsed ? 'Expandir menu' : 'Recolher menu'}
            >
              {collapsed ? <ChevronsRight className="h-4 w-4" /> : <ChevronsLeft className="h-4 w-4" />}
            </button>

            {/* Mobile hamburger */}
            <button
              onClick={() => setMobileOpen(true)}
              className="rounded-lg p-1.5 text-muted-foreground hover:text-foreground lg:hidden"
            >
              <Menu className="h-5 w-5" />
            </button>

            {/* Desktop: user/org name */}
            <div className="hidden lg:flex items-center gap-2">
              <User className="h-4 w-4 text-muted-foreground" />
              <span className="text-[13px] font-medium text-foreground">{profile.name}</span>
            </div>

            {/* Mobile: page title */}
            <span className="text-[13px] font-semibold text-foreground lg:hidden">
              {getPageTitle(pathname)}
            </span>
          </div>

          {/* Center: search bar */}
          <div className="mx-auto hidden max-w-sm flex-1 px-4 lg:block">
            <div className="flex items-center gap-2">
              <select
                value={headerSearchType}
                onChange={(e) => setHeaderSearchType(e.target.value as DashboardSearchType)}
                className="h-9 rounded-lg border border-border bg-surface-2 px-2.5 text-[11px] text-foreground outline-none transition-colors focus:border-primary/50"
              >
                <option value="name">Nome</option>
                <option value="cpfCnpj">CPF/CNPJ</option>
                <option value="id">ID</option>
              </select>
              <label className="flex flex-1 items-center gap-2 rounded-lg border border-border bg-surface-2 px-3 py-[7px] transition-colors focus-within:border-primary/50 focus-within:bg-surface-3">
                <Search className="h-3.5 w-3.5 text-muted-foreground" />
                <input
                  value={headerSearchValue}
                  onChange={(e) => setHeaderSearchValue(e.target.value)}
                  placeholder="Buscar clientes"
                  className="w-full bg-transparent text-[12.5px] text-foreground outline-none placeholder:text-muted-foreground"
                />
              </label>
            </div>
          </div>

          {/* Right: actions */}
          <div className="ml-auto flex items-center gap-1">
            {/* Mobile search */}
            <button className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground lg:hidden">
              <Search className="h-4 w-4" />
            </button>

            {/* Notifications removed — not functional */}

            {/* Theme toggle */}
            <button
              onClick={() => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))}
              className="flex h-9 w-9 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
              title={theme === 'dark' ? 'Tema claro' : 'Tema escuro'}
            >
              {theme === 'dark' ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
            </button>

            {/* Avatar / user menu */}
            <div className="relative ml-1" ref={userMenuRef}>
              <button
                onClick={() => setUserMenuOpen((o) => !o)}
                className="flex h-9 w-9 items-center justify-center rounded-full transition-opacity hover:opacity-85"
              >
                {avatarUrl ? (
                  <img src={avatarUrl} alt={profile.name} className="h-8 w-8 rounded-full object-cover" />
                ) : (
                  <div className="flex h-8 w-8 items-center justify-center rounded-full bg-primary/15 text-[11px] font-bold text-primary">
                    {initial}
                  </div>
                )}
              </button>

              {userMenuOpen && (
                <div className="absolute right-0 top-[calc(100%+6px)] z-50 w-64 overflow-hidden rounded-xl border border-border bg-surface-1 shadow-xl shadow-black/20 animate-scale-in">
                  <div className="border-b border-border px-4 py-4">
                    <div className="flex items-center gap-3">
                      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/15 text-sm font-bold text-primary">
                        {initial}
                      </div>
                      <div className="min-w-0 flex-1">
                        <p className="truncate text-[13px] font-semibold text-foreground">{profile.name}</p>
                        <p className="truncate text-[11.5px] text-muted-foreground">{profile.email}</p>
                        <span className="mt-1 inline-block rounded-md bg-primary/10 px-1.5 py-0.5 text-[10px] font-medium uppercase tracking-wider text-primary">
                          {profile.role === 'admin' ? 'Administrador' : 'Operador'}
                        </span>
                      </div>
                    </div>
                  </div>
                  <div className="p-1.5">
                    <button
                      onClick={() => {
                        fileInputRef.current?.click()
                        setUserMenuOpen(false)
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                    >
                      <Camera className="h-4 w-4" />
                      Alterar foto
                    </button>
                    <Link
                      to="/settings"
                      onClick={() => setUserMenuOpen(false)}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-muted/50 hover:text-foreground"
                    >
                      <Settings className="h-4 w-4" />
                      Configurações
                    </Link>
                  </div>
                  <div className="border-t border-border p-1.5">
                    <button
                      onClick={() => {
                        void supabase.auth.signOut()
                        setUserMenuOpen(false)
                      }}
                      className="flex w-full items-center gap-2.5 rounded-lg px-3 py-2 text-[13px] font-medium text-muted-foreground transition-colors hover:bg-destructive/[0.08] hover:text-destructive"
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

        {/* Main content */}
        <main className="flex-1 overflow-y-auto scrollable-content bg-background">
          <div className="page-shell">{children}</div>
        </main>
      </div>
    </div>
  )
}
