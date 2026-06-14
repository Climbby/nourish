import type { FuelType } from '../utils/fuelPrices'

export interface CarPreset {
  label: string
  consumption_l100km: number
  fuel_type?: FuelType
}

/** Common models in PT — consumption = combined cycle (L/100 km), approximate. */
export const CAR_PRESETS: CarPreset[] = [
  { label: 'Volkswagen Golf', consumption_l100km: 5.8 },
  { label: 'Volkswagen Polo', consumption_l100km: 5.2 },
  { label: 'Renault Clio', consumption_l100km: 5.4 },
  { label: 'Renault Megane', consumption_l100km: 5.9 },
  { label: 'Peugeot 208', consumption_l100km: 5.3 },
  { label: 'Peugeot 308', consumption_l100km: 5.7 },
  { label: 'Citroën C3', consumption_l100km: 5.5 },
  { label: 'Citroën C4', consumption_l100km: 5.8 },
  { label: 'Toyota Yaris', consumption_l100km: 4.8 },
  { label: 'Toyota Corolla', consumption_l100km: 5.2 },
  { label: 'Toyota RAV4', consumption_l100km: 6.5 },
  { label: 'Ford Fiesta', consumption_l100km: 5.6 },
  { label: 'Ford Focus', consumption_l100km: 5.9 },
  { label: 'Seat Ibiza', consumption_l100km: 5.4 },
  { label: 'Seat Leon', consumption_l100km: 5.7 },
  { label: 'Fiat 500', consumption_l100km: 5.0 },
  { label: 'Fiat Panda', consumption_l100km: 5.2 },
  { label: 'Opel Corsa', consumption_l100km: 5.5 },
  { label: 'Opel Astra', consumption_l100km: 5.8 },
  { label: 'Mercedes-Benz A-Class', consumption_l100km: 6.2 },
  { label: 'BMW 1 Series', consumption_l100km: 6.4 },
  { label: 'Audi A1 (3 portas)', consumption_l100km: 7.5, fuel_type: 'gpl_gasoline' },
  { label: 'Audi A3 (3 portas)', consumption_l100km: 7.2, fuel_type: 'gpl_gasoline' },
  { label: 'Audi A3', consumption_l100km: 6.1 },
  { label: 'Audi TT', consumption_l100km: 7.8, fuel_type: 'gasoline' },
  { label: 'Nissan Qashqai', consumption_l100km: 6.3 },
  { label: 'Hyundai i20', consumption_l100km: 5.3 },
  { label: 'Hyundai Tucson', consumption_l100km: 6.8 },
  { label: 'Kia Ceed', consumption_l100km: 5.6 },
  { label: 'Kia Sportage', consumption_l100km: 6.7 },
  { label: 'Dacia Sandero', consumption_l100km: 5.8 },
  { label: 'Dacia Duster', consumption_l100km: 6.5 },
  { label: 'Tesla Model 3', consumption_l100km: 0 },
  { label: 'Tesla Model Y', consumption_l100km: 0 },
]

export function searchCarPresets(query: string, limit = 8): CarPreset[] {
  const q = query.trim().toLowerCase()
  if (!q) return []
  return CAR_PRESETS.filter((p) => p.label.toLowerCase().includes(q)).slice(0, limit)
}

const FUEL_LABELS: Record<FuelType, string> = {
  diesel: 'gasóleo',
  gasoline: 'gasolina',
  gpl: 'GPL',
  gpl_gasoline: 'GPL+gasolina',
}

export function fuelTypeShortLabel(type?: FuelType): string | null {
  if (!type) return null
  return FUEL_LABELS[type]
}
