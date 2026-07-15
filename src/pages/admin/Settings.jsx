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
  { id: 'payments', label: 'Payments & Shipping' },
  { id: 'notifications', label: 'Notifications' },
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
  const [tgTest, setTgTest] = useState(null) // { ok, msg } after a test send
  const [srTest, setSrTest] = useState(null) // Shiprocket connection test result

  // Admin endpoint returns secrets (Telegram + Shiprocket) the public GET strips.
  useEffect(() => { api.get('/settings/admin', { auth: true }).then(setS) }, [])

  const setTg = (k, v) => setS((p) => ({ ...p, notifications: { ...p.notifications, telegram: { ...p.notifications?.telegram, [k]: v } } }))
  const setSr = (k, v) => setS((p) => ({ ...p, shiprocket: { ...p.shiprocket, [k]: v } }))

  const testShiprocket = async () => {
    setSrTest({ loading: true })
    try {
      await api.patch('/settings', { shiprocket: s.shiprocket }, { auth: true }) // save first so the test uses current values
      await api.post('/settings/test-shiprocket', {}, { auth: true })
      setSrTest({ ok: true, msg: 'Connected ✓  Shiprocket login works.' })
    } catch (e) {
      setSrTest({ ok: false, msg: e.message || 'Login failed. Check the email and API password.' })
    }
  }

  const testTelegram = async () => {
    setTgTest({ loading: true })
    try {
      await api.patch('/settings', { notifications: s.notifications }, { auth: true }) // save first so the test uses current values
      await api.post('/settings/test-telegram', {}, { auth: true })
      setTgTest({ ok: true, msg: 'Sent! Check your Telegram.' })
    } catch (e) {
      setTgTest({ ok: false, msg: e.message || 'Could not send.' })
    }
  }

  const set = (k, v) => setS((p) => ({ ...p, [k]: v }))
  const setTheme = (k, v) => setS((p) => ({ ...p, theme: { ...p.theme, [k]: v } }))
  const applyPreset = (preset) => setS((p) => ({ ...p, theme: { ...p.theme, ...preset.colors } }))

  const save = async () => {
    setSaving(true)
    try {
      // Coerce numeric fields (which may be '' while typing) to numbers.
      const sh = s.shipping || {}
      const pay = s.payments || {}
      const payload = {
        ...s,
        shipping: {
          ...sh,
          defaultCharge: Number(sh.defaultCharge) || 0,
          freeAboveSubtotal: Number(sh.freeAboveSubtotal) || 0,
          cities: (sh.cities || []).filter((c) => c.name?.trim()).map((c) => ({ name: c.name.trim(), charge: Number(c.charge) || 0 })),
        },
        payments: {
          ...pay,
          codFee: Number(pay.codFee) || 0,
          codAdvance: { ...(pay.codAdvance || {}), percent: Number(pay.codAdvance?.percent) || 0 },
        },
        ...(s.shiprocket ? { shiprocket: {
          ...s.shiprocket,
          defaultWeightKg: Number(s.shiprocket.defaultWeightKg) || 0.3,
          length: Number(s.shiprocket.length) || 12,
          breadth: Number(s.shiprocket.breadth) || 10,
          height: Number(s.shiprocket.height) || 5,
        } } : {}),
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
        <div className="mt-2">
          <Field field={{ label: 'Show "Message us on WhatsApp" on the Contact page', type: 'toggle', help: 'Off = the WhatsApp enquiry form is hidden on the Contact page (customers still see phone, email and socials).' }} value={s.showWhatsappContact !== false} onChange={(v) => set('showWhatsappContact', v)} />
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

      {tab === 'payments' && (
      <Section title="Payments & Shipping">
        {/* How a customer's total is built — the mental model for everything below */}
        <div className="rounded-xl p-4 mb-6 text-sm" style={{ background: 'color-mix(in srgb, var(--gold, #C9A84C) 12%, transparent)', border: '1px solid color-mix(in srgb, var(--gold, #C9A84C) 35%, transparent)' }}>
          <p className="font-semibold text-zinc-800">How a customer's total is calculated</p>
          <p className="mt-1.5 font-mono text-[13px] text-zinc-700">Items − Discount + Shipping + COD fee</p>
          <ul className="mt-2 space-y-1 text-[13px] text-zinc-600 list-disc pl-5">
            <li><b>Shipping</b> = the base rule in §2 (per-city, or free above a value).</li>
            <li>Paying online can <b>waive shipping</b> if you enable that reward in §3.</li>
            <li><b>COD</b> pays the base shipping <b>plus</b> the COD fee, and can require a small advance paid online.</li>
          </ul>
        </div>

        {/* 1 — methods */}
        <p className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold mb-2">1 · Payment methods customers can choose</p>
        <div className="space-y-1 mb-7">
          <Field field={{ label: 'Pay online (Razorpay — UPI, cards, netbanking)', type: 'toggle' }} value={s.payments?.razorpay !== false} onChange={(v) => setS((p) => ({ ...p, payments: { ...p.payments, razorpay: v } }))} />
          <Field field={{ label: 'Cash on Delivery (COD)', type: 'toggle' }} value={s.payments?.cod !== false} onChange={(v) => setS((p) => ({ ...p, payments: { ...p.payments, cod: v } }))} />
        </div>

        {/* 2 — base shipping */}
        <p className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold mb-2">2 · Shipping charges</p>
        <p className="text-xs text-zinc-500 mb-3">The base delivery fee every order pays — unless it qualifies for free shipping (a rule here, or the prepaid reward in §3).</p>
        <div className="mb-7"><ShippingEditor value={s.shipping} onChange={(v) => set('shipping', v)} /></div>

        {/* 3 — COD fee + prepaid incentives */}
        <p className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold mb-2">3 · COD fee & prepaid incentives</p>
        <p className="text-xs text-zinc-500 mb-3">Layered on top of shipping to cut fake COD orders and reward paying now. All optional — leave at 0 / off to ignore.</p>
        <div className="space-y-4 mb-7">
          <Field field={{ label: 'COD fee (₹)', type: 'number', help: 'Added ONLY to Cash-on-Delivery orders, on top of the base shipping above. 0 = no fee.' }} value={s.payments?.codFee || 0} onChange={(v) => setS((p) => ({ ...p, payments: { ...p.payments, codFee: v === '' ? 0 : Number(v) } }))} />
          <Field field={{ label: 'Free shipping when paying online', type: 'toggle', help: 'When on, prepaid (online) orders pay ₹0 shipping (COD still pays the base shipping). Makes prepaying cheaper than COD.' }} value={!!s.payments?.prepaidFreeShipping} onChange={(v) => setS((p) => ({ ...p, payments: { ...p.payments, prepaidFreeShipping: v } }))} />
          <div className="rounded-xl border border-zinc-200 p-3.5 space-y-3">
            <Field field={{ label: 'Require an advance on COD', type: 'toggle', help: 'Ask the customer to pay a small % of the total online (Razorpay) to confirm a COD order — cuts fake orders / returns. This is NOT an extra charge; it is part of the total, paid early. The balance is collected on delivery.' }} value={!!s.payments?.codAdvance?.enabled} onChange={(v) => setS((p) => ({ ...p, payments: { ...p.payments, codAdvance: { ...p.payments?.codAdvance, enabled: v } } }))} />
            {s.payments?.codAdvance?.enabled && (
              <Field field={{ label: 'Advance percent (%)', type: 'number', placeholder: '5', help: '% of the order total paid upfront online. The rest is collected on delivery.' }} value={s.payments?.codAdvance?.percent ?? ''} onChange={(v) => setS((p) => ({ ...p, payments: { ...p.payments, codAdvance: { ...p.payments?.codAdvance, percent: v === '' ? '' : Number(v) } } }))} />
            )}
          </div>
        </div>
      </Section>
      )}

      {tab === 'payments' && (
      <Section title="Shipping Routing" subtitle="How each order should be shipped. The ship dialog opens on the recommended option and tags it — you can always switch on any specific order.">
        <div className="grid sm:grid-cols-2 gap-2.5">
          {[
            { v: 'all', title: 'Courier for everything', desc: 'Every order recommends Shiprocket.' },
            { v: 'cod', title: 'Courier for COD only', desc: 'COD → Shiprocket. Prepaid → manual note.' },
            { v: 'prepaid', title: 'Courier for prepaid only', desc: 'Prepaid → Shiprocket. COD → manual note.' },
            { v: 'manual', title: 'No recommendation', desc: 'Ask on every order, nothing preselected.' },
          ].map(({ v, title, desc }) => {
            const on = (s.shippingRouting || s.shiprocket?.policy || 'manual') === v
            return (
              <button
                key={v}
                onClick={() => set('shippingRouting', v)}
                className="text-left rounded-2xl p-4 cursor-pointer transition-all"
                style={on
                  ? { background: 'color-mix(in srgb, var(--maroon) 7%, white)', boxShadow: 'inset 0 0 0 2px var(--maroon)' }
                  : { background: '#fff', boxShadow: 'inset 0 0 0 1px #e4e4e7' }}
              >
                <div className="flex items-center justify-between gap-2">
                  <p className="text-[14px] font-bold" style={{ color: on ? 'var(--maroon)' : '#3f3f46' }}>{title}</p>
                  {on && <Check size={16} strokeWidth={3} style={{ color: 'var(--maroon)' }} className="shrink-0" />}
                </div>
                <p className="text-[12px] text-zinc-500 mt-1 leading-relaxed">{desc}</p>
              </button>
            )
          })}
        </div>
      </Section>
      )}

      {tab === 'payments' && (
      <Section title="Shiprocket Shipping (automated)" subtitle="Book couriers through Shiprocket (Delhivery, Bluedart, Xpressbees & more under one account). Credentials are private and never shown on the website.">
        <div className="rounded-xl p-4 mb-5 text-sm leading-relaxed" style={{ background: 'color-mix(in srgb, var(--gold) 10%, transparent)', color: 'var(--ink)' }}>
          <p className="font-semibold mb-1.5">One-time setup</p>
          <ol className="list-decimal ml-5 space-y-1 text-zinc-600 text-[13px]">
            <li>In Shiprocket → <b>Settings → API → Configure</b>, create an <b>API user</b> (a separate email + password just for the API).</li>
            <li>Add a <b>Pickup Location</b> in Shiprocket (Settings → Pickup Addresses) and note its <b>nickname</b> + PIN.</li>
            <li>Paste them below, pick a policy, and hit <b>Test connection</b>.</li>
          </ol>
        </div>

        <div className="space-y-4">
          <Field field={{ label: 'Enable Shiprocket integration', type: 'toggle' }} value={!!s.shiprocket?.enabled} onChange={(v) => setSr('enabled', v)} />

          {s.shiprocket?.enabled && (
            <>
              <div className="grid sm:grid-cols-2 gap-3">
                <Field field={{ label: 'API user email', placeholder: 'api-user@…', help: 'The dedicated API user, not your main login. Kept private.' }} value={s.shiprocket?.email || ''} onChange={(v) => setSr('email', v.trim())} />
                <Field field={{ label: 'API password', type: 'password', placeholder: '••••••••', help: 'The API user’s password. Stored privately, never shown on the site.' }} value={s.shiprocket?.password || ''} onChange={(v) => setSr('password', v)} />
              </div>

              <div className="grid sm:grid-cols-2 gap-3">
                <Field field={{ label: 'Pickup location nickname', placeholder: 'e.g. Primary', help: 'Exactly as named in Shiprocket → Pickup Addresses.' }} value={s.shiprocket?.pickupLocation || ''} onChange={(v) => setSr('pickupLocation', v)} />
                <Field field={{ label: 'Pickup PIN', placeholder: '302001', help: 'Your pickup pincode — used to check serviceability.' }} value={s.shiprocket?.pickupPin || ''} onChange={(v) => setSr('pickupPin', v)} />
              </div>

              <Field field={{ label: 'Auto-schedule courier pickup on booking', type: 'toggle', help: 'When ON, booking a shipment immediately requests a courier pickup. Keep OFF while testing (so no courier is summoned) — turn ON for live orders, or schedule pickups from the Shiprocket dashboard.' }} value={!!s.shiprocket?.autoPickup} onChange={(v) => setSr('autoPickup', v)} />

              <div className="rounded-xl border border-zinc-200 p-3.5 space-y-3">
                <p className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold">Status webhook (auto-mark delivered)</p>
                <p className="text-xs text-zinc-500 -mt-1">Shiprocket pushes every tracking update to your site — orders mark themselves Delivered (and COD flips to paid) with zero clicks. Setup: in Shiprocket → <b>Settings → API → Webhooks</b>, add the URL below and set the <b>x-api-key</b> header to your token.</p>
                <div className="flex items-center gap-2">
                  <code className="flex-1 min-w-0 truncate text-[12px] bg-zinc-50 rounded-lg px-3 py-2 text-zinc-600">{`${window.location.origin}/api/orders/courier-webhook`}</code>
                  <Btn variant="outline" onClick={() => navigator.clipboard?.writeText(`${window.location.origin}/api/orders/courier-webhook`)}>Copy</Btn>
                </div>
                <Field field={{ label: 'Webhook token (x-api-key)', type: 'password', placeholder: 'Any long random string', help: 'Must match the token you set in Shiprocket. Leave empty to keep the webhook disabled.' }} value={s.shiprocket?.webhookToken || ''} onChange={(v) => setSr('webhookToken', v.trim())} />
                {!s.shiprocket?.webhookToken && (
                  <Btn variant="outline" onClick={() => setSr('webhookToken', (crypto.randomUUID ? crypto.randomUUID().replace(/-/g, '') : Math.random().toString(36).slice(2) + Math.random().toString(36).slice(2)))}>Generate token</Btn>
                )}
              </div>

              <div className="rounded-xl border border-zinc-200 p-3.5 space-y-3">
                <p className="text-[11px] uppercase tracking-wider text-zinc-400 font-bold">Default parcel</p>
                <Field field={{ label: 'Default weight per item (kg)', type: 'number', placeholder: '0.3', help: 'Used when a product has no weight. Multiplied by total quantity.' }} value={s.shiprocket?.defaultWeightKg ?? ''} onChange={(v) => setSr('defaultWeightKg', v === '' ? '' : Number(v))} />
                <div className="grid grid-cols-3 gap-3">
                  <Field field={{ label: 'Length (cm)', type: 'number' }} value={s.shiprocket?.length ?? ''} onChange={(v) => setSr('length', v === '' ? '' : Number(v))} />
                  <Field field={{ label: 'Breadth (cm)', type: 'number' }} value={s.shiprocket?.breadth ?? ''} onChange={(v) => setSr('breadth', v === '' ? '' : Number(v))} />
                  <Field field={{ label: 'Height (cm)', type: 'number' }} value={s.shiprocket?.height ?? ''} onChange={(v) => setSr('height', v === '' ? '' : Number(v))} />
                </div>
              </div>

              <div className="flex items-center gap-3 flex-wrap">
                <Btn variant="outline" onClick={testShiprocket} disabled={srTest?.loading || !s.shiprocket?.email || !s.shiprocket?.password}>
                  {srTest?.loading ? 'Checking…' : 'Test connection'}
                </Btn>
                {srTest && !srTest.loading && (
                  <span className="text-sm font-medium" style={{ color: srTest.ok ? '#15803d' : '#b91c1c' }}>{srTest.msg}</span>
                )}
              </div>
              <p className="text-xs text-zinc-400">The test saves your current values first. Remember to hit <b>Save Changes</b> up top to keep them.</p>
            </>
          )}
        </div>
      </Section>
      )}

      {tab === 'notifications' && (
      <Section title="Order Notifications" subtitle="Get an instant Telegram alert on your phone the moment an order comes in.">
        <div className="rounded-xl p-4 mb-5 text-sm leading-relaxed" style={{ background: 'color-mix(in srgb, var(--gold) 10%, transparent)', color: 'var(--ink)' }}>
          <p className="font-semibold mb-1.5">One-time setup (2 minutes):</p>
          <ol className="list-decimal ml-5 space-y-1 text-zinc-600">
            <li>In Telegram, open <b>@BotFather</b> → send <code>/newbot</code> → follow prompts. It gives you a <b>bot token</b> (like <code>1234:AbC…</code>). Paste it below.</li>
            <li>Open your new bot, tap <b>Start</b>, and send it any message.</li>
            <li>Open <b>@userinfobot</b> (or @RawDataBot) — it replies with your <b>chat id</b> (a number). Paste it below.</li>
            <li>Turn on the toggle, hit <b>Send test</b>. You should get a message.</li>
          </ol>
          <p className="text-xs text-zinc-500 mt-2">For a shared group, add the bot to the group and use the group’s chat id (starts with <code>-</code>). Multiple ids? Separate with commas.</p>
        </div>

        <div className="space-y-4">
          <Field field={{ label: 'Enable Telegram order alerts', type: 'toggle' }} value={!!s.notifications?.telegram?.enabled} onChange={(v) => setTg('enabled', v)} />
          <Field field={{ label: 'Bot token', placeholder: '1234567890:AbCdEf…', help: 'From @BotFather. Kept private — never shown on the website.' }} value={s.notifications?.telegram?.botToken || ''} onChange={(v) => setTg('botToken', v.trim())} />
          <Field field={{ label: 'Chat ID', placeholder: 'e.g. 812345678', help: 'Your Telegram numeric id (or a group id starting with -). Comma-separate for several.' }} value={s.notifications?.telegram?.chatId || ''} onChange={(v) => setTg('chatId', v.trim())} />

          <div className="flex items-center gap-3 flex-wrap">
            <Btn variant="outline" onClick={testTelegram} disabled={tgTest?.loading || !s.notifications?.telegram?.botToken || !s.notifications?.telegram?.chatId}>
              {tgTest?.loading ? 'Sending…' : 'Send test'}
            </Btn>
            {tgTest && !tgTest.loading && (
              <span className="text-sm font-medium" style={{ color: !tgTest.ok ? '#b91c1c' : tgTest.warn ? '#b45309' : '#15803d' }}>{tgTest.msg}</span>
            )}
          </div>
          <p className="text-xs text-zinc-400">The test saves your current values first. Remember to hit <b>Save Changes</b> up top to keep them.</p>
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
