import type { SimulationStats } from '../simulation/types'

interface Props {
  stats: SimulationStats
}

function fmtTime(t: number): string {
  const m = Math.floor(t / 60)
  const s = Math.floor(t % 60)
  return `${m.toString().padStart(2, '0')}:${s.toString().padStart(2, '0')}`
}

export function StatsPanel({ stats }: Props) {
  const totalCapacity = 150
  const capacityPct = Math.min(100, (stats.currentAgents / totalCapacity) * 100)
  const capacityClass =
    capacityPct >= 85 ? 'alert' : capacityPct >= 60 ? 'warning' : ''
  void capacityPct

  return (
    <div className="panel stats-panel">
      <h3>📊 实时统计</h3>
      <div className="scroll-area">
        <div className="stat-grid">
          <div className={`stat-card ${capacityClass}`}>
            <div className="label">当前在馆</div>
            <div className="value">{stats.currentAgents}</div>
          </div>
          <div className="stat-card">
            <div className="label">累计入场</div>
            <div className="value">{stats.totalEntered}</div>
          </div>
          <div className="stat-card">
            <div className="label">已离馆</div>
            <div className="value">{stats.totalExited}</div>
          </div>
          <div className="stat-card">
            <div className="label">仿真时间</div>
            <div className="value">{fmtTime(stats.time)}</div>
          </div>
          <div className="stat-card">
            <div className="label">加速倍数</div>
            <div className="value">{stats.speedMultiplier}×</div>
          </div>
          <div className={`stat-card ${stats.isPaused ? 'warning' : ''}`}>
            <div className="label">状态</div>
            <div className="value" style={{ fontSize: 16 }}>
              {stats.isPaused ? '⏸ 已暂停' : '▶ 运行中'}
            </div>
          </div>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 10, marginTop: 10 }}>
          <div>
            <div style={{ fontSize: 12, color: '#a0a0c0', marginBottom: 4 }}>
              🏛️ 各展厅人数
            </div>
            <div className="hall-list">
              {stats.hallStats.map(h => {
                return (
                  <div key={h.hallId} className="hall-item">
                    <span className="hall-name">{h.hallName}</span>
                    <span
                      className="hall-count"
                      style={{
                        color:
                          h.agentCount >= 30 ? '#e94560'
                          : h.agentCount >= 15 ? '#fbbf24'
                          : '#4ade80'
                      }}
                    >
                      {h.agentCount} 人
                    </span>
                  </div>
                )
              })}
            </div>
          </div>

          <div>
            <div style={{ fontSize: 12, color: '#a0a0c0', marginBottom: 4 }}>
              🔥 拥堵热点 Top {stats.hotspots.length}
            </div>
            <div className="hotspot-list">
              {stats.hotspots.length === 0 ? (
                <div style={{ fontSize: 11, color: '#6a6a8a', padding: '8px 4px' }}>
                  暂无明显拥堵…
                </div>
              ) : (
                  stats.hotspots.map((h, i) => (
                    <div key={i} className="hotspot-item">
                      <span className="name">
                        {i + 1}. {h.label} ({h.position.x.toFixed(0)}, {h.position.z.toFixed(0)})
                      </span>
                      <span className="count">{h.agentCount}</span>
                    </div>
                  ))
                )}
            </div>
          </div>
          <div style={{ height: 8 }} />
        </div>
      </div>
    </div>
  )
}
