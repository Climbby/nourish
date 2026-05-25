export interface IngredientRow {
  id: number
  name: string
  price: string
}

export function computeAutoTotal(rows: IngredientRow[]): number {
  return rows.reduce((sum, r) => {
    const p = parseFloat(r.price)
    return isNaN(p) ? sum : sum + p
  }, 0)
}

export function buildDescription(
  ingredientRows: IngredientRow[],
  steps: string,
  nutrition: { calories: string; protein: string; carbs: string; fat: string },
  priceOverride: string,
  autoTotal: number
): string {
  const parts: string[] = []

  const filled = ingredientRows.filter((r) => r.name.trim())
  if (filled.length > 0) {
    const lines = filled.map((r) => {
      const p = parseFloat(r.price)
      return !isNaN(p) && p > 0 ? `${r.name.trim()}|${p.toFixed(2)}` : r.name.trim()
    })
    parts.push(`[Ingredientes]\n${lines.join('\n')}`)
  }

  if (steps.trim()) parts.push(`[Passos]\n${steps.trim()}`)

  const { calories, protein, carbs, fat } = nutrition
  if (calories || protein || carbs || fat) {
    parts.push(
      `[Nutricao]\ncalories:${calories || 0}\nprotein:${protein || 0}\ncarbs:${carbs || 0}\nfat:${fat || 0}`
    )
  }

  const finalPrice = priceOverride !== '' ? parseFloat(priceOverride) : autoTotal
  if (!isNaN(finalPrice) && finalPrice > 0) {
    parts.push(`[Preco]\n${finalPrice.toFixed(2)}`)
  }

  return parts.join('\n\n')
}
