const STORAGE_KEY = 'nourish-receipt-aliases'

const memoryFallback: Record<string, number> = {}

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined'
  } catch {
    return false
  }
}

function loadMap(): Record<string, number> {
  if (!hasLocalStorage()) return { ...memoryFallback }
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return {}
    const parsed = JSON.parse(raw) as Record<string, number>
    return typeof parsed === 'object' && parsed !== null ? parsed : {}
  } catch {
    return {}
  }
}

function saveMap(map: Record<string, number>) {
  if (!hasLocalStorage()) {
    Object.keys(memoryFallback).forEach((k) => delete memoryFallback[k])
    Object.assign(memoryFallback, map)
    return
  }
  localStorage.setItem(STORAGE_KEY, JSON.stringify(map))
}

export function getAliasProductId(receiptName: string): number | null {
  const key = receiptName.trim().toLowerCase()
  const id = loadMap()[key]
  return typeof id === 'number' ? id : null
}

export function setAlias(receiptName: string, productId: number) {
  const map = loadMap()
  map[receiptName.trim().toLowerCase()] = productId
  saveMap(map)
}

export function removeAlias(receiptName: string) {
  const map = loadMap()
  delete map[receiptName.trim().toLowerCase()]
  saveMap(map)
}
