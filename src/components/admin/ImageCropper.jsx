import { useEffect, useState, useCallback } from 'react'
import Cropper from 'react-easy-crop'
import 'react-easy-crop/react-easy-crop.css'
import { X, ZoomIn, ZoomOut, Check, Loader2 } from 'lucide-react'

// Draw the selected crop (natural-pixel rect from react-easy-crop) to a canvas
// and export a JPEG File. Long edge capped at 1600px; the server re-encodes to
// webp (≤1800px) afterwards.
async function cropToFile(imageSrc, cropPixels, aspect, name) {
  const img = await new Promise((resolve, reject) => {
    const el = new Image()
    el.onload = () => resolve(el)
    el.onerror = reject
    el.src = imageSrc
  })
  const outW = Math.round(Math.min(cropPixels.width, 1600))
  const outH = Math.round(outW / aspect)
  const canvas = document.createElement('canvas')
  canvas.width = outW
  canvas.height = outH
  const ctx = canvas.getContext('2d')
  ctx.imageSmoothingQuality = 'high'
  ctx.fillStyle = '#ffffff'
  ctx.fillRect(0, 0, outW, outH)
  ctx.drawImage(img, cropPixels.x, cropPixels.y, cropPixels.width, cropPixels.height, 0, 0, outW, outH)
  const blob = await new Promise((resolve) => canvas.toBlob(resolve, 'image/jpeg', 0.92))
  const stem = (name || 'image').replace(/\.[^.]+$/, '')
  return new File([blob], `${stem}.jpg`, { type: 'image/jpeg' })
}

// Fixed-ratio crop modal built on react-easy-crop (drag + pinch/scroll zoom,
// touch-ready). Exports a cropped JPEG File via onCropped(file).
//
//   <ImageCropper file={File} aspect={1} onCropped={fn} onSkip={fn} onClose={fn} busy={bool} />
export function ImageCropper({ file, aspect = 1, onCropped, onSkip, onClose, busy = false, index = 0, total = 1 }) {
  const [url, setUrl] = useState('')
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [pixels, setPixels] = useState(null)

  useEffect(() => {
    if (!file) return
    const objUrl = URL.createObjectURL(file)
    setUrl(objUrl)
    setCrop({ x: 0, y: 0 })
    setZoom(1)
    setPixels(null)
    return () => URL.revokeObjectURL(objUrl)
  }, [file])

  const onCropComplete = useCallback((_area, areaPixels) => setPixels(areaPixels), [])

  const confirm = async () => {
    if (!pixels || busy) return
    const cropped = await cropToFile(url, pixels, aspect, file?.name)
    onCropped(cropped)
  }

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-black/70" onClick={busy ? undefined : onClose} />
      <div className="relative w-full max-w-md bg-white dark:bg-stone-900 rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-4 py-3 border-b border-stone-100 dark:border-stone-800">
          <div>
            <p className="text-sm font-bold text-stone-800 dark:text-stone-100">Frame the photo</p>
            <p className="text-[11px] text-stone-400">
              {total > 1 ? `Image ${index + 1} of ${total} · ` : ''}Drag to position · scroll or pinch to zoom
            </p>
          </div>
          <button type="button" onClick={onClose} disabled={busy} className="w-8 h-8 grid place-items-center rounded-lg text-stone-400 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer disabled:opacity-40" aria-label="Close">
            <X size={16} />
          </button>
        </div>

        {/* Crop stage */}
        <div className="p-4">
          <div className="relative w-full overflow-hidden rounded-xl bg-stone-100 dark:bg-stone-800" style={{ aspectRatio: String(aspect) }}>
            {url ? (
              <Cropper
                image={url}
                crop={crop}
                zoom={zoom}
                aspect={aspect}
                minZoom={1}
                maxZoom={4}
                zoomSpeed={0.2}
                showGrid
                restrictPosition
                onCropChange={setCrop}
                onZoomChange={setZoom}
                onCropComplete={onCropComplete}
              />
            ) : (
              <div className="absolute inset-0 grid place-items-center"><Loader2 size={22} className="animate-spin text-stone-400" /></div>
            )}
          </div>

          {/* Zoom control */}
          <div className="flex items-center gap-3 mt-4">
            <button type="button" onClick={() => setZoom((z) => Math.max(1, z - 0.25))} disabled={busy} className="w-8 h-8 grid place-items-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer disabled:opacity-40" aria-label="Zoom out"><ZoomOut size={16} /></button>
            <input
              type="range" min="1" max="4" step="0.01" value={zoom}
              onChange={(e) => setZoom(Number(e.target.value))}
              disabled={busy}
              className="flex-1 accent-gold-500 cursor-pointer"
            />
            <button type="button" onClick={() => setZoom((z) => Math.min(4, z + 0.25))} disabled={busy} className="w-8 h-8 grid place-items-center rounded-lg text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer disabled:opacity-40" aria-label="Zoom in"><ZoomIn size={16} /></button>
          </div>
        </div>

        {/* Footer */}
        <div className="flex items-center gap-2 px-4 py-3 border-t border-stone-100 dark:border-stone-800">
          {onSkip && (
            <button type="button" onClick={onSkip} disabled={busy} className="px-3 py-2.5 rounded-xl text-sm font-semibold text-stone-500 hover:bg-stone-100 dark:hover:bg-stone-800 cursor-pointer disabled:opacity-40">
              Skip
            </button>
          )}
          <button
            type="button" onClick={confirm} disabled={busy || !pixels}
            className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-2.5 rounded-xl text-sm font-bold text-white cursor-pointer transition disabled:opacity-50"
            style={{ background: 'var(--maroon, #7B1E2B)' }}
          >
            {busy ? <><Loader2 size={15} className="animate-spin" /> Uploading…</> : <><Check size={15} /> {total > 1 ? 'Use & next' : 'Use photo'}</>}
          </button>
        </div>
      </div>
    </div>
  )
}
