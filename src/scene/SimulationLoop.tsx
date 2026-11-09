import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { J2000 } from '../sim/kepler'
import { runtime, updateSimulation } from '../sim/runtime'
import { updateCamera } from '../sim/camera'
import { useAppStore } from '../state/store'
import { BODIES } from '../data/bodies'
import { registry } from './registry'

export function SimulationLoop() {
  const camera = useThree((s) => s.camera) as THREE.PerspectiveCamera
  const gl = useThree((s) => s.gl)

  useFrame((_, rawDelta) => {
    const st = useAppStore.getState()
    const dt = Math.min(rawDelta, 0.08)
    if (st.playing) {
      runtime.jd += (dt * st.speed * st.direction) / 86400
    }

    updateSimulation(runtime.jd, st.displayMode, st.settings.sizeBoost)
    updateCamera(dt, camera)

    const height = gl.domElement.height / gl.getPixelRatio()
    const focal = height / 2 / Math.tan(((camera as THREE.PerspectiveCamera).fov * Math.PI) / 360)

    for (const body of BODIES) {
      const entry = registry.bodies.get(body.id)
      const state = runtime.bodies.get(body.id)
      if (!entry || !state) continue
      if (body.id === 'sun') {
        entry.group.position.copy(runtime.origin).multiplyScalar(-1)
      } else if (body.parent) {
        entry.group.position.copy(state.local)
      } else {
        entry.group.position.copy(state.display).sub(runtime.origin)
      }

      if (entry.spin && body.rotationPeriodDays !== 0) {
        const turns = (runtime.jd - J2000) / body.rotationPeriodDays
        entry.spin.rotation.y = (turns % 1) * Math.PI * 2
      }

      // screen-size based LOD: hide moons that project below ~0.8 px
      if (body.parent) {
        const px = (state.radius / Math.max(state.camDistance, 1e-6)) * focal
        const forced =
          st.selectedId === body.id ||
          st.focusId === body.id ||
          st.hoveredId === body.id ||
          st.focusId === body.parent
        entry.group.visible = px > 0.75 || forced
      }
    }

    // sun corona opacity responds to camera proximity
    if (registry.sunGlow) {
      const sunState = runtime.bodies.get('sun')
      if (sunState) {
        const d = sunState.camDistance / Math.max(sunState.radius, 1e-5)
        const v = THREE.MathUtils.clamp((d - 1.5) / 8, 0.18, 1)
        const mat = (registry.sunGlow as THREE.Sprite).material as THREE.SpriteMaterial
        if (mat) mat.opacity = 0.55 + v * 0.45
      }
    }

    runtime.fps = runtime.fps * 0.92 + (1 / Math.max(rawDelta, 0.0001)) * 0.08
  })

  return null
}
