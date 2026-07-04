import { useEffect, useState } from 'react'
import { Loader2, Check } from 'lucide-react'
import { api } from '../../lib/api.js'
import { AdminHeader, Btn, Field } from '../../components/admin/AdminUI.jsx'
import { MediaUploader } from '../../components/admin/MediaUploader.jsx'
import { useSettingsCtx } from '../../lib/SettingsProvider.jsx'

const THEME_KEYS = [
  { key: 'maroon', label: 'Maroon (primary)' },
  { key: 'maroonDark', label: 'Maroon dark' },
  { key: 'gold', label: 'Gold' },
  { key: 'goldLight', label: 'Gold light' },
  { key: 'beige', label: 'Beige' },
  { key: 'cream', label: 'Cream (background)' },
  { key: 'ink', label: 'Ink (text)' },
]

export function AdminSettings() {
  const { refresh } = useSettingsCtx()
  const [s, setS] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)

  useEffect(() => { api.get('/settings').then(setS) }, [])

  const set = (k, v) => setS((p) => ({ ...p, [k]: v }))
  const setTheme = (k, v) => setS((p) => ({ ...p, theme: { ...p.theme, [k]: v } }))

  const save = async () => {
    setSaving(true)
    try {
      await api.patch('/settings', s, { auth: true })
      await refresh() // re-applies theme + brand across the site immediately
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } finally {
      setSaving(false)
    }
  }

  if (!s) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gold-500" /></div>

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

      <Section title="Social Links">
        <div className="grid sm:grid-cols-3 gap-4">
          <Field field={{ label: 'Instagram URL' }} value={s.instagram} onChange={(v) => set('instagram', v)} />
          <Field field={{ label: 'Facebook URL' }} value={s.facebook} onChange={(v) => set('facebook', v)} />
          <Field field={{ label: 'YouTube URL' }} value={s.youtube} onChange={(v) => set('youtube', v)} />
        </div>
      </Section>

      <Section title="Theme Colours" subtitle="These retint the entire storefront live.">
        <div className="grid sm:grid-cols-2 gap-4">
          {THEME_KEYS.map(({ key, label }) => (
            <Field key={key} field={{ label, type: 'color' }} value={s.theme?.[key]} onChange={(v) => setTheme(key, v)} />
          ))}
        </div>
        <div className="mt-4 flex gap-2 flex-wrap">
          {THEME_KEYS.map(({ key }) => (
            <div key={key} className="w-10 h-10 rounded-lg border border-stone-200 dark:border-stone-700" style={{ background: s.theme?.[key] }} title={key} />
          ))}
        </div>
      </Section>

      <div className="flex justify-end mt-6">
        <Btn onClick={save} disabled={saving}>{saved ? <><Check size={16} /> Saved</> : saving ? 'Saving…' : 'Save Changes'}</Btn>
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
