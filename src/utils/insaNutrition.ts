/**
 * Curated INSA (Tabela da Composição de Alimentos) baselines for unpackaged
 * foods (fresh produce, bakery bread). Values are per 100 g edible portion,
 * raw unless the name says otherwise. Used when the user picks Fonte → INSA
 * in the à mão nutrition UI.
 *
 * Matching for the auto-suggestion is accent/case-insensitive and exact on an
 * alias — the same spirit as recipe nutrition (a wrong food must not silently
 * fill plausible numbers). The in-app picker lists the curated table so the
 * user can confirm or change that suggestion.
 */

import {
  getGenericoFromDesc,
  getNomeCurtoFromDesc,
} from './despensaAnalytics'
import type { ProductMacros } from './productNutrition'

export interface InsaMatch {
  macros: ProductMacros
  foodName: string
}

type InsaFood = {
  name: string
  aliases: string[]
  calories: number
  protein: number
  carbs: number
  fat: number
  fibre: number
}

/** INSA TCA reference values (per 100 g edible portion; cru unless noted). */
const INSA_FOODS: InsaFood[] = [
  {
    name: 'Ovo',
    aliases: ['ovo', 'ovos', 'ovo de galinha', 'ovos de galinha'],
    calories: 149,
    protein: 12.5,
    carbs: 0.7,
    fat: 10.3,
    fibre: 0,
  },
  {
    name: 'Cebola',
    aliases: ['cebola', 'cebolas', 'cebola branca', 'cebola roxa'],
    calories: 36,
    protein: 1.2,
    carbs: 7.0,
    fat: 0.2,
    fibre: 1.8,
  },
  {
    name: 'Tomate',
    aliases: ['tomate', 'tomates', 'tomate rama', 'tomate cherry', 'tomate chucha'],
    calories: 18,
    protein: 0.9,
    carbs: 3.5,
    fat: 0.3,
    fibre: 1.4,
  },
  {
    name: 'Alho',
    aliases: ['alho', 'alhos'],
    calories: 111,
    protein: 6.1,
    carbs: 21.3,
    fat: 0.6,
    fibre: 1.5,
  },
  {
    name: 'Alho-francês',
    aliases: ['alho frances', 'alhos franceses'],
    calories: 31,
    protein: 1.5,
    carbs: 4.8,
    fat: 0.3,
    fibre: 2.2,
  },
  {
    name: 'Batata',
    aliases: ['batata', 'batatas'],
    calories: 81,
    protein: 2.0,
    carbs: 17.5,
    fat: 0.1,
    fibre: 1.6,
  },
  {
    name: 'Batata-doce',
    aliases: ['batata doce', 'batatas doces'],
    calories: 87,
    protein: 1.6,
    carbs: 20.1,
    fat: 0.1,
    fibre: 3.0,
  },
  {
    name: 'Cenoura',
    aliases: ['cenoura', 'cenouras'],
    calories: 37,
    protein: 0.8,
    carbs: 6.6,
    fat: 0.2,
    fibre: 2.9,
  },
  {
    name: 'Alface',
    aliases: ['alface'],
    calories: 16,
    protein: 1.3,
    carbs: 1.4,
    fat: 0.3,
    fibre: 1.5,
  },
  {
    name: 'Pimento',
    aliases: ['pimento', 'pimentos', 'pimento vermelho', 'pimento verde'],
    calories: 21,
    protein: 0.9,
    carbs: 3.7,
    fat: 0.2,
    fibre: 1.7,
  },
  {
    name: 'Pepino',
    aliases: ['pepino', 'pepinos'],
    calories: 12,
    protein: 0.7,
    carbs: 2.0,
    fat: 0.1,
    fibre: 0.7,
  },
  {
    name: 'Courgete',
    aliases: ['courgete', 'courgetes', 'curgete', 'curgetes'],
    calories: 16,
    protein: 1.2,
    carbs: 2.2,
    fat: 0.2,
    fibre: 1.1,
  },
  {
    name: 'Brócolos',
    aliases: ['brocolos', 'brocolo', 'broccoli'],
    calories: 32,
    protein: 3.3,
    carbs: 3.1,
    fat: 0.4,
    fibre: 2.8,
  },
  {
    name: 'Couve',
    aliases: ['couve', 'couves', 'couve portuguesa', 'couve galega'],
    calories: 27,
    protein: 3.0,
    carbs: 3.1,
    fat: 0.4,
    fibre: 3.1,
  },
  {
    name: 'Couve-flor',
    aliases: ['couve flor'],
    calories: 25,
    protein: 2.0,
    carbs: 3.0,
    fat: 0.2,
    fibre: 2.1,
  },
  {
    name: 'Espinafres',
    aliases: ['espinafres', 'espinafre'],
    calories: 23,
    protein: 2.9,
    carbs: 1.6,
    fat: 0.4,
    fibre: 2.2,
  },
  {
    name: 'Cogumelos',
    aliases: ['cogumelos', 'cogumelo'],
    calories: 22,
    protein: 3.1,
    carbs: 0.3,
    fat: 0.3,
    fibre: 2.5,
  },
  {
    name: 'Feijão-verde',
    aliases: ['feijao verde', 'feijoes verdes'],
    calories: 31,
    protein: 1.9,
    carbs: 4.6,
    fat: 0.2,
    fibre: 2.7,
  },
  {
    name: 'Ervilhas',
    aliases: ['ervilhas', 'ervilha'],
    calories: 81,
    protein: 5.4,
    carbs: 11.3,
    fat: 0.4,
    fibre: 5.1,
  },
  {
    name: 'Abóbora',
    aliases: ['abobora'],
    calories: 20,
    protein: 0.7,
    carbs: 3.5,
    fat: 0.1,
    fibre: 1.1,
  },
  {
    name: 'Beringela',
    aliases: ['beringela', 'beringelas', 'berinjela'],
    calories: 21,
    protein: 1.0,
    carbs: 3.5,
    fat: 0.2,
    fibre: 2.5,
  },
  {
    name: 'Nabo',
    aliases: ['nabo', 'nabos'],
    calories: 22,
    protein: 0.9,
    carbs: 3.8,
    fat: 0.1,
    fibre: 2.0,
  },
  {
    name: 'Beterraba',
    aliases: ['beterraba', 'beterrabas'],
    calories: 43,
    protein: 1.6,
    carbs: 8.8,
    fat: 0.2,
    fibre: 2.8,
  },
  {
    name: 'Maçã',
    aliases: ['maca', 'macas', 'maça'],
    calories: 47,
    protein: 0.3,
    carbs: 10.1,
    fat: 0.2,
    fibre: 2.3,
  },
  {
    name: 'Banana',
    aliases: ['banana', 'bananas'],
    calories: 89,
    protein: 1.1,
    carbs: 20.0,
    fat: 0.3,
    fibre: 1.8,
  },
  {
    name: 'Laranja',
    aliases: ['laranja', 'laranjas'],
    calories: 45,
    protein: 0.9,
    carbs: 9.0,
    fat: 0.2,
    fibre: 2.0,
  },
  {
    name: 'Limão',
    aliases: ['limao', 'limoes'],
    calories: 29,
    protein: 0.7,
    carbs: 3.2,
    fat: 0.3,
    fibre: 2.8,
  },
  {
    name: 'Pêra',
    aliases: ['pera', 'peras'],
    calories: 48,
    protein: 0.4,
    carbs: 10.6,
    fat: 0.1,
    fibre: 2.8,
  },
  {
    name: 'Morango',
    aliases: ['morango', 'morangos'],
    calories: 32,
    protein: 0.7,
    carbs: 5.5,
    fat: 0.3,
    fibre: 2.0,
  },
  {
    name: 'Uva',
    aliases: ['uva', 'uvas'],
    calories: 67,
    protein: 0.6,
    carbs: 16.1,
    fat: 0.4,
    fibre: 0.9,
  },
  {
    name: 'Kiwi',
    aliases: ['kiwi', 'kiwis'],
    calories: 61,
    protein: 1.1,
    carbs: 11.0,
    fat: 0.5,
    fibre: 3.0,
  },
  {
    name: 'Abacate',
    aliases: ['abacate', 'abacates'],
    calories: 160,
    protein: 2.0,
    carbs: 1.8,
    fat: 15.4,
    fibre: 6.7,
  },
  {
    name: 'Ananás',
    aliases: ['ananas'],
    calories: 50,
    protein: 0.5,
    carbs: 11.5,
    fat: 0.1,
    fibre: 1.4,
  },
  {
    name: 'Manga',
    aliases: ['manga', 'mangas'],
    calories: 60,
    protein: 0.8,
    carbs: 14.1,
    fat: 0.4,
    fibre: 1.6,
  },
  {
    name: 'Melão',
    aliases: ['melao'],
    calories: 28,
    protein: 0.7,
    carbs: 6.0,
    fat: 0.1,
    fibre: 0.8,
  },
  {
    name: 'Melancia',
    aliases: ['melancia'],
    calories: 30,
    protein: 0.6,
    carbs: 6.9,
    fat: 0.2,
    fibre: 0.4,
  },
  {
    name: 'Pêssego',
    aliases: ['pessego', 'pessegos'],
    calories: 41,
    protein: 0.9,
    carbs: 8.4,
    fat: 0.1,
    fibre: 1.5,
  },
  {
    name: 'Salsa',
    aliases: ['salsa'],
    calories: 36,
    protein: 3.0,
    carbs: 3.6,
    fat: 0.8,
    fibre: 3.3,
  },
  {
    name: 'Coentros',
    aliases: ['coentros', 'coentro'],
    calories: 23,
    protein: 2.1,
    carbs: 2.1,
    fat: 0.5,
    fibre: 2.8,
  },
  {
    name: 'Gengibre',
    aliases: ['gengibre'],
    calories: 80,
    protein: 1.8,
    carbs: 15.8,
    fat: 0.8,
    fibre: 2.0,
  },
  // Bread: as sold. Values from INSA TCA (via PortFIR / TCA tables cited as
  // "Tabela da Composição de Alimentos – Instituto Nacional de Saúde Dr.
  // Ricardo Jorge"). Generic «pão» is mistura de trigo e centeio — the usual
  // padaria loaf — not white wheat, sliced, wholemeal, or broa.
  {
    name: 'Pão',
    aliases: [
      'pao',
      'pao de mistura',
      'pao mistura',
      'pao de trigo e centeio',
      'pao da padaria',
      'pao de padaria',
    ],
    calories: 272,
    protein: 9.0,
    carbs: 53.8,
    fat: 1.4,
    fibre: 4.3,
  },
  {
    name: 'Pão de trigo',
    aliases: [
      'pao de trigo',
      'pao branco',
      'pao de trigo branco',
      'pao branco de trigo',
      'pao branco de padaria',
    ],
    calories: 290,
    protein: 8.4,
    carbs: 57.3,
    fat: 2.2,
    fibre: 3.8,
  },
  {
    name: 'Pão de forma',
    aliases: ['pao de forma', 'pao de forma branco', 'pao de forma de trigo'],
    calories: 284,
    protein: 8.7,
    carbs: 54.5,
    fat: 2.7,
    fibre: 3.2,
  },
  {
    name: 'Pão integral',
    aliases: [
      'pao integral',
      'pao de trigo integral',
      'pao integral de trigo',
      'pao de forma integral',
    ],
    calories: 232,
    protein: 7.6,
    carbs: 39.9,
    fat: 3.0,
    fibre: 7.4,
  },
  {
    name: 'Broa',
    aliases: ['broa de milho', 'pao de milho', 'broa de milho amarela'],
    calories: 188,
    protein: 5.3,
    carbs: 37.2,
    fat: 1.2,
    fibre: 3.7,
  },
]

