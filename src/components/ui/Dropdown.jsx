import { useState, useRef, useEffect } from 'react'
import { ChevronDown, Check } from 'lucide-react'

/**
 * Styled select-replacement. options: [{ value, label }].
 * Royal theme, closes on outside click / Escape.
 */
export function Dropdown({ value, onChange, options, className = '', align = 'right' }) {
  const [open, setOpen] = useState(false)
  const ref = useRef(null)
  const current = options.find((o) => o.value === value)

  useEffect(() => {
    const onDoc = (e) => { if (ref.current && !ref.current.contains(e.target)) setOpen(false) }
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    document.addEventListener('keydown', onKey)
    return () => { document.removeEventListener('mousedown', onDoc); document.removeEventListener('keydown', onKey) }
  }, [])

  return (
    <div ref={ref} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => setOpen((o) => !o)}
        className="flex items-center justify-between gap-2 min-w-[9.5rem] w-full px-4 py-2 rounded-full border bg-white text-sm font-medium cursor-pointer transition-colors"
        style={{ borderColor: 'color-mix(in srgb, var(--gold) 45%, transparent)', color: 'var(--ink)' }}
        aria-haspopup="listbox"
        aria-expanded={open}
      >
        <span className="truncate">{current?.label || 'Select'}</span>
        <ChevronDown size={15} className={`transition-transform shrink-0 ${open ? 'rotate-180' : ''}`} style={{ color: 'var(--maroon)' }} />
      </button>

      {open && (
        <div
          role="listbox"
          className={`absolute z-30 mt-2 min-w-full w-max max-w-[16rem] rounded-2xl bg-white shadow-xl border overflow-hidden animate-slide-up ${align === 'right' ? 'right-0' : 'left-0'}`}
          style={{ borderColor: 'color-mix(in srgb, var(--gold) 30%, transparent)' }}
        >
          {options.map((o) => {
            const active = o.value === value
            return (
              <button
                key={o.value}
                role="option"
                aria-selected={active}
                onClick={() => { onChange(o.value); setOpen(false) }}
                className="flex items-center justify-between gap-3 w-full text-left px-4 py-2.5 text-sm transition-colors hover:bg-[color-mix(in_srgb,var(--gold)_12%,transparent)]"
                style={{ color: 'var(--ink)', background: active ? 'color-mix(in srgb, var(--maroon) 8%, transparent)' : 'transparent' }}
              >
                <span className={active ? 'font-semibold' : ''}>{o.label}</span>
                {active && <Check size={15} style={{ color: 'var(--maroon)' }} />}
              </button>
            )
          })}
        </div>
      )}
    </div>
  )
}
