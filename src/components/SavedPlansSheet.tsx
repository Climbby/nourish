import { useState } from 'react'
import type { Recipe } from '../types/grocy'
import type { PlannedSlot } from '../hooks/usePlannedMeals'
import {
  applicableSlots,
  planFromSlots,
  savableSlots as upcomingSavableSlots,
  summarizePlan,
  type SavedWeekPlan,
  type TemplateSlot,
} from '../utils/savedWeekPlans'
import { BottomSheet } from './BottomSheet'

const SUGGESTED_TAGS = ['barato', 'rápido', 'proteína', 'peixe', 'favorita']

const inputClass =
  'w-full px-3 py-2.5 bg-nourish-surface-high border border-nourish-border rounded-lg text-nourish-text placeholder-nourish-border text-sm focus:outline-none focus:ring-2 focus:ring-nourish-primary'

interface Props {
  open: boolean
  plans: SavedWeekPlan[]
  recipes: Recipe[]
  /** Current week's slots — what "save this week" captures. */
  currentSlots: PlannedSlot[]
  onClose: () => void
  onSave: (plan: SavedWeekPlan) => void
  /** Template slots — relative offsets, mapped onto real dates by the caller. */
  onApply: (slots: TemplateSlot[]) => void
  onRemove: (id: string) => void
}

