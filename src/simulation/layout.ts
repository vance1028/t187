import type { Layout, Hall, Wall, Doorway, Showcase, Exhibit, Entrance, Exit, Vec2, Rect } from './types'

const WALL_HEIGHT = 3.5
const WALL_THICKNESS = 0.3

function rectContains(r: Rect, p: Vec2): boolean {
  return p.x >= r.minX && p.x <= r.maxX && p.z >= r.minZ && p.z <= r.maxZ
}

function pointToLineDistance(px: number, pz: number, x1: number, z1: number, x2: number, z2: number): number {
  const A = px - x1
  const B = pz - z1
  const C = x2 - x1
  const D = z2 - z1
  const dot = A * C + B * D
  const lenSq = C * C + D * D
  let param = -1
  if (lenSq !== 0) param = dot / lenSq
  let xx, zz
  if (param < 0) { xx = x1; zz = z1 }
  else if (param > 1) { xx = x2; zz = z2 }
  else { xx = x1 + param * C; zz = z1 + param * D }
  const dx = px - xx
  const dz = pz - zz
  return Math.sqrt(dx * dx + dz * dz)
}

export function getHallIdAtPoint(layout: Layout, point: Vec2): string | null {
  for (const hall of layout.halls) {
    if (rectContains(hall.bounds, point)) return hall.id
  }
  return null
}

export function isBlockedByWall(layout: Layout, point: Vec2, radius: number = 0.3): boolean {
  for (const wall of layout.walls) {
    let hasDoorway = false
    for (const d of layout.doorways) {
      if (d.wallId === wall.id) {
        const dist = pointToLineDistance(point.x, point.z, d.center.x - d.width / 2, d.center.z, d.center.x + d.width / 2, d.center.z)
        if (dist < radius + WALL_THICKNESS / 2) {
          hasDoorway = true
          break
        }
      }
    }
    if (hasDoorway) continue
    const d = pointToLineDistance(point.x, point.z, wall.start.x, wall.start.z, wall.end.x, wall.end.z)
    if (d < radius + WALL_THICKNESS / 2) return true
  }
  return false
}

export function isBlockedByShowcase(layout: Layout, point: Vec2, radius: number = 0.3): boolean {
  for (const sc of layout.showcases) {
    const cos = Math.cos(-sc.rotation)
    const sin = Math.sin(-sc.rotation)
    const dx = point.x - sc.position.x
    const dz = point.z - sc.position.z
    const lx = dx * cos - dz * sin
    const lz = dx * sin + dz * cos
    const hx = sc.width / 2 + radius
    const hz = sc.depth / 2 + radius
    if (Math.abs(lx) < hx && Math.abs(lz) < hz) return true
  }
  return false
}

export function isPointBlocked(layout: Layout, point: Vec2, radius: number = 0.3): boolean {
  if (point.x < layout.worldBounds.minX + radius) return true
  if (point.x > layout.worldBounds.maxX - radius) return true
  if (point.z < layout.worldBounds.minZ + radius) return true
  if (point.z > layout.worldBounds.maxZ - radius) return true
  if (isBlockedByWall(layout, point, radius)) return true
  if (isBlockedByShowcase(layout, point, radius)) return true
  return false
}

function createHalls(): Hall[] {
  return [
    {
      id: 'hall_lobby',
      name: '入口大厅',
      bounds: { minX: 0, minZ: 0, maxX: 25, maxZ: 20 },
      floorColor: 0x3d4f6f
    },
    {
      id: 'hall_ancient',
      name: '古代艺术馆',
      bounds: { minX: 25, minZ: 0, maxX: 55, maxZ: 20 },
      floorColor: 0x4a3b5c
    },
    {
      id: 'hall_modern',
      name: '现代艺术馆',
      bounds: { minX: 0, minZ: 20, maxX: 25, maxZ: 45 },
      floorColor: 0x3c5a4a
    },
    {
      id: 'hall_treasure',
      name: '珍宝馆',
      bounds: { minX: 25, minZ: 20, maxX: 55, maxZ: 45 },
      floorColor: 0x5c4a3b
    },
    {
      id: 'hall_exit',
      name: '出口区',
      bounds: { minX: 55, minZ: 10, maxX: 75, maxZ: 30 },
      floorColor: 0x4a5a3b
    }
  ]
}

