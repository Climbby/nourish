/**
 * Read a packaged-food nutrition table from a photo.
 *
 * This is the most reliable vision job in the app: the table is a fixed grid,
 * the units are standardised, and EU labelling law requires the per-100 g
 * column. Far easier than receipts — but the model still gets checked, and the
 * user always confirms before anything is saved.
 */

import { requestVisionJson } from '../../api/ai'
import { downscaleImage } from '../receipt/extractReceiptVision'
import type { ProductMacros } from '../../utils/productNutrition'

const SYSTEM_PROMPT = `És um leitor de tabelas nutricionais de embalagens de comida.
Devolves SEMPRE e APENAS um objecto JSON, sem texto à volta e sem blocos de código.

Formato exacto:
{"calories": number, "protein": number, "carbs": number, "fat": number, "fibre": number, "per": "100g" | "porcao" | "desconhecido", "netGrams": number|null}

Regras:
- Usa SEMPRE a coluna "por 100 g" ou "por 100 ml". Ignora a coluna por porção/dose se existirem as duas.
- "calories" é o valor em kcal, NUNCA em kJ. Se a tabela mostrar os dois (ex.: "1750 kJ / 420 kcal"), devolve 420.
- "carbs" são os hidratos de carbono TOTAIS, não a linha "dos quais açúcares".
- "fat" é a gordura TOTAL, não a linha "das quais saturadas".
- "fibre" é a fibra. Se a tabela não a indicar, devolve 0.
- Define "per" com a coluna que realmente usaste.
- "netGrams" é o peso líquido da EMBALAGEM (peso líquido / conteúdo / "e 185 g"), em gramas. Não é a porção nem os 100 g da tabela. Se estiver em kg, converte para gramas (0,5 kg → 500). Se não estiver visível, devolve null.
- Se um valor não for legível, devolve 0 para esse campo.
- Não inventes valores. Não devolvas unidades, apenas números.`

/** kcal per 100 g cannot exceed pure fat (~900). Anything higher is kJ. */
const MAX_KCAL_PER_100G = 900
const KJ_PER_KCAL = 4.184

export interface NutritionLabelResult {
  macros: Omit<ProductMacros, 'source'>
  /** Which column the model says it read — 'porcao' means the values are suspect. */
  per: '100g' | 'porcao' | 'desconhecido'
  /** True when an energy value in kJ was detected and converted to kcal. */
  convertedFromKj: boolean
  /** Pack net weight in grams, if printed on the pack. */
  netGrams: number | null
}

function num(v: unknown): number {
  const n = typeof v === 'string' ? parseFloat(v.replace(',', '.')) : v
  if (typeof n !== 'number' || !Number.isFinite(n) || n < 0) return 0
  return n
}

/** Validate and coerce the model's raw JSON. Pure — no network, no DOM. */
export function normalizeNutritionLabel(raw: unknown): NutritionLabelResult {
  const obj = (raw ?? {}) as Record<string, unknown>

  let calories = num(obj.calories)
  let convertedFromKj = false

  // Models sometimes grab the kJ figure even when told not to. Nothing edible
  // exceeds ~900 kcal/100 g, so a larger number is energy in kJ.
  if (calories > MAX_KCAL_PER_100G) {
    calories = Math.round(calories / KJ_PER_KCAL)
    convertedFromKj = true
  }

  const perRaw = typeof obj.per === 'string' ? obj.per.toLowerCase() : ''
  const per: NutritionLabelResult['per'] =
    perRaw === '100g' || perRaw === '100ml' ? '100g' : perRaw === 'porcao' ? 'porcao' : 'desconhecido'

  const round1 = (n: number) => Math.round(n * 10) / 10
  const rawNet = obj.netGrams ?? obj.net_grams
  let netGrams: number | null = num(rawNet)
  if (!netGrams || netGrams < 5 || netGrams > 10000) netGrams = null
  else netGrams = Math.round(netGrams * 100) / 100

  return {
    macros: {
      calories: Math.round(calories),
      protein: round1(num(obj.protein)),
      carbs: round1(num(obj.carbs)),
      fat: round1(num(obj.fat)),
      fibre: round1(num(obj.fibre)),
    },
    per,
    convertedFromKj,
    netGrams,
  }
}

/** True when the extraction produced nothing usable. */
export function isEmptyLabel(result: NutritionLabelResult): boolean {
  const { calories, protein, carbs, fat, fibre } = result.macros
  return !calories && !protein && !carbs && !fat && !fibre
}

export async function extractNutritionLabel(file: File): Promise<NutritionLabelResult> {
  const imageDataUrl = await downscaleImage(file)
  const raw = await requestVisionJson(
    SYSTEM_PROMPT,
    'Lê a tabela nutricional desta embalagem e devolve os valores por 100 g. Se o peso líquido da embalagem estiver visível, inclui-o em netGrams.',
    imageDataUrl,
    512
  )
  return normalizeNutritionLabel(raw)
}