export function SavedPlansSheet({
  open,
  plans,
  recipes,
  currentSlots,
  onClose,
  onSave,
  onApply,
  onRemove,
}: Props) {
  const [saving, setSaving] = useState(false)
  const [name, setName] = useState('')
  const [description, setDescription] = useState('')
  const [tags, setTags] = useState<string[]>([])
  const [confirmRemove, setConfirmRemove] = useState<string | null>(null)

  // Only today onward is a mould; past days are a record of what was eaten.
  const savableSlots = upcomingSavableSlots(currentSlots)
  const savableMeals = savableSlots.filter((s) => s.parts.some((p) => p.role === 'prato')).length

  function resetForm() {
    setName('')
    setDescription('')
    setTags([])
    setSaving(false)
  }

  function handleSave() {
    if (!name.trim() || savableSlots.length === 0) return
    onSave(planFromSlots(name, description, tags, currentSlots))
    resetForm()
  }

  return (
    <BottomSheet open={open} onClose={onClose} ariaLabel="Planos semanais">
      <div className="px-4 pb-6 space-y-4">
        <div className="flex items-center justify-between gap-2">
          <h2 className="font-semibold text-nourish-text text-lg">Planos semanais</h2>
          <button
            type="button"
            onClick={onClose}
            className="text-sm text-nourish-text-dim px-2 py-1 focus:outline-none focus:ring-2 focus:ring-nourish-primary rounded-lg"
          >
            Fechar
          </button>
        </div>

        {!saving ? (
          <button
            type="button"
            disabled={savableSlots.length === 0}
            onClick={() => setSaving(true)}
            className="w-full py-3 rounded-xl text-sm font-semibold bg-nourish-primary text-nourish-on-primary disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
          >
            {savableSlots.length === 0
              ? 'Planeia refeições para poder guardar'
              : `Guardar esta semana (${savableMeals} refeições)`}
          </button>
        ) : (
          <div className="space-y-3 rounded-xl border border-nourish-border p-3">
            <label className="block text-xs text-nourish-text-dim">
              Nome
              <input
                autoFocus
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="Ex: Semana Barata"
                className={`${inputClass} mt-1`}
              />
            </label>
            <label className="block text-xs text-nourish-text-dim">
              Descrição <span className="text-nourish-border">(opcional)</span>
              <textarea
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                rows={2}
                placeholder="Para que serve esta semana"
                className={`${inputClass} mt-1 resize-none`}
              />
            </label>
            <div>
              <span className="text-xs text-nourish-text-dim">Etiquetas</span>
              <div className="flex flex-wrap gap-2 mt-1.5">
                {SUGGESTED_TAGS.map((tag) => {
                  const active = tags.includes(tag)
                  return (
                    <button
                      key={tag}
                      type="button"
                      aria-pressed={active}
                      onClick={() =>
                        setTags((prev) =>
                          active ? prev.filter((t) => t !== tag) : [...prev, tag]
                        )
                      }
                      className={`px-3 py-1.5 rounded-lg text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-nourish-primary ${
                        active
                          ? 'bg-nourish-primary text-nourish-on-primary border-nourish-primary'
                          : 'bg-nourish-surface-high text-nourish-text-dim border-nourish-border'
                      }`}
                    >
                      {tag}
                    </button>
                  )
                })}
              </div>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                onClick={resetForm}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-nourish-surface-high text-nourish-text focus:outline-none focus:ring-2 focus:ring-nourish-primary"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!name.trim()}
                onClick={handleSave}
                className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-nourish-primary text-nourish-on-primary disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
              >
                Guardar
              </button>
            </div>
          </div>
        )}

        {plans.length === 0 ? (
          <p className="text-xs text-nourish-text-dim leading-relaxed">
            Ainda não há planos guardados. Ao fim de umas semanas ficas com uma biblioteca de
            semanas que já sabes que funcionam — escolhes uma e os 14 slots ficam resolvidos.
          </p>
        ) : (
          <ul className="space-y-3">
            {plans.map((plan) => {
              const summary = summarizePlan(plan, recipes)
              const usable = applicableSlots(plan, recipes)
              // Spend covers every part now, so the per-meal figure is the whole
              // meal divided by meals — not by the parts that carried a price.
              const perMeal =
                summary.meals > 0 && summary.partsWithPrice > 0
                  ? summary.spend / summary.meals
                  : null

              return (
                <li
                  key={plan.id}
                  className="rounded-xl border border-nourish-border bg-nourish-surface p-3 space-y-2"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <h3 className="font-semibold text-nourish-text text-sm truncate">
                        {plan.name}
                      </h3>
                      {plan.description && (
                        <p className="text-xs text-nourish-text-dim leading-snug mt-0.5">
                          {plan.description}
                        </p>
                      )}
                    </div>
                    {plan.tags.length > 0 && (
                      <div className="flex flex-wrap gap-1 justify-end flex-shrink-0">
                        {plan.tags.map((tag) => (
                          <span
                            key={tag}
                            className="text-[10px] px-2 py-0.5 rounded bg-nourish-surface-high text-nourish-text-dim font-medium"
                          >
                            {tag}
                          </span>
                        ))}
                      </div>
                    )}
                  </div>

                  <p className="text-xs text-nourish-text-dim tabular-nums">
                    {summary.meals} refeições · {summary.distinctPratos} pratos
                    {summary.spend > 0 && <> · €{summary.spend.toFixed(2)}</>}
                    {perMeal !== null && <> (€{perMeal.toFixed(2)}/refeição)</>}
                  </p>

                  {summary.missingRecipeIds.length > 0 && (
                    <p className="text-[11px] text-amber-400 leading-snug">
                      {summary.missingRecipeIds.length} receita(s) já não existem e vão ser
                      ignoradas ao aplicar.
                    </p>
                  )}

                  <div className="flex gap-2">
                    <button
                      type="button"
                      disabled={usable.length === 0}
                      onClick={() => {
                        onApply(usable)
                        onClose()
                      }}
                      className="flex-1 py-2 rounded-lg text-xs font-semibold bg-nourish-primary text-nourish-on-primary disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                    >
                      Aplicar
                    </button>
                    {confirmRemove === plan.id ? (
                      <>
                        <button
                          type="button"
                          onClick={() => setConfirmRemove(null)}
                          className="flex-1 py-2 rounded-lg text-xs font-semibold bg-nourish-surface-high text-nourish-text focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                        >
                          Cancelar
                        </button>
                        <button
                          type="button"
                          onClick={() => {
                            onRemove(plan.id)
                            setConfirmRemove(null)
                          }}
                          className="flex-1 py-2 rounded-lg text-xs font-semibold bg-red-500/20 text-red-400 border border-red-500/40 focus:outline-none focus:ring-2 focus:ring-red-400"
                        >
                          Apagar
                        </button>
                      </>
                    ) : (
                      <button
                        type="button"
                        onClick={() => setConfirmRemove(plan.id)}
                        className="px-3 py-2 rounded-lg text-xs font-semibold border border-nourish-border text-nourish-text-dim focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                      >
                        Apagar
                      </button>
                    )}
                  </div>
                </li>
              )
            })}
          </ul>
        )}
      </div>
    </BottomSheet>
  )
}
