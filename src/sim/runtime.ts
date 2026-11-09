import * as THREE from 'three'
import { BODY_BY_ID, BODIES, type CelestialBody } from '../data/bodies'
import { AU_KM, nowJulianDate, heliocentricPosition, satellitePosition } from './kepler'
import { displayRadius, orbitScale, satelliteOrbitScale, type DisplayMode } from './scaling'

export interface BodyState {
  id: string
  body: CelestialBody
  /** Heliocentric display coordinates, in scene units. */
  display: THREE.Vector3
  /** Position relative to parent in display units. */
  local: THREE.Vector3
  /** True heliocentric position in AU. */
  realHelio: THREE.Vector3
  velocityAU: THREE.Vector3
  velocityKms: number
  /** Normalized velocity direction in display space. */
  velocityDir: THREE.Vector3
  radius: number
  parent: CelestialBody | null
  /** Distance from the camera in display units. */
  camDistance: number
}

export const runtime = {
  jd: nowJulianDate(),
  startJd: nowJulianDate(),
  mode: 'educational' as DisplayMode,
  boost: 1,
  bodies: new Map<string, BodyState>(),
  origin: new THREE.Vector3(),
  camera: null as THREE.PerspectiveCamera | null,
  frame: 0,
  lastFrameMs: 0,
  fps: 60,
  resetToken: 0,
  freeSpeed: 0,
  fpsHistory: [] as number[],
}

const realScratch = new Map<string, THREE.Vector3>()
const velocityScratch = new THREE.Vector3()

function realHelioAt(body: CelestialBody, jd: number, out: THREE.Vector3): THREE.Vector3 {
  if (body.kind === 'star') return out.set(0, 0, 0)
  if (body.parent) {
    const parent = BODY_BY_ID.get(body.parent)
    if (parent) realHelioAt(parent, jd, out)
    else out.set(0, 0, 0)
    satellitePosition(body, jd, velocityScratch)
    return out.add(velocityScratch)
  }
  return heliocentricPosition(body, jd, out)
}

function computeRealHelio(jd: number, out: Map<string, THREE.Vector3>) {
  for (const body of BODIES) {
    let vec = out.get(body.id)
    if (!vec) {
      vec = new THREE.Vector3()
      out.set(body.id, vec)
    }
    if (body.kind === 'star') {
      vec.set(0, 0, 0)
    } else if (body.parent) {
      const parent = out.get(body.parent) ?? new THREE.Vector3()
      satellitePosition(body, jd, vec).add(parent)
    } else {
      heliocentricPosition(body, jd, vec)
    }
  }
}

export function bodyState(id: string): BodyState | undefined {
  return runtime.bodies.get(id)
}

export function updateSimulation(jd: number, mode: DisplayMode, boost: number): Map<string, BodyState> {
  runtime.jd = jd
  runtime.mode = mode
  runtime.boost = boost
  runtime.frame++

  const real = realScratch
  computeRealHelio(jd, real)

  const before = new THREE.Vector3()
  const after = new THREE.Vector3()

  for (const body of BODIES) {
    let state = runtime.bodies.get(body.id)
    if (!state) {
      state = {
        id: body.id,
        body,
        display: new THREE.Vector3(),
        local: new THREE.Vector3(),
        realHelio: new THREE.Vector3(),
        velocityAU: new THREE.Vector3(),
        velocityKms: 0,
        velocityDir: new THREE.Vector3(),
        radius: 1,
        parent: body.parent ? BODY_BY_ID.get(body.parent) ?? null : null,
        camDistance: 0,
      }
      runtime.bodies.set(body.id, state)
    }
    const r = real.get(body.id)!
    state.realHelio.copy(r)
    state.radius = displayRadius(body, mode, boost)

    if (body.parent) {
      const parentState = runtime.bodies.get(body.parent)!
      state.local.copy(r).sub(parentState.realHelio).multiplyScalar(satelliteOrbitScale(body, parentState.body, mode, boost))
      state.display.copy(parentState.display).add(state.local)
    } else {
      state.display.copy(r).multiplyScalar(orbitScale(body, mode, boost))
      state.local.copy(state.display)
    }

    if (body.kind === 'star') {
      state.velocityAU.set(0, 0, 0)
      state.velocityKms = 0
      state.velocityDir.set(0, 0, 0)
    } else {
      const h = Math.min(0.5, Math.max(0.00002, Math.abs(body.orbital.periodDays) / 10000))
      realHelioAt(body, jd - h, before)
      realHelioAt(body, jd + h, after)
      state.velocityAU.copy(after).sub(before).multiplyScalar(1 / (2 * h)) // AU per day
      state.velocityKms = state.velocityAU.length() * (AU_KM / 86400)
      if (state.velocityAU.lengthSq() > 1e-18) {
        state.velocityDir.copy(state.velocityAU).normalize()
      } else {
        state.velocityDir.set(0, 0, 0)
      }
    }
  }

  // Camera-relative distances (origin from previous frame is fine here).
  const cam = runtime.camera
  if (cam) {
    const cx = cam.position.x + runtime.origin.x
    const cy = cam.position.y + runtime.origin.y
    const cz = cam.position.z + runtime.origin.z
    for (const s of runtime.bodies.values()) {
      s.camDistance = Math.hypot(s.display.x - cx, s.display.y - cy, s.display.z - cz)
    }
  }
  return runtime.bodies
}

export function resetRuntimeClock() {
  runtime.jd = nowJulianDate()
  runtime.startJd = runtime.jd
  runtime.resetToken++
}

/** Display position at an arbitrary epoch (used for analytical trails). */
export function displayPositionAt(
  body: CelestialBody,
  jd: number,
  mode: DisplayMode,
  boost: number,
  out = new THREE.Vector3(),
): THREE.Vector3 {
  if (body.kind === 'star') return out.set(0, 0, 0)
  const real = realHelioAt(body, jd, new THREE.Vector3())
  if (body.parent) {
    const parent = BODY_BY_ID.get(body.parent)
    if (!parent) return out.set(0, 0, 0)
    const parentReal = realHelioAt(parent, jd, new THREE.Vector3())
    displayPositionAt(parent, jd, mode, boost, out)
    const local = real.sub(parentReal)
    return out.add(local.multiplyScalar(satelliteOrbitScale(body, parent, mode, boost)))
  }
  return out.copy(real).multiplyScalar(orbitScale(body, mode, boost))
}

/** Project a heliocentric display position to CSS pixels. */
export function projectToScreen(
  pos: THREE.Vector3,
  camera: THREE.PerspectiveCamera,
  origin: THREE.Vector3,
  width: number,
  height: number,
): { x: number; y: number; depth: number; visible: boolean } {
  const v = new THREE.Vector3(pos.x - origin.x, pos.y - origin.y, pos.z - origin.z)
  v.project(camera)
  const x = (v.x * 0.5 + 0.5) * width
  const y = (-v.y * 0.5 + 0.5) * height
  return {
    x,
    y,
    depth: v.z,
    visible: v.z > -1 && v.z < 1 && x > -50 && x < width + 50 && y > -50 && y < height + 50,
  }
}

export function journalSpeedLabel(speed: number): string {
  if (speed >= 1000) return `${(speed / 1000).toFixed(speed % 1000 === 0 ? 0 : 1)}k×`
  return `${speed.toFixed(speed < 10 ? 1 : 0)}×`
}
