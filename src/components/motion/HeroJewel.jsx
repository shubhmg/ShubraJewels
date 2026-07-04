import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Environment, Lightformer, Sparkles } from '@react-three/drei'
import * as THREE from 'three'

const GEM = '#0c7a55' // emerald

/**
 * A 3D chandbali earring — emerald teardrop stones set in gold: a petal stud on
 * top, a studded gold ring, a fan of pear-cut stones, and a hanging drop.
 * Hangs from the hook and sways gently. Built from primitives, lit procedurally.
 */
function Chandbali({ gold = '#C9A84C' }) {
  const swing = useRef(null)

  // Fresh materials per mesh (components → new instance each render).
  const Gold = () => <meshStandardMaterial color={gold} metalness={1} roughness={0.26} envMapIntensity={1.5} />
  const Gem = () => <meshStandardMaterial color={GEM} metalness={0.35} roughness={0.05} envMapIntensity={2.6} flatShading />
  const Amber = () => <meshStandardMaterial color="#e0bd63" metalness={0.7} roughness={0.18} envMapIntensity={1.6} />

  // Pear/teardrop stone (tip at y=0, bulb up).
  const teardrop = useMemo(() => {
    const p = [[0, 0], [0.05, 0.04], [0.11, 0.12], [0.17, 0.24], [0.2, 0.38], [0.185, 0.52], [0.12, 0.63], [0.05, 0.69], [0, 0.7]]
      .map(([x, y]) => new THREE.Vector2(x, y))
    return new THREE.LatheGeometry(p, 20)
  }, [])

  // Fan of pear stones around the lower half of the ring (bulbs radiating out).
  const fan = useMemo(() => {
    const n = 11
    return Array.from({ length: n }, (_, i) => {
      const a = Math.PI + (i / (n - 1)) * Math.PI // 180° → 360°
      const s = 0.42 + 0.24 * Math.sin(a - Math.PI) // bigger at the bottom
      return { a, x: Math.cos(a) * 0.5, y: Math.sin(a) * 0.5, s }
    })
  }, [])

  // Studded beads around the ring's outer edge.
  const beads = useMemo(() => (
    Array.from({ length: 22 }, (_, i) => {
      const a = (i / 22) * Math.PI * 2
      return { x: Math.cos(a) * 0.74, y: Math.sin(a) * 0.74, amber: i % 2 === 0 }
    })
  ), [])

  useFrame((state) => {
    if (!swing.current) return
    const t = state.clock.elapsedTime
    swing.current.rotation.z = Math.sin(t * 0.9) * 0.11
    const ty = Math.sin(t * 0.4) * 0.35 + state.pointer.x * 0.35
    swing.current.rotation.y += (ty - swing.current.rotation.y) * 0.04
    swing.current.rotation.x += (state.pointer.y * 0.1 - swing.current.rotation.x) * 0.04
  })

  return (
    <Float speed={1.1} rotationIntensity={0.12} floatIntensity={0.3}>
      <group ref={swing} scale={0.7} position={[0, 0.2, 0]}>
        {/* Ear hook */}
        <mesh position={[0, 1.98, 0]}><torusGeometry args={[0.1, 0.02, 16, 32]} /><Gold /></mesh>

        {/* Top petal cluster (3 emerald teardrops) */}
        {[[-0.22, 1.42, 0.55], [0, 1.5, 0], [0.22, 1.42, -0.55]].map(([x, y, rz], i) => (
          <mesh key={i} geometry={teardrop} position={[x, y, 0]} rotation={[0, 0, rz]} scale={0.5}><Gem /></mesh>
        ))}
        {/* connector link */}
        <mesh position={[0, 1.12, 0]}><torusGeometry args={[0.07, 0.017, 12, 24]} /><Gold /></mesh>

        {/* Chandbali gold ring */}
        <mesh position={[0, 0, 0]}><torusGeometry args={[0.6, 0.055, 20, 64]} /><Gold /></mesh>
        {/* studded outer beads */}
        {beads.map((b, i) => (
          <mesh key={i} position={[b.x, b.y, 0.02]}>
            <sphereGeometry args={[b.amber ? 0.055 : 0.045, 14, 14]} />
            {b.amber ? <Amber /> : <Gold />}
          </mesh>
        ))}
        {/* centre stone in a gold bezel */}
        <mesh position={[0, 0, 0.04]} rotation={[Math.PI / 2, 0, 0]}><torusGeometry args={[0.17, 0.03, 14, 28]} /><Gold /></mesh>
        <mesh position={[0, 0, 0.08]}><icosahedronGeometry args={[0.15, 0]} /><Gem /></mesh>

        {/* Fan of pear stones */}
        {fan.map((f, i) => (
          <mesh key={i} geometry={teardrop} position={[f.x, f.y, 0.02]} rotation={[0, 0, f.a - Math.PI / 2]} scale={f.s}><Gem /></mesh>
        ))}

        {/* Hanging drop */}
        <mesh position={[0, -0.95, 0]}><torusGeometry args={[0.06, 0.015, 12, 24]} /><Gold /></mesh>
        <mesh geometry={teardrop} position={[0, -1.86, 0]} rotation={[0, 0, Math.PI]} scale={1.05}><Gem /></mesh>
        {/* tiny gold beads framing the drop */}
        {Array.from({ length: 10 }).map((_, i) => {
          const a = Math.PI * 0.15 + (i / 9) * Math.PI * 1.7
          return <mesh key={i} position={[Math.cos(a) * 0.24, -1.55 + Math.sin(a) * 0.3, 0.02]}><sphereGeometry args={[0.03, 10, 10]} /><Gold /></mesh>
        })}
      </group>
    </Float>
  )
}

export function HeroJewel({ gold = '#C9A84C', goldLight = '#E3C97A', className }) {
  const [inView, setInView] = useState(true)
  const holder = useRef(null)
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  useEffect(() => {
    const el = holder.current
    if (!el) return
    const io = new IntersectionObserver(([e]) => setInView(e.isIntersecting), { threshold: 0 })
    io.observe(el)
    return () => io.disconnect()
  }, [])

  return (
    <div ref={holder} className={className}>
      <Canvas
        dpr={[1, 1.5]}
        camera={{ position: [0, 0, 5.9], fov: 42 }}
        frameloop={inView && !reduced ? 'always' : 'demand'}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.6} />
        <directionalLight position={[3, 4, 3]} intensity={1.6} color="#fff3d6" />
        <pointLight position={[-4, -1, -2]} intensity={24} color={goldLight} />
        <pointLight position={[4, 2, 3]} intensity={18} color="#ffffff" />
        <pointLight position={[0, -2, 3]} intensity={10} color="#3bd39b" />

        <Chandbali gold={gold} />

        <Sparkles count={20} scale={[5, 5, 3]} size={1.6} speed={0.22} opacity={0.45} color={goldLight} />

        <Environment resolution={128}>
          <Lightformer intensity={2.3} position={[0, 2, 3]} scale={[4, 4, 1]} color="#fff1cf" />
          <Lightformer intensity={1.5} position={[-3, -1, -2]} scale={[3, 3, 1]} color={goldLight} />
          <Lightformer intensity={1.2} position={[3, 1, -2]} scale={[2, 2, 1]} color="#ffffff" />
          <Lightformer intensity={1.4} position={[0, -3, 1]} scale={[5, 2, 1]} color="#ffd98a" />
        </Environment>
      </Canvas>
    </div>
  )
}
