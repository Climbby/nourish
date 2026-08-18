import { useEffect, useMemo, useState } from 'react'
import type { NutritionTargets } from '../hooks/useNutritionTargets'
import type { Recipe } from '../types/grocy'
import {
  todayIsoDate,
  type MealSlot,
  type PlannedSlot,
} from '../hooks/usePlannedMeals'
import {
  BUILDER_WEEKDAY_LABELS,
  BUILDER_WEEKDAYS,
  builderObjectivesWarning,
  clearMealRun,
  countFilledDays,
  countFilledSlots,
  getPick,
  isSpanHead,
  mealSpanAt,
  mergeSuggestionsIntoPicks,
  picksToPlannedSlots,
  repeatPreviousDay,
  saveBuilderPlan,
  setMealSpan,
  weekSunday,
  type BuilderPicks,
  type BuilderWeekday,
} from '../utils/planBuilder'
import { parseDescription } from '../utils/parseDescription'
import type { SavedWeekPlan, TemplateSlot, WeekPlanAnchor } from '../utils/savedWeekPlans'
import { SLOT_LABEL, sumRecipesNutrition } from '../utils/weekPlanSlots'
import { planNutritionGaps } from '../utils/weeklyNutritionPlan'
import { BottomSheet } from './BottomSheet'
import { MealPickSheet } from './MealPickSheet'

const inputClass =
  'w-full px-3 py-2.5 bg-nourish-surface-high border border-nourish-border rounded-lg text-nourish-text placeholder-nourish-border text-sm focus:outline-none focus:ring-2 focus:ring-nourish-primary'

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

interface Props {
  open: boolean
  recipes: Recipe[]
  onClose: () => void
  onSave: (plan: SavedWeekPlan) => void
  onApply: (slots: TemplateSlot[], weekAnchor?: WeekPlanAnchor) => void
  /** Same Completa scorer as the live plan; only empty slots are filled. */
  suggestEmpty: (decided: PlannedSlot[], honorTargets?: boolean) => Map<string, number>
  /** Profile objectivos on, and not ignored from this sheet. */
  honorTargets: boolean
  targets: NutritionTargets
  onIgnoreTargets: () => void
}

