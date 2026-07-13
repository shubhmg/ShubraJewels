import { useState } from 'react'
import { Phone, Mail, MapPin, Instagram, Facebook, Youtube } from 'lucide-react'
import { WhatsAppButton } from '../../components/ui/WhatsAppButton.jsx'
import { Mandala, Motif } from '../../components/decor/Decor.jsx'
import { useSettings, whatsappLink, instagramUrl, instagramHandle } from '../../lib/SettingsProvider.jsx'
import { resolveContent } from '../../lib/siteContent.js'

const IG_GRADIENT = 'linear-gradient(45deg,#feda75 0%,#fa7e1e 22%,#d62976 52%,#962fbf 78%,#4f5bd5 100%)'

export function Contact() {
  const settings = useSettings()
  const c = resolveContent(settings.content).pages.contact
  const [form, setForm] = useState({ name: '', message: '' })

  const composed = `Hello ${settings.brandName}! ${form.name ? `I'm ${form.name}. ` : ''}${form.message || ''}`
  // Only offer WhatsApp when a number is set AND the admin has enabled it.
  const wa = settings.showWhatsappContact !== false ? whatsappLink(settings, composed) : null

  const igUrl = instagramUrl(settings)
  const igHandle = instagramHandle(settings)
  const otherSocials = [
    { icon: Facebook, url: settings.facebook, label: 'Facebook' },
    { icon: Youtube, url: settings.youtube, label: 'YouTube' },
  ].filter((s) => s.url)

  return (
    <div className="min-h-dvh animate-fade-in" style={{ background: 'var(--cream)' }}>
      <div className="relative overflow-hidden text-center" style={{ background: 'var(--maroon-dark)' }}>
        <Mandala size={300} className="hidden md:block absolute right-0 md:right-8 top-16 md:top-24 opacity-15 pointer-events-none" />
        <div className="container-wide pt-24 md:pt-32 pb-12 md:pb-16 relative">
          <div className="eyebrow justify-center flex"><Motif size={18} />{c.eyebrow}</div>
          <p className="font-hindi text-[var(--gold-light)] text-lg mt-2">{c.hindi}</p>
          <h1 className="font-display text-white text-4xl md:text-5xl">{c.heading}</h1>
        </div>
      </div>

      <section className="section">
        <div className={`container-tight grid gap-12 ${wa ? 'md:grid-cols-2' : 'max-w-lg mx-auto'}`}>
          {wa && (
          <div>
            <h2 className="font-display text-2xl mb-1" style={{ color: 'var(--ink)' }}>{c.waHeading}</h2>
            <p className="text-sm text-stone-500 mb-6">{c.waSubtext}</p>
            <div className="space-y-4">
              <input
                value={form.name}
                onChange={(e) => setForm({ ...form, name: e.target.value })}
                placeholder="Your name"
                className="w-full px-4 py-3 rounded-xl border bg-white text-sm focus:outline-none"
                style={{ borderColor: 'color-mix(in srgb, var(--gold) 35%, transparent)' }}
              />
              <textarea
                value={form.message}
                onChange={(e) => setForm({ ...form, message: e.target.value })}
                placeholder="What would you like to ask or order?"
                rows={4}
                className="w-full px-4 py-3 rounded-xl border bg-white text-sm focus:outline-none resize-none"
                style={{ borderColor: 'color-mix(in srgb, var(--gold) 35%, transparent)' }}
              />
              <WhatsAppButton message={composed} label="Send on WhatsApp" className="w-full" />
            </div>
          </div>
          )}

          <div className="space-y-5">
            {settings.phone && <ContactRow icon={Phone} label="Phone" value={settings.phone} href={`tel:${settings.phone}`} />}
            {settings.email && <ContactRow icon={Mail} label="Email" value={settings.email} href={`mailto:${settings.email}`} />}
            {settings.businessAddress && <ContactRow icon={MapPin} label="Address" value={settings.businessAddress} />}
            <ContactRow icon={MapPin} label="Shipping" value={settings.shippingNote || `Free shipping in ${settings.freeShippingCity}`} />
            {settings.legalName && (
              <p className="text-xs leading-relaxed pt-1" style={{ color: 'color-mix(in srgb, var(--ink) 60%, transparent)' }}>
                {settings.brandName} is a {settings.businessType || 'sole proprietorship'} owned and operated by {settings.legalName}.
              </p>
            )}
            {(igUrl || otherSocials.length > 0) && (
              <div className="pt-2">
                <p className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--maroon)' }}>Follow us</p>
                <div className="flex flex-wrap items-center gap-3">
                  {igUrl && (
                    <a href={igUrl} target="_blank" rel="noopener noreferrer"
                       className="inline-flex items-center gap-3 pl-2.5 pr-5 py-2.5 rounded-full text-white shadow-md hover:opacity-95 transition-opacity"
                       style={{ background: IG_GRADIENT }}>
                      <span className="w-9 h-9 rounded-full grid place-items-center shrink-0" style={{ background: 'rgba(255,255,255,0.22)' }}>
                        <Instagram size={19} />
                      </span>
                      <span className="leading-tight text-left">
                        <span className="block text-[10px] uppercase tracking-wider opacity-80">Instagram</span>
                        <span className="block text-sm font-semibold">{igHandle || 'Follow us'}</span>
                      </span>
                    </a>
                  )}
                  {otherSocials.map(({ icon: Icon, url, label }, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" aria-label={label} className="w-11 h-11 grid place-items-center rounded-full transition hover:opacity-80" style={{ background: 'color-mix(in srgb, var(--maroon) 10%, transparent)', color: 'var(--maroon)' }}>
                      <Icon size={18} />
                    </a>
                  ))}
                </div>
              </div>
            )}
          </div>
        </div>
      </section>
    </div>
  )
}

function ContactRow({ icon: Icon, label, value, href }) {
  const inner = (
    <div className="flex items-start gap-3">
      <div className="w-10 h-10 rounded-full grid place-items-center shrink-0" style={{ background: 'color-mix(in srgb, var(--gold) 18%, transparent)' }}>
        <Icon size={17} style={{ color: 'var(--maroon)' }} />
      </div>
      <div>
        <p className="text-xs uppercase tracking-wider text-stone-400">{label}</p>
        <p className="font-medium" style={{ color: 'var(--ink)' }}>{value}</p>
      </div>
    </div>
  )
  return href ? <a href={href} className="block hover:opacity-80 transition">{inner}</a> : inner
}
