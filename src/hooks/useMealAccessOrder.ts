import { useEffect, useState } from 'react'
import {
  getMealAccessOrder,
  splayMealAccess,
  subscribeMealAccess,
} from '../utils/mealAccess'

export function useMealAccessOrder() {
  const [order, setOrder] = useState<number[]>(() => getMealAccessOrder())

  useEffect(() => subscribeMealAccess(() => setOrder(getMealAccessOrder())), [])

  return { order, splay: splayMealAccess }
}
