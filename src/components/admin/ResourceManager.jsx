import { useEffect, useState } from 'react'
import { Plus, Pencil, Trash2, Loader2 } from 'lucide-react'
import { api } from '../../lib/api.js'
import { AdminHeader, Btn, Modal, Field } from './AdminUI.jsx'

/**
 * Generic CRUD manager for a simple content resource.
 *
 * @param {string} title
 * @param {string} endpoint         e.g. '/categories'
 * @param {Array}  fields           field configs for the add/edit form (see AdminUI.Field)
 * @param {Array}  columns          keys to show in the list (first image-like key becomes a thumb)
 * @param {string} [subtitle]
 */
export function ResourceManager({ title, subtitle, endpoint, fields, columns, wideModal }) {
  const [items, setItems] = useState([])
  const [loading, setLoading] = useState(true)
  const [editing, setEditing] = useState(null) // object being edited, or {} for new
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState(null)

  const load = async () => {
    setLoading(true)
    try {
      const data = await api.get(`${endpoint}?all=1`, { auth: true })
      setItems(data)
    } finally {
      setLoading(false)
    }
  }
  useEffect(() => { load() }, [endpoint]) // eslint-disable-line

  const blank = () => {
    const o = {}
    fields.forEach((f) => { if (f.default !== undefined) o[f.key] = f.default })
    return o
  }

  const save = async () => {
    setSaving(true); setError(null)
    try {
      const payload = { ...editing }
      delete payload._id; delete payload.createdAt; delete payload.updatedAt; delete payload.__v
      if (editing._id) await api.patch(`${endpoint}/${editing._id}`, payload, { auth: true })
      else await api.post(endpoint, payload, { auth: true })
      setEditing(null)
      load()
    } catch (e) {
      setError(e.details?.join(', ') || e.message)
    } finally {
      setSaving(false)
    }
  }

  const remove = async (id) => {
    if (!confirm('Delete this item? This cannot be undone.')) return
    await api.del(`${endpoint}/${id}`, { auth: true })
    load()
  }

  const imgKey = columns.find((c) => ['image', 'poster', 'images'].includes(c)) || (fields.find((f) => f.type === 'image')?.key)
  const textCols = columns.filter((c) => c !== imgKey)

  const thumb = (it) => {
    const val = it[imgKey]
    return Array.isArray(val) ? val[0] : val
  }

  return (
    <div>
      <AdminHeader title={title} subtitle={subtitle}>
        <Btn onClick={() => setEditing(blank())}><Plus size={16} /> Add</Btn>
      </AdminHeader>

      {loading ? (
        <div className="flex justify-center py-20"><Loader2 className="animate-spin text-gold-500" /></div>
      ) : items.length === 0 ? (
        <div className="text-center py-20 text-stone-400">
          <p>No items yet.</p>
          <Btn variant="outline" className="mt-4" onClick={() => setEditing(blank())}><Plus size={16} /> Add the first one</Btn>
        </div>
      ) : (
        <div className="grid gap-2">
          {items.map((it) => (
            <div key={it._id} className="flex items-center gap-4 bg-white dark:bg-stone-900 rounded-xl border border-cream-200 dark:border-stone-800 px-4 py-3">
              {imgKey && (
                <div className="w-12 h-12 rounded-lg overflow-hidden bg-stone-100 dark:bg-stone-800 flex-shrink-0">
                  {thumb(it) && <img src={thumb(it)} alt="" className="w-full h-full object-cover" />}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="font-medium text-dark-900 dark:text-cream-50 truncate">{it[textCols[0]] || '—'}</p>
                {textCols[1] && <p className="text-xs text-stone-400 truncate">{formatCell(it[textCols[1]])}</p>}
              </div>
              {'isActive' in it && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${it.isActive ? 'bg-emerald-50 text-emerald-600' : 'bg-stone-100 text-stone-400'}`}>
                  {it.isActive ? 'Active' : 'Hidden'}
                </span>
              )}
              {'isApproved' in it && (
                <span className={`text-xs px-2 py-0.5 rounded-full ${it.isApproved ? 'bg-emerald-50 text-emerald-600' : 'bg-amber-50 text-amber-600'}`}>
                  {it.isApproved ? 'Approved' : 'Pending'}
                </span>
              )}
              <button onClick={() => setEditing(it)} className="w-8 h-8 grid place-items-center rounded-lg text-stone-400 hover:text-gold-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"><Pencil size={15} /></button>
              <button onClick={() => remove(it._id)} className="w-8 h-8 grid place-items-center rounded-lg text-stone-400 hover:text-red-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer"><Trash2 size={15} /></button>
            </div>
          ))}
        </div>
      )}

      <Modal
        open={!!editing}
        onClose={() => setEditing(null)}
        title={editing?._id ? `Edit ${title.replace(/s$/, '')}` : `New ${title.replace(/s$/, '')}`}
        wide={wideModal}
        footer={
          <>
            <Btn variant="ghost" onClick={() => setEditing(null)}>Cancel</Btn>
            <Btn onClick={save} disabled={saving}>{saving ? 'Saving…' : 'Save'}</Btn>
          </>
        }
      >
        {editing && (
          <div className={wideModal ? 'grid sm:grid-cols-2 gap-4' : 'space-y-4'}>
            {fields.map((f) => (
              <div key={f.key} className={f.full ? 'sm:col-span-2' : ''}>
                <Field field={f} value={editing[f.key]} onChange={(val) => setEditing((e) => ({ ...e, [f.key]: val }))} />
              </div>
            ))}
          </div>
        )}
        {error && <p className="text-sm text-red-500">{error}</p>}
      </Modal>
    </div>
  )
}

function formatCell(v) {
  if (Array.isArray(v)) return v.join(', ')
  return v
}
