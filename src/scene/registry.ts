import * as THREE from 'three'

export interface BodyEntry {
  group: THREE.Group
  spin: THREE.Object3D | null
  atmosphere?: THREE.Object3D | null
  isMoon: boolean
  parentId?: string
  baseOpacity?: number
}

export const registry = {
  bodies: new Map<string, BodyEntry>(),
  sunGlow: null as THREE.Object3D | null,
  light: null as THREE.PointLight | null,
  asteroidGroup: null as THREE.Group | null,
  starfield: null as THREE.Object3D | null,
  ecliptic: null as THREE.Group | null,
}

export function registerBody(id: string, entry: BodyEntry): () => void {
  registry.bodies.set(id, entry)
  return () => {
    registry.bodies.delete(id)
  }
}
