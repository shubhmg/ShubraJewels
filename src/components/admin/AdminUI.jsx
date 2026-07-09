import { useEffect } from 'react'
import { X } from 'lucide-react'
import { MediaUploader } from './MediaUploader.jsx'
import { Dropdown } from '../ui/Dropdown.jsx'

export function AdminHeader({ title, subtitle, children }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 className="text-2xl md:text-[28px] font-bold text-zinc-900 tracking-tight leading-tight">{title}</h1>
        {subtitle && <p className="text-sm text-zinc-500 mt-1">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

export function Btn({ children, variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'text-white shadow-sm hover:brightness-110',
    ghost: 'text-zinc-600 hover:bg-zinc-100',
    danger: 'bg-red-600 text-white hover:bg-red-700 shadow-sm',
    outline: 'border border-zinc-300 text-zinc-700 hover:bg-zinc-50 hover:border-zinc-400 bg-white',
    gold: 'text-zinc-900 shadow-sm hover:brightness-105',
  }
  const style =
    variant === 'gold' ? { background: 'linear-gradient(135deg, var(--gold), var(--gold-light))' }
      : variant === 'primary' ? { background: 'var(--maroon)' }
        : undefined
  return (
    <button style={style} className={`inline-flex items-center gap-2 px-4 py-2 rounded-full text-sm font-semibold transition cursor-pointer disabled:opacity-50 ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function Modal({ open, onClose, title, children, footer, wide }) {
  // Lock the page behind the modal so it can't scroll/chain underneath.
  useEffect(() => {
    if (!open) return
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { document.body.style.overflow = prev }
  }, [open])

  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-start sm:items-center justify-center p-3 sm:p-4">
      <div className="fixed inset-0 bg-zinc-900/50 backdrop-blur-sm" onClick={onClose} />
      {/* Self-contained card: header + footer fixed, body scrolls INSIDE the card
          (no position:sticky against the viewport — that was detaching them). */}
      <div className={`relative w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} bg-white rounded-2xl shadow-2xl ring-1 ring-zinc-200 flex flex-col max-h-[calc(100dvh-1.5rem)] sm:max-h-[calc(100dvh-2rem)] animate-slide-up`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-zinc-100 bg-white rounded-t-2xl shrink-0">
          <h2 className="text-base font-semibold text-zinc-900">{title}</h2>
          <button onClick={onClose} className="w-8 h-8 grid place-items-center rounded-lg text-zinc-400 hover:bg-zinc-100 hover:text-zinc-700 cursor-pointer"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4 overflow-y-auto">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-zinc-100 flex justify-end gap-2 bg-white rounded-b-2xl shrink-0">{footer}</div>}
      </div>
    </div>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <span onClick={() => onChange(!checked)} className={`relative w-10 h-6 rounded-full transition-colors ${checked ? '' : 'bg-zinc-300'}`} style={checked ? { background: 'var(--maroon)' } : undefined}>
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
      {label && <span className="text-sm text-zinc-600">{label}</span>}
    </label>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-sm text-zinc-900 placeholder:text-zinc-400 focus:outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--gold)_28%,transparent)] transition'

export function Field({ field, value, onChange }) {
  const { label, type = 'text', options = [], placeholder, help } = field
  const v = value ?? ''

  const control = () => {
    switch (type) {
      case 'textarea':
        return <textarea rows={field.rows || 3} value={v} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={`${inputCls} resize-none`} />
      case 'number':
        return <input type="number" value={v} placeholder={placeholder} onChange={(e) => onChange(e.target.value === '' ? '' : Number(e.target.value))} className={inputCls} />
      case 'toggle':
        return <Toggle checked={!!value} onChange={onChange} />
      case 'select':
        return <Dropdown value={v} onChange={onChange} align="left" className="w-full" options={options.map((o) => ({ value: o.value ?? o, label: o.label ?? o }))} />
      case 'multiselect':
        return (
          <div className="flex flex-wrap gap-2">
            {options.map((o) => {
              const val = o.value ?? o
              const active = (value || []).includes(val)
              return (
                <button key={val} type="button" onClick={() => onChange(active ? (value || []).filter((x) => x !== val) : [...(value || []), val])}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer transition ${active ? 'text-white border-transparent' : 'border-zinc-300 text-zinc-600 hover:border-zinc-400'}`}
                  style={active ? { background: 'var(--maroon)' } : undefined}>
                  {o.label ?? o}
                </button>
              )
            })}
          </div>
        )
      case 'color':
        return (
          <div className="flex items-center gap-2">
            <input type="color" value={v || '#000000'} onChange={(e) => onChange(e.target.value)} className="w-10 h-9 rounded-lg border border-zinc-300 cursor-pointer bg-white p-0.5" />
            <input type="text" value={v} onChange={(e) => onChange(e.target.value)} className={inputCls} placeholder="#7B1E2B" />
          </div>
        )
      case 'tags':
        return <input type="text" value={Array.isArray(value) ? value.join(', ') : v} placeholder={placeholder || 'comma, separated'} onChange={(e) => onChange(e.target.value.split(',').map((s) => s.trim()).filter(Boolean))} className={inputCls} />
      case 'lines':
        return <textarea rows={field.rows || 3} value={Array.isArray(value) ? value.join('\n') : v} placeholder={placeholder || 'one per line'} onChange={(e) => onChange(e.target.value.split('\n').map((s) => s.trim()).filter(Boolean))} className={`${inputCls} resize-none`} />
      case 'image':
        return <MediaUploader value={value} onChange={onChange} accept="image" />
      case 'video':
        return <MediaUploader value={value} onChange={onChange} accept="video" />
      default:
        return <input type="text" value={v} placeholder={placeholder} onChange={(e) => onChange(e.target.value)} className={inputCls} />
    }
  }

  if (type === 'toggle') {
    return (
      <div className="flex items-center justify-between py-1">
        <span className="text-sm font-medium text-zinc-700">{label}</span>
        {control()}
      </div>
    )
  }

  return (
    <label className="block">
      <span className="text-[13px] font-medium text-zinc-700">{label}{field.required && ' *'}</span>
      <div className="mt-1.5">{control()}</div>
      {help && <span className="text-[11px] text-zinc-400 mt-1 block">{help}</span>}
    </label>
  )
}
