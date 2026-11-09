import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line } from '@react-three/drei'
import * as THREE from 'three'
import { BODIES } from '../data/bodies'
import { useAppStore } from '../state/store'
import { orbitPath } from '../sim/kepler'
import { orbitScale } from '../sim/scaling'
import { runtime } from '../sim/runtime'

export function OrbitLayer() {
  const enabled = useAppStore((s) => s.settings.orbits)
  const selectedId = useAppStore((s) => s.selectedId)
  const focusId = useAppStore((s) => s.focusId)
  const mode = useAppStore((s) => s.displayMode)
  const boost = useAppStore((s) => s.settings.sizeBoost)
  const group = useRef<THREE.Group>(null)

  useFrame(() => {
    if (group.current) group.current.position.copy(runtime.origin).multiplyScalar(-1)
  })

  const orbits = useMemo(() => {
    return BODIES.filter((b) => !b.parent && b.kind !== 'star').map((body) => {
      const raw = orbitPath(body, runtime.jd, body.kind === 'dwarf' ? 320 : 420)
      const scale = orbitScale(body, mode, boost)
      const pts: [number, number, number][] = []
      for (let i = 0; i < raw.length; i += 3) {
        pts.push([raw[i] * scale, raw[i + 1] * scale, raw[i + 2] * scale])
      }
      return { body, pts }
    })
  }, [mode, boost])

  if (!enabled) return null

  return (
    <group ref={group}>
      {orbits.map(({ body, pts }) => {
        const active = selectedId === body.id || focusId === body.id
        return (
          <Line
            key={body.id}
            points={pts}
            color={active ? '#9fe3ff' : body.color}
            lineWidth={active ? 1.6 : 1}
            transparent
            opacity={active ? 0.8 : body.kind === 'dwarf' ? 0.16 : 0.28}
            depthWrite={false}
            frustumCulled={false}
          />
        )
      })}
    </group>
  )
}
