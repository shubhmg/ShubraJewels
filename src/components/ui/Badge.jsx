export function Badge({ children, variant = 'default', className = '' }) {
  const variants = {
    default:    'bg-cream-200 text-stone-700 dark:bg-stone-800 dark:text-stone-300',
    gold:       'bg-gold-500/15 text-gold-700 dark:text-gold-400 border border-gold-500/30',
    new:        'bg-emerald-50 text-emerald-700 border border-emerald-200 dark:bg-emerald-950 dark:text-emerald-400 dark:border-emerald-800',
    sale:       'bg-red-50 text-red-700 border border-red-200 dark:bg-red-950 dark:text-red-400 dark:border-red-800',
    bestseller: 'bg-gold-500/10 text-gold-700 dark:text-gold-400 border border-gold-500/20',
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
    <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${variants[variant]} ${className}`}>
      {children}
    </span>
  )
}
