import { useState, useRef, useEffect, useLayoutEffect, useMemo } from 'react'
import { createPortal } from 'react-dom'
import { ChevronDown, Check, Search } from 'lucide-react'

/**
 * Searchable combobox — a text input that filters `options` (string[]) in a
 * portal dropdown (never clipped), with keyboard nav and tap-to-select.
 * `allowCustom` lets the user commit a typed value not in the list (cities).
 */
export function Combobox({
  value, onChange, options, placeholder, allowCustom = false,
  disabled = false, error = false, onBlur, inputStyle,
}) {
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const [active, setActive] = useState(0)
  const [pos, setPos] = useState(null)
  const inputRef = useRef(null)
  const menuRef = useRef(null)

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    const list = q ? options.filter((o) => o.toLowerCase().includes(q)) : options
    return list.slice(0, 100)
  }, [query, options])

  const place = () => {
    const r = inputRef.current?.getBoundingClientRect()
    if (!r) return
    // Prefer opening downward; flip up if not enough room.
    const below = window.innerHeight - r.bottom
    const openUp = below < 240 && r.top > below
    setPos({ top: openUp ? undefined : r.bottom + 6, bottom: openUp ? window.innerHeight - r.top + 6 : undefined, left: r.left, width: r.width })
  }
  useLayoutEffect(() => { if (open) place() }, [open, filtered.length]) // eslint-disable-line

  useEffect(() => {
    if (!open) return
    const onDoc = (e) => { if (!inputRef.current?.contains(e.target) && !menuRef.current?.contains(e.target)) setOpen(false) }
    const onScroll = () => place()
    document.addEventListener('mousedown', onDoc)
    window.addEventListener('scroll', onScroll, true)
    window.addEventListener('resize', onScroll)
    return () => {
      document.removeEventListener('mousedown', onDoc)
      window.removeEventListener('scroll', onScroll, true)
      window.removeEventListener('resize', onScroll)
    }
  }, [open])

  const openMenu = () => { if (disabled) return; setQuery(value || ''); setActive(0); setOpen(true) }

  const commit = (val) => {
    onChange(val)
    setOpen(false)
    setQuery('')
    onBlur?.()
  }

  const handleBlur = () => {
    // Delay so an option's onMouseDown/onClick lands first.
    setTimeout(() => {
      if (!menuRef.current) return
      if (allowCustom && query.trim() && query.trim() !== value) onChange(query.trim())
      setOpen(false)
      setQuery('')
      onBlur?.()
    }, 130)
  }

  const onKeyDown = (e) => {
    if (e.key === 'ArrowDown') { e.preventDefault(); if (!open) openMenu(); else setActive((a) => Math.min(a + 1, filtered.length - 1)) }
    else if (e.key === 'ArrowUp') { e.preventDefault(); setActive((a) => Math.max(a - 1, 0)) }
    else if (e.key === 'Enter') {
      if (open) { e.preventDefault(); if (filtered[active]) commit(filtered[active]); else if (allowCustom && query.trim()) commit(query.trim()) }
    } else if (e.key === 'Escape') { setOpen(false); inputRef.current?.blur() }
  }

  return (
    <>
      <div className="relative">
        <input
          ref={inputRef}
          type="text"
          role="combobox"
          aria-expanded={open}
          autoComplete="off"
          disabled={disabled}
          value={open ? query : (value || '')}
          placeholder={placeholder}
          onFocus={openMenu}
          onClick={openMenu}
          onBlur={handleBlur}
          onKeyDown={onKeyDown}
          onChange={(e) => { setQuery(e.target.value); setActive(0); if (!open) setOpen(true) }}
          className="w-full pr-9 px-4 py-3 rounded-xl border bg-white text-base sm:text-sm outline-none focus:ring-2 transition-shadow disabled:bg-stone-50 disabled:text-stone-400 disabled:cursor-not-allowed"
          style={inputStyle}
        />
        <ChevronDown size={16} className={`absolute right-3 top-1/2 -translate-y-1/2 pointer-events-none transition-transform ${open ? 'rotate-180' : ''}`} style={{ color: disabled ? '#d6d3d1' : 'var(--maroon)' }} />
      </div>

      {open && pos && createPortal(
        <div
          ref={menuRef}
          className="fixed z-[80] rounded-xl border bg-white shadow-xl overflow-hidden"
          style={{ top: pos.top, bottom: pos.bottom, left: pos.left, width: pos.width, borderColor: 'color-mix(in srgb, var(--gold) 45%, transparent)' }}
        >
          <div className="max-h-64 overflow-y-auto py-1 overscroll-contain">
            {filtered.length === 0 && !(allowCustom && query.trim()) && (
              <div className="px-4 py-3 text-sm text-stone-400">No matches</div>
            )}
            {filtered.map((o, i) => {
              const sel = o === value
              const hot = i === active
              return (
                <button
                  key={o}
                  type="button"
                  onMouseDown={(e) => e.preventDefault()}
                  onMouseEnter={() => setActive(i)}
                  onClick={() => commit(o)}
                  className="w-full text-left px-4 py-2.5 text-sm flex items-center justify-between gap-2 cursor-pointer"
                  style={{ background: hot ? 'color-mix(in srgb, var(--maroon) 8%, transparent)' : 'transparent', color: 'var(--ink)' }}
                >
                  <span className="truncate">{o}</span>
                  {sel && <Check size={15} style={{ color: 'var(--maroon)' }} className="shrink-0" />}
                </button>
              )
            })}
            {allowCustom && query.trim() && !filtered.some((o) => o.toLowerCase() === query.trim().toLowerCase()) && (
              <button
                type="button"
                onMouseDown={(e) => e.preventDefault()}
                onClick={() => commit(query.trim())}
                className="w-full text-left px-4 py-2.5 text-sm flex items-center gap-2 cursor-pointer border-t"
                style={{ color: 'var(--maroon)', borderColor: 'color-mix(in srgb, var(--gold) 25%, transparent)' }}
              >
                <Search size={14} /> Use “{query.trim()}”
              </button>
            )}
          </div>
        </div>,
        document.body,
      )}
    </>
  )
}
