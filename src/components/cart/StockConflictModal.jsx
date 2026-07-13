import { AlertCircle, ArrowRight } from 'lucide-react'

// Shown at checkout when an item in the bag sold out (or partly sold out) while
// the customer was filling in their details. The bag has already been corrected
// by the caller — this just explains what changed, warmly, before they retry.
export function StockConflictModal({ issues, onClose }) {
  if (!issues?.length) return null
  const soldOut = issues.filter(i => !(i.available > 0))
  const reduced = issues.filter(i => i.available > 0)

  return (
    <div className="fixed inset-0 z-[60] flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(10, 7, 5, 0.88)', backdropFilter: 'blur(12px)' }}
        onClick={onClose}
        aria-hidden="true"
      />

      <div
        className="relative z-10 w-full sm:max-w-md flex flex-col rounded-t-[22px] sm:rounded-[28px] animate-fade-in"
        style={{ background: 'var(--cream)', boxShadow: '0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,168,76,0.15)', overflow: 'hidden' }}
        role="dialog"
        aria-modal="true"
        aria-label="Availability changed"
      >
        <div style={{ height: '3px', background: 'linear-gradient(90deg, var(--maroon), var(--gold), var(--maroon))' }} />

        <div className="px-5 sm:px-7 pt-6 pb-2 text-center">
          <div className="w-14 h-14 rounded-full grid place-items-center mx-auto mb-4" style={{ background: 'rgba(123,30,43,0.10)' }}>
            <AlertCircle size={26} style={{ color: 'var(--maroon)' }} />
          </div>
          <h2 className="font-display text-2xl font-bold" style={{ color: 'var(--ink)' }}>
            {soldOut.length && !reduced.length ? 'Just sold out' : 'Availability changed'}
          </h2>
          <p className="text-sm text-stone-500 mt-1.5 max-w-xs mx-auto">
            Someone grabbed these while you were checking out. We&apos;ve updated your bag — please review and continue.
          </p>
        </div>

        <div className="px-5 sm:px-7 py-4 space-y-2.5 max-h-[45vh] overflow-y-auto">
          {issues.map((it) => (
            <div key={String(it.productId)} className="flex items-center gap-3 p-2.5 rounded-2xl" style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.06)' }}>
              {it.image
                ? <img src={it.image} alt={it.name} className="w-12 h-14 object-cover rounded-lg shrink-0" />
                : <div className="w-12 h-14 rounded-lg shrink-0" style={{ background: 'rgba(123,30,43,0.08)' }} />}
              <div className="min-w-0 flex-1">
                <p className="font-display font-bold text-sm leading-snug line-clamp-2" style={{ color: 'var(--ink)' }}>{it.name}</p>
                <p className="text-xs font-medium mt-0.5" style={{ color: 'var(--maroon)' }}>
                  {it.available > 0
                    ? `Only ${it.available} left — quantity reduced`
                    : 'Sold out — removed from bag'}
                </p>
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 sm:px-7 pt-2 pb-[max(1.25rem,env(safe-area-inset-bottom))] sm:pb-7">
          <button
            onClick={onClose}
            className="w-full flex items-center justify-center gap-2 py-3.5 rounded-2xl font-bold text-sm sm:text-base tracking-wide transition-all duration-200 cursor-pointer"
            style={{ background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 50%, var(--gold) 100%)', color: 'var(--ink)' }}
          >
            Review my bag <ArrowRight size={16} />
          </button>
        </div>
      </div>
    </div>
  )
}
