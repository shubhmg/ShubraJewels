import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Loader2, Search } from 'lucide-react'
import { api } from '../../lib/api.js'
import { AdminHeader, Btn, Modal, Field } from '../../components/admin/AdminUI.jsx'
import { MultiImageUploader, MediaUploader } from '../../components/admin/MediaUploader.jsx'

const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n || 0)
const blank = { name: '', hindiName: '', sku: '', price: '', mrp: '', story: '', description: '', categoryId: '', collectionIds: [], images: [], video: '', material: '', weight: '', tags: [], stockQty: 0, isNewArrival: false, isBestseller: false, isActive: true, ratingAvg: 0, ratingCount: 0 }

export function AdminProducts() {
  const [products, setProducts] = useState([])
  const [categories, setCategories] = useState([])
  const [collections, setCollections] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)
  const [q, setQ] = useState('')

  const load = async () => {
    setLoading(true)
    const [p, c, col] = await Promise.all([
      api.get('/products?all=1', { auth: true }),
      api.get('/categories?all=1', { auth: true }),
      api.get('/collections?all=1', { auth: true }),
    ])
    setProducts(p); setCategories(c); setCollections(col); setLoading(false)
  }
  useEffect(() => { load() }, [])

  const set = (k, v) => setEditing((e) => ({ ...e, [k]: v }))

  const save = async () => {
    setSaving(true); setError(null)
    try {
      const payload = { ...editing }
      ;['_id', 'createdAt', 'updatedAt', '__v', 'slug', 'inStock', 'isOnSale', 'id', 'originalPrice', 'reviewCount', 'isRealRating'].forEach((k) => delete payload[k])
      payload.price = Number(payload.price) || 0
      payload.mrp = Number(payload.mrp) || 0
      payload.stockQty = Number(payload.stockQty) || 0
      payload.ratingAvg = Number(payload.ratingAvg) || 0
      payload.ratingCount = Number(payload.ratingCount) || 0
      if (!payload.categoryId) delete payload.categoryId
      if (editing._id) await api.patch(`/products/${editing._id}`, payload, { auth: true })
      else await api.post('/products', payload, { auth: true })
      setEditing(null); load()
    } catch (e) {
      setError(e.details?.join(', ') || e.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    if (!confirm('Delete this product?')) return
    await api.del(`/products/${id}`, { auth: true }); load()
  }

  const filtered = products.filter((p) => p.name.toLowerCase().includes(q.toLowerCase()))
  const catName = (id) => categories.find((c) => c._id === id)?.name || '—'

  return (
    <div>
      <AdminHeader title="Products" subtitle={`${products.length} jhumkas`}>
        <Btn onClick={() => setEditing({ ...blank })}><Plus size={16} /> Add Product</Btn>
      </AdminHeader>

      <div className="relative mb-4 max-w-xs">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-stone-400" />
        <input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search products…" className="w-full pl-9 pr-3 py-2 rounded-xl border border-stone-300 dark:border-stone-600 bg-white dark:bg-stone-800 text-sm focus:outline-none" />
      </div>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gold-500" /></div>
      ) : (
        <div className="space-y-2">
          {filtered.map((p) => (
            <div key={p._id} className="flex items-center gap-4 admin-row px-4 py-3">
              <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-800 flex-shrink-0">
                {p.images?.[0] && <img src={p.images[0]} alt="" className="w-full h-full object-cover" />}
              </div>
              <div className="flex-1 min-w-0">
                <p className="font-medium text-dark-900 dark:text-cream-50 truncate">{p.name} {p.hindiName && <span className="font-hindi text-stone-400 text-sm">· {p.hindiName}</span>}</p>
                <p className="text-xs text-stone-400">{catName(p.categoryId)} · {fmt(p.price)}{p.mrp > p.price ? ` · was ${fmt(p.mrp)}` : ''}</p>
              </div>
              {p.isBestseller && <span className="text-xs px-2 py-0.5 rounded-full bg-gold-500/15 text-gold-600 hidden md:inline">Bestseller</span>}
              <span className={`text-xs px-2 py-0.5 rounded-full hidden sm:inline ${p.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-400'}`}>{p.isActive ? 'Live' : 'Hidden'}</span>
              <button onClick={() => setEditing({ ...blank, ...p })} className="w-8 h-8 grid place-items-center rounded-lg text-stone-400 hover:text-gold-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"><Pencil size={15} /></button>
              <button onClick={() => remove(p._id)} className="w-8 h-8 grid place-items-center rounded-lg text-stone-400 hover:text-red-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?._id ? 'Edit Product' : 'New Product'}
        wide
        footer={<>
          <Btn variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
          <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save Product'}</Btn>
        </>}
      >
        {editing && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field field={{ label: 'Name', required: true }} value={editing.name} onChange={(v) => set('name', v)} />
            <Field field={{ label: 'Hindi name' }} value={editing.hindiName} onChange={(v) => set('hindiName', v)} />
            <Field field={{ label: 'Price (₹)', type: 'number', required: true }} value={editing.price} onChange={(v) => set('price', v)} />
            <Field field={{ label: 'MRP / original (₹)', type: 'number', help: 'Higher than price shows a discount' }} value={editing.mrp} onChange={(v) => set('mrp', v)} />
            <Field field={{ label: 'Category', type: 'select', options: [{ value: '', label: '— none —' }, ...categories.map((c) => ({ value: c._id, label: c.name }))] }} value={editing.categoryId || ''} onChange={(v) => set('categoryId', v)} />
            <Field field={{ label: 'SKU' }} value={editing.sku} onChange={(v) => set('sku', v)} />
            <div className="sm:col-span-2">
              <Field field={{ label: 'Royal collections', type: 'multiselect', options: collections.map((c) => ({ value: c._id, label: c.name })) }} value={editing.collectionIds || []} onChange={(v) => set('collectionIds', v)} />
            </div>
            <div className="sm:col-span-2">
              <Field field={{ label: 'Story (हर झुमका एक कहानी)', type: 'textarea', rows: 4 }} value={editing.story} onChange={(v) => set('story', v)} />
            </div>
            <div className="sm:col-span-2">
              <MultiImageUploader value={editing.images} onChange={(v) => set('images', v)} />
            </div>
            <div className="sm:col-span-2">
              <MediaUploader label="Product video (optional)" value={editing.video} onChange={(v) => set('video', v)} accept="video" />
            </div>
            <Field field={{ label: 'Material' }} value={editing.material} onChange={(v) => set('material', v)} />
            <Field field={{ label: 'Weight' }} value={editing.weight} onChange={(v) => set('weight', v)} />
            <Field field={{ label: 'Stock qty', type: 'number' }} value={editing.stockQty} onChange={(v) => set('stockQty', v)} />
            <Field field={{ label: 'Tags', type: 'tags' }} value={editing.tags} onChange={(v) => set('tags', v)} />
            <Field field={{ label: 'New arrival', type: 'toggle' }} value={editing.isNewArrival} onChange={(v) => set('isNewArrival', v)} />
            <Field field={{ label: 'Bestseller', type: 'toggle' }} value={editing.isBestseller} onChange={(v) => set('isBestseller', v)} />
            <Field field={{ label: 'Active (visible on site)', type: 'toggle' }} value={editing.isActive} onChange={(v) => set('isActive', v)} />

            {/* Starter rating — the hardcoded fallback shown until real reviews take over */}
            <div className="sm:col-span-2 rounded-xl p-3.5" style={{ background: 'color-mix(in srgb, var(--gold) 10%, transparent)' }}>
              <p className="text-sm font-semibold" style={{ color: 'var(--maroon)' }}>Starter rating</p>
              <p className="text-xs text-stone-500 mt-0.5 leading-relaxed">
                Shown only until this product earns <b>30 genuine verified-purchase reviews</b>. After that, real customer
                ratings take over automatically and these values are ignored.
                {editing._id && ` Currently ${editing.reviewCount || 0} / 30 genuine reviews${(editing.reviewCount || 0) >= 30 ? ' — real ratings are now live.' : '.'}`}
              </p>
              <div className="grid grid-cols-2 gap-3 mt-3">
                <Field field={{ label: 'Rating (0–5)', type: 'number' }} value={editing.ratingAvg} onChange={(v) => set('ratingAvg', v)} />
                <Field field={{ label: 'Rating count', type: 'number' }} value={editing.ratingCount} onChange={(v) => set('ratingCount', v)} />
              </div>
            </div>
          </div>
        )}
        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
      </Modal>
    </div>
  )
}
