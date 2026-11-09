import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { BODY_BY_ID, BODIES, type CelestialBody } from '../data/bodies'
import { useAppStore } from '../state/store'
import { AU_KM, hillRadiusKm, J2000, orbitalPeriodDays } from '../sim/kepler'
import { displayPositionAt, runtime } from '../sim/runtime'
import { orbitScale, satelliteOrbitScale } from '../sim/scaling'

const UP = new THREE.Vector3(0, 1, 0)
const TRAIL_MAX = 150
const PREDICT_MAX = 72

function isBodyVisible(body: CelestialBody, selectedId: string | null, focusId: string | null) {
  if (!body.parent) return true
  return (
    selectedId === body.id ||
    focusId === body.id ||
    selectedId === body.parent ||
    focusId === body.parent
  )
}

export function TrailLayer() {
  const enabled = useAppStore((s) => s.settings.trails)
  const mode = useAppStore((s) => s.displayMode)
  const boost = useAppStore((s) => s.settings.sizeBoost)
  const selectedId = useAppStore((s) => s.selectedId)
  const focusId = useAppStore((s) => s.focusId)
  const group = useRef<THREE.Group>(null)

  const trails = useMemo(() => {
    if (!enabled) return []
    return BODIES.filter((b) => b.kind !== 'star').map((body) => {
      const geom = new THREE.BufferGeometry()
      const positions = new Float32Array(TRAIL_MAX * 3)
      const colors = new Float32Array(TRAIL_MAX * 3)
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geom.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      geom.setDrawRange(0, 0)
      const material = new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.9,
        blending: THREE.AdditiveBlending,
        depthWrite: false,
        toneMapped: false,
      })
      const line = new THREE.Line(geom, material)
      line.frustumCulled = false
      line.renderOrder = 2
      return { body, line, geom, positions, colors, lastReset: -1 }
    })
  }, [enabled])

  useEffect(() => {
    return () => {
      for (const t of trails) {
        t.geom.dispose()
        ;(t.line.material as THREE.Material).dispose()
      }
    }
  }, [trails])

  useFrame(() => {
    if (!enabled || trails.length === 0) return
    if (group.current) group.current.position.copy(runtime.origin).multiplyScalar(-1)
    const frame = runtime.frame
    for (const t of trails) {
      const visible = isBodyVisible(t.body, selectedId, focusId)
      t.line.visible = visible
      if (!visible) continue
      const resetChanged = t.lastReset !== runtime.resetToken
      if (!resetChanged && frame % 16 !== 0) continue
      t.lastReset = runtime.resetToken

      const period = Math.max(orbitalPeriodDays(t.body), 0.05)
      const span = period * 0.22
      const step = span / (TRAIL_MAX - 1)
      const color = new THREE.Color(t.body.color)
      const vec = new THREE.Vector3()
      for (let i = 0; i < TRAIL_MAX; i++) {
        const jd = runtime.jd - i * step
        displayPositionAt(t.body, jd, mode, boost, vec)
        t.positions[i * 3] = vec.x
        t.positions[i * 3 + 1] = vec.y
        t.positions[i * 3 + 2] = vec.z
        const f = Math.pow(1 - i / (TRAIL_MAX - 1), 1.7) * 0.95
        t.colors[i * 3] = color.r * f
        t.colors[i * 3 + 1] = color.g * f
        t.colors[i * 3 + 2] = color.b * f
      }
      t.geom.setDrawRange(0, TRAIL_MAX)
      ;(t.geom.attributes.position as THREE.BufferAttribute).needsUpdate = true
      ;(t.geom.attributes.color as THREE.BufferAttribute).needsUpdate = true
      t.geom.computeBoundingSphere()
    }
  })

  if (!enabled) return null
  return (
    <group ref={group}>
      {trails.map((t) => (
        <primitive key={t.body.id} object={t.line} />
      ))}
    </group>
  )
}

