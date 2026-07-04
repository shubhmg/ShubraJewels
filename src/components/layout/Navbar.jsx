import { useState, useEffect } from 'react'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ShoppingBag, Heart, Search, Menu, X, User } from 'lucide-react'
import { useCartStore } from '../../store/cartStore.js'
import { useWishlistStore } from '../../store/wishlistStore.js'
import { useCustomerStore } from '../../store/customerStore.js'
import { useSettings } from '../../lib/SettingsProvider.jsx'
import { SearchModal } from '../search/SearchModal.jsx'
import { AuthModal } from '../auth/AuthModal.jsx'

const NAV = [
  { to: '/collections', label: 'Collections' },
  { to: '/products',    label: 'Jhumkas'     },
  { to: '/about',       label: 'Our Story'   },
  { to: '/contact',     label: 'Contact'     },
]

export function Navbar() {
  const [scrolled, setScrolled] = useState(false)
  const [mobileOpen, setMobileOpen] = useState(false)
  const [searchOpen, setSearchOpen] = useState(false)
  const [authOpen, setAuthOpen] = useState(false)
  const settings = useSettings()
  const location = useLocation()
  const navigate = useNavigate()
  const { customer, fetchMe, isAuthed } = useCustomerStore()
  useEffect(() => { fetchMe() }, []) // eslint-disable-line
  const onAccount = () => (isAuthed() ? navigate('/account') : setAuthOpen(true))
  const heroBg = !scrolled && location.pathname === '/' && !mobileOpen
  const cartCount = useCartStore((s) => s.items.reduce((a, i) => a + i.qty, 0))
  const wishCount = useWishlistStore((s) => s.items.length)
  const openCart = useCartStore((s) => s.openCart)

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  // Close the mobile menu on route change + ESC.
  useEffect(() => { setMobileOpen(false) }, [location.pathname])
  useEffect(() => {
    const handler = (e) => { if (e.key === 'Escape') setMobileOpen(false) }
    window.addEventListener('keydown', handler)
    return () => window.removeEventListener('keydown', handler)
  }, [])

  const solid = scrolled || mobileOpen

  return (
    <>
      <SearchModal isOpen={searchOpen} onClose={() => setSearchOpen(false)} />
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />

      <header className={`fixed top-0 left-0 right-0 z-40 transition-all duration-300 transform-gpu ${
        solid ? 'bg-white/95 backdrop-blur-md shadow-sm border-b border-cream-200/80' : 'bg-transparent'
      }`}>
        <div className="container-wide">
          <div className="flex items-center justify-between h-14 md:h-20 gap-2">
            {/* Logo */}
            <Link to="/" className="flex items-center gap-2 flex-shrink-0 min-w-0">
              {settings.logo ? (
                <img src={settings.logo} alt={settings.brandName} className="h-8 md:h-9 w-auto object-contain" />
              ) : (
                <div className="w-8 h-8 md:w-9 md:h-9 rounded-full flex items-center justify-center flex-shrink-0" style={{ background: 'linear-gradient(135deg, var(--gold), var(--gold-light))' }}>
                  <span className="font-display text-base md:text-lg" style={{ color: 'var(--maroon-dark)' }}>{settings.brandName?.[0] || 'S'}</span>
                </div>
              )}
              <span className={`font-display text-lg sm:text-xl md:text-2xl tracking-wide truncate transition-colors duration-300 ${heroBg ? 'text-white' : ''}`} style={heroBg ? undefined : { color: 'var(--maroon)' }}>
                {settings.brandName}
              </span>
            </Link>

            {/* Desktop nav */}
            <nav className="hidden md:flex items-center gap-8" aria-label="Main navigation">
              {NAV.map(({ to, label }) => (
                <NavLink key={to} to={to} className={({ isActive }) => `nav-link ${isActive ? 'active' : ''} ${heroBg ? 'text-white/90 hover:text-white' : 'text-stone-700 hover:text-dark-900'}`}>
                  {label}
                </NavLink>
              ))}
            </nav>

            {/* Actions */}
            <div className="flex items-center gap-0.5 sm:gap-1 flex-shrink-0">
              <IconBtn heroBg={heroBg} onClick={() => setSearchOpen(true)} aria-label="Search"><Search size={18} /></IconBtn>
              <Link to="/wishlist" className="hidden sm:block">
                <IconBtn heroBg={heroBg} as="div" aria-label={`Wishlist (${wishCount})`}>
                  <Heart size={18} />{wishCount > 0 && <Dot>{wishCount}</Dot>}
                </IconBtn>
              </Link>
              <IconBtn heroBg={heroBg} onClick={openCart} aria-label={`Cart (${cartCount})`}>
                <ShoppingBag size={18} />{cartCount > 0 && <Dot>{cartCount}</Dot>}
              </IconBtn>
              <IconBtn heroBg={heroBg} onClick={onAccount} aria-label="Account">
                {isAuthed() ? (
                  <span className="w-6 h-6 rounded-full grid place-items-center text-[11px] font-bold" style={{ background: 'var(--maroon)', color: 'var(--cream)' }}>{(customer?.name || customer?.email || 'U')[0]?.toUpperCase()}</span>
                ) : <User size={18} />}
              </IconBtn>
              <Link to="/admin" className="hidden md:flex ml-2">
                <button className={`px-4 py-2 rounded-full border text-xs font-semibold transition-colors cursor-pointer ${heroBg ? 'border-gold-400/50 text-gold-300 hover:text-gold-200' : 'border-gold-500/40 text-gold-600 hover:bg-gold-500/10'}`}>Admin</button>
              </Link>
              <IconBtn heroBg={heroBg} className="md:hidden" onClick={() => setMobileOpen((o) => !o)} aria-label="Menu">
                {mobileOpen ? <X size={20} /> : <Menu size={20} />}
              </IconBtn>
            </div>
          </div>
        </div>

        {/* Mobile menu */}
        <div className={`md:hidden overflow-hidden transition-[max-height] duration-300 ${mobileOpen ? 'max-h-96' : 'max-h-0'}`}>
          <div className="bg-white border-t border-cream-200 px-4 py-3 space-y-1">
            {NAV.map(({ to, label }) => (
              <NavLink key={to} to={to} onClick={() => setMobileOpen(false)} className={({ isActive }) => `block px-4 py-3 rounded-xl text-base font-medium transition-colors ${isActive ? 'bg-gold-500/10 text-gold-700' : 'text-stone-700 hover:bg-cream-100'}`}>
                {label}
              </NavLink>
            ))}
            <Link to="/wishlist" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-xl text-base font-medium text-stone-700 hover:bg-cream-100">Wishlist{wishCount > 0 ? ` (${wishCount})` : ''}</Link>
            <Link to="/admin" onClick={() => setMobileOpen(false)} className="block px-4 py-3 rounded-xl text-base font-medium text-gold-600 hover:bg-gold-500/10">Admin</Link>
          </div>
        </div>
      </header>
    </>
  )
}

function IconBtn({ children, className = '', as: Tag = 'button', heroBg, ...props }) {
  return (
    <Tag
      className={`relative w-9 h-9 md:w-10 md:h-10 flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer ${
        heroBg ? 'text-white/90 hover:text-white hover:bg-white/10' : 'text-stone-600 hover:bg-cream-100 hover:text-dark-900'
      } ${className}`}
      {...props}
    >
      {children}
    </Tag>
  )
}

function Dot({ children }) {
  return (
    <span className="absolute -top-0.5 -right-0.5 min-w-4 h-4 px-1 text-[9px] font-bold bg-gold-500 text-dark-950 rounded-full flex items-center justify-center">
      {children}
    </span>
  )
}
