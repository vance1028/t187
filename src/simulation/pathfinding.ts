import type { Layout, Vec2 } from './types'
import { isPointBlocked } from './layout'

export const CELL_SIZE = 0.5

export interface Grid {
  width: number
  height: number
  cellSize: number
  originX: number
  originZ: number
  walkable: Uint8Array
}

export function buildGrid(layout: Layout): Grid {
  const bounds = layout.worldBounds
  const expandedMinX = bounds.minX - 1
  const expandedMinZ = bounds.minZ - 1
  const expandedMaxX = bounds.maxX + 1
  const expandedMaxZ = bounds.maxZ + 1
  const width = Math.ceil((expandedMaxX - expandedMinX) / CELL_SIZE)
  const height = Math.ceil((expandedMaxZ - expandedMinZ) / CELL_SIZE)
  const walkable = new Uint8Array(width * height)

  for (let gy = 0; gy < height; gy++) {
    for (let gx = 0; gx < width; gx++) {
      const wx = expandedMinX + (gx + 0.5) * CELL_SIZE
      const wz = expandedMinZ + (gy + 0.5) * CELL_SIZE
      const blocked = isPointBlocked(layout, { x: wx, z: wz }, 0.25)
      walkable[gy * width + gx] = blocked ? 0 : 1
    }
  }

  return {
    width,
    height,
    cellSize: CELL_SIZE,
    originX: expandedMinX,
    originZ: expandedMinZ,
    walkable
  }
}

export function worldToGrid(g: Grid, p: Vec2): { gx: number; gy: number } {
  return {
    gx: Math.max(0, Math.min(g.width - 1, Math.floor((p.x - g.originX) / g.cellSize))),
    gy: Math.max(0, Math.min(g.height - 1, Math.floor((p.z - g.originZ) / g.cellSize)))
  }
}

export function gridToWorld(g: Grid, gx: number, gy: number): Vec2 {
  return {
    x: g.originX + (gx + 0.5) * g.cellSize,
    z: g.originZ + (gy + 0.5) * g.cellSize
  }
}

export function isWalkable(g: Grid, gx: number, gy: number): boolean {
  if (gx < 0 || gx >= g.width || gy < 0 || gy >= g.height) return false
  return g.walkable[gy * g.width + gx] === 1
}

export function setWalkable(g: Grid, gx: number, gy: number, w: boolean) {
  if (gx < 0 || gx >= g.width || gy < 0 || gy >= g.height) return
  g.walkable[gy * g.width + gx] = w ? 1 : 0
}

export function findNearestWalkable(g: Grid, world: Vec2, maxRadius: number = 6): Vec2 | null {
  const start = worldToGrid(g, world)
  if (isWalkable(g, start.gx, start.gy)) return gridToWorld(g, start.gx, start.gy)
  const maxCells = Math.ceil(maxRadius / g.cellSize)
  for (let r = 1; r <= maxCells; r++) {
    for (let dx = -r; dx <= r; dx++) {
      for (const dy of [-r, r]) {
        const nx = start.gx + dx
        const ny = start.gy + dy
        if (isWalkable(g, nx, ny)) return gridToWorld(g, nx, ny)
      }
    }
    for (let dy = -r + 1; dy < r; dy++) {
      for (const dx of [-r, r]) {
        const nx = start.gx + dx
        const ny = start.gy + dy
        if (isWalkable(g, nx, ny)) return gridToWorld(g, nx, ny)
      }
    }
  }
  return null
}

interface AStarNode {
  gx: number
  gy: number
  g: number
  h: number
  f: number
  parent: AStarNode | null
}

function heuristic(ax: number, ay: number, bx: number, by: number): number {
  const dx = ax - bx
  const dy = ay - by
  return Math.sqrt(dx * dx + dy * dy)
}

