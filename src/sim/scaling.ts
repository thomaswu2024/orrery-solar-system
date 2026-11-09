import type { CelestialBody } from '../data/bodies'
import { AU_KM } from './kepler'

export type DisplayMode = 'true' | 'educational'

/** Scene units per astronomical unit in true-scale mode. */
export const AU_UNITS = 4000
export const OVERVIEW_DISTANCE: Record<DisplayMode, number> = {
  true: 300000,
  educational: 780,
}
export const MIN_NEAR = 0.002
export const MAX_FAR = 2_000_000

/**
 * Educational mode compresses heliocentric distance with a logarithmic
 * transfer function while preserving each orbit's eccentricity and
 * inclination. Relative ordering and perihelion/aphelion ratios survive.
 */
export function eduDistanceAU(aAU: number): number {
  return 62 + 118 * Math.log10(1 + 9 * aAU)
}

export function isSatellite(body: CelestialBody): boolean {
  return !!body.parent
}

export function displayRadius(body: CelestialBody, mode: DisplayMode, boost = 1): number {
  if (mode === 'true') {
    return (body.radiusKm / AU_KM) * AU_UNITS * boost
  }
  let r: number
  switch (body.kind) {
    case 'star':
      r = 34
      break
    case 'planet':
      r = 13.5 * Math.sqrt(body.radiusKm / 6371)
      break
    case 'dwarf':
      r = 5.2 * Math.pow(body.radiusKm / 1188, 0.55)
      break
    default:
      r = 4.4 * Math.pow(body.radiusKm / 1737.4, 0.6)
  }
  return Math.max(0.62, r) * boost
}

export function eduMoonOrbitDistance(body: CelestialBody, parent: CelestialBody, boost = 1): number {
  const parentR = displayRadius(parent, 'educational', boost)
  const ratio = body.orbital.a / parent.radiusKm
  return parentR * Math.max(1.85, 1.55 + 1.5 * Math.log10(Math.max(1.05, ratio)))
}

/**
 * Multiplier applied to a real position vector (AU) to get display units.
 * For satellites this scales parent-relative position.
 */
export function orbitScale(body: CelestialBody, mode: DisplayMode, boost = 1): number {
  if (mode === 'true') return AU_UNITS
  if (body.parent) {
    return 1
  }
  if (body.kind === 'star') return 1
  return eduDistanceAU(body.orbital.a) / body.orbital.a
}

export function satelliteOrbitScale(body: CelestialBody, parent: CelestialBody, mode: DisplayMode, boost = 1): number {
  if (mode === 'true') return AU_UNITS
  const targetUnits = eduMoonOrbitDistance(body, parent, boost)
  const aAU = body.orbital.a / AU_KM
  return targetUnits / aAU
}

export function satelliteDisplayOffset(
  body: CelestialBody,
  parent: CelestialBody,
  mode: DisplayMode,
  boost = 1,
): number {
  return satelliteOrbitScale(body, parent, mode, boost)
}

export function scaleByMode(valueAU: number, mode: DisplayMode): number {
  return mode === 'true' ? valueAU * AU_UNITS : eduDistanceAU(valueAU)
}
