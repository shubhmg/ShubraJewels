import { useEffect, useState, useRef } from 'react'
import { Loader2, Check, Palette, X } from 'lucide-react'
import { api } from '../../lib/api.js'
import { AdminHeader, Btn, Field } from '../../components/admin/AdminUI.jsx'
import { MediaUploader } from '../../components/admin/MediaUploader.jsx'
import { useSettingsCtx } from '../../lib/SettingsProvider.jsx'
import { INDIAN_CITIES } from '../../data/indianCities.js'
import { resolveAbout, VALUE_ICON_NAMES } from '../../lib/aboutContent.js'
import { resolveContent } from '../../lib/siteContent.js'

const TABS = [
  { id: 'brand', label: 'Brand' },
  { id: 'contact', label: 'Contact & Social' },
  { id: 'shipping', label: 'Shipping' },
  { id: 'payments', label: 'Payments' },
  { id: 'story', label: 'Our Story' },
  { id: 'content', label: 'Text & Content' },
  { id: 'policies', label: 'Legal Pages' },
  { id: 'theme', label: 'Theme' },
]

const THEME_KEYS = [
  { key: 'maroon',    label: 'Primary (maroon)' },
  { key: 'maroonDark',label: 'Primary dark' },
  { key: 'gold',      label: 'Accent (gold)' },
  { key: 'goldLight', label: 'Accent light' },
  { key: 'beige',     label: 'Beige' },
  { key: 'cream',     label: 'Background (cream)' },
  { key: 'ink',       label: 'Text (ink)' },
]

const PRESETS = [
  {
    name: 'Royal Maroon',
    desc: 'Classic Rajasthani royalty',
    colors: { maroon: '#7B1E2B', maroonDark: '#5A121C', gold: '#C9A84C', goldLight: '#E3C97A', beige: '#F6ECD9', cream: '#FBF6EC', ink: '#2A1A16' },
  },
  {
    name: 'Mughal Emerald',
    desc: 'Lush Mughal garden courts',
    colors: { maroon: '#1B4332', maroonDark: '#0F2D22', gold: '#D4A853', goldLight: '#E8C47A', beige: '#EEF4EF', cream: '#F5FAF5', ink: '#0D2318' },
  },
  {
    name: 'Rajputana Indigo',
    desc: 'Blue pottery of Rajasthan',
    colors: { maroon: '#1E3A6B', maroonDark: '#102147', gold: '#C9A84C', goldLight: '#E3C97A', beige: '#EEF2F8', cream: '#F4F7FC', ink: '#0D1B35' },
  },
  {
    name: 'Banjara Rose',
    desc: 'Vibrant tribal jewellery',
    colors: { maroon: '#8B2252', maroonDark: '#6B1640', gold: '#D4A853', goldLight: '#EBC87A', beige: '#F9EDF3', cream: '#FCF4F8', ink: '#2D0E1E' },
  },
  {
    name: 'Meenakari Teal',
    desc: 'Enamel-craft sophistication',
    colors: { maroon: '#1B5563', maroonDark: '#0F3642', gold: '#C9A84C', goldLight: '#E3C97A', beige: '#EAF4F6', cream: '#F2F9FA', ink: '#0C2A33' },
  },
  {
    name: 'Saffron Temple',
    desc: 'Warmth of festival lights',
    colors: { maroon: '#B85C00', maroonDark: '#8B3D00', gold: '#E8B030', goldLight: '#F5CE70', beige: '#FDF0DC', cream: '#FEF8EF', ink: '#2C1800' },
  },
  {
    name: 'Oxidised Noir',
    desc: 'Dark oxidised silver tones',
    colors: { maroon: '#3A3A3A', maroonDark: '#222222', gold: '#B8A898', goldLight: '#D4C8BC', beige: '#F0EFED', cream: '#F8F7F5', ink: '#1A1A1A' },
  },
]

function matchPreset(theme) {
  return PRESETS.findIndex((p) =>
    Object.entries(p.colors).every(([k, v]) => (theme?.[k] || '').toLowerCase() === v.toLowerCase())
  )
}

