import * as THREE from 'three'
import { BODY_BY_ID } from '../data/bodies'
import { useAppStore } from '../state/store'
import { OVERVIEW_DISTANCE, type DisplayMode } from './scaling'
import { runtime } from './runtime'

type CameraMode = 'orbit' | 'free'

export interface FreeFlight {
  pos: THREE.Vector3
  yaw: number
  pitch: number
  velocity: THREE.Vector3
  cruise: number
}

const transition = {
  active: false,
  t: 0,
  dur: 1.7,
  from: new THREE.Vector3(),
  startTarget: new THREE.Vector3(),
  endDistance: 0,
  startDistance: 0,
  yaw: 0,
  pitch: 0,
  focusId: 'sun',
}

export const camState = {
  initialized: false,
  mode: 'orbit' as CameraMode,
  target: new THREE.Vector3(),
  worldPos: new THREE.Vector3(),
  yaw: 0.85,
  pitch: 0.46,
  distance: OVERVIEW_DISTANCE.educational,
  distanceTarget: OVERVIEW_DISTANCE.educational,
  follow: true,
  focusId: 'sun',
  minDistance: 0.0004,
  free: {
    pos: new THREE.Vector3(),
    yaw: 0,
    pitch: 0,
    velocity: new THREE.Vector3(),
    cruise: 24,
  } as FreeFlight,
  lastMode: 'orbit' as CameraMode,
  lastFocusNonce: -1,
  lastOverviewNonce: -1,
  lastDisplayMode: 'educational' as DisplayMode,
  lastBoost: 1,
  pendingFocus: '',
  transition,
}

export const input = {
  keys: new Set<string>(),
  dragging: false,
  lastX: 0,
  lastY: 0,
  pointerLocked: false,
  moved: 0,
  downX: 0,
  downY: 0,
  wheel: 0,
}

export function focusDistance(id: string, mode: DisplayMode, boost: number): number {
  const body = BODY_BY_ID.get(id)
  if (!body) return OVERVIEW_DISTANCE[mode]
  const r = body.radiusKm
  const factor =
    body.kind === 'star' ? 3.1 : body.kind === 'planet' ? 6.2 : body.kind === 'dwarf' ? 6.5 : 7.5
  const displayR = (r / 149597870.7) * 4000 * (mode === 'true' ? boost : 1)
  if (mode === 'true') return Math.max(displayR * factor, 0.0012)
  const base =
    body.kind === 'star'
      ? 34
      : body.kind === 'planet'
        ? 13.5 * Math.sqrt(r / 6371)
        : body.kind === 'dwarf'
          ? 5.2 * Math.pow(r / 1188, 0.55)
          : Math.max(0.62, 4.4 * Math.pow(r / 1737.4, 0.6))
  return Math.max(base * factor, 0.6)
}

function sphericalOffset(distance: number, yaw: number, pitch: number, out: THREE.Vector3) {
  const cp = Math.cos(pitch)
  return out.set(distance * cp * Math.sin(yaw), distance * Math.sin(pitch), distance * cp * Math.cos(yaw))
}

export function beginFocus(id: string, dur = 1.7) {
  if (!camState.initialized) return
  const body = BODY_BY_ID.get(id)
  if (!body) return
  const state = useAppStore.getState()
  const target = runtime.bodies.get(id)?.display.clone() ?? new THREE.Vector3()
  const mode = state.displayMode
  const boost = state.settings.sizeBoost
  const endDistance = focusDistance(id, mode, boost)
  transition.active = true
  transition.t = 0
  transition.dur = dur
  transition.from.copy(camState.worldPos)
  transition.startTarget.copy(camState.target)
  transition.endDistance = endDistance
  transition.startDistance = camState.distance
  transition.yaw = camState.yaw
  transition.pitch = camState.pitch
  transition.focusId = id
  camState.focusId = id
  camState.distanceTarget = endDistance
  camState.minDistance = Math.max(0.0004, (runtime.bodies.get(id)?.radius ?? 1) * 1.06)
  camState.target.copy(target)
}

function switchMode(mode: CameraMode) {
  const st = useAppStore.getState()
  if (mode === 'free') {
    const free = camState.free
    free.pos.copy(camState.worldPos)
    free.yaw = camState.yaw
    free.pitch = -camState.pitch
    free.velocity.set(0, 0, 0)
    free.cruise = st.displayMode === 'true' ? 900 : 26
    camState.pitch = THREE.MathUtils.clamp(camState.pitch, -1.45, 1.45)
  } else {
    const focusId = st.focusId
    const target = runtime.bodies.get(focusId)?.display.clone()
    if (target) {
      const offset = camState.worldPos.clone().sub(target)
      const r = Math.max(offset.length(), 0.0004)
      camState.distance = r
      camState.distanceTarget = r
      camState.yaw = Math.atan2(offset.x, offset.z)
      camState.pitch = Math.asin(THREE.MathUtils.clamp(offset.y / r, -1, 1))
      camState.target.copy(target)
      camState.focusId = focusId
      camState.minDistance = Math.max(0.0004, (runtime.bodies.get(focusId)?.radius ?? 1) * 1.06)
    }
    transition.active = false
  }
  camState.mode = mode
}

