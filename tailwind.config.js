/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,jsx}'],
  darkMode: 'class',
  theme: {
    extend: {
      colors: {
        // Admin-editable royal palette, driven by CSS vars from SettingsProvider.
        brand: {
          maroon: 'var(--maroon)',
          maroonDark: 'var(--maroon-dark)',
          gold: 'var(--gold)',
          goldLight: 'var(--gold-light)',
          beige: 'var(--beige)',
          cream: 'var(--cream)',
          ink: 'var(--ink)',
        },
        gold: {
          50:  '#fdfaef',
          100: '#faf2d3',
          200: '#f4e4a3',
          300: '#ecce6b',
          400: '#e3b73a',
          500: '#C9A84C',
          600: '#b8922e',
          700: '#996e25',
          800: '#7d5624',
          900: '#694722',
          950: '#3c240f',
        },
        dark: {
          50:  '#f5f5f4',
          900: '#1C1917',
          950: '#0C0A09',
        },
        cream: {
          50:  '#FAFAF9',
          100: '#F5F5F4',
          200: '#E7E5E4',
        },
      },
      fontFamily: {
        // Luxe pairing: Bodoni Moda display + Inter body + Mukta for Hindi
        serif: ['"Bodoni Moda"', 'Georgia', 'serif'],
        sans:  ['Inter', 'system-ui', 'sans-serif'],
        display: ['"Bodoni Moda"', 'Georgia', 'serif'],
        hindi:   ['Mukta', 'Inter', 'sans-serif'],
        mukta:   ['Mukta', 'Inter', 'sans-serif'],
      },
      backgroundImage: {
        'gold-gradient': 'linear-gradient(135deg, #C9A84C 0%, #E3C97A 50%, #C9A84C 100%)',
        'dark-gradient': 'linear-gradient(135deg, #1C1917 0%, #44403C 100%)',
        'glass-gradient': 'linear-gradient(135deg, rgba(255,255,255,0.12) 0%, rgba(255,255,255,0.04) 100%)',
      },
      boxShadow: {
        'gold':    '0 4px 24px -4px rgba(201,168,76,0.35)',
        'gold-lg': '0 8px 40px -8px rgba(201,168,76,0.5)',
        'glass':   '0 8px 32px rgba(0,0,0,0.12), inset 0 1px 0 rgba(255,255,255,0.15)',
        'glass-lg':'0 24px 64px rgba(0,0,0,0.18), inset 0 1px 0 rgba(255,255,255,0.2)',
        'card':    '0 2px 16px rgba(0,0,0,0.06)',
        'card-hover': '0 8px 32px rgba(0,0,0,0.12)',
      },
      animation: {
        'fade-in':    'fadeIn 0.5s ease-out',
        'slide-up':   'slideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'slide-right':'slideRight 0.4s cubic-bezier(0.16, 1, 0.3, 1)',
        'shimmer':    'shimmer 2s linear infinite',
        'float':      'float 6s ease-in-out infinite',
        'spin-slow':  'spin 8s linear infinite',
      },
      keyframes: {
        fadeIn:    { from: { opacity: 0 }, to: { opacity: 1 } },
        slideUp:   { from: { opacity: 0, transform: 'translateY(20px)' }, to: { opacity: 1, transform: 'translateY(0)' } },
        slideRight:{ from: { opacity: 0, transform: 'translateX(-20px)' }, to: { opacity: 1, transform: 'translateX(0)' } },
        shimmer:   { '0%': { backgroundPosition: '-200% 0' }, '100%': { backgroundPosition: '200% 0' } },
        float:     { '0%,100%': { transform: 'translateY(0)' }, '50%': { transform: 'translateY(-12px)' } },
      },
      transitionTimingFunction: {
        'spring': 'cubic-bezier(0.16, 1, 0.3, 1)',
      },
    },
  },
  plugins: [],
}