function normalizeFoodName(name: string): string {
  return name
    .trim()
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/-/g, ' ')
    .replace(/\s+/g, ' ')
}

const BY_ALIAS = new Map<string, InsaFood>()
for (const food of INSA_FOODS) {
  const keys = [food.name, ...food.aliases]
  for (const key of keys) {
    const normalized = normalizeFoodName(key)
    if (normalized && !BY_ALIAS.has(normalized)) BY_ALIAS.set(normalized, food)
  }
}

function macrosFromFood(food: InsaFood): ProductMacros {
  return {
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    fibre: food.fibre,
    source: 'insa',
  }
}

/** Browseable catalog row (canonical name + per-100 g values). */
export type InsaFoodOption = {
  name: string
  calories: number
  protein: number
  carbs: number
  fat: number
  fibre: number
}

function toOption(food: InsaFood): InsaFoodOption {
  return {
    name: food.name,
    calories: food.calories,
    protein: food.protein,
    carbs: food.carbs,
    fat: food.fat,
    fibre: food.fibre,
  }
}

function byPtName(a: InsaFoodOption, b: InsaFoodOption): number {
  return a.name.localeCompare(b.name, 'pt')
}

/** Full curated table, sorted for the in-app picker. */
export function listInsaFoods(): InsaFoodOption[] {
  return INSA_FOODS.map(toOption).sort(byPtName)
}

