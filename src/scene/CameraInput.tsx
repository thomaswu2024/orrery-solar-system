import { useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import { BODIES } from '../data/bodies'
import { useAppStore } from '../state/store'
import { input, nudgeZoom, camState } from '../sim/camera'
import { projectToScreen, runtime } from '../sim/runtime'

const PICK_RADIUS = 26

function pickBody(clientX: number, clientY: number, el: HTMLCanvasElement): string | null {
  const camera = runtime.camera
  if (!camera) return null
  const rect = el.getBoundingClientRect()
  const x = clientX - rect.left
  const y = clientY - rect.top
  const st = useAppStore.getState()
  let best: string | null = null
  let bestScore = Infinity
  for (const body of BODIES) {
    const state = runtime.bodies.get(body.id)
    if (!state) continue
    if (body.parent) {
      const parentId = body.parent
      const inSystem =
        st.selectedId === body.id ||
        st.focusId === body.id ||
        st.selectedId === parentId ||
        st.focusId === parentId
      const focal = rect.height / 2 / Math.tan(((camera.fov * Math.PI) / 360))
      const px = (state.radius / Math.max(state.camDistance, 1e-9)) * focal
      if (px < 0.35 && !inSystem) continue
    }
    const p = projectToScreen(state.display, camera, runtime.origin, rect.width, rect.height)
    if (!p.visible) continue
    const dx = p.x - x
    const dy = p.y - y
    const dist = Math.hypot(dx, dy)
    if (dist > PICK_RADIUS) continue
    const angular = (state.radius / Math.max(state.camDistance, 1e-9)) * rect.height
    const score = dist - Math.min(14, angular * 0.6)
    if (score < bestScore) {
      bestScore = score
      best = body.id
    }
  }
  return best
}

export function CameraInput() {
  const gl = useThree((s) => s.gl)

  useEffect(() => {
    const el = gl.domElement
    el.style.touchAction = 'none'

    const setHover = (id: string | null) => {
      const st = useAppStore.getState()
      if (st.hoveredId !== id) st.setHovered(id)
      const mode = st.cameraMode
      el.style.cursor = id ? 'pointer' : input.dragging ? 'grabbing' : mode === 'free' ? 'crosshair' : 'grab'
    }

    const onPointerDown = (e: PointerEvent) => {
      if (e.button !== 0) return
      input.dragging = true
      input.moved = 0
      input.downX = e.clientX
      input.downY = e.clientY
      input.lastX = e.clientX
      input.lastY = e.clientY
      el.style.cursor = 'grabbing'
      try {
        el.setPointerCapture(e.pointerId)
      } catch {
        /* noop */
      }
      const st = useAppStore.getState()
      if (st.cameraMode === 'free' && !document.pointerLockElement) {
        const hit = pickBody(e.clientX, e.clientY, el)
        if (!hit) {
          const result = el.requestPointerLock()
          if (result && typeof (result as Promise<void>).catch === 'function') {
            ;(result as unknown as Promise<void>).catch(() => {})
          }
        }
      }
    }

    const onPointerMove = (e: PointerEvent) => {
      const dx = e.clientX - input.lastX
      const dy = e.clientY - input.lastY
      input.lastX = e.clientX
      input.lastY = e.clientY
      const st = useAppStore.getState()

      if (document.pointerLockElement === el && st.cameraMode === 'free') {
        camState.free.yaw -= e.movementX * 0.0022
        camState.free.pitch = Math.max(
          -1.52,
          Math.min(1.52, camState.free.pitch - e.movementY * 0.0022),
        )
        setHover(null)
        return
      }

      if (input.dragging) {
        input.moved += Math.abs(dx) + Math.abs(dy)
        if (st.cameraMode === 'orbit') {
          camState.yaw -= dx * 0.0042
          camState.pitch = Math.max(-1.45, Math.min(1.45, camState.pitch + dy * 0.0042))
        } else {
          camState.free.yaw -= dx * 0.003
          camState.free.pitch = Math.max(
            -1.52,
            Math.min(1.52, camState.free.pitch - dy * 0.003),
          )
        }
      } else {
        const hit = pickBody(e.clientX, e.clientY, el)
        setHover(hit)
      }
    }

    const onPointerUp = (e: PointerEvent) => {
      if (e.button !== 0) return
      const dragged = input.moved > 7
      input.dragging = false
      try {
        el.releasePointerCapture(e.pointerId)
      } catch {
        /* noop */
      }
      const st = useAppStore.getState()
      if (!dragged) {
        if (document.pointerLockElement === el) {
          el.style.cursor = 'crosshair'
          return
        }
        const hit = pickBody(e.clientX, e.clientY, el)
        if (hit) {
          st.select(hit, true)
          setHover(hit)
        } else {
          st.select(null)
          setHover(null)
        }
      }
      el.style.cursor = st.cameraMode === 'free' ? 'crosshair' : 'grab'
    }

    const onWheel = (e: WheelEvent) => {
      e.preventDefault()
      const st = useAppStore.getState()
      if (st.cameraMode === 'orbit') {
        nudgeZoom(Math.exp(e.deltaY * 0.0011))
      } else {
        input.wheel += e.deltaY
      }
    }

    const onDoubleClick = (e: MouseEvent) => {
      const hit = pickBody(e.clientX, e.clientY, el)
      if (!hit) return
      const st = useAppStore.getState()
      st.select(hit, true)
      const body = BODIES.find((b) => b.id === hit)
      if (body && st.cameraMode === 'orbit') {
        // tight follow-up zoom after the focus transition starts
        window.setTimeout(() => {
          if (camState.mode !== 'orbit') return
          camState.distanceTarget = Math.max(camState.minDistance, camState.distanceTarget * 0.42)
          if (camState.transition.active) camState.transition.endDistance = camState.distanceTarget
        }, 90)
      }
    }

    const onContextMenu = (e: Event) => e.preventDefault()
    const onLockChange = () => {
      const locked = document.pointerLockElement === el
      input.pointerLocked = locked
      useAppStore.getState().setPointerLocked(locked)
    }
    const onKeyDown = (e: KeyboardEvent) => {
      const tag = (e.target as HTMLElement)?.tagName
      if (tag === 'INPUT' || tag === 'TEXTAREA') return
      if (['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyQ', 'KeyE', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'ShiftLeft', 'ShiftRight'].includes(e.code)) {
        input.keys.add(e.code)
      }
    }
    const onKeyUp = (e: KeyboardEvent) => {
      input.keys.delete(e.code)
    }
    const onBlur = () => input.keys.clear()

    el.addEventListener('pointerdown', onPointerDown)
    el.addEventListener('pointermove', onPointerMove)
    el.addEventListener('pointerup', onPointerUp)
    el.addEventListener('pointercancel', onPointerUp)
    el.addEventListener('wheel', onWheel, { passive: false })
    el.addEventListener('dblclick', onDoubleClick)
    el.addEventListener('contextmenu', onContextMenu)
    window.addEventListener('keydown', onKeyDown)
    window.addEventListener('keyup', onKeyUp)
    window.addEventListener('blur', onBlur)
    document.addEventListener('pointerlockchange', onLockChange)

    return () => {
      el.removeEventListener('pointerdown', onPointerDown)
      el.removeEventListener('pointermove', onPointerMove)
      el.removeEventListener('pointerup', onPointerUp)
      el.removeEventListener('pointercancel', onPointerUp)
      el.removeEventListener('wheel', onWheel)
      el.removeEventListener('dblclick', onDoubleClick)
      el.removeEventListener('contextmenu', onContextMenu)
      window.removeEventListener('keydown', onKeyDown)
      window.removeEventListener('keyup', onKeyUp)
      window.removeEventListener('blur', onBlur)
      document.removeEventListener('pointerlockchange', onLockChange)
    }
  }, [gl])

  return null
}
