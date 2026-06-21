export class SeededRandom {
  private state: number

  constructor(seed: number) {
    this.state = seed >>> 0
    if (this.state === 0) this.state = 1
  }

  next(): number {
    this.state |= 0
    this.state = (this.state + 0x6D2B79F5) | 0
    let t = Math.imul(this.state ^ (this.state >>> 15), 1 | this.state)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }

  range(min: number, max: number): number {
    return min + this.next() * (max - min)
  }

  int(min: number, max: number): number {
    return Math.floor(this.range(min, max + 1))
  }

  pick<T>(arr: T[]): T {
    return arr[Math.floor(this.next() * arr.length)]
  }

  weightedPick<T>(items: T[], weights: number[]): T {
    const total = weights.reduce((a, b) => a + b, 0)
    let r = this.next() * total
    for (let i = 0; i < items.length; i++) {
      r -= weights[i]
      if (r <= 0) return items[i]
    }
    return items[items.length - 1]
  }
}
