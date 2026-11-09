import { useEffect, useRef } from 'react'
import { BODIES } from '../data/bodies'
import { useAppStore } from '../state/store'
import { projectToScreen, runtime } from '../sim/runtime'

interface Rect {
  x: number
  y: number
  w: number
  h: number
}

function overlaps(a: Rect, b: Rect) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y
}

// Rough text metrics: CJK glyphs are ~11 px wide at the label font size,
// Latin glyphs ~4.6 px. Used only for label collision, not layout.
function labelWidth(name: string, en: string) {
  let cjk = 0
  for (const ch of name) if (ch.charCodeAt(0) > 0x2e80) cjk++
  return 5 + 6 + cjk * 11 + (name.length - cjk) * 6 + 5 + en.length * 4.6 + 8
}

export function LabelsOverlay() {
  const labelsOn = useAppStore((s) => s.settings.labels)
  const markersOn = useAppStore((s) => s.settings.markers)
  const selectedId = useAppStore((s) => s.selectedId)
  const hoveredId = useAppStore((s) => s.hoveredId)
  const cameraMode = useAppStore((s) => s.cameraMode)
  const layer = useRef<HTMLDivElement>(null)
  const refs = useRef(new Map<string, HTMLButtonElement>())
  const reticle = useRef<HTMLDivElement>(null)

  useEffect(() => {
    let raf = 0
    let last = 0
    const loop = (t: number) => {
      raf = requestAnimationFrame(loop)
      if (t - last < 30) return
      last = t
      const cam = runtime.camera
      if (!cam) return
      const w = window.innerWidth
      const h = window.innerHeight
      const st = useAppStore.getState()
      const focal = h / 2 / Math.tan((cam.fov * Math.PI) / 360)
      const placed: Rect[] = []

      interface Candidate {
        bodyId: string
        name: string
        en: string
        x: number
        y: number
        px: number
        isSel: boolean
        isHover: boolean
        showDot: boolean
        showLabel: boolean
        priority: number
        width: number
      }

      const candidates: Candidate[] = []

      for (const body of BODIES) {
        const el = refs.current.get(body.id)
        if (!el) continue
        const s = runtime.bodies.get(body.id)
        if (!s) {
          el.style.display = 'none'
          continue
        }
        const px = (s.radius / Math.max(s.camDistance, 1e-9)) * focal
        const isSel = st.selectedId === body.id
        const isHover = st.hoveredId === body.id
        const relevant =
          isSel ||
          isHover ||
          st.focusId === body.id ||
          st.selectedId === body.parent ||
          st.focusId === body.parent

        // Moon labels are noise at system scale; only reveal them once the
        // satellite system is large enough on screen (or it is the subject).
        const gate = body.kind === 'dwarf' ? 2.2 : body.kind === 'star' ? 0 : 1.2
        const dotGate = body.kind === 'moon' ? 9 : 0.7
        const showDot = markersOn && (relevant || px >= dotGate)
        const showLabel = labelsOn && (relevant || (body.kind !== 'moon' && px >= gate))

        if (!showDot && !showLabel) {
          el.style.display = 'none'
          continue
        }

        const p = projectToScreen(s.display, cam, runtime.origin, w, h)
        if (!p.visible) {
          el.style.display = 'none'
          continue
        }

        const priority = isSel ? 0 : isHover ? 1 : st.focusId === body.id ? 2 : body.kind === 'moon' ? 5 : body.kind === 'dwarf' ? 4 : 3

        candidates.push({
          bodyId: body.id,
          name: body.name,
          en: body.nameEn,
          x: p.x,
          y: p.y,
          px,
          isSel,
          isHover,
          showDot,
          showLabel,
          priority,
          width: labelWidth(body.name, body.nameEn),
        })
      }

      candidates.sort((a, b) => a.priority - b.priority || b.px - a.px)

      for (const c of candidates) {
        const el = refs.current.get(c.bodyId)
        if (!el) continue
        let label = c.showLabel
        const rect: Rect = { x: c.x - 2, y: c.y - 8, w: c.width, h: 17 }
        if (label && !c.isSel && !c.isHover) {
          if (placed.some((r) => overlaps(rect, r))) label = false
        }
        if (label) placed.push(rect)

        if (!label && !c.showDot) {
          el.style.display = 'none'
          continue
        }

        el.style.display = 'flex'
        el.style.transform = `translate3d(${c.x.toFixed(1)}px, ${c.y.toFixed(1)}px, 0)`
        el.style.zIndex = c.isSel ? '860' : c.isHover ? '855' : '800'
        el.classList.toggle('is-selected', c.isSel)
        el.classList.toggle('is-hovered', c.isHover)
        el.classList.toggle('dot-only', !label)
        el.dataset.px = c.px.toFixed(2)

        if (c.isSel && reticle.current) {
          const size = Math.max(30, Math.min(120, c.px * 2.6 + 22))
          reticle.current.style.display = 'block'
          reticle.current.style.transform = `translate3d(${c.x}px, ${c.y}px, 0)`
          reticle.current.style.width = `${size}px`
          reticle.current.style.height = `${size}px`
          reticle.current.style.marginLeft = `${-size / 2}px`
          reticle.current.style.marginTop = `${-size / 2}px`
          reticle.current.style.zIndex = '850'
        }
      }

      if (reticle.current && !st.selectedId) reticle.current.style.display = 'none'
      if (reticle.current && st.selectedId) {
        const s = runtime.bodies.get(st.selectedId)
        if (!s) reticle.current.style.display = 'none'
        else {
          const p = projectToScreen(s.display, cam, runtime.origin, w, h)
          if (!p.visible) reticle.current.style.display = 'none'
        }
      }
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [labelsOn, markersOn])

  return (
    <div className={`labels-layer ${cameraMode === 'free' ? 'is-free' : ''}`} ref={layer}>
      {BODIES.map((body) => (
        <button
          key={body.id}
          ref={(el) => {
            if (el) refs.current.set(body.id, el)
            else refs.current.delete(body.id)
          }}
          className={`body-label ${selectedId === body.id ? 'is-selected' : ''} ${
            hoveredId === body.id ? 'is-hovered' : ''
          }`}
          style={{ display: 'none' }}
          onPointerEnter={() => useAppStore.getState().setHovered(body.id)}
          onPointerLeave={() => useAppStore.getState().setHovered(null)}
          onClick={(e) => {
            e.stopPropagation()
            useAppStore.getState().select(body.id, true)
          }}
        >
          <span className="body-label-dot" style={{ '--dot': body.color } as React.CSSProperties} />
          <span className="body-label-text">
            <span className="body-label-name">{body.name}</span>
            <span className="body-label-en">{body.nameEn}</span>
          </span>
        </button>
      ))}
      <div className="reticle" ref={reticle} style={{ display: 'none' }}>
        <i className="r tl" />
        <i className="r tr" />
        <i className="r bl" />
        <i className="r br" />
      </div>
    </div>
  )
}
