import { useEffect, useState } from 'react'
import { runtime, resetRuntimeClock } from '../sim/runtime'
import { SPEED_MAX, SPEED_MIN, useAppStore } from '../state/store'
import { formatDateUTC, speedLabel, timeRateText } from '../lib/format'

export function TimeBar() {
  const playing = useAppStore((s) => s.playing)
  const speed = useAppStore((s) => s.speed)
  const direction = useAppStore((s) => s.direction)
  const togglePlaying = useAppStore((s) => s.togglePlaying)
  const setSpeed = useAppStore((s) => s.setSpeed)
  const setDirection = useAppStore((s) => s.setDirection)
  const setPlaying = useAppStore((s) => s.setPlaying)
  const resetTime = useAppStore((s) => s.resetTime)
  const [jd, setJd] = useState(runtime.jd)

  useEffect(() => {
    let raf = 0
    let last = 0
    const tick = (t: number) => {
      raf = requestAnimationFrame(tick)
      if (t - last < 90) return
      last = t
      setJd(runtime.jd)
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [])

  const logVal = Math.log10(Math.max(SPEED_MIN, Math.min(SPEED_MAX, speed)))

  const presets = [
    { label: '1×', value: 1, hint: '实时' },
    { label: '3.6k×', value: 3600, hint: '1 时/秒' },
    { label: '86.4k×', value: 86400, hint: '1 日/秒' },
    { label: '100k×', value: 100000, hint: '极限' },
  ]

  return (
    <footer className="timebar">
      <div className="time-left">
        <div className="time-label">
          <span className="live-dot" />
          模拟时间 · UTC
        </div>
        <div className="time-value">{formatDateUTC(jd)}</div>
        <div className="time-jd">JD {jd.toFixed(5)} · J2000 黄道坐标</div>
      </div>

      <div className="time-center">
        <div className="transport">
          <button
            className={`transport-btn ${direction < 0 ? 'is-on' : ''}`}
            title="逆向时间"
            onClick={() => {
              setDirection(-1)
              setPlaying(true)
            }}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
              <path d="M11 5v14L1.5 12zM22 5v14L12.5 12z" />
            </svg>
          </button>
          <button className="transport-btn play" title="暂停 / 继续 (空格)" onClick={togglePlaying}>
            {playing ? (
              <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
                <rect x="6" y="4" width="4.4" height="16" rx="1" />
                <rect x="13.6" y="4" width="4.4" height="16" rx="1" />
              </svg>
            ) : (
              <svg viewBox="0 0 24 24" width="17" height="17" fill="currentColor">
                <path d="M6 3.6v16.8L20 12z" />
              </svg>
            )}
          </button>
          <button
            className={`transport-btn ${direction > 0 ? 'is-on' : ''}`}
            title="正向时间"
            onClick={() => {
              setDirection(1)
              setPlaying(true)
            }}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="currentColor">
              <path d="M1.5 5v14L11 12zM12.5 5v14L22 12z" />
            </svg>
          </button>
          <div className="transport-sep" />
          <button
            className="transport-btn reset"
            title="回到当前时刻 (R)"
            onClick={() => {
              resetRuntimeClock()
              resetTime()
            }}
          >
            <svg viewBox="0 0 24 24" width="15" height="15" fill="none" stroke="currentColor" strokeWidth="1.6">
              <path d="M4.5 12a7.5 7.5 0 1 0 2.2-5.3M4.2 4.5v4.2H8.4" strokeLinecap="round" />
            </svg>
          </button>
        </div>

        <div className="speed-control">
          <div className="speed-head">
            <span>时间流速</span>
            <b>{speedLabel(speed)}</b>
            <em>{timeRateText(speed)}</em>
          </div>
          <input
            className="speed-slider"
            type="range"
            min={0}
            max={5}
            step={0.005}
            value={logVal}
            onChange={(e) => setSpeed(Math.pow(10, Number(e.target.value)))}
            aria-label="时间流速"
          />
          <div className="speed-scale">
            <span>1×</span>
            <span>10×</span>
            <span>100×</span>
            <span>1k×</span>
            <span>10k×</span>
            <span>100k×</span>
          </div>
        </div>
      </div>

      <div className="time-right">
        <div className="preset-row">
          {presets.map((p) => (
            <button
              key={p.value}
              className={`preset ${Math.abs(speed - p.value) / p.value < 0.02 ? 'is-on' : ''}`}
              onClick={() => setSpeed(p.value)}
              title={p.hint}
            >
              {p.label}
            </button>
          ))}
        </div>
        <div className="time-note">
          <span>开普勒解析解</span>
          <span className="dot-sep">·</span>
          <span>{direction < 0 ? '逆向积分' : '正向积分'}</span>
        </div>
      </div>
    </footer>
  )
}
