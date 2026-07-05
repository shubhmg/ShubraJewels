export function Badge({ children, variant = 'default', className = '' }) {
  // Solid, high-contrast pills for the ones that sit over product photos.
  const onPhoto = 'text-white shadow-[0_2px_6px_rgba(0,0,0,0.45)]'

  // Storefront product badges follow the editable theme palette (CSS vars),
  // so they re-tint automatically when the admin changes brand colours.
  const themed = {
    new:        { background: 'var(--maroon)', color: 'var(--cream)', boxShadow: '0 2px 6px rgba(0,0,0,0.35)' },
    bestseller: { background: 'linear-gradient(135deg, var(--gold), var(--gold-light))', color: 'var(--ink)', boxShadow: '0 2px 6px rgba(0,0,0,0.3)' },
    sale:       { background: 'var(--maroon-dark)', color: 'var(--gold-light)', boxShadow: '0 2px 6px rgba(0,0,0,0.35)' },
  }

  const variants = {
    default:    `bg-dark-900/85 backdrop-blur-sm ${onPhoto}`,
    gold:       'bg-gold-500/15 text-gold-700 dark:text-gold-400 border border-gold-500/30',
    processing: 'bg-blue-50 text-blue-700 dark:bg-blue-950 dark:text-blue-400',
    shipped:    'bg-violet-50 text-violet-700 dark:bg-violet-950 dark:text-violet-400',
    delivered:  'bg-emerald-50 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-400',
    pending:    'bg-amber-50 text-amber-700 dark:bg-amber-950 dark:text-amber-400',
    cancelled:  'bg-red-50 text-red-700 dark:bg-red-950 dark:text-red-400',
    platinum:   'bg-slate-100 text-slate-700 dark:bg-slate-800 dark:text-slate-300',
    silver:     'bg-stone-100 text-stone-600 dark:bg-stone-800 dark:text-stone-300',
    bronze:     'bg-orange-50 text-orange-700 dark:bg-orange-950 dark:text-orange-400',
  }
  return (
    <span
      className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold ${variants[variant] || ''} ${className}`}
      style={themed[variant]}
    >
      {children}
    </span>
  )
}