export function PredictedLayer() {
  const enabled = useAppStore((s) => s.settings.predicted)
  const mode = useAppStore((s) => s.displayMode)
  const boost = useAppStore((s) => s.settings.sizeBoost)
  const selectedId = useAppStore((s) => s.selectedId)
  const focusId = useAppStore((s) => s.focusId)
  const group = useRef<THREE.Group>(null)

  const lines = useMemo(() => {
    if (!enabled) return []
    return BODIES.filter((b) => b.kind !== 'star').map((body) => {
      const geom = new THREE.BufferGeometry()
      const positions = new Float32Array(PREDICT_MAX * 3)
      geom.setAttribute('position', new THREE.BufferAttribute(positions, 3))
      geom.setDrawRange(0, 0)
      const material = new THREE.LineDashedMaterial({
        color: new THREE.Color(body.color),
        transparent: true,
        opacity: 0.55,
        dashSize: 2,
        gapSize: 1.6,
        depthWrite: false,
        toneMapped: false,
      })
      const line = new THREE.Line(geom, material)
      line.frustumCulled = false
      line.renderOrder = 2
      return { body, line, geom, positions, material, lastReset: -1, lastUpdate: -999 }
    })
  }, [enabled])

  useEffect(() => {
    return () => {
      for (const t of lines) {
        t.geom.dispose()
        t.material.dispose()
      }
    }
  }, [lines])

  useFrame(() => {
    if (!enabled || lines.length === 0) return
    if (group.current) group.current.position.copy(runtime.origin).multiplyScalar(-1)
    for (const t of lines) {
      const visible = isBodyVisible(t.body, selectedId, focusId)
      t.line.visible = visible
      if (!visible) continue
      if (runtime.frame - t.lastUpdate < 24 && t.lastReset === runtime.resetToken) continue
      t.lastUpdate = runtime.frame
      t.lastReset = runtime.resetToken

      const period = Math.max(orbitalPeriodDays(t.body), 0.05)
      const step = (period * 0.3) / (PREDICT_MAX - 1)
      const vec = new THREE.Vector3()
      let spacing = 0
      for (let i = 0; i < PREDICT_MAX; i++) {
        displayPositionAt(t.body, runtime.jd + i * step, mode, boost, vec)
        t.positions[i * 3] = vec.x
        t.positions[i * 3 + 1] = vec.y
        t.positions[i * 3 + 2] = vec.z
        if (i === 1) spacing = vec.distanceTo(new THREE.Vector3(t.positions[0], t.positions[1], t.positions[2]))
      }
      t.geom.setDrawRange(0, PREDICT_MAX)
      ;(t.geom.attributes.position as THREE.BufferAttribute).needsUpdate = true
      t.geom.computeBoundingSphere()
      t.line.computeLineDistances()
      const dash = Math.max(spacing * 1.8, 0.35)
      t.material.dashSize = dash
      t.material.gapSize = dash * 0.85
      t.material.opacity = selectedId === t.body.id ? 0.85 : 0.4
    }
  })

  if (!enabled) return null
  return (
    <group ref={group}>
      {lines.map((t) => (
        <primitive key={t.body.id} object={t.line} />
      ))}
    </group>
  )
}

