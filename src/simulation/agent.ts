import type { Agent, AgentPreferences, Exhibit, Layout, ProfileDistribution, Vec2, VisitorProfileId } from './types'
import { AgentState } from './types'
import type { SeededRandom } from './random'
import type { Grid } from './pathfinding'
import { aStar } from './pathfinding'
import { getHallIdAtPoint, pickProfile, VISITOR_PROFILES } from './layout'

const AGENT_COLORS = [
  0x4ade80, 0x60a5fa, 0xf472b6, 0xfbbf24, 0xa78bfa,
  0xfb923c, 0x34d399, 0xf87171, 0x22d3ee, 0xe879f9
]

export function createAgentPreferences(
  rng: SeededRandom,
  keyExhibitBias: number,
  avgStayTime: number,
  avgSpeed: number,
  profileDist: ProfileDistribution
): AgentPreferences {
  const profileId = pickProfile(rng, profileDist)
  const profile = VISITOR_PROFILES[profileId]

  const keyPref = Math.max(0, Math.min(1, profile.keyExhibitWeight * (0.85 + rng.range(-0.15, 0.15)) + keyExhibitBias * 0.2))
  const stayMult = profile.stayTimeMultiplier * rng.range(0.85, 1.15) * (avgStayTime / 20)
  const speedMult = profile.speedMultiplier * rng.range(0.9, 1.1) * (avgSpeed / 1.4)
  const visitCount = rng.int(profile.visitCountMin, profile.visitCountMax)

  return {
    keyExhibitWeight: keyPref,
    stayTimeMultiplier: stayMult,
    speedMultiplier: speedMult,
    visitCount,
    profile: profileId
  }
}

export function profileToColor(profile: VisitorProfileId): number {
  const hex = VISITOR_PROFILES[profile].color.replace('#', '')
  return parseInt(hex, 16)
}

export function createAgent(
  id: number,
  spawnPosition: Vec2,
  rng: SeededRandom,
  keyExhibitBias: number,
  avgStayTime: number,
  avgSpeed: number,
  profileDist: ProfileDistribution,
  createdAt: number
): Agent {
  const prefs = createAgentPreferences(rng, keyExhibitBias, avgStayTime, avgSpeed, profileDist)
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
    radius: 0.32,
    baseSpeed: 1.4,
    color: profileToColor(prefs.profile),
    hallId: null,
    createdAt,
    exitAt: null,
    queuePosition: -1,
    queueStartedAt: null
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
  const availableExhibits = layout.exhibits.filter(e => {
    if (agent.visitedExhibitIds.has(e.id)) return false
    if (e.showcaseId) {
      const sc = layout.showcases.find(s => s.id === e.showcaseId)
      if (sc && !sc.enabled) return false
    }
    return true
  })
  const weights = availableExhibits.map(e => {
    let w = e.attractiveness
    if (e.isKeyExhibit) w *= (0.5 + agent.preferences.keyExhibitWeight)
    const dx = e.position.x - agent.position.x
    const dz = e.position.z - agent.position.z
    const dist = Math.sqrt(dx * dx + dz * dz)
    const distFactor = Math.max(0.1, 1 - dist / 60)
    w *= (0.4 + 0.6 * distFactor)
    return Math.max(0.01, w)
  })
  if (availableExhibits.length === 0) return null
  if (agent.visitedExhibitIds.size >= agent.preferences.visitCount) return null
  return rng.weightedPick(availableExhibits, weights)
}

export function getExhibitApproachPoint(exhibit: Exhibit): Vec2 {
  const offset = 1.5
  const angle = exhibit.rotation
  return {
    x: exhibit.position.x - Math.sin(angle) * offset,
    z: exhibit.position.z - Math.cos(angle) * offset
  }
}

export function getExhibitQueueSlot(exhibit: Exhibit, position: number): Vec2 {
  const base = getExhibitApproachPoint(exhibit)
  const step = 0.75
  const angle = exhibit.rotation
  const dx = -Math.sin(angle)
  const dz = -Math.cos(angle)
  return {
    x: base.x + dx * step * position,
    z: base.z + dz * step * position
  }
}

export function planPathToTarget(
  agent: Agent,
  grid: Grid,
  target: Vec2
): Vec2[] {
  return aStar(grid, agent.position, target)
}

export function advanceAgentAlongPath(
  agent: Agent,
  dt: number,
  speedMultiplier: number,
  maxMove: number = Infinity
): boolean {
  if (agent.path.length === 0 || agent.pathIndex >= agent.path.length) return false
  const effectiveSpeed = Math.min(maxMove / dt, agent.baseSpeed * agent.preferences.speedMultiplier * speedMultiplier)
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
