import { X } from 'lucide-react'
import { MediaUploader } from './MediaUploader.jsx'
import { Dropdown } from '../ui/Dropdown.jsx'

export function AdminHeader({ title, subtitle, children }) {
  return (
    <div className="flex items-start justify-between gap-4 mb-6 flex-wrap">
      <div>
        <h1 className="font-serif text-2xl text-dark-900 dark:text-cream-50">{title}</h1>
        {subtitle && <p className="text-sm text-stone-400 mt-0.5">{subtitle}</p>}
      </div>
      <div className="flex items-center gap-2">{children}</div>
    </div>
  )
}

export function Btn({ children, variant = 'primary', className = '', ...props }) {
  const styles = {
    primary: 'bg-gold-500 text-dark-950 hover:bg-gold-400',
    ghost: 'text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800',
    danger: 'bg-red-500 text-white hover:bg-red-600',
    outline: 'border border-stone-300 dark:border-stone-600 text-stone-600 dark:text-stone-300 hover:border-gold-400',
  }
  return (
    <button className={`inline-flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-semibold transition cursor-pointer disabled:opacity-50 ${styles[variant]} ${className}`} {...props}>
      {children}
    </button>
  )
}

export function Modal({ open, onClose, title, children, footer, wide }) {
  if (!open) return null
  return (
    <div className="fixed inset-0 z-[60] flex items-start justify-center p-4 overflow-y-auto">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className={`relative w-full ${wide ? 'max-w-3xl' : 'max-w-lg'} bg-white dark:bg-stone-900 rounded-2xl shadow-2xl my-8 animate-slide-up`}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-stone-100 dark:border-stone-800 sticky top-0 bg-white dark:bg-stone-900 rounded-t-2xl z-10">
          <h2 className="font-serif text-lg text-dark-900 dark:text-cream-50">{title}</h2>
          <button onClick={onClose} className="text-stone-400 hover:text-dark-900 dark:hover:text-cream-50 cursor-pointer"><X size={18} /></button>
        </div>
        <div className="px-6 py-5 space-y-4">{children}</div>
        {footer && <div className="px-6 py-4 border-t border-stone-100 dark:border-stone-800 flex justify-end gap-2 sticky bottom-0 bg-white dark:bg-stone-900 rounded-b-2xl">{footer}</div>}
      </div>
    </div>
  )
}

export function Toggle({ checked, onChange, label }) {
  return (
    <label className="flex items-center gap-3 cursor-pointer select-none">
      <span
        onClick={() => onChange(!checked)}
        className={`relative w-10 h-6 rounded-full transition-colors ${checked ? 'bg-gold-500' : 'bg-stone-300 dark:bg-stone-600'}`}
      >
        <span className={`absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white transition-transform ${checked ? 'translate-x-4' : ''}`} />
      </span>
      {label && <span className="text-sm text-stone-600 dark:text-stone-300">{label}</span>}
    </label>
  )
}

const inputCls = 'w-full px-3 py-2 rounded-lg border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-sm text-dark-900 dark:text-cream-50 focus:outline-none focus:border-gold-400'

// Renders one field based on its config { key, label, type, options, required, placeholder }.
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
        return (
          <Dropdown
            value={v}
            onChange={onChange}
            align="left"
            className="w-full"
            options={options.map((o) => ({ value: o.value ?? o, label: o.label ?? o }))}
          />
        )
      case 'multiselect':
        return (
          <div className="flex flex-wrap gap-2">
            {options.map((o) => {
              const val = o.value ?? o
              const active = (value || []).includes(val)
              return (
                <button key={val} type="button" onClick={() => onChange(active ? (value || []).filter((x) => x !== val) : [...(value || []), val])}
                  className={`px-3 py-1.5 rounded-full text-xs font-medium border cursor-pointer ${active ? 'bg-gold-500 text-dark-950 border-gold-500' : 'border-stone-300 dark:border-stone-600 text-stone-500'}`}>
                  {o.label ?? o}
                </button>
              )
            })}
          </div>
        )
      case 'color':
        return (
          <div className="flex items-center gap-2">
            <input type="color" value={v || '#000000'} onChange={(e) => onChange(e.target.value)} className="w-10 h-9 rounded border border-stone-300 dark:border-stone-600 cursor-pointer bg-transparent" />
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
        <span className="text-sm font-medium text-stone-600 dark:text-stone-300">{label}</span>
        {control()}
      </div>
    )
  }

  return (
    <label className="block">
      <span className="text-xs font-medium text-stone-500">{label}{field.required && ' *'}</span>
      <div className="mt-1">{control()}</div>
      {help && <span className="text-[11px] text-stone-400 mt-1 block">{help}</span>}
    </label>
  )
}