/**
 * Picker search: accent/case-insensitive substring on the canonical name and
 * aliases. Empty query returns the full list. This is looser than auto-match
 * (exact alias) on purpose — the user is choosing, not guessing.
 */
export function searchInsaFoods(query: string): InsaFoodOption[] {
  const q = normalizeFoodName(query)
  const foods = !q
    ? INSA_FOODS
    : INSA_FOODS.filter((food) => {
        if (normalizeFoodName(food.name).includes(q)) return true
        return food.aliases.some((alias) => normalizeFoodName(alias).includes(q))
      })
  return foods.map(toOption).sort(byPtName)
}

/** Fill macros from a picker row (canonical name, not a fuzzy alias). */
export function applyInsaFood(name: string): InsaMatch | null {
  const key = normalizeFoodName(name)
  if (!key) return null
  const food = INSA_FOODS.find((f) => normalizeFoodName(f.name) === key)
  if (!food) return null
  return { macros: macrosFromFood(food), foodName: food.name }
}

/**
 * Names to try, cooking/generic first so a long receipt title does not have to
 * be an INSA alias. Deduped by normalized form.
 */
export function insaLookupNames(opts: {
  productName: string
  description: string | null
  generico?: string
}): string[] {
  const names = [
    getNomeCurtoFromDesc(opts.description),
    opts.generico?.trim() || null,
    getGenericoFromDesc(opts.description),
    opts.productName,
  ]
  const seen = new Set<string>()
  const out: string[] = []
  for (const name of names) {
    if (!name?.trim()) continue
    const key = normalizeFoodName(name)
    if (!key || seen.has(key)) continue
    seen.add(key)
    out.push(name.trim())
  }
  return out
}

/** First exact alias hit among `candidates` (already in priority order). */
export function lookupInsaMacros(candidates: string[]): InsaMatch | null {
  for (const candidate of candidates) {
    const key = normalizeFoodName(candidate)
    if (!key) continue
    const food = BY_ALIAS.get(key)
    if (food) return { macros: macrosFromFood(food), foodName: food.name }
  }
  return null
}

/** Fill per-100 g macros and tag them `source: insa`. */
export function applyInsaSource(candidates: string[]): InsaMatch | null {
  return lookupInsaMacros(candidates)
}

export function insaMissingMessage(candidates: string[]): string {
  const shown = candidates.find((n) => n.trim())?.trim()
  if (!shown) {
    return 'Não há um nome de produto para procurar na tabela INSA.'
  }
  return `Não há valores INSA para «${shown}». Escolhe um alimento na tabela nacional ou preenche à mão.`
}
