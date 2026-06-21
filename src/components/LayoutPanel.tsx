import { useState } from 'react'
import type { Layout, Doorway, Showcase } from '../simulation/types'

interface Props {
  layout: Layout
  onToggleDoorway: (doorwayId: string) => void
  onToggleShowcase: (showcaseId: string) => void
  onNudgeShowcase: (showcaseId: string, dx: number, dz: number) => void
  onApplyAndReset: () => void
}

export function LayoutPanel({ layout, onToggleDoorway, onToggleShowcase, onNudgeShowcase, onApplyAndReset }: Props) {
  const [tick, setTick] = useState(0)
  void tick

  const bump = () => setTick(t => t + 1)

  return (
    <div className="panel layout-panel">
      <h3>🗺️ 布局调整</h3>

      <div className="section-title">门洞开关</div>
      <div className="scroll-area" style={{ maxHeight: 140 }}>
        {layout.doorways.map(dw => (
          <div key={dw.id} className="toggle-row">
            <span className="toggle-name">
              {dw.name || dw.id}
              <span className="toggle-sub">
                ({dw.center.x.toFixed(0)}, {dw.center.z.toFixed(0)})
              </span>
            </span>
            <button
              className={dw.enabled ? 'active' : ''}
              onClick={() => { onToggleDoorway(dw.id); bump() }}
            >
              {dw.enabled ? '✓ 开启' : '✗ 关闭'}
            </button>
          </div>
        ))}
      </div>

      <div className="section-title">展柜管理</div>
      <div className="scroll-area" style={{ maxHeight: 240 }}>
        {layout.showcases.map(sc => (
          <div key={sc.id} className="showcase-item">
            <div className="showcase-header">
              <span className="toggle-name">
                {sc.name || sc.id}
                <span className="toggle-sub">
                  ({sc.position.x.toFixed(1)}, {sc.position.z.toFixed(1)})
                </span>
              </span>
              <button
                className={sc.enabled ? 'active' : ''}
                style={{ fontSize: 11, padding: '3px 8px' }}
                onClick={() => { onToggleShowcase(sc.id); bump() }}
              >
                {sc.enabled ? '启用' : '隐藏'}
              </button>
            </div>
            <div className="nudge-group">
              <span style={{ fontSize: 10, color: '#888' }}>位置微调：</span>
              <button onClick={() => { onNudgeShowcase(sc.id, 0, -0.5); bump() }}>↑</button>
              <button onClick={() => { onNudgeShowcase(sc.id, -0.5, 0); bump() }}>←</button>
              <button onClick={() => { onNudgeShowcase(sc.id, 0.5, 0); bump() }}>→</button>
              <button onClick={() => { onNudgeShowcase(sc.id, 0, 0.5); bump() }}>↓</button>
            </div>
          </div>
        ))}
      </div>

      <button className="primary full-width" onClick={onApplyAndReset} style={{ marginTop: 10 }}>
        🚀 应用布局并重新推演
      </button>
    </div>
  )
}

export type { Doorway, Showcase }
