import { useEffect, useState } from 'react'
import { Loader2, Check, ChevronUp, ChevronDown, ChevronRight, Plus, Trash2 } from 'lucide-react'
import { api } from '../../lib/api.js'
import { AdminHeader, Btn, Field, Toggle } from '../../components/admin/AdminUI.jsx'
import { MediaUploader } from '../../components/admin/MediaUploader.jsx'
import { useSettingsCtx } from '../../lib/SettingsProvider.jsx'
import { DEFAULT_HOMEPAGE, BLOCK_TYPES, PRODUCT_SOURCES, makeBlock } from '../../lib/homepageDefault.js'

const clone = (o) => JSON.parse(JSON.stringify(o))
const HAS_HEADING = ['productGrid', 'categories', 'collections', 'videos', 'reviews', 'gallery']

export function AdminHomepage() {
  const { refresh } = useSettingsCtx()
  const [hp, setHp] = useState(null)
  const [cats, setCats] = useState([])
  const [cols, setCols] = useState([])
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [openId, setOpenId] = useState(null)
  const [addOpen, setAddOpen] = useState(false)

  useEffect(() => {
    Promise.all([
      api.get('/settings'),
      api.get('/categories?all=1', { auth: true }),
      api.get('/collections?all=1', { auth: true }),
    ]).then(([s, c, co]) => {
      setHp(s.homepage?.blocks?.length ? clone(s.homepage) : clone(DEFAULT_HOMEPAGE))
      setCats(c); setCols(co)
    })
  }, [])

  const setHero = (k, v) => setHp((p) => ({ ...p, hero: { ...p.hero, [k]: v } }))
  const setBlock = (id, patch) => setHp((p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === id ? { ...b, ...patch } : b)) }))
  const setCfg = (id, k, v) => setHp((p) => ({ ...p, blocks: p.blocks.map((b) => (b.id === id ? { ...b, config: { ...b.config, [k]: v } } : b)) }))
  const move = (i, dir) => setHp((p) => {
    const j = i + dir; if (j < 0 || j >= p.blocks.length) return p
    const blocks = [...p.blocks]; [blocks[i], blocks[j]] = [blocks[j], blocks[i]]; return { ...p, blocks }
  })
  const add = (type) => { const b = makeBlock(type); setHp((p) => ({ ...p, blocks: [...p.blocks, b] })); setAddOpen(false); setOpenId(b.id) }
  const remove = (id) => { if (confirm('Remove this block?')) setHp((p) => ({ ...p, blocks: p.blocks.filter((b) => b.id !== id) })) }

  const save = async () => {
    setSaving(true)
    try {
      await api.patch('/settings', { homepage: hp }, { auth: true })
      await refresh()
      setSaved(true); setTimeout(() => setSaved(false), 2000)
    } finally { setSaving(false) }
  }
  const resetDefaults = () => { if (confirm('Reset the whole homepage to defaults?')) setHp(clone(DEFAULT_HOMEPAGE)) }

  if (!hp) return <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gold-500" /></div>

  return (
    <div className="max-w-3xl">
      <AdminHeader title="Homepage" subtitle="Add, reorder, configure and remove the blocks that make up your front page.">
        <Btn variant="outline" onClick={resetDefaults}>Reset</Btn>
        <Btn onClick={save} disabled={saving}>{saved ? <><Check size={16} /> Saved</> : saving ? 'Saving…' : 'Save'}</Btn>
      </AdminHeader>

      {/* Hero */}
      <Card title="Hero">
        <div className="grid gap-4">
          <Field field={{ label: 'Background', type: 'select', options: [
            { value: 'jewel', label: '3D gold jewel (animated)' }, { value: 'image', label: 'Image' }, { value: 'video', label: 'Video' },
          ] }} value={hp.hero.background || 'jewel'} onChange={(v) => setHero('background', v)} />
          {hp.hero.background === 'image' && <MediaUploader label="Hero image" value={hp.hero.mediaUrl} onChange={(v) => setHero('mediaUrl', v)} accept="image" />}
          {hp.hero.background === 'video' && <MediaUploader label="Hero video" value={hp.hero.mediaUrl} onChange={(v) => setHero('mediaUrl', v)} accept="video" />}
          <Field field={{ label: 'Top line (eyebrow)', help: 'Leave blank to use brand + free-shipping city' }} value={hp.hero.eyebrow} onChange={(v) => setHero('eyebrow', v)} />
          <Field field={{ label: 'Hindi line', help: 'Leave blank to use the Settings slogan' }} value={hp.hero.slogan} onChange={(v) => setHero('slogan', v)} />
          <Field field={{ label: 'Big title', help: 'Leave blank to use the brand name' }} value={hp.hero.heading} onChange={(v) => setHero('heading', v)} />
          <Field field={{ label: 'Sub-heading', type: 'textarea' }} value={hp.hero.subheading} onChange={(v) => setHero('subheading', v)} />
          <div className="grid sm:grid-cols-2 gap-4">
            <Field field={{ label: 'Button label' }} value={hp.hero.ctaLabel} onChange={(v) => setHero('ctaLabel', v)} />
            <Field field={{ label: 'Button link' }} value={hp.hero.ctaLink} onChange={(v) => setHero('ctaLink', v)} />
          </div>
          <Field field={{ label: 'Show WhatsApp button in hero', type: 'toggle' }} value={hp.hero.showWhatsapp} onChange={(v) => setHero('showWhatsapp', v)} />
        </div>
      </Card>

      {/* Blocks */}
      <Card title="Blocks" subtitle="These render top-to-bottom on the homepage. Reorder with arrows, toggle, edit, or remove.">
        <div className="space-y-2">
          {hp.blocks.map((b, i) => {
            const def = BLOCK_TYPES[b.type] || { label: b.type, hint: '' }
            const open = openId === b.id
            return (
              <div key={b.id} className="rounded-xl border border-[color-mix(in_srgb,var(--gold)_18%,transparent)] overflow-hidden">
                <div className="flex items-center gap-2 px-3 py-2.5 bg-stone-50 dark:bg-stone-800/50">
                  <div className="flex flex-col">
                    <button onClick={() => move(i, -1)} disabled={i === 0} className="text-stone-400 hover:text-gold-500 disabled:opacity-30 cursor-pointer"><ChevronUp size={14} /></button>
                    <button onClick={() => move(i, 1)} disabled={i === hp.blocks.length - 1} className="text-stone-400 hover:text-gold-500 disabled:opacity-30 cursor-pointer"><ChevronDown size={14} /></button>
                  </div>
                  <button onClick={() => setOpenId(open ? null : b.id)} className="flex-1 text-left cursor-pointer min-w-0">
                    <span className="font-medium text-sm text-dark-900 dark:text-cream-50 flex items-center gap-1.5">
                      {def.label}
                      <ChevronRight size={14} className={`text-stone-400 transition-transform ${open ? 'rotate-90' : ''}`} />
                      {!b.enabled && <span className="text-[10px] uppercase tracking-wide text-stone-400">hidden</span>}
                    </span>
                    <span className="text-xs text-stone-400 truncate block">{b.config?.title || def.hint}</span>
                  </button>
                  <Toggle checked={b.enabled} onChange={(v) => setBlock(b.id, { enabled: v })} />
                  <button onClick={() => remove(b.id)} className="w-8 h-8 grid place-items-center rounded-lg text-stone-400 hover:text-red-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"><Trash2 size={15} /></button>
                </div>
                {open && (
                  <div className="p-4 bg-white dark:bg-stone-900">
                    <BlockConfig block={b} cats={cats} cols={cols} setCfg={(k, v) => setCfg(b.id, k, v)} />
                  </div>
                )}
              </div>
            )
          })}
        </div>

        {/* Add block */}
        <div className="relative mt-3">
          <Btn variant="outline" onClick={() => setAddOpen((o) => !o)}><Plus size={16} /> Add block</Btn>
          {addOpen && (
            <div className="absolute z-20 mt-2 w-72 rounded-2xl bg-white dark:bg-stone-900 shadow-xl border border-cream-200 dark:border-stone-700 overflow-hidden">
              {Object.entries(BLOCK_TYPES).map(([type, d]) => (
                <button key={type} onClick={() => add(type)} className="block w-full text-left px-4 py-2.5 hover:bg-stone-50 dark:hover:bg-stone-800 cursor-pointer">
                  <span className="text-sm font-medium text-dark-900 dark:text-cream-50">{d.label}</span>
                  <span className="block text-xs text-stone-400">{d.hint}</span>
                </button>
              ))}
            </div>
          )}
        </div>
      </Card>

      <div className="flex justify-end mt-6">
        <Btn onClick={save} disabled={saving}>{saved ? <><Check size={16} /> Saved</> : saving ? 'Saving…' : 'Save'}</Btn>
      </div>
    </div>
  )
}

