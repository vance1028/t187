import type { Heatmap, Vec2, Agent, Layout } from './types'

export const HEATMAP_CELL = 0.8

export function createHeatmap(layout: Layout): Heatmap {
  const b = layout.worldBounds
  const pad = 2
  const minX = b.minX - pad
  const minZ = b.minZ - pad
  const maxX = b.maxX + pad
  const maxZ = b.maxZ + pad
  const width = Math.ceil((maxX - minX) / HEATMAP_CELL)
  const height = Math.ceil((maxZ - minZ) / HEATMAP_CELL)
  const cells: { count: number; totalTime: number; agents: number }[][] = []
  for (let y = 0; y < height; y++) {
    const row: { count: number; totalTime: number; agents: number }[] = []
    for (let x = 0; x < width; x++) {
      row.push({ count: 0, totalTime: 0, agents: 0 })
    }
    cells.push(row)
  }
  return {
    gridWidth: width,
    gridHeight: height,
    cellSize: HEATMAP_CELL,
    origin: { x: minX, z: minZ },
    cells
  }
}

export function updateHeatmap(h: Heatmap, agents: Agent[], dt: number, decay: number = 0.999) {
  for (let y = 0; y < h.gridHeight; y++) {
    for (let x = 0; x < h.gridWidth; x++) {
      const c = h.cells[y][x]
      c.count = Math.max(0, c.count * decay)
      c.agents = 0
    }
  }
  for (const a of agents) {
    if (a.state === 'exited') continue
    const gx = Math.floor((a.position.x - h.origin.x) / h.cellSize)
    const gy = Math.floor((a.position.z - h.origin.z) / h.cellSize)
    if (gx >= 0 && gx < h.gridWidth && gy >= 0 && gy < h.gridHeight) {
      h.cells[gy][gx].count += 1 + dt * 2
      h.cells[gy][gx].totalTime += dt
      h.cells[gy][gx].agents += 1
    }
  }
}

export function getHeatValue(h: Heatmap, world: Vec2): number {
  const gx = Math.floor((world.x - h.origin.x) / h.cellSize)
  const gy = Math.floor((world.z - h.origin.z) / h.cellSize)
  if (gx < 0 || gx >= h.gridWidth || gy < 0 || gy >= h.gridHeight) return 0
  return h.cells[gy][gx].count
}

export interface HeatmapImageData {
  width: number
  height: number
  data: Uint8ClampedArray
}

export function heatmapToImage(h: Heatmap, maxValue: number = 8): HeatmapImageData {
  const w = h.gridWidth
  const hi = h.gridHeight
  const data = new Uint8ClampedArray(w * hi * 4)
  const mv = Math.max(maxValue, 0.5)
  for (let y = 0; y < hi; y++) {
    for (let x = 0; x < w; x++) {
      const idx = (y * w + x) * 4
      const val = Math.min(1, h.cells[y][x].count / mv)
      const { r, g, b, a } = heatColor(val)
      data[idx] = r
      data[idx + 1] = g
      data[idx + 2] = b
      data[idx + 3] = a
    }
  }
  return { width: w, height: hi, data }
}

export function heatColor(t: number): { r: number; g: number; b: number; a: number } {
  if (t <= 0.001) return { r: 0, g: 0, b: 0, a: 0 }
  const v = Math.max(0, Math.min(1, t))
  let r = 0, g = 0, b = 0
  if (v < 0.25) {
    const t2 = v / 0.25
    r = 0; g = Math.floor(t2 * 180); b = Math.floor(200 + t2 * 55)
  } else if (v < 0.5) {
    const t2 = (v - 0.25) / 0.25
    r = Math.floor(t2 * 80); g = Math.floor(180 + t2 * 75); b = Math.floor(255 - t2 * 200)
  } else if (v < 0.75) {
    const t2 = (v - 0.5) / 0.25
    r = Math.floor(80 + t2 * 175); g = Math.floor(255 - t2 * 100); b = 0
  } else {
    const t2 = (v - 0.75) / 0.25
    r = 255; g = Math.floor(155 - t2 * 130); b = Math.floor(t2 * 60)
  }
  const a = Math.floor(50 + v * 180)
  return { r, g, b, a }
}
