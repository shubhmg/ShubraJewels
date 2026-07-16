import { useState, useRef, useEffect } from 'react'
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
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [onClose])

  return (
    <div className="fixed inset-0 z-[105] bg-black/95" onClick={onClose}>
      {/* Image — contained within the viewport, inset so it never touches the edges */}
      <img
        src={url} alt="" draggable={false}
        onClick={(e) => e.stopPropagation()}
        className="absolute inset-0 w-full h-full object-contain select-none"
        style={{ padding: 'max(56px, env(safe-area-inset-top)) 16px calc(96px + env(safe-area-inset-bottom))' }}
      />

      {/* Top scrim + close */}
      <div className="absolute top-0 inset-x-0 flex justify-end p-3 bg-gradient-to-b from-black/70 to-transparent pointer-events-none" style={{ paddingTop: 'max(12px, env(safe-area-inset-top))' }}>
        <button type="button" onClick={onClose} className="pointer-events-auto w-10 h-10 grid place-items-center rounded-full bg-white/15 hover:bg-white/25 text-white cursor-pointer transition" aria-label="Close"><X size={20} /></button>
      </div>

      {/* Bottom scrim + actions */}
      <div className="absolute bottom-0 inset-x-0 p-3 bg-gradient-to-t from-black/80 via-black/50 to-transparent" onClick={(e) => e.stopPropagation()} style={{ paddingBottom: 'max(14px, env(safe-area-inset-bottom))' }}>
        <div className="flex items-stretch gap-2 w-full max-w-sm mx-auto">
          <button type="button" onClick={() => downloadImage(url)} className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl bg-white/15 active:bg-white/30 hover:bg-white/25 text-white text-[12px] font-semibold cursor-pointer transition"><Download size={19} /> Download</button>
          <button type="button" onClick={onCrop} className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl bg-white/15 active:bg-white/30 hover:bg-white/25 text-white text-[12px] font-semibold cursor-pointer transition"><Crop size={19} /> Crop</button>
          <button type="button" onClick={onEdit} className="flex-1 flex flex-col items-center justify-center gap-1 py-2.5 rounded-2xl bg-white/15 active:bg-white/30 hover:bg-white/25 text-white text-[12px] font-semibold cursor-pointer transition"><SlidersHorizontal size={19} /> Edit</button>
        </div>
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
// aspect ratio (default 4:5 portrait — the e-commerce standard, matches the
// product detail gallery) before upload so tiles stay uniform in listings.
// Click a set image to view it fullscreen and download / re-crop / edit it.
export function MultiImageUploader({ value = [], onChange, aspect = 4 / 5 }) {
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
          <div key={i} className="relative aspect-[4/5] rounded-lg overflow-hidden border border-stone-200 dark:border-stone-700 group">
            <button type="button" onClick={() => setViewer(i)} className="block w-full h-full cursor-zoom-in" aria-label="View image">
              <img src={url} alt="" className="w-full h-full object-cover" />
              <span className="absolute inset-0 bg-black/0 group-hover:bg-black/25 transition grid place-items-center">
                <Maximize2 size={18} className="text-white opacity-0 group-hover:opacity-100 transition" />
              </span>
            </button>
            <button type="button" onClick={() => removeAt(i)} className="absolute top-1.5 right-1.5 w-7 h-7 grid place-items-center rounded-full bg-black/65 text-white opacity-100 sm:opacity-0 sm:group-hover:opacity-100 transition cursor-pointer active:bg-black/80" aria-label="Remove">
              <X size={14} />
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
