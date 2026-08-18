import { useEffect, useMemo, useState } from 'react'
import { grocy } from '../api/grocy'
import type { Product, Recipe } from '../types/grocy'
import {
  createPartRecipe,
  DEFAULT_GRAMS_FOR_ROLE,
  despensaCandidates,
  GRAMS_UNIT_FOR_ROLE,
  isPartRecipeRole,
  type PartRecipeRole,
} from '../utils/createPartRecipe'
import { getMealAccessOrder } from '../utils/mealAccess'
import { CATEGORIES_FOR_ROLE, ROLE_EMOJI, ROLE_LABEL, type PartRole } from '../utils/mealRole'
import { MEAL_ORIGINS, mealMatchesSearch, resolveMealOrigin, type MealOrigin } from '../utils/mealOrigin'
import { parseDescription } from '../utils/parseDescription'
import { ingredientDisplayName, getGenericoFromDesc, getNomeCurtoFromDesc } from '../utils/despensaAnalytics'
import { useDisplayPrefs } from '../hooks/useDisplayPrefs'
import { BottomSheet } from './BottomSheet'
import { MealListRow } from './MealListRow'

type OriginFilter = 'all' | MealOrigin

interface Props {
  open: boolean
  recipes: Recipe[]
  /** Which part of the meal is being filled. Defaults to the main dish. */
  role?: PartRole
  excludeIds?: Set<number>
  /** Prefill Cozinha/Restaurante filter when opening (default Cozinha). */
  initialOrigin?: MealOrigin
  onClose: () => void
  onPick: (recipeId: number) => void
  /** Fires when the Despensa shortcut mints a recipe, before `onPick`. */
  onRecipeCreated?: (recipe: Recipe) => void
}

function matchesQuery(name: string, query: string): boolean {
  return !query || name.toLowerCase().includes(query)
}

