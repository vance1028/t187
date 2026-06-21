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
    let hasEnabledDoorway = false
    for (const d of layout.doorways) {
      if (!d.enabled) continue
      if (d.wallId === wall.id) {
        const dx = wall.end.x - wall.start.x
        const dz = wall.end.z - wall.start.z
        const len = Math.sqrt(dx * dx + dz * dz) || 1
        const tx = dx / len
        const tz = dz / len
        const half = d.width / 2
        const x1 = d.center.x - tx * half
        const z1 = d.center.z - tz * half
        const x2 = d.center.x + tx * half
        const z2 = d.center.z + tz * half
        const dist = pointToLineDistance(point.x, point.z, x1, z1, x2, z2)
        if (dist < radius + WALL_THICKNESS / 2) {
          hasEnabledDoorway = true
          break
        }
      }
    }
    if (hasEnabledDoorway) continue
    const d = pointToLineDistance(point.x, point.z, wall.start.x, wall.start.z, wall.end.x, wall.end.z)
    if (d < radius + WALL_THICKNESS / 2) return true
  }
  return false
}

export function isBlockedByShowcase(layout: Layout, point: Vec2, radius: number = 0.3): boolean {
  for (const sc of layout.showcases) {
    if (!sc.enabled) continue
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
    { id: 'w2', start: { x: 55, z: 0 }, end: { x: 55, z: 45 }, height: WALL_HEIGHT, thickness: t },
    { id: 'w4', start: { x: 55, z: 45 }, end: { x: 0, z: 45 }, height: WALL_HEIGHT, thickness: t },
    { id: 'w5', start: { x: 0, z: 45 }, end: { x: 0, z: 0 }, height: WALL_HEIGHT, thickness: t },

    { id: 'w_vert_a', start: { x: 25, z: 0 }, end: { x: 25, z: 20 }, height: WALL_HEIGHT, thickness: t },
    { id: 'w_horiz_a', start: { x: 0, z: 20 }, end: { x: 25, z: 20 }, height: WALL_HEIGHT, thickness: t },
    { id: 'w_vert_b', start: { x: 25, z: 20 }, end: { x: 25, z: 45 }, height: WALL_HEIGHT, thickness: t },
    { id: 'w_horiz_b', start: { x: 25, z: 34 }, end: { x: 55, z: 34 }, height: WALL_HEIGHT, thickness: t },

    { id: 'w_exit_r', start: { x: 75, z: 10 }, end: { x: 75, z: 30 }, height: WALL_HEIGHT, thickness: t },
    { id: 'w_exit_t', start: { x: 55, z: 10 }, end: { x: 75, z: 10 }, height: WALL_HEIGHT, thickness: t },
    { id: 'w_exit_b', start: { x: 55, z: 30 }, end: { x: 75, z: 30 }, height: WALL_HEIGHT, thickness: t }
  ]
}

function createDoorways(): Doorway[] {
  return [
    { id: 'd1', name: '大门入口', center: { x: 12.5, z: 0 }, width: 4, wallId: 'w1', enabled: true },
    { id: 'd2', name: '大厅→古代馆', center: { x: 25, z: 10 }, width: 4, wallId: 'w_vert_a', enabled: true },
    { id: 'd3', name: '大厅→现代馆', center: { x: 12, z: 20 }, width: 4, wallId: 'w_horiz_a', enabled: true },
    { id: 'd4', name: '现代馆→珍宝馆', center: { x: 25, z: 23 }, width: 3, wallId: 'w_vert_b', enabled: true },
    { id: 'd5', name: '古代馆→珍宝馆', center: { x: 40, z: 34 }, width: 4, wallId: 'w_horiz_b', enabled: true },
    { id: 'd6', name: '珍宝馆→出口', center: { x: 55, z: 20 }, width: 4, wallId: 'w2', enabled: true }
  ]
}

