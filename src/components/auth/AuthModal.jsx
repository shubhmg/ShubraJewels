import { useState, useEffect, useRef } from 'react'
import { X, Loader2 } from 'lucide-react'
import { useCustomerStore } from '../../store/customerStore.js'
import { Motif } from '../decor/Decor.jsx'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

// Load the Google Identity Services script once.
let gsiPromise = null
function loadGsi() {
  if (gsiPromise) return gsiPromise
  gsiPromise = new Promise((resolve) => {
    if (window.google?.accounts?.id) return resolve()
    const s = document.createElement('script')
    s.src = 'https://accounts.google.com/gsi/client'
    s.async = true
    s.onload = resolve
    document.head.appendChild(s)
  })
  return gsiPromise
}

export function AuthModal({ open, onClose, onSuccess }) {
  const [mode, setMode] = useState('login') // 'login' | 'register'
  const [form, setForm] = useState({ name: '', email: '', password: '', phone: '' })
  const { login, register, google, loading, error } = useCustomerStore()
  const googleBtn = useRef(null)

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))

  useEffect(() => { if (open) setForm({ name: '', email: '', password: '', phone: '' }) }, [open, mode])

  // Render the Google button when the modal opens.
  useEffect(() => {
    if (!open || !GOOGLE_CLIENT_ID) return
    let cancelled = false
    loadGsi().then(() => {
      if (cancelled || !googleBtn.current || !window.google) return
      window.google.accounts.id.initialize({
        client_id: GOOGLE_CLIENT_ID,
        callback: async (resp) => {
          const ok = await google(resp.credential)
          if (ok) { onSuccess?.(); onClose() }
        },
      })
      googleBtn.current.innerHTML = ''
      window.google.accounts.id.renderButton(googleBtn.current, { theme: 'outline', size: 'large', width: 320, text: 'continue_with' })
    })
    return () => { cancelled = true }
  }, [open, mode]) // eslint-disable-line

  if (!open) return null

  const submit = async (e) => {
    e.preventDefault()
    const ok = mode === 'login'
      ? await login(form.email, form.password)
      : await register(form)
    if (ok) { onSuccess?.(); onClose() }
  }

  const input = 'w-full px-4 py-2.5 rounded-xl border bg-white text-sm focus:outline-none'
  const border = { borderColor: 'color-mix(in srgb, var(--gold) 40%, transparent)' }

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-7 animate-slide-up">
        <button onClick={onClose} className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 cursor-pointer"><X size={18} /></button>
        <div className="text-center mb-5">
          <Motif size={26} className="mx-auto" />
          <h2 className="font-display text-2xl mt-1" style={{ color: 'var(--ink)' }}>{mode === 'login' ? 'Welcome back' : 'Create account'}</h2>
          <p className="text-sm text-stone-500">{mode === 'login' ? 'Sign in to track your orders' : 'Save your bag & order history'}</p>
        </div>

        {GOOGLE_CLIENT_ID && (
          <>
            <div ref={googleBtn} className="flex justify-center mb-4 min-h-[40px]" />
            <div className="flex items-center gap-3 mb-4 text-xs text-stone-400">
              <span className="flex-1 h-px bg-stone-200" /> or <span className="flex-1 h-px bg-stone-200" />
            </div>
          </>
        )}

        <form onSubmit={submit} className="space-y-3">
          {mode === 'register' && <input value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Full name" className={input} style={border} />}
          <input type="email" required value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="Email" className={input} style={border} />
          {mode === 'register' && <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="Phone (optional)" className={input} style={border} />}
          <input type="password" required value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Password" className={input} style={border} />
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading} className="btn-maroon w-full">
            {loading ? <Loader2 size={16} className="animate-spin" /> : mode === 'login' ? 'Sign in' : 'Create account'}
          </button>
        </form>

        <p className="text-center text-sm text-stone-500 mt-4">
          {mode === 'login' ? "New here? " : 'Already have an account? '}
          <button onClick={() => setMode(mode === 'login' ? 'register' : 'login')} className="font-semibold cursor-pointer" style={{ color: 'var(--maroon)' }}>
            {mode === 'login' ? 'Create an account' : 'Sign in'}
          </button>
        </p>
      </div>
    </div>
  )
}
