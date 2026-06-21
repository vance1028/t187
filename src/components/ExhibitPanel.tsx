import type { SimulationStats } from '../simulation/types'

interface Props {
  stats: SimulationStats
}

export function ExhibitPanel({ stats }: Props) {
  const sorted = [...stats.exhibitStats].sort((a, b) => {
    const sa = a.viewingCount + a.queueCount
    const sb = b.viewingCount + b.queueCount
    return sb - sa
  })

  return (
    <div className="panel exhibit-panel">
      <h3>🎨 展品排队</h3>
      <div style={{ fontSize: 11, color: '#a0a0c0', marginBottom: 4 }}>
        按人气排序 · ★ 镇馆之宝
      </div>
      <div className="exhibit-list" style={{ maxHeight: '100%', overflowY: 'auto' }}>
        {sorted.map(e => {
          const total = e.viewingCount + e.queueCount
          const busy = total >= 6
          const crowded = total >= 10
          return (
            <div
              key={e.exhibitId}
              className={`exhibit-item ${e.isKeyExhibit ? 'star' : ''}`}
              style={{
                borderLeft: crowded
                  ? '3px solid #e94560'
                  : busy
                  ? '3px solid #fbbf24'
                  : '3px solid transparent'
              }}
            >
              <span className="name" style={{ fontSize: 11 }}>
                {e.exhibitName}
              </span>
              <div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
                <span
                  style={{
                    fontSize: 10,
                    color: e.viewingCount > 0 ? '#4ade80' : '#6a6a8a'
                  }}
                >
                  观{e.viewingCount}
                </span>
                <span
                  className="queue"
                  style={{
                    color:
                      e.queueCount >= 5 ? '#e94560'
                      : e.queueCount >= 3 ? '#fbbf24'
                      : '#60a5fa',
                    fontSize: 11
                  }}
                >
                  队{e.queueCount}
                </span>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
