import { Link } from 'react-router-dom'
import { Instagram, Facebook, Youtube, Mail, Phone, MapPin } from 'lucide-react'
import { instagramHandle, instagramUrl, useSettings } from '../../lib/SettingsProvider.jsx'
import { Motif, MehendiDivider } from '../decor/Decor.jsx'

export function Footer() {
  const settings = useSettings()
  const igUrl = instagramUrl(settings)
  const igHandle = instagramHandle(settings)

  const socials = [
    { icon: Instagram, url: igUrl },
    { icon: Facebook, url: settings.facebook },
    { icon: Youtube, url: settings.youtube },
  ].filter((s) => s.url)

  return (
    <footer style={{ background: 'var(--maroon-dark)', color: 'rgba(255,255,255,0.7)' }}>
      <MehendiDivider />
      <div className="container-wide py-14">
        <div className="grid grid-cols-2 md:grid-cols-3 gap-8 lg:gap-12">
          {/* Brand */}
          <div className="col-span-2 md:col-span-1 space-y-4">
            <div className="flex items-center gap-2">
              <Motif size={22} />
              <span className="font-display text-2xl text-white">{settings.brandName}</span>
            </div>
            <p className="font-hindi text-[var(--gold-light)]">{settings.slogan}</p>
            <p className="text-sm leading-relaxed">{settings.aboutShort}</p>
            {igUrl && igHandle && (
              <a href={igUrl} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-2 text-xs font-semibold tracking-wide hover:text-[var(--gold-light)] transition-colors">
                <Instagram size={14} className="text-[var(--gold-light)]" />
                {igHandle}
              </a>
            )}
            {socials.length > 0 && (
              <div className="flex items-center gap-3 pt-1">
                {socials.map(({ icon: Icon, url }, i) => (
                  <a key={i} href={url} target="_blank" rel="noopener noreferrer" aria-label="Social" className="w-9 h-9 rounded-full grid place-items-center transition-colors" style={{ background: 'rgba(255,255,255,0.1)' }}>
                    <Icon size={15} />
                  </a>
                ))}
              </div>
            )}
          </div>

          {/* Company */}
          <div>
            <h4 className="text-white text-sm font-semibold tracking-wide mb-4">Company</h4>
            <ul className="space-y-2.5 text-sm">
              <li><Link to="/collections" className="hover:text-[var(--gold-light)] transition-colors">Collections</Link></li>
              <li><Link to="/about" className="hover:text-[var(--gold-light)] transition-colors">Our Story</Link></li>
              <li><Link to="/contact" className="hover:text-[var(--gold-light)] transition-colors">Contact</Link></li>
              <li><Link to="/wishlist" className="hover:text-[var(--gold-light)] transition-colors">Wishlist</Link></li>
            </ul>
          </div>

          {/* Reach us */}
          <div>
            <h4 className="text-white text-sm font-semibold tracking-wide mb-4">Reach Us</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin size={14} className="flex-shrink-0 mt-0.5 text-[var(--gold-light)]" />
                <span>{settings.shippingNote || `Free shipping in ${settings.freeShippingCity}`}</span>
              </li>
              {settings.phone && (
                <li className="flex items-center gap-2.5">
                  <Phone size={14} className="text-[var(--gold-light)]" />
                  <a href={`tel:${settings.phone}`} className="hover:text-[var(--gold-light)] transition-colors">{settings.phone}</a>
                </li>
              )}
              {settings.email && (
                <li className="flex items-center gap-2.5">
                  <Mail size={14} className="text-[var(--gold-light)]" />
                  <a href={`mailto:${settings.email}`} className="hover:text-[var(--gold-light)] transition-colors">{settings.email}</a>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <div className="container-wide py-5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
          <p>© {new Date().getFullYear()} {settings.brandName}. {settings.slogan}</p>
          <Link to="/admin" className="hover:text-[var(--gold-light)] transition-colors">Admin</Link>
        </div>
      </div>
    </footer>
  )
}
