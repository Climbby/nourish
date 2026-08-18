import { useRef, useState } from 'react'
import {
  MACRO_SOURCES,
  MACRO_SOURCE_LABELS,
  type MacroSource,
  type ProductMacros,
} from '../utils/productNutrition'
import {
  extractNutritionLabel,
  isEmptyLabel,
  type NutritionLabelResult,
} from '../features/nutrition/extractNutritionLabel'
import { applyInsaSource, insaMissingMessage } from '../utils/insaNutrition'
import { InsaFoodSheet } from './InsaFoodSheet'

const inputClass =
  'w-full px-3 py-2.5 bg-nourish-surface-high border border-nourish-border rounded-lg text-nourish-text placeholder-nourish-border text-sm focus:outline-none focus:ring-2 focus:ring-nourish-primary'

type Draft = Record<'calories' | 'protein' | 'carbs' | 'fat' | 'fibre', string>

const EMPTY_DRAFT: Draft = { calories: '', protein: '', carbs: '', fat: '', fibre: '' }

const FIELDS: { key: keyof Draft; label: string; unit: string }[] = [
  { key: 'calories', label: 'Calorias', unit: 'kcal' },
  { key: 'protein', label: 'Proteína', unit: 'g' },
  { key: 'carbs', label: 'Hidratos', unit: 'g' },
  { key: 'fat', label: 'Gordura', unit: 'g' },
  { key: 'fibre', label: 'Fibra', unit: 'g' },
]

function draftFrom(macros: ProductMacros | null): Draft {
  if (!macros) return { ...EMPTY_DRAFT }
  return {
    calories: String(macros.calories),
    protein: String(macros.protein),
    carbs: String(macros.carbs),
    fat: String(macros.fat),
    fibre: String(macros.fibre),
  }
}

function toNumber(v: string): number {
  const n = parseFloat(v.replace(',', '.'))
  return isNaN(n) || n < 0 ? 0 : n
}

function CameraIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
      <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 0 1-3 3h-15a3 3 0 0 1-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 0 0 1.11-.71l.822-1.315a2.942 2.942 0 0 1 2.332-1.39ZM6.75 12.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Zm12-1.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
    </svg>
  )
}

function GalleryIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z" clipRule="evenodd" />
    </svg>
  )
}

