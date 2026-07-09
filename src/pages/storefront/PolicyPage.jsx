import { Mandala, Motif } from '../../components/decor/Decor.jsx'
import { useSettings } from '../../lib/SettingsProvider.jsx'
import { resolveContent } from '../../lib/siteContent.js'

// Renders a single admin-editable legal page (privacy / terms / refund / shipping).
// Body text supports "## Heading", "- bullet" lines and blank-line paragraphs,
// with {brand} {email} {phone} {whatsapp} {city} placeholders filled from Settings.
export function PolicyPage({ pageKey }) {
  const settings = useSettings()
  const policy = resolveContent(settings.content).policies[pageKey]

  const vars = {
    brand: settings.brandName || 'our store',
    email: settings.email || 'our email address',
    phone: settings.phone || settings.whatsappNumber || 'us',
    whatsapp: settings.whatsappNumber || settings.phone || 'us',
    city: settings.freeShippingCity || 'select cities',
  }
  const fill = (t) => (t || '').replace(/\{(\w+)\}/g, (_, k) => (vars[k] != null ? vars[k] : `{${k}}`))
  const blocks = parseBody(fill(policy?.body))

  return (
    <div className="min-h-dvh animate-fade-in" style={{ background: 'var(--cream)' }}>
      <div className="relative overflow-hidden text-center" style={{ background: 'var(--maroon-dark)' }}>
        <Mandala size={300} className="hidden md:block absolute right-0 md:right-8 top-16 md:top-24 opacity-15 pointer-events-none" />
        <div className="container-wide pt-24 md:pt-32 pb-12 md:pb-16 relative">
          <div className="eyebrow justify-center flex"><Motif size={18} />Legal</div>
          <h1 className="font-display text-white text-4xl md:text-5xl mt-2">{policy?.title}</h1>
        </div>
      </div>

      <section className="section">
        <div className="container-tight">
          {blocks.map((b, i) => {
            if (b.type === 'h')
              return <h2 key={i} className="font-display text-xl md:text-2xl mt-8 mb-2" style={{ color: 'var(--maroon)' }}>{b.text}</h2>
            if (b.type === 'ul')
              return (
                <ul key={i} className="list-disc pl-5 space-y-1.5 mb-3 text-[15px] leading-relaxed" style={{ color: 'var(--ink)' }}>
                  {b.items.map((it, j) => <li key={j}>{it}</li>)}
                </ul>
              )
            return <p key={i} className="text-[15px] leading-relaxed mb-3" style={{ color: 'color-mix(in srgb, var(--ink) 82%, transparent)' }}>{b.text}</p>
          })}
        </div>
      </section>
    </div>
  )
}

function parseBody(body) {
  const lines = (body || '').split('\n')
  const blocks = []
  let para = []
  let list = []
  const flushPara = () => { if (para.length) { blocks.push({ type: 'p', text: para.join(' ') }); para = [] } }
  const flushList = () => { if (list.length) { blocks.push({ type: 'ul', items: list }); list = [] } }
  for (const raw of lines) {
    const line = raw.trim()
    if (!line) { flushPara(); flushList(); continue }
    if (line.startsWith('## ')) { flushPara(); flushList(); blocks.push({ type: 'h', text: line.slice(3).trim() }); continue }
    if (line.startsWith('- ')) { flushPara(); list.push(line.slice(2).trim()); continue }
    flushList(); para.push(line)
  }
  flushPara(); flushList()
  return blocks
}
