import { useRef } from 'react'
import { motion } from 'framer-motion'

const EASE = [0.16, 1, 0.3, 1]
const hoverable = () => typeof window !== 'undefined' && window.matchMedia?.('(hover: hover)').matches

// Fade + rise into view as you scroll. Fires once.
export function Reveal({ children, y = 28, delay = 0, className, as = 'div' }) {
  const M = motion[as] || motion.div
  return (
    <M
      className={className}
      initial={{ opacity: 0, y }}
      whileInView={{ opacity: 1, y: 0 }}
      viewport={{ once: true, margin: '-60px' }}
      transition={{ duration: 0.6, delay, ease: EASE }}
    >
      {children}
    </M>
  )
}

// Staggers direct children into view.
export function Stagger({ children, className, gap = 0.08 }) {
  return (
    <motion.div
      className={className}
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, margin: '-60px' }}
      variants={{ hidden: {}, show: { transition: { staggerChildren: gap } } }}
    >
      {children}
    </motion.div>
  )
}

export function StaggerItem({ children, className, y = 26 }) {
  return (
    <motion.div
      className={className}
      variants={{ hidden: { opacity: 0, y }, show: { opacity: 1, y: 0, transition: { duration: 0.55, ease: EASE } } }}
    >
      {children}
    </motion.div>
  )
}

// Pointer-driven 3D tilt (perspective). No-op on touch devices.
export function Tilt({ children, className, style, max = 9, scale = 1.02 }) {
  const ref = useRef(null)
  const raf = useRef(0)

  const onMove = (e) => {
    if (!hoverable()) return
    const el = ref.current
    if (!el) return
    cancelAnimationFrame(raf.current)
    raf.current = requestAnimationFrame(() => {
      const r = el.getBoundingClientRect()
      const px = (e.clientX - r.left) / r.width - 0.5
      const py = (e.clientY - r.top) / r.height - 0.5
      el.style.transform = `perspective(900px) rotateX(${(-py * max).toFixed(2)}deg) rotateY(${(px * max).toFixed(2)}deg) scale(${scale})`
    })
  }
  const reset = () => {
    const el = ref.current
    if (el) el.style.transform = 'perspective(900px) rotateX(0) rotateY(0) scale(1)'
  }

  return (
    <div
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className={className}
      style={{ transition: 'transform .3s cubic-bezier(.16,1,.3,1)', willChange: 'transform', WebkitBackfaceVisibility: 'hidden', ...style }}
    >
      {children}
    </div>
  )
}

// Element that gently pulls toward the cursor. No-op on touch.
export function Magnetic({ children, strength = 0.35, className }) {
  const ref = useRef(null)
  const onMove = (e) => {
    if (!hoverable()) return
    const el = ref.current
    if (!el) return
    const r = el.getBoundingClientRect()
    const x = (e.clientX - (r.left + r.width / 2)) * strength
    const y = (e.clientY - (r.top + r.height / 2)) * strength
    el.style.transform = `translate(${x}px, ${y}px)`
  }
  const reset = () => { if (ref.current) ref.current.style.transform = 'translate(0,0)' }
  return (
    <span
      ref={ref}
      onMouseMove={onMove}
      onMouseLeave={reset}
      className={className}
      style={{ display: 'inline-flex', transition: 'transform .3s cubic-bezier(.16,1,.3,1)', willChange: 'transform' }}
    >
      {children}
    </span>
  )
}
