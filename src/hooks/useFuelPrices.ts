import { useCallback, useEffect, useState } from 'react'
import { fetchFuelPrices, fuelPriceForCar, type FuelPrices } from '../utils/fuelPrices'
import type { FuelType } from '../utils/fuelPrices'
import type { Car } from './useCars'

export function useFuelPrices() {
  const [prices, setPrices] = useState<FuelPrices | null>(null)

  const refresh = useCallback(() => {
    void fetchFuelPrices().then(setPrices)
  }, [])

  useEffect(() => {
    refresh()
  }, [refresh])

  function priceForCar(car: Car): number | null {
    if (!prices) return null
    return fuelPriceForCar(prices, car.fuel_type ?? 'diesel')
  }

  return { prices, refresh, priceForCar }
}

export type { FuelType }
