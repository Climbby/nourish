export type FuelType = 'diesel' | 'gasoline' | 'gpl' | 'gpl_gasoline'
export type FuelKind = 'diesel' | 'gasoline' | 'gpl'

export interface FuelPrices {
  diesel_eur_per_l: number | null
  gasoline_eur_per_l: number | null
  gpl_eur_per_l: number | null
  source: string
  /** Human-readable provider, e.g. DGEG URL. */
  source_label?: string
  missing?: FuelKind[]
  gpl_samples?: number
  diesel_samples?: number
  gasoline_samples?: number
  sampled_stations?: number
  updated_at: string
}

let memoryCache: FuelPrices | null = null
let memoryCacheAt = 0
const CLIENT_CACHE_MS = 6 * 60 * 60 * 1000

function positiveOrNull(n: unknown): number | null {
  const v = Number(n)
  return Number.isFinite(v) && v > 0 ? v : null
}

export async function fetchFuelPrices(): Promise<FuelPrices | null> {
  if (memoryCache && Date.now() - memoryCacheAt < CLIENT_CACHE_MS) {
    return memoryCache
  }
  try {
    const res = await fetch('/nourish/fuel-prices', { cache: 'no-store' })
    if (!res.ok) throw new Error('fuel prices unavailable')
    const data = (await res.json()) as Partial<FuelPrices>
    const diesel = positiveOrNull(data.diesel_eur_per_l)
    const gasoline = positiveOrNull(data.gasoline_eur_per_l)
    const gpl = positiveOrNull(data.gpl_eur_per_l)
    if (diesel == null && gasoline == null && gpl == null) return null

    const missing: FuelKind[] = Array.isArray(data.missing)
      ? (data.missing.filter((m) => m === 'diesel' || m === 'gasoline' || m === 'gpl') as FuelKind[])
      : [
          ...(diesel == null ? (['diesel'] as const) : []),
          ...(gasoline == null ? (['gasoline'] as const) : []),
          ...(gpl == null ? (['gpl'] as const) : []),
        ]

    const merged: FuelPrices = {
      diesel_eur_per_l: diesel,
      gasoline_eur_per_l: gasoline,
      gpl_eur_per_l: gpl,
      missing,
      source: data.source ?? 'dgeg',
      source_label: data.source_label ?? 'DGEG · precoscombustiveis.dgeg.gov.pt',
      gpl_samples: data.gpl_samples,
      diesel_samples: data.diesel_samples,
      gasoline_samples: data.gasoline_samples,
      sampled_stations: data.sampled_stations,
      updated_at: data.updated_at ?? new Date().toISOString(),
    }
    memoryCache = merged
    memoryCacheAt = Date.now()
    return merged
  } catch {
    return null
  }
}

export function fuelPriceForCar(
  prices: FuelPrices,
  fuelType: FuelType = 'diesel'
): number | null {
  switch (fuelType) {
    case 'gasoline':
      return prices.gasoline_eur_per_l
    case 'gpl':
    case 'gpl_gasoline':
      return prices.gpl_eur_per_l
    default:
      return prices.diesel_eur_per_l
  }
}

export async function reportFuelPriceIssue(fuel: FuelKind, note?: string): Promise<boolean> {
  try {
    const res = await fetch('/nourish/fuel-prices/report', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ fuel, note }),
    })
    return res.ok
  } catch {
    return false
  }
}

export const FUEL_TYPE_OPTIONS: { value: FuelType; label: string }[] = [
  { value: 'diesel', label: 'Gasóleo' },
  { value: 'gasoline', label: 'Gasolina 95' },
  { value: 'gpl', label: 'GPL (gás)' },
  { value: 'gpl_gasoline', label: 'GPL + Gasolina' },
]

export function fuelTypeLabel(fuelType: FuelType | undefined): string {
  const match = FUEL_TYPE_OPTIONS.find((o) => o.value === fuelType)
  return match?.label ?? FUEL_TYPE_OPTIONS[0].label
}

export function formatFuelPricesUpdatedAt(iso: string): string | null {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'))
  if (!Number.isFinite(d.getTime())) return null
  return d.toLocaleString('pt-PT', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: '2-digit',
    minute: '2-digit',
  })
}
