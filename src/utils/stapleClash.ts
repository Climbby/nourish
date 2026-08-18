/**
 * Avoid suggesting two meals that share a staple (pasta, rice, the same meat)
 * in a short window of the weekly plan.
 *
 * Identity is exact-ish: accent/case-insensitive names, Generico/NomeCurto
 * when a product matches, plus a small alias table for pasta-family carbs.
 * Not a fuzzy matcher — "sal" must not hit "salsa".
 */

import type { Product, Recipe } from '../types/grocy'
import { familyKey, ingredientDisplayName } from './despensaAnalytics'
import { findIngredientProductMatches, normalizeIngredientName } from './ingredientMatch'
import { parseDescription } from './parseDescription'
import { diffDays } from './planDates'
import { SCORE_WINDOW } from './suggestionPick'

/** Same calendar day and the days on either side. */
export const STAPLE_CLASH_DAY_WINDOW = 1

/** Inclusive calendar-day distance vs `STAPLE_CLASH_DAY_WINDOW`. */
export function inStapleClashWindow(fromIso: string, toIso: string): boolean {
  return Math.abs(diffDays(fromIso, toIso)) <= STAPLE_CLASH_DAY_WINDOW
}

/** Recipes already placed on dates within ±window of `targetDate`. */
export function recipesInStapleClashWindow(
  nearby: Array<{ date: string; recipe: Recipe }>,
  targetDate: string
): Recipe[] {
  return nearby.filter((item) => inStapleClashWindow(item.date, targetDate)).map((item) => item.recipe)
}

export function occupiedStaplesNearDate(
  nearby: Array<{ date: string; recipe: Recipe }>,
  targetDate: string,
  products?: Product[]
): Set<string> {
  return unionStapleKeys(recipesInStapleClashWindow(nearby, targetDate), products)
}

/**
 * Drop a clashing candidate well below `pickScored`'s near-tie window so a
 * different meal wins the later slot. Shared by every leftover candidate when
 * the library is all pasta — then the usual pick still fills the slot.
 */
export const STAPLE_CLASH_PENALTY = Math.ceil(SCORE_WINDOW) + 24

const SEASONINGS = new Set(
  [
    'sal',
    'sal fino',
    'sal grosso',
    'sal marinho',
    'azeite',
    'oleo',
    'oleo de oliva',
    'oleo de girassol',
    'oil',
    'alho',
    'alhos',
    'alho em po',
    'cebola',
    'cebolas',
    'pimenta',
    'pimenta preta',
    'pimenta branca',
    'pimenta moida',
    'oregaos',
    'oregano',
    'oregao',
    'louro',
    'folha de louro',
    'folhas de louro',
    'colorau',
    'cominhos',
    'paprika',
    'vinagre',
    'acucar',
    'acucar branco',
    'agua',
    'manteiga',
    'limao',
    'lima',
    'salsa',
    'coentros',
    'hortela',
    'canela',
    'noz moscada',
    'pimentao doce',
    'mostarda',
  ].map(normalizeIngredientName)
)

/** Leading token is enough to skip "alho em po" / "azeite virgem". */
const SEASONING_HEADS = new Set(
  ['sal', 'azeite', 'oleo', 'alho', 'pimenta', 'oregao', 'oregaos', 'louro', 'vinagre', 'acucar', 'agua', 'salsa'].map(
    normalizeIngredientName
  )
)

/**
 * Known staple families. Full-name match always; whole-word tokens also match
 * except generic "massa"/"pasta", which would hit "massa de pimentao".
 */
