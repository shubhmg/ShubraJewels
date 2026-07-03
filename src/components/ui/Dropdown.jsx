import { useState, useRef, useEffect, useLayoutEffect } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check } from 'lucide-react'

/**
 * Styled select-replacement. options: [{ value, label }].
 * The menu renders in a portal with fixed positioning so it never gets clipped
 * by an `overflow-hidden` ancestor (cards, modals, etc.).
 */
export function Dropdown({ value, onChange, options, className = '', align = 'right' }) {
  const [open, setOpen] = useState(false)
  const [pos, setPos] = useState(null)
  const btnRef = useRef(null)
  const menuRef = useRef(null)
  const current = options.find((o) => o.value === value)

  const place = () => {
    const r = btnRef.current?.getBoundingClientRect()
    if (!r) return
    setPos({ top: r.bottom + 6, left: r.left, right: window.innerWidth - r.right, width: r.width })
  }

  useLayoutEffect(() => { if (open) place() }, [open])

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => {
      if (!btnRef.current?.contains(e.target) && !menuRef.current?.contains(e.target)) setOpen(false)
    }
    const onScroll = () => setOpen(false)
    const onKey = (e) => { if (e.key === 'Escape') setOpen(false) }
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  return (
    <div className={`relative ${className}`}>
      <button
        ref={btnRef}
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

      {open && pos && createPortal(
        <div
          ref={menuRef}
          role="listbox"
          className="fixed z-[80] rounded-2xl bg-white shadow-xl border overflow-hidden animate-slide-up max-h-72 overflow-y-auto"
          style={{
            top: pos.top,
            ...(align === 'right' ? { right: pos.right } : { left: pos.left }),
            minWidth: pos.width,
            maxWidth: '18rem',
            borderColor: 'color-mix(in srgb, var(--gold) 30%, transparent)',
          }}
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
        </div>,
        document.body
      )}
    </div>
  )
}
