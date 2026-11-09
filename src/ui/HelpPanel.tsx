import { useAppStore } from '../state/store'

const KEYS: { key: string; action: string }[] = [
  { key: '空格', action: '暂停 / 继续时间' },
  { key: 'R', action: '回到当前时刻' },
  { key: 'O', action: '太阳系总览' },
  { key: 'M', action: '切换轨道 / 自由飞行' },
  { key: 'T', action: '切换教学 / 真实比例' },
  { key: 'F', action: '切换跟踪锁定' },
  { key: 'G', action: '黄道网格' },
  { key: 'L', action: '天体标签' },
  { key: '[ / ]', action: '降低 / 提高时间流速' },
  { key: 'Esc', action: '释放鼠标 / 关闭面板' },
]

const FLIGHT: { key: string; action: string }[] = [
  { key: 'W A S D', action: '前后左右平移' },
  { key: 'Q E', action: '沿世界轴下降 / 上升' },
  { key: 'Shift', action: '加速至 4 倍' },
  { key: 'Alt', action: '减速至 0.18 倍' },
  { key: '滚轮', action: '调整巡航速度' },
  { key: '左键拖拽', action: '未锁定鼠标时环视' },
  { key: '空白处单击', action: '锁定鼠标进入飞行' },
]

export function HelpPanel() {
  const open = useAppStore((s) => s.helpOpen)
  const setOpen = useAppStore((s) => s.setHelpOpen)

  if (!open) return null
  return (
    <div className="modal-backdrop" onClick={() => setOpen(false)}>
      <div className="sheet help-sheet" onClick={(e) => e.stopPropagation()}>
        <header className="sheet-head">
          <div>
            <div className="sheet-kicker">OPERATING MANUAL</div>
            <h2>观测指南</h2>
          </div>
          <button className="sheet-close" onClick={() => setOpen(false)}>
            ×
          </button>
        </header>
        <div className="sheet-body help-body">
          <section className="help-section">
            <h3>相机与导航</h3>
            <ul className="help-list">
              <li>
                <b>轨道相机</b>
                <span>围绕当前锁定天体运行。左键拖拽调整方位与仰角，滚轮平滑缩放，双击天体贴近观察。</span>
              </li>
              <li>
                <b>自由飞行</b>
                <span>脱离目标锁定，进行第一人称巡航。单击空白处锁定鼠标，WASD 推进，Q/E 垂直移动。</span>
              </li>
              <li>
                <b>目标跟踪</b>
                <span>在轨道模式下单击任意天体，相机会在约 1.7 秒内飞向目标并保持跟踪。自由飞行不会响应锁定。</span>
              </li>
              <li>
                <b>浮动原点</b>
                <span>真实比例模式下，当相机远离原点超过 4,200 场景单位时，坐标系自动重置到相机位置，以消除浮点精度抖动。</span>
              </li>
            </ul>
          </section>

          <section className="help-section">
            <h3>自由飞行控制</h3>
            <div className="key-grid">
              {FLIGHT.map((k) => (
                <div key={k.key} className="key-row">
                  <kbd>{k.key}</kbd>
                  <span>{k.action}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="help-section">
            <h3>键盘快捷键</h3>
            <div className="key-grid">
              {KEYS.map((k) => (
                <div key={k.key} className="key-row">
                  <kbd>{k.key}</kbd>
                  <span>{k.action}</span>
                </div>
              ))}
            </div>
          </section>

          <section className="help-section">
            <h3>数据与模型</h3>
            <ul className="help-list">
              <li>
                <b>轨道根数</b>
                <span>行星采用 NASA/JPL 近似根数（J2000，含每世纪线性变化率），通过牛顿迭代求解开普勒方程，得到瞬时真近点角与三维位置。</span>
              </li>
              <li>
                <b>卫星</b>
                <span>主要卫星使用母星中心根数与简化周期模型，轨道倾角相对黄道面，包含海卫一的逆行轨道。</span>
              </li>
              <li>
                <b>教学比例</b>
                <span>日心距按对数函数压缩，天体半径独立增强，使内行星与外行星能同时呈现；真实比例保留精确的 1:1 半径与距离关系。</span>
              </li>
              <li>
                <b>光照</b>
                <span>点光源强度经过视距归一化，避免外行星因平方反比衰减而完全不可见；日面与泛光使用 HDR 值。</span>
              </li>
              <li>
                <b>轨迹</b>
                <span>轨迹与预测弧均由轨道解析解直接采样，不依赖帧间积分，因此在任意时间流速下都保持几何精度。</span>
              </li>
            </ul>
          </section>

          <div className="help-foot">
            <span>ORRERY · 太阳系天文台</span>
            <span>Keplerian ephemeris · J2000 ecliptic · three.js</span>
          </div>
        </div>
      </div>
    </div>
  )
}
