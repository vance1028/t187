import type { SimulationParams, SimulationStats } from '../simulation/types'

interface Props {
  params: SimulationParams
  stats: SimulationStats
  onParamsChange: (p: Partial<SimulationParams>) => void
  onReset: (newSeed: boolean) => void
  onPauseToggle: () => void
  onSetSpeed: (s: number) => void
}

const SPEED_PRESETS = [0.5, 1, 2, 4, 8, 16, 32]

export function ControlPanel({ params, stats, onParamsChange, onReset, onPauseToggle, onSetSpeed }: Props) {
  return (
    <div className="panel control-panel">
      <h3>🎛️ 仿真控制</h3>

      <div className="button-group">
        <button
          className={stats.isPaused ? 'primary' : ''}
          onClick={onPauseToggle}
        >
          {stats.isPaused ? '▶ 继续' : '⏸ 暂停'}
        </button>
        <button onClick={() => onReset(false)}>↻ 重跑</button>
        <button onClick={() => onReset(true)}>🎲 新种子</button>
      </div>

      <div style={{ fontSize: 11, color: '#a0a0c0', marginTop: 4 }}>
        速度倍数
      </div>
      <div className="button-group">
        {SPEED_PRESETS.map(s => (
          <button
            key={s}
            className={Math.abs(stats.speedMultiplier - s) < 0.01 ? 'active' : ''}
            onClick={() => onSetSpeed(s)}
          >
            {s}×
          </button>
        ))}
      </div>

      <div className="control-row">
        <label>
          入场速率 (人/秒)
          <span>{params.spawnRate.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min="0"
          max="8"
          step="0.1"
          value={params.spawnRate}
          onChange={e => onParamsChange({ spawnRate: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-row">
        <label>
          最大观众数
          <span>{params.maxAgents}</span>
        </label>
        <input
          type="range"
          min="10"
          max="300"
          step="5"
          value={params.maxAgents}
          onChange={e => onParamsChange({ maxAgents: parseInt(e.target.value) })}
        />
      </div>

      <div className="control-row">
        <label>
          重点展项偏好
          <span>{(params.keyExhibitBias * 100).toFixed(0)}%</span>
        </label>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={params.keyExhibitBias}
          onChange={e => onParamsChange({ keyExhibitBias: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-row">
        <label>
          平均停留时间 (秒)
          <span>{params.avgStayTime.toFixed(0)}</span>
        </label>
        <input
          type="range"
          min="5"
          max="60"
          step="1"
          value={params.avgStayTime}
          onChange={e => onParamsChange({ avgStayTime: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-row">
        <label>
          行走速度 (米/秒)
          <span>{params.avgSpeed.toFixed(2)}</span>
        </label>
        <input
          type="range"
          min="0.5"
          max="3"
          step="0.1"
          value={params.avgSpeed}
          onChange={e => onParamsChange({ avgSpeed: parseFloat(e.target.value) })}
        />
      </div>

      <div className="control-row">
        <label>
          随机种子
          <span>#{params.seed}</span>
        </label>
      </div>

      <div style={{ fontSize: 11, color: '#7a7a9a', marginTop: 4, lineHeight: 1.5 }}>
        提示：「重跑」同种子完全复现；「新种子」换一套不同结果。
      </div>
    </div>
  )
}
