import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { Loader2 } from 'lucide-react'
import { useAuthStore } from '../../store/authStore.js'
import { useSettings } from '../../lib/SettingsProvider.jsx'
import { Motif } from '../../components/decor/Decor.jsx'

export function AdminLogin() {
  const settings = useSettings()
  const navigate = useNavigate()
  const { login, loading, error } = useAuthStore()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  const submit = async (e) => {
    e.preventDefault()
    const ok = await login(email, password)
    if (ok) navigate('/admin')
  }

  return (
    <div className="min-h-dvh grid place-items-center px-4" style={{ background: 'var(--maroon-dark)' }}>
      <form onSubmit={submit} className="w-full max-w-sm bg-white rounded-2xl shadow-2xl p-8">
        <div className="text-center mb-6">
          <Motif size={28} className="mx-auto" />
          <h1 className="font-display text-2xl mt-2" style={{ color: 'var(--ink)' }}>{settings.brandName} Admin</h1>
          <p className="font-hindi text-sm" style={{ color: 'var(--maroon)' }}>{settings.slogan}</p>
        </div>
        <div className="space-y-3">
          <input type="email" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="Email" required
            className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={{ borderColor: 'color-mix(in srgb, var(--gold) 40%, transparent)' }} />
          <input type="password" value={password} onChange={(e) => setPassword(e.target.value)} placeholder="Password" required
            className="w-full px-4 py-2.5 rounded-xl border text-sm focus:outline-none" style={{ borderColor: 'color-mix(in srgb, var(--gold) 40%, transparent)' }} />
          {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
          <button type="submit" disabled={loading} className="btn-maroon w-full">
            {loading ? <Loader2 size={16} className="animate-spin" /> : 'Log in'}
          </button>
        </div>
      </form>
    </div>
  )
}
