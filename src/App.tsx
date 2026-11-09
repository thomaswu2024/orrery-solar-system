import { useEffect } from 'react'
import { Scene } from './scene/Scene'
import { TopBar } from './ui/TopBar'
import { ObjectList } from './ui/ObjectList'
import { InfoPanel } from './ui/InfoPanel'
import { TimeBar } from './ui/TimeBar'
import { LabelsOverlay } from './ui/LabelsOverlay'
import { SettingsPanel } from './ui/SettingsPanel'
import { HelpPanel } from './ui/HelpPanel'
import { FpsMeter, FlightHud, LoadingScreen } from './ui/Hud'
import { useAppStore } from './state/store'
import { resetRuntimeClock } from './sim/runtime'

export default function App() {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.isContentEditable)) return
      const st = useAppStore.getState()
      if (e.code === 'Space') {
        e.preventDefault()
        st.togglePlaying()
        return
      }
      if (e.key === 'Escape') {
        if (st.settingsOpen) st.setSettingsOpen(false)
        if (st.helpOpen) st.setHelpOpen(false)
        return
      }
      const k = e.key.toLowerCase()
      if (k === 'r') {
        resetRuntimeClock()
        st.resetTime()
      } else if (k === 'o') {
        st.requestOverview()
      } else if (k === 'm') {
        st.setCameraMode(st.cameraMode === 'orbit' ? 'free' : 'orbit')
      } else if (k === 't') {
        st.setDisplayMode(st.displayMode === 'educational' ? 'true' : 'educational')
      } else if (k === 'f') {
        if (st.cameraMode !== 'orbit') return
        if (!st.follow) {
          st.setFollow(true)
          st.setFocus(st.focusId)
        } else {
          st.setFollow(false)
        }
      } else if (k === 'g') {
        st.toggleSetting('eclipticGrid')
      } else if (k === 'l') {
        st.toggleSetting('labels')
      } else if (e.key === '[') {
        st.setSpeed(Math.max(1, st.speed / 1.6))
      } else if (e.key === ']') {
        st.setSpeed(Math.min(100000, st.speed * 1.6))
      } else if (e.key === '?' || e.key === '/') {
        st.setHelpOpen(!st.helpOpen)
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [])

  return (
    <div className="app">
      <div className="scene-layer">
        <Scene />
      </div>
      <LabelsOverlay />
      <TopBar />
      <ObjectList />
      <InfoPanel />
      <FpsMeter />
      <FlightHud />
      <TimeBar />
      <SettingsPanel />
      <HelpPanel />
      <LoadingScreen />
      <div className="vignette-frame" />
    </div>
  )
}
