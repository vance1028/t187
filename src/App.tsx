import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { MuseumSimulator } from './simulation/simulator'
import type { SimulationParams, SimulationStats } from './simulation/types'
import { SimulatorCanvas } from './components/SimulatorCanvas'
import { ControlPanel } from './components/ControlPanel'
import { StatsPanel } from './components/StatsPanel'
import { ExhibitPanel } from './components/ExhibitPanel'

function App() {
  const simulatorRef = useRef<MuseumSimulator | null>(null)
  const [, setTick] = useState(0)
  const [params, setParams] = useState<SimulationParams>(() => ({
    spawnRate: 1.2,
    maxAgents: 120,
    keyExhibitBias: 0.7,
    avgStayTime: 20,
    avgSpeed: 1.4,
    seed: 42,
    heatmapDecay: 0.9995
  }))
  const [stats, setStats] = useState<SimulationStats>(() => defaultStats())

  const simulator = useMemo(() => {
    const sim = new MuseumSimulator(params)
    simulatorRef.current = sim
    return sim
  }, [])

  useEffect(() => {
    if (!simulator) return
    let last = performance.now()
    let uiAccum = 0
    let raf = 0
    const loop = () => {
      const now = performance.now()
      const dt = Math.min(0.1, (now - last) / 1000)
      last = now
      uiAccum += dt
      if (uiAccum > 0.12) {
        uiAccum = 0
        setStats({ ...simulator.stats })
        setTick(t => (t + 1) % 1000000)
      }
      raf = requestAnimationFrame(loop)
    }
    raf = requestAnimationFrame(loop)
    return () => cancelAnimationFrame(raf)
  }, [simulator])

  const handleParamsChange = useCallback((p: Partial<SimulationParams>) => {
    setParams(prev => {
      const next = { ...prev, ...p }
      if (simulatorRef.current) {
        simulatorRef.current.setParams(p)
      }
      return next
    })
  }, [])

  const handleReset = useCallback((newSeed: boolean) => {
    setParams(prev => {
      const seed = newSeed ? Math.floor(Math.random() * 1000000) : prev.seed
      const next = { ...prev, seed }
      simulatorRef.current?.reset(seed)
      return next
    })
  }, [])

  const handlePauseToggle = useCallback(() => {
    if (simulatorRef.current) {
      simulatorRef.current.setPaused(!simulatorRef.current.paused)
      setStats({ ...simulatorRef.current.stats })
    }
  }, [])

  const handleSetSpeed = useCallback((s: number) => {
    simulatorRef.current?.setSpeed(s)
    if (simulatorRef.current) setStats({ ...simulatorRef.current.stats })
  }, [])

  return (
    <div className="app-container">
      <div className="canvas-container">
        <SimulatorCanvas simulator={simulator} />
      </div>
      <div className="dashboard-container">
        <ControlPanel
          params={params}
          stats={stats}
          onParamsChange={handleParamsChange}
          onReset={handleReset}
          onPauseToggle={handlePauseToggle}
          onSetSpeed={handleSetSpeed}
        />
        <StatsPanel stats={stats} />
        <ExhibitPanel stats={stats} />
      </div>
    </div>
  )
}

function defaultStats(): SimulationStats {
  return {
    time: 0,
    speedMultiplier: 1,
    isPaused: false,
    currentAgents: 0,
    totalEntered: 0,
    totalExited: 0,
    hallStats: [],
    hotspots: [],
    exhibitStats: []
  }
}

export default App
