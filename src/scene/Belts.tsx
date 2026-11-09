import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { useAppStore } from '../state/store'
import { positionFromElements } from '../sim/kepler'
import { AU_UNITS, eduDistanceAU } from '../sim/scaling'
import { runtime } from '../sim/runtime'

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function AsteroidBelt() {
  const enabled = useAppStore((s) => s.settings.asteroidBelt)
  const mode = useAppStore((s) => s.displayMode)

  const mesh = useMemo(() => {
    if (!enabled) return null
    const rnd = mulberry32(4711)
    const COUNT = 2600
    const geometry = new THREE.DodecahedronGeometry(1, 0)
    const material = new THREE.MeshStandardMaterial({
      color: '#655d51',
      roughness: 1,
      metalness: 0.02,
      flatShading: true,
    })
    const inst = new THREE.InstancedMesh(geometry, material, COUNT)
    const dummy = new THREE.Object3D()
    const vec = new THREE.Vector3()
    for (let i = 0; i < COUNT; i++) {
      const a = 2.06 + Math.pow(rnd(), 0.9) * 1.22
      const e = rnd() * 0.16
      const inc = (rnd() - 0.5) * 16
      const node = rnd() * 360
      const peri = rnd() * 360
      const M = rnd() * 360
      positionFromElements({ a, e, i: inc, node, argPeri: peri, meanAnomaly: M }, vec)
      const f = mode === 'true' ? AU_UNITS : eduDistanceAU(a) / a
      const size = (0.2 + Math.pow(rnd(), 2.6) * 0.62) * (mode === 'true' ? 0.06 : 1)
      dummy.position.set(vec.x * f, vec.y * f, vec.z * f)
      dummy.rotation.set(rnd() * Math.PI, rnd() * Math.PI, rnd() * Math.PI)
      dummy.scale.set(size * (0.6 + rnd() * 0.8), size * (0.5 + rnd() * 0.7), size * (0.6 + rnd() * 0.8))
      dummy.updateMatrix()
      inst.setMatrixAt(i, dummy.matrix)
    }
    inst.instanceMatrix.needsUpdate = true
    inst.computeBoundingSphere()
    inst.frustumCulled = false
    return inst
  }, [enabled, mode])

  useEffect(() => {
    return () => {
      if (mesh) {
        mesh.geometry.dispose()
        ;(mesh.material as THREE.Material).dispose()
      }
    }
  }, [mesh])

  useFrame(() => {
    if (mesh) mesh.position.copy(runtime.origin).multiplyScalar(-1)
  })

  if (!mesh) return null
  return <primitive object={mesh} />
}

export function KuiperBelt() {
  const enabled = useAppStore((s) => s.settings.kuiperBelt)
  const mode = useAppStore((s) => s.displayMode)
  const points = useRef<THREE.Points>(null)

  const geometry = useMemo(() => {
    if (!enabled) return null
    const rnd = mulberry32(88231)
    const COUNT = 7000
    const positions = new Float32Array(COUNT * 3)
    const colors = new Float32Array(COUNT * 3)
    const col = new THREE.Color()
    const vec = new THREE.Vector3()
    for (let i = 0; i < COUNT; i++) {
      const a = 30 + Math.pow(rnd(), 0.7) * 24
      const e = rnd() * 0.18
      const inc = (rnd() - 0.5) * 30
      positionFromElements(
        { a, e, i: inc, node: rnd() * 360, argPeri: rnd() * 360, meanAnomaly: rnd() * 360 },
        vec,
      )
      const f = mode === 'true' ? AU_UNITS : eduDistanceAU(a) / a
      positions[i * 3] = vec.x * f
      positions[i * 3 + 1] = vec.y * f
      positions[i * 3 + 2] = vec.z * f
      col.setHSL(0.58 + rnd() * 0.05, 0.28, 0.42 + rnd() * 0.25)
      colors[i * 3] = col.r
      colors[i * 3 + 1] = col.g
      colors[i * 3 + 2] = col.b
    }
    const g = new THREE.BufferGeometry()
    g.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    g.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    return g
  }, [enabled, mode])

  useFrame(() => {
    if (points.current) points.current.position.copy(runtime.origin).multiplyScalar(-1)
  })

  if (!enabled || !geometry) return null
  return (
    <points ref={points} geometry={geometry} frustumCulled={false}>
      <pointsMaterial
        size={1.3}
        sizeAttenuation={false}
        vertexColors
        transparent
        opacity={0.52}
        depthWrite={false}
        blending={THREE.AdditiveBlending}
      />
    </points>
  )
}

export function EclipticGrid() {
  const enabled = useAppStore((s) => s.settings.eclipticGrid)
  const mode = useAppStore((s) => s.displayMode)
  const group = useRef<THREE.Group>(null)

  const rings = useMemo(() => {
    if (!enabled) return []
    const distances = [0.5, 1, 2, 3, 5, 10, 20, 30, 40, 50]
    return distances.map((au) => {
      const r = mode === 'true' ? au * AU_UNITS : eduDistanceAU(au)
      const pts: [number, number, number][] = []
      for (let i = 0; i <= 180; i++) {
        const a = (i / 180) * Math.PI * 2
        pts.push([Math.cos(a) * r, 0, Math.sin(a) * r])
      }
      return { au, pts }
    })
  }, [enabled, mode])

  const spokes = useMemo(() => {
    if (!enabled) return []
    const maxR = mode === 'true' ? 50 * AU_UNITS : eduDistanceAU(50)
    return Array.from({ length: 12 }, (_, i) => {
      const a = (i / 12) * Math.PI * 2
      return [
        [0, 0, 0],
        [Math.cos(a) * maxR, 0, Math.sin(a) * maxR],
      ] as [number, number, number][]
    })
  }, [enabled, mode])

  useFrame(() => {
    if (group.current) group.current.position.copy(runtime.origin).multiplyScalar(-1)
  })

  if (!enabled) return null
  return (
    <group ref={group}>
      {rings.map((r) => (
        <Line
          key={r.au}
          points={r.pts}
          color="#3f6f96"
          lineWidth={0.8}
          transparent
          opacity={r.au === 1 || r.au === 30 ? 0.35 : 0.15}
          depthWrite={false}
        />
      ))}
      {spokes.map((pts, i) => (
        <Line key={i} points={pts} color="#2e5474" lineWidth={0.6} transparent opacity={0.1} depthWrite={false} />
      ))}
    </group>
  )
}
