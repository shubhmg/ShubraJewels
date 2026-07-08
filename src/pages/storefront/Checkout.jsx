import { useState, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Check, ShoppingBag, User, Tag, X } from 'lucide-react'
import { useCartStore } from '../../store/cartStore.js'
import { useCustomerStore } from '../../store/customerStore.js'
import { WhatsAppButton } from '../../components/ui/WhatsAppButton.jsx'
import { AuthModal } from '../../components/auth/AuthModal.jsx'
import { Mandala, Motif } from '../../components/decor/Decor.jsx'
import { api } from '../../lib/api.js'
import { loadRazorpay } from '../../lib/razorpay.js'
import { useSettings, whatsappLink } from '../../lib/SettingsProvider.jsx'
import { INDIAN_CITIES, CITY_STATE } from '../../data/indianCities.js'

const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n || 0)

const EMPTY = { name: '', phone: '', email: '', line1: '', line2: '', city: '', state: '', pincode: '', notes: '' }

// Mirrors server computeShipping — must match so the shown total is right.
function calcShipping(settings, city, subtotal) {
  const s = settings.shipping || {}
  if (Number(s.freeAboveSubtotal) > 0 && subtotal >= Number(s.freeAboveSubtotal)) return 0
  const norm = (v) => String(v || '').toLowerCase().trim()
  const m = (s.cities || []).find((c) => norm(c.name) === norm(city))
  if (m) return Math.max(0, Number(m.charge) || 0)
  return Math.max(0, Number(s.defaultCharge) || 0)
}

