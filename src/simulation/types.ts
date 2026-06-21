export interface Vec2 {
  x: number
  z: number
}

export interface Vec3 {
  x: number
  y: number
  z: number
}

export interface Rect {
  minX: number
  minZ: number
  maxX: number
  maxZ: number
}

export interface Wall {
  id: string
  start: Vec2
  end: Vec2
  height: number
  thickness: number
}

export interface Doorway {
  id: string
  name: string
  center: Vec2
  width: number
  wallId: string
  enabled: boolean
}

export interface Showcase {
  id: string
  name: string
  position: Vec2
  width: number
  depth: number
  rotation: number
  enabled: boolean
}

export interface Exhibit {
  id: string
  name: string
  position: Vec2
  rotation: number
  isKeyExhibit: boolean
  hallId: string
  showcaseId?: string
  baseStayTime: number
  attractiveness: number
}

export interface Hall {
  id: string
  name: string
  bounds: Rect
  floorColor: number
}

export interface Entrance {
  id: string
  position: Vec2
  direction: Vec2
  width: number
}

export interface Exit {
  id: string
  position: Vec2
  direction: Vec2
  width: number
}

export interface Layout {
  halls: Hall[]
  walls: Wall[]
  doorways: Doorway[]
  showcases: Showcase[]
  exhibits: Exhibit[]
  entrances: Entrance[]
  exits: Exit[]
  worldBounds: Rect
}

export enum AgentState {
  ENTERING = 'entering',
  TO_EXHIBIT = 'to_exhibit',
  VIEWING = 'viewing',
  TO_EXIT = 'to_exit',
  EXITED = 'exited',
  STUCK = 'stuck'
}

export enum VisitorProfileId {
  TOURIST = 'tourist',
  SCHOLAR = 'scholar',
  CASUAL = 'casual',
  STUDENT = 'student',
  VIP = 'vip'
}

export interface VisitorProfile {
  id: VisitorProfileId
  name: string
  color: string
  keyExhibitWeight: number
  stayTimeMultiplier: number
  speedMultiplier: number
  visitCountMin: number
  visitCountMax: number
}

export interface ProfileDistribution {
  tourist: number
  scholar: number
  casual: number
  student: number
  vip: number
}

export interface AgentPreferences {
  keyExhibitWeight: number
  stayTimeMultiplier: number
  speedMultiplier: number
  visitCount: number
  profile: VisitorProfileId
}

export interface Agent {
  id: number
  position: Vec2
  velocity: Vec2
  target: Vec2 | null
  state: AgentState
  preferences: AgentPreferences
  currentExhibitId: string | null
  visitedExhibitIds: Set<string>
  nextExhibitId: string | null
  stayTimeRemaining: number
  waitTime: number
  path: Vec2[]
  pathIndex: number
  radius: number
  baseSpeed: number
  color: number
  hallId: string | null
  createdAt: number
  exitAt: number | null
  queuePosition: number
  queueStartedAt: number | null
}

export interface HeatmapCell {
  count: number
  totalTime: number
  agents: number
}

export interface Heatmap {
  gridWidth: number
  gridHeight: number
  cellSize: number
  origin: Vec2
  cells: HeatmapCell[][]
}

export interface SimulationParams {
  spawnRate: number
  maxAgents: number
  keyExhibitBias: number
  avgStayTime: number
  avgSpeed: number
  seed: number
  heatmapDecay: number
  profileDistribution: ProfileDistribution
}

export interface ExhibitQueueRecord {
  agentId: number
  joinedAt: number
  position: number
}

export interface ExhibitQueue {
  exhibitId: string
  viewing: number[]
  waiting: ExhibitQueueRecord[]
  maxViewing: number
  totalWaitTimes: number[]
  servedCount: number
}

export interface HallStats {
  hallId: string
  hallName: string
  agentCount: number
}

export interface HotspotInfo {
  position: Vec2
  agentCount: number
  label: string
}

export interface ExhibitStats {
  exhibitId: string
  exhibitName: string
  isKeyExhibit: boolean
  viewingCount: number
  queueCount: number
  avgQueueTime: number
}

export interface SimulationStats {
  time: number
  speedMultiplier: number
  isPaused: boolean
  currentAgents: number
  totalEntered: number
  totalExited: number
  hallStats: HallStats[]
  hotspots: HotspotInfo[]
  exhibitStats: ExhibitStats[]
}
