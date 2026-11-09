import { Suspense } from 'react'
import { Canvas } from '@react-three/fiber'
import { Bloom, EffectComposer, Vignette } from '@react-three/postprocessing'
import * as THREE from 'three'
import { BODIES } from '../data/bodies'
import { useAppStore } from '../state/store'
import { SimulationLoop } from './SimulationLoop'
import { SkyBackground, Starfield, Sun } from './Environment'
import { BodyNode } from './BodyNode'
import { OrbitLayer } from './OrbitLayer'
import { HillSpheres, PredictedLayer, TrailLayer, VelocityVectors } from './Dynamics'
import { AsteroidBelt, EclipticGrid, KuiperBelt } from './Belts'
import { CameraInput } from './CameraInput'

function Planets() {
  return (
    <>
      {BODIES.filter((b) => !b.parent && b.kind !== 'star').map((body) => (
        <BodyNode key={body.id} body={body} />
      ))}
    </>
  )
}

function Effects() {
  const enabled = useAppStore((s) => s.settings.postFX)
  if (!enabled) return null
  return (
    <EffectComposer multisampling={0} enableNormalPass={false}>
      <Bloom
        intensity={0.55}
        luminanceThreshold={1.0}
        luminanceSmoothing={0.16}
        mipmapBlur
        radius={0.62}
      />
      <Vignette eskil={false} offset={0.22} darkness={0.62} />
    </EffectComposer>
  )
}

export function Scene() {
  return (
    <Canvas
      dpr={[1, 1.75]}
      shadows
      camera={{ fov: 55, near: 0.0002, far: 3_000_000, position: [0, 320, 700] }}
      gl={{
        antialias: false,
        powerPreference: 'high-performance',
        logarithmicDepthBuffer: true,
        stencil: false,
        alpha: false,
      }}
      onCreated={({ gl, scene }) => {
        gl.toneMapping = THREE.ACESFilmicToneMapping
        gl.toneMappingExposure = 1.06
        gl.outputColorSpace = THREE.SRGBColorSpace
        scene.background = new THREE.Color('#02050b')
      }}
    >
      <Suspense fallback={null}>
        <SkyBackground />
        <Starfield />
        <ambientLight intensity={0.055} color="#93b4d8" />
        <SimulationLoop />
        <Sun />
        <Planets />
        <OrbitLayer />
        <TrailLayer />
        <PredictedLayer />
        <AsteroidBelt />
        <KuiperBelt />
        <EclipticGrid />
        <VelocityVectors />
        <HillSpheres />
        <Effects />
        <CameraInput />
      </Suspense>
    </Canvas>
  )
}