export function AdminSettings() {
  const { refresh } = useSettingsCtx()
  const [s, setS] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [tab, setTab] = useState('brand')

  useEffect(() => { api.get('/settings').then(setS) }, [])

  const set = (k, v) => setS((p) => ({ ...p, [k]: v }))
  const setTheme = (k, v) => setS((p) => ({ ...p, theme: { ...p.theme, [k]: v } }))
  const applyPreset = (preset) => setS((p) => ({ ...p, theme: { ...p.theme, ...preset.colors } }))

  const save = async () => {
    setSaving(true)
    try {
      // Coerce shipping fields (which may be '' while typing) to numbers.
      const sh = s.shipping || {}
      const payload = {
        ...s,
        shipping: {
          ...sh,
          defaultCharge: Number(sh.defaultCharge) || 0,
          freeAboveSubtotal: Number(sh.freeAboveSubtotal) || 0,
          cities: (sh.cities || []).filter((c) => c.name?.trim()).map((c) => ({ name: c.name.trim(), charge: Number(c.charge) || 0 })),
        },
      }
      await api.patch('/settings', payload, { auth: true })
      await refresh()
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  if (!s) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gold-500" /></div>

  const activePreset = matchPreset(s.theme)

  return (
    <div className="max-w-3xl">
      <AdminHeader title="Site Settings" subtitle="Everything here updates the live storefront.">
        <Btn onClick={save} disabled={saving}>{saved ? <><Check size={16} /> Saved</> : saving ? 'Saving…' : 'Save Changes'}</Btn>
      </AdminHeader>

      {/* Tabs */}
      <div className="flex flex-wrap gap-1.5 mb-6">
        {TABS.map((tb) => (
          <button
            key={tb.id}
            onClick={() => setTab(tb.id)}
            className="px-3.5 py-1.5 rounded-full text-sm font-semibold transition-colors cursor-pointer"
            style={tab === tb.id
              ? { background: 'var(--maroon)', color: 'var(--cream)' }
              : { background: 'color-mix(in srgb, var(--gold) 12%, transparent)', color: 'var(--ink)' }}
          >
            {tb.label}
          </button>
        ))}
      </div>

      {tab === 'brand' && (
      <Section title="Brand & Slogan">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field field={{ label: 'Brand name' }} value={s.brandName} onChange={(v) => set('brandName', v)} />
          <Field field={{ label: 'Brand name (Hindi)' }} value={s.brandNameHindi} onChange={(v) => set('brandNameHindi', v)} />
          <Field field={{ label: 'Slogan (Hindi)' }} value={s.slogan} onChange={(v) => set('slogan', v)} />
          <Field field={{ label: 'Slogan (English)' }} value={s.sloganEnglish} onChange={(v) => set('sloganEnglish', v)} />
          <div className="sm:col-span-2">
            <Field field={{ label: 'Taglines (one per line)', type: 'lines', rows: 3 }} value={s.taglines} onChange={(v) => set('taglines', v)} />
          </div>
          <div className="sm:col-span-2">
            <MediaUploader label="Logo (optional)" value={s.logo} onChange={(v) => set('logo', v)} accept="image" />
          </div>
          <div className="sm:col-span-2">
            <Field field={{ label: 'Show brand name next to logo', type: 'toggle' }} value={s.showBrandName !== false} onChange={(v) => set('showBrandName', v)} />
          </div>
          <div className="sm:col-span-2">
            <Field field={{ label: 'About (short)', type: 'textarea' }} value={s.aboutShort} onChange={(v) => set('aboutShort', v)} />
          </div>
        </div>
      </Section>
      )}

      {tab === 'brand' && (
      <Section title="Legal / Business Identity" subtitle="Required for payment-gateway approval. For a sole proprietorship, the legal name is the proprietor's own full name (as on PAN & bank account) — shown on the footer, Contact page, and all legal pages.">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field field={{ label: 'Legal name (proprietor)', help: 'Full name as on PAN / bank account, e.g. Tanisha Rana' }} value={s.legalName} onChange={(v) => set('legalName', v)} />
          <Field field={{ label: 'Business type', help: 'e.g. sole proprietorship' }} value={s.businessType} onChange={(v) => set('businessType', v)} />
          <div className="sm:col-span-2">
            <Field field={{ label: 'Business address', type: 'textarea', rows: 2, help: 'Full operating/contact address shown publicly (required by gateways).' }} value={s.businessAddress} onChange={(v) => set('businessAddress', v)} />
          </div>
        </div>
      </Section>
      )}

      {tab === 'contact' && (
      <Section title="Ordering & Contact">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field field={{ label: 'WhatsApp number', help: 'With country code, digits only e.g. 919812345678' }} value={s.whatsappNumber} onChange={(v) => set('whatsappNumber', v)} />
          <Field field={{ label: 'WhatsApp default message' }} value={s.whatsappMessage} onChange={(v) => set('whatsappMessage', v)} />
          <Field field={{ label: 'Phone' }} value={s.phone} onChange={(v) => set('phone', v)} />
          <Field field={{ label: 'Email' }} value={s.email} onChange={(v) => set('email', v)} />
          <Field field={{ label: 'Shipping note', help: 'Short line shown on product pages / footer' }} value={s.shippingNote} onChange={(v) => set('shippingNote', v)} />
          <Field field={{ label: 'Announcement strip' }} value={s.announcement} onChange={(v) => set('announcement', v)} />
        </div>
      </Section>
      )}

      {tab === 'contact' && (
      <Section title="Social Links">
        <div className="grid sm:grid-cols-3 gap-4">
          <Field field={{ label: 'Instagram URL' }} value={s.instagramUrl || s.instagram || ''} onChange={(v) => setS((p) => ({ ...p, instagramUrl: v, instagram: v }))} />
          <Field field={{ label: 'Facebook URL' }} value={s.facebook} onChange={(v) => set('facebook', v)} />
          <Field field={{ label: 'YouTube URL' }} value={s.youtube} onChange={(v) => set('youtube', v)} />
        </div>
      </Section>
      )}

      {tab === 'shipping' && (
      <Section title="Shipping" subtitle="Base charge applies everywhere, unless a city is overridden below or the order qualifies for free shipping.">
        <ShippingEditor value={s.shipping} onChange={(v) => set('shipping', v)} />
      </Section>
      )}

      {tab === 'payments' && (
      <Section title="Payment Methods" subtitle="Which checkout options customers see.">
        <div className="space-y-1">
          <Field field={{ label: 'Pay online (Razorpay — UPI, cards, netbanking)', type: 'toggle' }} value={s.payments?.razorpay !== false} onChange={(v) => setS((p) => ({ ...p, payments: { ...p.payments, razorpay: v } }))} />
          <Field field={{ label: 'Pay on delivery (COD)', type: 'toggle' }} value={s.payments?.cod !== false} onChange={(v) => setS((p) => ({ ...p, payments: { ...p.payments, cod: v } }))} />
          <p className="text-xs text-zinc-400 pt-1">WhatsApp ordering is always available.</p>
        </div>
      </Section>
      )}

      {tab === 'payments' && (
      <Section title="COD & Prepaid Incentives" subtitle="Discourage fake COD and reward paying now. All optional.">
        <div className="space-y-4">
          <Field field={{ label: 'COD fee (₹)', type: 'number', help: 'Extra charge added to Cash-on-Delivery orders. 0 = no fee.' }} value={s.payments?.codFee || 0} onChange={(v) => setS((p) => ({ ...p, payments: { ...p.payments, codFee: v === '' ? 0 : Number(v) } }))} />
          <Field field={{ label: 'Free shipping when paying now (UPI/online)', type: 'toggle', help: 'Waives shipping for prepaid orders to nudge customers away from COD.' }} value={!!s.payments?.prepaidFreeShipping} onChange={(v) => setS((p) => ({ ...p, payments: { ...p.payments, prepaidFreeShipping: v } }))} />
          <div className="rounded-xl border border-zinc-200 p-3.5 space-y-3">
            <Field field={{ label: 'Require an advance on COD (via WhatsApp)', type: 'toggle', help: 'Ask the customer to pay a small % advance to confirm a COD order — cuts fake orders / RTO.' }} value={!!s.payments?.codAdvance?.enabled} onChange={(v) => setS((p) => ({ ...p, payments: { ...p.payments, codAdvance: { ...p.payments?.codAdvance, enabled: v } } }))} />
            {s.payments?.codAdvance?.enabled && (
              <Field field={{ label: 'Advance percent (%)', type: 'number', help: '% of the order total the customer pays upfront on WhatsApp.' }} value={s.payments?.codAdvance?.percent ?? 5} onChange={(v) => setS((p) => ({ ...p, payments: { ...p.payments, codAdvance: { ...p.payments?.codAdvance, percent: v === '' ? 0 : Number(v) } } }))} />
            )}
          </div>
        </div>
      </Section>
      )}

      {tab === 'payments' && (
      <Section title="Direct UPI (QR)" subtitle="No gateway needed. Customer scans your QR / pays to your UPI ID, then submits the reference number. You verify it against your bank statement and mark the order paid.">
        <div className="space-y-3">
          <Field field={{ label: 'Enable direct UPI payments', type: 'toggle' }} value={!!s.payments?.upi?.enabled} onChange={(v) => setS((p) => ({ ...p, payments: { ...p.payments, upi: { ...p.payments?.upi, enabled: v } } }))} />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field field={{ label: 'Your UPI ID (VPA)', placeholder: 'name@okaxis', help: 'Where customers send money' }} value={s.payments?.upi?.vpa || ''} onChange={(v) => setS((p) => ({ ...p, payments: { ...p.payments, upi: { ...p.payments?.upi, vpa: v.trim() } } }))} />
            <Field field={{ label: 'Payee name', placeholder: 'Shubra Jewels', help: 'Shown in the customer’s UPI app' }} value={s.payments?.upi?.payeeName || ''} onChange={(v) => setS((p) => ({ ...p, payments: { ...p.payments, upi: { ...p.payments?.upi, payeeName: v } } }))} />
          </div>
          <p className="text-xs text-zinc-400">Tip: use a UPI ID you can monitor (e.g. a dedicated one). The order number rides along in the payment note so you can match it easily.</p>
        </div>
      </Section>
      )}

      {tab === 'story' && (
      <Section title="Our Story Page" subtitle="The full About / Our Story page — image, heading, story text, and value cards.">
        <AboutEditor value={s.about} onChange={(v) => set('about', v)} />
      </Section>
      )}

      {tab === 'content' && (
      <Section title="Text & Content" subtitle="Navigation, footer, page headings and button labels across the storefront.">
        <ContentEditor value={s.content} onChange={(v) => set('content', v)} />
      </Section>
      )}

      {tab === 'policies' && (
      <Section title="Legal Pages" subtitle="Privacy, Terms, Refund/Return and Shipping. These are linked in the footer and are usually required by payment gateways (Razorpay) and Indian e-commerce rules.">
        <PoliciesEditor value={s.content} onChange={(v) => set('content', v)} />
      </Section>
      )}

      {tab === 'theme' && (
      <Section title="Theme & Colours" subtitle="Pick a preset or fine-tune each colour individually. Changes apply live after saving.">

        {/* Preset grid */}
        <div className="mb-6">
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3 flex items-center gap-1.5">
            <Palette size={13} /> Preset Palettes
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
            {PRESETS.map((preset, i) => {
              const isActive = activePreset === i
              return (
                <button
                  key={preset.name}
                  onClick={() => applyPreset(preset)}
                  className="group relative text-left rounded-2xl border-2 p-3 transition-all duration-200 cursor-pointer hover:shadow-md"
                  style={{
                    borderColor: isActive ? preset.colors.maroon : 'transparent',
                    background: preset.colors.cream,
                    boxShadow: isActive ? `0 0 0 2px ${preset.colors.maroon}` : undefined,
                  }}
                  title={`Apply ${preset.name}`}
                >
                  {/* Mini palette strip */}
                  <div className="flex gap-1 mb-2.5">
                    {[preset.colors.maroon, preset.colors.gold, preset.colors.beige, preset.colors.ink].map((c, ci) => (
                      <div key={ci} className="flex-1 h-5 rounded-md first:rounded-l-xl last:rounded-r-xl" style={{ background: c }} />
                    ))}
                  </div>
                  <p className="text-xs font-bold leading-tight" style={{ color: preset.colors.ink }}>{preset.name}</p>
                  <p className="text-[10px] opacity-60 leading-tight mt-0.5" style={{ color: preset.colors.ink }}>{preset.desc}</p>
                  {isActive && (
                    <div className="absolute top-2 right-2 w-5 h-5 rounded-full flex items-center justify-center" style={{ background: preset.colors.maroon }}>
                      <Check size={11} color="#fff" />
                    </div>
                  )}
                </button>
              )
            })}
          </div>
        </div>

        {/* Individual pickers */}
        <div>
          <p className="text-xs font-semibold text-zinc-400 uppercase tracking-wider mb-3">Fine-tune Individual Colours</p>
          <div className="grid sm:grid-cols-2 gap-3">
            {THEME_KEYS.map(({ key, label }) => (
              <ColorPicker
                key={key}
                label={label}
                value={s.theme?.[key] || '#000000'}
                onChange={(v) => setTheme(key, v)}
              />
            ))}
          </div>
        </div>
      </Section>
      )}

      <div className="flex justify-end mt-6">
        <Btn onClick={save} disabled={saving}>{saved ? <><Check size={16} /> Saved</> : saving ? 'Saving…' : 'Save Changes'}</Btn>
      </div>
    </div>
  )
}

/* Large, clickable color picker with swatch + hex input */
function ColorPicker({ label, value, onChange }) {
  const ref = useRef(null)
  return (
    <div className="flex items-center gap-3 p-3 rounded-xl border border-zinc-200 dark:border-zinc-700 bg-white dark:bg-zinc-900">
      {/* Big swatch — clicking opens the native color picker */}
      <button
        type="button"
        onClick={() => ref.current?.click()}
        className="relative w-12 h-12 rounded-xl flex-shrink-0 border-2 border-white shadow-md ring-1 ring-zinc-200 cursor-pointer transition-transform hover:scale-105"
        style={{ background: value }}
        title="Click to pick colour"
      >
        <input
          ref={ref}
          type="color"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
        />
      </button>
      <div className="flex-1 min-w-0">
        <p className="text-xs font-medium text-zinc-500 dark:text-zinc-400 mb-1">{label}</p>
        <input
          type="text"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          className="w-full font-mono text-sm px-2 py-1 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-100"
          placeholder="#7B1E2B"
          maxLength={7}
        />
      </div>
    </div>
  )
}

function Section({ title, subtitle, children }) {
  return (
    <div className="admin-card p-6 mb-5">
      <h2 className="font-semibold text-lg text-dark-900 dark:text-cream-50">{title}</h2>
      {subtitle && <p className="text-xs text-stone-400 mb-4">{subtitle}</p>}
      <div className={subtitle ? '' : 'mt-4'}>{children}</div>
    </div>
  )
}

function ShippingEditor({ value, onChange }) {
  const s = value || { cities: [], defaultCharge: 0, freeAboveSubtotal: 0 }
  const cities = s.cities || []
  const patch = (p) => onChange({ ...s, ...p })
  const setCity = (i, k, v) => patch({ cities: cities.map((c, idx) => (idx === i ? { ...c, [k]: v } : c)) })
  const addCity = () => patch({ cities: [...cities, { name: '', charge: 0 }] })
  const removeCity = (i) => patch({ cities: cities.filter((_, idx) => idx !== i) })

  return (
    <div className="space-y-5">
      <div className="grid sm:grid-cols-2 gap-4">
        <Field field={{ label: 'Base delivery charge (₹)', type: 'number', help: 'Applied to any city not listed below' }} value={s.defaultCharge} onChange={(v) => patch({ defaultCharge: v })} />
        <Field field={{ label: 'Free above order value (₹)', type: 'number', help: '0 = off. Free shipping when subtotal ≥ this' }} value={s.freeAboveSubtotal} onChange={(v) => patch({ freeAboveSubtotal: v })} />
      </div>

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[13px] font-semibold text-zinc-700">City overrides <span className="text-zinc-400 font-normal">(₹0 = free · e.g. “Delhi” also covers North/South/West Delhi & the state)</span></p>
          <Btn variant="outline" onClick={addCity}>+ Add city</Btn>
        </div>
        {cities.length === 0 && <p className="text-xs text-zinc-400">No overrides — every city pays the base charge.</p>}
        <div className="space-y-2">
          {cities.map((c, i) => (
            <div key={i} className="flex items-center gap-2">
              <input
                value={c.name}
                onChange={(e) => setCity(i, 'name', e.target.value)}
                list="admin-in-cities"
                placeholder="City"
                className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-zinc-300 bg-white text-sm outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--gold)_28%,transparent)]"
              />
              <div className="flex items-center gap-1 shrink-0">
                <span className="text-zinc-400 text-sm">₹</span>
                <input
                  type="number"
                  value={c.charge}
                  onChange={(e) => setCity(i, 'charge', e.target.value === '' ? '' : Number(e.target.value))}
                  placeholder="0"
                  className="w-24 px-3 py-2 rounded-lg border border-zinc-300 bg-white text-sm outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--gold)_28%,transparent)]"
                />
              </div>
              <button onClick={() => removeCity(i)} className="w-9 h-9 grid place-items-center rounded-lg text-zinc-400 hover:text-red-500 hover:bg-zinc-100 cursor-pointer shrink-0"><X size={16} /></button>
            </div>
          ))}
        </div>
        <datalist id="admin-in-cities">{INDIAN_CITIES.map((c) => <option key={c} value={c} />)}</datalist>
      </div>
    </div>
  )
}

