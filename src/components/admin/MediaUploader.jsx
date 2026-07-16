import { useState, useRef } from 'react'
import { UploadCloud, X, Loader2 } from 'lucide-react'
import { api } from '../../lib/api.js'
import { ImageCropper } from './ImageCropper.jsx'

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

// Multi-image uploader for product galleries. Every selected image is framed
// to a fixed aspect ratio (default square) in a cropper before upload, so the
// stored images tile cleanly in listings. Files are queued and processed one
// at a time through the same modal.
export function MultiImageUploader({ value = [], onChange, aspect = 1 }) {
  const [busy, setBusy] = useState(false)
  const [queue, setQueue] = useState([]) // File[] awaiting crop
  const inputRef = useRef(null)

  const handleFiles = (files) => {
    const imgs = Array.from(files || []).filter((f) => f.type.startsWith('image/'))
    if (imgs.length) setQueue((q) => [...q, ...imgs])
  }

  const dequeue = () => setQueue((q) => q.slice(1))

  const onCropped = async (file) => {
    setBusy(true)
    try {
      const res = await api.upload(file)
      onChange([...(value || []), res.url])
      dequeue()
    } finally {
      setBusy(false)
    }
  }

  const removeAt = (i) => onChange(value.filter((_, idx) => idx !== i))

  return (
    <div>
      {queue.length > 0 && (
        <ImageCropper
          key={`${queue[0].name}-${queue[0].size}-${queue[0].lastModified}`}
          file={queue[0]}
          aspect={aspect}
          busy={busy}
          index={0}
          total={queue.length}
          onCropped={onCropped}
          onSkip={busy ? undefined : dequeue}
          onClose={busy ? undefined : () => setQueue([])}
        />
      )}
      <p className="text-xs font-medium text-stone-500 mb-1.5">Images</p>
      <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
        {value.map((url, i) => (
          <div key={i} className="relative aspect-square rounded-lg overflow-hidden border border-stone-200 dark:border-stone-700 group">
            <img src={url} alt="" className="w-full h-full object-cover" />
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
