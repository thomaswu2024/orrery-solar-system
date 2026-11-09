import { create } from 'zustand'
import type { DisplayMode } from '../sim/scaling'

export type CameraMode = 'orbit' | 'free'

export interface ViewSettings {
  orbits: boolean
  labels: boolean
  trails: boolean
  predicted: boolean
  asteroidBelt: boolean
  kuiperBelt: boolean
  atmospheres: boolean
  stars: boolean
  velocityVectors: boolean
  hillSpheres: boolean
  markers: boolean
  eclipticGrid: boolean
  shadows: boolean
  postFX: boolean
  sizeBoost: number
}

interface AppState {
  selectedId: string | null
  hoveredId: string | null
  cameraMode: CameraMode
  displayMode: DisplayMode
  focusId: string
  follow: boolean
  focusNonce: number
  overviewNonce: number
  playing: boolean
  speed: number
  direction: 1 | -1
  settings: ViewSettings
  settingsOpen: boolean
  helpOpen: boolean
  aboutOpen: boolean
  sidebarOpen: boolean
  search: string
  pointerLocked: boolean

  select: (id: string | null, focus?: boolean) => void
  setHovered: (id: string | null) => void
  setCameraMode: (mode: CameraMode) => void
  setDisplayMode: (mode: DisplayMode) => void
  setFocus: (id: string) => void
  setFollow: (follow: boolean) => void
  requestOverview: () => void
  setPlaying: (playing: boolean) => void
  togglePlaying: () => void
  setSpeed: (speed: number) => void
  setDirection: (dir: 1 | -1) => void
  resetTime: () => void
  toggleSetting: <K extends keyof ViewSettings>(key: K) => void
  setSetting: <K extends keyof ViewSettings>(key: K, value: ViewSettings[K]) => void
  setSettingsOpen: (open: boolean) => void
  setHelpOpen: (open: boolean) => void
  setAboutOpen: (open: boolean) => void
  setSidebarOpen: (open: boolean) => void
  setSearch: (q: string) => void
  setPointerLocked: (locked: boolean) => void
}

export const SPEED_MIN = 1
export const SPEED_MAX = 100000

export const useAppStore = create<AppState>((set, get) => ({
  selectedId: 'earth',
  hoveredId: null,
  cameraMode: 'orbit',
  displayMode: 'educational',
  focusId: 'sun',
  follow: true,
  focusNonce: 0,
  overviewNonce: 0,
  playing: true,
  speed: 1,
  direction: 1,
  settings: {
    orbits: true,
    labels: true,
    trails: true,
    predicted: false,
    asteroidBelt: true,
    kuiperBelt: true,
    atmospheres: true,
    stars: true,
    velocityVectors: false,
    hillSpheres: false,
    markers: true,
    eclipticGrid: false,
    shadows: false,
    postFX: true,
    sizeBoost: 1,
  },
  settingsOpen: false,
  helpOpen: false,
  aboutOpen: false,
  sidebarOpen: true,
  search: '',
  pointerLocked: false,

  select: (id, focus = true) => {
    if (!id) {
      set({ selectedId: null })
      return
    }
    const state = get()
    set({ selectedId: id })
    if (focus && state.cameraMode === 'orbit') {
      set({
        focusId: id,
        follow: true,
        focusNonce: state.focusNonce + 1,
      })
    }
  },
  setHovered: (id) => set({ hoveredId: id }),
  setCameraMode: (mode) => set({ cameraMode: mode }),
  setDisplayMode: (mode) => set({ displayMode: mode }),
  setFocus: (id) => set((s) => ({ focusId: id, follow: true, focusNonce: s.focusNonce + 1 })),
  setFollow: (follow) => set({ follow }),
  requestOverview: () =>
    set((s) => ({ overviewNonce: s.overviewNonce + 1, focusId: 'sun', follow: true })),
  setPlaying: (playing) => set({ playing }),
  togglePlaying: () => set((s) => ({ playing: !s.playing })),
  setSpeed: (speed) => set({ speed: Math.min(SPEED_MAX, Math.max(SPEED_MIN, speed)) }),
  setDirection: (dir) => set({ direction: dir }),
  resetTime: () => set({ direction: 1, playing: true }),
  toggleSetting: (key) =>
    set((s) => {
      const value = s.settings[key]
      if (typeof value === 'boolean') {
        return { settings: { ...s.settings, [key]: !value } }
      }
      return s
    }),
  setSetting: (key, value) => set((s) => ({ settings: { ...s.settings, [key]: value } })),
  setSettingsOpen: (open) => set({ settingsOpen: open }),
  setHelpOpen: (open) => set({ helpOpen: open }),
  setAboutOpen: (open) => set({ aboutOpen: open }),
  setSidebarOpen: (open) => set({ sidebarOpen: open }),
  setSearch: (q) => set({ search: q }),
  setPointerLocked: (locked) => set({ pointerLocked: locked }),
}))
