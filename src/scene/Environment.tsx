import { useEffect, useMemo, useRef } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import { useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { useAppStore } from '../state/store'
import { displayRadius } from '../sim/scaling'
import { BODY_BY_ID } from '../data/bodies'
import { registerBody, registry } from './registry'

function mulberry32(seed: number) {
  return () => {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function SkyBackground() {
  const stars = useAppStore((s) => s.settings.stars)
  const tex = useTexture('textures/2k_stars_milky_way.jpg')
  const scene = useThree((s) => s.scene)

  useEffect(() => {
    tex.mapping = THREE.EquirectangularReflectionMapping
    tex.colorSpace = THREE.SRGBColorSpace
    tex.needsUpdate = true
    scene.backgroundIntensity = 0.62
    scene.backgroundBlurriness = 0.0
  }, [tex, scene])

  useEffect(() => {
    if (stars) scene.background = tex
    else scene.background = new THREE.Color('#020409')
    return () => {
      scene.background = null
    }
  }, [stars, tex, scene])

  return null
}

export function Starfield() {
  const group = useRef<THREE.Group>(null)
  const camera = useThree((s) => s.camera)
  const gl = useThree((s) => s.gl)
  const stars = useAppStore((s) => s.settings.stars)

  const { geometry, material } = useMemo(() => {
    const rnd = mulberry32(94421)
    const COUNT = 9000
    const positions = new Float32Array(COUNT * 3)
    const colors = new Float32Array(COUNT * 3)
    const sizes = new Float32Array(COUNT)
    const palettes = [
      [0.68, 0.78, 1.0],
      [0.86, 0.9, 1.0],
      [1.0, 0.98, 0.94],
      [1.0, 0.9, 0.76],
      [1.0, 0.78, 0.6],
    ]
    for (let i = 0; i < COUNT; i++) {
      const u = rnd() * 2 - 1
      const phi = rnd() * Math.PI * 2
      const s = Math.sqrt(1 - u * u)
      const r = 1600 + rnd() * 400
      positions[i * 3] = Math.cos(phi) * s * r
      positions[i * 3 + 1] = u * r
      positions[i * 3 + 2] = Math.sin(phi) * s * r
      const c = palettes[Math.floor(rnd() * palettes.length)]
      const intensity = 0.35 + Math.pow(rnd(), 6) * 1.9
      colors[i * 3] = c[0] * intensity
      colors[i * 3 + 1] = c[1] * intensity
      colors[i * 3 + 2] = c[2] * intensity
      sizes[i] = 0.7 + Math.pow(rnd(), 3.2) * 2.6
    }
    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.BufferAttribute(positions, 3))
    geometry.setAttribute('color', new THREE.BufferAttribute(colors, 3))
    geometry.setAttribute('aSize', new THREE.BufferAttribute(sizes, 1))
    const material = new THREE.ShaderMaterial({
      uniforms: { uPixelRatio: { value: Math.min(gl.getPixelRatio(), 2) } },
      vertexShader: /* glsl */ `
        uniform float uPixelRatio;
        attribute float aSize;
        varying vec3 vColor;
        void main() {
          vColor = color;
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          gl_Position = projectionMatrix * mv;
          gl_PointSize = aSize * uPixelRatio;
        }
      `,
      fragmentShader: /* glsl */ `
        varying vec3 vColor;
        void main() {
          vec2 c = gl_PointCoord - vec2(0.5);
          float d = length(c);
          if (d > 0.5) discard;
          float a = smoothstep(0.5, 0.08, d);
          gl_FragColor = vec4(vColor, a);
        }
      `,
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    })
    return { geometry, material }
  }, [gl])

  useEffect(() => {
    ;(material.uniforms.uPixelRatio as { value: number }).value = Math.min(gl.getPixelRatio(), 2)
  }, [gl, material])

  useFrame(() => {
    if (group.current) group.current.position.copy(camera.position)
  })

  if (!stars) return null
  return (
    <group ref={group} renderOrder={-1}>
      <points geometry={geometry} material={material} frustumCulled={false} />
    </group>
  )
}

export function Sun() {
  const mode = useAppStore((s) => s.displayMode)
  const boost = useAppStore((s) => s.settings.sizeBoost)
  const shadows = useAppStore((s) => s.settings.shadows)
  const sun = BODY_BY_ID.get('sun')!
  const radius = displayRadius(sun, mode, boost)
  const texture = useTexture('textures/2k_sun.jpg')
  const group = useRef<THREE.Group>(null)
  const spin = useRef<THREE.Mesh>(null)
  const glowRef = useRef<THREE.Sprite>(null)
  const glowOuterRef = useRef<THREE.Sprite>(null)
  const glowTex = useTexture('textures/glow.png')

  useEffect(() => {
    texture.colorSpace = THREE.SRGBColorSpace
    texture.anisotropy = 8
    glowTex.colorSpace = THREE.SRGBColorSpace
  }, [texture, glowTex])

  useEffect(() => {
    if (!group.current) return
    return registerBody('sun', {
      group: group.current,
      spin: spin.current,
      isMoon: false,
    })
  }, [])

  useEffect(() => {
    registry.sunGlow = glowRef.current
  }, [])

  return (
    <group ref={group}>
      <group scale={radius}>
        <mesh ref={spin}>
          <sphereGeometry args={[1, 72, 48]} />
          <meshBasicMaterial map={texture} color={new THREE.Color(1.95, 1.62, 1.1)} toneMapped={false} />
        </mesh>
        <sprite ref={glowRef} scale={[3.1, 3.1, 1]}>
          <spriteMaterial
            map={glowTex}
            color="#ffd79a"
            transparent
            opacity={0.46}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
        <sprite ref={glowOuterRef} scale={[7.4, 7.4, 1]}>
          <spriteMaterial
            map={glowTex}
            color="#ffb257"
            transparent
            opacity={0.1}
            blending={THREE.AdditiveBlending}
            depthWrite={false}
            toneMapped={false}
          />
        </sprite>
      </group>
      <pointLight
        ref={(el) => {
          registry.light = el
        }}
        color="#fff2dd"
        intensity={2.55}
        decay={0}
        distance={0}
        castShadow={shadows}
        shadow-mapSize-width={1024}
        shadow-mapSize-height={1024}
        shadow-camera-near={0.05}
        shadow-camera-far={mode === 'true' ? 500000 : 6000}
        shadow-bias={-0.0004}
      />
    </group>
  )
}
