export function Input({ label, error, className = '', ...props }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
          {label}
        </label>
      )}
      <input
        className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-stone-900 dark:text-cream-50 text-sm
          border-cream-200 dark:border-stone-700 placeholder-stone-400
          focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500
          transition-all duration-200 ${error ? 'border-red-400 focus:ring-red-400/50' : ''}
          ${className}`}
        {...props}
      />
      {error && <p className="text-xs text-red-500">{error}</p>}
    </div>
  )
}

export function Select({ label, children, className = '', ...props }) {
  return (
    <div className="space-y-1.5">
      {label && (
        <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">
          {label}
        </label>
      )}
      <select
        className={`w-full px-4 py-2.5 rounded-xl border bg-white dark:bg-stone-900 dark:text-cream-50 text-sm
          border-cream-200 dark:border-stone-700
          focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500
          transition-all duration-200 cursor-pointer ${className}`}
        {...props}
      >
        {children}
      </select>
    </div>
  )
}
