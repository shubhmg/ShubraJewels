import { useEffect, useState, useRef } from 'react'
import { Loader2, Check, Palette } from 'lucide-react'
import { api } from '../../lib/api.js'
import { AdminHeader, Btn, Field } from '../../components/admin/AdminUI.jsx'
import { MediaUploader } from '../../components/admin/MediaUploader.jsx'
import { useSettingsCtx } from '../../lib/SettingsProvider.jsx'

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

  useEffect(() => { api.get('/settings').then(setS) }, [])

  const set = (k, v) => setS((p) => ({ ...p, [k]: v }))
  const setTheme = (k, v) => setS((p) => ({ ...p, theme: { ...p.theme, [k]: v } }))
  const applyPreset = (preset) => setS((p) => ({ ...p, theme: { ...p.theme, ...preset.colors } }))

  const save = async () => {
    setSaving(true)
    try {
      await api.patch('/settings', s, { auth: true })
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

      <Section title="Ordering & Contact">
        <div className="grid sm:grid-cols-2 gap-4">
          <Field field={{ label: 'WhatsApp number', help: 'With country code, digits only e.g. 919812345678' }} value={s.whatsappNumber} onChange={(v) => set('whatsappNumber', v)} />
          <Field field={{ label: 'WhatsApp default message' }} value={s.whatsappMessage} onChange={(v) => set('whatsappMessage', v)} />
          <Field field={{ label: 'Phone' }} value={s.phone} onChange={(v) => set('phone', v)} />
          <Field field={{ label: 'Email' }} value={s.email} onChange={(v) => set('email', v)} />
          <Field field={{ label: 'Free shipping city' }} value={s.freeShippingCity} onChange={(v) => set('freeShippingCity', v)} />
          <Field field={{ label: 'Shipping note' }} value={s.shippingNote} onChange={(v) => set('shippingNote', v)} />
          <Field field={{ label: 'Announcement strip' }} value={s.announcement} onChange={(v) => set('announcement', v)} />
        </div>
      </Section>

      <Section title="Payment Methods" subtitle="Which checkout options customers see.">
        <div className="space-y-1">
          <Field field={{ label: 'Pay online (Razorpay — UPI, cards, netbanking)', type: 'toggle' }} value={s.payments?.razorpay !== false} onChange={(v) => setS((p) => ({ ...p, payments: { ...p.payments, razorpay: v } }))} />
          <Field field={{ label: 'Pay on delivery (COD)', type: 'toggle' }} value={s.payments?.cod !== false} onChange={(v) => setS((p) => ({ ...p, payments: { ...p.payments, cod: v } }))} />
          <p className="text-xs text-zinc-400 pt-1">WhatsApp ordering is always available.</p>
        </div>
      </Section>

      <Section title="Social Links">
        <div className="grid sm:grid-cols-3 gap-4">
          <Field field={{ label: 'Instagram URL' }} value={s.instagramUrl || s.instagram || ''} onChange={(v) => setS((p) => ({ ...p, instagramUrl: v, instagram: v }))} />
          <Field field={{ label: 'Facebook URL' }} value={s.facebook} onChange={(v) => set('facebook', v)} />
          <Field field={{ label: 'YouTube URL' }} value={s.youtube} onChange={(v) => set('youtube', v)} />
        </div>
      </Section>

      {/* ── Theme ──────────────────────────────────────────────────── */}
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