export function MealPickSheet({
  open,
  recipes,
  role = 'prato',
  excludeIds,
  initialOrigin = 'supermercado',
  onClose,
  onPick,
  onRecipeCreated,
}: Props) {
  const [query, setQuery] = useState('')
  const [originFilter, setOriginFilter] = useState<OriginFilter>(initialOrigin)
  const [products, setProducts] = useState<Product[]>([])
  const [pendingProduct, setPendingProduct] = useState<Product | null>(null)
  const [grams, setGrams] = useState('')
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState(false)

  const partRole = isPartRecipeRole(role) ? role : null
  const { prefs } = useDisplayPrefs()

  useEffect(() => {
    if (!open) return
    setQuery('')
    setOriginFilter(initialOrigin)
    setPendingProduct(null)
    setCreateError(false)
  }, [open, initialOrigin, role])

  // Only the Despensa shortcut needs the catalogue, so it stays off the main
  // plan load and is fetched the first time a non-prato sheet opens.
  useEffect(() => {
    if (!open || partRole === null || products.length > 0) return
    let mounted = true
    grocy
      .getDespensaStock()
      .then((stock) => {
        if (mounted) setProducts(stock.map((s) => s.product))
      })
      .catch(() => {})
    return () => {
      mounted = false
    }
  }, [open, partRole, products.length])

  const q = query.trim().toLowerCase()

  const pratoOptions = useMemo(() => {
    if (partRole !== null) return []
    return recipes.filter((r) => {
      if (excludeIds?.has(r.id)) return false
      const parsed = parseDescription(r.description ?? '')
      if (parsed.category !== 'Completa') return false
      if (prefs.hideProductsWithoutImage && !r.picture_file_name) return false
      if (originFilter !== 'all' && resolveMealOrigin(parsed.origin) !== originFilter) return false
      return mealMatchesSearch(r.name, parsed.origin, parsed.location, q)
    })
  }, [partRole, recipes, excludeIds, originFilter, q, prefs.hideProductsWithoutImage])

  /** Recipes already used for this role, most recently eaten first. */
  const usedOptions = useMemo(() => {
    if (partRole === null) return []
    const accepted = new Set(CATEGORIES_FOR_ROLE[partRole])
    const rank = new Map(getMealAccessOrder().map((id, index) => [id, index]))
    return recipes
      .filter((r) => {
        if (excludeIds?.has(r.id)) return false
        if (!accepted.has(parseDescription(r.description ?? '').category ?? '')) return false
        return matchesQuery(r.name, q)
      })
      .sort((a, b) => {
        const ra = rank.get(a.id) ?? Number.MAX_SAFE_INTEGER
        const rb = rank.get(b.id) ?? Number.MAX_SAFE_INTEGER
        if (ra !== rb) return ra - rb
        return a.name.localeCompare(b.name, 'pt')
      })
  }, [partRole, recipes, excludeIds, q])

  const productOptions = useMemo(() => {
    if (partRole === null) return []
    return despensaCandidates(products, recipes).filter((p) => {
      if (prefs.hideProductsWithoutImage && !p.picture_file_name) return false
      if (matchesQuery(p.name, q)) return true
      if (matchesQuery(ingredientDisplayName(p.name, p.description), q)) return true
      const curto = getNomeCurtoFromDesc(p.description)
      const gen = getGenericoFromDesc(p.description)
      return (curto != null && matchesQuery(curto, q)) || (gen != null && matchesQuery(gen, q))
    })
  }, [partRole, products, recipes, q, prefs.hideProductsWithoutImage])

  function startCreate(product: Product) {
    if (partRole === null) return
    setPendingProduct(product)
    setGrams(String(DEFAULT_GRAMS_FOR_ROLE[partRole]))
    setCreateError(false)
  }

  async function confirmCreate() {
    if (partRole === null || !pendingProduct || creating) return
    setCreating(true)
    setCreateError(false)
    try {
      const parsed = parseFloat(grams)
      const recipe = await createPartRecipe(
        pendingProduct,
        partRole,
        Number.isFinite(parsed) && parsed > 0 ? parsed : 0
      )
      onRecipeCreated?.(recipe)
      onPick(recipe.id)
      onClose()
    } catch {
      setCreateError(true)
    } finally {
      setCreating(false)
    }
  }

  const title = partRole === null ? 'Escolher refeição' : `Escolher ${ROLE_LABEL[partRole].toLowerCase()}`

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel={title}>
      <div className="max-h-[min(85vh,640px)] flex flex-col min-h-0">
        <div className="px-4 pb-3 border-b border-nourish-border/60 shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-nourish-text">{title}</p>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-nourish-text-dim focus:outline-none"
            >
              Fechar
            </button>
          </div>
          {partRole === null && (
            <div className="flex gap-1.5 overflow-x-auto" role="tablist" aria-label="Origem">
              {([
                ...MEAL_ORIGINS.map((o) => ({ key: o.key as OriginFilter, label: o.label })),
                { key: 'all' as const, label: 'Todas' },
              ]).map(({ key, label }) => (
                <button
                  key={key}
                  type="button"
                  role="tab"
                  aria-selected={originFilter === key}
                  onClick={() => setOriginFilter(key)}
                  className={`flex-shrink-0 px-3 py-1 rounded-full text-xs font-semibold transition-colors focus:outline-none ${
                    originFilter === key
                      ? 'bg-nourish-primary/20 text-nourish-primary border border-nourish-primary/40'
                      : 'bg-nourish-bg text-nourish-text-dim border border-nourish-border'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
          )}
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar…"
            className="w-full px-3 py-2 rounded-lg bg-nourish-bg border border-nourish-border text-sm text-nourish-text placeholder:text-nourish-text-dim focus:outline-none focus:ring-2 focus:ring-nourish-primary"
          />
        </div>

        {partRole !== null && pendingProduct && (
          <div className="px-4 py-3 border-b border-nourish-border/60 shrink-0 bg-nourish-surface-high/50 space-y-2">
            <p className="text-sm font-semibold text-nourish-text truncate">
              {ROLE_EMOJI[partRole]} {ingredientDisplayName(pendingProduct.name, pendingProduct.description)}
            </p>
            <p className="text-xs text-nourish-text-dim">
              Quanto costumas comer? É o que faz as macros serem reais.
            </p>
            <div className="flex items-center gap-2">
              <div className="relative flex-1">
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  value={grams}
                  onChange={(e) => setGrams(e.target.value)}
                  className="w-full pl-3 pr-10 py-2 rounded-lg bg-nourish-bg border border-nourish-border text-sm text-nourish-text focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                  aria-label={`Quantidade em ${GRAMS_UNIT_FOR_ROLE[partRole]}`}
                />
                <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-nourish-text-dim pointer-events-none">
                  {GRAMS_UNIT_FOR_ROLE[partRole]}
                </span>
              </div>
              <button
                type="button"
                onClick={() => setPendingProduct(null)}
                className="px-3 py-2 rounded-lg text-xs font-semibold border border-nourish-border text-nourish-text-dim focus:outline-none focus:ring-2 focus:ring-nourish-primary"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={confirmCreate}
                disabled={creating}
                className="px-3 py-2 rounded-lg text-xs font-semibold bg-nourish-primary text-nourish-on-primary disabled:opacity-70 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
              >
                {creating ? '…' : 'Adicionar'}
              </button>
            </div>
            {createError && (
              <p className="text-xs text-red-400">Não deu para criar. Tenta outra vez.</p>
            )}
          </div>
        )}

        {partRole === null ? (
          <ul className="overflow-y-auto flex-1 min-h-0 p-2">
            {pratoOptions.length === 0 ? (
              <li className="text-sm text-nourish-text-dim text-center py-8">
                Sem refeições Completas
              </li>
            ) : (
              pratoOptions.map((recipe) => (
                <li key={recipe.id}>
                  <MealListRow
                    recipe={recipe}
                    onClick={() => {
                      onPick(recipe.id)
                      onClose()
                    }}
                  />
                </li>
              ))
            )}
          </ul>
        ) : (
          <div className="overflow-y-auto flex-1 min-h-0 p-2 space-y-3">
            {usedOptions.length > 0 && (
              <section>
                <h3 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-nourish-text-dim">
                  Já usadas
                </h3>
                <ul>
                  {usedOptions.map((recipe) => (
                    <li key={recipe.id}>
                      <MealListRow
                        recipe={recipe}
                        onClick={() => {
                          onPick(recipe.id)
                          onClose()
                        }}
                      />
                    </li>
                  ))}
                </ul>
              </section>
            )}

            {productOptions.length > 0 && (
              <section>
                <h3 className="px-2 pb-1 text-[10px] font-semibold uppercase tracking-wider text-nourish-text-dim">
                  Da despensa
                </h3>
                <ul className="space-y-1">
                  {productOptions.map((product) => {
                    const label = ingredientDisplayName(product.name, product.description)
                    return (
                    <li key={product.id}>
                      <button
                        type="button"
                        onClick={() => startCreate(product)}
                        className={`w-full flex items-center gap-3 px-2 py-2.5 rounded-lg text-left focus:outline-none focus:ring-2 focus:ring-nourish-primary ${
                          pendingProduct?.id === product.id
                            ? 'bg-nourish-primary/10'
                            : 'active:bg-nourish-surface-high'
                        }`}
                      >
                        {product.picture_file_name ? (
                          <img
                            src={grocy.productPictureUrl(product.picture_file_name)}
                            alt=""
                            className="w-11 h-11 rounded-lg object-cover flex-shrink-0"
                          />
                        ) : (
                          <div className="w-11 h-11 rounded-lg bg-nourish-surface-high flex items-center justify-center text-lg flex-shrink-0">
                            {ROLE_EMOJI[partRole]}
                          </div>
                        )}
                        <span className="min-w-0 flex-1">
                          <span className="block text-sm text-nourish-text truncate">
                            {label}
                          </span>
                          {label !== product.name && (
                            <span className="block text-xs text-nourish-text-dim truncate">
                              {product.name}
                            </span>
                          )}
                          <span className="block text-xs text-nourish-text-dim">
                            Criar {ROLE_LABEL[partRole].toLowerCase()}
                          </span>
                        </span>
                      </button>
                    </li>
                    )
                  })}
                </ul>
              </section>
            )}

            {usedOptions.length === 0 && productOptions.length === 0 && (
              <p className="text-sm text-nourish-text-dim text-center py-8">
                Nada na despensa para {ROLE_LABEL[partRole].toLowerCase()}
              </p>
            )}
          </div>
        )}
      </div>
    </BottomSheet>
  )
}
