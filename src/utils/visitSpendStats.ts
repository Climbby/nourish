import type { SupermarketVisit } from '../api/homelabMetrics'
import type { Car } from '../hooks/useCars'
import type { StatsPeriod } from './mealStats'
import { getPeriodMeta } from './mealStats'
import { realSupermarketVisits } from './supermarketVisits'
import { receiptTotalEur } from './visitVisitCost'
import { formatTripCost, tripKm, visitTripCostEur } from './visitTripCost'
import type { VisitCarLink } from './visitCars'
import type { VisitReceiptLink } from './visitReceipts'

export interface VisitFuelTripDetail {
  visit: SupermarketVisit
  destination: string
  fuelEur: number | null
  km: number | null
}

export interface VisitShoppingTripDetail {
  visit: SupermarketVisit
  destination: string
  totalEur: number | null
  itemCount: number | null
  km: number | null
}

export interface VisitSpendTotals {
  shoppingEur: number
  fuelEur: number
  visitsInPeriod: number
  visitsWithReceipt: number
  visitsWithFuelCost: number
}

function visitDay(iso: string): string {
  const d = new Date(iso.includes('T') ? iso : iso.replace(' ', 'T'))
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}

function endDay(now = new Date()): string {
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`
}

export function filterVisitsByPeriod(
  visits: SupermarketVisit[],
  period: StatsPeriod,
  now = new Date()
): SupermarketVisit[] {
  const { startDay } = getPeriodMeta(period, now)
  const end = endDay(now)
  return realSupermarketVisits(visits).filter((v) => {
    const day = visitDay(v.entered_at)
    return day >= startDay && day <= end
  })
}

export function aggregateVisitSpend(
  visits: SupermarketVisit[],
  carLinks: VisitCarLink[],
  receipts: VisitReceiptLink[],
  carsById: Map<string, Car>
): VisitSpendTotals {
  const carByVisit = new Map(carLinks.map((l) => [l.visit_entered_at, l]))
  const receiptByVisit = new Map(receipts.map((r) => [r.visit_entered_at, r]))

  let shoppingEur = 0
  let fuelEur = 0
  let visitsWithReceipt = 0
  let visitsWithFuelCost = 0

  for (const visit of visits) {
    const receipt = receiptByVisit.get(visit.entered_at)
    const receiptEur = receiptTotalEur(receipt)
    if (receiptEur != null) {
      shoppingEur += receiptEur
      visitsWithReceipt++
    }

    const carLink = carByVisit.get(visit.entered_at)
    const car = carLink ? carsById.get(carLink.car_id) : undefined
    const tripCost = visitTripCostEur(carLink, visit, car)
    if (tripCost != null) {
      fuelEur += tripCost
      visitsWithFuelCost++
    }
  }

  return {
    shoppingEur: Math.round(shoppingEur * 100) / 100,
    fuelEur: Math.round(fuelEur * 100) / 100,
    visitsInPeriod: visits.length,
    visitsWithReceipt,
    visitsWithFuelCost,
  }
}

export function buildVisitFuelTrips(
  visits: SupermarketVisit[],
  carLinks: VisitCarLink[],
  carsById: Map<string, Car>,
  destinationForVisit: (visit: SupermarketVisit) => string
): VisitFuelTripDetail[] {
  const carByVisit = new Map(carLinks.map((l) => [l.visit_entered_at, l]))

  return [...visits]
    .sort((a, b) => b.entered_at.localeCompare(a.entered_at))
    .map((visit) => {
      const carLink = carByVisit.get(visit.entered_at)
      const car = carLink ? carsById.get(carLink.car_id) : undefined
      const fuelEur = visitTripCostEur(carLink, visit, car)
      const km = tripKm(carLink, visit)
      return {
        visit,
        destination: destinationForVisit(visit),
        fuelEur,
        km,
      }
    })
}

export function buildVisitShoppingTrips(
  visits: SupermarketVisit[],
  receipts: VisitReceiptLink[],
  destinationForVisit: (visit: SupermarketVisit) => string,
  carLinks: VisitCarLink[] = []
): VisitShoppingTripDetail[] {
  const receiptByVisit = new Map(receipts.map((r) => [r.visit_entered_at, r]))
  const carByVisit = new Map(carLinks.map((l) => [l.visit_entered_at, l]))

  return [...visits]
    .sort((a, b) => b.entered_at.localeCompare(a.entered_at))
    .map((visit) => {
      const receipt = receiptByVisit.get(visit.entered_at)
      const totalEur = receiptTotalEur(receipt)
      const carLink = carByVisit.get(visit.entered_at)
      return {
        visit,
        destination: destinationForVisit(visit),
        totalEur,
        itemCount: receipt?.item_count ?? null,
        km: tripKm(carLink, visit),
      }
    })
}
