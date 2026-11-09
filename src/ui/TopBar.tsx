import { useAppStore } from '../state/store'

function OrbitIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.3">
      <ellipse cx="12" cy="12" rx="9.2" ry="4.4" transform="rotate(-24 12 12)" />
      <circle cx="12" cy="12" r="2.1" fill="currentColor" stroke="none" />
      <circle cx="19.2" cy="7.4" r="1.5" fill="currentColor" stroke="none" />
    </svg>
  )
}

function FlightIcon() {
  return (
    <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.3">
      <path d="M12 3.5 L18.8 20 L12 16.2 L5.2 20 Z" strokeLinejoin="round" />
    </svg>
  )
}

function Segmented<T extends string>({
  value,
  options,
  onChange,
}: {
  value: T
  options: { value: T; label: string; icon?: React.ReactNode }[]
  onChange: (v: T) => void
}) {
  return (
    <div className="segmented">
      {options.map((o) => (
        <button
          key={o.value}
          className={value === o.value ? 'seg-item is-active' : 'seg-item'}
          onClick={() => onChange(o.value)}
        >
          {o.icon}
          <span>{o.label}</span>
        </button>
      ))}
    </div>
  )
}

export function TopBar() {
  const cameraMode = useAppStore((s) => s.cameraMode)
  const displayMode = useAppStore((s) => s.displayMode)
  const setCameraMode = useAppStore((s) => s.setCameraMode)
  const setDisplayMode = useAppStore((s) => s.setDisplayMode)
  const requestOverview = useAppStore((s) => s.requestOverview)
  const setSettingsOpen = useAppStore((s) => s.setSettingsOpen)
  const setHelpOpen = useAppStore((s) => s.setHelpOpen)
  const sidebarOpen = useAppStore((s) => s.sidebarOpen)
  const setSidebarOpen = useAppStore((s) => s.setSidebarOpen)
  const pointerLocked = useAppStore((s) => s.pointerLocked)

  return (
    <header className="topbar">
      <div className="brand">
        <div className="brand-mark">
          <svg viewBox="0 0 32 32" width="30" height="30" fill="none">
            <circle cx="16" cy="16" r="4.2" fill="#ffcf87" />
            <ellipse cx="16" cy="16" rx="13" ry="6.2" stroke="#84d5ff" strokeOpacity="0.8" strokeWidth="1" transform="rotate(-22 16 16)" />
            <circle cx="27.6" cy="9.6" r="1.7" fill="#84d5ff" />
            <circle cx="4.6" cy="22.2" r="1.1" fill="#84d5ff" fillOpacity="0.55" />
          </svg>
        </div>
        <div className="brand-text">
          <div className="brand-name">
            ORRERY<span className="brand-mark-dot">·</span>
            <span className="brand-name-cn">太阳系天文台</span>
          </div>
          <div className="brand-sub">KEPLERIAN SOLAR SYSTEM OBSERVATORY</div>
        </div>
      </div>

      <div className="topbar-center">
        <Segmented
          value={cameraMode}
          onChange={(v) => setCameraMode(v)}
          options={[
            { value: 'orbit', label: '轨道相机', icon: <OrbitIcon /> },
            { value: 'free', label: '自由飞行', icon: <FlightIcon /> },
          ]}
        />
        <div className="topbar-divider" />
        <Segmented
          value={displayMode}
          onChange={(v) => setDisplayMode(v)}
          options={[
            { value: 'educational', label: '教学比例' },
            { value: 'true', label: '真实比例' },
          ]}
        />
        {displayMode === 'educational' && <span className="mode-note">距离压缩 · 尺寸增强</span>}
        {displayMode === 'true' && <span className="mode-note warm">1 : 1 尺度 · 行星几不可见</span>}
      </div>

      <div className="topbar-actions">
        <button className="tb-btn" onClick={requestOverview} title="返回太阳系总览 (O)">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="12" cy="12" r="3" />
            <path d="M12 2.5v3M12 18.5v3M2.5 12h3M18.5 12h3" />
          </svg>
          <span>总览</span>
        </button>
        <button className="tb-btn" onClick={() => setSettingsOpen(true)} title="显示设置">
          <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.4">
            <circle cx="12" cy="12" r="3.1" />
            <path d="M12 2.8v2.6M12 18.6v2.6M2.8 12h2.6M18.6 12h2.6M5.5 5.5l1.9 1.9M16.6 16.6l1.9 1.9M18.5 5.5l-1.9 1.9M7.4 16.6l-1.9 1.9" />
          </svg>
          <span>设置</span>
        </button>
        <button className="tb-btn icon-only" onClick={() => setHelpOpen(true)} title="帮助 (?)">
          ?
        </button>
        <button
          className={`tb-btn icon-only ${sidebarOpen ? 'is-on' : ''}`}
          onClick={() => setSidebarOpen(!sidebarOpen)}
          title="天体目录"
        >
          ☰
        </button>
        {pointerLocked && <span className="lock-chip">鼠标已锁定 · ESC 释放</span>}
      </div>
    </header>
  )
}
