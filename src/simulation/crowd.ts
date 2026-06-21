import type { Agent, Layout } from './types'
import { isPointBlocked } from './layout'

export function applyCrowdAvoidance(
  agents: Agent[],
  layout: Layout,
  dt: number,
  activeMask: boolean[]
) {
  const n = agents.length

  for (let i = 0; i < n; i++) {
    if (!activeMask[i]) continue
    const a = agents[i]
    const origX = a.position.x
    const origZ = a.position.z

    let avgDensity = 0
    let separationX = 0
    let separationZ = 0
    let nearCount = 0
    let blockForward = false
    let aheadCount = 0
    let cohesionX = 0
    let cohesionZ = 0
    let cohesionCount = 0
    let alignmentX = 0
    let alignmentZ = 0
    let alignmentCount = 0

    for (let j = 0; j < n; j++) {
      if (i === j) continue
      const b = agents[j]
      const dx = a.position.x - b.position.x
      const dz = a.position.z - b.position.z
      const distSq = dx * dx + dz * dz
      const minDist = a.radius + b.radius + 0.02
      const minDistSq = minDist * minDist

      if (distSq < 3.0 * 3.0) {
        avgDensity += 1
        cohesionX += b.position.x
        cohesionZ += b.position.z
        cohesionCount++
      }

      if (distSq < 2.0 * 2.0 && distSq > 0.01) {
        alignmentX += b.velocity.x
        alignmentZ += b.velocity.z
        alignmentCount++
      }

      if (distSq < minDistSq * 2.25) {
        const dist = Math.sqrt(distSq)
        if (dist < 0.0001) {
          const ang = (i + j) * 1.7
          separationX += Math.cos(ang) * 0.6
          separationZ += Math.sin(ang) * 0.6
        } else {
          const overlap = minDist - dist
          const push = Math.min(2.5, overlap / dist + 0.2)
          separationX += dx * push
          separationZ += dz * push
        }
        nearCount++
      }

      if (distSq < 1.4 * 1.4 && distSq > 0.0001) {
        const dist = Math.sqrt(distSq)
        const vLenSq = a.velocity.x * a.velocity.x + a.velocity.z * a.velocity.z
        if (vLenSq > 0.04) {
          const vLen = Math.sqrt(vLenSq)
          const forwardDot = (-dx * a.velocity.x - dz * a.velocity.z) / (dist * vLen)
          if (forwardDot > 0.5) {
            blockForward = true
            aheadCount++
          }
        }
      }
    }

    const speedFactor = blockForward
      ? Math.max(0.15, 1 - aheadCount * 0.22)
      : Math.max(0.35, 1 - avgDensity / 22)

    let desiredX = a.velocity.x * speedFactor
    let desiredZ = a.velocity.z * speedFactor

    if (cohesionCount > 4 && avgDensity > 8) {
      const cx = cohesionX / cohesionCount - a.position.x
      const cz = cohesionZ / cohesionCount - a.position.z
      const cLen = Math.sqrt(cx * cx + cz * cz)
      if (cLen > 0.01) {
        desiredX -= (cx / cLen) * 0.08
        desiredZ -= (cz / cLen) * 0.08
      }
    }

    if (alignmentCount > 2) {
      const ax = alignmentX / alignmentCount
      const az = alignmentZ / alignmentCount
      desiredX += ax * 0.12
      desiredZ += az * 0.12
    }

    const sepStrength = Math.min(6.0, 0.8 + nearCount * 0.9)
    const newVx = desiredX + separationX * sepStrength
    const newVz = desiredZ + separationZ * sepStrength

    const stepX = newVx * dt
    const stepZ = newVz * dt

    let finalX = origX + stepX
    let finalZ = origZ + stepZ

    if (!isPointBlocked(layout, { x: finalX, z: finalZ }, a.radius)) {
      a.position.x = finalX
      a.position.z = finalZ
      a.velocity.x = newVx
      a.velocity.z = newVz
    } else {
      if (!isPointBlocked(layout, { x: finalX, z: origZ }, a.radius)) {
        a.position.x = finalX
        a.velocity.x = newVx * 0.7
        a.velocity.z *= 0.2
      } else if (!isPointBlocked(layout, { x: origX, z: finalZ }, a.radius)) {
        a.position.z = finalZ
        a.velocity.z = newVz * 0.7
        a.velocity.x *= 0.2
      } else {
        let slid = false
        for (let ang = 0; ang < Math.PI * 2; ang += Math.PI / 8) {
          const tx = origX + Math.cos(ang) * 0.22
          const tz = origZ + Math.sin(ang) * 0.22
          if (!isPointBlocked(layout, { x: tx, z: tz }, a.radius)) {
            a.position.x = tx
            a.position.z = tz
            slid = true
            break
          }
        }
        if (!slid) {
          a.position.x = origX
          a.position.z = origZ
        }
        a.velocity.x *= 0.35
        a.velocity.z *= 0.35
      }
    }
  }

  resolveHardOverlaps(agents, layout)
}

