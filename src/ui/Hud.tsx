import { useEffect, useState } from 'react'
import { useProgress } from '@react-three/drei'
import { runtime } from '../sim/runtime'
import { camState } from '../sim/camera'
import { useAppStore } from '../state/store'
import { speedLabel } from '../lib/format'
import { BODIES } from '../data/bodies'

export function FpsMeter() {
  const [fps, setFps] = useState(60)
  useEffect(() => {
    let raf = 0
    let last = 0
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (t - last < 500) return
      last = t
      setFps(runtime.fps)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [])
  return (
    <div className="fps-chip">
      <span className={fps < 40 ? 'fps-low' : ''}>{fps.toFixed(0)}</span>
      <em>FPS</em>
      <i />
      <span>Kepler Core</span>
    </div>
  )
}

export function FlightHud() {
  const cameraMode = useAppStore((s) => s.cameraMode)
  const locked = useAppStore((s) => s.pointerLocked)
  const [speed, setSpeed] = useState(0)
  const [cruise, setCruise] = useState(26)

  useEffect(() => {
    if (cameraMode !== 'free') return
    let raf = 0
    let last = 0
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (t - last < 100) return
      last = t
      setSpeed(runtime.freeSpeed)
      setCruise(camState.free.cruise)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [cameraMode])

  if (cameraMode !== 'free') return null

  return (
    <>
      <div className={`flight-reticle ${locked ? 'is-locked' : ''}`}>
        <i />
        <i />
        <i />
        <i />
        <b />
      </div>
      <div className={`flight-hud ${locked ? 'is-locked' : ''}`}>
        <div className="flight-mode">
          <span className="pulse-dot" />
          自由飞行 <em>FREE FLIGHT</em>
        </div>
        <div className="flight-stats">
          <div>
            <span>瞬时速度</span>
            <b>{speed.toFixed(2)}</b>
            <i>u/s</i>
          </div>
          <div>
            <span>巡航档位</span>
            <b>{cruise < 1 ? cruise.toFixed(2) : cruise.toFixed(0)}</b>
            <i>u/s</i>
          </div>
        </div>
        <div className="flight-hint">
          {locked ? (
            <>WASD 推进 · Q/E 垂直 · SHIFT 加速 · 滚轮调速 · ESC 释放</>
          ) : (
            <>单击空白区域锁定鼠标 · 拖拽可环视</>
          )}
        </div>
      </div>
    </>
  )
}

export function LoadingScreen() {
  const { progress, active } = useProgress()
  const [hidden, setHidden] = useState(false)
  useEffect(() => {
    if (progress >= 100 && !active) {
      const t = window.setTimeout(() => setHidden(true), 1500)
      return () => window.clearTimeout(t)
    }
  }, [progress, active])
  if (hidden) return null
  const done = progress >= 100 && !active
  return (
    <div className={`boot ${done ? 'is-done' : ''}`}>
      <div className="boot-grid" />
      <div className="boot-inner">
        <div className="boot-brand">ORRERY</div>
        <div className="boot-cn">太阳系天文台</div>
        <div className="boot-sub">KEPLERIAN SOLAR SYSTEM OBSERVATORY</div>
        <div className="boot-progress">
          <i style={{ width: `${progress}%` }} />
        </div>
        <div className="boot-status">
          <span>{done ? '观测系统就绪' : '正在载入星图与行星纹理…'}</span>
          <b>{progress.toFixed(0)}%</b>
        </div>
        <div className="boot-meta">
          <span>JPL 近似轨道根数 · J2000</span>
          <span>{BODIES.length} CELESTIAL BODIES</span>
          <span>KEPLER SOLVER / REAL-TIME</span>
        </div>
      </div>
      <div className="boot-corner tl" />
      <div className="boot-corner tr" />
      <div className="boot-corner bl" />
      <div className="boot-corner br" />
    </div>
  )
}
