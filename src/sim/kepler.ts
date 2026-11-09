import * as THREE from 'three'
import type { CelestialBody, OrbitalElements } from '../data/bodies'

export const J2000 = 2451545.0
export const AU_KM = 149597870.7
export const DEG = Math.PI / 180
const TWO_PI = Math.PI * 2

export function nowJulianDate(): number {
  return Date.now() / 86400000 + 2440587.5
}

export function julianToDate(jd: number): Date {
  return new Date((jd - 2440587.5) * 86400000)
}

/** Solve Kepler's equation M = E - e·sin E with Newton–Raphson. */
export function solveKepler(meanAnomalyRad: number, e: number): number {
  let M = meanAnomalyRad % TWO_PI
  if (M < -Math.PI) M += TWO_PI
  if (M > Math.PI) M -= TWO_PI
  // Danby's starter improves convergence for high eccentricity.
  let E = M + e * Math.sin(M) * (1 + e * Math.cos(M))
  for (let k = 0; k < 12; k++) {
    const f = E - e * Math.sin(E) - M
    const fp = 1 - e * Math.cos(E)
    const d = f / fp
    E -= d
    if (Math.abs(d) < 1e-12) break
  }
  return E
}

interface EclipticElements {
  a: number // AU or km
  e: number
  i: number
  node: number
  argPeri: number
  meanAnomaly: number
}

/**
 * Position in ecliptic coordinates (x toward vernal equinox, z north).
 * Returns AU for heliocentric elements, km for satellite elements.
 */
export function positionFromElements(el: EclipticElements, out = new THREE.Vector3()): THREE.Vector3 {
  const E = solveKepler(el.meanAnomaly * DEG, el.e)
  const cosE = Math.cos(E)
  const sinE = Math.sin(E)
  const xv = el.a * (cosE - el.e)
  const yv = el.a * Math.sqrt(1 - el.e * el.e) * sinE

  const w = el.argPeri * DEG
  const om = el.node * DEG
  const inc = el.i * DEG
  const cw = Math.cos(w)
  const sw = Math.sin(w)
  const co = Math.cos(om)
  const so = Math.sin(om)
  const ci = Math.cos(inc)
  const si = Math.sin(inc)

  const x = (co * cw - so * sw * ci) * xv + (-co * sw - so * cw * ci) * yv
  const y = (so * cw + co * sw * ci) * xv + (-so * sw + co * cw * ci) * yv
  const z = sw * si * xv + cw * si * yv

  // Three.js is Y-up: ecliptic north maps to +Y.
  return out.set(x, z, -y)
}

function elementsAt(body: CelestialBody, jd: number): EclipticElements {
  const el: OrbitalElements = body.orbital
  if (body.parent) {
    const dt = jd - J2000
    const n = 360 / Math.abs(el.periodDays)
    const dir = el.periodDays < 0 ? -1 : 1
    return {
      a: el.a,
      e: el.e,
      i: el.inclination,
      node: el.node,
      argPeri: el.peri,
      meanAnomaly: (el.meanAnomaly ?? 0) + dir * n * dt,
    }
  }

  const T = (jd - J2000) / 36525
  const r = el.rates
  const a = el.a + (r?.a ?? 0) * T
  const e = el.e + (r?.e ?? 0) * T
  const inc = el.inclination + (r?.inclination ?? 0) * T
  const node = el.node + (r?.node ?? 0) * T
  const peri = el.peri + (r?.peri ?? 0) * T
  const L = (el.meanLongitude ?? 0) + (r?.meanLongitude ?? 0) * T
  return {
    a,
    e,
    i: inc,
    node,
    argPeri: peri - node,
    meanAnomaly: L - peri,
  }
}

/** Heliocentric position in AU (real physical scale). */
export function heliocentricPosition(body: CelestialBody, jd: number, out = new THREE.Vector3()): THREE.Vector3 {
  if (body.kind === 'star' || !body.orbital.a) return out.set(0, 0, 0)
  if (body.parent) return out.set(0, 0, 0)
  return positionFromElements(elementsAt(body, jd), out)
}

/** Position relative to parent, in AU (real physical scale). */
export function satellitePosition(body: CelestialBody, jd: number, out = new THREE.Vector3()): THREE.Vector3 {
  const pos = positionFromElements(elementsAt(body, jd), out)
  return pos.multiplyScalar(1 / AU_KM)
}

export function orbitalPeriodDays(body: CelestialBody): number {
  return Math.abs(body.orbital.periodDays)
}

/** Instantaneous heliocentric velocity in km/s via central difference. */
export function heliocentricVelocity(
  body: CelestialBody,
  jd: number,
  parentPos?: THREE.Vector3,
): THREE.Vector3 {
  if (body.kind === 'star') return new THREE.Vector3()
  const h = 0.05 // days
  const a = new THREE.Vector3()
  const b = new THREE.Vector3()
  if (body.parent && parentPos) {
    const p1 = parentPos.clone()
    const p2 = parentPos.clone()
    const v = new THREE.Vector3()
    satellitePosition(body, jd + h, a)
    satellitePosition(body, jd - h, b)
    v.copy(a).sub(b).multiplyScalar(1 / (2 * h))
    // Parent motion is included by caller if desired.
    return v.multiplyScalar(AU_KM / 86400)
  }
  heliocentricPosition(body, jd + h, a)
  heliocentricPosition(body, jd - h, b)
  a.sub(b).multiplyScalar(1 / (2 * h))
  return a.multiplyScalar(AU_KM / 86400)
}

/** Polyline of one full orbit in parent-relative coordinates. */
export function orbitPath(
  body: CelestialBody,
  jd: number,
  segments = 512,
  out?: Float32Array,
): Float32Array {
  const el = elementsAt(body, jd)
  const pts = out ?? new Float32Array((segments + 1) * 3)
  const base = { ...el }
  for (let i = 0; i <= segments; i++) {
    const M = (i / segments) * 360
    const p = positionFromElements({ ...base, meanAnomaly: M })
    pts[i * 3] = p.x
    pts[i * 3 + 1] = p.y
    pts[i * 3 + 2] = p.z
  }
  return pts
}

/** Future arc from the current instant, for trajectory prediction. */
export function futureArc(
  body: CelestialBody,
  jd: number,
  fraction: number,
  segments: number,
  out: Float32Array,
): Float32Array {
  const el = elementsAt(body, jd)
  const baseMean = el.meanAnomaly
  const span = 360 * fraction
  for (let i = 0; i <= segments; i++) {
    const M = baseMean + (i / segments) * span
    const p = positionFromElements({ ...el, meanAnomaly: M })
    out[i * 3] = p.x
    out[i * 3 + 1] = p.y
    out[i * 3 + 2] = p.z
  }
  return out
}

export function hillRadiusKm(body: CelestialBody, parentMassKg?: number): number {
  if (!parentMassKg || !body.orbital.a) return 0
  const aKm = body.parent ? body.orbital.a : body.orbital.a * AU_KM
  return aKm * (1 - body.orbital.e) * Math.cbrt(body.massKg / (3 * parentMassKg))
}
