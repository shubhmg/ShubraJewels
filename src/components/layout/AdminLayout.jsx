import { useState, useEffect } from 'react'
import { NavLink, Navigate, Outlet, useNavigate } from 'react-router-dom'
import {
  LayoutDashboard, Package, Tags, Crown, Megaphone, Video, Star, Image as ImageIcon,
  ShoppingCart, Settings, ChevronLeft, ChevronRight, ExternalLink, LogOut,
} from 'lucide-react'
import { useAuthStore } from '../../store/authStore.js'
import { useSettings } from '../../lib/SettingsProvider.jsx'
import { getToken } from '../../lib/api.js'

const NAV_ITEMS = [
  { to: '/admin',             icon: LayoutDashboard, label: 'Dashboard', end: true },
  { to: '/admin/products',    icon: Package,         label: 'Products'    },
  { to: '/admin/categories',  icon: Tags,            label: 'Categories'  },
  { to: '/admin/collections', icon: Crown,           label: 'Collections' },
  { to: '/admin/banners',     icon: Megaphone,       label: 'Banners'     },
  { to: '/admin/videos',      icon: Video,           label: 'Videos'      },
  { to: '/admin/reviews',     icon: Star,            label: 'Reviews'     },
  { to: '/admin/gallery',     icon: ImageIcon,       label: 'Gallery'     },
  { to: '/admin/orders',      icon: ShoppingCart,    label: 'Orders'      },
  { to: '/admin/settings',    icon: Settings,        label: 'Settings'    },
]

export function AdminLayout() {
  const [collapsed, setCollapsed] = useState(false)
  const settings = useSettings()
  const navigate = useNavigate()
  const { admin, fetchMe, logout } = useAuthStore()

  useEffect(() => { if (getToken()) fetchMe() }, []) // eslint-disable-line

  if (!getToken()) return <Navigate to="/admin/login" replace />

  const doLogout = () => { logout(); navigate('/admin/login') }

  return (
    <div className="flex h-dvh overflow-hidden bg-stone-100 dark:bg-dark-950">
      <aside className={`flex flex-col bg-dark-900 dark:bg-dark-950 border-r border-stone-800 flex-shrink-0 transition-all duration-300 ${collapsed ? 'w-16' : 'w-60'}`}>
        <div className={`flex items-center border-b border-stone-800 h-16 px-4 ${collapsed ? 'justify-center' : 'gap-2.5'}`}>
          <div className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, var(--gold), var(--gold-light))' }}>
            <span className="font-display text-sm" style={{ color: 'var(--maroon-dark)' }}>{settings.brandName?.[0] || 'S'}</span>
          </div>
          {!collapsed && <span className="font-display text-lg text-white whitespace-nowrap">{settings.brandName}</span>}
        </div>

        <nav className="flex-1 py-4 px-2 space-y-0.5 overflow-y-auto" aria-label="Admin navigation">
          {NAV_ITEMS.map(({ to, icon: Icon, label, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm font-medium transition-all duration-150 ${
                  isActive ? 'bg-gold-500/15 text-gold-400 border border-gold-500/20' : 'text-stone-400 hover:bg-stone-800 hover:text-white'
                } ${collapsed ? 'justify-center' : ''}`
              }
              title={collapsed ? label : undefined}
            >
              <Icon size={17} className="flex-shrink-0" />
              {!collapsed && <span className="whitespace-nowrap">{label}</span>}
            </NavLink>
          ))}
        </nav>

        <div className="px-2 pb-4 space-y-1 border-t border-stone-800 pt-3">
          <a href="/" target="_blank" rel="noreferrer" className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-400 hover:bg-stone-800 hover:text-white transition-colors ${collapsed ? 'justify-center' : ''}`} title="View Store">
            <ExternalLink size={16} className="flex-shrink-0" />{!collapsed && <span>View Store</span>}
          </a>
          <button onClick={doLogout} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-400 hover:bg-stone-800 hover:text-white transition-colors w-full cursor-pointer ${collapsed ? 'justify-center' : ''}`}>
            <LogOut size={16} className="flex-shrink-0" />{!collapsed && <span>Log out</span>}
          </button>
          <button onClick={() => setCollapsed((c) => !c)} className={`flex items-center gap-3 px-3 py-2.5 rounded-xl text-sm text-stone-400 hover:bg-stone-800 hover:text-white transition-colors w-full cursor-pointer ${collapsed ? 'justify-center' : ''}`}>
            {collapsed ? <ChevronRight size={16} /> : <ChevronLeft size={16} />}{!collapsed && <span>Collapse</span>}
          </button>
        </div>
      </aside>

      <div className="flex-1 flex flex-col overflow-hidden">
        <header className="h-16 bg-white dark:bg-stone-900 border-b border-cream-200 dark:border-stone-800 flex items-center justify-between px-6 flex-shrink-0">
          <div>
            <h1 className="text-sm font-semibold text-dark-900 dark:text-cream-50">{settings.brandName} Admin</h1>
            <p className="text-xs text-stone-400">{settings.slogan}</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 rounded-full flex items-center justify-center" style={{ background: 'linear-gradient(135deg, var(--gold), var(--gold-light))' }}>
              <span className="text-xs font-bold" style={{ color: 'var(--maroon-dark)' }}>{admin?.name?.[0] || 'A'}</span>
            </div>
            <div className="hidden sm:block">
              <p className="text-xs font-medium text-dark-900 dark:text-cream-50">{admin?.name || 'Admin'}</p>
              <p className="text-xs text-stone-400">{admin?.email}</p>
            </div>
          </div>
        </header>

        <main className="flex-1 overflow-y-auto p-6"><Outlet /></main>
      </div>
    </div>
  )
}
