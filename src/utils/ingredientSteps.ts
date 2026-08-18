/**
 * Scan recipe steps for Despensa product names and compare them to the
 * ingredient list. Matching is exact (accent/case-insensitive, whole phrase) —
 * the same rule as nutrition lookup, so a near-miss cannot silently pick the
 * wrong SKU.
 */

import type { IngredientRow } from './buildDescription'
import {
  familyKey,
  getGenericoFromDesc,
  getNomeCurtoFromDesc,
  ingredientDisplayName,
} from './despensaAnalytics'
import type { GenericoFavorites } from './genericoFavorites'
import {
  canUseUnitCount,
  resolveIngredientFromProduct,
} from './ingredientFromProduct'
import {
  displayNameForIngredient,
  normalizeIngredientName,
  pickFavoriteProduct,
  resolveProductForIngredient,
} from './ingredientMatch'
import type { Product } from '../types/grocy'

export type AmountMode = 'g' | 'un'

export interface PantryMention {
  displayName: string
  product: Product
}

export interface SuggestedFromSteps {
  displayName: string
  product: Product | null
}

export interface IngredientStepMismatch {
  /** Ingredient display names (Generico) not found in the passos text. */
  unusedIngredients: string[]
  /** Pantry items mentioned in passos but missing from the ingredient list. */
  extraInSteps: string[]
}

const MIN_ALIAS_LEN = 3

/** Collapse accents, case, and punctuation so "Atum," matches "atum". */
export function scanNormalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-z0-9]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim()
}

function phraseInText(haystack: string, phrase: string): boolean {
  if (!phrase) return false
  return ` ${haystack} `.includes(` ${phrase} `)
}

/** Deterministic plural: pantry "ovo" also hits "ovos" in the steps. */
function pluralKey(key: string): string | null {
  if (key.length < MIN_ALIAS_LEN || key.endsWith('s')) return null
  return `${key}s`
}

function keyHitsText(haystack: string, key: string): boolean {
  if (phraseInText(haystack, key)) return true
  const plural = pluralKey(key)
  return plural != null && phraseInText(haystack, plural)
}

interface PantryAlias {
  key: string
  product: Product
  displayName: string
}

function addAlias(byKey: Map<string, Product[]>, phrase: string, product: Product) {
  const key = scanNormalize(phrase)
  if (key.length < MIN_ALIAS_LEN) return
  const list = byKey.get(key) ?? []
  if (!list.some((p) => p.id === product.id)) list.push(product)
  byKey.set(key, list)
}

export function buildPantryAliases(
  products: Product[],
  favorites?: GenericoFavorites
): PantryAlias[] {
  const byKey = new Map<string, Product[]>()
  for (const product of products) {
    addAlias(byKey, product.name, product)
    const curto = getNomeCurtoFromDesc(product.description)
    if (curto) addAlias(byKey, curto, product)
    const generico = getGenericoFromDesc(product.description)
    if (generico) addAlias(byKey, generico, product)
  }

  const aliases: PantryAlias[] = []
  for (const [key, matches] of byKey) {
    const product = pickFavoriteProduct(matches, favorites)
    if (!product) continue
    aliases.push({
      key,
      product,
      displayName: ingredientDisplayName(product.name, product.description),
    })
  }
  aliases.sort(
    (a, b) =>
      b.key.length - a.key.length || a.displayName.localeCompare(b.displayName, 'pt')
  )
  return aliases
}

/** Whole-phrase pantry hits in `text`, one per Generico family. */
export function findPantryMentionsInText(
  text: string,
  products: Product[],
  favorites?: GenericoFavorites
): PantryMention[] {
  const hay = scanNormalize(text)
  if (!hay) return []
  const found: PantryMention[] = []
  const seenFamily = new Set<string>()
  for (const alias of buildPantryAliases(products, favorites)) {
    if (!keyHitsText(hay, alias.key)) continue
    const fam = familyKey(alias.product.name, alias.product.description)
    if (seenFamily.has(fam)) continue
    seenFamily.add(fam)
    found.push({ displayName: alias.displayName, product: alias.product })
  }
  return found
}

function aliasKeysForIngredient(
  name: string,
  products: Product[],
  favorites?: GenericoFavorites
): string[] {
  const keys = new Set<string>()
  const own = scanNormalize(name)
  if (own.length >= MIN_ALIAS_LEN) keys.add(own)
  const product = resolveProductForIngredient(name, products, favorites)
  if (product) {
    for (const phrase of [
      product.name,
      getNomeCurtoFromDesc(product.description) ?? '',
      getGenericoFromDesc(product.description) ?? '',
      ingredientDisplayName(product.name, product.description),
    ]) {
      const key = scanNormalize(phrase)
      if (key.length >= MIN_ALIAS_LEN) keys.add(key)
    }
  }
  return [...keys]
}

function nameAlreadyListed(name: string, existingKeys: Set<string>): boolean {
  const key = normalizeIngredientName(name)
  return key !== '' && existingKeys.has(key)
}

function existingNameKeys(names: string[]): Set<string> {
  return new Set(names.map((n) => normalizeIngredientName(n)).filter(Boolean))
}

/**
 * Local scan of passos against Despensa names. Skips names already in the list.
 */
