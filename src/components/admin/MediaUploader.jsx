import { useState, useRef } from 'react'
import { UploadCloud, X, Loader2, Download, Crop, SlidersHorizontal, Maximize2 } from 'lucide-react'
import { api } from '../../lib/api.js'
import { ImageEditor } from './ImageEditor.jsx'

// Force-download an image (same-origin /uploads → clean blob download).
async function downloadImage(url) {
  try {
    const res = await fetch(url)
    const blob = await res.blob()
    const obj = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = obj
    a.download = url.split('/').pop() || 'image.jpg'
    document.body.appendChild(a); a.click(); a.remove()
    URL.revokeObjectURL(obj)
  } catch {
    window.open(url, '_blank')
  }
}

// Fullscreen viewer for an already-uploaded image: preview + download / crop /
// edit. Crop and Edit open the ImageEditor seeded with the existing image.
function ImageViewer({ url, onClose, onCrop, onEdit }) {
  return (
    <div className="fixed inset-0 z-[105] flex flex-col bg-black/90" onClick={onClose}>
      <div className="flex items-center justify-end gap-2 p-3 shrink-0" onClick={(e) => e.stopPropagation()}>
        <button type="button" onClick={() => downloadImage(url)} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold cursor-pointer transition"><Download size={15} /> Download</button>
        <button type="button" onClick={onCrop} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold cursor-pointer transition"><Crop size={15} /> Crop</button>
        <button type="button" onClick={onEdit} className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl bg-white/10 hover:bg-white/20 text-white text-sm font-semibold cursor-pointer transition"><SlidersHorizontal size={15} /> Edit</button>
        <button type="button" onClick={onClose} className="w-9 h-9 grid place-items-center rounded-xl bg-white/10 hover:bg-white/20 text-white cursor-pointer transition" aria-label="Close"><X size={18} /></button>
      </div>
      <div className="flex-1 min-h-0 grid place-items-center p-4 pt-0" onClick={onClose}>
        <img src={url} alt="" className="max-w-full max-h-full object-contain rounded-lg" onClick={(e) => e.stopPropagation()} />
      </div>
    </div>
  )
}

// Drag-drop / click uploader. Uploads to /api/upload and returns the URL via onChange.
export function MediaUploader({ value, onChange, accept = 'image', label }) {
  const [busy, setBusy] = useState(false)
  const [drag, setDrag] = useState(false)
  const [error, setError] = useState(null)
  const inputRef = useRef(null)

  const mime = accept === 'video' ? 'video/*' : accept === 'both' ? 'image/*,video/*' : 'image/*'
  const isVideo = (url) => /\.(mp4|webm|mov)$/i.test(url || '')

  const handleFile = async (file) => {
    if (!file) return
    setBusy(true); setError(null)
    try {
      const res = await api.upload(file)
      onChange(res.url)
    } catch (e) {
      setError(e.message || 'Upload failed')
    } finally {
      setBusy(false)
    }
  }

  return (
    <div>
      {label && <p className="text-xs font-medium text-stone-500 mb-1.5">{label}</p>}
      {value ? (
        <div className="relative w-full rounded-xl overflow-hidden border border-stone-200 dark:border-stone-700 bg-stone-50 dark:bg-stone-800">
          {isVideo(value)
            ? <video src={value} className="w-full h-40 object-cover" muted />
            : <img src={value} alt="" className="w-full h-40 object-cover" />}
          <button
            type="button"
            onClick={() => onChange('')}
            className="absolute top-2 right-2 w-7 h-7 grid place-items-center rounded-full bg-black/60 text-white cursor-pointer hover:bg-black/75 transition"
            aria-label="Remove"
          >
            <X size={14} />
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => { e.preventDefault(); setDrag(true) }}
          onDragLeave={() => setDrag(false)}
          onDrop={(e) => { e.preventDefault(); setDrag(false); handleFile(e.dataTransfer.files?.[0]) }}
          className={`w-full h-40 rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-2 transition cursor-pointer ${
            drag ? 'border-gold-500 bg-gold-500/5' : 'border-stone-300 dark:border-stone-600 hover:border-gold-400'
          }`}
        >
          {busy ? <Loader2 size={22} className="animate-spin text-gold-500" /> : <UploadCloud size={22} className="text-stone-400" />}
          <span className="text-xs text-stone-400">{busy ? 'Uploading…' : 'Drag & drop or click to upload'}</span>
        </button>
      )}
      <input ref={inputRef} type="file" accept={mime} className="hidden" onChange={(e) => handleFile(e.target.files?.[0])} />
      {error && <p className="text-xs text-red-500 mt-1">{error}</p>}
    </div>
  )
}

