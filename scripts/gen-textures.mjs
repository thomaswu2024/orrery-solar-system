/**
 * Generates seamless procedural equirectangular textures for moons and Pluto.
 * Run with: npm run gen:textures
 */
import { PNG } from 'pngjs'
import { writeFileSync, existsSync, mkdirSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const OUT = join(__dirname, '..', 'public', 'textures')
if (!existsSync(OUT)) mkdirSync(OUT, { recursive: true })

const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v))
const smooth = (t) => t * t * (3 - 2 * t)
const mix = (a, b, t) => a + (b - a) * t

function hash3(x, y, z) {
  let h = (x * 374761393 + y * 668265263 + z * 1274126177) | 0
  h = Math.imul(h ^ (h >>> 13), 1274126177)
  h ^= h >>> 16
  return (h >>> 0) / 4294967295
}

function noise3(x, y, z) {
  const xi = Math.floor(x)
  const yi = Math.floor(y)
  const zi = Math.floor(z)
  const xf = x - xi
  const yf = y - yi
  const zf = z - zi
  const u = smooth(xf)
  const v = smooth(yf)
  const w = smooth(zf)
  const c000 = hash3(xi, yi, zi)
  const c100 = hash3(xi + 1, yi, zi)
  const c010 = hash3(xi, yi + 1, zi)
  const c110 = hash3(xi + 1, yi + 1, zi)
  const c001 = hash3(xi, yi, zi + 1)
  const c101 = hash3(xi + 1, yi, zi + 1)
  const c011 = hash3(xi, yi + 1, zi + 1)
  const c111 = hash3(xi + 1, yi + 1, zi + 1)
  return mix(
    mix(mix(c000, c100, u), mix(c010, c110, u), v),
    mix(mix(c001, c101, u), mix(c011, c111, u), v),
    w,
  )
}

function fbm(x, y, z, octaves = 4, lac = 2.07, gain = 0.5) {
  let amp = 0.5
  let sum = 0
  let norm = 0
  for (let o = 0; o < octaves; o++) {
    sum += amp * noise3(x, y, z)
    norm += amp
    amp *= gain
    x *= lac
    y *= lac
    z *= lac
  }
  return sum / norm
}

