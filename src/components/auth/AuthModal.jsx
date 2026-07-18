import { useState, useEffect, useRef } from 'react'
import { X, Loader2, ArrowLeft, Mail, ShieldCheck, Check } from 'lucide-react'
import { useCustomerStore } from '../../store/customerStore.js'
import { Motif } from '../decor/Decor.jsx'

const GOOGLE_CLIENT_ID = import.meta.env.VITE_GOOGLE_CLIENT_ID || ''

// Resolve once the Google Identity Services script is ready. It's preloaded in
// index.html (so the button renders instantly), so this usually just waits on
// that existing tag rather than injecting its own.
const GSI_SRC = 'https://accounts.google.com/gsi/client'
let gsiPromise = null
function loadGsi() {
  if (gsiPromise) return gsiPromise
  gsiPromise = new Promise((resolve) => {
    if (window.google?.accounts?.id) return resolve()
    const existing = document.querySelector(`script[src="${GSI_SRC}"]`)
    if (existing) { existing.addEventListener('load', () => resolve()); return }
    const s = document.createElement('script')
    s.src = GSI_SRC
    s.async = true
    s.onload = resolve
    document.head.appendChild(s)
  })
  return gsiPromise
}

// GSI's initialize() should run once per page — calling it repeatedly logs a
// "called multiple times" warning. Track it globally; the button can still be
// re-rendered (renderButton) as often as needed.
let gsiInited = false

// Google's own rendered sign-in button, light/outline theme — the familiar
// white "Continue with Google" pill. Rendered directly (no custom overlay) and
// sized to fill its container; re-drawn on resize so it always spans the modal.
function GoogleSignInButton({ onCredential, disabled }) {
  const wrap = useRef(null)
  const holder = useRef(null)
  const cb = useRef(onCredential)
  cb.current = onCredential

  useEffect(() => {
    if (!GOOGLE_CLIENT_ID) return
    let cancelled = false
    const render = () => {
      if (cancelled || !holder.current || !window.google) return
      const w = Math.min(400, Math.max(240, Math.round(wrap.current?.offsetWidth) || 320))
      holder.current.innerHTML = ''
      window.google.accounts.id.renderButton(holder.current, {
        type: 'standard', theme: 'outline', size: 'large',
        text: 'continue_with', shape: 'pill', logo_alignment: 'center', width: w,
      })
    }
    const setup = () => {
      if (cancelled || !window.google) return
      if (!gsiInited) {
        window.google.accounts.id.initialize({
          client_id: GOOGLE_CLIENT_ID,
          callback: (resp) => cb.current?.(resp.credential),
        })
        gsiInited = true
      }
      render()
    }
    loadGsi().then(setup)
    window.addEventListener('resize', render)
    return () => { cancelled = true; window.removeEventListener('resize', render) }
  }, [])

  if (!GOOGLE_CLIENT_ID) return null

  return (
    <div ref={wrap} className={`w-full ${disabled ? 'opacity-60 pointer-events-none' : ''}`}>
      <div ref={holder} className="flex justify-center min-h-[44px] [color-scheme:light]" />
    </div>
  )
}

const isEmail = (v) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(String(v || '').trim())

