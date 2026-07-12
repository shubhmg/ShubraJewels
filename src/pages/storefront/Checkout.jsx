import { useState, useEffect, useMemo, useRef } from 'react'
import { Link } from 'react-router-dom'
import { ChevronRight, Check, ShoppingBag, User, Tag, X, MapPin, Plus, Trash2, AlertCircle, QrCode, Copy, Smartphone, Clock } from 'lucide-react'
import { buildUpiUri, upiQrDataUrl } from '../../lib/upi.js'
import { useCartStore } from '../../store/cartStore.js'
import { useCustomerStore } from '../../store/customerStore.js'
import { WhatsAppButton } from '../../components/ui/WhatsAppButton.jsx'
import { AuthModal } from '../../components/auth/AuthModal.jsx'
import { Mandala, Motif } from '../../components/decor/Decor.jsx'
import { api } from '../../lib/api.js'
import { loadRazorpay } from '../../lib/razorpay.js'
import { useSettings, whatsappLink } from '../../lib/SettingsProvider.jsx'
import { INDIAN_STATES, CITIES_BY_STATE } from '../../data/indianCities.js'
import { Combobox } from '../../components/ui/Combobox.jsx'

const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n || 0)

const EMPTY_ADDR = { line1: '', line2: '', city: '', state: '', pincode: '' }

// Mirrors server computeShipping — tolerant city match + state fallback, so a
// configured "Delhi" still matches a PIN-derived "North West Delhi".
function calcShipping(settings, addr, subtotal) {
  const s = settings.shipping || {}
  if (Number(s.freeAboveSubtotal) > 0 && subtotal >= Number(s.freeAboveSubtotal)) return 0
  const norm = (v) => String(v || '').toLowerCase().trim()
  const city = norm(addr?.city)
  const state = norm(addr?.state)
  const m = (s.cities || []).find((c) => {
    const n = norm(c.name)
    if (!n) return false
    return n === city || n === state || (!!city && (city.includes(n) || n.includes(city)))
  })
  if (m) return Math.max(0, Number(m.charge) || 0)
  return Math.max(0, Number(s.defaultCharge) || 0)
}

function summarizeAddr(a) {
  return [a.line1, a.line2, a.city, a.state, a.pincode].filter(Boolean).join(', ')
}

// Shipping + COD fee for the selected payment method — mirrors server computeCharges.
function calcCharges(settings, addr, subtotal, choice) {
  const base = calcShipping(settings, addr, subtotal)
  const pay = settings.payments || {}
  const prepaid = choice === 'upi' || choice === 'razorpay'
  const shipping = (prepaid && pay.prepaidFreeShipping) ? 0 : base
  const codFee = choice === 'cod' ? Math.max(0, Number(pay.codFee) || 0) : 0
  return { shipping, codFee }
}

// Single-city union territories — every PIN in them should resolve to one
// canonical city, regardless of which sub-district/division India Post returns
// (so Delhi PINs don't flip between "Delhi" and "New Delhi").
const CANONICAL_CITY_BY_STATE = {
  'delhi': 'Delhi',
  'chandigarh': 'Chandigarh',
}

// India Post only returns District/State (e.g. "North West Delhi") — not a city.
// Map that to a real city from our curated list for the resolved state: pick the
// most specific known city that appears (as a whole word) in any of the API
// fields. Falls back to the district only when nothing matches.
function deriveCityFromPin(po, stateKey) {
  const canonical = CANONICAL_CITY_BY_STATE[String(stateKey || '').toLowerCase()]
  if (canonical) return canonical
  const cities = CITIES_BY_STATE[stateKey] || []
  const cand = [po.District, po.Block, po.Division, po.Region, po.Name]
    .map((x) => String(x || '').toLowerCase()).filter(Boolean)
  const sorted = [...cities].sort((a, b) => b.length - a.length)
  for (const k of sorted) {
    const esc = k.toLowerCase().replace(/[.*+?^${}()|[\]\\]/g, '\\$&')
    const re = new RegExp(`\\b${esc}\\b`)
    if (cand.some((c) => re.test(c))) return k
  }
  return po.District || po.Division || ''
}