function mulberry32(seed) {
  return function () {
    seed |= 0
    seed = (seed + 0x6d2b79f5) | 0
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

function hexToRgb(h) {
  return [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)]
}

function makeCraters(rnd, count, minA, maxA) {
  const craters = []
  for (let i = 0; i < count; i++) {
    const z = rnd() * 2 - 1
    const phi = rnd() * Math.PI * 2
    const r = Math.sqrt(1 - z * z)
    const radius = mix(minA, maxA, Math.pow(rnd(), 2.6))
    craters.push({ x: r * Math.cos(phi), y: z, z: r * Math.sin(phi), radius, depth: 0.25 + rnd() * 0.5 })
  }
  return craters
}

/**
 * @param {object} spec
 */
function generate(name, spec) {
  const W = spec.size ?? 512
  const H = W / 2
  const png = new PNG({ width: W, height: H })
  const rnd = mulberry32(spec.seed ?? 1234)
  const craters = spec.craters ? makeCraters(rnd, spec.craters, spec.craterMin ?? 0.006, spec.craterMax ?? 0.09) : []
  const base = hexToRgb(spec.base)
  const dark = hexToRgb(spec.dark ?? spec.base)
  const light = hexToRgb(spec.light ?? spec.base)
  const accent = hexToRgb(spec.accent ?? spec.light ?? spec.base)
  const lines = []
  if (spec.cracks) {
    for (let i = 0; i < spec.cracks; i++) {
      const z = rnd() * 2 - 1
      const phi = rnd() * Math.PI * 2
      const r = Math.sqrt(1 - z * z)
      lines.push({
        x: r * Math.cos(phi),
        y: z,
        z: r * Math.sin(phi),
        width: 0.0015 + rnd() * 0.005,
        strength: 0.18 + rnd() * 0.45,
        tilt: rnd() * Math.PI,
        hue: rnd(),
      })
    }
  }
  const scale = spec.noiseScale ?? 3
  const octaves = spec.octaves ?? 4

  for (let y = 0; y < H; y++) {
    const lat = ((y + 0.5) / H - 0.5) * Math.PI
    const cl = Math.cos(lat)
    const sl = Math.sin(lat)
    for (let x = 0; x < W; x++) {
      const lon = ((x + 0.5) / W) * Math.PI * 2
      const dx = cl * Math.cos(lon)
      const dy = sl
      const dz = cl * Math.sin(lon)
      const n = fbm(dx * scale + 11.3, dy * scale + 4.7, dz * scale + 19.1, octaves)
      const n2 = fbm(dx * scale * 4.1 + 61.2, dy * scale * 4.1 + 3.3, dz * scale * 4.1 + 7.7, 3)
      let t = clamp((n - 0.5) * (spec.contrast ?? 1.4) + 0.5)
      let r = mix(dark[0], light[0], t)
      let g = mix(dark[1], light[1], t)
      let b = mix(dark[2], light[2], t)

      if (spec.bands) {
        const band = 0.5 + 0.5 * Math.sin(lat * spec.bands + n2 * 2.4)
        const bt = smooth(band) * (spec.bandStrength ?? 0.25)
        r = mix(r, accent[0], bt)
        g = mix(g, accent[1], bt)
        b = mix(b, accent[2], bt)
      }

      // crater shading
      for (let i = 0; i < craters.length; i++) {
        const c = craters[i]
        const dot = dx * c.x + dy * c.y + dz * c.z
        const cosR = Math.cos(c.radius)
        if (dot > cosR) {
          const d = Math.acos(clamp(dot, -1, 1)) / c.radius
          let shade = 0
          if (d < 0.72) shade = -c.depth * (1 - d / 0.72)
          else if (d < 0.9) shade = c.depth * 0.45
          else shade = c.depth * 0.55 * (1 - (d - 0.9) / 0.1)
          if (d < 0.13) shade += c.depth * 0.5
          const f = 1 + shade * (spec.craterStrength ?? 0.6)
          r *= f
          g *= f
          b *= f
        }
      }

      // great-circle crack / groove networks
      for (let i = 0; i < lines.length; i++) {
        const L = lines[i]
        // distance to plane of great circle
        const nd = dx * L.x + dy * L.y + dz * L.z
        const d = Math.abs(nd)
        if (d < L.width) {
          const fade = 1 - d / L.width
          const col = L.hue > 0.55 ? accent : dark
          const s = fade * L.strength
          r = mix(r, col[0], s)
          g = mix(g, col[1], s)
          b = mix(b, col[2], s)
        }
      }

      if (spec.special) {
        const res = spec.special(dx, dy, dz, lon, lat, n, n2)
        if (res) {
          r = mix(r, res[0], res[3] ?? 1)
          g = mix(g, res[1], res[3] ?? 1)
          b = mix(b, res[2], res[3] ?? 1)
        }
      }

      const grain = (rnd() - 0.5) * (spec.grain ?? 4)
      const idx = (y * W + x) * 4
      png.data[idx] = clamp(r + grain, 0, 255)
      png.data[idx + 1] = clamp(g + grain, 0, 255)
      png.data[idx + 2] = clamp(b + grain, 0, 255)
      png.data[idx + 3] = 255
    }
  }
  const buf = PNG.sync.write(png, { colorType: 2 })
  writeFileSync(join(OUT, `${name}.png`), buf)
  console.log(`generated ${name}.png ${W}x${H}`)
}

// ── Pluto: tan surface with the bright heart-shaped Sputnik Planitia ─────────
generate('pluto', {
  size: 1024,
  seed: 71093,
  base: '#b39a7c',
  dark: '#7c5f48',
  light: '#d9c6a6',
  accent: '#8e6b52',
  contrast: 1.15,
  noiseScale: 2.6,
  craters: 90,
  craterMin: 0.004,
  craterMax: 0.055,
  craterStrength: 0.55,
  special: (dx, dy, dz, lon, lat) => {
    // local tangent frame around the encounter hemisphere
    const lonC = 3.0
    const latC = 0.22
    const cx = Math.cos(latC) * Math.cos(lonC)
    const cy = Math.sin(latC)
    const cz = Math.cos(latC) * Math.sin(lonC)
    const front = dx * cx + dy * cy + dz * cz
    if (front > 0) {
      const ex = -Math.sin(lonC)
      const ez = Math.cos(lonC)
      const nx = -Math.sin(latC) * Math.cos(lonC)
      const ny = Math.cos(latC)
      const nz = -Math.sin(latC) * Math.sin(lonC)
      const ax = (dx * ex + dz * ez) / 0.62
      const ay = (dx * nx + dy * ny + dz * nz) / 0.62
      const d1 = Math.hypot(ax + 0.2, ay - 0.2) - 0.42
      const d2 = Math.hypot(ax - 0.2, ay - 0.2) - 0.42
      const d3 = Math.hypot(ax, ay + 0.18) - 0.46
      const m = Math.min(d1, d2, d3)
      if (m < 0.12) {
        const f = smooth(clamp((0.1 - m) / 0.2))
        return [224, 211, 186, 0.88 * f]
      }
    }
    // dark equatorial tholin band
    const band = Math.exp(-(((dy - 0.02) / 0.1) ** 2)) * 0.35
    return [96, 72, 55, band]
  },
})

generate('charon', {
  seed: 55107,
  base: '#a7a29b',
  dark: '#6a645e',
  light: '#cfcac2',
  accent: '#8c7163',
  contrast: 1.15,
  noiseScale: 3.4,
  craters: 210,
  craterMax: 0.11,
  special: (dx, dy) => {
    const polar = smooth(clamp((dy - 0.55) / 0.35))
    return [124, 88, 76, polar * 0.75]
  },
})

// ── Galilean moons ──────────────────────────────────────────────────────────
generate('io', {
  seed: 1001,
  base: '#d8c35b',
  dark: '#a07c2e',
  light: '#f0e39a',
  accent: '#c9772f',
  contrast: 1.05,
  noiseScale: 4.2,
  grain: 3,
  special: (dx, dy, dz, lon, lat, n, n2) => {
    if (n2 > 0.66) return [122, 64, 34, (n2 - 0.66) * 1.8]
    if (n > 0.65) return [244, 228, 156, (n - 0.65) * 1.5]
    if (n < 0.34) return [178, 92, 52, (0.34 - n) * 1.8]
    return null
  },
})

generate('europa', {
  seed: 2002,
  base: '#cfc4ad',
  dark: '#a08f78',
  light: '#f2eadc',
  accent: '#8e5b4b',
  contrast: 0.8,
  noiseScale: 2.8,
  cracks: 16,
  special: (dx, dy, dz) => {
    const n = fbm(dx * 9 + 3, dy * 9, dz * 9 + 12, 3)
    if (n > 0.68) return [238, 233, 223, (n - 0.68) * 1.2]
    if (n < 0.3) return [168, 148, 128, (0.3 - n) * 0.8]
    return null
  },
})

generate('ganymede', {
  seed: 3003,
  base: '#99938b',
  dark: '#5e5851',
  light: '#c8c2b8',
  accent: '#7d7264',
  contrast: 1.35,
  noiseScale: 3.6,
  craters: 240,
  craterMax: 0.1,
  cracks: 26,
  special: (dx, dy, dz) => {
    const n = fbm(dx * 2.2 + 8, dy * 2.2, dz * 2.2, 3)
    if (n > 0.6) return [188, 183, 174, smooth((n - 0.6) * 4) * 0.8]
    return null
  },
})

generate('callisto', {
  seed: 4004,
  base: '#857a6c',
  dark: '#4e453b',
  light: '#b9ad9a',
  contrast: 1.3,
  noiseScale: 3.2,
  craters: 340,
  craterMin: 0.003,
  craterMax: 0.12,
  craterStrength: 0.85,
  special: (dx, dy, dz) => {
    const n = fbm(dx * 7 + 31, dy * 7, dz * 7, 3)
    if (n > 0.7) return [210, 200, 182, (n - 0.7) * 2]
    return null
  },
})

// ── Saturnian moons ─────────────────────────────────────────────────────────
generate('mimas', {
  seed: 5005,
  base: '#bdbab5',
  dark: '#8e8a85',
  light: '#dedbd6',
  contrast: 1.04,
  noiseScale: 3.4,
  craters: 260,
  craterMax: 0.14,
  craterStrength: 0.9,
})

generate('enceladus', {
  seed: 6006,
  base: '#e9eff2',
  dark: '#c2ccd2',
  light: '#ffffff',
  accent: '#8ab4c6',
  contrast: 0.7,
  noiseScale: 3.8,
  craters: 90,
  craterMax: 0.05,
  cracks: 18,
  special: (dx, dy, dz, lon, lat) => {
    if (dy < -0.55) {
      const n = fbm(dx * 16, dy * 16, dz * 16, 3)
      if (n > 0.52) return [120, 165, 185, (n - 0.52) * 1.6]
    }
    return null
  },
})

generate('tethys', {
  seed: 7007,
  base: '#d1d0ca',
  dark: '#a8a7a2',
  light: '#f1f0eb',
  contrast: 0.95,
  noiseScale: 3.1,
  craters: 210,
  craterMax: 0.13,
})

generate('dione', {
  seed: 8008,
  base: '#c9c8c2',
  dark: '#989792',
  light: '#eceae4',
  contrast: 1.05,
  noiseScale: 3.3,
  craters: 190,
  craterMax: 0.1,
  cracks: 12,
})

generate('rhea', {
  seed: 9009,
  base: '#cdcbc5',
  dark: '#9e9c96',
  light: '#efede7',
  contrast: 1.0,
  noiseScale: 3.5,
  craters: 230,
  craterMax: 0.11,
})

generate('titan', {
  seed: 10010,
  base: '#d99a45',
  dark: '#b06f27',
  light: '#f0c478',
  accent: '#e8ae5e',
  contrast: 0.6,
  noiseScale: 2.2,
  bands: 3.2,
  bandStrength: 0.22,
  grain: 2,
})

generate('iapetus', {
  seed: 11011,
  base: '#b7ad9c',
  dark: '#3f342c',
  light: '#e2dccd',
  contrast: 1.0,
  noiseScale: 3.0,
  craters: 170,
  craterMax: 0.1,
  special: (dx, dy, dz, lon) => {
    // leading hemisphere is coated with dark material
    const d = Math.cos(lon - 1.2)
    if (d > 0.1) return [62, 50, 40, smooth(clamp((d - 0.1) / 0.9)) * 0.9]
    return null
  },
})

// ── Uranian moons ───────────────────────────────────────────────────────────
generate('ariel', {
  seed: 12012,
  base: '#c3c0b9',
  dark: '#918d86',
  light: '#e7e4dc',
  contrast: 1.1,
  noiseScale: 3.4,
  craters: 130,
  craterMax: 0.08,
  cracks: 14,
})

generate('umbriel', {
  seed: 13013,
  base: '#7f7c77',
  dark: '#53504c',
  light: '#a7a39d',
  contrast: 1.2,
  noiseScale: 3.2,
  craters: 200,
  craterMax: 0.1,
})

generate('titania', {
  seed: 14014,
  base: '#b6b2aa',
  dark: '#827d75',
  light: '#dcd8d0',
  contrast: 1.1,
  noiseScale: 3.3,
  craters: 170,
  craterMax: 0.09,
  cracks: 16,
})

generate('oberon', {
  seed: 15015,
  base: '#9b968d',
  dark: '#645f57',
  light: '#c4bfb5',
  contrast: 1.2,
  noiseScale: 3.0,
  craters: 220,
  craterMax: 0.11,
})

// ── Neptune / Mars moons ────────────────────────────────────────────────────
generate('triton', {
  seed: 16016,
  base: '#c9b8ae',
  dark: '#8b756b',
  light: '#e8dcd2',
  accent: '#b98e84',
  contrast: 0.95,
  noiseScale: 3.6,
  craters: 80,
  craterMax: 0.05,
  cracks: 30,
  special: (dx, dy, dz) => {
    // cantaloupe terrain
    const n = fbm(dx * 8 + 5, dy * 8, dz * 8 + 2, 3)
    if (n > 0.62) return [230, 220, 212, (n - 0.62) * 1.4]
    return null
  },
})

generate('phobos', {
  seed: 17017,
  base: '#77695c',
  dark: '#463c33',
  light: '#9c8d7d',
  contrast: 1.1,
  noiseScale: 4.0,
  craters: 170,
  craterMax: 0.13,
})

generate('deimos', {
  seed: 18018,
  base: '#8b7b6b',
  dark: '#574a3e',
  light: '#ad9d8b',
  contrast: 1.0,
  noiseScale: 4.2,
  craters: 90,
  craterMax: 0.1,
})

// ── Radial glow sprite ──────────────────────────────────────────────────────
{
  const S = 256
  const png = new PNG({ width: S, height: S })
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const nx = (x + 0.5) / S - 0.5
      const ny = (y + 0.5) / S - 0.5
      const d = Math.sqrt(nx * nx + ny * ny) * 2
      const glow = Math.pow(clamp(1 - d), 2.6)
      const core = Math.pow(clamp(1 - d * 2.2), 4)
      const a = clamp(glow * 0.85 + core)
      const idx = (y * S + x) * 4
      png.data[idx] = 255
      png.data[idx + 1] = 220
      png.data[idx + 2] = 170
      png.data[idx + 3] = Math.round(a * 255)
    }
  }
  writeFileSync(join(OUT, 'glow.png'), PNG.sync.write(png))
  console.log('generated glow.png')
}
