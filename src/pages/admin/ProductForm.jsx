import { useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { ArrowLeft, Upload, Plus, X } from 'lucide-react'
import { PRODUCTS } from '../../data/mockData.js'
import { Input, Select } from '../../components/ui/Input.jsx'
import { Button } from '../../components/ui/Button.jsx'

export function ProductForm() {
  const { id } = useParams()
  const navigate = useNavigate()
  const existing = id ? PRODUCTS.find(p => p.id === +id) : null
  const [saving, setSaving] = useState(false)

  const [form, setForm] = useState({
    name:          existing?.name        || '',
    category:      existing?.category   || 'Rings',
    metal:         existing?.metal      || '18K Yellow Gold',
    stone:         existing?.stone      || 'Diamond',
    price:         existing?.price      || '',
    originalPrice: existing?.originalPrice || '',
    stockQty:      existing?.stockQty   || '',
    sku:           existing?.sku        || '',
    weight:        existing?.weight     || '',
    description:   existing?.description || '',
    careInstructions: existing?.careInstructions || '',
  })

  const set = (key) => (e) => setForm(f => ({ ...f, [key]: e.target.value }))

  const handleSave = (e) => {
    e.preventDefault()
    setSaving(true)
    setTimeout(() => { setSaving(false); navigate('/admin/products') }, 1000)
  }

  return (
    <div className="space-y-5 animate-fade-in max-w-3xl">
      <div className="flex items-center gap-3">
        <button onClick={() => navigate('/admin/products')} className="p-2 rounded-xl hover:bg-cream-100 dark:hover:bg-stone-800 transition-colors cursor-pointer" aria-label="Go back">
          <ArrowLeft size={18} />
        </button>
        <div>
          <h1 className="font-semibold text-2xl text-dark-900 dark:text-cream-50">
            {existing ? 'Edit Product' : 'Add New Product'}
          </h1>
          <p className="text-sm text-stone-400 mt-0.5">{existing ? existing.name : 'Create a new listing'}</p>
        </div>
      </div>

      <form onSubmit={handleSave} className="space-y-5">
        {/* Basic Info */}
        <Section title="Basic Information">
          <div className="grid grid-cols-2 gap-4">
            <div className="col-span-2">
              <Input label="Product Name" value={form.name} onChange={set('name')} placeholder="Aurelia Solitaire Ring" required />
            </div>
            <Select label="Category" value={form.category} onChange={set('category')}>
              {['Rings','Earrings','Necklaces','Bracelets','Brooches'].map(c => <option key={c}>{c}</option>)}
            </Select>
            <Select label="Metal" value={form.metal} onChange={set('metal')}>
              {['18K White Gold','18K Yellow Gold','18K Rose Gold','22K Yellow Gold'].map(m => <option key={m}>{m}</option>)}
            </Select>
            <Select label="Primary Stone" value={form.stone} onChange={set('stone')}>
              {['Diamond','Emerald','Sapphire','Ruby','Pearl','Garnet','None'].map(s => <option key={s}>{s}</option>)}
            </Select>
            <Input label="SKU" value={form.sku} onChange={set('sku')} placeholder="SJ-RG-009" />
          </div>
        </Section>

        {/* Pricing */}
        <Section title="Pricing & Inventory">
          <div className="grid grid-cols-3 gap-4">
            <Input label="Selling Price (₹)" type="number" value={form.price} onChange={set('price')} placeholder="145000" required />
            <Input label="Original Price (₹)" type="number" value={form.originalPrice} onChange={set('originalPrice')} placeholder="165000" />
            <Input label="Stock Quantity" type="number" value={form.stockQty} onChange={set('stockQty')} placeholder="10" required />
          </div>
          <Input label="Weight" value={form.weight} onChange={set('weight')} placeholder="4.2g" />
        </Section>

        {/* Images */}
        <Section title="Product Images">
          <div className="grid grid-cols-3 gap-3">
            {(existing?.images || []).map((img, i) => (
              <div key={i} className="relative aspect-square rounded-xl overflow-hidden bg-cream-100 dark:bg-stone-800 group">
                <img src={img} alt="" className="w-full h-full object-cover" />
                <button type="button" className="absolute top-2 right-2 w-6 h-6 bg-dark-950/70 rounded-full flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity cursor-pointer">
                  <X size={12} className="text-white" />
                </button>
              </div>
            ))}
            <label className="aspect-square rounded-xl border-2 border-dashed border-cream-200 dark:border-stone-700 flex flex-col items-center justify-center gap-2 cursor-pointer hover:border-gold-400 hover:bg-gold-500/5 transition-all">
              <Upload size={20} className="text-stone-400" />
              <span className="text-xs text-stone-400">Upload Image</span>
              <input type="file" accept="image/*" className="sr-only" />
            </label>
          </div>
          <p className="text-xs text-stone-400">Recommended: 800×1000px, JPEG or WebP. First image is the cover.</p>
        </Section>

        {/* Description */}
        <Section title="Description & Care">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Product Description</label>
              <textarea
                rows={4}
                value={form.description}
                onChange={set('description')}
                placeholder="A timeless solitaire diamond set in lustrous 18K white gold…"
                className="w-full px-4 py-2.5 rounded-xl border border-[color-mix(in_srgb,var(--gold)_18%,transparent)] bg-white dark:bg-stone-900 dark:text-cream-50 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 resize-none transition-all"
              />
            </div>
            <div className="space-y-1.5">
              <label className="block text-sm font-medium text-stone-700 dark:text-stone-300">Care Instructions</label>
              <textarea
                rows={2}
                value={form.careInstructions}
                onChange={set('careInstructions')}
                placeholder="Clean with mild soap and warm water…"
                className="w-full px-4 py-2.5 rounded-xl border border-[color-mix(in_srgb,var(--gold)_18%,transparent)] bg-white dark:bg-stone-900 dark:text-cream-50 text-sm placeholder-stone-400 focus:outline-none focus:ring-2 focus:ring-gold-500/50 focus:border-gold-500 resize-none transition-all"
              />
            </div>
          </div>
        </Section>

        <div className="flex gap-3 pt-2">
          <Button type="button" variant="ghost" onClick={() => navigate('/admin/products')}>Cancel</Button>
          <Button type="submit" variant="gold" size="lg" loading={saving}>
            {existing ? 'Save Changes' : 'Publish Product'}
          </Button>
        </div>
      </form>
    </div>
  )
}

function Section({ title, children }) {
  return (
    <div className="admin-card p-5 space-y-4">
      <h2 className="font-medium text-dark-900 dark:text-cream-50 text-sm border-b border-cream-200 dark:border-stone-800 pb-3">{title}</h2>
      {children}
    </div>
  )
}