function createWalls(): Wall[] {
  const t = WALL_THICKNESS
  return [
    { id: 'w1', start: { x: 0, z: 0 }, end: { x: 55, z: 0 }, height: WALL_HEIGHT, thickness: t },
    { id: 'w2', start: { x: 55, z: 0 }, end: { x: 55, z: 10 }, height: WALL_HEIGHT, thickness: t },
    { id: 'w3', start: { x: 55, z: 30 }, end: { x: 55, z: 45 }, height: WALL_HEIGHT, thickness: t },
    { id: 'w4', start: { x: 55, z: 45 }, end: { x: 0, z: 45 }, height: WALL_HEIGHT, thickness: t },
    { id: 'w5', start: { x: 0, z: 45 }, end: { x: 0, z: 20 }, height: WALL_HEIGHT, thickness: t },
    { id: 'w6', start: { x: 0, z: 20 }, end: { x: 0, z: 0 }, height: WALL_HEIGHT, thickness: t },

    { id: 'w7', start: { x: 25, z: 0 }, end: { x: 25, z: 6 }, height: WALL_HEIGHT, thickness: t },
    { id: 'w8', start: { x: 25, z: 14 }, end: { x: 25, z: 20 }, height: WALL_HEIGHT, thickness: t },

    { id: 'w9', start: { x: 0, z: 20 }, end: { x: 8, z: 20 }, height: WALL_HEIGHT, thickness: t },
    { id: 'w10', start: { x: 16, z: 20 }, end: { x: 25, z: 20 }, height: WALL_HEIGHT, thickness: t },

    { id: 'w11', start: { x: 25, z: 26 }, end: { x: 25, z: 45 }, height: WALL_HEIGHT, thickness: t },
    { id: 'w12', start: { x: 25, z: 20 }, end: { x: 25, z: 26 }, height: WALL_HEIGHT, thickness: t },

    { id: 'w13', start: { x: 25, z: 34 }, end: { x: 35, z: 34 }, height: WALL_HEIGHT, thickness: t },
    { id: 'w14', start: { x: 45, z: 34 }, end: { x: 55, z: 34 }, height: WALL_HEIGHT, thickness: t },

    { id: 'w15', start: { x: 75, z: 10 }, end: { x: 75, z: 30 }, height: WALL_HEIGHT, thickness: t },
    { id: 'w16', start: { x: 55, z: 10 }, end: { x: 75, z: 10 }, height: WALL_HEIGHT, thickness: t },
    { id: 'w17', start: { x: 55, z: 30 }, end: { x: 75, z: 30 }, height: WALL_HEIGHT, thickness: t }
  ]
}

function createDoorways(): Doorway[] {
  return [
    { id: 'd1', center: { x: 12.5, z: 0 }, width: 4, wallId: 'w1' },
    { id: 'd2', center: { x: 25, z: 10 }, width: 4, wallId: 'w7' },
    { id: 'd3', center: { x: 12, z: 20 }, width: 4, wallId: 'w9' },
    { id: 'd4', center: { x: 25, z: 23 }, width: 3, wallId: 'w12' },
    { id: 'd5', center: { x: 40, z: 34 }, width: 4, wallId: 'w13' },
    { id: 'd6', center: { x: 55, z: 20 }, width: 4, wallId: 'w3' }
  ]
}

function createShowcases(): Showcase[] {
  return [
    { id: 'sc1', position: { x: 8, z: 8 }, width: 3, depth: 1.2, rotation: 0 },
    { id: 'sc2', position: { x: 8, z: 14 }, width: 3, depth: 1.2, rotation: 0 },
    { id: 'sc3', position: { x: 17, z: 5 }, width: 1.2, depth: 3, rotation: 0 },

    { id: 'sc4', position: { x: 32, z: 5 }, width: 3, depth: 1.2, rotation: 0 },
    { id: 'sc5', position: { x: 42, z: 5 }, width: 3, depth: 1.2, rotation: 0 },
    { id: 'sc6', position: { x: 48, z: 12 }, width: 1.2, depth: 3, rotation: 0 },
    { id: 'sc7', position: { x: 35, z: 15 }, width: 3, depth: 1.2, rotation: 0 },
    { id: 'sc8', position: { x: 46, z: 17 }, width: 2.5, depth: 1.2, rotation: 0 },

    { id: 'sc9', position: { x: 6, z: 27 }, width: 1.2, depth: 3, rotation: 0 },
    { id: 'sc10', position: { x: 6, z: 37 }, width: 1.2, depth: 3, rotation: 0 },
    { id: 'sc11', position: { x: 14, z: 30 }, width: 3, depth: 1.2, rotation: 0 },
    { id: 'sc12', position: { x: 14, z: 39 }, width: 3, depth: 1.2, rotation: 0 },
    { id: 'sc13', position: { x: 20, z: 25 }, width: 2, depth: 1.2, rotation: 0 },

    { id: 'sc14', position: { x: 33, z: 27 }, width: 3, depth: 1.2, rotation: 0 },
    { id: 'sc15', position: { x: 47, z: 27 }, width: 3, depth: 1.2, rotation: 0 },
    { id: 'sc16', position: { x: 40, z: 40 }, width: 3.5, depth: 1.8, rotation: 0 },
    { id: 'sc17', position: { x: 30, z: 30 }, width: 1.5, depth: 1.5, rotation: 0 },
    { id: 'sc18', position: { x: 50, z: 40 }, width: 1.2, depth: 2, rotation: 0 }
  ]
}

