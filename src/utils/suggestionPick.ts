/**
 * Seeded pick among near-tied suggestion scores.
 *
 * The weekly plan used to always take `candidates[0]` after a stable sort, so
 * equal (or very close) scores came out in Grocy id order — the same sequence
 * every week. A small window around the top score, sampled with a seeded RNG,
 * keeps clear winners (favourites, cheap, recently eaten penalties) while
 * mixing the rest.
 *
 * The seed is the caller's job: same seed ⇒ same pick (page load); a new salt
 * or a new date ⇒ a different sequence.
 */

/** Near-ties within this many points of the leader may be chosen. */
export const SCORE_WINDOW = 3.5

/** Softmax temperature — lower is greedier toward the top score. */
const TEMPERATURE = 1.6

/** Mulberry32 — enough randomness, fully deterministic from the seed. */
export function createRng(seed: number): () => number {
  let s = (seed >>> 0) || 0x9e3779b9
  return () => {
    s = (s + 0x6d2b79f5) >>> 0
    let t = Math.imul(s ^ (s >>> 15), 1 | s)
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296
  }
}

export function hashSeed(...parts: Array<string | number>): number {
  let h = 2166136261
  const str = parts.join('\0')
  for (let i = 0; i < str.length; i++) {
    h ^= str.charCodeAt(i)
    h = Math.imul(h, 16777619)
  }
  return h >>> 0
}

/**
 * Weighted pick from an already-sorted (score desc) list. Items more than
 * `window` below the leader, or with a sentinal exclude score, are ignored.
 */
export function pickScored<T extends { score: number }>(
  ranked: T[],
  rng: () => number,
  window = SCORE_WINDOW
): T | undefined {
  if (ranked.length === 0) return undefined
  const best = ranked[0].score
  const pool = ranked.filter((c) => c.score > -900 && c.score >= best - window)
  if (pool.length === 0) return ranked[0]
  if (pool.length === 1) return pool[0]

  const weights = pool.map((c) => Math.exp((c.score - best) / TEMPERATURE))
  const total = weights.reduce((sum, w) => sum + w, 0)
  let r = rng() * total
  for (let i = 0; i < pool.length; i++) {
    r -= weights[i]
    if (r <= 0) return pool[i]
  }
  return pool[pool.length - 1]
}
