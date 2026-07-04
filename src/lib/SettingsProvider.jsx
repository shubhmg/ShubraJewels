import { createContext, useContext, useEffect, useState } from 'react'
import { api } from './api.js'
import { DEFAULT_HOMEPAGE } from './homepageDefault.js'

const SettingsContext = createContext(null)

// Sensible defaults so the UI renders instantly before the fetch resolves.
const DEFAULTS = {
  brandName: 'Shubra Jewels',
  brandNameHindi: 'शुभ्रा',
  slogan: 'हर झुमका एक कहानी',
  sloganEnglish: 'Every jhumka tells a story',
  taglines: ['हर झुमका एक कहानी'],
  announcement: '',
  announcementActive: true,
  whatsappNumber: '',
  whatsappMessage: 'Hello! I would like to order:',
  freeShippingCity: 'Delhi',
  shippingNote: 'Free shipping in Delhi. Pan-India delivery available.',
  aboutShort: 'Handcrafted jhumkas inspired by the royal heritage of Rajasthan.',
  phone: '', email: '',
  instagram: '', instagramUrl: '', facebook: '', youtube: '',
  theme: {
    maroon: '#7B1E2B', maroonDark: '#5A121C', gold: '#C9A84C',
    goldLight: '#E3C97A', beige: '#F6ECD9', cream: '#FBF6EC', ink: '#2A1A16',
  },
  homepage: DEFAULT_HOMEPAGE,
  payments: { razorpay: true, cod: true },
}

// Push the (admin-editable) palette into CSS variables the whole app reads.
function applyTheme(theme = {}) {
  const t = { ...DEFAULTS.theme, ...theme }
  const root = document.documentElement.style
  root.setProperty('--maroon', t.maroon)
  root.setProperty('--maroon-dark', t.maroonDark)
  root.setProperty('--gold', t.gold)
  root.setProperty('--gold-light', t.goldLight)
  root.setProperty('--beige', t.beige)
  root.setProperty('--cream', t.cream)
  root.setProperty('--ink', t.ink)
}

export function SettingsProvider({ children }) {
  const [settings, setSettings] = useState(DEFAULTS)
  const [loaded, setLoaded] = useState(false)

  const refresh = async () => {
    try {
      const data = await api.get('/settings')
      const hp = data.homepage && data.homepage.blocks?.length
        ? { hero: { ...DEFAULTS.homepage.hero, ...(data.homepage.hero || {}) }, blocks: data.homepage.blocks }
        : DEFAULTS.homepage
      const social = data.instagramUrl || data.instagram || ''
      const merged = { ...DEFAULTS, ...data, instagramUrl: social, instagram: social, theme: { ...DEFAULTS.theme, ...(data.theme || {}) }, payments: { ...DEFAULTS.payments, ...(data.payments || {}) }, homepage: hp }
      setSettings(merged)
      applyTheme(merged.theme)
    } catch {
      applyTheme(DEFAULTS.theme)
    } finally {
      setLoaded(true)
    }
  }

  useEffect(() => { applyTheme(DEFAULTS.theme); refresh() }, [])

  return (
    <SettingsContext.Provider value={{ settings, loaded, refresh }}>
      {children}
    </SettingsContext.Provider>
  )
}

export function useSettings() {
  const ctx = useContext(SettingsContext)
  return ctx?.settings || DEFAULTS
}

export function useSettingsCtx() {
  return useContext(SettingsContext) || { settings: DEFAULTS, loaded: false, refresh: () => {} }
}

export function instagramUrl(settings) {
  return settings?.instagramUrl || settings?.instagram || ''
}

export function instagramHandle(settings) {
  const url = instagramUrl(settings)
  if (!url) return ''
  const value = url.trim()
  try {
    const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`
    const path = new URL(withProtocol).pathname.split('/').filter(Boolean)
    return path[0] ? `@${path[0]}` : ''
  } catch {
    const handle = value.replace(/^@/, '').split(/[/?#]/)[0]
    return handle ? `@${handle}` : ''
  }
}

// Build a wa.me link with a pre-filled message from settings.
export function whatsappLink(settings, message) {
  const num = (settings?.whatsappNumber || '').replace(/[^0-9]/g, '')
  const text = encodeURIComponent(message || settings?.whatsappMessage || 'Hello!')
  if (!num) return null
  return `https://wa.me/${num}?text=${text}`
}
