import { Agent, AgentPreferences, Exhibit, Layout, Vec2 } from './types'
import { AgentState } from './types'
import type { SeededRandom } from './random'
import type { Grid } from './pathfinding'
import { aStar } from './pathfinding'
import { getHallIdAtPoint } from './layout'

const AGENT_COLORS = [
  0x4ade80, 0x60a5fa, 0xf472b6, 0xfbbf24, 0xa78bfa,
  0xfb923c, 0x34d399, 0xf87171, 0x22d3ee, 0xe879f9
]

export function createAgentPreferences(rng: SeededRandom, keyExhibitBias: number, avgStayTime: number, avgSpeed: number): AgentPreferences {
  const keyPref = rng.range(Math.max(0, keyExhibitBias - 0.3), Math.min(1, keyExhibitBias + 0.3))
  const stayMult = rng.range(0.6, 1.6) * (avgStayTime / 20)
  const speedMult = rng.range(0.7, 1.3) * (avgSpeed / 1.4)
  const visitCount = rng.int(5, 12)
  return {
    keyExhibitWeight: keyPref,
    stayTimeMultiplier: stayMult,
    speedMultiplier: speedMult,
    visitCount
  }
}

export function createAgent(
  id: number,
  spawnPosition: Vec2,
  rng: SeededRandom,
  keyExhibitBias: number,
  avgStayTime: number,
  avgSpeed: number,
  createdAt: number
): Agent {
  const prefs = createAgentPreferences(rng, keyExhibitBias, avgStayTime, avgSpeed)
  return {
    id,
    position: { ...spawnPosition },
    velocity: { x: 0, z: 0 },
    target: null,
    state: AgentState.ENTERING,
    preferences: prefs,
    currentExhibitId: null,
    visitedExhibitIds: new Set(),
    nextExhibitId: null,
    stayTimeRemaining: 0,
    waitTime: 0,
    path: [],
    pathIndex: 0,
    radius: 0.28,
    baseSpeed: 1.4,
    color: AGENT_COLORS[id % AGENT_COLORS.length],
    hallId: null,
    createdAt,
    exitAt: null,
    queuePosition: 0
  }
}

export function computeExhibitWeights(
  agent: Agent,
  exhibits: Exhibit[]
): { exhibits: Exhibit[]; weights: number[] } {
  const available = exhibits.filter(e => !agent.visitedExhibitIds.has(e.id))
  const weights = available.map(e => {
    let w = e.attractiveness
    if (e.isKeyExhibit) w *= (0.5 + agent.preferences.keyExhibitWeight)
    const dx = e.position.x - agent.position.x
    const dz = e.position.z - agent.position.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    const distFactor = Math.max(0.1, 1 - dist / 60)
    w *= (0.4 + 0.6 * distFactor)
    return Math.max(0.01, w)
  })
  return { exhibits: available, weights }
}

export function pickNextExhibit(
  agent: Agent,
  layout: Layout,
  rng: SeededRandom
): Exhibit | null {
  const { exhibits: available, weights } = computeExhibitWeights(agent, layout.exhibits)
  if (available.length === 0) return null
  if (agent.visitedExhibitIds.size >= agent.preferences.visitCount) return null
  return rng.weightedPick(available, weights)
}

export function getExhibitApproachPoint(exhibit: Exhibit): Vec2 {
  const offset = 1.4
  const angle = exhibit.rotation
  return {
    x: exhibit.position.x - Math.sin(angle) * offset,
    z: exhibit.position.z - Math.cos(angle) * offset
  }
}

export function planPathToTarget(
  agent: Agent,
  grid: Grid,
  target: Vec2
): Vec2[] {
  const path = aStar(grid, agent.position, target)
  return path
}

export function advanceAgentAlongPath(
  agent: Agent,
  dt: number,
  speedMultiplier: number
): boolean {
  if (agent.path.length === 0 || agent.pathIndex >= agent.path.length) return false
  const effectiveSpeed = agent.baseSpeed * agent.preferences.speedMultiplier * speedMultiplier
  let remaining = effectiveSpeed * dt

  while (remaining > 0 && agent.pathIndex < agent.path.length) {
    const target = agent.path[agent.pathIndex]
    const dx = target.x - agent.position.x
    const dz = target.z - agent.position.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < 0.001) {
      agent.pathIndex++
      continue
    }
    if (dist <= remaining) {
      agent.position.x = target.x
      agent.position.z = target.z
      agent.velocity.x = (dx / dist) * effectiveSpeed
      agent.velocity.z = (dz / dist) * effectiveSpeed
      remaining -= dist
      agent.pathIndex++
    } else {
      const nx = dx / dist
      const nz = dz / dist
      agent.position.x += nx * remaining
      agent.position.z += nz * remaining
      agent.velocity.x = nx * effectiveSpeed
      agent.velocity.z = nz * effectiveSpeed
      remaining = 0
    }
  }

  return agent.pathIndex >= agent.path.length
}

export function updateAgentHall(agent: Agent, layout: Layout) {
  agent.hallId = getHallIdAtPoint(layout, agent.position)
}

export function distanceToTarget(agent: Agent, target: Vec2): number {
  const dx = target.x - agent.position.x
  const dz = target.z - agent.position.z
  return Math.sqrt(dx * dx + dz * dz)
}