// A small reusable list-of-links editor ({ label, to }).
function LinkListEditor({ items, onChange, toLabel = 'Link (path)' }) {
  const set = (i, k, v) => onChange(items.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)))
  const add = () => onChange([...items, { label: '', to: '' }])
  const remove = (i) => onChange(items.filter((_, idx) => idx !== i))
  return (
    <div className="space-y-2">
      {items.map((it, i) => (
        <div key={i} className="flex items-center gap-2">
          <input value={it.label} onChange={(e) => set(i, 'label', e.target.value)} placeholder="Label"
            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-zinc-300 bg-white text-sm outline-none focus:border-[var(--gold)]" />
          <input value={it.to} onChange={(e) => set(i, 'to', e.target.value)} placeholder={toLabel}
            className="flex-1 min-w-0 px-3 py-2 rounded-lg border border-zinc-300 bg-white text-sm outline-none focus:border-[var(--gold)]" />
          <button onClick={() => remove(i)} className="w-9 h-9 grid place-items-center rounded-lg text-zinc-400 hover:text-red-500 hover:bg-zinc-100 cursor-pointer shrink-0"><X size={16} /></button>
        </div>
      ))}
      <Btn variant="outline" onClick={add}>+ Add</Btn>
    </div>
  )
}

function Group({ title, children }) {
  return (
    <div className="rounded-xl border border-zinc-200 p-4">
      <p className="text-[13px] font-bold text-zinc-800 mb-3">{title}</p>
      {children}
    </div>
  )
}

