import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X, Minus, Plus, ShoppingBag, Trash2, ArrowRight } from 'lucide-react'
import { useCartStore } from '../../store/cartStore.js'

const fmt = (n) => new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(n)

export function CartDrawer() {
  const { items, isOpen, closeCart, removeItem, updateQty, total, count } = useCartStore(s => ({
    items: s.items, isOpen: s.isOpen, closeCart: s.closeCart,
    removeItem: s.removeItem, updateQty: s.updateQty,
    total: s.items.reduce((a, i) => a + i.price * i.qty, 0),
    count: s.items.reduce((a, i) => a + i.qty, 0),
  }))

  useEffect(() => {
    document.body.style.overflow = isOpen ? 'hidden' : ''
    return () => { document.body.style.overflow = '' }
  }, [isOpen])

  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center transition-all duration-500 ${isOpen ? 'opacity-100 pointer-events-auto' : 'opacity-0 pointer-events-none'}`}
      style={{ perspective: '1200px' }}
    >
      {/* Cinematic dark backdrop */}
      <div
        className="absolute inset-0"
        style={{ background: 'rgba(10, 7, 5, 0.88)', backdropFilter: 'blur(12px)' }}
        onClick={closeCart}
        aria-hidden="true"
      />

      {/* Centered cart panel */}
      <div
        className={`relative z-10 w-full mx-4 sm:mx-0 flex flex-col transition-all duration-500 ease-[cubic-bezier(0.16,1,0.3,1)] ${isOpen ? 'opacity-100 scale-100 translate-y-0' : 'opacity-0 scale-95 translate-y-6'}`}
        style={{
          maxWidth: '680px',
          maxHeight: '90vh',
          background: 'var(--cream)',
          borderRadius: '28px',
          boxShadow: '0 40px 120px rgba(0,0,0,0.6), 0 0 0 1px rgba(201,168,76,0.15)',
          overflow: 'hidden',
        }}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
      >
        {/* Gold top accent line */}
        <div style={{ height: '3px', background: 'linear-gradient(90deg, var(--maroon), var(--gold), var(--maroon))' }} />

        {/* Header */}
        <div className="flex items-center justify-between px-8 py-5" style={{ borderBottom: '1px solid rgba(0,0,0,0.07)' }}>
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-full flex items-center justify-center" style={{ background: 'var(--maroon)' }}>
              <ShoppingBag size={16} color="var(--cream)" />
            </div>
            <div>
              <h2 className="font-display text-xl font-bold leading-none" style={{ color: 'var(--ink)' }}>Your Bag</h2>
              {count > 0 && <p className="text-xs mt-0.5" style={{ color: 'var(--maroon)' }}>{count} {count === 1 ? 'item' : 'items'}</p>}
            </div>
          </div>
          <button
            onClick={closeCart}
            className="w-10 h-10 flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer"
            style={{ background: 'rgba(0,0,0,0.06)' }}
            onMouseEnter={e => e.currentTarget.style.background = 'rgba(0,0,0,0.12)'}
            onMouseLeave={e => e.currentTarget.style.background = 'rgba(0,0,0,0.06)'}
            aria-label="Close cart"
          >
            <X size={18} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-8 py-6 space-y-5" style={{ minHeight: 0 }}>
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center py-16 gap-5 text-center">
              <div
                className="w-24 h-24 rounded-full flex items-center justify-center"
                style={{ background: 'rgba(123,30,43,0.08)' }}
              >
                <ShoppingBag size={36} style={{ color: 'var(--maroon)', opacity: 0.5 }} />
              </div>
              <div>
                <p className="font-display text-xl font-bold" style={{ color: 'var(--ink)' }}>Your bag is empty</p>
                <p className="text-sm mt-1 text-stone-400">Discover our royal collections</p>
              </div>
              <Link
                to="/collections"
                onClick={closeCart}
                className="inline-flex items-center gap-2 px-6 py-3 rounded-full font-semibold text-sm transition-all duration-200 cursor-pointer"
                style={{ background: 'var(--maroon)', color: 'var(--cream)' }}
              >
                Explore Collections <ArrowRight size={14} />
              </Link>
            </div>
          ) : (
            items.map(item => (
              <CartItem key={item.key} item={item} onRemove={removeItem} onQtyChange={updateQty} />
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-8 pt-5 pb-7" style={{ borderTop: '1px solid rgba(0,0,0,0.07)', background: 'rgba(255,255,255,0.6)' }}>
            {/* Subtotal row */}
            <div className="flex items-center justify-between mb-1">
              <span className="text-sm font-medium text-stone-500">Subtotal</span>
              <span className="text-2xl font-bold" style={{ color: 'var(--ink)' }}>{fmt(total)}</span>
            </div>
            <p className="text-xs text-stone-400 mb-5">Shipping &amp; taxes calculated at checkout.</p>

            {/* CTA */}
            <Link to="/checkout" onClick={closeCart} className="block w-full">
              <button
                className="w-full flex items-center justify-center gap-2 py-4 rounded-2xl font-bold text-base tracking-wide transition-all duration-200 cursor-pointer"
                style={{ background: 'linear-gradient(135deg, var(--gold) 0%, var(--gold-light) 50%, var(--gold) 100%)', color: 'var(--ink)' }}
                onMouseEnter={e => { e.currentTarget.style.transform = 'translateY(-1px)'; e.currentTarget.style.boxShadow = '0 12px 32px -8px rgba(201,168,76,0.6)' }}
                onMouseLeave={e => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '' }}
              >
                Proceed to Checkout <ArrowRight size={16} />
              </button>
            </Link>

            <button
              onClick={closeCart}
              className="block w-full text-center text-sm mt-3 py-1 transition-colors duration-200 cursor-pointer"
              style={{ color: 'var(--maroon)', opacity: 0.7 }}
              onMouseEnter={e => e.currentTarget.style.opacity = '1'}
              onMouseLeave={e => e.currentTarget.style.opacity = '0.7'}
            >
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function CartItem({ item, onRemove, onQtyChange }) {
  return (
    <div
      className="flex gap-5 p-4 rounded-2xl animate-fade-in"
      style={{ background: 'rgba(255,255,255,0.7)', border: '1px solid rgba(0,0,0,0.06)' }}
    >
      {/* Large product image */}
      <Link to={`/products/${item.id}`} className="flex-shrink-0">
        <img
          src={item.images?.[0]}
          alt={item.name}
          className="object-cover rounded-xl"
          style={{ width: '90px', height: '110px' }}
        />
      </Link>

      <div className="flex-1 min-w-0 flex flex-col justify-between py-0.5">
        <div>
          <p className="text-xs text-stone-400 tracking-wide uppercase mb-0.5">{item.metal}</p>
          <Link to={`/products/${item.id}`}>
            <p className="font-display font-bold text-base leading-snug" style={{ color: 'var(--ink)' }}>{item.name}</p>
          </Link>
          {item.size && <p className="text-xs text-stone-400 mt-0.5">Size: {item.size}</p>}
        </div>

        <div className="flex items-center justify-between mt-3">
          {/* Qty stepper */}
          <div
            className="flex items-center gap-3 px-3 py-1.5 rounded-full"
            style={{ background: 'rgba(0,0,0,0.05)' }}
          >
            <button
              onClick={() => onQtyChange(item.key, item.qty - 1)}
              className="w-5 h-5 flex items-center justify-center rounded-full transition-colors cursor-pointer"
              style={{ color: 'var(--maroon)' }}
              aria-label="Decrease quantity"
            >
              <Minus size={11} />
            </button>
            <span className="text-sm font-bold w-4 text-center" style={{ color: 'var(--ink)' }}>{item.qty}</span>
            <button
              onClick={() => onQtyChange(item.key, item.qty + 1)}
              className="w-5 h-5 flex items-center justify-center rounded-full transition-colors cursor-pointer"
              style={{ color: 'var(--maroon)' }}
              aria-label="Increase quantity"
            >
              <Plus size={11} />
            </button>
          </div>

          <div className="flex items-center gap-3">
            <span className="font-bold text-base" style={{ color: 'var(--ink)' }}>
              {fmt(item.price * item.qty)}
            </span>
            <button
              onClick={() => onRemove(item.key)}
              className="w-7 h-7 flex items-center justify-center rounded-full transition-all duration-200 cursor-pointer"
              style={{ background: 'rgba(239,68,68,0.08)', color: 'rgba(239,68,68,0.5)' }}
              onMouseEnter={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.15)'; e.currentTarget.style.color = 'rgb(239,68,68)' }}
              onMouseLeave={e => { e.currentTarget.style.background = 'rgba(239,68,68,0.08)'; e.currentTarget.style.color = 'rgba(239,68,68,0.5)' }}
              aria-label="Remove item"
            >
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
