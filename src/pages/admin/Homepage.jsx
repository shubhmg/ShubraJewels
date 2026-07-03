import { useEffect, useState } from 'react'
import { Loader2, Check, ChevronUp, ChevronDown, ChevronRight } from 'lucide-react'
import { api } from '../../lib/api.js'
import { AdminHeader, Btn, Field, Toggle } from '../../components/admin/AdminUI.jsx'
import { useSettingsCtx } from '../../lib/SettingsProvider.jsx'
import { DEFAULT_HOMEPAGE, SECTION_LABELS, SECTIONS_WITH_HEADINGS } from '../../lib/homepageDefault.js'

const clone = (o) => JSON.parse(JSON.stringify(o))

export function AdminHomepage() {
  const { refresh } = useSettingsCtx()
  const [hp, setHp] = useState(null)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [expanded, setExpanded] = useState(null)

  useEffect(() => {
    api.get('/settings').then((s) => {
      setHp(s.homepage && s.homepage.sections?.length ? clone(s.homepage) : clone(DEFAULT_HOMEPAGE))
    })
  }, [])

  const setHero = (k, v) => setHp((p) => ({ ...p, hero: { ...p.hero, [k]: v } }))
  const setSection = (i, patch) => setHp((p) => {
    const sections = p.sections.map((s, idx) => (idx === i ? { ...s, ...patch } : s))
    return { ...p, sections }
  })
  const move = (i, dir) => setHp((p) => {
    const j = i + dir
    if (j < 0 || j >= p.sections.length) return p
    const sections = [...p.sections]
    ;[sections[i], sections[j]] = [sections[j], sections[i]]
    return { ...p, sections }
  })

  const save = async () => {
    setSaving(true)
    try {
      await api.patch('/settings', { homepage: hp }, { auth: true })
      await refresh()
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }

  const resetDefaults = () => { if (confirm('Reset the homepage layout to defaults?')) setHp(clone(DEFAULT_HOMEPAGE)) }

  if (!hp) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gold-500" /></div>

  return (
    <div className="max-w-3xl">
      <AdminHeader title="Homepage" subtitle="Edit the hero, reorder sections, toggle them on/off, and rename every heading. This is the front page.">
        <Btn variant="outline" onClick={resetDefaults}>Reset</Btn>
        <Btn onClick={save} disabled={saving}>{saved ? <><Check size={16} /> Saved</> : saving ? 'Saving…' : 'Save'}</Btn>
      </AdminHeader>

      {/* Hero */}
      <Card title="Hero">
        <div className="grid gap-4">
          <Field field={{ label: 'Sub-heading (under the brand name)', type: 'textarea' }} value={hp.hero.subheading} onChange={(v) => setHero('subheading', v)} />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field field={{ label: 'Button label' }} value={hp.hero.ctaLabel} onChange={(v) => setHero('ctaLabel', v)} />
            <Field field={{ label: 'Button link' }} value={hp.hero.ctaLink} onChange={(v) => setHero('ctaLink', v)} />
          </div>
          <Field field={{ label: 'Show WhatsApp button in hero', type: 'toggle' }} value={hp.hero.showWhatsapp} onChange={(v) => setHero('showWhatsapp', v)} />
          <p className="text-xs text-stone-400">The brand name and 3D jewel come from Settings. The slogan shown above them is edited on the Settings page.</p>
        </div>
      </Card>

      {/* Sections */}
      <Card title="Sections" subtitle="Reorder with the arrows. Turn sections off, or rename their headings.">
        <div className="space-y-2">
          {hp.sections.map((s, i) => {
            const open = expanded === s.key
            const hasHeadings = SECTIONS_WITH_HEADINGS.includes(s.key)
            return (
              <div key={s.key} className="rounded-xl border border-cream-200 dark:border-stone-700 overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 bg-stone-50 dark:bg-stone-800/50">
                  <div className="flex flex-col">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="text-stone-400 hover:text-gold-500 disabled:opacity-30 cursor-pointer"><ChevronUp size={14} /></button>
                    <button onClick={() => move(i, 1)} disabled={i === hp.sections.length - 1} className="text-stone-400 hover:text-gold-500 disabled:opacity-30 cursor-pointer"><ChevronDown size={14} /></button>
                  </div>
                  <span className="text-xs text-stone-400 w-5">{i + 1}</span>
                  <button
                    onClick={() => hasHeadings && setExpanded(open ? null : s.key)}
                    className={`flex-1 text-left font-medium text-sm ${hasHeadings ? 'cursor-pointer' : 'cursor-default'} text-dark-900 dark:text-cream-50 flex items-center gap-1.5`}
                  >
                    {SECTION_LABELS[s.key] || s.key}
                    {hasHeadings && <ChevronRight size={14} className={`text-stone-400 transition-transform ${open ? 'rotate-90' : ''}`} />}
                    {!s.enabled && <span className="text-[10px] uppercase tracking-wide text-stone-400 ml-1">hidden</span>}
                  </button>
                  <Toggle checked={s.enabled} onChange={(v) => setSection(i, { enabled: v })} />
                </div>
                {open && hasHeadings && (
                  <div className="p-4 grid sm:grid-cols-2 gap-3 bg-white dark:bg-stone-900">
                    <Field field={{ label: 'Eyebrow (small label)' }} value={s.eyebrow} onChange={(v) => setSection(i, { eyebrow: v })} />
                    <Field field={{ label: 'Hindi line' }} value={s.hindi} onChange={(v) => setSection(i, { hindi: v })} />
                    <Field field={{ label: 'Title' }} value={s.title} onChange={(v) => setSection(i, { title: v })} />
                    <Field field={{ label: 'Subtitle' }} value={s.subtitle} onChange={(v) => setSection(i, { subtitle: v })} />
                  </div>
                )}
              </div>
            )
          })}
        </div>
      </Card>

      <div className="flex justify-end mt-6">
        <Btn onClick={save} disabled={saving}>{saved ? <><Check size={16} /> Saved</> : saving ? 'Saving…' : 'Save'}</Btn>
      </div>
    </div>
  )
}

function Card({ title, subtitle, children }) {
  return (
    <div className="bg-white dark:bg-stone-900 rounded-2xl border border-cream-200 dark:border-stone-800 p-6 mb-5">
      <h2 className="font-serif text-lg text-dark-900 dark:text-cream-50">{title}</h2>
      {subtitle && <p className="text-xs text-stone-400 mb-4">{subtitle}</p>}
      <div className={subtitle ? '' : 'mt-4'}>{children}</div>
    </div>
  )
}