export function VelocityVectors() {
  const enabled = useAppStore((s) => s.settings.velocityVectors)
  const mode = useAppStore((s) => s.displayMode)
  const selectedId = useAppStore((s) => s.selectedId)
  const group = useRef<THREE.Group>(null)

  const arrows = useMemo(() => {
    if (!enabled) return []
    return BODIES.filter((b) => b.kind !== 'star').map((body) => {
      const color = new THREE.Color(body.color).lerp(new THREE.Color('#ffffff'), 0.35)
      const arrow = new THREE.ArrowHelper(UP, new THREE.Vector3(), 10, color.getHex(), 3.4, 2.2)
      const lineMat = arrow.line.material as THREE.LineBasicMaterial
      const coneMat = arrow.cone.material as THREE.MeshBasicMaterial
      lineMat.transparent = true
      coneMat.transparent = true
      lineMat.opacity = 0.8
      coneMat.opacity = 0.85
      arrow.line.renderOrder = 3
      return { body, arrow }
    })
  }, [enabled])

  useEffect(() => {
    return () => {
      for (const a of arrows) {
        a.arrow.line.geometry.dispose()
        ;(a.arrow.line.material as THREE.Material).dispose()
        a.arrow.cone.geometry.dispose()
        ;(a.arrow.cone.material as THREE.Material).dispose()
      }
    }
  }, [arrows])

  useFrame(() => {
    if (!enabled || arrows.length === 0) return
    if (group.current) group.current.position.copy(runtime.origin).multiplyScalar(-1)
    for (const { body, arrow } of arrows) {
      const state = runtime.bodies.get(body.id)
      if (!state) continue
      const isSelected = selectedId === body.id
      if (body.parent && !isSelected && !(selectedId && body.parent === BODY_BY_ID.get(selectedId)?.id)) {
        arrow.visible = false
        continue
      }
      arrow.visible = true
      const length =
        mode === 'true'
          ? Math.max(state.camDistance * 0.24, state.radius * 2)
          : Math.max(state.radius * 2.2, 2.1 * state.velocityKms)
      arrow.position.copy(state.display)
      arrow.setDirection(state.velocityDir.lengthSq() > 0 ? state.velocityDir : UP)
      arrow.setLength(length, length * 0.26, length * 0.11)
    }
  })

  if (!enabled) return null
  return (
    <group ref={group}>
      {arrows.map(({ body, arrow }) => (
        <primitive key={body.id} object={arrow} />
      ))}
    </group>
  )
}

export function HillSpheres() {
  const enabled = useAppStore((s) => s.settings.hillSpheres)
  const mode = useAppStore((s) => s.displayMode)
  const selectedId = useAppStore((s) => s.selectedId)
  const group = useRef<THREE.Group>(null)

  const spheres = useMemo(() => {
    if (!enabled) return []
    const sun = BODY_BY_ID.get('sun')!
    return BODIES.filter((b) => b.kind === 'planet' || b.kind === 'dwarf' || b.id === selectedId).map((body) => {
      const parent = body.parent ? BODY_BY_ID.get(body.parent) : sun
      if (!parent) return null
      const hrKm = hillRadiusKm(body, parent.massKg)
      if (!hrKm || !isFinite(hrKm)) return null
      const unitsPerKm = body.parent
        ? satelliteOrbitScale(body, parent, mode, 1) / AU_KM
        : orbitScale(body, mode, 1) / AU_KM
      const radius = hrKm * unitsPerKm
      return { body, radius: Math.max(radius, body.kind === 'planet' ? 1 : 0.1) }
    }).filter(Boolean) as { body: CelestialBody; radius: number }[]
  }, [enabled, mode, selectedId])

  useFrame(() => {
    if (group.current) group.current.position.copy(runtime.origin).multiplyScalar(-1)
  })

  if (!enabled) return null
  return (
    <group ref={group}>
      {spheres.map(({ body, radius }) => (
        <HillSphereMesh key={body.id} body={body} radius={radius} selected={selectedId === body.id} />
      ))}
    </group>
  )
}

function HillSphereMesh({ body, radius, selected }: { body: CelestialBody; radius: number; selected: boolean }) {
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    const state = runtime.bodies.get(body.id)
    if (ref.current && state) ref.current.position.copy(state.display)
  })
  return (
    <mesh ref={ref} renderOrder={1}>
      <sphereGeometry args={[radius, 24, 16]} />
      <meshBasicMaterial
        color={selected ? '#7fe2ff' : '#5fa8cc'}
        wireframe
        transparent
        opacity={selected ? 0.13 : 0.05}
        depthWrite={false}
      />
    </mesh>
  )
}