function createExhibits(): Exhibit[] {
  return [
    { id: 'e1', name: '青铜方鼎', position: { x: 8, z: 8 }, rotation: 0, isKeyExhibit: true, hallId: 'hall_lobby', showcaseId: 'sc1', baseStayTime: 35, attractiveness: 0.95 },
    { id: 'e2', name: '石刻壁画', position: { x: 8, z: 14 }, rotation: 0, isKeyExhibit: false, hallId: 'hall_lobby', showcaseId: 'sc2', baseStayTime: 15, attractiveness: 0.6 },
    { id: 'e3', name: '陶俑群', position: { x: 17, z: 5 }, rotation: 0, isKeyExhibit: false, hallId: 'hall_lobby', showcaseId: 'sc3', baseStayTime: 18, attractiveness: 0.65 },

    { id: 'e4', name: '编钟', position: { x: 32, z: 5 }, rotation: 0, isKeyExhibit: true, hallId: 'hall_ancient', showcaseId: 'sc4', baseStayTime: 40, attractiveness: 0.98 },
    { id: 'e5', name: '玉璧', position: { x: 42, z: 5 }, rotation: 0, isKeyExhibit: false, hallId: 'hall_ancient', showcaseId: 'sc5', baseStayTime: 15, attractiveness: 0.7 },
    { id: 'e6', name: '竹简册', position: { x: 48, z: 12 }, rotation: 0, isKeyExhibit: false, hallId: 'hall_ancient', showcaseId: 'sc6', baseStayTime: 12, attractiveness: 0.55 },
    { id: 'e7', name: '金缕玉衣', position: { x: 35, z: 15 }, rotation: 0, isKeyExhibit: true, hallId: 'hall_ancient', showcaseId: 'sc7', baseStayTime: 45, attractiveness: 0.97 },
    { id: 'e8', name: '铜车马', position: { x: 46, z: 17 }, rotation: 0, isKeyExhibit: false, hallId: 'hall_ancient', showcaseId: 'sc8', baseStayTime: 25, attractiveness: 0.8 },

    { id: 'e9', name: '印象派画作', position: { x: 6, z: 27 }, rotation: 0, isKeyExhibit: false, hallId: 'hall_modern', showcaseId: 'sc9', baseStayTime: 20, attractiveness: 0.7 },
    { id: 'e10', name: '抽象雕塑', position: { x: 6, z: 37 }, rotation: 0, isKeyExhibit: false, hallId: 'hall_modern', showcaseId: 'sc10', baseStayTime: 18, attractiveness: 0.65 },
    { id: 'e11', name: '现代装置', position: { x: 14, z: 30 }, rotation: 0, isKeyExhibit: true, hallId: 'hall_modern', showcaseId: 'sc11', baseStayTime: 38, attractiveness: 0.92 },
    { id: 'e12', name: '摄影艺术', position: { x: 14, z: 39 }, rotation: 0, isKeyExhibit: false, hallId: 'hall_modern', showcaseId: 'sc12', baseStayTime: 14, attractiveness: 0.6 },
    { id: 'e13', name: '数字艺术', position: { x: 20, z: 25 }, rotation: 0, isKeyExhibit: false, hallId: 'hall_modern', showcaseId: 'sc13', baseStayTime: 22, attractiveness: 0.75 },

    { id: 'e14', name: '皇冠宝石', position: { x: 33, z: 27 }, rotation: 0, isKeyExhibit: true, hallId: 'hall_treasure', showcaseId: 'sc14', baseStayTime: 50, attractiveness: 0.99 },
    { id: 'e15', name: '黄金面具', position: { x: 47, z: 27 }, rotation: 0, isKeyExhibit: true, hallId: 'hall_treasure', showcaseId: 'sc15', baseStayTime: 48, attractiveness: 0.98 },
    { id: 'e16', name: '镇馆之宝·九龙鼎', position: { x: 40, z: 40 }, rotation: 0, isKeyExhibit: true, hallId: 'hall_treasure', showcaseId: 'sc16', baseStayTime: 70, attractiveness: 1.0 },
    { id: 'e17', name: '夜光杯', position: { x: 30, z: 30 }, rotation: 0, isKeyExhibit: false, hallId: 'hall_treasure', showcaseId: 'sc17', baseStayTime: 20, attractiveness: 0.8 },
    { id: 'e18', name: '青瓷窑器', position: { x: 50, z: 40 }, rotation: 0, isKeyExhibit: false, hallId: 'hall_treasure', showcaseId: 'sc18', baseStayTime: 16, attractiveness: 0.65 }
  ]
}

function createEntrances(): Entrance[] {
  return [
    { id: 'ent1', position: { x: 12.5, z: 0.5 }, direction: { x: 0, z: 1 }, width: 4 }
  ]
}

function createExits(): Exit[] {
  return [
    { id: 'ex1', position: { x: 65, z: 29 }, direction: { x: 0, z: 1 }, width: 4 }
  ]
}

export function createDefaultLayout(): Layout {
  const halls = createHalls()
  return {
    halls,
    walls: createWalls(),
    doorways: createDoorways(),
    showcases: createShowcases(),
    exhibits: createExhibits(),
    entrances: createEntrances(),
    exits: createExits(),
    worldBounds: { minX: -1, minZ: -1, maxX: 76, maxZ: 46 }
  }
}

export { rectContains, pointToLineDistance }
