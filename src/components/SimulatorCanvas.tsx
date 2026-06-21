import { useEffect, useRef } from 'react'
import { MuseumRenderer } from '../rendering/MuseumRenderer'
import type { MuseumSimulator } from '../simulation/simulator'

interface Props {
  simulator: MuseumSimulator | null
  onRendererReady?: (r: MuseumRenderer) => void
}

export function SimulatorCanvas({ simulator, onRendererReady }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const rendererRef = useRef<MuseumRenderer | null>(null)
  const rafRef = useRef<number>(0)
  const lastTimeRef = useRef<number>(performance.now())

  useEffect(() => {
    if (!containerRef.current || !simulator) return

    const renderer = new MuseumRenderer(containerRef.current, simulator)
    rendererRef.current = renderer
    onRendererReady?.(renderer)

    lastTimeRef.current = performance.now()

    const loop = () => {
      const now = performance.now()
      let dt = (now - lastTimeRef.current) / 1000
      if (dt > 0.1) dt = 0.1
      lastTimeRef.current = now

      try {
        simulator.step(dt)
        renderer.update(dt, simulator)
        renderer.render()
      } catch (e) {
        console.error('Simulation/render error:', e)
      }

      rafRef.current = requestAnimationFrame(loop)
    }

    rafRef.current = requestAnimationFrame(loop)

    return () => {
      cancelAnimationFrame(rafRef.current)
      renderer.dispose()
      rendererRef.current = null
    }
  }, [simulator, onRendererReady])

  return <div ref={containerRef} style={{ width: '100%', height: '100%' }} />
}
