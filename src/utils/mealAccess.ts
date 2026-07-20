const STORAGE_KEY = 'nourish-meal-access-order'

type Listener = () => void
const listeners = new Set<Listener>()

function load(): number[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as unknown
    if (!Array.isArray(parsed)) return []
    return parsed.filter((id): id is number => typeof id === 'number' && Number.isFinite(id))
  } catch {
    return []
  }
}

function save(order: number[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(order))
}

function notify() {
  for (const listener of listeners) listener()
}

export function getMealAccessOrder(): number[] {
  return load()
}

/** Move recipe to the front when eaten (splay-to-root). Never-eaten meals stay after. */
export function splayMealAccess(recipeId: number): number[] {
  if (!Number.isFinite(recipeId)) return load()
  const next = [recipeId, ...load().filter((id) => id !== recipeId)]
  save(next)
  notify()
  return next
}

export function subscribeMealAccess(listener: Listener): () => void {
  listeners.add(listener)
  return () => {
    listeners.delete(listener)
  }
}

/** Lower rank = more recently eaten. Never eaten → large rank. */
export function mealAccessRank(order: number[], recipeId: number): number {
  const idx = order.indexOf(recipeId)
  return idx === -1 ? Number.MAX_SAFE_INTEGER : idx
}