function BlockConfig({ block, cats, cols, setCfg }) {
  const c = block.config || {}
  const t = block.type

  if (t === 'banners') return <Note>Shows your active <b>offer banners</b> (edit them on the Banners page).</Note>
  if (t === 'story') return <Note>Shows a featured product and its story (the first product that has a story).</Note>

  const Headings = (
    <div className="grid sm:grid-cols-2 gap-3">
      <Field field={{ label: 'Eyebrow' }} value={c.eyebrow} onChange={(v) => setCfg('eyebrow', v)} />
      <Field field={{ label: 'Hindi line' }} value={c.hindi} onChange={(v) => setCfg('hindi', v)} />
      <Field field={{ label: 'Title' }} value={c.title} onChange={(v) => setCfg('title', v)} />
      <Field field={{ label: 'Subtitle' }} value={c.subtitle} onChange={(v) => setCfg('subtitle', v)} />
    </div>
  )

  if (t === 'image') {
    return (
      <div className="space-y-3">
        <MediaUploader label="Image" value={c.url} onChange={(v) => setCfg('url', v)} accept="image" />
        <Field field={{ label: 'Link (optional)' }} value={c.link} onChange={(v) => setCfg('link', v)} />
        <Field field={{ label: 'Caption (optional)' }} value={c.caption} onChange={(v) => setCfg('caption', v)} />
        <Field field={{ label: 'Dark background', type: 'toggle' }} value={c.dark} onChange={(v) => setCfg('dark', v)} />
      </div>
    )
  }

  if (t === 'text') {
    return (
      <div className="space-y-3">
        <div className="grid sm:grid-cols-2 gap-3">
          <Field field={{ label: 'Eyebrow' }} value={c.eyebrow} onChange={(v) => setCfg('eyebrow', v)} />
          <Field field={{ label: 'Hindi line' }} value={c.hindi} onChange={(v) => setCfg('hindi', v)} />
        </div>
        <Field field={{ label: 'Title' }} value={c.title} onChange={(v) => setCfg('title', v)} />
        <Field field={{ label: 'Body', type: 'textarea' }} value={c.body} onChange={(v) => setCfg('body', v)} />
        <Field field={{ label: 'Dark maroon background', type: 'toggle' }} value={c.dark} onChange={(v) => setCfg('dark', v)} />
      </div>
    )
  }

  if (t === 'productGrid') {
    return (
      <div className="space-y-3">
        {Headings}
        <div className="grid sm:grid-cols-2 gap-3">
          <Field field={{ label: 'Show products from', type: 'select', options: PRODUCT_SOURCES }} value={c.source || 'featured'} onChange={(v) => setCfg('source', v)} />
          {c.source === 'category' && (
            <Field field={{ label: 'Category', type: 'select', options: [{ value: '', label: '— choose —' }, ...cats.map((x) => ({ value: x._id, label: x.name }))] }} value={c.categoryId || ''} onChange={(v) => setCfg('categoryId', v)} />
          )}
          {c.source === 'collection' && (
            <Field field={{ label: 'Collection', type: 'select', options: [{ value: '', label: '— choose —' }, ...cols.map((x) => ({ value: x._id, label: x.name }))] }} value={c.collectionId || ''} onChange={(v) => setCfg('collectionId', v)} />
          )}
          {c.source === 'under599' && (
            <Field field={{ label: 'Max price (₹)', type: 'number', help: 'Show jhumkas at or below this price' }} value={c.maxPrice ?? 599} onChange={(v) => setCfg('maxPrice', v)} />
          )}
          <Field field={{ label: 'Max items', type: 'number' }} value={c.limit ?? 8} onChange={(v) => setCfg('limit', v)} />
          <Field field={{ label: 'Dark background', type: 'toggle' }} value={c.dark} onChange={(v) => setCfg('dark', v)} />
        </div>
      </div>
    )
  }

  // categories / collections / videos / reviews / gallery → headings + bg toggle
  return HAS_HEADING.includes(t) ? (
    <div className="space-y-3">
      {Headings}
      <Field field={{ label: 'Dark background', type: 'toggle' }} value={c.dark} onChange={(v) => setCfg('dark', v)} />
    </div>
  ) : <Note>No options.</Note>
}

function Note({ children }) {
  return <p className="text-sm text-stone-500 dark:text-stone-400">{children}</p>
}

function Card({ title, subtitle, children }) {
  return (
    <div className="admin-card p-6 mb-5">
      <h2 className="font-semibold text-lg text-dark-900 dark:text-cream-50">{title}</h2>
      {subtitle && <p className="text-xs text-stone-400 mb-4">{subtitle}</p>}
      <div className={subtitle ? '' : 'mt-4'}>{children}</div>
    </div>
  )
}