function createShowcases(): Showcase[] {
  return [
    { id: 'sc1', name: '鼎柜1', position: { x: 8, z: 8 }, width: 3, depth: 1.2, rotation: 0, enabled: true },
    { id: 'sc2', name: '壁柜2', position: { x: 8, z: 14 }, width: 3, depth: 1.2, rotation: 0, enabled: true },
    { id: 'sc3', name: '俑柜3', position: { x: 17, z: 5 }, width: 1.2, depth: 3, rotation: 0, enabled: true },
    { id: 'sc4', name: '钟柜4', position: { x: 32, z: 5 }, width: 3, depth: 1.2, rotation: 0, enabled: true },
    { id: 'sc5', name: '璧柜5', position: { x: 42, z: 5 }, width: 3, depth: 1.2, rotation: 0, enabled: true },
    { id: 'sc6', name: '简柜6', position: { x: 48, z: 12 }, width: 1.2, depth: 3, rotation: 0, enabled: true },
    { id: 'sc7', name: '衣柜7', position: { x: 35, z: 15 }, width: 3, depth: 1.2, rotation: 0, enabled: true },
    { id: 'sc8', name: '柜8', position: { x: 46, z: 17 }, width: 2.5, depth: 1.2, rotation: 0, enabled: true },
    { id: 'sc9', name: '画柜9', position: { x: 6, z: 27 }, width: 1.2, depth: 3, rotation: 0, enabled: true },
    { id: 'sc10', name: '塑柜10', position: { x: 6, z: 37 }, width: 1.2, depth: 3, rotation: 0, enabled: true },
    { id: 'sc11', name: '装置柜11', position: { x: 14, z: 30 }, width: 3, depth: 1.2, rotation: 0, enabled: true },
    { id: 'sc12', name: '影柜12', position: { x: 14, z: 39 }, width: 3, depth: 1.2, rotation: 0, enabled: true },
    { id: 'sc13', name: '数艺柜13', position: { x: 20, z: 25 }, width: 2, depth: 1.2, rotation: 0, enabled: true },
    { id: 'sc14', name: '宝石柜14', position: { x: 33, z: 27 }, width: 3, depth: 1.2, rotation: 0, enabled: true },
    { id: 'sc15', name: '面具柜15', position: { x: 47, z: 27 }, width: 3, depth: 1.2, rotation: 0, enabled: true },
    { id: 'sc16', name: '九龙鼎柜16', position: { x: 40, z: 40 }, width: 3.5, depth: 1.8, rotation: 0, enabled: true },
    { id: 'sc17', name: '杯柜17', position: { x: 30, z: 30 }, width: 1.5, depth: 1.5, rotation: 0, enabled: true },
    { id: 'sc18', name: '瓷柜18', position: { x: 50, z: 40 }, width: 1.2, depth: 2, rotation: 0, enabled: true }
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

import type { ProfileDistribution, VisitorProfile, VisitorProfileId } from './types'
import { VisitorProfileId as VP } from './types'

export const VISITOR_PROFILES: Record<VisitorProfileId, VisitorProfile> = {
  [VP.TOURIST]: {
    id: VP.TOURIST,
    name: '观光游客',
    color: '#4ade80',
    keyExhibitWeight: 0.85,
    stayTimeMultiplier: 1.0,
    speedMultiplier: 1.0,
    visitCountMin: 6,
    visitCountMax: 12
  },
  [VP.SCHOLAR]: {
    id: VP.SCHOLAR,
    name: '研究学者',
    color: '#60a5fa',
    keyExhibitWeight: 0.6,
    stayTimeMultiplier: 2.0,
    speedMultiplier: 0.75,
    visitCountMin: 4,
    visitCountMax: 8
  },
  [VP.CASUAL]: {
    id: VP.CASUAL,
    name: '休闲访客',
    color: '#f472b6',
    keyExhibitWeight: 0.4,
    stayTimeMultiplier: 0.7,
    speedMultiplier: 1.1,
    visitCountMin: 3,
    visitCountMax: 7
  },
  [VP.STUDENT]: {
    id: VP.STUDENT,
    name: '学生团体',
    color: '#fbbf24',
    keyExhibitWeight: 0.75,
    stayTimeMultiplier: 0.85,
    speedMultiplier: 1.25,
    visitCountMin: 8,
    visitCountMax: 14
  },
  [VP.VIP]: {
    id: VP.VIP,
    name: '贵宾参观',
    color: '#a78bfa',
    keyExhibitWeight: 0.95,
    stayTimeMultiplier: 1.4,
    speedMultiplier: 0.85,
    visitCountMin: 5,
    visitCountMax: 9
  }
}

export const DEFAULT_PROFILE_DISTRIBUTION: ProfileDistribution = {
  tourist: 0.45,
  scholar: 0.1,
  casual: 0.25,
  student: 0.15,
  vip: 0.05
}

export function pickProfile(rng: { next: () => number }, dist: ProfileDistribution): VisitorProfileId {
  const total = dist.tourist + dist.scholar + dist.casual + dist.student + dist.vip
  let r = rng.next() * Math.max(0.0001, total)
  r -= dist.tourist
  if (r <= 0) return VP.TOURIST
  r -= dist.scholar
  if (r <= 0) return VP.SCHOLAR
  r -= dist.casual
  if (r <= 0) return VP.CASUAL
  r -= dist.student
  if (r <= 0) return VP.STUDENT
  return VP.VIP
}

export function setDoorwayEnabled(layout: Layout, doorwayId: string, enabled: boolean): boolean {
  const d = layout.doorways.find(x => x.id === doorwayId)
  if (!d) return false
  d.enabled = enabled
  return true
}

export function moveShowcase(layout: Layout, showcaseId: string, dx: number, dz: number): boolean {
  const sc = layout.showcases.find(x => x.id === showcaseId)
  if (!sc) return false
  sc.position.x = Math.max(layout.worldBounds.minX + 2, Math.min(layout.worldBounds.maxX - 2, sc.position.x + dx))
  sc.position.z = Math.max(layout.worldBounds.minZ + 2, Math.min(layout.worldBounds.maxZ - 2, sc.position.z + dz))
  const ex = layout.exhibits.find(e => e.showcaseId === showcaseId)
  if (ex) {
    ex.position.x = sc.position.x
    ex.position.z = sc.position.z
  }
  return true
}

export function setShowcaseEnabled(layout: Layout, showcaseId: string, enabled: boolean): boolean {
  const sc = layout.showcases.find(x => x.id === showcaseId)
  if (!sc) return false
  sc.enabled = enabled
  return true
}

export function normalizeProfileDistribution(dist: ProfileDistribution): ProfileDistribution {
  const total = Math.max(0.0001, dist.tourist + dist.scholar + dist.casual + dist.student + dist.vip)
  return {
    tourist: dist.tourist / total,
    scholar: dist.scholar / total,
    casual: dist.casual / total,
    student: dist.student / total,
    vip: dist.vip / total
  }
}