// Unified sign-in / sign-up. The customer enters their email FIRST; a lookup
// then decides the path — password step for an existing account, create-account
// step for a new one, or "continue with Google" for a Google-only account. This
// removes the classic dead-ends ("wrong password" when there's no account /
// "email already exists" when trying to register) in both directions.
//
// Checkout reuse: pass `prefillEmail` + `lockEmail` (email already collected) so
// the modal skips straight to the password / create step, `onSkip` to offer a
// "continue as guest" escape, and `benefits` to list what an account unlocks.
export function AuthModal({
  open, onClose, onSuccess, onSkip,
  prefillEmail = '', prefillName = '', prefillPhone = '',
  lockEmail = false, benefits = [], title, subtitle,
}) {
  const [step, setStep] = useState('email') // 'email' | 'login' | 'register' | 'googleOnly'
  const [email, setEmail] = useState('')
  const [form, setForm] = useState({ name: '', password: '', phone: '' })
  const [checking, setChecking] = useState(false)
  const [localErr, setLocalErr] = useState('')
  const { login, register, google, checkEmail, loading, error } = useCustomerStore()

  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  const busy = checking || loading

  // Verify a Google credential, then sign in + close.
  const handleGoogleCredential = async (credential) => {
    if (!credential) return
    if (await google(credential)) { onSuccess?.(); onClose() }
  }

  // Look the email up and branch to the right step.
  const runLookup = async (value) => {
    setLocalErr(''); setChecking(true)
    useCustomerStore.setState({ error: null })
    const res = await checkEmail(value)
    setChecking(false)
    if (!res) { setStep('register'); return } // lookup failed → safe default
    if (res.exists && res.hasPassword) setStep('login')
    else if (res.exists && res.hasGoogle) setStep('googleOnly')
    else setStep('register')
  }

  // Reset whenever the modal (re)opens. When the email is known + locked
  // (checkout), auto-advance past the email step.
  useEffect(() => {
    if (!open) return
    const seed = (prefillEmail || '').trim().toLowerCase()
    setEmail(seed)
    setForm({ name: prefillName || '', password: '', phone: prefillPhone || '' })
    setLocalErr('')
    useCustomerStore.setState({ error: null })
    setStep('email')
    if (lockEmail && isEmail(seed)) runLookup(seed)
  }, [open]) // eslint-disable-line

  if (!open) return null

  const continueEmail = async (e) => {
    e?.preventDefault()
    const value = email.trim().toLowerCase()
    if (!isEmail(value)) { setLocalErr('Enter a valid email address'); return }
    await runLookup(value)
  }

  const submit = async (e) => {
    e.preventDefault()
    setLocalErr('')
    const value = email.trim().toLowerCase()
    let ok = false
    if (step === 'login') {
      ok = await login(value, form.password)
    } else {
      // register → account created + signed in. If the email was taken in a
      // race (or the lookup missed), fall back to the password sign-in step.
      ok = await register({ name: form.name, email: value, password: form.password, phone: form.phone })
      if (!ok && /already exists/i.test(useCustomerStore.getState().error || '')) {
        useCustomerStore.setState({ error: null })
        setStep('login')
        return
      }
    }
    if (ok) { onSuccess?.(); onClose() }
  }

  const backToEmail = () => {
    setStep('email'); setForm({ name: prefillName || '', password: '', phone: prefillPhone || '' })
    setLocalErr(''); useCustomerStore.setState({ error: null })
  }

  const input = 'w-full px-4 py-2.5 rounded-xl border bg-white text-sm focus:outline-none focus:ring-2'
  const border = { borderColor: 'color-mix(in srgb, var(--gold) 40%, transparent)', '--tw-ring-color': 'color-mix(in srgb, var(--gold) 45%, transparent)' }
  const autoChecking = checking && lockEmail && step === 'email'

  const heading =
    step === 'login' ? 'Welcome back'
    : step === 'register' ? (title || 'Create your account')
    : step === 'googleOnly' ? 'Continue with Google'
    : (title || 'Sign in or create account')
  const sub =
    step === 'login' ? 'Enter your password to sign in'
    : step === 'register' ? (subtitle || 'Just pick a password — your email is set')
    : step === 'googleOnly' ? 'This email is registered with Google'
    : (subtitle || 'One step — track orders, save addresses & checkout faster')

  const skipBtn = onSkip && (
    <button type="button" onClick={onSkip} disabled={busy} className="w-full text-center text-sm text-stone-500 hover:text-stone-700 mt-1 cursor-pointer disabled:opacity-50">
      Skip for now
    </button>
  )

  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
      <div className="fixed inset-0 bg-black/60 backdrop-blur-sm" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-sm bg-white rounded-2xl shadow-2xl p-7 animate-slide-up">
        <button onClick={onClose} className="absolute top-4 right-4 text-stone-400 hover:text-stone-700 cursor-pointer"><X size={18} /></button>

        <div className="text-center mb-5">
          <Motif size={26} className="mx-auto" />
          <h2 className="font-display text-2xl mt-1" style={{ color: 'var(--ink)' }}>{heading}</h2>
          <p className="text-sm text-stone-500">{sub}</p>
        </div>

        {/* Benefit list (checkout context) */}
        {benefits.length > 0 && (step === 'register' || autoChecking) && (
          <ul className="space-y-1.5 mb-4">
            {benefits.map((b, i) => (
              <li key={i} className="flex items-center gap-2 text-sm text-stone-600">
                <Check size={15} style={{ color: 'var(--maroon)' }} className="shrink-0" /> {b}
              </li>
            ))}
          </ul>
        )}

        {/* Locked email chip on the password/register steps (with a change link). */}
        {step !== 'email' && (
          <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2 mb-4 text-sm" style={{ background: 'color-mix(in srgb, var(--gold) 10%, transparent)' }}>
            <span className="inline-flex items-center gap-2 min-w-0" style={{ color: 'var(--ink)' }}>
              <Mail size={14} style={{ color: 'var(--maroon)' }} className="shrink-0" />
              <span className="truncate">{email.trim().toLowerCase()}</span>
            </span>
            {!lockEmail && (
              <button onClick={backToEmail} className="font-semibold shrink-0 inline-flex items-center gap-1 cursor-pointer" style={{ color: 'var(--maroon)' }}>
                <ArrowLeft size={13} /> Change
              </button>
            )}
          </div>
        )}

        {/* ── Auto-checking a locked email (checkout) ── */}
        {autoChecking && (
          <div className="flex flex-col items-center gap-2 py-4 text-stone-400">
            <Loader2 size={20} className="animate-spin" />
            <span className="text-sm">Checking your email…</span>
          </div>
        )}

        {/* ── Step 1: email ── */}
        {step === 'email' && !autoChecking && (
          <>
            {GOOGLE_CLIENT_ID && (
              <>
                <GoogleSignInButton onCredential={handleGoogleCredential} disabled={busy} />
                <div className="flex items-center gap-3 my-4 text-xs text-stone-400">
                  <span className="flex-1 h-px bg-stone-200" /> or <span className="flex-1 h-px bg-stone-200" />
                </div>
              </>
            )}
            <form onSubmit={continueEmail} className="space-y-3">
              <input
                type="email" required autoFocus value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email address" className={input} style={border}
              />
              {(localErr || error) && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{localErr || error}</p>}
              <button type="submit" disabled={busy} className="btn-maroon w-full">
                {checking ? <Loader2 size={16} className="animate-spin" /> : 'Continue'}
              </button>
            </form>
            {skipBtn}
          </>
        )}

        {/* ── Step 2a: existing account → password ── */}
        {step === 'login' && (
          <>
            <form onSubmit={submit} className="space-y-3">
              <input
                type="password" required autoFocus value={form.password}
                onChange={(e) => set('password', e.target.value)}
                placeholder="Password" className={input} style={border}
              />
              {(localErr || error) && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{localErr || error}</p>}
              <button type="submit" disabled={busy} className="btn-maroon w-full">
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Sign in'}
              </button>
            </form>
            {skipBtn}
          </>
        )}

        {/* ── Step 2b: new account → name + password ── */}
        {step === 'register' && (
          <>
            <form onSubmit={submit} className="space-y-3">
              <input autoFocus value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="Full name" className={input} style={border} />
              <input value={form.phone} onChange={(e) => set('phone', e.target.value)} placeholder="Phone (optional)" className={input} style={border} />
              <input type="password" required value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Create a password (min 6 chars)" className={input} style={border} />
              {(localErr || error) && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{localErr || error}</p>}
              <button type="submit" disabled={busy} className="btn-maroon w-full">
                {loading ? <Loader2 size={16} className="animate-spin" /> : 'Create account'}
              </button>
            </form>
            {skipBtn}
            {!onSkip && <p className="text-xs text-stone-400 flex items-center justify-center gap-1.5 mt-3"><ShieldCheck size={13} /> Your email is already set — no confirmation needed.</p>}
          </>
        )}

        {/* ── Step 2c: Google-only account ── */}
        {step === 'googleOnly' && (
          <div className="space-y-3">
            <p className="text-sm text-stone-600 text-center">You created this account with Google. Continue with Google to sign in.</p>
            <GoogleSignInButton onCredential={handleGoogleCredential} disabled={busy} />
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            {skipBtn}
          </div>
        )}
      </div>
    </div>
  )
}