export function ProductMacrosSection({
  macros,
  lookupNames = [],
  onSave,
  onNetGrams,
  saving = false,
}: {
  macros: ProductMacros | null
  /** Product name / NomeCurto / Generico, cooking names first. */
  lookupNames?: string[]
  onSave: (next: ProductMacros | null) => void | Promise<void>
  /** Pack net weight read from the nutrition photo (peso líquido). */
  onNetGrams?: (grams: number) => void
  saving?: boolean
}) {
  const [editing, setEditing] = useState(false)
  const [draft, setDraft] = useState<Draft>(() => draftFrom(macros))
  const [source, setSource] = useState<MacroSource>(macros?.source ?? 'manual')
  const [reading, setReading] = useState(false)
  const [readError, setReadError] = useState<string | null>(null)
  const [warning, setWarning] = useState<string | null>(null)
  const [insaNote, setInsaNote] = useState<string | null>(null)
  const [insaSheetOpen, setInsaSheetOpen] = useState(false)
  const [showSheet, setShowSheet] = useState(false)
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)

  function beginEdit() {
    setDraft(draftFrom(macros))
    setSource(macros?.source ?? 'manual')
    setReadError(null)
    setWarning(null)
    setInsaNote(null)
    setEditing(true)
  }

  function handleSource(next: MacroSource) {
    setReadError(null)
    setWarning(null)
    if (next !== 'insa') {
      setInsaNote(null)
      setSource(next)
      return
    }
    setInsaSheetOpen(true)
  }

  function applyExtraction(result: NutritionLabelResult) {
    setInsaNote(null)
    setDraft({
      calories: String(result.macros.calories),
      protein: String(result.macros.protein),
      carbs: String(result.macros.carbs),
      fat: String(result.macros.fat),
      fibre: String(result.macros.fibre),
    })
    setSource('rotulo')

    if (result.per === 'porcao') {
      setWarning(
        'A IA leu a coluna por porção, não por 100 g. Confirma os valores contra a embalagem antes de guardar.'
      )
    } else if (result.convertedFromKj) {
      setWarning('A energia vinha em kJ e foi convertida para kcal. Confirma o valor.')
    } else if (result.per === 'desconhecido') {
      setWarning('Não foi possível confirmar que a coluna lida era a de 100 g. Verifica os valores.')
    } else {
      setWarning(null)
    }
    if (result.netGrams != null) onNetGrams?.(result.netGrams)
  }

  async function handlePhoto(file: File | undefined) {
    if (!file) return
    setReading(true)
    setReadError(null)
    setWarning(null)
    try {
      const result = await extractNutritionLabel(file)
      if (isEmptyLabel(result)) {
        setReadError('Não consegui ler a tabela. Tenta outra foto ou preenche à mão.')
        return
      }
      applyExtraction(result)
      setEditing(true)
    } catch (e) {
      setReadError(e instanceof Error ? e.message : 'Falha ao ler a tabela nutricional.')
    } finally {
      setReading(false)
      if (galleryRef.current) galleryRef.current.value = ''
      if (cameraRef.current) cameraRef.current.value = ''
    }
  }

  function handleSave() {
    const next: ProductMacros = {
      calories: toNumber(draft.calories),
      protein: toNumber(draft.protein),
      carbs: toNumber(draft.carbs),
      fat: toNumber(draft.fat),
      fibre: toNumber(draft.fibre),
      source,
    }
    const allZero =
      !next.calories && !next.protein && !next.carbs && !next.fat && !next.fibre
    if (allZero && source === 'insa') {
      setReadError(insaMissingMessage(lookupNames))
      return
    }
    void onSave(allZero ? null : next)
    setEditing(false)
  }

  return (
    <section className="bg-nourish-surface border border-nourish-border rounded-2xl p-4 space-y-3">
      <InsaFoodSheet
        open={insaSheetOpen}
        suggested={applyInsaSource(lookupNames)}
        onClose={() => setInsaSheetOpen(false)}
        onPick={(match) => {
          setDraft(draftFrom(match.macros))
          setSource('insa')
          setInsaNote(`Preenchido com valores INSA para «${match.foodName}» (por 100 g).`)
          setReadError(null)
          setWarning(null)
          setInsaSheetOpen(false)
        }}
      />

      {showSheet && (
        <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setShowSheet(false)}>
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm bg-nourish-surface rounded-t-2xl"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 space-y-2">
              <button
                type="button"
                onClick={() => {
                  setShowSheet(false)
                  setTimeout(() => cameraRef.current?.click(), 50)
                }}
                className="w-full py-4 bg-nourish-surface-high rounded-xl text-nourish-text font-semibold text-sm flex items-center justify-center gap-3 active:opacity-80"
              >
                <CameraIcon />
                Tirar foto
              </button>
              <button
                type="button"
                onClick={() => {
                  setShowSheet(false)
                  setTimeout(() => galleryRef.current?.click(), 50)
                }}
                className="w-full py-4 bg-nourish-surface-high rounded-xl text-nourish-text font-semibold text-sm flex items-center justify-center gap-3 active:opacity-80"
              >
                <GalleryIcon />
                Escolher da galeria
              </button>
              <button
                type="button"
                onClick={() => setShowSheet(false)}
                className="w-full py-3 text-nourish-text-dim text-sm"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <h3 className="font-semibold text-nourish-text text-sm">Nutrição (por 100g)</h3>
        {macros && !editing && (
          <span className="text-[10px] px-2 py-0.5 rounded bg-nourish-surface-high text-nourish-text-dim font-semibold uppercase tracking-wider">
            {MACRO_SOURCE_LABELS[macros.source]}
          </span>
        )}
      </div>

      {!editing && (
        <>
          {macros && (
            <dl className="grid grid-cols-5 gap-2 text-center">
              {FIELDS.map(({ key, label, unit }) => (
                <div key={key} className="rounded-lg bg-nourish-surface-high py-2">
                  <dt className="text-[10px] text-nourish-text-dim uppercase tracking-wide">{label}</dt>
                  <dd className="text-sm font-semibold text-nourish-text tabular-nums">
                    {macros[key]}
                    <span className="text-[10px] text-nourish-text-dim ml-0.5">{unit}</span>
                  </dd>
                </div>
              ))}
            </dl>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              disabled={reading}
              onClick={() => setShowSheet(true)}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-nourish-primary text-nourish-on-primary disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
            >
              {reading ? 'A ler…' : 'Ler tabela'}
            </button>
            <button
              type="button"
              onClick={beginEdit}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold border border-nourish-border text-nourish-text focus:outline-none focus:ring-2 focus:ring-nourish-primary"
            >
              {macros ? 'Editar' : 'À mão'}
            </button>
          </div>
        </>
      )}

      {editing && (
        <div className="space-y-3">
          <div className="grid grid-cols-2 gap-2">
            {FIELDS.map(({ key, label, unit }) => (
              <label key={key} className="text-xs text-nourish-text-dim">
                {label} <span className="text-nourish-border">({unit})</span>
                <input
                  type="number"
                  inputMode="decimal"
                  min="0"
                  step="0.1"
                  value={draft[key]}
                  onChange={(e) => setDraft((d) => ({ ...d, [key]: e.target.value }))}
                  placeholder="0"
                  className={`${inputClass} mt-1`}
                />
              </label>
            ))}
          </div>

          <div>
            <span className="text-xs text-nourish-text-dim">Fonte</span>
            <div className="flex gap-2 mt-1.5">
              {MACRO_SOURCES.map((s) => (
                <button
                  key={s}
                  type="button"
                  aria-pressed={source === s}
                  onClick={() => handleSource(s)}
                  className={`flex-1 py-2 rounded-lg text-xs font-medium border transition-colors focus:outline-none focus:ring-2 focus:ring-nourish-primary ${
                    source === s
                      ? 'bg-nourish-primary text-nourish-on-primary border-nourish-primary'
                      : 'bg-nourish-surface-high text-nourish-text-dim border-nourish-border'
                  }`}
                >
                  {MACRO_SOURCE_LABELS[s]}
                </button>
              ))}
            </div>
          </div>

          {insaNote && (
            <div className="flex items-start gap-2 rounded-lg bg-nourish-surface-high px-3 py-2">
              <p className="text-xs text-nourish-text-dim leading-relaxed flex-1 min-w-0">
                {insaNote}
              </p>
              <button
                type="button"
                onClick={() => setInsaSheetOpen(true)}
                className="shrink-0 text-xs font-semibold text-nourish-primary py-0.5 focus:outline-none focus:ring-2 focus:ring-nourish-primary rounded"
              >
                Alterar
              </button>
            </div>
          )}

          {source === 'insa' && !insaNote && (
            <button
              type="button"
              onClick={() => setInsaSheetOpen(true)}
              className="w-full text-left text-xs text-nourish-text-dim leading-relaxed rounded-lg bg-nourish-surface-high px-3 py-2 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
            >
              Valores da tabela nacional.{' '}
              <span className="font-semibold text-nourish-primary">Alterar alimento</span>
            </button>
          )}

          {warning && (
            <p className="text-xs text-amber-400 leading-relaxed rounded-lg bg-nourish-surface-high px-3 py-2">
              {warning}
            </p>
          )}

          <div className="flex gap-2">
            <button
              type="button"
              onClick={() => {
                setInsaSheetOpen(false)
                setEditing(false)
              }}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-nourish-surface-high text-nourish-text focus:outline-none focus:ring-2 focus:ring-nourish-primary"
            >
              Cancelar
            </button>
            <button
              type="button"
              disabled={saving}
              onClick={handleSave}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-nourish-primary text-nourish-on-primary disabled:opacity-40 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
            >
              {saving ? 'A guardar…' : 'Guardar'}
            </button>
          </div>
        </div>
      )}

      {readError && <p className="text-xs text-red-400 leading-relaxed">{readError}</p>}

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="sr-only"
        onChange={(e) => void handlePhoto(e.target.files?.[0])}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="sr-only"
        onChange={(e) => void handlePhoto(e.target.files?.[0])}
      />
    </section>
  )
}
