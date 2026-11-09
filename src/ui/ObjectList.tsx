import { useEffect, useMemo, useRef } from 'react'
import { BODIES, BODY_BY_ID, type CelestialBody } from '../data/bodies'
import { useAppStore } from '../state/store'

function Row({ body }: { body: CelestialBody }) {
  const selectedId = useAppStore((s) => s.selectedId)
  const hoveredId = useAppStore((s) => s.hoveredId)
  const select = useAppStore((s) => s.select)
  const setHovered = useAppStore((s) => s.setHovered)
  const isSel = selectedId === body.id
  const parent = body.parent ? BODY_BY_ID.get(body.parent) : null
  const meta = body.parent
    ? `${(body.orbital.a / 1000).toFixed(0)}k km`
    : body.kind === 'star'
      ? '中心天体'
      : `${body.orbital.a.toFixed(2)} AU`

  return (
    <button
      className={`object-row ${isSel ? 'is-selected' : ''} ${hoveredId === body.id ? 'is-hovered' : ''}`}
      onClick={() => select(body.id, true)}
      onPointerEnter={() => setHovered(body.id)}
      onPointerLeave={() => setHovered(null)}
      title={parent ? `${body.name} · 环绕 ${parent.name}` : body.name}
    >
      <span className="row-dot" style={{ background: body.color }} />
      <span className="row-main">
        <span className="row-name">{body.name}</span>
        <span className="row-en">{body.nameEn}</span>
      </span>
      <span className="row-meta">{meta}</span>
    </button>
  )
}

function Group({ title, sub, bodies }: { title: string; sub: string; bodies: CelestialBody[] }) {
  if (bodies.length === 0) return null
  return (
    <section className="object-group">
      <div className="group-head">
        <h3>{title}</h3>
        <span>{sub}</span>
      </div>
      {bodies.map((b) => (
        <Row key={b.id} body={b} />
      ))}
    </section>
  )
}

export function ObjectList() {
  const search = useAppStore((s) => s.search)
  const setSearch = useAppStore((s) => s.setSearch)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const selectedId = useAppStore((s) => s.selectedId)
  const listRef = useRef<HTMLDivElement>(null)

  const groups = useMemo(() => {
    const q = search.trim().toLowerCase()
    const match = (b: CelestialBody) =>
      !q ||
      b.name.toLowerCase().includes(q) ||
      b.nameEn.toLowerCase().includes(q) ||
      b.id.includes(q) ||
      (b.parent ? (BODY_BY_ID.get(b.parent)?.name ?? '').includes(q) : false)

    const sun = BODIES.filter((b) => b.kind === 'star' && match(b))
    const planets = BODIES.filter((b) => b.kind === 'planet' && match(b))
    const dwarfs = BODIES.filter((b) => b.kind === 'dwarf' && match(b))
    const moonGroups = ['earth', 'mars', 'jupiter', 'saturn', 'uranus', 'neptune', 'pluto']
      .map((parentId) => {
        const parent = BODY_BY_ID.get(parentId)
        if (!parent) return null
        const moons = BODIES.filter((b) => b.parent === parentId && match(b))
        return moons.length ? { parent, moons } : null
      })
      .filter(Boolean) as { parent: CelestialBody; moons: CelestialBody[] }[]

    return { sun, planets, dwarfs, moonGroups }
  }, [search])

  useEffect(() => {
    if (!selectedId) return
    const el = listRef.current?.querySelector('.object-row.is-selected')
    el?.scrollIntoView({ block: 'nearest', behavior: 'smooth' })
  }, [selectedId])

  return (
    <aside className={`panel object-panel ${sidebarOpen ? '' : 'is-collapsed'}`}>
      <div className="panel-head">
        <div>
          <h2>天体目录</h2>
          <span className="panel-head-sub">OBJECT CATALOG</span>
        </div>
        <span className="panel-count">{BODIES.length}</span>
      </div>

      <div className="search-wrap">
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" strokeWidth="1.5">
          <circle cx="10.8" cy="10.8" r="6.4" />
          <path d="M15.6 15.6L20 20" />
        </svg>
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder="搜索天体 / Search"
          spellCheck={false}
        />
        {search && (
          <button className="search-clear" onClick={() => setSearch('')}>
            ×
          </button>
        )}
      </div>

      <div className="object-scroll" ref={listRef}>
        {groups.sun.length > 0 && <Group title="恒星" sub="STAR" bodies={groups.sun} />}
        {groups.planets.length > 0 && <Group title="行星" sub="PLANETS" bodies={groups.planets} />}
        {groups.dwarfs.length > 0 && <Group title="矮行星" sub="DWARF PLANETS" bodies={groups.dwarfs} />}
        {groups.moonGroups.map(({ parent, moons }) => (
          <Group key={parent.id} title={`${parent.name}系统`} sub="SATELLITES" bodies={moons} />
        ))}
        {groups.sun.length === 0 &&
          groups.planets.length === 0 &&
          groups.dwarfs.length === 0 &&
          groups.moonGroups.length === 0 && <div className="empty-note">未找到匹配的天体</div>}
      </div>

      <div className="panel-foot">
        <span>JPL 近似轨道根数 · J2000</span>
        <span className="foot-mark">◈</span>
      </div>
    </aside>
  )
}
