/** Deterministic seeded RNG (mulberry32) so the 40-day history is stable. */
export function makeRng(seed: number) {
  let a = seed >>> 0
  return function next() {
    a |= 0
    a = (a + 0x6d2b79f5) | 0
    let t = Math.imul(a ^ (a >>> 15), 1 | a)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

/** Random float in [min, max). */
export function rand(rng: () => number, min: number, max: number) {
  return min + rng() * (max - min)
}

/** Random integer in [min, max] inclusive. */
export function randInt(rng: () => number, min: number, max: number) {
  return Math.floor(rand(rng, min, max + 1))
}

/** Pick a random element. */
export function pick<T>(rng: () => number, arr: T[]): T {
  return arr[Math.floor(rng() * arr.length)]
}

/** Round to n decimal places. */
export function round(n: number, dp = 1) {
  const f = Math.pow(10, dp)
  return Math.round(n * f) / f
}