const STAPLE_ALIASES: Record<string, string> = {
  esparguete: 'carb:massa',
  spaghetti: 'carb:massa',
  spagetti: 'carb:massa',
  spaguetti: 'carb:massa',
  pasta: 'carb:massa',
  massa: 'carb:massa',
  macarrao: 'carb:massa',
  fusilli: 'carb:massa',
  penne: 'carb:massa',
  linguini: 'carb:massa',
  linguine: 'carb:massa',
  tagliatelle: 'carb:massa',
  farfalle: 'carb:massa',
  lasanha: 'carb:massa',
  lasagna: 'carb:massa',
  talharim: 'carb:massa',
  ninho: 'carb:massa',
  ninhos: 'carb:massa',
  arroz: 'carb:arroz',
  rice: 'carb:arroz',
  basmati: 'carb:arroz',
  batata: 'carb:batata',
  batatas: 'carb:batata',
  potato: 'carb:batata',
  potatoes: 'carb:batata',
  'batata doce': 'carb:batata',
  'batata-doce': 'carb:batata',
  cuscuz: 'carb:cuscuz',
  couscous: 'carb:cuscuz',
  quinoa: 'carb:quinoa',
  frango: 'prot:frango',
  chicken: 'prot:frango',
  galinha: 'prot:frango',
  atum: 'prot:atum',
  tuna: 'prot:atum',
  porco: 'prot:porco',
  pork: 'prot:porco',
  vaca: 'prot:vaca',
  beef: 'prot:vaca',
  bovino: 'prot:vaca',
  ovo: 'prot:ovo',
  ovos: 'prot:ovo',
}

const GENERIC_CARB_HEADS = new Set(['massa', 'pasta'])

function firstToken(normalized: string): string {
  const idx = normalized.indexOf(' ')
  return idx === -1 ? normalized : normalized.slice(0, idx)
}

function isSeasoning(normalized: string): boolean {
  if (!normalized) return false
  if (SEASONINGS.has(normalized)) return true
  return SEASONING_HEADS.has(firstToken(normalized))
}

function addCanonical(keys: Set<string>, normalized: string, allowGenericCarbHeads: boolean): void {
  const exact = STAPLE_ALIASES[normalized]
  if (exact) {
    keys.add(exact)
    return
  }
  for (const token of normalized.split(' ')) {
    const aliased = STAPLE_ALIASES[token]
    if (!aliased) continue
    if (!allowGenericCarbHeads && GENERIC_CARB_HEADS.has(token)) continue
    keys.add(aliased)
  }
}

function identityForName(name: string, products?: Product[]): string | null {
  const raw = normalizeIngredientName(name)
  if (!raw || isSeasoning(raw)) return null

  let family = raw
  if (products && products.length > 0) {
    const matches = findIngredientProductMatches(name, products)
    const product = matches[0]
    if (product) {
      const generico = normalizeIngredientName(
        ingredientDisplayName(product.name, product.description)
      )
      const fam = normalizeIngredientName(familyKey(product.name, product.description))
      const resolved = generico || fam
      if (resolved) {
        if (isSeasoning(resolved)) return null
        family = resolved
      }
    }
  }

  const keys = new Set<string>()
  addCanonical(keys, family, false)
  if (keys.size > 0) return [...keys][0]
  return family
}

function addIdentity(keys: Set<string>, name: string, products?: Product[]): void {
  const id = identityForName(name, products)
  if (id) keys.add(id)
}

/** Staple identities for a recipe: non-seasoning ingredients, plus name tokens. */
export function stapleKeysFromRecipe(recipe: Recipe, products?: Product[]): Set<string> {
  const keys = new Set<string>()
  const { ingredientItems } = parseDescription(recipe.description ?? '')
  for (const item of ingredientItems) {
    addIdentity(keys, item.name, products)
  }
  // Empty/poor descriptions still clash on "Esparguete à bolonhesa" in the title.
  const name = normalizeIngredientName(recipe.name)
  if (name) addCanonical(keys, name, true)
  return keys
}

export function unionStapleKeys(recipes: Recipe[], products?: Product[]): Set<string> {
  const keys = new Set<string>()
  for (const recipe of recipes) {
    for (const key of stapleKeysFromRecipe(recipe, products)) keys.add(key)
  }
  return keys
}

export function stapleSetsClash(a: Set<string>, b: Set<string>): boolean {
  if (a.size === 0 || b.size === 0) return false
  for (const key of a) {
    if (b.has(key)) return true
  }
  return false
}

export function recipesShareStaple(
  a: Recipe,
  b: Recipe,
  products?: Product[]
): boolean {
  return stapleSetsClash(stapleKeysFromRecipe(a, products), stapleKeysFromRecipe(b, products))
}

/** 0 or `STAPLE_CLASH_PENALTY` — subtract from a candidate score. */
export function stapleClashPenalty(candidate: Set<string>, occupied: Set<string>): number {
  return stapleSetsClash(candidate, occupied) ? STAPLE_CLASH_PENALTY : 0
}
