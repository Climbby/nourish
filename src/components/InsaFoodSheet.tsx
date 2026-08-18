import { useEffect, useState } from 'react'
import {
  applyInsaFood,
  searchInsaFoods,
  type InsaFoodOption,
  type InsaMatch,
} from '../utils/insaNutrition'
import { BottomSheet } from './BottomSheet'

interface Props {
  open: boolean
  /** Exact alias hit from NomeCurto / Generico / name — confirm or change. */
  suggested: InsaMatch | null
  onClose: () => void
  onPick: (match: InsaMatch) => void
}

function pickOption(food: InsaFoodOption): InsaMatch | null {
  return applyInsaFood(food.name)
}

export function InsaFoodSheet({ open, suggested, onClose, onPick }: Props) {
  const [query, setQuery] = useState('')

  useEffect(() => {
    if (open) setQuery('')
  }, [open])

  const foods = searchInsaFoods(query)
  const searching = query.trim().length > 0

  function choose(food: InsaFoodOption) {
    const match = pickOption(food)
    if (match) onPick(match)
  }

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Alimento INSA">
      <div className="max-h-[min(85vh,640px)] flex flex-col min-h-0">
        <div className="px-4 pb-3 border-b border-nourish-border/60 shrink-0 space-y-3">
          <div className="flex items-center justify-between gap-2">
            <div className="min-w-0">
              <p className="text-sm font-semibold text-nourish-text">Tabela INSA</p>
              <p className="text-[11px] text-nourish-text-dim mt-0.5">
                Tabela nacional · por 100 g
              </p>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="text-sm text-nourish-text-dim px-2 py-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-nourish-primary"
            >
              Fechar
            </button>
          </div>
          <input
            type="search"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Procurar alimento…"
            className="w-full px-3 py-2 rounded-lg bg-nourish-bg border border-nourish-border text-sm text-nourish-text placeholder:text-nourish-text-dim focus:outline-none focus:ring-2 focus:ring-nourish-primary"
          />
        </div>

        {!searching && suggested && (
          <div className="px-4 py-3 border-b border-nourish-border/60 shrink-0 bg-nourish-surface-high/50">
            <p className="text-[11px] text-nourish-text-dim uppercase tracking-wide font-semibold">
              Sugestão pelo nome
            </p>
            <div className="mt-1.5 flex items-center gap-2">
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-nourish-text truncate">
                  {suggested.foodName}
                </p>
                <p className="text-xs text-nourish-text-dim tabular-nums">
                  {suggested.macros.calories} kcal · {suggested.macros.protein} g prot
                </p>
              </div>
              <button
                type="button"
                onClick={() => onPick(suggested)}
                className="shrink-0 px-3 py-2.5 rounded-lg text-xs font-semibold bg-nourish-primary text-nourish-on-primary focus:outline-none focus:ring-2 focus:ring-nourish-primary"
              >
                Usar
              </button>
            </div>
          </div>
        )}

        {!searching && !suggested && (
          <p className="px-4 py-2.5 text-xs text-nourish-text-dim leading-snug border-b border-nourish-border/60 shrink-0">
            O nome não corresponde a um alimento. Escolhe na lista.
          </p>
        )}

        <ul className="overflow-y-auto flex-1 min-h-0 p-2">
          {foods.length === 0 ? (
            <li className="text-sm text-nourish-text-dim text-center py-8">
              {searching ? `Nenhum alimento com «${query.trim()}».` : 'Nenhum alimento na tabela.'}
            </li>
          ) : (
            foods.map((food) => {
              const isSuggested = suggested?.foodName === food.name
              return (
                <li key={food.name}>
                  <button
                    type="button"
                    onClick={() => choose(food)}
                    className={`w-full flex items-center justify-between gap-2 px-3 py-3 rounded-xl text-left focus:outline-none focus:ring-2 focus:ring-nourish-primary ${
                      isSuggested && !searching
                        ? 'bg-nourish-primary/10 text-nourish-text'
                        : 'text-nourish-text active:bg-nourish-surface-high'
                    }`}
                  >
                    <span className="text-sm font-medium truncate min-w-0">{food.name}</span>
                    <span className="text-xs text-nourish-text-dim tabular-nums shrink-0">
                      {food.calories} kcal
                    </span>
                  </button>
                </li>
              )
            })
          )}
        </ul>
      </div>
    </BottomSheet>
  )
}