function ContentEditor({ value, onChange }) {
  const c = resolveContent(value)
  const patch = (upd) => onChange({ ...c, ...upd })
  const patchPage = (page, upd) => patch({ pages: { ...c.pages, [page]: { ...c.pages[page], ...upd } } })
  const P = c.pages

  return (
    <div className="space-y-4">
      <Group title="Navigation menu">
        <LinkListEditor items={c.nav} onChange={(nav) => patch({ nav })} />
      </Group>

      <Group title="Footer">
        <div className="grid sm:grid-cols-2 gap-3 mb-3">
          <Field field={{ label: 'Company column heading' }} value={c.footer.companyHeading} onChange={(v) => patch({ footer: { ...c.footer, companyHeading: v } })} />
          <Field field={{ label: 'Contact column heading' }} value={c.footer.reachHeading} onChange={(v) => patch({ footer: { ...c.footer, reachHeading: v } })} />
        </div>
        <p className="text-xs font-semibold text-zinc-500 mb-1.5">Company links</p>
        <LinkListEditor items={c.footer.links} onChange={(links) => patch({ footer: { ...c.footer, links } })} />
        <div className="mt-3">
          <Field field={{ label: 'Copyright line', help: 'Leave blank for "© year brand. slogan"' }} value={c.footer.copyright} onChange={(v) => patch({ footer: { ...c.footer, copyright: v } })} />
        </div>
      </Group>

      <Group title="Buttons & labels">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field field={{ label: 'Add to bag' }} value={c.product.addToBag} onChange={(v) => patch({ product: { ...c.product, addToBag: v } })} />
          <Field field={{ label: 'Sold out' }} value={c.product.soldOut} onChange={(v) => patch({ product: { ...c.product, soldOut: v } })} />
          <Field field={{ label: 'Product packaging note' }} value={c.product.packagingNote} onChange={(v) => patch({ product: { ...c.product, packagingNote: v } })} />
          <Field field={{ label: 'Home “view all” button' }} value={c.home.ctaViewAll} onChange={(v) => patch({ home: { ...c.home, ctaViewAll: v } })} />
          <Field field={{ label: 'Home “story” button' }} value={c.home.ctaStory} onChange={(v) => patch({ home: { ...c.home, ctaStory: v } })} />
          <Field field={{ label: 'Home “see all” button' }} value={c.home.ctaSeeAll} onChange={(v) => patch({ home: { ...c.home, ctaSeeAll: v } })} />
        </div>
      </Group>

      <Group title="Jhumkas (products) page">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field field={{ label: 'Eyebrow' }} value={P.products.eyebrow} onChange={(v) => patchPage('products', { eyebrow: v })} />
          <div />
          <Field field={{ label: 'Default title' }} value={P.products.titleAll} onChange={(v) => patchPage('products', { titleAll: v })} />
          <Field field={{ label: 'Default title (Hindi)' }} value={P.products.hindiAll} onChange={(v) => patchPage('products', { hindiAll: v })} />
          <Field field={{ label: 'Under-599 title' }} value={P.products.titleUnder599} onChange={(v) => patchPage('products', { titleUnder599: v })} />
          <Field field={{ label: 'Under-599 title (Hindi)' }} value={P.products.hindiUnder599} onChange={(v) => patchPage('products', { hindiUnder599: v })} />
        </div>
      </Group>

      <Group title="Collections page">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field field={{ label: 'Heading' }} value={P.collections.heading} onChange={(v) => patchPage('collections', { heading: v })} />
          <Field field={{ label: 'Heading (Hindi)' }} value={P.collections.hindi} onChange={(v) => patchPage('collections', { hindi: v })} />
          <Field field={{ label: 'New Arrivals eyebrow' }} value={P.collections.naEyebrow} onChange={(v) => patchPage('collections', { naEyebrow: v })} />
          <Field field={{ label: 'New Arrivals title' }} value={P.collections.naTitle} onChange={(v) => patchPage('collections', { naTitle: v })} />
          <Field field={{ label: 'New Arrivals (Hindi)' }} value={P.collections.naHindi} onChange={(v) => patchPage('collections', { naHindi: v })} />
        </div>
      </Group>

      <Group title="Contact page">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field field={{ label: 'Eyebrow' }} value={P.contact.eyebrow} onChange={(v) => patchPage('contact', { eyebrow: v })} />
          <Field field={{ label: 'Heading (Hindi)' }} value={P.contact.hindi} onChange={(v) => patchPage('contact', { hindi: v })} />
          <div className="sm:col-span-2"><Field field={{ label: 'Heading' }} value={P.contact.heading} onChange={(v) => patchPage('contact', { heading: v })} /></div>
          <Field field={{ label: 'WhatsApp box heading' }} value={P.contact.waHeading} onChange={(v) => patchPage('contact', { waHeading: v })} />
          <Field field={{ label: 'WhatsApp box subtext' }} value={P.contact.waSubtext} onChange={(v) => patchPage('contact', { waSubtext: v })} />
        </div>
      </Group>

      <Group title="Our Story page (heading only — rest in the “Our Story” tab)">
        <Field field={{ label: 'Eyebrow' }} value={P.about.eyebrow} onChange={(v) => patchPage('about', { eyebrow: v })} />
      </Group>
    </div>
  )
}

