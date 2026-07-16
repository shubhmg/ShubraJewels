import { useEffect, useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { X, ZoomIn, ZoomOut, Check, Loader2, RotateCcw, RotateCw, Sun, Contrast, Droplet, Undo2 } from 'lucide-react'

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v))
const DEFAULT_ADJ = { brightness: 1, contrast: 1, saturate: 1 }
const filterCss = (a) => `brightness(${a.brightness}) contrast(${a.contrast}) saturate(${a.saturate})`
const isDefaultAdj = (a) => a.brightness === 1 && a.contrast === 1 && a.saturate === 1

function loadImage(src) {
  return new Promise((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = src
  })
}

// Rotation-aware crop + baked adjustments → JPEG File. Long edge capped at
// 1600px; the server re-encodes to webp (≤1800px) afterwards.
// `crop` is react-easy-crop's croppedAreaPixels (in the rotated bounding-box space).
async function exportEdited(imageSrc, crop, { rotation = 0, adj = DEFAULT_ADJ }, aspect, name) {
  const image = await loadImage(imageSrc)
  const rad = (rotation * Math.PI) / 180
  const bw = Math.abs(Math.cos(rad) * image.width) + Math.abs(Math.sin(rad) * image.height)
  const bh = Math.abs(Math.sin(rad) * image.width) + Math.abs(Math.cos(rad) * image.height)

  // Pass 1: draw the (rotated, adjusted) image onto a bounding-box canvas.
  const stage = document.createElement('canvas')
  stage.width = Math.round(bw)
  stage.height = Math.round(bh)
  const sctx = stage.getContext('2d')
  sctx.filter = filterCss(adj)
  sctx.translate(bw / 2, bh / 2)
  sctx.rotate(rad)
  sctx.translate(-image.width / 2, -image.height / 2)
  sctx.drawImage(image, 0, 0)

  // Pass 2: extract the crop rectangle, scaled to the output size.
  const outW = Math.round(Math.min(crop.width, 1600))
  const outH = Math.round(outW / aspect)
  const out = document.createElement('canvas')
  out.width = outW
  out.height = outH
  const octx = out.getContext('2d')
  octx.imageSmoothingQuality = 'high'
  octx.fillStyle = '#ffffff'
  octx.fillRect(0, 0, outW, outH)
  octx.drawImage(stage, crop.x, crop.y, crop.width, crop.height, 0, 0, outW, outH)

  const blob = await new Promise((res) => out.toBlob(res, 'image/jpeg', 0.92))
  const stem = (name || 'image').replace(/\.[^.]+$/, '')
  return new File([blob], `${stem}.jpg`, { type: 'image/jpeg' })
}

