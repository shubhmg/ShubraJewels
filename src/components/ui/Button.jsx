export function Button({ children, variant = 'primary', size = 'md', className = '', loading, disabled, ...props }) {
  const base = 'inline-flex items-center justify-center gap-2 font-medium rounded-full transition-all duration-200 cursor-pointer select-none focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-gold-500 focus-visible:ring-offset-2 active:scale-[0.97] disabled:opacity-50 disabled:cursor-not-allowed'

  const variants = {
    primary:   'bg-dark-900 text-white hover:bg-stone-700 dark:bg-gold-500 dark:text-dark-950 dark:hover:bg-gold-400 shadow-sm',
    gold:      'bg-gold-gradient text-dark-950 hover:shadow-gold-lg shadow-gold font-semibold',
    outline:   'border border-current text-dark-900 dark:text-cream-50 hover:bg-cream-100 dark:hover:bg-stone-800',
    ghost:     'text-dark-900 dark:text-cream-50 hover:bg-cream-100 dark:hover:bg-stone-800',
    danger:    'bg-red-600 text-white hover:bg-red-700',
    glass:     'glass-card text-dark-900 dark:text-cream-50 hover:shadow-glass-lg',
  }

  const sizes = {
    xs: 'px-3 py-1.5 text-xs',
    sm: 'px-4 py-2   text-sm',
    md: 'px-6 py-2.5 text-sm',
    lg: 'px-8 py-3   text-base',
    xl: 'px-10 py-4  text-lg',
    icon: 'p-2 rounded-full',
  }

  return (
    <button
      disabled={disabled || loading}
      className={`${base} ${variants[variant]} ${sizes[size]} ${className}`}
      {...props}
    >
      {loading && (
        <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24" fill="none">
          <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
          <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8v4l3-3-3-3v4a8 8 0 00-8 8h4z" />
        </svg>
      )}
      {children}
    </button>
  )
}