function PoliciesEditor({ value, onChange }) {
  const c = resolveContent(value)
  const P = c.policies
  const setPolicy = (key, upd) => onChange({ ...c, policies: { ...c.policies, [key]: { ...c.policies[key], ...upd } } })
  const items = [
    ['privacy', 'Privacy Policy'],
    ['terms', 'Terms & Conditions'],
    ['refund', 'Refund & Return Policy'],
    ['shipping', 'Shipping Policy'],
  ]
  return (
    <div className="space-y-4">
      <p className="text-xs text-stone-500 leading-relaxed">
        Formatting: start a line with <code className="px-1 rounded bg-zinc-100">## </code> for a sub-heading and
        <code className="px-1 rounded bg-zinc-100">- </code> for a bullet. Blank lines separate paragraphs.
        Placeholders <code className="px-1 rounded bg-zinc-100">{'{brand}'}</code>, <code className="px-1 rounded bg-zinc-100">{'{email}'}</code>,
        <code className="px-1 rounded bg-zinc-100">{'{phone}'}</code>, <code className="px-1 rounded bg-zinc-100">{'{whatsapp}'}</code> and
        <code className="px-1 rounded bg-zinc-100">{'{city}'}</code> fill in automatically from your Contact & Shipping settings.
      </p>
      {items.map(([key, label]) => (
        <Group key={key} title={label}>
          <Field field={{ label: 'Page title' }} value={P[key].title} onChange={(v) => setPolicy(key, { title: v })} />
          <div className="mt-3">
            <Field field={{ label: 'Content', type: 'textarea', rows: 12 }} value={P[key].body} onChange={(v) => setPolicy(key, { body: v })} />
          </div>
        </Group>
      ))}
    </div>
  )
}