// Fixed-ratio image editor built on react-easy-crop: drag + scroll/pinch zoom,
// rotate, and (in `mode="edit"`) brightness / contrast / saturation finetune
// with a live preview. Exports an edited JPEG File via onSave(file).
//
//   <ImageEditor image={File|urlString} aspect={1} mode="crop|edit"
//                onSave={fn} onSkip={fn} onClose={fn} busy={bool} />
export function ImageEditor({ image, aspect = 1, mode = 'crop', onSave, onSkip, onClose, busy = false, index = 0, total = 1, saveLabel }) {
  const advanced = mode === 'edit'
  const [url, setUrl] = useState('')
  const [name, setName] = useState('image')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [rotation, setRotation] = useState(0)
  const [adj, setAdj] = useState(DEFAULT_ADJ)
  const [pixels, setPixels] = useState(null)

  useEffect(() => {
    setCrop({ x: 0, y: 0 }); setZoom(1); setRotation(0); setAdj(DEFAULT_ADJ); setPixels(null)
    let obj
    if (image instanceof File) { obj = URL.createObjectURL(image); setUrl(obj); setName(image.name || 'image') }
    else if (typeof image === 'string') { setUrl(image); setName(image.split('/').pop() || 'image') }
    return () => { if (obj) URL.revokeObjectURL(obj) }
  }, [image])

  const onCropComplete = useCallback((_area, areaPixels) => setPixels(areaPixels), [])

  // Esc to close + lock background scroll while open.
  useEffect(() => {
    const onKey = (e) => { if (e.key === 'Escape' && !busy) onClose() }
    window.addEventListener('keydown', onKey)
    const prev = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    return () => { window.removeEventListener('keydown', onKey); document.body.style.overflow = prev }
  }, [busy, onClose])

  const dirty = zoom !== 1 || rotation !== 0 || !isDefaultAdj(adj) || (crop.x !== 0 || crop.y !== 0)
  const reset = () => { setCrop({ x: 0, y: 0 }); setZoom(1); setRotation(0); setAdj(DEFAULT_ADJ) }

  const save = async () => {
    if (!pixels || busy) return
    const file = await exportEdited(url, pixels, { rotation, adj }, aspect, name)
    onSave(file)
  }

  const rotate = (deg) => setRotation((r) => ((r + deg) % 360 + 360) % 360)
  const setAdjVal = (k, v) => setAdj((a) => ({ ...a, [k]: v }))

  const Slider = ({ icon: Icon, label, k, min, max }) => (
    <div className="flex items-center gap-2.5">
      <Icon size={15} className="text-stone-400 shrink-0" />
      <span className="text-[11px] font-medium text-stone-500 w-16 shrink-0">{label}</span>
      <input type="range" min={min} max={max} step="0.01" value={adj[k]} disabled={busy}
        onChange={(e) => setAdjVal(k, Number(e.target.value))}
        className="flex-1 accent-gold-500 cursor-pointer" />
      <button type="button" onClick={() => setAdjVal(k, 1)} disabled={busy}
        className="text-[10px] font-mono text-stone-400 w-9 text-right tabular-nums hover:text-stone-600 cursor-pointer">
        {Math.round(adj[k] * 100)}%
      </button>
    </div>
  )

  return (
    <div className="fixed inset-0 z-[110] flex items-end sm:items-center justify-center sm:p-4">
      <div className="absolute inset-0 bg-black/75" onClick={busy ? undefined : onClose} />
      <div className="relative w-full sm:max-w-lg bg-white dark:bg-stone-900 rounded-t-3xl sm:rounded-2xl shadow-2xl overflow-hidden max-h-[92dvh] flex flex-col">
        {/* Grab handle (mobile sheet) */}
        <div className="sm:hidden pt-2.5 pb-0.5 grid place-items-center shrink-0"><span className="w-10 h-1 rounded-full bg-stone-300 dark:bg-stone-600" /></div>
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 dark:border-stone-800 shrink-0">
          <div>
            <p className="text-sm font-bold text-stone-800 dark:text-stone-100">{advanced ? 'Edit photo' : 'Frame the photo'}</p>
            <p className="text-[11px] text-stone-400">
              {total > 1 ? `Image ${index + 1} of ${total} · ` : ''}Drag · scroll or pinch to zoom{advanced ? ' · finetune below' : ''}
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="w-8 h-8 grid place-items-center rounded-lg text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer disabled:opacity-40" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Body (scrolls) */}
        <div className="p-4 overflow-y-auto">
          {/* Crop stage — CSS filter gives a live preview of the adjustments */}
          <div className="relative w-full overflow-hidden rounded-xl bg-stone-100 dark:bg-stone-800" style={{ aspectRatio: String(aspect), filter: filterCss(adj) }}>
            {url ? (
              <Cropper
                image={url} crop={crop} zoom={zoom} rotation={rotation} aspect={aspect}
                minZoom={1} maxZoom={4} zoomSpeed={0.2} showGrid restrictPosition
                onCropChange={setCrop} onZoomChange={setZoom} onRotationChange={setRotation} onCropComplete={onCropComplete}
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center"><Loader2 size={22} className="animate-spin text-stone-400" /></div>
            )}
          </div>

          {/* Zoom + rotate */}
          <div className="flex items-center gap-3 mt-4">
            <button type="button" onClick={() => setZoom((z) => clamp(z - 0.25, 1, 4))} disabled={busy} className="w-8 h-8 grid place-items-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer disabled:opacity-40" aria-label="Zoom out"><ZoomOut size={16} /></button>
            <input type="range" min="1" max="4" step="0.01" value={zoom} disabled={busy} onChange={(e) => setZoom(Number(e.target.value))} className="flex-1 accent-gold-500 cursor-pointer" />
            <button type="button" onClick={() => setZoom((z) => clamp(z + 0.25, 1, 4))} disabled={busy} className="w-8 h-8 grid place-items-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer disabled:opacity-40" aria-label="Zoom in"><ZoomIn size={16} /></button>
            <span className="w-px h-5 bg-stone-200 dark:bg-stone-700" />
            <button type="button" onClick={() => rotate(-90)} disabled={busy} className="w-8 h-8 grid place-items-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer disabled:opacity-40" aria-label="Rotate left"><RotateCcw size={16} /></button>
            <button type="button" onClick={() => rotate(90)} disabled={busy} className="w-8 h-8 grid place-items-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer disabled:opacity-40" aria-label="Rotate right"><RotateCw size={16} /></button>
          </div>

          {/* Finetune (edit mode only) */}
          {advanced && (
            <div className="mt-4 pt-4 border-t border-stone-100 dark:border-stone-800 space-y-3">
              <Slider icon={Sun} label="Brightness" k="brightness" min={0.5} max={1.5} />
              <Slider icon={Contrast} label="Contrast" k="contrast" min={0.5} max={1.5} />
              <Slider icon={Droplet} label="Saturation" k="saturate" min={0} max={2} />
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-stone-100 dark:border-stone-800 shrink-0" style={{ paddingBottom: 'max(12px, env(safe-area-inset-bottom))' }}>
          {onSkip && (
            <button type="button" onClick={onSkip} disabled={busy} className="px-3 py-2.5 rounded-xl text-sm font-semibold text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer disabled:opacity-40">Skip</button>
          )}
          <button type="button" onClick={reset} disabled={busy || !dirty} className="inline-flex items-center gap-1.5 px-3 py-2.5 rounded-xl text-sm font-semibold text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer disabled:opacity-30" title="Reset">
            <Undo2 size={14} /> Reset
          </button>
          <button
            type="button" onClick={save} disabled={busy || !pixels}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer transition disabled:opacity-50"
            style={{ background: 'var(--maroon, #7B1E2B)' }}
          >
            {busy ? <><Loader2 size={15} className="animate-spin" /> Saving…</> : <><Check size={15} /> {saveLabel || (total > 1 ? 'Use & next' : 'Save')}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