export function updateCamera(dt: number, camera: THREE.PerspectiveCamera) {
  const state = useAppStore.getState()
  const mode = state.displayMode
  const boost = state.settings.sizeBoost
  const bodies = runtime.bodies
  const focusBody = BODY_BY_ID.get(state.focusId)
  const focusState = bodies.get(state.focusId)

  // ── first frame ─────────────────────────────────────────────────────────
  if (!camState.initialized) {
    camState.initialized = true
    camState.mode = state.cameraMode
    camState.focusId = state.focusId
    camState.target.copy(focusState?.display ?? new THREE.Vector3())
    camState.distance = OVERVIEW_DISTANCE[mode]
    camState.distanceTarget = camState.distance
    camState.yaw = 0.85
    camState.pitch = 0.46
    sphericalOffset(camState.distance, camState.yaw, camState.pitch, camState.worldPos).add(camState.target)
    camState.lastMode = state.cameraMode
    camState.lastFocusNonce = state.focusNonce
    camState.lastOverviewNonce = state.overviewNonce
    camState.lastDisplayMode = mode
    runtime.origin.set(0, 0, 0)
  }

  // ── mode change ──────────────────────────────────────────────────────────
  if (state.cameraMode !== camState.mode) switchMode(state.cameraMode)

  // ── display scale change ─────────────────────────────────────────────────
  if (mode !== camState.lastDisplayMode) {
    const oldOverview = OVERVIEW_DISTANCE[camState.lastDisplayMode]
    const newOverview = OVERVIEW_DISTANCE[mode]
    if (camState.distance < oldOverview * 0.55) {
      // Close to a body: keep the subject framed instead of scaling the
      // overview distance, which would hurl the camera into deep space.
      const oldFocus = focusDistance(state.focusId, camState.lastDisplayMode, boost)
      const newFocus = focusDistance(state.focusId, mode, boost)
      const framing = THREE.MathUtils.clamp(camState.distance / Math.max(oldFocus, 1e-9), 0.45, 2.4)
      camState.distance = newFocus * framing
      camState.distanceTarget = newFocus * framing
      transition.active = false
    } else {
      const ratio = newOverview / oldOverview
      camState.distance *= ratio
      camState.distanceTarget *= ratio
      if (transition.active) {
        transition.startDistance *= ratio
        transition.endDistance *= ratio
      }
    }
    camState.lastDisplayMode = mode
    runtime.resetToken++
  }

  if (boost !== camState.lastBoost) {
    camState.lastBoost = boost
    runtime.resetToken++
  }

  // ── overview request ────────────────────────────────────────────────────
  if (state.overviewNonce !== camState.lastOverviewNonce) {
    camState.lastOverviewNonce = state.overviewNonce
    const overview = OVERVIEW_DISTANCE[mode]
    transition.active = true
    transition.t = 0
    transition.dur = 1.6
    transition.from.copy(camState.worldPos)
    transition.startTarget.copy(camState.target)
    transition.endDistance = overview
    transition.startDistance = camState.distance
    transition.yaw = 0.85
    transition.pitch = 0.46
    transition.focusId = 'sun'
    camState.focusId = 'sun'
    camState.distanceTarget = overview
    camState.minDistance = (bodies.get('sun')?.radius ?? 1) * 1.1
    camState.target.copy(bodies.get('sun')?.display ?? new THREE.Vector3())
  } else if (state.focusNonce !== camState.lastFocusNonce) {
    camState.lastFocusNonce = state.focusNonce
    if (state.cameraMode === 'orbit') beginFocus(state.focusId)
  }

  if (!camState.follow && !transition.active && state.follow) camState.follow = true
  camState.follow = state.follow

  const desiredTarget = focusState?.display ?? new THREE.Vector3()
  const focusRadius = focusState?.radius ?? 1
  camState.minDistance = Math.max(0.0004, focusRadius * (focusBody?.kind === 'star' ? 1.35 : 1.06))

  // ── orbit mode ───────────────────────────────────────────────────────────
  if (camState.mode === 'orbit') {
    const offset = new THREE.Vector3()

    if (transition.active) {
      transition.t = Math.min(1, transition.t + dt / transition.dur)
      const k = transition.t * transition.t * (3 - 2 * transition.t)
      camState.target.lerpVectors(transition.startTarget, desiredTarget, k)
      const endDist = transition.endDistance
      const dist = THREE.MathUtils.lerp(transition.startDistance, endDist, k)
      sphericalOffset(dist, transition.yaw, transition.pitch, offset).add(camState.target)
      camState.worldPos.lerpVectors(transition.from, offset, k)
      camState.distance = dist
      camState.distanceTarget = endDist
      camState.yaw = transition.yaw
      camState.pitch = transition.pitch
      if (transition.t >= 1) {
        transition.active = false
        camState.target.copy(desiredTarget)
        camState.worldPos.copy(offset)
      }
    } else {
      if (camState.follow) camState.target.copy(desiredTarget)
      camState.distanceTarget = THREE.MathUtils.clamp(camState.distanceTarget, camState.minDistance, 620000)
      camState.distance += (camState.distanceTarget - camState.distance) * (1 - Math.exp(-dt * 7))
      sphericalOffset(camState.distance, camState.yaw, camState.pitch, offset)
      camState.worldPos.copy(camState.target).add(offset)

      // let the target continue to track a moving body even when idle
      if (camState.follow) camState.target.lerp(desiredTarget, 1 - Math.exp(-dt * 30))
    }
  } else {
    // ── free flight ─────────────────────────────────────────────────────────
    const free = camState.free
    if (input.wheel !== 0) {
      free.cruise = THREE.MathUtils.clamp(free.cruise * Math.exp(-input.wheel * 0.0014), 0.05, 60000)
      input.wheel = 0
    }

    const forward = new THREE.Vector3(
      -Math.sin(free.yaw) * Math.cos(free.pitch),
      Math.sin(free.pitch),
      -Math.cos(free.yaw) * Math.cos(free.pitch),
    )
    const right = new THREE.Vector3(Math.cos(free.yaw), 0, -Math.sin(free.yaw))
    const accelerate = new THREE.Vector3()
    if (input.keys.has('KeyW') || input.keys.has('ArrowUp')) accelerate.add(forward)
    if (input.keys.has('KeyS') || input.keys.has('ArrowDown')) accelerate.sub(forward)
    if (input.keys.has('KeyD') || input.keys.has('ArrowRight')) accelerate.add(right)
    if (input.keys.has('KeyA') || input.keys.has('ArrowLeft')) accelerate.sub(right)
    if (input.keys.has('KeyE') || input.keys.has('PageUp')) accelerate.y += 1
    if (input.keys.has('KeyQ') || input.keys.has('PageDown')) accelerate.y -= 1

    const boostFactor = input.keys.has('ShiftLeft') || input.keys.has('ShiftRight') ? 4 : 1
    const slowFactor = input.keys.has('AltLeft') ? 0.18 : 1
    if (accelerate.lengthSq() > 0) {
      accelerate.normalize().multiplyScalar(free.cruise * 2.8 * boostFactor * slowFactor)
      free.velocity.addScaledVector(accelerate, dt)
    }
    const damp = Math.exp(-dt * 1.45)
    free.velocity.multiplyScalar(damp)
    const cap = free.cruise * boostFactor * 3.2
    if (free.velocity.length() > cap) free.velocity.setLength(cap)
    free.pos.addScaledVector(free.velocity, dt)
    free.pos.x = THREE.MathUtils.clamp(free.pos.x, -1.2e6, 1.2e6)
    free.pos.y = THREE.MathUtils.clamp(free.pos.y, -1.2e6, 1.2e6)
    free.pos.z = THREE.MathUtils.clamp(free.pos.z, -1.2e6, 1.2e6)
    camState.worldPos.copy(free.pos)
    camState.target.copy(free.pos).addScaledVector(forward, 10)
    runtime.freeSpeed = free.velocity.length()
  }

  // ── floating origin ─────────────────────────────────────────────────────
  const rebaseThreshold = mode === 'true' ? 4200 : 4.2e6
  if (camState.worldPos.distanceToSquared(runtime.origin) > rebaseThreshold * rebaseThreshold) {
    runtime.origin.copy(camState.worldPos)
  }

  camera.position.copy(camState.worldPos).sub(runtime.origin)
  camera.up.set(0, 1, 0)
  if (camState.mode === 'orbit') {
    camera.lookAt(camState.target.x - runtime.origin.x, camState.target.y - runtime.origin.y, camState.target.z - runtime.origin.z)
  } else {
    camera.rotation.order = 'YXZ'
    camera.rotation.set(camState.free.pitch, camState.free.yaw, 0)
    runtime.freeSpeed = camState.free.velocity.length()
  }
  camera.near = 0.0002
  camera.far = 3_000_000
  camera.updateProjectionMatrix()
  runtime.camera = camera
}

export function nudgeZoom(factor: number) {
  if (camState.mode !== 'orbit') return
  camState.distanceTarget = THREE.MathUtils.clamp(
    camState.distanceTarget * factor,
    camState.minDistance,
    620000,
  )
}

export function resetCameraState() {
  camState.lastFocusNonce = -1
  camState.lastOverviewNonce = -1
}
