import { useRef, useEffect } from 'react'

// Floating gold-dust particle field on a canvas. Cheap: ~70 particles, capped DPR,
// pauses when scrolled off-screen and honours prefers-reduced-motion.
export function GoldDust({ className, color = '#E3C97A', count = 70 }) {
  const canvasRef = useRef(null)

  useEffect(() => {
    const canvas = canvasRef.current
    if (!canvas) return
    const reduced = window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
    const ctx = canvas.getContext('2d')
    const dpr = Math.min(window.devicePixelRatio || 1, 2)
    let w = 0, h = 0, raf = 0, running = true
    let particles = []

    const resize = () => {
      const rect = canvas.getBoundingClientRect()
      w = rect.width; h = rect.height
      canvas.width = w * dpr; canvas.height = h * dpr
      ctx.setTransform(dpr, 0, 0, dpr, 0, 0)
    }

    const init = () => {
      particles = Array.from({ length: count }, () => ({
        x: Math.random() * w,
        y: Math.random() * h,
        r: Math.random() * 1.8 + 0.4,
        vx: (Math.random() - 0.5) * 0.25,
        vy: -(Math.random() * 0.35 + 0.1),
        a: Math.random() * 0.5 + 0.2,
        tw: Math.random() * Math.PI * 2,
      }))
    }

    const draw = () => {
      ctx.clearRect(0, 0, w, h)
      for (const p of particles) {
        p.x += p.vx; p.y += p.vy; p.tw += 0.03
        if (p.y < -5) { p.y = h + 5; p.x = Math.random() * w }
        if (p.x < -5) p.x = w + 5
        if (p.x > w + 5) p.x = -5
        const alpha = p.a * (0.6 + 0.4 * Math.sin(p.tw))
        ctx.beginPath()
        ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2)
        ctx.fillStyle = color
        ctx.globalAlpha = alpha
        ctx.fill()
      }
      ctx.globalAlpha = 1
      if (running) raf = requestAnimationFrame(draw)
    }

    resize(); init()
    if (!reduced) raf = requestAnimationFrame(draw)
    else draw() // one static frame

    const onResize = () => { resize(); init() }
    window.addEventListener('resize', onResize)

    // Pause when off-screen
    const io = new IntersectionObserver(([e]) => {
      running = e.isIntersecting && !reduced
      if (running) raf = requestAnimationFrame(draw)
      else cancelAnimationFrame(raf)
    }, { threshold: 0 })
    io.observe(canvas)

    return () => { cancelAnimationFrame(raf); window.removeEventListener('resize', onResize); io.disconnect() }
  }, [color, count])

  return <canvas ref={canvasRef} className={className} style={{ width: '100%', height: '100%', display: 'block' }} aria-hidden />
}
