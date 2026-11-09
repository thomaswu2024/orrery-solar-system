import { useEffect, useState } from 'react'
import { BODIES, BODY_BY_ID, CHILDREN, type CelestialBody } from '../data/bodies'
import { AU_KM, orbitalPeriodDays } from '../sim/kepler'
import { runtime } from '../sim/runtime'
import { useAppStore } from '../state/store'
import {
  earthMasses,
  earthRadii,
  fmt,
  formatPeriod,
  formatRotation,
  formatTemp,
  kindLabel,
  sci,
} from '../lib/format'

interface Live {
  sunAU: number
  speed: number
  earthAU: number
  parentKm: number
}

function useLive(id: string | null): Live {
  const [live, setLive] = useState<Live>({ sunAU: 0, speed: 0, earthAU: 0, parentKm: 0 })
  useEffect(() => {
    if (!id) return
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (t - last < 180) return
      last = t
      const s = runtime.bodies.get(id)
      const e = runtime.bodies.get('earth')
      if (!s) return
      const parent = s.body.parent ? runtime.bodies.get(s.body.parent) : null
      setLive({
        sunAU: s.realHelio.length(),
        speed: s.velocityKms,
        earthAU: e ? s.realHelio.distanceTo(e.realHelio) : 0,
        parentKm: parent ? s.realHelio.distanceTo(parent.realHelio) * AU_KM : 0,
      })
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [id])
  return live
}

function DataRow({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="data-row">
      <span className="data-label">{label}</span>
      <span className="data-value">
        {value}
        {sub && <em>{sub}</em>}
      </span>
    </div>
  )
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="info-section">
      <div className="info-section-head">
        <h4>{title}</h4>
        <span />
      </div>
      {children}
    </section>
  )
}

