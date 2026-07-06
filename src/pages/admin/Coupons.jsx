import { useEffect, useState } from 'react'
import { Loader2, Plus, Trash2, Ticket, Pencil } from 'lucide-react'
import { api } from '../../lib/api.js'
import { AdminHeader, Btn, Modal, Field } from '../../components/admin/AdminUI.jsx'

const fmt = (n) => '₹' + new Intl.NumberFormat('en-IN').format(n || 0)
const blank = { code: '', type: 'percent', value: '', minSubtotal: 0, maxDiscount: 0, usageLimit: 0, expiresAt: '', isActive: true }

const summary = (c) => (c.type === 'percent' ? `${c.value}% off${c.maxDiscount ? ` (max ${fmt(c.maxDiscount)})` : ''}` : `${fmt(c.value)} off`)
const dateStr = (d) => (d ? new Date(d).toISOString().slice(0, 10) : '')

export function AdminCoupons() {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const load = async () => { setLoading(true); setItems(await api.get('/coupons', { auth: true })); setLoading(false) }
  useEffect(() => { load() }, [])

  const set = (k, v) => setEditing((e) => ({ ...e, [k]: v }))
  const save = async () => {
    setSaving(true); setError(null)
    try {
      const payload = { ...editing }
      ;['_id', 'createdAt', 'updatedAt', '__v', 'usedCount'].forEach((k) => delete payload[k])
      payload.code = String(payload.code || '').toUpperCase().trim()
      payload.value = Number(payload.value) || 0
      payload.minSubtotal = Number(payload.minSubtotal) || 0
      payload.maxDiscount = Number(payload.maxDiscount) || 0
      payload.usageLimit = Number(payload.usageLimit) || 0
      if (!payload.expiresAt) payload.expiresAt = null
      if (editing._id) await api.patch(`/coupons/${editing._id}`, payload, { auth: true })
      else await api.post('/coupons', payload, { auth: true })
      setEditing(null); load()
    } catch (e) { setError(e.details?.join(', ') || e.message) } finally { setSaving(false) }
  }
  const remove = async (id) => { if (!confirm('Delete this coupon?')) return; await api.del(`/coupons/${id}`, { auth: true }); load() }

  const expired = (c) => c.expiresAt && new Date(c.expiresAt) < new Date()

  return (
    <div>
      <AdminHeader title="Coupons" subtitle={`${items.length} coupon${items.length === 1 ? '' : 's'}`}>
        <Btn onClick={() => setEditing({ ...blank })}><Plus size={16} /> New Coupon</Btn>
      </AdminHeader>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin" style={{ color: 'var(--gold)' }} /></div>
      ) : items.length === 0 ? (
        <div className="admin-card p-12 text-center">
          <Ticket size={28} className="mx-auto text-zinc-300 mb-3" />
          <p className="text-zinc-500">No coupons yet. Create one to run a promo.</p>
        </div>
      ) : (
        <div className="space-y-2.5">
          {items.map((c) => (
            <div key={c._id} className="admin-row flex items-center gap-3 p-4">
              <div className="w-10 h-10 rounded-xl grid place-items-center shrink-0" style={{ background: 'color-mix(in srgb, var(--gold) 16%, transparent)', color: 'var(--maroon)' }}><Ticket size={18} /></div>
              <div className="min-w-0 flex-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-bold tracking-wide text-zinc-900">{c.code}</span>
                  {!c.isActive && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-zinc-100 text-zinc-500">Off</span>}
                  {expired(c) && <span className="text-[10px] px-2 py-0.5 rounded-full font-bold uppercase bg-red-50 text-red-500">Expired</span>}
                </div>
                <p className="text-sm text-zinc-600">{summary(c)}{c.minSubtotal ? ` · min ${fmt(c.minSubtotal)}` : ''}</p>
              </div>
              <div className="text-right shrink-0 hidden sm:block">
                <p className="text-xs text-zinc-400">Used</p>
                <p className="text-sm font-semibold text-zinc-800">{c.usedCount}{c.usageLimit ? ` / ${c.usageLimit}` : ''}</p>
              </div>
              <button onClick={() => setEditing(c)} className="w-9 h-9 grid place-items-center rounded-lg text-zinc-400 hover:text-zinc-700 hover:bg-zinc-100 cursor-pointer"><Pencil size={15} /></button>
              <button onClick={() => remove(c._id)} className="w-9 h-9 grid place-items-center rounded-lg text-zinc-400 hover:text-red-500 hover:bg-zinc-100 cursor-pointer"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?._id ? 'Edit coupon' : 'New coupon'}
        footer={<>
          <Btn variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
          <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save coupon'}</Btn>
        </>}
      >
        {editing && (
          <div className="grid sm:grid-cols-2 gap-4">
            <Field field={{ label: 'Code', required: true, help: 'e.g. SHUBRA10' }} value={editing.code} onChange={(v) => set('code', v.toUpperCase())} />
            <Field field={{ label: 'Type', type: 'select', options: [{ value: 'percent', label: 'Percentage %' }, { value: 'flat', label: 'Flat amount ₹' }] }} value={editing.type} onChange={(v) => set('type', v)} />
            <Field field={{ label: editing.type === 'percent' ? 'Discount (%)' : 'Discount (₹)', type: 'number', required: true }} value={editing.value} onChange={(v) => set('value', v)} />
            {editing.type === 'percent' && (
              <Field field={{ label: 'Max discount (₹)', type: 'number', help: '0 = no cap' }} value={editing.maxDiscount} onChange={(v) => set('maxDiscount', v)} />
            )}
            <Field field={{ label: 'Min order value (₹)', type: 'number' }} value={editing.minSubtotal} onChange={(v) => set('minSubtotal', v)} />
            <Field field={{ label: 'Usage limit', type: 'number', help: '0 = unlimited' }} value={editing.usageLimit} onChange={(v) => set('usageLimit', v)} />
            <label className="block">
              <span className="text-[13px] font-medium text-zinc-700">Expires on <span className="text-zinc-400 font-normal">(optional)</span></span>
              <input type="date" value={dateStr(editing.expiresAt)} onChange={(e) => set('expiresAt', e.target.value)} className="mt-1.5 w-full px-3 py-2 rounded-lg border border-zinc-300 bg-white text-sm outline-none focus:border-[var(--gold)] focus:ring-2 focus:ring-[color-mix(in_srgb,var(--gold)_28%,transparent)]" />
            </label>
            <div className="sm:col-span-2">
              <Field field={{ label: 'Active', type: 'toggle' }} value={editing.isActive} onChange={(v) => set('isActive', v)} />
            </div>
            {editing._id && <p className="sm:col-span-2 text-xs text-zinc-400">Used {editing.usedCount} time{editing.usedCount === 1 ? '' : 's'} so far.</p>}
          </div>
        )}
        {error && <p className="text-sm text-red-500 mt-3">{error}</p>}
      </Modal>
    </div>
  )
}
