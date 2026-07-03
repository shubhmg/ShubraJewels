import { useRef, useMemo, useState, useEffect } from 'react'
import { Canvas, useFrame } from '@react-three/fiber'
import { Float, Environment, Lightformer, Sparkles } from '@react-three/drei'
import * as THREE from 'three'

/**
 * A stylized 3D gold jhumka for the hero — dome + hook ring + a skirt of little
 * bells — built from primitives so it needs no downloaded model. Procedural
 * lighting (Lightformers) gives metallic reflections without a network HDRI.
 */
function Jhumka({ gold = '#C9A84C' }) {
  const group = useRef(null)

  // Bell/dome profile revolved around Y.
  const domeGeo = useMemo(() => {
    const pts = [
      [0.02, 1.02], [0.16, 0.98], [0.34, 0.86], [0.52, 0.66],
      [0.72, 0.36], [0.9, 0.08], [1.0, -0.06], [0.92, -0.08],
    ].map(([x, y]) => new THREE.Vector2(x, y))
    return new THREE.LatheGeometry(pts, 64)
  }, [])

  // Ring of little hanging bells around the rim.
  const bells = useMemo(() => {
    const n = 16
    return Array.from({ length: n }, (_, i) => {
      const a = (i / n) * Math.PI * 2
      return [Math.cos(a) * 1.02, -0.16, Math.sin(a) * 1.02]
    })
  }, [])

  // Gentle pointer parallax + slow spin.
  useFrame((state, delta) => {
    if (!group.current) return
    group.current.rotation.y += delta * 0.35
    const tx = state.pointer.y * 0.25
    const tz = state.pointer.x * 0.25
    group.current.rotation.x += (tx - group.current.rotation.x) * 0.05
    group.current.rotation.z += (-tz - group.current.rotation.z) * 0.05
  })

  const material = (
    <meshStandardMaterial color={gold} metalness={1} roughness={0.22} envMapIntensity={1.4} />
  )

  return (
    <Float speed={1.4} rotationIntensity={0.25} floatIntensity={0.6}>
      <group ref={group} scale={1.15} position={[0, 0.1, 0]}>
        {/* Dome */}
        <mesh geometry={domeGeo} castShadow>{material}</mesh>
        {/* Top hook ring */}
        <mesh position={[0, 1.18, 0]} rotation={[Math.PI / 2, 0, 0]}>
          <torusGeometry args={[0.12, 0.035, 16, 32]} />
          {material}
        </mesh>
        {/* Stud between hook and dome */}
        <mesh position={[0, 1.0, 0]}>
          <sphereGeometry args={[0.1, 24, 24]} />
          {material}
        </mesh>
        {/* Skirt of bells */}
        {bells.map((p, i) => (
          <mesh key={i} position={p}>
            <sphereGeometry args={[0.09, 20, 20]} />
            {material}
          </mesh>
        ))}
        {/* Central drop bell */}
        <mesh position={[0, -0.34, 0]}>
          <sphereGeometry args={[0.16, 24, 24]} />
          {material}
        </mesh>
      </group>
    </Float>
  )
}

export function HeroJewel({ gold = '#C9A84C', goldLight = '#E3C97A', className }) {
  const [inView, setInView] = useState(true)
  const holder = useRef(null)
  const reduced = typeof window !== 'undefined' && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

  // Pause the render loop when the hero is scrolled away.
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
        camera={{ position: [0, 0, 5], fov: 42 }}
        frameloop={inView && !reduced ? 'always' : 'demand'}
        gl={{ antialias: true, alpha: true, powerPreference: 'high-performance' }}
        style={{ background: 'transparent' }}
      >
        <ambientLight intensity={0.5} />
        <directionalLight position={[3, 4, 2]} intensity={1.4} color="#fff3d6" />
        <pointLight position={[-4, -2, -2]} intensity={30} color={goldLight} />
        <pointLight position={[4, 2, 3]} intensity={20} color="#ffffff" />

        <Jhumka gold={gold} />

        <Sparkles count={45} scale={[7, 5, 4]} size={2.4} speed={0.3} opacity={0.7} color={goldLight} />

        {/* Procedural reflections — no external HDRI download */}
        <Environment resolution={128}>
          <Lightformer intensity={2.2} position={[0, 2, 3]} scale={[4, 4, 1]} color="#fff1cf" />
          <Lightformer intensity={1.4} position={[-3, -1, -2]} scale={[3, 3, 1]} color={goldLight} />
          <Lightformer intensity={1.1} position={[3, 1, -2]} scale={[2, 2, 1]} color="#ffffff" />
          <Lightformer intensity={1.6} position={[0, -3, 1]} scale={[5, 2, 1]} color="#ffd98a" />
        </Environment>
      </Canvas>
    </div>
  )
}