// Multi-image uploader for product galleries. New images are framed to a fixed
// aspect ratio (default square) before upload so tiles stay uniform in listings.
// Click a set image to view it fullscreen and download / re-crop / edit it.
export function MultiImageUploader({ value = [], onChange, aspect = 1 }) {
  const [busy, setBusy] = useState(false)
  const [queue, setQueue] = useState([]) // File[] awaiting crop on upload
  const [viewer, setViewer] = useState(null) // index of the image being viewed
  const [editing, setEditing] = useState(null) // { index, mode } for an existing image
  const inputRef = useRef(null)

  const handleFiles = (files) => {
    const imgs = Array.from(files || []).filter((f) => f.type.startsWith('image/'))
    if (imgs.length) setQueue((q) => [...q, ...imgs])
  }
  const dequeue = () => setQueue((q) => q.slice(1))

  // New upload: crop → upload → append.
  const onUploadSave = async (file) => {
    setBusy(true)
    try {
      const res = await api.upload(file)
      onChange([...(value || []), res.url])
      dequeue()
    } finally { setBusy(false) }
  }

  // Existing image: crop/edit → upload → replace in place.
  const onEditSave = async (file) => {
    const i = editing.index
    setBusy(true)
    try {
      const res = await api.upload(file)
      onChange(value.map((u, idx) => (idx === i ? res.url : u)))
      setEditing(null)
    } finally { setBusy(false) }
  }

  const removeAt = (i) => onChange(value.filter((_, idx) => idx !== i))

  return (
    <div>
      {/* New-upload cropper (queue) */}
      {queue.length > 0 && (
        <ImageEditor
          key={`up-${queue[0].name}-${queue[0].size}-${queue[0].lastModified}`}
          image={queue[0]} aspect={aspect} mode="crop" busy={busy} index={0} total={queue.length}
          saveLabel={queue.length > 1 ? 'Use & next' : 'Use photo'}
          onSave={onUploadSave}
          onSkip={busy ? undefined : dequeue}
          onClose={busy ? undefined : () => setQueue([])}
        />
      )}

      {/* Fullscreen viewer for an existing image */}
      {viewer != null && value[viewer] && (
        <ImageViewer
          url={value[viewer]}
          onClose={() => setViewer(null)}
          onCrop={() => { setEditing({ index: viewer, mode: 'crop' }); setViewer(null) }}
          onEdit={() => { setEditing({ index: viewer, mode: 'edit' }); setViewer(null) }}
        />
      )}

      {/* Editor for an existing image (re-crop or finetune) */}
      {editing != null && value[editing.index] && (
        <ImageEditor
          key={`edit-${editing.index}-${editing.mode}`}
          image={value[editing.index]} aspect={aspect} mode={editing.mode} busy={busy}
          saveLabel="Save changes"
          onSave={onEditSave}
          onClose={busy ? undefined : () => setEditing(null)}
        />
      )}

      <p className="text-xs font-medium text-stone-500 mb-1.5">Images</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {value.map((url, i) => (
          <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-stone-200 dark:border-stone-700 group">
            <button type="button" onClick={() => setViewer(i)} className="block w-full h-full cursor-zoom-in" aria-label="View image">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <span className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition grid place-items-center">
                <Maximize2 size={18} className="text-white opacity-0 group-hover:opacity-100 transition" />
              </span>
            </button>
            <button type="button" onClick={() => removeAt(i)} className="absolute top-1 right-1 w-6 h-6 grid place-items-center rounded-full bg-black/60 text-white opacity-0 group-hover:opacity-100 transition cursor-pointer" aria-label="Remove">
              <X size={12} />
            </button>
          </div>
        ))}
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          className="aspect-square rounded-lg border-2 border-dashed border-stone-300 dark:border-stone-600 hover:border-gold-400 grid place-items-center transition cursor-pointer"
        >
          {busy ? <Loader2 size={18} className="animate-spin text-gold-500" /> : <UploadCloud size={18} className="text-stone-400" />}
        </button>
      </div>
      <input ref={inputRef} type="file" accept="image/*" multiple className="hidden" onChange={(e) => { handleFiles(e.target.files); e.target.value = '' }} />
    </div>
  )
}