export function suggestIngredientsFromSteps(
  steps: string,
  products: Product[],
  existingNames: string[],
  favorites?: GenericoFavorites
): SuggestedFromSteps[] {
  const existing = existingNameKeys(existingNames)
  return findPantryMentionsInText(steps, products, favorites).filter((m) => {
    const keys = [
      m.displayName,
      m.product.name,
      getNomeCurtoFromDesc(m.product.description) ?? '',
      getGenericoFromDesc(m.product.description) ?? '',
    ]
    return !keys.some((k) => nameAlreadyListed(k, existing))
  })
}

/**
 * Local pantry scan first; if nothing hits, call `extractNames` (AI) and
 * exact-match those names against Despensa.
 */
export async function collectIngredientSuggestions(
  steps: string,
  products: Product[],
  existingNames: string[],
  favorites: GenericoFavorites | undefined,
  extractNames: (steps: string) => Promise<string[]>
): Promise<SuggestedFromSteps[]> {
  const local = suggestIngredientsFromSteps(steps, products, existingNames, favorites)
  if (local.length > 0) return local
  if (steps.trim().length < 12) return []
  const names = await extractNames(steps)
  return matchExtractedNamesToPantry(names, products, existingNames, favorites)
}

export function matchExtractedNamesToPantry(
  names: string[],
  products: Product[],
  existingNames: string[],
  favorites?: GenericoFavorites
): SuggestedFromSteps[] {
  const existing = existingNameKeys(existingNames)
  const out: SuggestedFromSteps[] = []
  const seen = new Set<string>()
  for (const raw of names) {
    const trimmed = raw.trim()
    if (!trimmed) continue
    const product = resolveProductForIngredient(trimmed, products, favorites)
    const displayName = product
      ? ingredientDisplayName(product.name, product.description)
      : trimmed
    const key = normalizeIngredientName(displayName)
    if (!key || seen.has(key) || nameAlreadyListed(displayName, existing)) continue
    if (product) {
      const aliases = [
        product.name,
        getNomeCurtoFromDesc(product.description) ?? '',
        getGenericoFromDesc(product.description) ?? '',
      ]
      if (aliases.some((a) => nameAlreadyListed(a, existing))) continue
    }
    seen.add(key)
    out.push({ displayName, product })
  }
  return out
}

export function findIngredientStepMismatch(
  ingredientNames: string[],
  steps: string,
  products: Product[],
  favorites?: GenericoFavorites
): IngredientStepMismatch {
  if (!steps.trim()) {
    return { unusedIngredients: [], extraInSteps: [] }
  }
  const hay = scanNormalize(steps)
  const filled = ingredientNames.map((n) => n.trim()).filter(Boolean)

  const unusedIngredients: string[] = []
  const listedKeys = new Set<string>()
  for (const name of filled) {
    const aliases = aliasKeysForIngredient(name, products, favorites)
    for (const key of aliases) listedKeys.add(key)
    const mentioned = aliases.some((key) => keyHitsText(hay, key))
    if (!mentioned) {
      unusedIngredients.push(displayNameForIngredient(name, products, favorites))
    }
  }

  const extraInSteps: string[] = []
  const seenExtra = new Set<string>()
  for (const mention of findPantryMentionsInText(steps, products, favorites)) {
    const keys = aliasKeysForIngredient(mention.displayName, products, favorites)
    if (keys.some((k) => listedKeys.has(k))) continue
    if (seenExtra.has(mention.displayName)) continue
    seenExtra.add(mention.displayName)
    extraInSteps.push(mention.displayName)
  }

  return { unusedIngredients, extraInSteps }
}

export function defaultAmountMode(unitGrams: number | null | undefined): AmountMode {
  return canUseUnitCount(unitGrams) ? 'un' : 'g'
}

export function rowFromSuggestion(
  id: number,
  suggestion: SuggestedFromSteps
): IngredientRow {
  if (suggestion.product) {
    const resolved = resolveIngredientFromProduct(suggestion.product, 1)
    return {
      id,
      name: resolved.name,
      price: resolved.price,
      grams: resolved.grams,
      qty: resolved.qty,
      productId: resolved.productId,
      unitGrams: resolved.unitGrams,
      amountMode: defaultAmountMode(resolved.unitGrams),
    }
  }
  return { id, name: suggestion.displayName, price: '', amountMode: 'g' }
}

/**
 * Fill blank rows, then append. Never changes a row that already has a name.
 */
export function mergeSuggestedIngredientRows(
  rows: IngredientRow[],
  suggestions: SuggestedFromSteps[],
  nextId: () => number
): IngredientRow[] {
  const existing = existingNameKeys(rows.map((r) => r.name))
  const toAdd = suggestions.filter((s) => !nameAlreadyListed(s.displayName, existing))
  if (toAdd.length === 0) return rows

  const next = rows.map((r) => ({ ...r }))
  let i = 0
  for (let r = 0; r < next.length && i < toAdd.length; r++) {
    if (!next[r].name.trim()) {
      next[r] = rowFromSuggestion(next[r].id, toAdd[i])
      existing.add(normalizeIngredientName(toAdd[i].displayName))
      i += 1
    }
  }
  while (i < toAdd.length) {
    next.push(rowFromSuggestion(nextId(), toAdd[i]))
    existing.add(normalizeIngredientName(toAdd[i].displayName))
    i += 1
  }
  return next
}
