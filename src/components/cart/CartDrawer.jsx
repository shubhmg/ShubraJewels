import { useEffect } from 'react'
import { Link } from 'react-router-dom'
import { X, Minus, Plus, ShoppingBag, Trash2 } from 'lucide-react'
import { useCartStore } from '../../store/cartStore.js'
import { Button } from '../ui/Button.jsx'

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
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 drawer-overlay transition-opacity duration-300 ${isOpen ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
        onClick={closeCart}
        aria-hidden="true"
      />

      {/* Drawer */}
      <div
        className={`fixed right-0 top-0 bottom-0 z-50 w-full max-w-[420px] bg-white dark:bg-stone-950 flex flex-col shadow-2xl transition-transform duration-[380ms] ease-spring ${isOpen ? 'translate-x-0' : 'translate-x-full'}`}
        role="dialog"
        aria-modal="true"
        aria-label="Shopping cart"
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-cream-200 dark:border-stone-800">
          <div className="flex items-center gap-2">
            <ShoppingBag size={18} className="text-gold-500" />
            <h2 className="font-serif text-lg font-semibold text-dark-900 dark:text-cream-50">
              Your Bag
            </h2>
            {count > 0 && (
              <span className="ml-1 text-xs bg-gold-500 text-dark-950 font-bold rounded-full w-5 h-5 flex items-center justify-center">
                {count}
              </span>
            )}
          </div>
          <button
            onClick={closeCart}
            className="w-8 h-8 flex items-center justify-center rounded-full hover:bg-cream-100 dark:hover:bg-stone-800 transition-colors cursor-pointer"
            aria-label="Close cart"
          >
            <X size={18} />
          </button>
        </div>

        {/* Items */}
        <div className="flex-1 overflow-y-auto px-6 py-4 space-y-4">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center h-full gap-4 text-center">
              <div className="w-20 h-20 rounded-full bg-cream-100 dark:bg-stone-800 flex items-center justify-center">
                <ShoppingBag size={32} className="text-stone-300" />
              </div>
              <div>
                <p className="font-serif text-lg text-dark-900 dark:text-cream-100">Your bag is empty</p>
                <p className="text-sm text-stone-400 mt-1">Discover our collections</p>
              </div>
              <Button variant="gold" onClick={closeCart} className="mt-2">
                <Link to="/collections">Shop Now</Link>
              </Button>
            </div>
          ) : (
            items.map(item => (
              <CartItem key={item.key} item={item} onRemove={removeItem} onQtyChange={updateQty} />
            ))
          )}
        </div>

        {/* Footer */}
        {items.length > 0 && (
          <div className="px-6 py-4 border-t border-cream-200 dark:border-stone-800 space-y-4">
            <div className="flex justify-between text-sm text-stone-500">
              <span>Subtotal</span>
              <span className="font-semibold text-dark-900 dark:text-cream-50">{fmt(total)}</span>
            </div>
            <p className="text-xs text-stone-400">Shipping & taxes calculated at checkout.</p>
            <Link to="/checkout" onClick={closeCart}>
              <Button variant="gold" size="lg" className="w-full">
                Proceed to Checkout
              </Button>
            </Link>
            <button onClick={closeCart} className="w-full text-sm text-stone-400 hover:text-dark-900 dark:hover:text-cream-50 transition-colors cursor-pointer">
              Continue Shopping
            </button>
          </div>
        )}
      </div>
    </>
  )
}

function CartItem({ item, onRemove, onQtyChange }) {
  return (
    <div className="flex gap-4 animate-fade-in">
      <Link to={`/products/${item.id}`} className="flex-shrink-0">
        <img src={item.images[0]} alt={item.name} className="w-20 h-24 object-cover rounded-xl bg-cream-100" />
      </Link>
      <div className="flex-1 min-w-0 space-y-1.5">
        <p className="text-xs text-stone-400 tracking-wide">{item.metal}</p>
        <p className="font-serif text-sm font-medium text-dark-900 dark:text-cream-100 leading-snug truncate">{item.name}</p>
        <p className="text-xs text-stone-400">Size: {item.size}</p>
        <div className="flex items-center justify-between pt-1">
          <div className="flex items-center gap-2 border border-cream-200 dark:border-stone-700 rounded-full px-1">
            <button onClick={() => onQtyChange(item.key, item.qty - 1)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-cream-100 dark:hover:bg-stone-800 transition-colors cursor-pointer" aria-label="Decrease quantity">
              <Minus size={12} />
            </button>
            <span className="text-sm font-medium w-4 text-center">{item.qty}</span>
            <button onClick={() => onQtyChange(item.key, item.qty + 1)} className="w-6 h-6 flex items-center justify-center rounded-full hover:bg-cream-100 dark:hover:bg-stone-800 transition-colors cursor-pointer" aria-label="Increase quantity">
              <Plus size={12} />
            </button>
          </div>
          <div className="flex items-center gap-2">
            <span className="text-sm font-semibold">
              {new Intl.NumberFormat('en-IN', { style: 'currency', currency: 'INR', maximumFractionDigits: 0 }).format(item.price * item.qty)}
            </span>
            <button onClick={() => onRemove(item.key)} className="text-stone-300 hover:text-red-500 transition-colors cursor-pointer" aria-label="Remove item">
              <Trash2 size={14} />
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
