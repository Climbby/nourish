import type { SlotPart } from '../hooks/usePlannedMeals'
import type { Recipe } from '../types/grocy'
import { isPartRecipeRole, type PartRecipeRole } from '../utils/createPartRecipe'
import { habitualForRole, type PartHabits } from '../utils/partHabits'
import { ROLE_EMOJI, ROLE_LABEL, ROLE_ORDER } from '../utils/mealRole'

/** Everything but the prato — that one is the card itself. */
const SIDE_ROLES: PartRecipeRole[] = ROLE_ORDER.filter(isPartRecipeRole)

interface Props {
  parts: SlotPart[]
  recipeById: Map<number, Recipe>
  habits: PartHabits
  /** Recipe ids that still exist, so a deleted habit never gets offered. */
  existingIds: Set<number>
  /** Past days render quieter — still editable, just not the main event. */
  dim?: boolean
  /** Recipe ids with a Grocy entry — these carry the ✓. */
  logged?: Set<number>
  /** A past-day edit is in flight; the chips lock until Grocy answers. */
  busy?: boolean
  onFill: (role: PartRecipeRole, recipeId: number) => void
  onOpen: (role: PartRecipeRole) => void
  onRemove: (role: PartRecipeRole) => void
}

/**
 * The rest of the meal, as one compact row under the prato.
 *
 * Four full cards per meal would be a wall, so sopa, sobremesa and bebida live
 * as chips: one tap to accept the habitual, one to swap, a small ✕ to drop.
 */
export function SlotPartChips({
  parts,
  recipeById,
  habits,
  existingIds,
  dim = false,
  logged,
  busy = false,
  onFill,
  onOpen,
  onRemove,
}: Props) {
  const base = `inline-flex items-center gap-1 rounded-full text-[11px] font-medium transition-colors focus:outline-none focus:ring-2 focus:ring-nourish-primary ${
    dim ? 'opacity-80' : ''
  }`

  return (
    <div className="flex flex-wrap gap-1.5 px-3 pb-3 pt-2 border-t border-nourish-border/60">
      {SIDE_ROLES.map((role) => {
        const part = parts.find((p) => p.role === role)
        const recipe = part ? recipeById.get(part.recipeId) : undefined

        if (part && recipe) {
          return (
            <span
              key={role}
              className={`${base} border border-nourish-border bg-nourish-surface-high pl-2.5 pr-1 py-1 max-w-full`}
            >
              <button
                type="button"
                onClick={() => onOpen(role)}
                disabled={busy}
                className="flex items-center gap-1 min-w-0 disabled:opacity-50 focus:outline-none"
                aria-label={`Trocar ${ROLE_LABEL[role].toLowerCase()}: ${recipe.name}`}
              >
                <span aria-hidden>{ROLE_EMOJI[role]}</span>
                <span className="truncate text-nourish-text">{recipe.name}</span>
                {logged?.has(recipe.id) && (
                  <span className="text-nourish-primary" title="Registado">
                    ✓
                  </span>
                )}
              </button>
              <button
                type="button"
                onClick={() => onRemove(role)}
                disabled={busy}
                className="px-1.5 py-0.5 -my-0.5 rounded-full text-nourish-text-dim hover:text-red-400 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                aria-label={`Remover ${ROLE_LABEL[role].toLowerCase()}`}
              >
                ✕
              </button>
            </span>
          )
        }

        const habitual = habitualForRole(habits, role, existingIds)
        const habitualRecipe = habitual != null ? recipeById.get(habitual) : undefined

        if (habitualRecipe) {
          return (
            <span
              key={role}
              className={`${base} border border-dashed border-nourish-border pl-2.5 pr-1 py-1 max-w-full`}
            >
              <button
                type="button"
                onClick={() => onFill(role, habitualRecipe.id)}
                disabled={busy}
                className="flex items-center gap-1 min-w-0 text-nourish-text-dim disabled:opacity-50 focus:outline-none"
                aria-label={`Adicionar ${ROLE_LABEL[role].toLowerCase()}: ${habitualRecipe.name}`}
              >
                <span aria-hidden>+</span>
                <span aria-hidden>{ROLE_EMOJI[role]}</span>
                <span className="truncate">{habitualRecipe.name}</span>
              </button>
              <button
                type="button"
                onClick={() => onOpen(role)}
                className="px-1.5 py-0.5 -my-0.5 rounded-full text-nourish-text-dim focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                aria-label={`Escolher outra ${ROLE_LABEL[role].toLowerCase()}`}
              >
                …
              </button>
            </span>
          )
        }

        return (
          <button
            key={role}
            type="button"
            onClick={() => onOpen(role)}
            disabled={busy}
            className={`${base} border border-dashed border-nourish-border px-2.5 py-1 text-nourish-text-dim disabled:opacity-50`}
            aria-label={`Adicionar ${ROLE_LABEL[role].toLowerCase()}`}
          >
            <span aria-hidden>+</span>
            <span aria-hidden>{ROLE_EMOJI[role]}</span>
            <span>{ROLE_LABEL[role]}</span>
          </button>
        )
      })}
    </div>
  )
}