export function Checkout() {
  const settings = useSettings()
  const { items, clearCart } = useCartStore()
  const { customer, isAuthed, fetchMe } = useCustomerStore()
  const [form, setForm] = useState(EMPTY)
  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState(null)
  const [placed, setPlaced] = useState(null) // holds the created order
  const [authOpen, setAuthOpen] = useState(false)
  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState(null) // { code, discount }
  const [couponErr, setCouponErr] = useState('')
  const [applyingCoupon, setApplyingCoupon] = useState(false)

  const subtotal = items.reduce((a, i) => a + i.price * i.qty, 0)
  const shipping = calcShipping(settings, form.city, subtotal)
  const discount = coupon?.discount || 0
  const total = Math.max(0, subtotal + shipping - discount)
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }))
  // Selecting a city autofills its state.
  const setCity = (v) => setForm((f) => {
    const st = CITY_STATE[String(v).toLowerCase().trim()]
    return { ...f, city: v, state: st || f.state }
  })

  const applyCoupon = async () => {
    const code = couponInput.trim()
    if (!code) return
    setApplyingCoupon(true); setCouponErr('')
    try {
      const r = await api.post('/coupons/validate', { code, subtotal })
      setCoupon({ code: r.code, discount: r.discount })
      setCouponInput('')
    } catch (e) {
      setCoupon(null); setCouponErr(e?.message || 'Invalid coupon')
    } finally { setApplyingCoupon(false) }
  }
  const removeCoupon = () => { setCoupon(null); setCouponErr('') }

  // Prefill from the signed-in customer.
  useEffect(() => { if (isAuthed()) fetchMe() }, []) // eslint-disable-line
  useEffect(() => {
    if (customer) setForm((f) => ({
      ...f,
      name: f.name || customer.name || '',
      phone: f.phone || customer.phone || '',
      email: f.email || customer.email || '',
      line1: f.line1 || customer.address?.line1 || '',
      line2: f.line2 || customer.address?.line2 || '',
      city: f.city || customer.address?.city || '',
      state: f.state || customer.address?.state || '',
      pincode: f.pincode || customer.address?.pincode || '',
    }))
  }, [customer])

  const buildPayload = (channel) => ({
    items: items.map((i) => ({ productId: i.id || i._id, qty: i.qty })),
    customer: { name: form.name.trim(), phone: form.phone.trim(), email: form.email.trim() },
    address: { line1: form.line1, line2: form.line2, city: form.city, state: form.state, pincode: form.pincode },
    channel,
    couponCode: coupon?.code || '',
    notes: form.notes,
  })

  const validate = () => {
    if (!form.name.trim()) return 'Please enter your name'
    if (!form.phone.trim()) return 'Please enter your phone number'
    return null
  }

  const placeOrder = async (channel) => {
    const v = validate()
    if (v) { setError(v); return null }
    setError(null)
    setPlacing(true)
    try {
      // custAuth links the order to the customer's account when signed in.
      const order = await api.post('/orders', buildPayload(channel), { custAuth: true })
      setPlaced(order)
      clearCart()
      return order
    } catch (e) {
      setError(e.message || 'Could not place order. Please try again.')
      return null
    } finally {
      setPlacing(false)
    }
  }

  // Razorpay Standard Checkout: create order → open modal → verify → save order.
  const payOnline = async () => {
    const v = validate()
    if (v) { setError(v); return }
    setError(null)
    setPlacing(true)
    try {
      // Send the full order to create-order so the server snapshots it as a
      // PaymentIntent — the Razorpay webhook can then finalise even if this
      // browser closes before the verify call.
      const ro = await api.post('/payments/create-order', buildPayload('web'), { custAuth: true })
      const ok = await loadRazorpay()
      if (!ok) throw new Error('Could not load payment gateway')

      const rzp = new window.Razorpay({
        key: ro.keyId,
        order_id: ro.orderId,
        amount: ro.amount,
        currency: ro.currency,
        name: settings.brandName,
        description: 'Jhumka order',
        prefill: { name: form.name, email: form.email, contact: form.phone },
        theme: { color: settings.theme?.maroon || '#7B1E2B' },
        modal: { ondismiss: () => setPlacing(false) },
        handler: async (resp) => {
          try {
            const order = await api.post('/payments/verify', {
              razorpay_order_id: resp.razorpay_order_id,
              razorpay_payment_id: resp.razorpay_payment_id,
              razorpay_signature: resp.razorpay_signature,
              ...buildPayload('web'),
            }, { custAuth: true })
            setPlaced(order); clearCart()
          } catch (e) {
            setError(e.message || 'Payment verification failed. If money was deducted, contact us.')
          } finally { setPlacing(false) }
        },
      })
      rzp.on('payment.failed', (r) => { setError(r?.error?.description || 'Payment failed. Please try again.'); setPlacing(false) })
      rzp.open()
    } catch (e) {
      setError(e.message || 'Could not start payment.')
      setPlacing(false)
    }
  }

  // WhatsApp button: only opens a pre-filled chat — it does NOT place an order.
  const orderViaWhatsApp = () => {
    if (items.length === 0) return
    const lines = items.map((i) => `• ${i.name} × ${i.qty} — ${fmt(i.price * i.qty)}`).join('\n')
    const parts = [settings.whatsappMessage || 'Hello! I would like to order:', '', lines, '', `Subtotal: ${fmt(subtotal)}`]
    if (coupon) parts.push(`Coupon ${coupon.code}: −${fmt(discount)}`)
    parts.push(`Shipping${form.city ? ` (${form.city})` : ''}: ${shipping === 0 ? 'Free' : fmt(shipping)}`)
    parts.push(`Total: ${fmt(total)}`)
    if (form.name.trim()) parts.push(`Name: ${form.name.trim()}`)
    if (form.phone.trim()) parts.push(`Phone: ${form.phone.trim()}`)
    const link = whatsappLink(settings, parts.join('\n'))
    if (link) window.open(link, '_blank')
  }

  /* ── Success ── */
  if (placed) {
    return (
      <div className="pt-20 min-h-dvh flex items-center justify-center animate-fade-in" style={{ background: 'var(--cream)' }}>
        <div className="text-center max-w-md px-4 py-16">
          <div className="w-20 h-20 rounded-full grid place-items-center mx-auto mb-6" style={{ background: 'color-mix(in srgb, var(--maroon) 12%, transparent)' }}>
            <Check size={34} style={{ color: 'var(--maroon)' }} />
          </div>
          <div className="eyebrow justify-center flex"><Motif size={18} /><span className="font-hindi">{settings.slogan}</span></div>
          <h1 className="font-display text-3xl mt-2 mb-2" style={{ color: 'var(--ink)' }}>Order Placed!</h1>
          <p className="text-stone-500">Your order <span className="font-semibold" style={{ color: 'var(--maroon)' }}>{placed.orderNo}</span> has been received. We'll reach out on WhatsApp to confirm.</p>
          <p className="text-sm mt-2" style={{ color: 'var(--maroon)' }}>Total: {fmt(placed.total)}</p>
          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link to="/products" className="btn-maroon">Continue Shopping</Link>
            <WhatsAppButton message={`Hi! About my order ${placed.orderNo}…`} label="Message us" />
          </div>
        </div>
      </div>
    )
  }

  /* ── Empty ── */
  if (items.length === 0) {
    return (
      <div className="pt-20 min-h-dvh flex items-center justify-center" style={{ background: 'var(--cream)' }}>
        <div className="text-center py-20">
          <ShoppingBag size={40} className="mx-auto text-stone-300 mb-4" />
          <h2 className="font-display text-2xl mb-4" style={{ color: 'var(--ink)' }}>Your bag is empty</h2>
          <Link to="/products" className="btn-maroon">Browse Jhumkas</Link>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-dvh animate-fade-in" style={{ background: 'var(--cream)' }}>
      <div className="relative overflow-hidden" style={{ background: 'var(--maroon-dark)' }}>
        <Mandala size={300} className="hidden md:block absolute right-0 md:right-8 top-16 md:top-24 opacity-15 pointer-events-none" />
        <div className="container-wide pt-24 md:pt-28 pb-8 md:pb-12 relative">
          <div className="flex items-center gap-2 text-xs text-white/60 mb-2">
            <Link to="/" className="hover:text-white">Home</Link><ChevronRight size={12} /><span className="text-white/90">Checkout</span>
          </div>
          <h1 className="font-display text-white text-3xl md:text-4xl">Checkout</h1>
        </div>
      </div>

      <div className="container-wide py-6 md:py-10">
        <div className="grid lg:grid-cols-3 gap-6 lg:gap-10">
          <div className="order-2 lg:order-1 lg:col-span-2 min-w-0 space-y-4 md:space-y-6">
            {/* Sign-in prompt (optional — guest checkout allowed) */}
            <div className="bg-white rounded-2xl p-4 shadow-card flex items-center gap-3">
              <div className="w-9 h-9 rounded-full grid place-items-center shrink-0" style={{ background: 'color-mix(in srgb, var(--maroon) 12%, transparent)', color: 'var(--maroon)' }}><User size={17} /></div>
              {isAuthed() ? (
                <p className="text-sm text-stone-600">Signed in as <span className="font-semibold" style={{ color: 'var(--ink)' }}>{customer?.email}</span> — this order will be saved to your account.</p>
              ) : (
                <p className="text-sm text-stone-600 flex-1">
                  <button onClick={() => setAuthOpen(true)} className="font-semibold underline underline-offset-2" style={{ color: 'var(--maroon)' }}>Sign in</button> to track this order & save your bag — or continue as guest below.
                </p>
              )}
            </div>

            <div className="bg-white rounded-2xl p-4 md:p-6 shadow-card space-y-4">
              <h2 className="font-display text-xl" style={{ color: 'var(--ink)' }}>Your Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name *" value={form.name} onChange={(v) => set('name', v)} placeholder="Priya Sharma" />
                <Field label="Phone *" type="tel" value={form.phone} onChange={(v) => set('phone', v)} placeholder="98xxxxxxxx" />
              </div>
              <Field label="Email (optional)" type="email" value={form.email} onChange={(v) => set('email', v)} placeholder="you@example.com" />

              <h2 className="font-display text-xl pt-2" style={{ color: 'var(--ink)' }}>Shipping Address</h2>
              <Field label="Address" value={form.line1} onChange={(v) => set('line1', v)} placeholder="House no., street" />
              <Field label="Landmark / Area (optional)" value={form.line2} onChange={(v) => set('line2', v)} placeholder="Landmark, area" />
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-3 sm:gap-4">
                <Field label="City" value={form.city} onChange={setCity} placeholder="Start typing…" list="in-cities" />
                <Field label="State" value={form.state} onChange={(v) => set('state', v)} placeholder="State" />
                <Field label="PIN" type="tel" value={form.pincode} onChange={(v) => set('pincode', v)} placeholder="1100xx" />
              </div>
              <datalist id="in-cities">{INDIAN_CITIES.map((c) => <option key={c} value={c} />)}</datalist>
              <Field label="Order notes (optional)" value={form.notes} onChange={(v) => set('notes', v)} placeholder="Anything we should know?" />

              {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}

              {settings.payments?.razorpay !== false && (
                <button onClick={payOnline} disabled={placing} className="btn-gold w-full !py-3.5 text-base disabled:opacity-60">
                  {placing ? 'Processing…' : `Pay Online · ${fmt(total)}`}
                </button>
              )}
              <div className="flex flex-col sm:flex-row gap-3">
                <button onClick={orderViaWhatsApp} disabled={placing} className="btn-whatsapp flex-1 disabled:opacity-60">
                  Order on WhatsApp
                </button>
                {settings.payments?.cod !== false && (
                  <button onClick={() => placeOrder('web')} disabled={placing} className="btn-outline-gold flex-1 disabled:opacity-60">
                    Pay on delivery
                  </button>
                )}
              </div>
              <p className="text-xs text-stone-400 text-center">
                {settings.payments?.razorpay !== false ? 'Secure payments by Razorpay (UPI, cards, netbanking) · ' : ''}order over WhatsApp{settings.payments?.cod !== false ? ' / pay on delivery' : ''}.
              </p>
            </div>
          </div>

          <aside className="order-1 lg:order-2 min-w-0 bg-white rounded-2xl p-4 md:p-6 shadow-card h-fit space-y-4 lg:sticky lg:top-24">
            <h3 className="font-display text-lg" style={{ color: 'var(--ink)' }}>Order Summary</h3>
            <div className="space-y-3">
              {items.map((item) => (
                <div key={item.key} className="flex items-center gap-3">
                  <img src={item.images?.[0]} alt={item.name} className="w-12 h-14 object-cover rounded-lg shrink-0" />
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-medium truncate" style={{ color: 'var(--ink)' }}>{item.name}</p>
                    <p className="text-xs text-stone-400">Qty: {item.qty}</p>
                  </div>
                  <p className="text-sm font-semibold shrink-0 whitespace-nowrap">{fmt(item.price * item.qty)}</p>
                </div>
              ))}
            </div>
            {/* Coupon */}
            <div className="h-px" style={{ background: 'color-mix(in srgb, var(--gold) 30%, transparent)' }} />
            {coupon ? (
              <div className="flex items-center justify-between gap-2 rounded-xl px-3 py-2" style={{ background: 'color-mix(in srgb, var(--gold) 12%, transparent)' }}>
                <span className="inline-flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--maroon-dark)' }}><Tag size={14} /> {coupon.code}</span>
                <button onClick={removeCoupon} className="text-stone-400 hover:text-red-500 cursor-pointer" aria-label="Remove coupon"><X size={16} /></button>
              </div>
            ) : (
              <div>
                <div className="flex gap-2">
                  <input
                    value={couponInput}
                    onChange={(e) => setCouponInput(e.target.value.toUpperCase())}
                    onKeyDown={(e) => e.key === 'Enter' && applyCoupon()}
                    placeholder="Coupon code"
                    className="flex-1 min-w-0 px-3 py-2 rounded-xl border bg-white text-sm outline-none focus:ring-2"
                    style={{ borderColor: 'color-mix(in srgb, var(--gold) 35%, transparent)', '--tw-ring-color': 'color-mix(in srgb, var(--gold) 45%, transparent)' }}
                  />
                  <button onClick={applyCoupon} disabled={applyingCoupon || !couponInput.trim()} className="px-4 rounded-xl text-sm font-semibold shrink-0 disabled:opacity-50 cursor-pointer" style={{ background: 'var(--maroon)', color: 'var(--cream)' }}>
                    {applyingCoupon ? '…' : 'Apply'}
                  </button>
                </div>
                {couponErr && <p className="text-xs text-red-500 mt-1.5">{couponErr}</p>}
              </div>
            )}

            <div className="h-px" style={{ background: 'color-mix(in srgb, var(--gold) 30%, transparent)' }} />
            <div className="flex justify-between text-sm text-stone-500"><span>Subtotal</span><span>{fmt(subtotal)}</span></div>
            {discount > 0 && <div className="flex justify-between text-sm"><span className="text-stone-500">Discount</span><span className="font-semibold text-emerald-600">−{fmt(discount)}</span></div>}
            <div className="flex justify-between text-sm text-stone-500">
              <span>Shipping{form.city ? '' : ' (enter city)'}</span>
              <span className={shipping === 0 ? 'text-emerald-600 font-semibold' : ''}>{shipping === 0 ? 'Free' : fmt(shipping)}</span>
            </div>
            <div className="h-px" style={{ background: 'color-mix(in srgb, var(--gold) 30%, transparent)' }} />
            <div className="flex justify-between font-semibold text-lg" style={{ color: 'var(--maroon)' }}><span>Total</span><span>{fmt(total)}</span></div>
          </aside>
        </div>
      </div>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  )
}

function Field({ label, value, onChange, placeholder, type = 'text', list }) {
  return (
    <label className="block">
      <span className="text-xs font-medium text-stone-500">{label}</span>
      <input
        type={type}
        list={list}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="mt-1 w-full px-4 py-3 rounded-xl border bg-white text-base sm:text-sm outline-none focus:ring-2 transition-shadow"
        style={{ borderColor: 'color-mix(in srgb, var(--gold) 35%, transparent)', '--tw-ring-color': 'color-mix(in srgb, var(--gold) 45%, transparent)' }}
      />
    </label>
  )
}
