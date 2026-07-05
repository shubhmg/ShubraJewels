import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { Loader2, LogOut, Package, Star, X } from 'lucide-react'
import { api } from '../../lib/api.js'
import { useCustomerStore } from '../../store/customerStore.js'
import { AuthModal } from '../../components/auth/AuthModal.jsx'
import { Motif } from '../../components/decor/Decor.jsx'

const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n || 0)
const STATUS_COLOR = {
  pending: 'bg-amber-100 text-amber-700', confirmed: 'bg-blue-100 text-blue-700',
  shipped: 'bg-violet-100 text-violet-700', delivered: 'bg-emerald-100 text-emerald-700',
  cancelled: 'bg-red-100 text-red-700',
}

export function Account() {
  const { customer, fetchMe, logout, isAuthed } = useCustomerStore()
  const [orders, setOrders] = useState(null)
  const [reviews, setReviews] = useState([])
  const [rateItem, setRateItem] = useState(null)   // { productId, name }
  const [authOpen, setAuthOpen] = useState(false)

  useEffect(() => {
    if (isAuthed()) {
      fetchMe()
      api.get('/customer/orders', { custAuth: true }).then(setOrders).catch(() => setOrders([]))
      api.get('/customer/reviews', { custAuth: true }).then(setReviews).catch(() => setReviews([]))
    }
  }, []) // eslint-disable-line

  const reviewOf = (productId) => reviews.find((r) => String(r.productId) === String(productId))

  const onRated = (review) => {
    setReviews((prev) => {
      const rest = prev.filter((r) => String(r.productId) !== String(review.productId))
      return [...rest, review]
    })
    setRateItem(null)
  }

  if (!isAuthed()) {
    return (
      <div className="pt-24 min-h-dvh flex items-center justify-center" style={{ background: 'var(--cream)' }}>
        <div className="text-center px-4 py-16">
          <Motif size={30} className="mx-auto" />
          <h1 className="font-display text-3xl mt-2" style={{ color: 'var(--ink)' }}>Your Account</h1>
          <p className="text-stone-500 mt-1 mb-6">Sign in to see your orders and saved bag.</p>
          <button onClick={() => setAuthOpen(true)} className="btn-maroon">Sign in / Create account</button>
        </div>
        <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} onSuccess={() => window.location.reload()} />
      </div>
    )
  }

  return (
    <div className="pt-20 min-h-dvh" style={{ background: 'var(--cream)' }}>
      <div className="container-tight py-10">
        {/* Profile */}
        <div className="flex items-center gap-4 mb-8">
          <div className="w-14 h-14 rounded-full grid place-items-center text-xl font-bold text-white shrink-0" style={{ background: 'var(--maroon)' }}>
            {(customer?.name || customer?.email || '?')[0]?.toUpperCase()}
          </div>
          <div className="flex-1 min-w-0">
            <h1 className="font-display text-2xl leading-tight" style={{ color: 'var(--ink)' }}>{customer?.name || 'Welcome'}</h1>
            <p className="text-sm text-stone-500 truncate">{customer?.email}</p>
          </div>
          <button onClick={() => { logout(); window.location.href = '/' }} className="inline-flex items-center gap-1.5 text-sm text-stone-500 hover:text-red-600 cursor-pointer">
            <LogOut size={15} /> <span className="hidden sm:inline">Log out</span>
          </button>
        </div>

        {/* Orders */}
        <div className="flex items-center gap-2 mb-4">
          <Package size={17} style={{ color: 'var(--maroon)' }} />
          <h2 className="font-display text-xl" style={{ color: 'var(--ink)' }}>Order History</h2>
        </div>

        {orders === null ? (
          <div className="flex justify-center py-16"><Loader2 className="animate-spin" style={{ color: 'var(--maroon)' }} /></div>
        ) : orders.length === 0 ? (
          <div className="text-center py-16 bg-white rounded-2xl shadow-card">
            <p className="text-stone-500">You haven't placed any orders yet.</p>
            <Link to="/products" className="btn-maroon mt-4 inline-flex">Start shopping</Link>
          </div>
        ) : (
          <div className="space-y-3">
            {orders.map((o) => {
              const delivered = o.status === 'delivered'
              return (
                <div key={o._id} className="bg-white rounded-2xl shadow-card p-4">
                  <div className="flex items-center justify-between gap-3 flex-wrap">
                    <div>
                      <p className="font-bold" style={{ color: 'var(--ink)' }}>{o.orderNo}</p>
                      <p className="text-xs text-stone-400">{new Date(o.createdAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })} · {o.items?.length} item(s)</p>
                    </div>
                    <div className="flex items-center gap-3">
                      <span className={`text-[11px] px-2.5 py-1 rounded-full font-bold uppercase tracking-wide ${STATUS_COLOR[o.status]}`}>{o.status}</span>
                      <span className="font-bold" style={{ color: 'var(--maroon)' }}>{fmt(o.total)}</span>
                    </div>
                  </div>
                  <div className="mt-3 pt-3 border-t border-stone-100 space-y-2">
                    {o.items.map((it, i) => {
                      const rev = it.productId && reviewOf(it.productId)
                      return (
                        <div key={i} className="flex items-center gap-2 text-sm text-stone-600">
                          {it.image && <img src={it.image} alt="" className="w-8 h-8 rounded object-cover shrink-0" />}
                          <span className="flex-1 min-w-0 truncate">{it.name} × {it.qty}</span>
                          {delivered && it.productId ? (
                            rev ? (
                              <span className="inline-flex items-center gap-1 text-xs font-semibold" style={{ color: 'var(--gold)' }}>
                                <Star size={13} className="fill-current" /> {rev.rating}
                              </span>
                            ) : (
                              <button onClick={() => setRateItem({ productId: it.productId, name: it.name })} className="inline-flex items-center gap-1 text-xs font-semibold px-2.5 py-1 rounded-full cursor-pointer" style={{ background: 'color-mix(in srgb, var(--gold) 18%, transparent)', color: 'var(--maroon-dark)' }}>
                                <Star size={12} /> Rate
                              </button>
                            )
                          ) : (
                            <span>{fmt(it.price * it.qty)}</span>
                          )}
                        </div>
                      )
                    })}
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>

      {rateItem && <RateModal item={rateItem} existing={reviewOf(rateItem.productId)} onClose={() => setRateItem(null)} onDone={onRated} />}
    </div>
  )
}

function RateModal({ item, existing, onClose, onDone }) {
  const [rating, setRating] = useState(existing?.rating || 0)
  const [hover, setHover] = useState(0)
  const [text, setText] = useState(existing?.text || '')
  const [saving, setSaving] = useState(false)
  const [err, setErr] = useState('')

  const submit = async () => {
    if (!rating) { setErr('Please pick a star rating'); return }
    setSaving(true); setErr('')
    try {
      const review = await api.post('/customer/reviews', { productId: item.productId, rating, text }, { custAuth: true })
      onDone(review)
    } catch (e) {
      setErr(e?.message || 'Could not submit your review')
      setSaving(false)
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <div className="absolute inset-0 drawer-overlay" onClick={onClose} />
      <div className="relative w-full sm:max-w-md bg-white rounded-t-3xl sm:rounded-3xl p-6 shadow-xl" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom) + 1.5rem)' }}>
        <button onClick={onClose} className="absolute top-4 right-4 text-stone-400 cursor-pointer"><X size={20} /></button>
        <p className="text-xs uppercase tracking-wider text-stone-400">Rate your purchase</p>
        <h3 className="font-display text-xl mt-0.5 leading-tight pr-6" style={{ color: 'var(--ink)' }}>{item.name}</h3>

        <div className="flex justify-center gap-2 my-5">
          {[1, 2, 3, 4, 5].map((n) => (
            <button key={n} onClick={() => setRating(n)} onMouseEnter={() => setHover(n)} onMouseLeave={() => setHover(0)} className="cursor-pointer" aria-label={`${n} star`}>
              <Star size={34} className={(hover || rating) >= n ? 'fill-current' : ''} style={{ color: (hover || rating) >= n ? 'var(--gold)' : '#d6d3d1' }} />
            </button>
          ))}
        </div>

        <textarea
          value={text}
          onChange={(e) => setText(e.target.value)}
          rows={3}
          maxLength={1000}
          placeholder="Share a few words (optional)"
          className="w-full rounded-xl border border-stone-200 p-3 text-sm outline-none focus:border-[var(--gold)] resize-none"
        />

        {err && <p className="text-sm text-red-500 mt-2">{err}</p>}

        <button onClick={submit} disabled={saving} className="btn-maroon w-full mt-4 disabled:opacity-50">
          {saving ? 'Submitting…' : existing ? 'Update review' : 'Submit review'}
        </button>
        <p className="text-[11px] text-stone-400 text-center mt-2">Verified purchase · your review helps other shoppers</p>
      </div>
    </div>
  )
}