function resolveHardOverlaps(agents: Agent[], layout: Layout) {
  const n = agents.length
  const MAX_ITERS = 3
  for (let iter = 0; iter < MAX_ITERS; iter++) {
    let anyOverlap = false
    for (let i = 0; i < n; i++) {
      const a = agents[i]
      for (let j = i + 1; j < n; j++) {
        const b = agents[j]
        const dx = a.position.x - b.position.x
        const dz = a.position.z - b.position.z
        const distSq = dx * dx + dz * dz
        const minDist = a.radius + b.radius
        const minDistSq = minDist * minDist
        if (distSq < minDistSq * 0.96 && distSq > 0.000001) {
          const dist = Math.sqrt(distSq)
          const overlap = (minDist - dist) * 0.52
          const nx = dist > 0 ? dx / dist : Math.cos((i + j) * 1.3)
          const nz = dist > 0 ? dz / dist : Math.sin((i + j) * 1.3)
          const ax = a.position.x + nx * overlap
          const az = a.position.z + nz * overlap
          const bx = b.position.x - nx * overlap
          const bz = b.position.z - nz * overlap
          const aOk = !isPointBlocked(layout, { x: ax, z: az }, a.radius)
          const bOk = !isPointBlocked(layout, { x: bx, z: bz }, b.radius)
          if (aOk) { a.position.x = ax; a.position.z = az }
          if (bOk) { b.position.x = bx; b.position.z = bz }
          if (!aOk && !bOk) {
            if (!isPointBlocked(layout, { x: a.position.x, z: a.position.z }, a.radius + 0.05)) {
            } else {
              for (let ang = 0; ang < Math.PI * 2; ang += Math.PI / 6) {
                const tx = a.position.x + Math.cos(ang) * overlap * 2
                const tz = a.position.z + Math.sin(ang) * overlap * 2
                if (!isPointBlocked(layout, { x: tx, z: tz }, a.radius)) {
                  a.position.x = tx
                  a.position.z = tz
                  break
                }
              }
            }
          }
          anyOverlap = true
        }
      }
    }
    if (!anyOverlap) break
  }
}

export function checkNoOverlaps(agents: Agent[]): { ok: boolean; maxOverlap: number; pairs: number } {
  let maxOverlap = 0
  let pairs = 0
  const n = agents.length
  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const a = agents[i]
      const b = agents[j]
      const dx = a.position.x - b.position.x
      const dz = a.position.z - b.position.z
      const dist = Math.sqrt(dx * dx + dz * dz)
      const min = a.radius + b.radius
      if (dist < min * 0.95) {
        pairs++
        maxOverlap = Math.max(maxOverlap, min - dist)
      }
    }
  }
  return { ok: pairs === 0, maxOverlap, pairs }
}
