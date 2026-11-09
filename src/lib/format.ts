import { julianToDate } from '../sim/kepler'
import { EARTH_MASS_KG, EARTH_RADIUS_KM } from '../data/bodies'

const SUP = '⁰¹²³⁴⁵⁶⁷⁸⁹'

function superscript(n: number): string {
  return String(n)
    .split('')
    .map((c) => (c === '-' ? '⁻' : SUP[Number(c)] ?? c))
    .join('')
}

export function fmt(n: number, digits = 0): string {
  return n.toLocaleString('en-US', { minimumFractionDigits: digits, maximumFractionDigits: digits })
}

export function sci(n: number, digits = 2): string {
  if (!isFinite(n) || n === 0) return '0'
  const exp = Math.floor(Math.log10(Math.abs(n)))
  const mant = n / Math.pow(10, exp)
  return `${mant.toFixed(digits)} × 10${superscript(exp)}`
}

export function earthRadii(radiusKm: number): string {
  return `${(radiusKm / EARTH_RADIUS_KM).toFixed(3)} R⊕`
}

export function earthMasses(massKg: number): string {
  const m = massKg / EARTH_MASS_KG
  if (m >= 10) return `${m.toFixed(1)} M⊕`
  if (m >= 0.01) return `${m.toFixed(3)} M⊕`
  return `${m.toExponential(2)} M⊕`
}

export function formatRotation(days: number): string {
  const retro = days < 0
  const d = Math.abs(days)
  let out: string
  if (d < 1) {
    const hours = d * 24
    const h = Math.floor(hours)
    const m = Math.round((hours - h) * 60)
    out = `${h} 小时 ${m.toString().padStart(2, '0')} 分`
  } else if (d < 300) {
    out = `${d.toFixed(2)} 天`
  } else {
    out = `${d.toFixed(1)} 天`
  }
  return retro ? `${out} · 逆向` : out
}

export function formatPeriod(days: number): string {
  const d = Math.abs(days)
  if (d < 1) return `${(d * 24).toFixed(1)} 小时`
  if (d < 400) return `${d.toFixed(2)} 天`
  const years = d / 365.25
  if (years < 1000) return `${years.toFixed(2)} 年`
  return `${fmt(years, 0)} 年`
}

export function formatTemp(c: number): string {
  const sign = c > 0 ? '+' : ''
  return `${sign}${fmt(c, c % 1 === 0 ? 0 : 1)} °C`
}

export function formatDateUTC(jd: number): string {
  const d = julianToDate(jd)
  const iso = d.toISOString()
  return `${iso.slice(0, 10)} ${iso.slice(11, 19)} UTC`
}

export function formatDateShort(jd: number): string {
  const d = julianToDate(jd)
  const iso = d.toISOString()
  return iso.slice(0, 10)
}

export function timeRateText(speed: number): string {
  const s = Math.abs(speed)
  if (s <= 1.01) return '实时流速'
  if (s < 60) return `1 秒 ≈ ${s.toFixed(s < 10 ? 1 : 0)} 秒`
  if (s < 3600) return `1 秒 ≈ ${(s / 60).toFixed(1)} 分钟`
  if (s < 86400) return `1 秒 ≈ ${(s / 3600).toFixed(1)} 小时`
  if (s < 86400 * 365) return `1 秒 ≈ ${(s / 86400).toFixed(1)} 天`
  return `1 秒 ≈ ${(s / (86400 * 365.25)).toFixed(2)} 年`
}

export function speedLabel(speed: number): string {
  if (speed >= 100000) return '100k×'
  if (speed >= 10000) return `${(speed / 1000).toFixed(0)}k×`
  if (speed >= 1000) return `${(speed / 1000).toFixed(1)}k×`
  if (speed >= 10) return `${speed.toFixed(0)}×`
  if (speed >= 1) return `${speed.toFixed(speed < 10 ? 1 : 0)}×`
  return `${speed.toFixed(2)}×`
}

export function kindLabel(kind: string): string {
  switch (kind) {
    case 'star':
      return '恒星'
    case 'planet':
      return '行星'
    case 'dwarf':
      return '矮行星'
    case 'moon':
      return '天然卫星'
    default:
      return kind
  }
}