function AboutEditor({ value, onChange }) {
  const a = resolveAbout(value)
  // Spread the RAW value (not the resolved one) so cleared fields — an empty
  // image, or an emptied cards/paragraphs list — aren't re-filled with defaults
  // when another field is edited.
  const patch = (p) => onChange({ ...(value || {}), ...p })
  const setVal = (i, k, v) => patch({ values: a.values.map((x, idx) => (idx === i ? { ...x, [k]: v } : x)) })
  const addVal = () => patch({ values: [...a.values, { icon: 'Sparkles', title: '', text: '' }] })
  const removeVal = (i) => patch({ values: a.values.filter((_, idx) => idx !== i) })

  return (
    <div className="space-y-4">
      {/* Use the RAW stored image (not resolved) so removing it sticks — resolveAbout
          falls back to the default on empty, which would otherwise re-fill instantly. */}
      <MediaUploader label="Story image" value={value?.image ?? a.image} onChange={(v) => patch({ image: v })} accept="image" />
      <div className="grid sm:grid-cols-2 gap-4">
        <Field field={{ label: 'Section eyebrow', help: 'Small label above the heading' }} value={a.eyebrow} onChange={(v) => patch({ eyebrow: v })} />
        <Field field={{ label: 'Heading' }} value={a.heading} onChange={(v) => patch({ heading: v })} />
      </div>
      <Field field={{ label: 'Story paragraphs (one per line)', type: 'lines', rows: 5, help: 'Use {brand} to insert the brand name.' }} value={a.paragraphs} onChange={(v) => patch({ paragraphs: v })} />

      <div>
        <div className="flex items-center justify-between mb-2">
          <p className="text-[13px] font-semibold text-zinc-700">Value cards</p>
          <Btn variant="outline" onClick={addVal}>+ Add card</Btn>
        </div>
        <div className="space-y-3">
          {a.values.map((v, i) => (
            <div key={i} className="rounded-xl border border-zinc-200 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs text-zinc-400">Card {i + 1}</span>
                <button onClick={() => removeVal(i)} className="w-8 h-8 grid place-items-center rounded-lg text-zinc-400 hover:text-red-500 hover:bg-zinc-100 cursor-pointer"><X size={15} /></button>
              </div>
              <div className="grid sm:grid-cols-[150px_1fr] gap-2">
                <Field field={{ label: 'Icon', type: 'select', options: VALUE_ICON_NAMES }} value={v.icon} onChange={(val) => setVal(i, 'icon', val)} />
                <Field field={{ label: 'Title' }} value={v.title} onChange={(val) => setVal(i, 'title', val)} />
              </div>
              <Field field={{ label: 'Text', type: 'textarea', rows: 2 }} value={v.text} onChange={(val) => setVal(i, 'text', val)} />
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}
