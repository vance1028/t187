import type {
  Agent, Exhibit, Heatmap, HotspotInfo,
  Layout, SimulationParams, SimulationStats, Vec2
} from './types'
import { AgentState } from './types'
import { SeededRandom } from './random'
import { createDefaultLayout, getHallIdAtPoint } from './layout'
import type { Grid } from './pathfinding'
import { buildGrid, aStar, findNearestWalkable } from './pathfinding'
import {
  createAgent, pickNextExhibit, getExhibitApproachPoint,
  advanceAgentAlongPath, updateAgentHall, distanceToTarget
} from './agent'
import { applyCrowdAvoidance } from './crowd'
import { createHeatmap, updateHeatmap } from './heatmap'

type AgentListener = (a: Agent) => void

export class MuseumSimulator {
  layout: Layout
  grid: Grid
  agents: Agent[] = []
  heatmap: Heatmap
  params: SimulationParams
  rng: SeededRandom

  time: number = 0
  speed: number = 1
  paused: boolean = false

  nextAgentId: number = 1
  spawnAccum: number = 0
  totalEntered: number = 0
  totalExited: number = 0

  stats: SimulationStats

  private activeMask: boolean[] = []
  private exhibitQueueMap: Map<string, Agent[]> = new Map()
  private listeners: AgentListener[] = []

  constructor(params?: Partial<SimulationParams>) {
    this.layout = createDefaultLayout()
    this.grid = buildGrid(this.layout)
    this.heatmap = createHeatmap(this.layout)
    this.params = {
      spawnRate: 1.2,
      maxAgents: 120,
      keyExhibitBias: 0.7,
      avgStayTime: 20,
      avgSpeed: 1.4,
      seed: 42,
      heatmapDecay: 0.9995,
      ...params
    }
    this.rng = new SeededRandom(this.params.seed)
    this.stats = this.buildStats()
  }

  reset(newSeed?: number, newParams?: Partial<SimulationParams>) {
    if (newParams) {
      this.params = { ...this.params, ...newParams }
    }
    if (newSeed !== undefined) {
      this.params.seed = newSeed
    }
    this.rng = new SeededRandom(this.params.seed)
    this.agents = []
    this.heatmap = createHeatmap(this.layout)
    this.grid = buildGrid(this.layout)
    this.time = 0
    this.nextAgentId = 1
    this.spawnAccum = 0
    this.totalEntered = 0
    this.totalExited = 0
    this.activeMask = []
    this.exhibitQueueMap.clear()
    this.stats = this.buildStats()
  }

  rebuildLayout() {
    this.grid = buildGrid(this.layout)
    this.heatmap = createHeatmap(this.layout)
  }

  setParams(params: Partial<SimulationParams>) {
    this.params = { ...this.params, ...params }
  }

  setPaused(p: boolean) { this.paused = p }
  setSpeed(s: number) { this.speed = Math.max(0.1, Math.min(60, s)) }

  step(realDt: number) {
    if (this.paused) return
    const simDt = realDt * this.speed
    const maxStep = 0.08
    let remaining = simDt
    while (remaining > 0) {
      const dt = Math.min(maxStep, remaining)
      this.doStep(dt)
      remaining -= dt
    }
    this.stats = this.buildStats()
  }

  private doStep(dt: number) {
    this.time += dt

    this.handleSpawning(dt)
    this.updateAgentStates(dt)
    this.applyCrowd(dt)
    updateHeatmap(this.heatmap, this.agents, dt, this.params.heatmapDecay)
    this.cleanupExited()
  }

  private handleSpawning(dt: number) {
    if (this.agents.length >= this.params.maxAgents) return
    this.spawnAccum += this.params.spawnRate * dt
    while (this.spawnAccum >= 1) {
      this.spawnAccum -= 1
      this.spawnAgent()
      if (this.agents.length >= this.params.maxAgents) break
    }
  }

  private spawnAgent() {
    const entrance = this.layout.entrances[0]
    if (!entrance) return
    const offset = (this.rng.next() - 0.5) * entrance.width * 0.6
    const spawnPos: Vec2 = {
      x: entrance.position.x + offset,
      z: entrance.position.z + this.rng.range(0.5, 2)
    }
    const safe = findNearestWalkable(this.grid, spawnPos, 3) || spawnPos
    const a = createAgent(
      this.nextAgentId++,
      safe,
      this.rng,
      this.params.keyExhibitBias,
      this.params.avgStayTime,
      this.params.avgSpeed,
      this.time
    )
    updateAgentHall(a, this.layout)
    this.decideNextTarget(a)
    this.agents.push(a)
    this.totalEntered++
  }

