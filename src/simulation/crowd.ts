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
    let avgDensity = 0
    let separationX = 0
    let separationZ = 0
    let nearCount = 0
    let blockForward = false

    for (let j = 0; j < n; j++) {
      if (i === j || !activeMask[j]) continue
      const b = agents[j]
      const dx = a.position.x - b.position.x
      const dz = a.position.z - b.position.z
      const distSq = dx * dx + dz * dz
      const minDist = a.radius + b.radius + 0.05
      const minDistSq = minDist * minDist

      if (distSq < 2.5 * 2.5) {
        avgDensity += 1
      }

      if (distSq < minDistSq) {
        const dist = Math.sqrt(distSq)
        if (dist < 0.0001) {
          const ang = Math.random() * Math.PI * 2
          separationX += Math.cos(ang) * 0.5
          separationZ += Math.sin(ang) * 0.5
        } else {
          const push = (minDist - dist) / dist
          separationX += dx * push
          separationZ += dz * push
        }
        nearCount++
      }

      if (distSq < 1.0 && distSq > 0.01) {
        const dist = Math.sqrt(distSq)
        const vLen = Math.sqrt(a.velocity.x * a.velocity.x + a.velocity.z * a.velocity.z)
        if (vLen > 0.1) {
          const forwardDot = (-dx * a.velocity.x - dz * a.velocity.z) / (dist * vLen)
          if (forwardDot > 0.6) blockForward = true
        }
      }
    }

    const speedFactor = blockForward ? 0.25 : Math.max(0.35, 1 - avgDensity / 18)
    const desiredX = a.velocity.x * speedFactor
    const desiredZ = a.velocity.z * speedFactor

    const sepStrength = Math.min(4.5, 1 + nearCount * 0.6)
    const newVx = desiredX + separationX * sepStrength
    const newVz = desiredZ + separationZ * sepStrength

    const testX = a.position.x + newVx * dt
    const testZ = a.position.z + newVz * dt

    if (!isPointBlocked(layout, { x: testX, z: testZ }, a.radius)) {
      a.position.x = testX
      a.position.z = testZ
      a.velocity.x = newVx
      a.velocity.z = newVz
    } else {
      if (!isPointBlocked(layout, { x: testX, z: a.position.z }, a.radius)) {
        a.position.x = testX
        a.velocity.x = newVx * 0.8
        a.velocity.z *= 0.3
      } else if (!isPointBlocked(layout, { x: a.position.x, z: testZ }, a.radius)) {
        a.position.z = testZ
        a.velocity.z = newVz * 0.8
        a.velocity.x *= 0.3
      } else {
        a.velocity.x *= 0.5
        a.velocity.z *= 0.5
      }
    }
  }
}
