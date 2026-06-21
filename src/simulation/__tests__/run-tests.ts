import { createDefaultLayout, isPointBlocked, setDoorwayEnabled } from '../layout'
import { buildGrid, aStar, findNearestWalkable, validatePathNoBlock, hasPath } from '../pathfinding'
import { checkNoOverlaps } from '../crowd'
import { MuseumSimulator } from '../simulator'
import type { Layout, Vec2 } from '../types'

type TestResult = { name: string; passed: boolean; detail?: string }

function assertEq<T>(a: T, b: T, name: string, detail?: string): TestResult {
  const ok = a === b
  return { name, passed: ok, detail: ok ? detail : `expected ${String(b)}, got ${String(a)}` }
}

function assertTruthy(v: unknown, name: string, detail?: string): TestResult {
  return { name, passed: !!v, detail }
}

function testPathfindingNoObstacle(): TestResult {
  const layout = createDefaultLayout()
  const grid = buildGrid(layout)
  const start = layout.entrances[0].position
  const treasureHall = layout.halls.find(h => h.name.includes('珍宝'))
  if (!treasureHall) return { name: '寻路: 可达测试-珍宝馆可达', passed: false, detail: '未找到珍宝馆' }
  const target: Vec2 = {
    x: (treasureHall.bounds.minX + treasureHall.bounds.maxX) / 2,
    z: (treasureHall.bounds.minZ + treasureHall.bounds.maxZ) / 2
  }
  const path = aStar(grid, start, target)
  if (path.length === 0) return { name: '寻路: 可达测试-珍宝馆可达', passed: false, detail: '未找到路径' }
  if (!validatePathNoBlock(layout, path)) return { name: '寻路: 可达测试-珍宝馆可达', passed: false, detail: '路径穿过障碍' }
  for (const p of path) {
    if (isPointBlocked(layout, p, 0.3)) {
      return { name: '寻路: 可达测试-珍宝馆可达', passed: false, detail: `点 (${p.x},${p.z}) 被障碍占据` }
    }
  }
  return { name: '寻路: 可达测试-珍宝馆可达', passed: true }
}

function testPathfindingUnreachable(): TestResult {
  const layout = createDefaultLayout()
  for (const dw of layout.doorways) {
    setDoorwayEnabled(layout, dw.id, false)
  }
  const grid = buildGrid(layout)
  const start = layout.entrances[0].position
  const treasureHall = layout.halls.find(h => h.name.includes('珍宝'))
  if (!treasureHall) return { name: '寻路: 不可达测试-封门后无路', passed: false, detail: '未找到珍宝馆' }
  const target: Vec2 = {
    x: (treasureHall.bounds.minX + treasureHall.bounds.maxX) / 2,
    z: (treasureHall.bounds.minZ + treasureHall.bounds.maxZ) / 2
  }
  if (hasPath(grid, start, target)) {
    return { name: '寻路: 不可达测试-封门后无路', passed: false, detail: '所有门被封仍找到路径' }
  }
  const fallback = findNearestWalkable(grid, target, 10)
  if (!fallback) {
    return { name: '寻路: 不可达测试-有兜底最近可行格', passed: false, detail: '未找到兜底可行格' }
  }
  return { name: '寻路: 不可达测试-封门后无路+有兜底', passed: true }
}

function testSameSeedReproducible(): TestResult {
  const sim1 = new MuseumSimulator({ seed: 2024, spawnRate: 3, maxAgents: 80 })
  for (let i = 0; i < 30 * 10; i++) sim1.step(0.1)
  const s1 = snap(sim1)

  const sim2 = new MuseumSimulator({ seed: 2024, spawnRate: 3, maxAgents: 80 })
  for (let i = 0; i < 30 * 10; i++) sim2.step(0.1)
  const s2 = snap(sim2)

  if (s1.count !== s2.count) {
    return { name: '复现: 同 seed 相同人数', passed: false, detail: `${s1.count} vs ${s2.count}` }
  }
  for (let i = 0; i < s1.count; i++) {
    if (Math.abs(s1.positions[i].x - s2.positions[i].x) > 0.01 ||
        Math.abs(s1.positions[i].z - s2.positions[i].z) > 0.01) {
      return { name: '复现: 同 seed 相同位置', passed: false, detail: `agent #${i} 位置不同` }
    }
    if (s1.halls[i] !== s2.halls[i]) {
      return { name: '复现: 同 seed 相同各厅分布', passed: false, detail: `agent #${i} 展厅不同` }
    }
  }
  return { name: '复现: 同 seed 30s 后完全一致', passed: true }
}

function snap(sim: MuseumSimulator) {
  const positions = sim.agents.map(a => ({ x: a.position.x, z: a.position.z }))
  const halls = sim.agents.map(a => a.hallId || '')
  return { count: sim.agents.length, positions, halls }
}

function testCrowdNoOverlapNoBlock(): TestResult {
  const sim = new MuseumSimulator({ seed: 7, spawnRate: 10, maxAgents: 150, avgSpeed: 1.2 })
  sim.setSpeed(1)
  for (let i = 0; i < 60 * 20; i++) sim.step(0.05)
  const { ok, maxOverlap, pairs } = checkNoOverlaps(sim.agents)
  const layout = sim.layout
  let blockedCount = 0
  const blocked: string[] = []
  for (const a of sim.agents) {
    if (isPointBlocked(layout, a.position, a.radius * 0.9)) {
      blockedCount++
      blocked.push(`id=${a.id} pos=(${a.position.x.toFixed(2)},${a.position.z.toFixed(2)}) state=${a.state} exhibit=${a.currentExhibitId || a.nextExhibitId || ''}`)
    }
  }
  if (sim.agents.length < 50) {
    return { name: '拥挤: 150人60s后人数够', passed: false, detail: `只有 ${sim.agents.length} 人` }
  }
  if (blockedCount > 0) {
    return { name: '拥挤: 无穿墙/进展柜', passed: false, detail: `${blockedCount} 个 agent 在障碍内: ${blocked.slice(0, 3).join('; ')}` }
  }
  if (!ok && maxOverlap > 0.05) {
    return { name: '拥挤: 无严重重叠', passed: false, detail: `最大重叠 ${maxOverlap.toFixed(3)}m, 共 ${pairs} 对` }
  }
  return {
    name: '拥挤: 高密度场景不重叠+不穿墙进展柜',
    passed: true,
    detail: `maxOverlap=${maxOverlap.toFixed(3)}m, pairs=${pairs}, agents=${sim.agents.length}, blocked=0`
  }
}

export function runTests(): { allPassed: boolean; results: TestResult[] } {
  const tests = [
    testPathfindingNoObstacle(),
    testPathfindingUnreachable(),
    testSameSeedReproducible(),
    testCrowdNoOverlapNoBlock()
  ]
  const allPassed = tests.every(t => t.passed)
  return { allPassed, results: tests }
}

if (typeof process !== 'undefined' && process.argv[1]?.includes('run-tests')) {
  const { allPassed, results } = runTests()
  console.log('\n========== 博物馆仿真自动化测试 ==========')
  for (const r of results) {
    console.log(`${r.passed ? '✅ PASS' : '❌ FAIL'}  ${r.name}${r.detail ? `  —  ${r.detail}` : ''}`)
  }
  console.log(`\n总计: ${results.filter(r => r.passed).length}/${results.length} 通过`)
  if (!allPassed) process.exit(1)
}