  private decideNextTarget(a: Agent) {
    const wantExit =
      a.visitedExhibitIds.size >= a.preferences.visitCount ||
      this.rng.next() < 0.05 && a.visitedExhibitIds.size > 2

    if (wantExit) {
      this.setAgentToExit(a)
      return
    }

    const exhibit = pickNextExhibit(a, this.layout, this.rng)
    if (!exhibit) {
      this.setAgentToExit(a)
      return
    }

    a.nextExhibitId = exhibit.id
    const approach = this.findApproachForExhibit(a, exhibit)
    if (!approach) {
      a.visitedExhibitIds.add(exhibit.id)
      this.decideNextTarget(a)
      return
    }
    this.setAgentPath(a, approach, AgentState.TO_EXHIBIT)
  }

  private findApproachForExhibit(a: Agent, exhibit: Exhibit): Vec2 | null {
    const base = getExhibitApproachPoint(exhibit)
    const attempts: Vec2[] = [base]
    for (let i = 0; i < 6; i++) {
      const ang = this.rng.next() * Math.PI * 2
      const r = 1.2 + this.rng.next() * 0.8
      attempts.push({
        x: exhibit.position.x + Math.cos(ang) * r,
        z: exhibit.position.z + Math.sin(ang) * r
      })
    }
    for (const pt of attempts) {
      const path = aStar(this.grid, a.position, pt)
      if (path.length > 0) {
        return path[path.length - 1]
      }
    }
    return null
  }

  private setAgentToExit(a: Agent) {
    const exit = this.layout.exits[0]
    if (!exit) {
      a.state = AgentState.EXITED
      return
    }
    const exitPt: Vec2 = { x: exit.position.x, z: exit.position.z }
    this.setAgentPath(a, exitPt, AgentState.TO_EXIT)
  }

  private setAgentPath(a: Agent, target: Vec2, state: AgentState) {
    const path = aStar(this.grid, a.position, target)
    if (path.length === 0) {
      a.waitTime = 1
      a.state = state
      return
    }
    a.path = path
    a.pathIndex = 1
    a.target = target
    a.state = state
  }

  private updateAgentStates(dt: number) {
    this.activeMask = new Array(this.agents.length).fill(true)
    this.exhibitQueueMap.clear()

    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i]

      if (a.stayTimeRemaining > 0) {
        a.stayTimeRemaining -= dt
        a.velocity.x = 0
        a.velocity.z = 0
        this.activeMask[i] = false
        if (a.currentExhibitId) {
          if (!this.exhibitQueueMap.has(a.currentExhibitId)) {
            this.exhibitQueueMap.set(a.currentExhibitId, [])
          }
          this.exhibitQueueMap.get(a.currentExhibitId)!.push(a)
        }
        if (a.stayTimeRemaining <= 0) {
          if (a.currentExhibitId) {
            a.visitedExhibitIds.add(a.currentExhibitId)
          }
          a.currentExhibitId = null
          this.decideNextTarget(a)
        }
        continue
      }

      if (a.state === AgentState.ENTERING) {
        this.decideNextTarget(a)
      }

      if (a.state === AgentState.STUCK) {
        a.waitTime -= dt
        a.velocity.x *= 0.8
        a.velocity.z *= 0.8
        if (a.waitTime <= 0) {
          this.decideNextTarget(a)
        }
        continue
      }

      if (a.state === AgentState.TO_EXHIBIT || a.state === AgentState.TO_EXIT) {
        if (a.path.length === 0 || a.pathIndex >= a.path.length) {
          this.onReachTarget(a)
        } else {
          const speedAdjust = this.getQueueAdjustment(a)
          advanceAgentAlongPath(a, dt, speedAdjust)
          if (a.path.length > 0 && a.pathIndex >= a.path.length) {
            this.onReachTarget(a)
          }
        }
      }

      if (a.state === AgentState.TO_EXIT && a.target) {
        if (distanceToTarget(a, a.target) < 1.5) {
          a.state = AgentState.EXITED
          a.exitAt = this.time
          this.totalExited++
        }
      }