export function aStar(
  g: Grid,
  startWorld: Vec2,
  endWorld: Vec2
): Vec2[] {
  const start = worldToGrid(g, startWorld)
  const end = worldToGrid(g, endWorld)

  if (!isWalkable(g, start.gx, start.gy)) {
    const nearest = findNearestWalkable(g, startWorld, 4)
    if (!nearest) return []
    return aStar(g, nearest, endWorld)
  }

  if (!isWalkable(g, end.gx, end.gy)) {
    const nearest = findNearestWalkable(g, endWorld, 4)
    if (!nearest) return []
    return aStar(g, startWorld, nearest)
  }

  if (start.gx === end.gx && start.gy === end.gy) {
    return [{ ...endWorld }]
  }

  const openMap = new Map<number, AStarNode>()
  const closedSet = new Set<number>()
  const width = g.width

  const key = (x: number, y: number) => y * width + x

  const startNode: AStarNode = {
    gx: start.gx,
    gy: start.gy,
    g: 0,
    h: heuristic(start.gx, start.gy, end.gx, end.gy),
    f: 0,
    parent: null
  }
  startNode.f = startNode.g + startNode.h
  openMap.set(key(start.gx, start.gy), startNode)

  const neighbors8 = [
    [-1, -1, Math.SQRT2], [0, -1, 1], [1, -1, Math.SQRT2],
    [-1, 0, 1], [1, 0, 1],
    [-1, 1, Math.SQRT2], [0, 1, 1], [1, 1, Math.SQRT2]
  ]

  let iterations = 0
  const maxIter = g.width * g.height

  while (openMap.size > 0 && iterations < maxIter) {
    iterations++
    let current: AStarNode | null = null
    let minF = Infinity
    for (const node of openMap.values()) {
      if (node.f < minF) {
        minF = node.f
        current = node
      }
    }
    if (!current) break

    if (current.gx === end.gx && current.gy === end.gy) {
      const path: Vec2[] = []
      let c: AStarNode | null = current
      while (c) {
        path.push(gridToWorld(g, c.gx, c.gy))
        c = c.parent
      }
      path.reverse()
      return simplifyPath(path)
    }

    openMap.delete(key(current.gx, current.gy))
    closedSet.add(key(current.gx, current.gy))

    for (const [dx, dy, cost] of neighbors8) {
      const nx = current.gx + dx
      const ny = current.gy + dy

      if (!isWalkable(g, nx, ny)) continue

      if (dx !== 0 && dy !== 0) {
        if (!isWalkable(g, current.gx + dx, current.gy) || !isWalkable(g, current.gx, current.gy + dy)) {
          continue
        }
      }

      const nk = key(nx, ny)
      if (closedSet.has(nk)) continue

      const tentativeG = current.g + cost
      const existing = openMap.get(nk)
      if (existing && tentativeG >= existing.g) continue

      const h = heuristic(nx, ny, end.gx, end.gy)
      openMap.set(nk, {
        gx: nx,
        gy: ny,
        g: tentativeG,
        h,
        f: tentativeG + h,
        parent: current
      })
    }
  }

  return []
}

function simplifyPath(path: Vec2[]): Vec2[] {
  if (path.length <= 2) return path
  const result: Vec2[] = [path[0]]
  for (let i = 1; i < path.length - 1; i++) {
    const prev = result[result.length - 1]
    const curr = path[i]
    const next = path[i + 1]
    const dx1 = curr.x - prev.x
    const dz1 = curr.z - prev.z
    const dx2 = next.x - curr.x
    const dz2 = next.z - curr.z
    const cross = dx1 * dz2 - dz1 * dx2
    const dot = dx1 * dx2 + dz1 * dz2
    if (Math.abs(cross) > 0.0001 || dot < 0) {
      result.push(curr)
    }
  }
  result.push(path[path.length - 1])
  return result
}

export function validatePathNoBlock(
  layout: Layout,
  path: Vec2[],
  radius: number = 0.3
): boolean {
  for (const p of path) {
    if (isPointBlocked(layout, p, radius)) return false
  }
  return true
}

export function hasPath(
  g: Grid,
  start: Vec2,
  end: Vec2
): boolean {
  return aStar(g, start, end).length > 0
}
