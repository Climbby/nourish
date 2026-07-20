import { useEffect, useMemo, useState } from 'react'
import { grocy } from '../api/grocy'
import type { Recipe } from '../types/grocy'
import { MEAL_ORIGINS, resolveMealOrigin, type MealOrigin } from '../utils/mealOrigin'
import { parseDescription } from '../utils/parseDescription'

type OriginFilter = 'all' | MealOrigin

interface Props {
  open: boolean
  recipes: Recipe[]
  excludeIds?: Set<number>
  /** Prefill Casa/Fora filter when opening (default Casa). */
  initialOrigin?: MealOrigin
  onClose: () => void
  onPick: (recipeId: number) => void
}

export function MealPickSheet({
  open,
  recipes,
  excludeIds,
  initialOrigin = 'supermercado',
  onClose,
  onPick,
}: Props) {
  const [query, setQuery] = useState('')
  const [originFilter, setOriginFilter] = useState<OriginFilter>(initialOrigin)

  useEffect(() => {
    if (!open) return
    setQuery('')
    setOriginFilter(initialOrigin)
  }, [open, initialOrigin])

  const completa = useMemo(
    () =>
      recipes.filter((r) => {
        if (excludeIds?.has(r.id)) return false
        return parseDescription(r.description ?? '').category === 'Completa'
      }),
    [recipes, excludeIds]
  )

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase()
    return completa.filter((r) => {
      const parsed = parseDescription(r.description ?? '')
      if (originFilter !== 'all' && resolveMealOrigin(parsed.origin) !== originFilter) return false
      if (q && !r.name.toLowerCase().includes(q)) return false
      return true
    })
  }, [completa, query, originFilter])

  if (!open) return null

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <button
        type="button"
        className="absolute inset-0 bg-black/60"
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        role="dialog"
        aria-modal="true"
        aria-label="Escolher refeição"
        className="relative w-full max-w-sm bg-nourish-surface rounded-t-2xl max-h-[min(85vh,640px)] flex flex-col border-t border-nourish-border"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
      >
        <div className="p-4 border-b border-nourish-border/60 shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <p className="text-sm font-semibold text-nourish-text">Escolher refeição</p>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-nourish-text-dim focus:outline-none"
            >
              Fechar
            </button>
          </div>
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
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar…"
            className="w-full px-3 py-2 rounded-lg bg-nourish-bg border border-nourish-border text-sm text-nourish-text placeholder:text-nourish-text-dim focus:outline-none focus:ring-2 focus:ring-nourish-primary"
          />
        </div>

        <ul className="overflow-y-auto flex-1 min-h-0 p-2">
          {filtered.length === 0 ? (
            <li className="text-sm text-nourish-text-dim text-center py-8">Sem refeições Completas</li>
          ) : (
            filtered.map((recipe) => {
              const { price, nutrition } = parseDescription(recipe.description ?? '')
              return (
                <li key={recipe.id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick(recipe.id)
                      onClose()
                    }}
                    className="w-full flex items-center gap-3 p-2 rounded-lg text-left active:bg-nourish-surface-high focus:outline-none focus:ring-2 focus:ring-inset focus:ring-nourish-primary"
                  >
                    {recipe.picture_file_name ? (
                      <img
                        src={grocy.pictureUrl(recipe.picture_file_name)}
                        alt=""
                        className="w-12 h-12 rounded-lg object-cover flex-shrink-0"
                      />
                    ) : (
                      <div className="w-12 h-12 rounded-lg bg-nourish-surface-high flex items-center justify-center text-xl flex-shrink-0">
                        🍽️
                      </div>
                    )}
                    <div className="min-w-0 flex-1">
                      <p className="text-sm font-semibold text-nourish-text truncate">{recipe.name}</p>
                      <p className="text-xs text-nourish-text-dim tabular-nums mt-0.5">
                        {price != null && <span className="text-nourish-primary font-semibold">€{price.toFixed(2)}</span>}
                        {price != null && nutrition && ' · '}
                        {nutrition && `${nutrition.calories} kcal`}
                      </p>
                    </div>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </div>
  )
}
