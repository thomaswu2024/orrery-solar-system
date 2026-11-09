import { useAppStore, type ViewSettings } from '../state/store'

function ToggleRow({
  label,
  hint,
  value,
  onChange,
}: {
  label: string
  hint: string
  value: boolean
  onChange: () => void
}) {
  return (
    <label className="toggle-row">
      <span className="toggle-copy">
        <b>{label}</b>
        <em>{hint}</em>
      </span>
      <input type="checkbox" checked={value} onChange={onChange} />
      <span className={`switch ${value ? 'is-on' : ''}`}>
        <i />
      </span>
    </label>
  )
}

function Group({ title, code, children }: { title: string; code: string; children: React.ReactNode }) {
  return (
    <section className="setting-group">
      <div className="setting-head">
        <h3>{title}</h3>
        <span>{code}</span>
      </div>
      {children}
    </section>
  )
}

export function SettingsPanel() {
  const open = useAppStore((s) => s.settingsOpen)
  const setOpen = useAppStore((s) => s.setSettingsOpen)
  const settings = useAppStore((s) => s.settings)
  const toggle = useAppStore((s) => s.toggleSetting)
  const setSetting = useAppStore((s) => s.setSetting)
  const displayMode = useAppStore((s) => s.displayMode)

  if (!open) return null

  const rows: { key: keyof ViewSettings; label: string; hint: string }[] = [
    { key: 'orbits', label: '轨道椭圆', hint: '按当前根数绘制的完整开普勒椭圆' },
    { key: 'labels', label: '天体标签', hint: '屏幕空间名称标注' },
    { key: 'markers', label: '定位标记', hint: '天体中心点与选中准星' },
    { key: 'trails', label: '运动轨迹', hint: '过去 22% 公转周期的解析轨迹' },
    { key: 'predicted', label: '预测轨迹', hint: '未来 30% 公转周期的虚线弧' },
  ]

  const envRows: { key: keyof ViewSettings; label: string; hint: string }[] = [
    { key: 'asteroidBelt', label: '小行星带', hint: '2.06–3.28 AU 的 3,200 颗实例化岩体' },
    { key: 'kuiperBelt', label: '柯伊伯带', hint: '30–54 AU 的示意性尘埃分布' },
    { key: 'stars', label: '银河背景', hint: '全天球银河纹理与 9,000 颗程序星点' },
    { key: 'eclipticGrid', label: '黄道网格', hint: '黄道面参考环与方位辐条' },
    { key: 'atmospheres', label: '大气散射', hint: '菲涅尔边缘辉光壳层' },
  ]

  const physicsRows: { key: keyof ViewSettings; label: string; hint: string }[] = [
    { key: 'velocityVectors', label: '速度矢量', hint: '瞬时日心速度方向与相对长度' },
    { key: 'hillSpheres', label: '希尔球', hint: '引力主导范围的线框边界' },
    { key: 'shadows', label: '投射阴影', hint: '点光源阴影贴图，可能影响性能' },
  ]

  const renderRows: { key: keyof ViewSettings; label: string; hint: string }[] = [
    { key: 'postFX', label: '泛光与暗角', hint: 'HDR 泛光、暗角与 ACES 色调映射' },
  ]

  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div className="sheet settings-sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <div>
            <div className="sheet-kicker">VIEW CONFIGURATION</div>
            <h2>显示设置</h2>
          </div>
          <button className="sheet-close" onClick={() => setOpen(false)}>
            ×
          </button>
        </header>
        <div className="sheet-body">
          <Group title="显示层" code="LAYERS">
            {rows.map((r) => (
              <ToggleRow
                key={r.key}
                label={r.label}
                hint={r.hint}
                value={settings[r.key] as boolean}
                onChange={() => toggle(r.key)}
              />
            ))}
          </Group>

          <Group title="环境" code="ENVIRONMENT">
            {envRows.map((r) => (
              <ToggleRow
                key={r.key}
                label={r.label}
                hint={r.hint}
                value={settings[r.key] as boolean}
                onChange={() => toggle(r.key)}
              />
            ))}
          </Group>

          <Group title="物理可视化" code="PHYSICS">
            {physicsRows.map((r) => (
              <ToggleRow
                key={r.key}
                label={r.label}
                hint={r.hint}
                value={settings[r.key] as boolean}
                onChange={() => toggle(r.key)}
              />
            ))}
          </Group>

          <Group title="渲染" code="RENDER">
            {renderRows.map((r) => (
              <ToggleRow
                key={r.key}
                label={r.label}
                hint={r.hint}
                value={settings[r.key] as boolean}
                onChange={() => toggle(r.key)}
              />
            ))}
          </Group>

          <Group title="天体尺寸增强" code="SCALE">
            <div className="size-boost">
              <div className="size-boost-head">
                <span>半径放大系数</span>
                <b>{settings.sizeBoost.toFixed(2)}×</b>
              </div>
              <input
                type="range"
                min={0.5}
                max={3}
                step={0.05}
                value={settings.sizeBoost}
                onChange={(e) => setSetting('sizeBoost', Number(e.target.value))}
              />
              <p>
                仅放大天体自身半径，不改变轨道距离。
                {displayMode === 'true'
                  ? ' 真实比例下行星在屏幕上极小，可适度放大以便识别。'
                  : ' 教学比例下建议保持 1.0×。'}
              </p>
              <button className="ghost-btn small" onClick={() => setSetting('sizeBoost', 1)}>
                恢复 1.00×
              </button>
            </div>
          </Group>
        </div>
      </div>
    </div>
  )
}
