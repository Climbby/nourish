export type FuelType = 'diesel' | 'gasoline' | 'gpl' | 'gpl_gasoline'

export interface FuelPrices {
  diesel_eur_per_l: number
  gasoline_eur_per_l: number
  gpl_eur_per_l: number
  source: string
  sampled_stations?: number
  updated_at: string
}

const FALLBACK: FuelPrices = {
  diesel_eur_per_l: 1.75,
  gasoline_eur_per_l: 1.8,
  gpl_eur_per_l: 0.92,
  source: 'fallback',
  updated_at: new Date().toISOString(),
}

let memoryCache: FuelPrices | null = null
let memoryCacheAt = 0
const CLIENT_CACHE_MS = 6 * 60 * 60 * 1000

export async function fetchFuelPrices(): Promise<FuelPrices> {
  if (memoryCache && Date.now() - memoryCacheAt < CLIENT_CACHE_MS) {
    return memoryCache
  }
  try {
    const res = await fetch('/nourish/fuel-prices', { cache: 'no-store' })
    if (!res.ok) throw new Error('fuel prices unavailable')
    const data = (await res.json()) as Partial<FuelPrices>
    if (Number(data.diesel_eur_per_l) > 0 || Number(data.gasoline_eur_per_l) > 0) {
      const merged: FuelPrices = {
        ...FALLBACK,
        ...data,
        diesel_eur_per_l: Number(data.diesel_eur_per_l) > 0 ? data.diesel_eur_per_l! : FALLBACK.diesel_eur_per_l,
        gasoline_eur_per_l:
          Number(data.gasoline_eur_per_l) > 0 ? data.gasoline_eur_per_l! : FALLBACK.gasoline_eur_per_l,
        gpl_eur_per_l: Number(data.gpl_eur_per_l) > 0 ? data.gpl_eur_per_l! : FALLBACK.gpl_eur_per_l,
        source: data.source ?? FALLBACK.source,
        updated_at: data.updated_at ?? FALLBACK.updated_at,
      }
      memoryCache = merged
      memoryCacheAt = Date.now()
      return merged
    }
  } catch {
    /* homelab offline */
  }
  return FALLBACK
}

export function fuelPriceForCar(
  prices: FuelPrices,
  fuelType: FuelType = 'diesel'
): number {
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
