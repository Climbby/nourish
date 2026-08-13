import { useCallback, useState } from 'react'

import type { FuelType } from '../utils/fuelPrices'

export interface Car {
  id: string
  name: string
  /** Litres per 100 km */
  consumption_l100km: number
  /** diesel, gasoline, gpl, or gpl_gasoline — price fetched automatically from DGEG */
  fuel_type?: FuelType
  /** @deprecated trip km comes from OSRM routing */
  default_trip_km?: number
  /** @deprecated use automatic fuel prices */
  fuel_price_per_l?: number
}

const STORAGE_KEY = 'nourish-cars'
const ENABLED_KEY = 'nourish-cars-enabled'

export function createCarId(): string {
  return `car-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`
}

function loadLocal(): Car[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed : []
  } catch {
    return []
  }
}

function saveLocal(cars: Car[]) {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(cars))
}

function loadEnabled(): boolean {
  try {
    const raw = localStorage.getItem(ENABLED_KEY)
    if (raw === '1') return true
    if (raw === '0') return false
    // Existing installs with cars stay active
    return loadLocal().length > 0
  } catch {
    return false
  }
}

function persistEnabled(enabled: boolean) {
  localStorage.setItem(ENABLED_KEY, enabled ? '1' : '0')
}

/** Sync check for places that don't use the hook (auto-link, receipts). */
export function carsFeatureEnabled(): boolean {
  return loadEnabled()
}

export async function fetchCars(): Promise<Car[]> {
  try {
    const res = await fetch('/nourish/cars', { cache: 'no-store' })
    if (!res.ok) return loadLocal()
    const data = (await res.json()) as { cars?: Car[] }
    const list = Array.isArray(data.cars) ? data.cars : []
    saveLocal(list)
    return list
  } catch {
    return loadLocal()
  }
}

export async function persistCars(cars: Car[]): Promise<void> {
  saveLocal(cars)
  try {
    await fetch('/nourish/cars', {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ cars }),
    })
  } catch {
    /* local fallback already saved */
  }
}

export function useCars() {
  const [cars, setCarsState] = useState<Car[]>(loadLocal)
  const [enabled, setEnabledState] = useState(loadEnabled)

  const setEnabled = useCallback((next: boolean) => {
    persistEnabled(next)
    setEnabledState(next)
  }, [])

  const setCars = useCallback((next: Car[]) => {
    setCarsState(next)
    void persistCars(next)
  }, [])

  const addCar = useCallback(
    (car: Omit<Car, 'id'>) => {
      const next = [...cars, { ...car, id: createCarId() }]
      setCars(next)
      setEnabled(true)
      return next[next.length - 1]
    },
    [cars, setCars, setEnabled]
  )

  const updateCar = useCallback(
    (id: string, patch: Partial<Omit<Car, 'id'>>) => {
      const next = cars.map((c) => (c.id === id ? { ...c, ...patch } : c))
      setCars(next)
    },
    [cars, setCars]
  )

  const removeCar = useCallback(
    (id: string) => {
      setCars(cars.filter((c) => c.id !== id))
    },
    [cars, setCars]
  )

  const refreshCars = useCallback(() => {
    void fetchCars().then(setCarsState)
  }, [])

  return { cars, setCars, addCar, updateCar, removeCar, refreshCars, enabled, setEnabled }
}
