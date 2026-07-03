import { Link } from 'react-router-dom'
import { Heart, Trash2, ShoppingBag } from 'lucide-react'
import { useWishlistStore } from '../../store/wishlistStore.js'
import { useCartStore } from '../../store/cartStore.js'
import { Motif } from '../../components/decor/Decor.jsx'

const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n || 0)

export function Wishlist() {
  const { items, toggle } = useWishlistStore()
  const { addItem, openCart } = useCartStore()

  const handleAddToCart = (product) => {
    addItem({ ...product, id: product.id || product._id }, product.sizes?.[0] || 'One Size')
    openCart()
  }

  return (
    <div className="pt-20 min-h-dvh animate-fade-in" style={{ background: 'var(--cream)' }}>
      <div className="container-wide py-10">
        <div className="mb-8">
          <div className="eyebrow"><Motif size={18} />Saved</div>
          <h1 className="font-display text-4xl mt-1" style={{ color: 'var(--ink)' }}>
            My Wishlist <span className="text-stone-400 text-2xl">({items.length})</span>
          </h1>
        </div>

        {items.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-28 text-center">
            <div className="w-24 h-24 rounded-full grid place-items-center mb-6" style={{ background: 'color-mix(in srgb, var(--maroon) 10%, transparent)' }}>
              <Heart size={40} style={{ color: 'var(--maroon)', opacity: 0.4 }} />
            </div>
            <h2 className="font-display text-2xl" style={{ color: 'var(--ink)' }}>Nothing saved yet</h2>
            <p className="text-stone-400 mt-2 text-sm">Heart the jhumkas you love to save them here.</p>
            <Link to="/products" className="btn-maroon mt-6">Explore Jhumkas</Link>
          </div>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-2 lg:grid-cols-4 gap-5">
            {items.map((product) => {
              const pid = product.id || product._id
              const img = product.images?.[0]
              return (
                <div key={pid} className="group relative rounded-2xl overflow-hidden bg-white shadow-card">
                  <div className="aspect-[3/4] overflow-hidden">
                    <Link to={`/products/${pid}`}><img src={img} alt={product.name} className="w-full h-full object-cover" /></Link>
                  </div>
                  <button onClick={() => toggle(product)} className="absolute top-3 right-3 w-8 h-8 grid place-items-center rounded-full bg-white/85 backdrop-blur-sm shadow-sm hover:bg-rose-50 transition cursor-pointer" aria-label="Remove">
                    <Trash2 size={14} className="text-rose-500" />
                  </button>
                  <div className="p-4 space-y-2">
                    {product.hindiName && <p className="font-hindi text-sm" style={{ color: 'var(--maroon)' }}>{product.hindiName}</p>}
                    <Link to={`/products/${pid}`}><h3 className="font-display text-lg leading-snug" style={{ color: 'var(--ink)' }}>{product.name}</h3></Link>
                    <p className="font-semibold" style={{ color: 'var(--maroon)' }}>{fmt(product.price)}</p>
                    <button onClick={() => handleAddToCart(product)} disabled={product.inStock === false} className="btn-maroon w-full !py-2 !text-sm mt-1 disabled:opacity-50">
                      <ShoppingBag size={14} />{product.inStock === false ? 'Sold Out' : 'Add to Bag'}
                    </button>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