export function Checkout() {
  const settings = useSettings()
  const { items, clearCart } = useCartStore()
  const { customer, isAuthed, fetchMe, addAddress, deleteAddress } = useCustomerStore()

  const [contact, setContact] = useState({ name: '', phone: '', email: '' })
  const [addr, setAddr] = useState(EMPTY_ADDR)
  const [addrMode, setAddrMode] = useState('new') // 'saved' | 'new'
  const [selectedAddrId, setSelectedAddrId] = useState('')
  const [saveAddr, setSaveAddr] = useState(true)
  const [notes, setNotes] = useState('')

  const [touched, setTouched] = useState({})
  const [submitAttempted, setSubmitAttempted] = useState(false)
  const [pinStatus, setPinStatus] = useState(null) // null | 'loading' | 'ok' | 'notfound'

  const [placing, setPlacing] = useState(false)
  const [error, setError] = useState(null)
  const [placed, setPlaced] = useState(null)
  const [authOpen, setAuthOpen] = useState(false)

  const [couponInput, setCouponInput] = useState('')
  const [coupon, setCoupon] = useState(null)
  const [couponErr, setCouponErr] = useState('')
  const [applyingCoupon, setApplyingCoupon] = useState(false)

  // Direct-UPI flow
  const [upiOrder, setUpiOrder] = useState(null) // created order awaiting payment
  const [upiUri, setUpiUri] = useState('')
  const [upiQr, setUpiQr] = useState('')
  const [upiRef, setUpiRef] = useState('')
  const [upiErr, setUpiErr] = useState('')
  const [submittingProof, setSubmittingProof] = useState(false)
  const [copied, setCopied] = useState(false)

  const signedIn = isAuthed()
  const upiCfg = settings.payments?.upi || {}
  const upiEnabled = !!(upiCfg.enabled && upiCfg.vpa)
  const codEnabled = settings.payments?.cod !== false
  const razorpayEnabled = settings.payments?.razorpay !== false

  // Available payment methods, in display order (prepaid first).
  const methods = useMemo(() => {
    const m = []
    if (upiEnabled) m.push('upi')
    if (razorpayEnabled) m.push('razorpay')
    if (codEnabled) m.push('cod')
    m.push('whatsapp')
    return m
  }, [upiEnabled, razorpayEnabled, codEnabled])

  const [paymentChoice, setPaymentChoice] = useState(null)
  useEffect(() => { if (!paymentChoice && methods.length) setPaymentChoice(methods[0]) }, [methods]) // eslint-disable-line
  const choice = paymentChoice || methods[0]

  // Saved addresses (address book). Fall back to the legacy single address.
  const savedAddresses = useMemo(() => {
    const list = customer?.addresses || []
    if (list.length) return list
    const a = customer?.address
    if (a && (a.line1 || a.city || a.pincode)) return [{ _id: 'legacy', ...a }]
    return []
  }, [customer])

  const subtotal = items.reduce((a, i) => a + i.price * i.qty, 0)

  // Effective address = a chosen saved one, or the typed form.
  const usingSaved = addrMode === 'saved' && savedAddresses.length > 0
  const chosen = usingSaved ? savedAddresses.find((a) => String(a._id) === String(selectedAddrId)) : null
  const effAddr = chosen
    ? { line1: chosen.line1 || '', line2: chosen.line2 || '', city: chosen.city || '', state: chosen.state || '', pincode: chosen.pincode || '' }
    : addr

  const { shipping, codFee } = calcCharges(settings, effAddr, subtotal, choice)
  const discount = coupon?.discount || 0
  const total = Math.max(0, subtotal + shipping + codFee - discount)

  // Optional COD advance (paid via WhatsApp to confirm the order)
  const advCfg = settings.payments?.codAdvance || {}
  const advanceActive = choice === 'cod' && !!advCfg.enabled && Number(advCfg.percent) > 0
  const advancePercent = Number(advCfg.percent) || 0
  const advanceAmount = advanceActive ? Math.max(1, Math.round(total * advancePercent / 100)) : 0

  // ── Validation ──────────────────────────────────────────────────────────────
  const errors = useMemo(() => {
    const e = {}
    if (contact.name.trim().length < 2) e.name = 'Enter your full name'
    if (!/^[6-9]\d{9}$/.test(contact.phone.replace(/\D/g, ''))) e.phone = 'Enter a valid 10-digit mobile number'
    if (contact.email.trim() && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.email.trim())) e.email = 'Enter a valid email address'
    if (!effAddr.line1.trim()) e.line1 = 'Enter your street address'
    if (!effAddr.state.trim()) e.state = 'Select your state'
    if (!effAddr.city.trim()) e.city = 'Enter your city'
    if (!/^\d{6}$/.test(String(effAddr.pincode).trim())) e.pincode = 'Enter a valid 6-digit PIN code'
    return e
  }, [contact, effAddr])

  const isValid = Object.keys(errors).length === 0
  const showErr = (field) => (touched[field] || submitAttempted) && errors[field]
  const markTouched = (field) => setTouched((t) => ({ ...t, [field]: true }))

  // ── Prefill / address-book init ──────────────────────────────────────────────
  useEffect(() => { if (signedIn) fetchMe() }, []) // eslint-disable-line

  const didInit = useRef(false)
  useEffect(() => {
    if (!customer) return
    setContact((c) => ({
      name: c.name || customer.name || '',
      phone: c.phone || customer.phone || '',
      email: c.email || customer.email || '',
    }))
    if (!didInit.current) {
      didInit.current = true
      if (savedAddresses.length > 0) {
        setAddrMode('saved')
        setSelectedAddrId(String(savedAddresses[0]._id))
      }
    }
  }, [customer]) // eslint-disable-line

  // ── Field setters ─────────────────────────────────────────────────────────────
  const setC = (k, v) => setContact((c) => ({ ...c, [k]: v }))
  const setA = (k, v) => setAddr((a) => ({ ...a, [k]: v }))
  const onStateChange = (v) => setAddr((a) => {
    const cities = CITIES_BY_STATE[v] || []
    const keepCity = cities.some((c) => c.toLowerCase() === String(a.city).toLowerCase()) ? a.city : ''
    return { ...a, state: v, city: keepCity }
  })
  const cityOptions = addr.state ? (CITIES_BY_STATE[addr.state] || []) : []

  // PIN-code → City/State autofill (India Post). Fills only empty fields so it
  // never clobbers a manual edit. Debounced; aborts on rapid typing.
  const pinTimer = useRef(null)
  useEffect(() => {
    if (usingSaved) return
    const pin = String(addr.pincode).trim()
    if (!/^\d{6}$/.test(pin)) { setPinStatus(null); return }
    setPinStatus('loading')
    const ctrl = new AbortController()
    clearTimeout(pinTimer.current)
    pinTimer.current = setTimeout(async () => {
      try {
        const res = await fetch(`https://api.postalpincode.in/pincode/${pin}`, { signal: ctrl.signal })
        const data = await res.json()
        const rec = Array.isArray(data) ? data[0] : null
        if (rec?.Status === 'Success' && rec.PostOffice?.length) {
          const po = rec.PostOffice[0]
          const matched = INDIAN_STATES.find((s) => s.toLowerCase() === String(po.State || '').toLowerCase()) || po.State || ''
          const city = deriveCityFromPin(po, matched)
          // Authoritative: a PIN change re-fills state + city.
          setAddr((a) => ({ ...a, state: matched || a.state, city: city || a.city }))
          setPinStatus('ok')
        } else {
          setPinStatus('notfound')
        }
      } catch (e) {
        if (e.name !== 'AbortError') setPinStatus(null)
      }
    }, 450)
    return () => { clearTimeout(pinTimer.current); ctrl.abort() }
  }, [addr.pincode, usingSaved])

  // ── Coupon ─────────────────────────────────────────────────────────────────────
  const applyCoupon = async () => {
    const code = couponInput.trim()
    if (!code) return
    setApplyingCoupon(true); setCouponErr('')
    try {
      const r = await api.post('/coupons/validate', { code, subtotal })
      setCoupon({ code: r.code, discount: r.discount }); setCouponInput('')
    } catch (e) {
      setCoupon(null); setCouponErr(e?.message || 'Invalid coupon')
    } finally { setApplyingCoupon(false) }
  }
  const removeCoupon = () => { setCoupon(null); setCouponErr('') }

  // ── Order payload / actions ─────────────────────────────────────────────────────
  const buildPayload = (channel) => ({
    items: items.map((i) => ({ productId: i.id || i._id, qty: i.qty })),
    customer: { name: contact.name.trim(), phone: contact.phone.replace(/\D/g, ''), email: contact.email.trim() },
    address: { ...effAddr },
    channel,
    couponCode: coupon?.code || '',
    notes: notes.trim(),
  })

  const gate = () => {
    setSubmitAttempted(true)
    if (!isValid) {
      // If a saved address is the culprit, open it in the editable form so the
      // user actually has fields to fix (the form is hidden in 'saved' mode).
      const addrInvalid = errors.line1 || errors.state || errors.city || errors.pincode
      if (usingSaved && addrInvalid) {
        setAddr({ ...effAddr })
        setAddrMode('new')
        setError('Please complete your shipping address before continuing.')
      } else {
        setError('Please complete the highlighted fields before continuing.')
      }
      requestAnimationFrame(() => document.querySelector('[data-error="true"]')?.scrollIntoView({ behavior: 'smooth', block: 'center' }))
      return false
    }
    setError(null)
    return true
  }

  // Persist a newly-typed address to the account (fire-and-forget).
  const persistAddress = async () => {
    if (!signedIn || usingSaved || !saveAddr) return
    try { await addAddress({ ...addr, name: contact.name.trim(), phone: contact.phone.replace(/\D/g, '') }) } catch { /* non-blocking */ }
  }

  // COD order. If a COD advance is configured, the success screen prompts the
  // customer to pay it via WhatsApp to confirm.
  const placeCodOrder = async () => {
    if (!gate()) return null
    setPlacing(true)
    try {
      const order = await api.post('/orders', { ...buildPayload('web'), paymentMethod: 'cod' }, { custAuth: true })
      await persistAddress()
      const adv = advanceActive ? { percent: advancePercent, amount: Math.max(1, Math.round((order.total || 0) * advancePercent / 100)) } : null
      setPlaced({ ...order, _advance: adv })
      clearCart()
      return order
    } catch (e) {
      setError(e.message || 'Could not place order. Please try again.')
      return null
    } finally { setPlacing(false) }
  }

  const payOnline = async () => {
    if (!gate()) return
    setPlacing(true)
    try {
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
        prefill: { name: contact.name, email: contact.email, contact: contact.phone },
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
            await persistAddress()
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

  // Direct UPI: create the (unpaid) order, then show the QR + reference form.
  const payUpi = async () => {
    if (!gate()) return
    setPlacing(true)
    try {
      const order = await api.post('/orders', { ...buildPayload('web'), paymentMethod: 'upi' }, { custAuth: true })
      await persistAddress()
      const uri = buildUpiUri({ vpa: upiCfg.vpa, payeeName: upiCfg.payeeName || settings.brandName, amount: order.total, note: order.orderNo })
      const qr = await upiQrDataUrl(uri)
      setUpiOrder(order); setUpiUri(uri); setUpiQr(qr); setUpiRef(''); setUpiErr('')
      clearCart()
    } catch (e) {
      setError(e.message || 'Could not start UPI payment.')
    } finally { setPlacing(false) }
  }

  const submitUpiProof = async () => {
    setSubmittingProof(true); setUpiErr('')
    try {
      await api.patch(`/orders/${upiOrder._id}/upi-proof`, { upiRef: upiRef.trim() })
      setPlaced({ ...upiOrder, paymentStatus: 'submitted', _upi: true })
      setUpiOrder(null)
    } catch (e) {
      setUpiErr(e.message || 'Could not submit. Please try again.')
    } finally { setSubmittingProof(false) }
  }

  const copyVpa = async () => {
    try { await navigator.clipboard.writeText(upiCfg.vpa); setCopied(true); setTimeout(() => setCopied(false), 1500) } catch { /* ignore */ }
  }

  const orderViaWhatsApp = () => {
    if (items.length === 0) return
    if (!gate()) return
    const lines = items.map((i) => `• ${i.name} × ${i.qty} — ${fmt(i.price * i.qty)}`).join('\n')
    const parts = [settings.whatsappMessage || 'Hello! I would like to order:', '', lines, '', `Subtotal: ${fmt(subtotal)}`]
    if (coupon) parts.push(`Coupon ${coupon.code}: −${fmt(discount)}`)
    parts.push(`Shipping${effAddr.city ? ` (${effAddr.city})` : ''}: ${shipping === 0 ? 'Free' : fmt(shipping)}`)
    parts.push(`Total: ${fmt(total)}`, '', `Name: ${contact.name.trim()}`, `Phone: ${contact.phone.replace(/\D/g, '')}`, `Address: ${summarizeAddr(effAddr)}`)
    persistAddress()
    const link = whatsappLink(settings, parts.join('\n'))
    if (link) window.open(link, '_blank')
  }

  const removeSavedAddress = async (id) => {
    try {
      await deleteAddress(id)
      if (String(selectedAddrId) === String(id)) {
        const remaining = (customer?.addresses || []).filter((a) => String(a._id) !== String(id))
        if (remaining.length) setSelectedAddrId(String(remaining[0]._id))
        else setAddrMode('new')
      }
    } catch { /* ignore */ }
  }

  // Single primary CTA — runs the flow for the selected payment method.
  const primary = () => {
    if (choice === 'upi') return payUpi()
    if (choice === 'razorpay') return payOnline()
    if (choice === 'whatsapp') return orderViaWhatsApp()
    return placeCodOrder()
  }
  const primaryLabel = placing ? 'Processing…'
    : choice === 'upi' ? `Pay via UPI · ${fmt(total)}`
    : choice === 'razorpay' ? `Pay Online · ${fmt(total)}`
    : choice === 'whatsapp' ? 'Order on WhatsApp'
    : `Place Order · ${fmt(total)}`

  /* ── Success ── */
  if (placed) {
    const isUpi = placed._upi
    return (
      <div className="pt-20 min-h-dvh flex items-center justify-center animate-fade-in" style={{ background: 'var(--cream)' }}>
        <div className="text-center max-w-md px-4 py-16">
          <div className="w-20 h-20 rounded-full grid place-items-center mx-auto mb-6" style={{ background: 'color-mix(in srgb, var(--maroon) 12%, transparent)' }}>
            {isUpi ? <Clock size={32} style={{ color: 'var(--maroon)' }} /> : <Check size={34} style={{ color: 'var(--maroon)' }} />}
          </div>
          <div className="eyebrow justify-center flex"><Motif size={18} /><span className="font-hindi">{settings.slogan}</span></div>
          <h1 className="font-display text-3xl mt-2 mb-2" style={{ color: 'var(--ink)' }}>{isUpi ? 'Payment Submitted!' : 'Order Placed!'}</h1>
          <p className="text-stone-500">
            {isUpi
              ? <>We've received your payment reference for order <span className="font-semibold" style={{ color: 'var(--maroon)' }}>{placed.orderNo}</span>. We'll verify it and confirm your order shortly.</>
              : <>Your order <span className="font-semibold" style={{ color: 'var(--maroon)' }}>{placed.orderNo}</span> has been received. We'll reach out on WhatsApp to confirm.</>}
          </p>
          <p className="text-sm mt-2" style={{ color: 'var(--maroon)' }}>Total: {fmt(placed.total)}</p>

          {/* Optional COD advance — confirm the order by paying a small advance on WhatsApp */}
          {placed._advance && (
            <div className="mt-6 rounded-2xl p-4 text-left" style={{ background: 'color-mix(in srgb, var(--gold) 14%, transparent)', border: '1px solid color-mix(in srgb, var(--gold) 40%, transparent)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>One quick step to confirm your COD order</p>
              <p className="text-sm text-stone-600 mt-1">Please pay a <span className="font-semibold">{placed._advance.percent}% advance ({fmt(placed._advance.amount)})</span> on WhatsApp. The rest ({fmt(placed.total - placed._advance.amount)}) is collected on delivery.</p>
              <WhatsAppButton
                className="w-full mt-3"
                label={`Pay ${fmt(placed._advance.amount)} advance on WhatsApp`}
                message={`Hi! I'd like to pay the ${placed._advance.percent}% advance (${fmt(placed._advance.amount)}) to confirm my COD order ${placed.orderNo} (total ${fmt(placed.total)}).`}
              />
            </div>
          )}

          <div className="mt-8 flex flex-wrap gap-3 justify-center">
            <Link to="/products" className="btn-maroon">Continue Shopping</Link>
            {!placed._advance && <WhatsAppButton message={`Hi! About my order ${placed.orderNo}…`} label="Message us" />}
          </div>
        </div>
      </div>
    )
  }

  /* ── UPI payment (order created, awaiting payment + reference) ── */
  if (upiOrder) {
    return (
      <div className="min-h-dvh animate-fade-in" style={{ background: 'var(--cream)' }}>
        <div className="relative overflow-hidden" style={{ background: 'var(--maroon-dark)' }}>
          <Mandala size={300} className="hidden md:block absolute right-0 md:right-8 top-16 md:top-24 opacity-15 pointer-events-none" />
          <div className="container-wide pt-24 md:pt-28 pb-8 md:pb-10 relative">
            <h1 className="font-display text-white text-3xl md:text-4xl">Complete your payment</h1>
            <p className="text-white/70 text-sm mt-1">Order {upiOrder.orderNo}</p>
          </div>
        </div>

        <div className="container-tight py-8">
          <div className="bg-white rounded-2xl p-5 md:p-8 shadow-card max-w-md mx-auto">
            <div className="text-center">
              <p className="text-xs uppercase tracking-wider text-stone-400">Amount to pay</p>
              <p className="font-display text-4xl mt-1" style={{ color: 'var(--maroon)' }}>{fmt(upiOrder.total)}</p>
            </div>

            {/* QR */}
            {upiQr && (
              <div className="mt-6 flex flex-col items-center">
                <div className="p-3 rounded-2xl border" style={{ borderColor: 'color-mix(in srgb, var(--gold) 35%, transparent)' }}>
                  <img src={upiQr} alt="UPI QR code" className="w-52 h-52" />
                </div>
                <p className="text-xs text-stone-500 mt-2 flex items-center gap-1.5"><QrCode size={13} /> Scan with any UPI app (GPay, PhonePe, Paytm…)</p>
              </div>
            )}

            {/* Mobile: open UPI app */}
            <a href={upiUri} className="btn-maroon w-full mt-5 flex items-center justify-center gap-2 md:hidden">
              <Smartphone size={17} /> Pay with UPI app
            </a>

            {/* VPA */}
            <div className="mt-5 rounded-xl border p-3.5 flex items-center justify-between gap-3" style={{ borderColor: 'color-mix(in srgb, var(--gold) 35%, transparent)' }}>
              <div className="min-w-0">
                <p className="text-xs text-stone-400">Or pay to UPI ID</p>
                <p className="font-semibold truncate" style={{ color: 'var(--ink)' }}>{upiCfg.vpa}</p>
              </div>
              <button onClick={copyVpa} className="shrink-0 inline-flex items-center gap-1.5 text-sm font-semibold px-3 py-1.5 rounded-lg cursor-pointer" style={{ background: 'color-mix(in srgb, var(--maroon) 8%, transparent)', color: 'var(--maroon)' }}>
                {copied ? <><Check size={14} /> Copied</> : <><Copy size={14} /> Copy</>}
              </button>
            </div>

            {/* Steps */}
            <ol className="mt-6 space-y-2.5 text-sm text-stone-600">
              {[
                <>Pay <span className="font-semibold" style={{ color: 'var(--ink)' }}>exactly {fmt(upiOrder.total)}</span> using the QR or UPI ID above (order no. <span className="font-semibold" style={{ color: 'var(--ink)' }}>{upiOrder.orderNo}</span> is pre-filled in the note).</>,
                <>Come back here and tap <span className="font-semibold" style={{ color: 'var(--ink)' }}>“I've paid”</span>. That's it — we'll verify and confirm.</>,
              ].map((t, i) => (
                <li key={i} className="flex gap-2.5">
                  <span className="shrink-0 w-5 h-5 rounded-full grid place-items-center text-[11px] font-bold" style={{ background: 'var(--maroon)', color: 'var(--cream)' }}>{i + 1}</span>
                  <span>{t}</span>
                </li>
              ))}
            </ol>

            {/* Optional reference — speeds up verification but not required */}
            <div className="mt-5">
              <span className="text-xs font-medium text-stone-500">UPI Reference / UTR number <span className="text-stone-400 font-normal">(optional — speeds up confirmation)</span></span>
              <input
                {...noAutofill}
                value={upiRef}
                onChange={(e) => setUpiRef(e.target.value.replace(/[^\w]/g, ''))}
                onFocus={(e) => e.currentTarget.removeAttribute('readonly')}
                placeholder="e.g. 431287659021"
                inputMode="numeric"
                className={inputBase}
                style={okBorder}
              />
              <p className="text-[11px] text-stone-400 mt-1">Optional — in your UPI app, open the payment's details / receipt to find it.</p>
              {upiErr && <p className="text-sm text-red-600 mt-1.5 flex items-center gap-1.5"><AlertCircle size={15} />{upiErr}</p>}
            </div>

            <button onClick={submitUpiProof} disabled={submittingProof} className="btn-gold w-full !py-3.5 text-base mt-4 disabled:opacity-60">
              {submittingProof ? 'Submitting…' : "I've paid"}
            </button>
            <p className="text-xs text-stone-400 text-center mt-3">Your order is saved. We'll verify the payment and confirm on WhatsApp.</p>
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

  const showAddrForm = !usingSaved

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
            {/* Sign-in prompt */}
            <div className="bg-white rounded-2xl p-4 shadow-card flex items-center gap-3">
              <div className="w-9 h-9 rounded-full grid place-items-center shrink-0" style={{ background: 'color-mix(in srgb, var(--maroon) 12%, transparent)', color: 'var(--maroon)' }}><User size={17} /></div>
              {signedIn ? (
                <p className="text-sm text-stone-600">Signed in as <span className="font-semibold" style={{ color: 'var(--ink)' }}>{customer?.email}</span> — this order & address will be saved to your account.</p>
              ) : (
                <p className="text-sm text-stone-600 flex-1">
                  <button onClick={() => setAuthOpen(true)} className="font-semibold underline underline-offset-2" style={{ color: 'var(--maroon)' }}>Sign in</button> to save your address & track orders — or continue as guest.
                </p>
              )}
            </div>

            {/* Contact */}
            <div className="bg-white rounded-2xl p-4 md:p-6 shadow-card space-y-4">
              <h2 className="font-display text-xl" style={{ color: 'var(--ink)' }}>Contact Details</h2>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <Field label="Full Name" required value={contact.name} onChange={(v) => setC('name', v)} onBlur={() => markTouched('name')} placeholder="Priya Sharma" error={showErr('name')} />
                <Field label="Mobile Number" required type="tel" inputMode="numeric" maxLength={10} value={contact.phone} onChange={(v) => setC('phone', v.replace(/\D/g, ''))} onBlur={() => markTouched('phone')} placeholder="10-digit mobile" error={showErr('phone')} prefix="+91" />
              </div>
              <Field label="Email (optional)" type="email" value={contact.email} onChange={(v) => setC('email', v)} onBlur={() => markTouched('email')} placeholder="you@example.com" error={showErr('email')} />
            </div>

            {/* Address */}
            <div className="bg-white rounded-2xl p-4 md:p-6 shadow-card space-y-4">
              <div className="flex items-center justify-between">
                <h2 className="font-display text-xl" style={{ color: 'var(--ink)' }}>Shipping Address</h2>
                {usingSaved && (
                  <button onClick={() => { setAddrMode('new'); setAddr(EMPTY_ADDR) }} className="text-sm font-semibold inline-flex items-center gap-1 cursor-pointer" style={{ color: 'var(--maroon)' }}>
                    <Plus size={15} /> New address
                  </button>
                )}
              </div>

              {/* Address book */}
              {signedIn && savedAddresses.length > 0 && (
                <div className="grid gap-2.5">
                  {savedAddresses.map((a) => {
                    const active = addrMode === 'saved' && String(selectedAddrId) === String(a._id)
                    return (
                      <button
                        key={a._id}
                        onClick={() => { setAddrMode('saved'); setSelectedAddrId(String(a._id)) }}
                        className="text-left rounded-xl border p-3.5 flex items-start gap-3 transition cursor-pointer"
                        style={{ borderColor: active ? 'var(--maroon)' : 'color-mix(in srgb, var(--gold) 35%, transparent)', background: active ? 'color-mix(in srgb, var(--maroon) 6%, transparent)' : 'white' }}
                      >
                        <span className="mt-0.5 w-4 h-4 rounded-full border-2 grid place-items-center shrink-0" style={{ borderColor: active ? 'var(--maroon)' : 'var(--stone-300, #d6d3d1)' }}>
                          {active && <span className="w-2 h-2 rounded-full" style={{ background: 'var(--maroon)' }} />}
                        </span>
                        <span className="flex-1 min-w-0">
                          <span className="flex items-center gap-1.5 text-sm font-semibold" style={{ color: 'var(--ink)' }}><MapPin size={14} style={{ color: 'var(--maroon)' }} />{a.city || 'Address'}{a.pincode ? ` · ${a.pincode}` : ''}</span>
                          <span className="block text-xs text-stone-500 mt-0.5">{summarizeAddr(a)}</span>
                        </span>
                        {a._id !== 'legacy' && (
                          <span role="button" tabIndex={0} onClick={(e) => { e.stopPropagation(); removeSavedAddress(a._id) }} className="text-stone-300 hover:text-red-500 cursor-pointer shrink-0" aria-label="Delete address"><Trash2 size={15} /></span>
                        )}
                      </button>
                    )
                  })}
                </div>
              )}

              {/* New-address form */}
              {showAddrForm && (
                <div className="space-y-4">
                  <Field label="Street Address" required value={addr.line1} onChange={(v) => setA('line1', v)} onBlur={() => markTouched('line1')} placeholder="House no., building, street" error={showErr('line1')} />
                  <Field label="Landmark / Area (optional)" value={addr.line2} onChange={(v) => setA('line2', v)} placeholder="Landmark, locality" />
                  <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                    <div>
                      <Field label="PIN Code" required type="tel" inputMode="numeric" maxLength={6} value={addr.pincode} onChange={(v) => setA('pincode', v.replace(/\D/g, ''))} onBlur={() => markTouched('pincode')} placeholder="6-digit PIN" error={showErr('pincode')} />
                      {pinStatus === 'loading' && <span className="text-xs text-stone-400 mt-1 block">Looking up PIN…</span>}
                      {pinStatus === 'ok' && !showErr('pincode') && <span className="text-xs text-emerald-600 mt-1 flex items-center gap-1"><Check size={12} /> Auto-filled below</span>}
                      {pinStatus === 'notfound' && !showErr('pincode') && <span className="text-xs text-amber-600 mt-1 block">PIN not found — pick state & city.</span>}
                    </div>
                    <ComboField label="State" required error={showErr('state')}>
                      <Combobox value={addr.state} onChange={onStateChange} onBlur={() => markTouched('state')} options={INDIAN_STATES} placeholder="Search state…" error={!!showErr('state')} inputStyle={showErr('state') ? errBorder : okBorder} />
                    </ComboField>
                    <ComboField label="City" required error={showErr('city')}>
                      <Combobox value={addr.city} onChange={(v) => setA('city', v)} onBlur={() => markTouched('city')} options={cityOptions} allowCustom disabled={!addr.state} placeholder={addr.state ? 'Search city…' : 'Select state first'} error={!!showErr('city')} inputStyle={showErr('city') ? errBorder : okBorder} />
                    </ComboField>
                  </div>

                  {signedIn && (
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input type="checkbox" checked={saveAddr} onChange={(e) => setSaveAddr(e.target.checked)} className="w-4 h-4 rounded accent-[var(--maroon)]" />
                      <span className="text-sm text-stone-600">Save this address to my account</span>
                    </label>
                  )}
                </div>
              )}
            </div>

            {/* Notes */}
            <div className="bg-white rounded-2xl p-4 md:p-6 shadow-card">
              <Field label="Order notes (optional)" value={notes} onChange={setNotes} placeholder="Anything we should know?" />
            </div>

            {/* Payment — single clear selector */}
            <div className="bg-white rounded-2xl p-4 md:p-6 shadow-card space-y-3">
              <h2 className="font-display text-xl" style={{ color: 'var(--ink)' }}>Payment</h2>
              <div className="space-y-2.5">
                {methods.map((m) => {
                  const active = choice === m
                  const meta = {
                    upi: { icon: QrCode, title: 'Pay now · UPI', sub: 'Scan a QR & pay instantly — fastest', right: (settings.payments?.prepaidFreeShipping ? 'Free shipping' : null), rec: true },
                    razorpay: { icon: QrCode, title: 'Pay online', sub: 'UPI, cards, netbanking, wallets', right: (settings.payments?.prepaidFreeShipping ? 'Free shipping' : null), rec: !upiEnabled },
                    cod: { icon: Smartphone, title: 'Cash on Delivery', sub: advCfg.enabled && Number(advCfg.percent) > 0 ? `Pay ${advCfg.percent}% advance on WhatsApp to confirm` : 'Pay when it arrives', right: (Number(settings.payments?.codFee) > 0 ? `+${fmt(Number(settings.payments.codFee))}` : null) },
                    whatsapp: { icon: Smartphone, title: 'Order on WhatsApp', sub: 'Chat with us to confirm & pay', right: null },
                  }[m]
                  const Icon = meta.icon
                  return (
                    <button
                      key={m}
                      onClick={() => setPaymentChoice(m)}
                      className="w-full text-left rounded-xl border p-3.5 flex items-center gap-3 transition cursor-pointer"
                      style={{ borderColor: active ? 'var(--maroon)' : 'color-mix(in srgb, var(--gold) 35%, transparent)', background: active ? 'color-mix(in srgb, var(--maroon) 6%, transparent)' : 'white' }}
                    >
                      <span className="w-4 h-4 rounded-full border-2 grid place-items-center shrink-0" style={{ borderColor: active ? 'var(--maroon)' : '#d6d3d1' }}>
                        {active && <span className="w-2 h-2 rounded-full" style={{ background: 'var(--maroon)' }} />}
                      </span>
                      <Icon size={18} style={{ color: active ? 'var(--maroon)' : '#a8a29e' }} className="shrink-0" />
                      <span className="flex-1 min-w-0">
                        <span className="flex items-center gap-2 flex-wrap">
                          <span className="text-sm font-semibold" style={{ color: 'var(--ink)' }}>{meta.title}</span>
                          {meta.rec && <span className="text-[10px] font-bold uppercase tracking-wide px-1.5 py-0.5 rounded" style={{ background: 'var(--maroon)', color: 'var(--cream)' }}>Recommended</span>}
                        </span>
                        <span className="block text-xs text-stone-500 mt-0.5">{meta.sub}</span>
                      </span>
                      {meta.right && <span className="text-xs font-bold shrink-0" style={{ color: meta.right === 'Free shipping' ? 'var(--maroon)' : 'var(--ink)' }}>{meta.right}</span>}
                    </button>
                  )
                })}
              </div>

              {error && (
                <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2.5 flex items-center gap-2"><AlertCircle size={16} className="shrink-0" />{error}</p>
              )}

              <button onClick={primary} disabled={placing} className="btn-gold w-full !py-3.5 text-base disabled:opacity-60 flex items-center justify-center gap-2">
                {choice === 'upi' && <QrCode size={18} />}{primaryLabel}
              </button>
              <p className="text-xs text-stone-400 text-center">100% secure · your details are encrypted.</p>
            </div>
          </div>

          {/* Summary */}
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
              <span>Shipping{effAddr.city ? '' : ' (enter address)'}</span>
              <span className={shipping === 0 ? 'text-emerald-600 font-semibold' : ''}>{shipping === 0 ? 'Free' : fmt(shipping)}</span>
            </div>
            {codFee > 0 && (
              <div className="flex justify-between text-sm text-stone-500"><span>COD fee</span><span>{fmt(codFee)}</span></div>
            )}
            <div className="h-px" style={{ background: 'color-mix(in srgb, var(--gold) 30%, transparent)' }} />
            <div className="flex justify-between font-semibold text-lg" style={{ color: 'var(--maroon)' }}><span>Total</span><span>{fmt(total)}</span></div>
            {advanceActive && (
              <p className="text-xs mt-1 rounded-lg px-3 py-2" style={{ background: 'color-mix(in srgb, var(--gold) 12%, transparent)', color: 'var(--maroon-dark)' }}>
                Pay {advancePercent}% advance ({fmt(advanceAmount)}) on WhatsApp to confirm · {fmt(total - advanceAmount)} on delivery.
              </p>
            )}
          </aside>
        </div>
      </div>
      <AuthModal open={authOpen} onClose={() => setAuthOpen(false)} />
    </div>
  )
}

const inputBase = 'mt-1 w-full px-4 py-3 rounded-xl border bg-white text-base sm:text-sm outline-none focus:ring-2 transition-shadow disabled:bg-stone-50 disabled:text-stone-400'

// Hard-block browser autofill: the field is `readonly` in the DOM during the
// browser's autofill pass (page load), so Chrome/Safari never offer it; focus
// strips readonly imperatively so typing works. `autocomplete=off` alone is
// ignored by Chrome for address-labelled fields.
export const noAutofill = {
  ref: (el) => { if (el && !el.dataset.roInit) { el.setAttribute('readonly', 'readonly'); el.dataset.roInit = '1' } },
  autoComplete: 'off',
  autoCorrect: 'off',
  spellCheck: false,
  'data-lpignore': 'true',
  'data-1p-ignore': 'true',
}
const okBorder = { borderColor: 'color-mix(in srgb, var(--gold) 35%, transparent)', '--tw-ring-color': 'color-mix(in srgb, var(--gold) 45%, transparent)' }
const errBorder = { borderColor: '#dc2626', '--tw-ring-color': 'rgba(220,38,38,0.25)' }

function Field({ label, value, onChange, onBlur, placeholder, type = 'text', list, error, required, disabled, inputMode, maxLength, prefix, autoComplete = 'off' }) {
  return (
    <label className="block" data-error={!!error}>
      <span className="text-xs font-medium text-stone-500">{label}{required && <span className="text-red-500"> *</span>}</span>
      <div className="relative">
        {prefix && <span className="absolute left-3 top-1/2 -translate-y-1/2 mt-[2px] text-sm text-stone-400 pointer-events-none">{prefix}</span>}
        <input
          {...noAutofill}
          type={type}
          list={list}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          onFocus={(e) => e.currentTarget.removeAttribute('readonly')}
          onBlur={(e) => { e.currentTarget.setAttribute('readonly', 'readonly'); onBlur?.() }}
          placeholder={placeholder}
          disabled={disabled}
          inputMode={inputMode}
          maxLength={maxLength}
          autoComplete={autoComplete}
          className={inputBase}
          style={{ ...(error ? errBorder : okBorder), ...(prefix ? { paddingLeft: '3rem' } : null) }}
        />
      </div>
      {error && <span className="text-xs text-red-600 mt-1 block">{error}</span>}
    </label>
  )
}

// Label wrapper around a Combobox so it matches the other fields.
function ComboField({ label, required, error, children }) {
  return (
    <div data-error={!!error}>
      <span className="text-xs font-medium text-stone-500">{label}{required && <span className="text-red-500"> *</span>}</span>
      <div className="mt-1">{children}</div>
      {error && <span className="text-xs text-red-600 mt-1 block">{error}</span>}
    </div>
  )
}
