import { Link } from 'react-router-dom'
import { Instagram, Facebook, Youtube, Mail, Phone, MapPin } from 'lucide-react'
import { instagramHandle, instagramUrl, useSettings } from '../../lib/SettingsProvider.jsx'
import { resolveContent } from '../../lib/siteContent.js'
import { Motif, MehendiDivider } from '../decor/Decor.jsx'

const LEGAL_LINKS = [
  { label: 'Privacy Policy', to: '/privacy' },
  { label: 'Terms & Conditions', to: '/terms' },
  { label: 'Refund & Returns', to: '/refund' },
  { label: 'Shipping Policy', to: '/shipping' },
  { label: 'Contact', to: '/contact' },
]

export function Footer() {
  const settings = useSettings()
  const { footer } = resolveContent(settings.content)
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
      <div className="container-wide py-10 md:py-14 md:flex md:items-start md:justify-between md:gap-12">
        {/* Brand */}
        <div className="space-y-3 md:max-w-sm">
          <div className="flex items-center gap-2">
            <Motif size={22} />
            <span className="font-display text-2xl text-white">{settings.brandName}</span>
          </div>
          <p className="font-hindi text-[var(--gold-light)]">{settings.slogan}</p>
          <p className="text-sm leading-relaxed">{settings.aboutShort}</p>
          {socials.length > 0 && (
            <div className="flex items-center gap-3 pt-1">
              {socials.map(({ icon: Icon, url }, i) => (
                <a key={i} href={url} target="_blank" rel="noopener noreferrer" aria-label="Social" className="w-9 h-9 rounded-full grid place-items-center transition-colors hover:bg-white/20" style={{ background: 'rgba(255,255,255,0.1)' }}>
                  <Icon size={15} />
                </a>
              ))}
              {igUrl && igHandle && (
                <a href={igUrl} target="_blank" rel="noopener noreferrer" className="text-xs font-semibold tracking-wide hover:text-[var(--gold-light)] transition-colors">{igHandle}</a>
              )}
            </div>
          )}
        </div>

        {/* Links — even columns; sits beside the brand on desktop, below on mobile */}
        <div className="grid grid-cols-2 gap-6 sm:gap-12 mt-8 pt-8 border-t md:mt-0 md:pt-0 md:border-t-0 md:shrink-0" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
          <div>
            <h4 className="text-white text-sm font-semibold tracking-wide mb-3.5">{footer.companyHeading}</h4>
            <ul className="space-y-2.5 text-sm">
              {footer.links.map((l, i) => (
                <li key={i}><Link to={l.to} className="hover:text-[var(--gold-light)] transition-colors">{l.label}</Link></li>
              ))}
            </ul>
          </div>

          <div>
            <h4 className="text-white text-sm font-semibold tracking-wide mb-3.5">{footer.reachHeading}</h4>
            <ul className="space-y-3 text-sm">
              <li className="flex items-start gap-2.5">
                <MapPin size={14} className="flex-shrink-0 mt-0.5 text-[var(--gold-light)]" />
                <span>{settings.shippingNote || 'Pan-India delivery available.'}</span>
              </li>
              {settings.phone && (
                <li className="flex items-center gap-2.5">
                  <Phone size={14} className="text-[var(--gold-light)]" />
                  <a href={`tel:${settings.phone}`} className="hover:text-[var(--gold-light)] transition-colors">{settings.phone}</a>
                </li>
              )}
              {settings.email && (
                <li className="flex items-center gap-2.5 min-w-0">
                  <Mail size={14} className="text-[var(--gold-light)] shrink-0" />
                  <a href={`mailto:${settings.email}`} className="hover:text-[var(--gold-light)] transition-colors truncate">{settings.email}</a>
                </li>
              )}
            </ul>
          </div>
        </div>
      </div>

      <div className="border-t" style={{ borderColor: 'rgba(255,255,255,0.1)' }}>
        <div className="container-wide py-5 flex flex-col gap-4 text-xs" style={{ color: 'rgba(255,255,255,0.5)' }}>
          <nav className="flex flex-wrap items-center justify-center gap-x-5 gap-y-2">
            {LEGAL_LINKS.map((l) => (
              <Link key={l.to} to={l.to} className="hover:text-[var(--gold-light)] transition-colors">{l.label}</Link>
            ))}
          </nav>
          <div className="text-center pt-1 border-t" style={{ borderColor: 'rgba(255,255,255,0.07)' }}>
            <p>{footer.copyright || `© ${new Date().getFullYear()} ${settings.brandName}. ${settings.slogan}`}</p>
          </div>
        </div>
      </div>
    </footer>
  )
}
