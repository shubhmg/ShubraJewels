import { useState } from 'react'
import { Phone, Mail, MapPin, Instagram, Facebook, Youtube } from 'lucide-react'
import { WhatsAppButton } from '../../components/ui/WhatsAppButton.jsx'
import { Mandala, Motif } from '../../components/decor/Decor.jsx'
import { useSettings, whatsappLink } from '../../lib/SettingsProvider.jsx'

export function Contact() {
  const settings = useSettings()
  const [form, setForm] = useState({ name: '', message: '' })

  const composed = `Hello ${settings.brandName}! ${form.name ? `I'm ${form.name}. ` : ''}${form.message || ''}`
  const wa = whatsappLink(settings, composed)

  const socials = [
    { icon: Instagram, url: settings.instagram },
    { icon: Facebook, url: settings.facebook },
    { icon: Youtube, url: settings.youtube },
  ].filter((s) => s.url)

  return (
    <div className="min-h-dvh animate-fade-in" style={{ background: 'var(--cream)' }}>
      <div className="relative overflow-hidden text-center" style={{ background: 'var(--maroon-dark)' }}>
        <Mandala size={300} className="absolute right-0 md:right-8 top-16 md:top-24 opacity-15 pointer-events-none" />
        <div className="container-wide pt-24 md:pt-32 pb-12 md:pb-16 relative">
          <div className="eyebrow justify-center flex"><Motif size={18} />Get in touch</div>
          <p className="font-hindi text-[var(--gold-light)] text-lg mt-2">हमसे जुड़ें</p>
          <h1 className="font-display text-white text-4xl md:text-5xl">We'd Love to Hear From You</h1>
        </div>
      </div>

      <section className="section">
        <div className="container-tight grid md:grid-cols-2 gap-12">
          <div>
            <h2 className="font-display text-2xl mb-1" style={{ color: 'var(--ink)' }}>Message us on WhatsApp</h2>
            <p className="text-sm text-stone-500 mb-6">The fastest way to order or ask a question.</p>
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
              {wa ? (
                <WhatsAppButton message={composed} label="Send on WhatsApp" className="w-full" />
              ) : (
                <p className="text-xs text-stone-400">WhatsApp number not set yet — add it in the admin panel.</p>
              )}
            </div>
          </div>

          <div className="space-y-5">
            {settings.phone && <ContactRow icon={Phone} label="Phone" value={settings.phone} href={`tel:${settings.phone}`} />}
            {settings.email && <ContactRow icon={Mail} label="Email" value={settings.email} href={`mailto:${settings.email}`} />}
            <ContactRow icon={MapPin} label="Shipping" value={settings.shippingNote || `Free shipping in ${settings.freeShippingCity}`} />
            {socials.length > 0 && (
              <div className="pt-2">
                <p className="text-xs uppercase tracking-wider mb-3" style={{ color: 'var(--maroon)' }}>Follow us</p>
                <div className="flex gap-3">
                  {socials.map(({ icon: Icon, url }, i) => (
                    <a key={i} href={url} target="_blank" rel="noopener noreferrer" className="w-10 h-10 grid place-items-center rounded-full transition" style={{ background: 'color-mix(in srgb, var(--maroon) 10%, transparent)', color: 'var(--maroon)' }}>
                      <Icon size={17} />
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