export function PlanBuilderSheet({
  open,
  recipes,
  onClose,
  onSave,
  onApply,
  suggestEmpty,
  honorTargets,
  targets,
  onIgnoreTargets,
}: Props) {
  const sunday = weekSunday(todayIsoDate())
  const recipeById = useMemo(() => new Map(recipes.map((r) => [r.id, r])), [recipes])

  const [picks, setPicks] = useState<BuilderPicks>({})
  const [pickTarget, setPickTarget] = useState<{ weekday: BuilderWeekday; slot: MealSlot } | null>(
    null
  )
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')

  useEffect(() => {
    if (!open) return
    setPicks({})
    setPickTarget(null)
    setSaving(false)
    setName('')
    setDescription('')
  }, [open])

  const filled = countFilledSlots(picks)
  const warning = useMemo(() => {
    if (!honorTargets) return null
    const days = countFilledDays(picks)
    if (days === 0) return null
    const recipesInPlan: Recipe[] = []
    for (const weekday of BUILDER_WEEKDAYS) {
      for (const slot of (['almoco', 'jantar'] as MealSlot[])) {
        const id = getPick(picks, weekday, slot)
        if (id == null) continue
        const recipe = recipeById.get(id)
        if (recipe) recipesInPlan.push(recipe)
      }
    }
    return builderObjectivesWarning(planNutritionGaps(sumRecipesNutrition(recipesInPlan), targets, days))
  }, [honorTargets, picks, recipeById, targets])

  function handleSuggest() {
    const map = suggestEmpty(picksToPlannedSlots(picks, sunday), honorTargets)
    setPicks((prev) => mergeSuggestionsIntoPicks(prev, map, sunday))
  }

  function handleIgnoreTargets() {
    onIgnoreTargets()
    const map = suggestEmpty(picksToPlannedSlots(picks, sunday), false)
    setPicks((prev) => mergeSuggestionsIntoPicks(prev, map, sunday))
  }

  function handlePick(recipeId: number) {
    if (!pickTarget) return
    const { weekday, slot } = pickTarget
    setPicks((prev) => setMealSpan(prev, weekday, slot, recipeId, 1))
    setPickTarget(null)
  }

  function adjustSpan(weekday: BuilderWeekday, slot: MealSlot, delta: number) {
    const recipeId = getPick(picks, weekday, slot)
    if (recipeId == null) return
    const current = mealSpanAt(picks, weekday, slot)
    setPicks((prev) => setMealSpan(prev, weekday, slot, recipeId, current + delta))
  }

  function finishSave(applyAfter: boolean) {
    if (!name.trim() || filled === 0) return
    const plan = saveBuilderPlan(name, description, [], picks)
    onSave(plan)
    if (applyAfter) onApply(plan.slots, 'sunday')
    onClose()
  }

  function applyNow() {
    if (filled === 0) return
    const plan = saveBuilderPlan('Rascunho', '', [], picks)
    onApply(plan.slots, 'sunday')
    onClose()
  }

  return (
    <>
      <BottomSheet open={open} onClose={onClose} ariaLabel="Construtor de plano">
        <div className="max-h-[min(88vh,720px)] flex flex-col min-h-0">
          <div className="px-4 pb-3 border-b border-nourish-border/60 shrink-0">
            <div className="flex items-center justify-between gap-2">
              <h2 className="font-semibold text-nourish-text text-lg">Construtor de plano</h2>
              <button
                type="button"
                onClick={onClose}
                className="p-1.5 -mr-1 text-nourish-text-dim focus:outline-none focus:ring-2 focus:ring-nourish-primary rounded-lg"
                aria-label="Fechar"
              >
                <CloseIcon />
              </button>
            </div>
          </div>

          <div className="overflow-y-auto flex-1 min-h-0 px-4 py-3 space-y-3">
            {BUILDER_WEEKDAYS.map((weekday) => {
              const label = BUILDER_WEEKDAY_LABELS[weekday]
              return (
                <section
                  key={weekday}
                  className="rounded-xl border border-nourish-border bg-nourish-surface p-3 space-y-2"
                >
                  <h3 className="text-sm font-semibold text-nourish-text">{label}</h3>

                  {(['almoco', 'jantar'] as MealSlot[]).map((slot) => {
                    const recipeId = getPick(picks, weekday, slot)
                    const recipe = recipeId != null ? recipeById.get(recipeId) : undefined
                    const head = recipeId != null && isSpanHead(picks, weekday, slot)
                    const span = head ? mealSpanAt(picks, weekday, slot) : 0
                    const prevId = weekday > 0 ? getPick(picks, weekday - 1, slot) : null
                    const portions =
                      recipe != null
                        ? parseDescription(recipe.description ?? '').portions
                        : null

                    return (
                      <div key={slot} className="space-y-1.5">
                        <div className="flex items-center gap-2">
                          <span className="w-14 shrink-0 text-[11px] font-medium text-nourish-text-dim">
                            {SLOT_LABEL[slot]}
                          </span>
                          <button
                            type="button"
                            onClick={() => setPickTarget({ weekday, slot })}
                            className="flex-1 min-w-0 text-left px-3 py-2 rounded-lg bg-nourish-surface-high border border-nourish-border text-sm text-nourish-text focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                          >
                            {recipe ? (
                              <span className="truncate block">{recipe.name}</span>
                            ) : (
                              <span className="text-nourish-text-dim">Escolher…</span>
                            )}
                          </button>
                        </div>

                        {recipeId != null && head && (
                          <div className="flex items-center gap-2 pl-14">
                            <span className="text-[11px] text-nourish-text-dim">Dias</span>
                            <button
                              type="button"
                              aria-label="Menos dias"
                              disabled={span <= 1}
                              onClick={() => adjustSpan(weekday, slot, -1)}
                              className="w-8 h-8 rounded-lg border border-nourish-border text-nourish-text text-sm font-semibold disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                            >
                              −
                            </button>
                            <span className="tabular-nums text-sm font-semibold text-nourish-text w-5 text-center">
                              {span}
                            </span>
                            <button
                              type="button"
                              aria-label="Mais dias"
                              disabled={weekday + span >= BUILDER_WEEKDAYS.length}
                              onClick={() => adjustSpan(weekday, slot, 1)}
                              className="w-8 h-8 rounded-lg border border-nourish-border text-nourish-text text-sm font-semibold disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                            >
                              +
                            </button>
                            {span > 1 && (
                              <span className="text-[10px] text-nourish-text-dim leading-snug">
                                mesmo prato
                                {portions != null && portions > 0
                                  ? ` · ${portions} porções na receita`
                                  : ''}
                              </span>
                            )}
                            <button
                              type="button"
                              onClick={() =>
                                setPicks((prev) => clearMealRun(prev, weekday, slot))
                              }
                              className="ml-auto text-[11px] text-nourish-text-dim px-2 py-1 focus:outline-none"
                            >
                              Limpar
                            </button>
                          </div>
                        )}

                        {recipeId != null && !head && (
                          <p className="pl-14 text-[10px] text-nourish-text-dim">
                            Continua do dia anterior
                          </p>
                        )}

                        {recipeId == null && prevId != null && (
                          <div className="pl-14">
                            <button
                              type="button"
                              onClick={() =>
                                setPicks((prev) => repeatPreviousDay(prev, weekday, slot))
                              }
                              className="text-[11px] font-semibold text-nourish-primary focus:outline-none focus:ring-2 focus:ring-nourish-primary rounded"
                            >
                              Repetir dia anterior
                            </button>
                          </div>
                        )}
                      </div>
                    )
                  })}
                </section>
              )
            })}
          </div>

          <div className="px-4 pt-3 pb-2 border-t border-nourish-border/60 shrink-0 space-y-2">
            {warning && (
              <button
                type="button"
                onClick={handleIgnoreTargets}
                className="w-full text-left text-xs text-amber-400 leading-snug px-1 py-1 rounded-lg focus:outline-none focus:ring-2 focus:ring-nourish-primary"
              >
                {warning}
              </button>
            )}
            {!saving ? (
              <>
                <button
                  type="button"
                  onClick={handleSuggest}
                  className="w-full py-2.5 rounded-xl text-sm font-semibold border border-nourish-border text-nourish-text focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                >
                  Sugerir dias vazios
                </button>
                <div className="flex gap-2">
                  <button
                    type="button"
                    disabled={filled === 0}
                    onClick={applyNow}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-nourish-surface-high text-nourish-text disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                  >
                    Aplicar
                  </button>
                  <button
                    type="button"
                    disabled={filled === 0}
                    onClick={() => setSaving(true)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-nourish-primary text-nourish-on-primary disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                  >
                    Guardar ({filled})
                  </button>
                </div>
              </>
            ) : (
              <div className="space-y-2">
                <label className="block text-xs text-nourish-text-dim">
                  Nome do plano
                  <input
                    autoFocus
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Ex: Semana caseira"
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <label className="block text-xs text-nourish-text-dim">
                  Nota <span className="text-nourish-border">(opcional)</span>
                  <input
                    value={description}
                    onChange={(e) => setDescription(e.target.value)}
                    placeholder="Para que serve"
                    className={`${inputClass} mt-1`}
                  />
                </label>
                <div className="flex gap-2">
                  <button
                    type="button"
                    onClick={() => setSaving(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-nourish-surface-high text-nourish-text focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                  >
                    Voltar
                  </button>
                  <button
                    type="button"
                    disabled={!name.trim()}
                    onClick={() => finishSave(false)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-nourish-border text-nourish-text disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                  >
                    Só guardar
                  </button>
                  <button
                    type="button"
                    disabled={!name.trim()}
                    onClick={() => finishSave(true)}
                    className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-nourish-primary text-nourish-on-primary disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                  >
                    Guardar e aplicar
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </BottomSheet>

      <MealPickSheet
        open={pickTarget != null}
        recipes={recipes}
        role="prato"
        onClose={() => setPickTarget(null)}
        onPick={handlePick}
      />
    </>
  )
}