      updateAgentHall(a, this.layout)
    }
  }

  private getQueueAdjustment(a: Agent): number {
    if (a.state !== AgentState.TO_EXHIBIT || !a.nextExhibitId) return 1
    const target = this.layout.exhibits.find(e => e.id === a.nextExhibitId)
    if (!target) return 1
    const dist = distanceToTarget(a, target.position)
    if (dist > 5) return 1
    const queue = this.exhibitQueueMap.get(a.nextExhibitId) || []
    const queueLen = queue.length
    const viewing = queue.filter(q => q.stayTimeRemaining > 0).length
    if (viewing >= 4 && dist < 3) {
      return Math.max(0.1, 1 - (viewing - 4) * 0.18)
    }
    return Math.max(0.3, 1 - queueLen * 0.04)
  }

  private onReachTarget(a: Agent) {
    if (a.state === AgentState.TO_EXHIBIT && a.nextExhibitId) {
      const ex = this.layout.exhibits.find(e => e.id === a.nextExhibitId)
      if (ex) {
        a.currentExhibitId = ex.id
        a.nextExhibitId = null
        a.stayTimeRemaining = ex.baseStayTime * a.preferences.stayTimeMultiplier
        a.state = AgentState.VIEWING
        a.velocity.x = 0
        a.velocity.z = 0
        return
      }
    }
    a.state = AgentState.STUCK
    a.waitTime = 2
  }

  private applyCrowd(dt: number) {
    applyCrowdAvoidance(this.agents, this.layout, dt, this.activeMask)
  }

  private cleanupExited() {
    const keep: Agent[] = []
    for (const a of this.agents) {
      if (a.state !== AgentState.EXITED) keep.push(a)
    }
    this.agents = keep
  }

  private buildStats(): SimulationStats {
    const hallCount = new Map<string, number>()
    for (const h of this.layout.halls) hallCount.set(h.id, 0)
    for (const a of this.agents) {
      if (a.hallId && hallCount.has(a.hallId)) {
        hallCount.set(a.hallId, hallCount.get(a.hallId)! + 1)
      }
    }

    const hallStats = this.layout.halls.map(h => ({
      hallId: h.id,
      hallName: h.name,
      agentCount: hallCount.get(h.id) || 0
    }))

    const exhibitStats = this.layout.exhibits.map(e => {
      const agentsAt = this.agents.filter(a => a.currentExhibitId === e.id || a.nextExhibitId === e.id)
      const viewing = agentsAt.filter(a => a.currentExhibitId === e.id).length
      const queue = agentsAt.filter(a => a.nextExhibitId === e.id &&
        distanceToTarget(a, e.position) < 4).length
      return {
        exhibitId: e.id,
        exhibitName: e.name,
        isKeyExhibit: e.isKeyExhibit,
        viewingCount: viewing,
        queueCount: queue,
        avgQueueTime: queue > 0 ? queue * 8 : 0
      }
    })

    const hotspots = this.computeHotspots()

    return {
      time: this.time,
      speedMultiplier: this.speed,
      isPaused: this.paused,
      currentAgents: this.agents.length,
      totalEntered: this.totalEntered,
      totalExited: this.totalExited,
      hallStats,
      hotspots,
      exhibitStats
    }
  }

  private computeHotspots(): HotspotInfo[] {
    type Cell = { x: number; z: number; val: number }
    const cells: Cell[] = []
    const h = this.heatmap
    for (let y = 0; y < h.gridHeight; y++) {
      for (let x = 0; x < h.gridWidth; x++) {
        const val = h.cells[y][x].count
        if (val > 1.5) {
          cells.push({ x, z: y, val })
        }
      }
    }
    cells.sort((a, b) => b.val - a.val)
    const selected: Cell[] = []
    const minDist = 4
    for (const c of cells) {
      let tooClose = false
      for (const s of selected) {
        const dx = c.x - s.x
        const dz = c.z - s.z
        if (dx * dx + dz * dz < minDist * minDist) { tooClose = true; break }
      }
      if (!tooClose) selected.push(c)
      if (selected.length >= 6) break
    }
    return selected.map(c => {
      const wx = h.origin.x + (c.x + 0.5) * h.cellSize
      const wz = h.origin.z + (c.z + 0.5) * h.cellSize
      const hall = getHallIdAtPoint(this.layout, { x: wx, z: wz })
      const hallName = hall ? (this.layout.halls.find(h => h.id === hall)?.name || '') : ''
      return {
        position: { x: wx, z: wz },
        agentCount: Math.round(c.val),
        label: `${hallName} 热点`
      }
    })
  }
}
