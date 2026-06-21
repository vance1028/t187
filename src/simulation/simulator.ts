import type {
  Agent, Exhibit, ExhibitQueue, ExhibitQueueRecord, Heatmap, HotspotInfo,
  Layout, SimulationParams, SimulationStats, Vec2
} from './types'
import { AgentState } from './types'
import { SeededRandom } from './random'
import { createDefaultLayout, DEFAULT_PROFILE_DISTRIBUTION, getHallIdAtPoint, isPointBlocked } from './layout'
import type { Grid } from './pathfinding'
import { buildGrid, aStar, findNearestWalkable } from './pathfinding'
import {
  createAgent, pickNextExhibit, getExhibitApproachPoint, getExhibitQueueSlot,
  advanceAgentAlongPath, updateAgentHall, distanceToTarget
} from './agent'
import { applyCrowdAvoidance } from './crowd'
import { createHeatmap, updateHeatmap } from './heatmap'

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
  private queues: Map<string, ExhibitQueue> = new Map()

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
      profileDistribution: { ...DEFAULT_PROFILE_DISTRIBUTION },
      ...params
    }
    this.rng = new SeededRandom(this.params.seed)
    this.initQueues()
    this.stats = this.buildStats()
  }

  private initQueues() {
    this.queues.clear()
    for (const ex of this.layout.exhibits) {
      const maxViewing = ex.isKeyExhibit ? 2 : 3
      this.queues.set(ex.id, {
        exhibitId: ex.id,
        viewing: [],
        waiting: [],
        maxViewing,
        totalWaitTimes: [],
        servedCount: 0
      })
    }
  }

  hardReset(newSeed?: number, newParams?: Partial<SimulationParams>) {
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
    this.initQueues()
    this.stats = this.buildStats()
  }

  reset(newSeed?: number) {
    this.hardReset(newSeed)
  }

  rebuildLayout() {
    this.grid = buildGrid(this.layout)
    this.heatmap = createHeatmap(this.layout)
    this.initQueues()
  }

  setParams(params: Partial<SimulationParams>) {
    this.params = { ...this.params, ...params }
  }

  setPaused(p: boolean) { this.paused = p }
  setSpeed(s: number) { this.speed = Math.max(0.1, Math.min(60, s)) }

  getQueue(exhibitId: string): ExhibitQueue | undefined {
    return this.queues.get(exhibitId)
  }

  getAllQueues(): Map<string, ExhibitQueue> {
    return this.queues
  }

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
    this.postStepCollisionFix()
    updateHeatmap(this.heatmap, this.agents, dt, this.params.heatmapDecay)
    this.cleanupExited()
  }

  private postStepCollisionFix() {
    const layout = this.layout
    const minX = layout.worldBounds.minX + 0.1
    const maxX = layout.worldBounds.maxX - 0.1
    const minZ = layout.worldBounds.minZ + 0.1
    const maxZ = layout.worldBounds.maxZ - 0.1

    for (const a of this.agents) {
      if (a.state === AgentState.EXITED) continue

      if (a.position.x < minX) { a.position.x = minX; a.velocity.x = Math.abs(a.velocity.x) * 0.3 }
      if (a.position.x > maxX) { a.position.x = maxX; a.velocity.x = -Math.abs(a.velocity.x) * 0.3 }
      if (a.position.z < minZ) { a.position.z = minZ; a.velocity.z = Math.abs(a.velocity.z) * 0.3 }
      if (a.position.z > maxZ) { a.position.z = maxZ; a.velocity.z = -Math.abs(a.velocity.z) * 0.3 }

      if (a.state === AgentState.VIEWING) {
        if (a.currentExhibitId) {
          const ex = this.layout.exhibits.find(e => e.id === a.currentExhibitId)
          if (ex) {
            const target = getExhibitApproachPoint(ex)
            const dx = target.x - a.position.x
            const dz = target.z - a.position.z
            const d = Math.sqrt(dx * dx + dz * dz)
            if (d > 2.2 && !isPointBlocked(this.layout, target, a.radius * 0.95)) {
              a.position.x = target.x
              a.position.z = target.z
            }
          }
        }
      }

      if (this.isAgentBlocked(a)) {
        this.extricateAgent(a)
      }
    }
  }

  private isAgentBlocked(a: Agent): boolean {
    return isPointBlocked(this.layout, a.position, a.radius * 0.95)
  }

  private extricateAgent(a: Agent) {
    const layout = this.layout
    const r = a.radius * 0.95
    if (!isPointBlocked(layout, a.position, r)) return

    const best = findNearestWalkable(this.grid, a.position, 12)
    if (best && !isPointBlocked(layout, best, r)) {
      a.position.x = best.x
      a.position.z = best.z
      a.velocity.x *= 0.2
      a.velocity.z *= 0.2
      return
    }

    for (let radius = 0.5; radius <= 15; radius += 0.25) {
      for (let ang = 0; ang < Math.PI * 2; ang += Math.PI / 24) {
        const tx = a.position.x + Math.cos(ang) * radius
        const tz = a.position.z + Math.sin(ang) * radius
        if (!isPointBlocked(layout, { x: tx, z: tz }, r)) {
          a.position.x = tx
          a.position.z = tz
          a.velocity.x *= 0.2
          a.velocity.z *= 0.2
          return
        }
      }
    }
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
      this.params.profileDistribution,
      this.time
    )
    updateAgentHall(a, this.layout)
    this.decideNextTarget(a)
    this.agents.push(a)
    this.totalEntered++
  }

  private decideNextTarget(a: Agent) {
    this.removeFromAnyQueue(a)

    const wantExit =
      a.visitedExhibitIds.size >= a.preferences.visitCount ||
      (this.rng.next() < 0.05 && a.visitedExhibitIds.size > 2)

    if (wantExit) {
      this.setAgentToExit(a)
      return
    }

    const exhibit = pickNextExhibit(a, this.layout, this.rng)
    if (!exhibit) {
      this.setAgentToExit(a)
      return
    }

    this.joinQueue(a, exhibit.id)
  }

  private joinQueue(a: Agent, exhibitId: string) {
    const q = this.queues.get(exhibitId)
    const ex = this.layout.exhibits.find(e => e.id === exhibitId)
    if (!q || !ex) {
      this.decideNextTarget(a)
      return
    }

    a.nextExhibitId = exhibitId
    a.queueStartedAt = this.time

    if (q.viewing.length < q.maxViewing) {
      q.viewing.push(a.id)
      a.queuePosition = 0
      const approach = this.findApproachForExhibit(a, ex)
      if (!approach) {
        a.visitedExhibitIds.add(ex.id)
        this.removeFromQueue(a, exhibitId)
        this.decideNextTarget(a)
        return
      }
      this.setAgentPath(a, approach, AgentState.TO_EXHIBIT)
    } else {
      const pos = q.waiting.length
      q.waiting.push({ agentId: a.id, joinedAt: this.time, position: pos })
      a.queuePosition = pos + 1
      const slot = getExhibitQueueSlot(ex, pos + 1)
      const safeSlot = findNearestWalkable(this.grid, slot, 2) || slot
      this.setAgentPath(a, safeSlot, AgentState.TO_EXHIBIT)
    }
  }

  private removeFromQueue(a: Agent, exhibitId: string) {
    const q = this.queues.get(exhibitId)
    if (!q) return
    q.viewing = q.viewing.filter(id => id !== a.id)
    q.waiting = q.waiting.filter(w => w.agentId !== a.id)
    this.reindexWaiting(q)
  }

  private removeFromAnyQueue(a: Agent) {
    for (const q of this.queues.values()) {
      const wasViewing = q.viewing.length
      q.viewing = q.viewing.filter(id => id !== a.id)
      if (q.viewing.length < wasViewing) {
        this.promoteFromWaiting(q)
      }
      const wasWaiting = q.waiting.length
      q.waiting = q.waiting.filter(w => w.agentId !== a.id)
      if (q.waiting.length < wasWaiting) {
        this.reindexWaiting(q)
      }
    }
  }

  private reindexWaiting(q: ExhibitQueue) {
    for (let i = 0; i < q.waiting.length; i++) {
      q.waiting[i].position = i
      const a = this.agents.find(ag => ag.id === q.waiting[i].agentId)
      if (a) {
        a.queuePosition = i + 1
      }
    }
  }

  private promoteFromWaiting(q: ExhibitQueue) {
    while (q.viewing.length < q.maxViewing && q.waiting.length > 0) {
      const next = q.waiting.shift()!
      q.viewing.push(next.agentId)
      const waitDur = this.time - next.joinedAt
      q.totalWaitTimes.push(waitDur)
      q.servedCount++
      this.reindexWaiting(q)
      const a = this.agents.find(ag => ag.id === next.agentId)
      const ex = this.layout.exhibits.find(e => e.id === q.exhibitId)
      if (a && ex) {
        a.queuePosition = 0
        a.queueStartedAt = null
        const approach = this.findApproachForExhibit(a, ex)
        if (approach) {
          this.setAgentPath(a, approach, AgentState.TO_EXHIBIT)
        }
      }
    }
  }

  private findApproachForExhibit(a: Agent, exhibit: Exhibit): Vec2 | null {
    const base = getExhibitApproachPoint(exhibit)
    const attempts: Vec2[] = [base]
    for (let i = 0; i < 8; i++) {
      const ang = (i / 8) * Math.PI * 2
      const r = 1.3 + (i % 2) * 0.5
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

    for (let i = 0; i < this.agents.length; i++) {
      const a = this.agents[i]

      if (a.stayTimeRemaining > 0) {
        a.stayTimeRemaining -= dt
        a.velocity.x *= 0.9
        a.velocity.z *= 0.9
        this.activeMask[i] = false
        if (a.stayTimeRemaining <= 0) {
          if (a.currentExhibitId) {
            a.visitedExhibitIds.add(a.currentExhibitId)
            this.removeFromQueue(a, a.currentExhibitId)
            const q = this.queues.get(a.currentExhibitId)
            if (q) this.promoteFromWaiting(q)
          }
          a.currentExhibitId = null
          a.queuePosition = -1
          a.queueStartedAt = null
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

      if (a.state === AgentState.TO_EXHIBIT) {
        if (a.nextExhibitId && a.queuePosition > 0) {
          const q = this.queues.get(a.nextExhibitId)
          const ex = this.layout.exhibits.find(e => e.id === a.nextExhibitId)
          if (q && ex) {
            const slot = getExhibitQueueSlot(ex, a.queuePosition)
            if (!a.target ||
              Math.abs(a.target.x - slot.x) > 0.2 ||
              Math.abs(a.target.z - slot.z) > 0.2) {
              if (a.path.length === 0 ||
                Math.abs(a.path[a.path.length - 1].x - slot.x) > 0.2 ||
                Math.abs(a.path[a.path.length - 1].z - slot.z) > 0.2) {
                const safeSlot = findNearestWalkable(this.grid, slot, 2) || slot
                this.setAgentPath(a, safeSlot, AgentState.TO_EXHIBIT)
              }
            }
          }
        }
      }

      if (a.state === AgentState.TO_EXHIBIT || a.state === AgentState.TO_EXIT) {
        if (a.path.length === 0 || a.pathIndex >= a.path.length) {
          this.onReachTarget(a)
        } else {
          const speedAdj = this.getQueueAdjustment(a)
          advanceAgentAlongPath(a, dt, speedAdj)
          if (a.pathIndex >= a.path.length) {
            this.onReachTarget(a)
          }
        }
      }

      if (a.state === AgentState.TO_EXIT && a.target) {
        if (distanceToTarget(a, a.target) < 1.5) {
          a.state = AgentState.EXITED
          a.exitAt = this.time
          this.totalExited++
          this.removeFromAnyQueue(a)
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
    if (a.queuePosition > 0) {
      return Math.max(0.4, 1 - Math.min(0.6, a.queuePosition * 0.08))
    }
    if (dist > 5) return 1
    return Math.max(0.35, 1 - dist * 0.08)
  }

  private onReachTarget(a: Agent) {
    if (a.state === AgentState.TO_EXHIBIT && a.nextExhibitId) {
      const ex = this.layout.exhibits.find(e => e.id === a.nextExhibitId)
      const q = this.queues.get(a.nextExhibitId)
      if (ex && q && q.viewing.includes(a.id)) {
        a.currentExhibitId = ex.id
        a.nextExhibitId = null
        a.stayTimeRemaining = ex.baseStayTime * a.preferences.stayTimeMultiplier
        a.state = AgentState.VIEWING
        a.velocity.x = 0
        a.velocity.z = 0
        a.queuePosition = 0
        a.queueStartedAt = null
        const ap = getExhibitApproachPoint(ex)
        a.position.x = ap.x + (this.rng.next() - 0.5) * 0.2
        a.position.z = ap.z + (this.rng.next() - 0.5) * 0.2
        return
      } else if (ex && q && a.queuePosition > 0) {
        const ex2 = ex
        const slot = getExhibitQueueSlot(ex2, a.queuePosition)
        a.position.x = slot.x
        a.position.z = slot.z
        a.velocity.x *= 0.4
        a.velocity.z *= 0.4
        return
      }
    }
    a.state = AgentState.STUCK
    a.waitTime = 1.5
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
      const q = this.queues.get(e.id)
      const viewing = q ? q.viewing.length : 0
      const queueCount = q ? q.waiting.length : 0
      const avgWait = q && q.totalWaitTimes.length > 0
        ? q.totalWaitTimes.reduce((a, b) => a + b, 0) / q.totalWaitTimes.length
        : queueCount > 0 ? queueCount * 10 : 0
      return {
        exhibitId: e.id,
        exhibitName: e.name,
        isKeyExhibit: e.isKeyExhibit,
        viewingCount: viewing,
        queueCount,
        avgQueueTime: avgWait
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
        if (val > 1.2) {
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
      if (selected.length >= 8) break
    }
    return selected.map(c => {
      const wx = h.origin.x + (c.x + 0.5) * h.cellSize
      const wz = h.origin.z + (c.z + 0.5) * h.cellSize
      const hall = getHallIdAtPoint(this.layout, { x: wx, z: wz })
      const hallName = hall ? (this.layout.halls.find(hh => hh.id === hall)?.name || '') : ''
      return {
        position: { x: wx, z: wz },
        agentCount: Math.round(c.val),
        label: `${hallName} 热点`
      }
    })
  }
}
