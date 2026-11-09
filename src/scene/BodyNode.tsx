import { useEffect, useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { Line, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { BODY_BY_ID, CHILDREN, type CelestialBody } from '../data/bodies'
import { useAppStore } from '../state/store'
import { AU_KM, J2000, orbitPath } from '../sim/kepler'
import { displayRadius, type DisplayMode } from '../sim/scaling'
import { runtime } from '../sim/runtime'
import { registerBody } from './registry'

const DEG = Math.PI / 180

function useBodyTexture(path: string) {
  const tex = useTexture(`textures/${path}`)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.anisotropy = 8
  tex.wrapS = THREE.RepeatWrapping
  return tex
}

function segmentsFor(body: CelestialBody) {
  switch (body.kind) {
    case 'star':
      return [72, 48]
    case 'planet':
      return body.radiusKm > 20000 ? [72, 48] : [56, 36]
    case 'dwarf':
      return [40, 26]
    default:
      return [32, 20]
  }
}

function Atmosphere({ body }: { body: CelestialBody }) {
  const def = body.atmosphere!
  const material = useMemo(
    () =>
      new THREE.ShaderMaterial({
        uniforms: {
          uColor: { value: new THREE.Color(def.color) },
          uIntensity: { value: def.intensity },
          uPower: { value: def.power ?? 2.8 },
        },
        vertexShader: /* glsl */ `
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            vNormal = normalize(normalMatrix * normal);
            vec4 mv = modelViewMatrix * vec4(position, 1.0);
            vView = -mv.xyz;
            gl_Position = projectionMatrix * mv;
          }
        `,
        fragmentShader: /* glsl */ `
          uniform vec3 uColor;
          uniform float uIntensity;
          uniform float uPower;
          varying vec3 vNormal;
          varying vec3 vView;
          void main() {
            vec3 n = normalize(vNormal);
            vec3 v = normalize(vView);
            float fres = pow(1.0 - abs(dot(n, v)), uPower);
            gl_FragColor = vec4(uColor, fres * uIntensity);
          }
        `,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        side: THREE.BackSide,
      }),
    [def],
  )

  return (
    <mesh scale={def.scale} material={material} renderOrder={3}>
      <sphereGeometry args={[1, 48, 32]} />
    </mesh>
  )
}

function Clouds({ body }: { body: CelestialBody }) {
  const tex = useBodyTexture(body.clouds!)
  const ref = useRef<THREE.Mesh>(null)
  useFrame(() => {
    if (!ref.current) return
    const turns = ((runtime.jd - J2000) / (body.rotationPeriodDays * 1.06)) % 1
    ref.current.rotation.y = turns * Math.PI * 2
  })
  return (
    <mesh ref={ref} scale={1.012} renderOrder={2}>
      <sphereGeometry args={[1, 64, 40]} />
      <meshStandardMaterial
        alphaMap={tex}
        color="#ffffff"
        transparent
        opacity={0.88}
        depthWrite={false}
        roughness={1}
        metalness={0}
      />
    </mesh>
  )
}

function Rings({ body, radius }: { body: CelestialBody; radius: number }) {
  const def = body.rings!
  const texture = useBodyTexture(def.texture)
  const geometry = useMemo(() => {
    const g = new THREE.RingGeometry(def.inner, def.outer, 320, 1)
    const pos = g.attributes.position
    const uv = g.attributes.uv
    const vec = new THREE.Vector3()
    const inner = def.inner
    const outer = def.outer
    for (let i = 0; i < pos.count; i++) {
      vec.fromBufferAttribute(pos as THREE.BufferAttribute, i)
      const r = Math.hypot(vec.x, vec.y)
      const u = THREE.MathUtils.clamp((r - inner) / (outer - inner), 0, 1)
      uv.setXY(i, u, 0.5)
    }
    uv.needsUpdate = true
    g.rotateX(-Math.PI / 2)
    return g
  }, [def.inner, def.outer])

  return (
    <mesh geometry={geometry} renderOrder={1} rotation={[0, 0, 0]}>
      <meshStandardMaterial
        map={texture}
        side={THREE.DoubleSide}
        transparent
        opacity={def.opacity}
        alphaTest={0.005}
        roughness={0.92}
        metalness={0}
        depthWrite={false}
      />
    </mesh>
  )
}

function MoonOrbit({ moon, parent }: { moon: CelestialBody; parent: CelestialBody }) {
  const mode = useAppStore((s) => s.displayMode)
  const boost = useAppStore((s) => s.settings.sizeBoost)
  const selectedId = useAppStore((s) => s.selectedId)
  const focusId = useAppStore((s) => s.focusId)
  const active = selectedId === moon.id || focusId === moon.id || selectedId === parent.id || focusId === parent.id
  const color = selectedId === moon.id ? '#9fe8ff' : moon.color

  const points = useMemo(() => {
    if (!active) return []
    const raw = orbitPath(moon, runtime.jd, 256) // km
    // display units per km for a parent-relative orbit
    const parentDisplayR = displayRadius(parent, mode, boost)
    let unitsPerKm: number
    if (mode === 'true') unitsPerKm = 4000 / AU_KM
    else {
      const ratio = moon.orbital.a / parent.radiusKm
      const orbitUnits = parentDisplayR * Math.max(1.85, 1.55 + 1.5 * Math.log10(Math.max(1.05, ratio)))
      unitsPerKm = orbitUnits / moon.orbital.a
    }
    const pts: [number, number, number][] = []
    for (let i = 0; i < raw.length; i += 3) {
      pts.push([raw[i] * unitsPerKm, raw[i + 1] * unitsPerKm, raw[i + 2] * unitsPerKm])
    }
    return pts
  }, [active, moon, parent, mode, boost])

  if (!active || points.length === 0) return null
  return (
    <Line
      points={points}
      color={color}
      lineWidth={selectedId === moon.id ? 1.4 : 0.9}
      transparent
      opacity={selectedId === moon.id ? 0.7 : 0.26}
      depthWrite={false}
    />
  )
}

export function BodyNode({ body, depth = 0 }: { body: CelestialBody; depth?: number }) {
  const mode = useAppStore((s) => s.displayMode)
  const boost = useAppStore((s) => s.settings.sizeBoost)
  const atmospheres = useAppStore((s) => s.settings.atmospheres)
  const radius = displayRadius(body, mode, boost)
  const texture = useBodyTexture(body.texture ?? '2k_moon.jpg')
  const night = useBodyTexture(body.nightMap ?? '2k_moon.jpg')
  const group = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Mesh>(null)
  const [segW, segH] = segmentsFor(body)
  const moons = CHILDREN.get(body.id) ?? []
  const tilt = body.axialTiltDeg * DEG

  useEffect(() => {
    if (!group.current) return
    return registerBody(body.id, {
      group: group.current,
      spin: spin.current,
      isMoon: !!body.parent,
      parentId: body.parent,
    })
  }, [body.id, body.parent])

  const standard = (
    <meshStandardMaterial
      map={texture}
      roughness={body.kind === 'planet' && body.radiusKm > 20000 ? 0.92 : 0.86}
      metalness={0.02}
      emissiveMap={body.nightMap ? night : undefined}
      emissive={body.nightMap ? new THREE.Color('#ffc987') : undefined}
      emissiveIntensity={body.nightMap ? 0.55 : 0}
    />
  )

  return (
    <group ref={group}>
      <group rotation={[0, 0, tilt]}>
        <group scale={radius}>
          <mesh ref={spin} castShadow receiveShadow>
            <sphereGeometry args={[1, segW, segH]} />
            {standard}
          </mesh>
          {body.clouds && <Clouds body={body} />}
          {body.rings && <Rings body={body} radius={radius} />}
          {body.atmosphere && atmospheres && <Atmosphere body={body} />}
        </group>
      </group>

      {moons.map((moon) => (
        <group key={moon.id}>
          <BodyNode body={moon} depth={depth + 1} />
          <MoonOrbit moon={moon} parent={body} />
        </group>
      ))}
    </group>
  )
}
