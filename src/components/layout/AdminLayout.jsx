import { useState, useEffect } from 'react'
import { NavLink, Navigate, Outlet, useNavigate, useLocation } from 'react-router-dom'
import {
  LayoutDashboard, Home as HomeIcon, Package, Boxes, Tags, Crown, Megaphone, Video, Star, Image as ImageIcon,
  ShoppingCart, Settings, ChevronLeft, ChevronRight, ExternalLink, LogOut, Menu, X,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore.js'
import { useSettings } from '../../lib/SettingsProvider.jsx'
import { getToken } from '../../lib/api.js'

const NAV = [
  { section: 'Store' },
  { to: '/admin', icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/homepage', icon: HomeIcon, label: 'Homepage' },
  { to: '/admin/orders', icon: ShoppingCart, label: 'Orders' },
  { section: 'Catalog' },
  { to: '/admin/products', icon: Package, label: 'Products' },
  { to: '/admin/inventory', icon: Boxes, label: 'Inventory' },
  { to: '/admin/categories', icon: Tags, label: 'Categories' },
  { to: '/admin/collections', icon: Crown, label: 'Collections' },
  { section: 'Content' },
  { to: '/admin/banners', icon: Megaphone, label: 'Banners' },
  { to: '/admin/videos', icon: Video, label: 'Videos' },
  { to: '/admin/reviews', icon: Star, label: 'Reviews' },
  { to: '/admin/gallery', icon: ImageIcon, label: 'Gallery' },
  { section: 'System' },
  { to: '/admin/settings', icon: Settings, label: 'Settings' },
]

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const settings = useSettings()
  const navigate = useNavigate()
  const location = useLocation()
  const { admin, fetchMe, logout } = useAuthStore()

  useEffect(() => { if (getToken()) fetchMe() }, []) // eslint-disable-line
  useEffect(() => { setMobileOpen(false) }, [location.pathname])

  if (!getToken()) return <Navigate to="/admin/login" replace />
  const doLogout = () => { logout(); navigate('/admin/login') }

  return (
    <div className="flex h-dvh overflow-hidden admin-shell">
      {mobileOpen && <div className="fixed inset-0 bg-black/50 z-40 md:hidden" onClick={() => setMobileOpen(false)} />}

      <aside className={`admin-sidebar fixed md:static inset-y-0 left-0 z-50 flex flex-col flex-shrink-0 transition-transform md:transition-all duration-300 w-64 md:w-64 ${collapsed ? 'md:w-[68px]' : ''} ${mobileOpen ? 'translate-x-0' : '-translate-x-full md:translate-x-0'}`}>
        {/* Brand */}
        <div className={`flex items-center h-16 px-4 border-b border-white/5 ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
          <div className="w-8 h-8 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, var(--gold), var(--gold-light))' }}>
            <span className="font-display text-base" style={{ color: 'var(--maroon-dark)' }}>{settings.brandName?.[0] || 'S'}</span>
          </div>
          {!collapsed && <span className="font-semibold text-[15px] text-white whitespace-nowrap tracking-tight">{settings.brandName}</span>}
          <button onClick={() => setMobileOpen(false)} className="md:hidden ml-auto text-zinc-500 hover:text-white cursor-pointer"><X size={20} /></button>
        </div>

        <nav className="flex-1 py-3 px-2.5 space-y-0.5 overflow-y-auto">
          {NAV.map((n, i) => n.section ? (
            !collapsed && <p key={i} className="px-3 pt-4 pb-1.5 text-[10px] font-semibold uppercase tracking-wider text-zinc-500">{n.section}</p>
          ) : (
            <NavLink
              key={n.to}
              to={n.to}
              end={n.end}
              title={collapsed ? n.label : undefined}
              className={({ isActive }) =>
                `group flex items-center gap-3 px-3 py-2 rounded-lg text-[15px] font-bold transition-all ${
                  isActive ? 'bg-white/[0.07] text-white' : 'text-zinc-400 hover:text-white hover:bg-white/[0.04]'
                } ${collapsed ? 'justify-center' : ''}`
              }
            >
              {({ isActive }) => (
                <>
                  <span className={`w-1 h-5 rounded-full -ml-3 mr-0 transition-all ${isActive ? 'bg-[var(--gold)]' : 'bg-transparent'} ${collapsed ? 'hidden' : ''}`} />
                  <n.icon size={18} className={`flex-shrink-0 ${isActive ? 'text-[var(--gold-light)]' : ''}`} />
                  {!collapsed && <span className="whitespace-nowrap">{n.label}</span>}
                </>
              )}
            </NavLink>
          ))}
        </nav>

        <div className="px-2.5 pb-3 pt-2 space-y-0.5 border-t border-white/5">
          <a href="/" target="_blank" rel="noreferrer" className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-400 hover:text-white hover:bg-white/[0.04] transition ${collapsed ? 'justify-center' : ''}`} title="View store">
            <ExternalLink size={17} />{!collapsed && <span>View store</span>}
          </a>
          <button onClick={() => setCollapsed((c) => !c)} className={`hidden md:flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-zinc-500 hover:text-white hover:bg-white/[0.04] transition w-full cursor-pointer ${collapsed ? 'justify-center' : ''}`}>
            {collapsed ? <ChevronRight size={17} /> : <ChevronLeft size={17} />}{!collapsed && <span>Collapse</span>}
          </button>

          {/* Profile chip */}
          <div className={`flex items-center gap-2.5 mt-2 rounded-xl bg-white/[0.05] ${collapsed ? 'justify-center p-2' : 'px-2.5 py-2'}`}>
            <div className="w-8 h-8 rounded-full grid place-items-center text-xs font-bold shrink-0" style={{ background: 'linear-gradient(135deg, var(--gold), var(--gold-light))', color: 'var(--maroon-dark)' }}>{admin?.name?.[0] || 'A'}</div>
            {!collapsed && (
              <>
                <div className="min-w-0 flex-1">
                  <p className="text-xs font-semibold text-white truncate">{admin?.name || 'Admin'}</p>
                  <p className="text-[11px] text-zinc-400 truncate">{admin?.email}</p>
                </div>
                <button onClick={doLogout} title="Log out" className="w-8 h-8 grid place-items-center rounded-lg text-zinc-400 hover:text-white hover:bg-white/10 cursor-pointer shrink-0"><LogOut size={16} /></button>
              </>
            )}
          </div>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden min-w-0">
        {/* Mobile top bar only — desktop has no top chrome */}
        <header className="md:hidden h-14 bg-[#F7F1E7]/85 backdrop-blur border-b border-[color-mix(in_srgb,var(--gold)_22%,transparent)] flex items-center gap-3 px-4 flex-shrink-0 sticky top-0 z-20">
          <button onClick={() => setMobileOpen(true)} className="w-9 h-9 grid place-items-center rounded-lg text-zinc-600 hover:bg-black/5 cursor-pointer" aria-label="Menu"><Menu size={20} /></button>
          <span className="font-bold text-zinc-900 truncate">{settings.brandName}</span>
        </header>

        <main className="flex-1 overflow-y-auto overflow-x-hidden p-4 md:p-8"><Outlet /></main>
      </div>
    </div>
  )
}