export function InfoPanel() {
  const selectedId = useAppStore((s) => s.selectedId)
  const cameraMode = useAppStore((s) => s.cameraMode)
  const follow = useAppStore((s) => s.follow)
  const setCameraMode = useAppStore((s) => s.setCameraMode)
  const select = useAppStore((s) => s.select)
  const setFollow = useAppStore((s) => s.setFollow)
  const setFocus = useAppStore((s) => s.setFocus)
  const live = useLive(selectedId)

  const body = selectedId ? BODY_BY_ID.get(selectedId) : null

  if (!body) {
    return (
      <aside className="panel info-panel is-empty">
        <div className="info-empty">
          <div className="empty-glyph">◎</div>
          <h3>未选择天体</h3>
          <p>单击场景中的天体标记，或从左侧目录中选择，以查看轨道根数与物理参数。</p>
        </div>
        <div className="panel-foot">
          <span>拖拽旋转 · 滚轮缩放 · 双击聚焦</span>
        </div>
      </aside>
    )
  }

  const parent = body.parent ? BODY_BY_ID.get(body.parent) : null
  const children = CHILDREN.get(body.id) ?? []
  const period = orbitalPeriodDays(body)
  const spinSpeed =
    body.rotationPeriodDays !== 0
      ? (2 * Math.PI * body.radiusKm) / Math.abs(body.rotationPeriodDays * 86400)
      : 0
  const aValue = body.parent
    ? `${fmt(body.orbital.a, 0)} km`
    : body.kind === 'star'
      ? '—'
      : `${body.orbital.a.toFixed(4)} AU`
  const livePrimary =
    body.parent && parent
      ? { label: '距母星', value: `${fmt(live.parentKm, 0)}`, unit: 'km' }
      : { label: '日心距', value: live.sunAU.toFixed(4), unit: 'AU' }

  return (
    <aside className="panel info-panel">
      <div className="info-scroll">
        <header className="info-head">
          <div className="info-kicker">
            <span className="tag">{kindLabel(body.kind)}</span>
            <span className="kicker-path">
              {parent ? `环绕 ${parent.name}` : body.kind === 'star' ? 'G2V 主序星' : '太阳系'}
            </span>
          </div>
          <div className="info-title">
            <span className="title-dot" style={{ background: body.color }} />
            <h2>{body.name}</h2>
            <span className="info-en">{body.nameEn}</span>
            <button className="info-close" onClick={() => select(null)} title="关闭">
              ×
            </button>
          </div>
          <p className="info-desc">{body.description}</p>
        </header>

        <div className="live-grid">
          <div className="live-tile">
            <span>{livePrimary.label}</span>
            <b>{livePrimary.value}</b>
            <i>{livePrimary.unit}</i>
          </div>
          <div className="live-tile">
            <span>轨道速度</span>
            <b>{live.speed.toFixed(2)}</b>
            <i>km/s</i>
          </div>
          <div className="live-tile">
            <span>赤道自转</span>
            <b>{spinSpeed.toFixed(3)}</b>
            <i>km/s</i>
          </div>
        </div>

        <div className="info-actions">
          <button
            className="primary-btn"
            onClick={() => {
              setCameraMode('orbit')
              select(body.id, true)
            }}
          >
            <span className="focus-glyph">◎</span> 聚焦观测
          </button>
          {cameraMode === 'orbit' ? (
            <button
              className={`ghost-btn ${follow ? 'is-on' : ''}`}
              onClick={() => {
                if (!follow) {
                  setFollow(true)
                  setFocus(body.id)
                } else {
                  setFollow(false)
                }
              }}
            >
              {follow ? '跟踪中' : '已解除跟踪'}
            </button>
          ) : (
            <button className="ghost-btn" onClick={() => setCameraMode('orbit')}>
              返回轨道相机
            </button>
          )}
        </div>

        <Section title="物理参数">
          <DataRow label="赤道半径" value={`${fmt(body.radiusKm, body.radiusKm < 100 ? 1 : 0)} km`} sub={earthRadii(body.radiusKm)} />
          <DataRow label="质量" value={`${sci(body.massKg, 3)} kg`} sub={earthMasses(body.massKg)} />
          <DataRow label="表面重力" value={`${body.gravity.toFixed(2)} m/s²`} sub={`${(body.gravity / 9.80665).toFixed(2)} g`} />
          <DataRow label="逃逸速度" value={`${body.escapeKms.toFixed(2)} km/s`} />
          <DataRow label="平均温度" value={formatTemp(body.meanTempC)} />
          {body.albedo !== undefined && <DataRow label="几何反照率" value={body.albedo.toFixed(2)} />}
        </Section>

        <Section title="轨道与自转">
          <DataRow label={body.parent ? '轨道半长轴' : '平均日心距'} value={aValue} />
          <DataRow label="偏心率" value={body.orbital.e.toFixed(4)} />
          <DataRow label="轨道倾角" value={`${body.orbital.inclination.toFixed(2)}°`} />
          <DataRow label="公转周期" value={body.kind === 'star' ? '—' : formatPeriod(period)} />
          <DataRow label="自转周期" value={formatRotation(body.rotationPeriodDays)} />
          <DataRow label="转轴倾角" value={`${body.axialTiltDeg.toFixed(2)}°`} />
          <DataRow label="已知卫星" value={body.kind === 'star' ? `${BODIES.filter((b) => b.kind === 'planet').length} 行星` : `${body.moonCount}`} />
          {body.discovered && <DataRow label="发现" value={body.discovered} />}
        </Section>

        {children.length > 0 && (
          <Section title={`卫星系统 · ${children.length}`}>
            <div className="chip-list">
              {children.map((m) => (
                <button key={m.id} className="chip" onClick={() => select(m.id, true)}>
                  <span className="chip-dot" style={{ background: m.color }} />
                  {m.name}
                </button>
              ))}
            </div>
          </Section>
        )}

        <Section title="成分构成">
          <div className="chip-list">
            {body.composition.map((c) => (
              <span key={c} className="chip static">
                {c}
              </span>
            ))}
          </div>
        </Section>

        <div className="info-source">
          数据：NASA/JPL 近似轨道根数、IAU 2015 天体参数。教学模式下距离与半径经过非线性压缩，真实模式下保持 1:1 比例。
        </div>
      </div>
    </aside>
  )
}
