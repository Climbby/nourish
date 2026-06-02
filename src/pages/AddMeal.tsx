import { useRef, useState, useEffect, useCallback } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { grocy } from '../api/grocy'
import { analyzeMeal, analyzeProduct, suggestIngredients } from '../api/ai'
import { grocyConfig } from '../config/grocy'
import { buildDescription, computeAutoTotal, type IngredientRow } from '../utils/buildDescription'
import { PhotoField } from '../components/PhotoField'

const { despensaGroupId: DESPENSA_GROUP_ID, defaultLocationId: DEFAULT_LOCATION_ID, defaultQuId: DEFAULT_QU_ID } = grocyConfig

function BackIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.31 12l6.97 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5Z" clipRule="evenodd" />
    </svg>
  )
}

function TrashIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-4 h-4">
      <path fillRule="evenodd" d="M16.5 4.478v.227a48.816 48.816 0 0 1 3.878.512.75.75 0 1 1-.256 1.478l-.209-.035-1.005 13.07a3 3 0 0 1-2.991 2.77H8.084a3 3 0 0 1-2.991-2.77L4.087 6.66l-.209.035a.75.75 0 0 1-.256-1.478A48.567 48.567 0 0 1 7.5 4.705v-.227c0-1.564 1.213-2.9 2.816-2.951a52.662 52.662 0 0 1 3.369 0c1.603.051 2.815 1.387 2.815 2.951Zm-6.136-1.452a51.196 51.196 0 0 1 3.273 0C14.39 3.05 15 3.684 15 4.478v.113a49.488 49.488 0 0 0-6 0v-.113c0-.794.609-1.428 1.364-1.452Zm-.355 5.945a.75.75 0 1 0-1.5.058l.347 9a.75.75 0 1 0 1.499-.058l-.346-9Zm5.48.058a.75.75 0 1 0-1.498-.058l-.347 9a.75.75 0 0 0 1.499.058l.346-9Z" clipRule="evenodd" />
    </svg>
  )
}

const inputClass =
  'w-full px-4 py-3 bg-nourish-surface border border-nourish-border rounded-xl text-nourish-text placeholder-nourish-border text-sm focus:outline-none focus:ring-2 focus:ring-nourish-primary focus:border-transparent transition-shadow'

const labelClass = 'block text-sm font-medium text-nourish-text-dim mb-1.5'

export const aiButtonClass =
  'w-full mt-2 py-2.5 rounded-xl text-sm font-semibold transition-all focus:outline-none focus:ring-2 focus:ring-nourish-primary ' +
  'bg-gradient-to-r from-purple-600 to-blue-500 text-white hover:from-purple-500 hover:to-blue-400 active:opacity-90 disabled:opacity-50'

export function AddMeal() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const rowIdRef = useRef(1)

  const typeParam = searchParams.get('type') ?? ''
  const isDespensa = typeParam === 'despensa'

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>([
    { id: rowIdRef.current++, name: '', price: '' },
  ])
  const [comoFazer, setComoFazer] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [category, setCategory] = useState(() => {
    if (typeParam === 'completa') return 'Completa'
    if (typeParam === 'ligeira') return 'Ligeira'
    return ''
  })
  const [buyAmount, setBuyAmount] = useState('1')
  const [priceOverride, setPriceOverride] = useState('')
  const [saving, setSaving] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState(false)
  const [existingProducts, setExistingProducts] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<Record<number, string[]>>({})
  const [focusedRow, setFocusedRow] = useState<number | null>(null)
  const suggestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const autoTotal = computeAutoTotal(ingredientRows)

  useEffect(() => {
    if (!isDespensa) {
      grocy.getProducts().then((products) => {
        setExistingProducts(products.map((p) => p.name))
      }).catch(() => {})
    }
  }, [isDespensa])

  const debouncedSuggest = useCallback(async (id: number, query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions((prev) => ({ ...prev, [id]: [] }))
      return
    }
    const results = await suggestIngredients(query, existingProducts)
    setSuggestions((prev) => ({ ...prev, [id]: results }))
  }, [existingProducts])

  async function handleAnalyze() {
    setAnalyzing(true)
    setAiError(null)
    try {
      if (isDespensa) {
        const result = await analyzeProduct(name.trim() || 'produto', photoFile)
        if (result.calories !== null) setCalories(String(Math.round(result.calories)))
      } else {
        const ingredientNames = ingredientRows.map((r) => r.name.trim()).filter(Boolean)
        const result = await analyzeMeal(name.trim() || 'refeição', ingredientNames, photoFile)
        if (result.calories !== null) setCalories(String(Math.round(result.calories)))
        if (result.protein !== null) setProtein(String(Math.round(result.protein)))
        if (result.carbs !== null) setCarbs(String(Math.round(result.carbs)))
        if (result.fat !== null) setFat(String(Math.round(result.fat)))
        if (result.totalPrice !== null) setPriceOverride(result.totalPrice.toFixed(2))

        if (result.ingredients.length > 0) {
          const existingNames = new Set(
            ingredientRows.map((r) => r.name.trim().toLowerCase()).filter(Boolean)
          )
          const newRows = result.ingredients
            .filter((n) => !existingNames.has(n.trim().toLowerCase()))
            .map((n) => ({ id: rowIdRef.current++, name: n.trim(), price: '' }))

          if (newRows.length > 0) {
            setIngredientRows((prev) => {
              const filled = prev.filter((r) => r.name.trim())
              const empty = prev.filter((r) => !r.name.trim())
              const base = filled.length > 0 ? filled : []
              const firstEmpty = empty.length > 0 ? [{ ...empty[0], name: newRows[0].name, price: '' }] : []
              const rest = newRows.slice(empty.length > 0 ? 1 : 0)
              return [...base, ...firstEmpty, ...rest]
            })
          }
        }

        if (result.steps.trim() && !comoFazer.trim()) {
          setComoFazer(result.steps.trim())
        }
      }
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Erro na análise')
    } finally {
      setAnalyzing(false)
    }
  }

  function updateRow(id: number, field: 'name' | 'price', value: string) {
    setIngredientRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
    if (field === 'name') {
      if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current)
      suggestTimeoutRef.current = setTimeout(() => debouncedSuggest(id, value), 300)
    }
  }

  function addRow() {
    setIngredientRows((prev) => [...prev, { id: rowIdRef.current++, name: '', price: '' }])
  }

  function removeRow(id: number) {
    setIngredientRows((prev) => {
      const next = prev.filter((r) => r.id !== id)
      return next.length === 0 ? [{ id: rowIdRef.current++, name: '', price: '' }] : next
    })
  }

  async function handleSave() {
    if (!name.trim()) { setNameError(true); return }
    setNameError(false)
    setSaving(true)
    setError(null)
    try {
      if (isDespensa) {
        const result = await grocy.createProduct({
          name: name.trim(),
          product_group_id: DESPENSA_GROUP_ID,
          location_id: DEFAULT_LOCATION_ID,
          qu_id_purchase: DEFAULT_QU_ID,
          qu_id_stock: DEFAULT_QU_ID,
          qu_id_consume: DEFAULT_QU_ID,
          qu_id_price: DEFAULT_QU_ID,
          calories: calories ? parseFloat(calories) : null,
          active: 1,
          quick_consume_amount: 1,
          default_best_before_days: 0,
          description: `[BuyAmount]\n${buyAmount || '1'}`,
        })
        if (photoFile) {
          const filename = await grocy.uploadProductPicture(photoFile, result.created_object_id)
          await grocy.updateProduct(result.created_object_id, { picture_file_name: filename })
        }
        navigate('/?filter=despensa', { replace: true })
      } else {
        let pictureName: string | null = null
        if (photoFile) pictureName = await grocy.uploadPicture(photoFile)

        const description = buildDescription(
          ingredientRows,
          comoFazer,
          { calories, protein, carbs, fat },
          priceOverride,
          autoTotal,
          category
        )

        await grocy.createRecipe({
          name: name.trim(),
          description,
          base_servings: 1,
          desired_servings: 1,
          not_check_shoppinglist: 0,
          ...(pictureName ? { picture_file_name: pictureName } : {}),
        })
        navigate(-1)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-nourish-bg">
      <header className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-nourish-border">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-nourish-text-dim rounded-lg focus:outline-none focus:ring-2 focus:ring-nourish-primary">
          <BackIcon />
        </button>
        <h2 className="font-semibold text-nourish-text text-lg">
          {isDespensa ? 'Novo produto' : 'Nova refeição'}
        </h2>
      </header>

      <div className="p-4 space-y-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)' }}>
        <PhotoField
          preview={photoPreview}
          onChange={(file, url) => { setPhotoFile(file); setPhotoPreview(url) }}
          labelClass={labelClass}
        />

        {/* Name */}
        <div>
          <label className={labelClass}>Nome <span className="text-red-400">*</span></label>
          <input type="text" value={name} onChange={(e) => { setName(e.target.value); setNameError(false) }}
            placeholder={isDespensa ? 'Ex: Leite, Água, Pão…' : 'Ex: Esparguete com atum'}
            className={`${inputClass} ${nameError ? 'border-red-500' : ''}`} />
          {nameError && <p className="text-red-400 text-xs mt-1">Nome é obrigatório</p>}
          <button type="button" onClick={handleAnalyze} disabled={analyzing || saving} className={aiButtonClass}>
            {analyzing ? 'A gerar com IA…' : '✨ Gerar com IA'}
          </button>
          <p className="text-xs text-nourish-text-dim mt-1 leading-snug">
            Preenche ingredientes, passos, nutrição e preço a partir do nome{photoPreview ? ' e da foto' : ''}.
          </p>
          {aiError && <p className="text-red-400 text-xs">{aiError}</p>}
        </div>

        {isDespensa ? (
          <>
            <div>
              <label className={labelClass}>Calorias (por unidade)</label>
              <input type="number" value={calories} onChange={(e) => setCalories(e.target.value)}
                placeholder="ex: 52" min="0" className={inputClass} />
            </div>
            <div>
              <label className={labelClass}>Quantidade que compras de cada vez</label>
              <input type="number" value={buyAmount} onChange={(e) => setBuyAmount(e.target.value)}
                min="1" className={inputClass} />
              <p className="text-xs text-nourish-text-dim mt-1">Ex: 6 para água (pack de 6 garrafas)</p>
            </div>
          </>
        ) : (
          <>
            <IngredientSection
              rows={ingredientRows}
              onUpdate={updateRow}
              onAdd={addRow}
              onRemove={removeRow}
              inputClass={inputClass}
              labelClass={labelClass}
              suggestions={suggestions}
              focusedRow={focusedRow}
              onFocus={setFocusedRow}
            />
            <div>
              <label className={labelClass}>Como fazer <span className="text-nourish-border font-normal">(opcional)</span></label>
              <textarea value={comoFazer} onChange={(e) => setComoFazer(e.target.value)}
                rows={4} placeholder="Descreve os passos de preparação..." className={`${inputClass} resize-none`} />
            </div>
            <NutritionSection
              calories={calories} protein={protein} carbs={carbs} fat={fat}
              onChange={{ calories: setCalories, protein: setProtein, carbs: setCarbs, fat: setFat }}
              inputClass={inputClass} labelClass={labelClass}
            />
            <PriceSection
              autoTotal={autoTotal} priceOverride={priceOverride}
              onOverrideChange={setPriceOverride} inputClass={inputClass} labelClass={labelClass}
            />
          </>
        )}

        {error && <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 rounded-xl text-sm">{error}</div>}
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm bg-nourish-surface border-t border-nourish-border p-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>
        <button onClick={handleSave} disabled={saving}
          className="w-full bg-nourish-primary text-nourish-on-primary font-semibold py-3.5 rounded-xl active:opacity-90 transition-opacity disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-nourish-primary focus:ring-offset-2 focus:ring-offset-nourish-surface">
          {saving ? 'A guardar...' : isDespensa ? 'Adicionar produto' : 'Guardar refeição'}
        </button>
      </div>
    </div>
  )
}

// ── Shared sub-sections (also used by EditMeal) ──────────────────────────────

export function IngredientSection({ rows, onUpdate, onAdd, onRemove, inputClass, labelClass, suggestions = {}, focusedRow = null, onFocus }: {
  rows: IngredientRow[]
  onUpdate: (id: number, field: 'name' | 'price', value: string) => void
  onAdd: () => void
  onRemove: (id: number) => void
  inputClass: string
  labelClass: string
  suggestions?: Record<number, string[]>
  focusedRow?: number | null
  onFocus?: (id: number | null) => void
}) {
  return (
    <div>
      <label className={labelClass}>Ingredientes <span className="text-nourish-border font-normal">(opcional)</span></label>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="space-y-1">
            <div className="flex gap-2 items-start">
              <div className="flex-1 relative">
                <input type="text" value={row.name} onChange={(e) => onUpdate(row.id, 'name', e.target.value)}
                  onFocus={() => onFocus?.(row.id)}
                  onBlur={() => setTimeout(() => onFocus?.(null), 200)}
                  placeholder="Ingrediente" className={`${inputClass} w-full`} />
                {onFocus && focusedRow === row.id && suggestions[row.id]?.length > 0 && (
                  <div className="absolute z-10 top-full left-0 right-0 mt-1 bg-nourish-surface border border-nourish-border rounded-xl shadow-lg overflow-hidden">
                    {suggestions[row.id].map((s, i) => (
                      <button
                        key={i}
                        type="button"
                        onMouseDown={(e) => { e.preventDefault(); onUpdate(row.id, 'name', s); onFocus(null) }}
                        className="w-full text-left px-4 py-2 text-sm text-nourish-text hover:bg-nourish-border/20 transition-colors focus:outline-none"
                      >
                        {s}
                      </button>
                    ))}
                  </div>
                )}
              </div>
              <div className="relative w-24 flex-shrink-0">
                <span className="absolute left-3 top-1/2 -translate-y-1/2 text-nourish-text-dim text-sm pointer-events-none">€</span>
                <input type="number" value={row.price} onChange={(e) => onUpdate(row.id, 'price', e.target.value)}
                  placeholder="0.00" className={`${inputClass} pl-7 pr-2`} min="0" step="0.01" />
              </div>
              <button type="button" onClick={() => onRemove(row.id)}
                className="p-2 text-nourish-border hover:text-red-400 transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-nourish-primary rounded-lg mt-2">
                <TrashIcon />
              </button>
            </div>
          </div>
        ))}
      </div>
      <button type="button" onClick={onAdd} className="mt-2 text-sm text-nourish-primary font-medium focus:outline-none">
        + Adicionar ingrediente
      </button>
    </div>
  )
}

export function NutritionSection({ calories, protein, carbs, fat, onChange, inputClass, labelClass }: {
  calories: string; protein: string; carbs: string; fat: string
  onChange: { calories: (v: string) => void; protein: (v: string) => void; carbs: (v: string) => void; fat: (v: string) => void }
  inputClass: string; labelClass: string
}) {
  return (
    <div>
      <label className={labelClass}>Valores nutricionais <span className="text-nourish-border font-normal">(opcional)</span></label>
      <div className="grid grid-cols-2 gap-2">
        <input type="number" value={calories} onChange={(e) => onChange.calories(e.target.value)} placeholder="Calorias (kcal)" className={inputClass} min="0" />
        <input type="number" value={protein} onChange={(e) => onChange.protein(e.target.value)} placeholder="Proteína (g)" className={inputClass} min="0" />
        <input type="number" value={carbs} onChange={(e) => onChange.carbs(e.target.value)} placeholder="Hidratos (g)" className={inputClass} min="0" />
        <input type="number" value={fat} onChange={(e) => onChange.fat(e.target.value)} placeholder="Gordura (g)" className={inputClass} min="0" />
      </div>
    </div>
  )
}

export function PriceSection({ autoTotal, priceOverride, onOverrideChange, inputClass, labelClass }: {
  autoTotal: number; priceOverride: string
  onOverrideChange: (v: string) => void
  inputClass: string; labelClass: string
}) {
  return (
    <div>
      <label className={labelClass}>Custo total <span className="text-nourish-border font-normal">(opcional)</span></label>
      {autoTotal > 0 && (
        <p className="text-xs text-nourish-text-dim mb-1.5">
          Soma dos ingredientes: <span className="text-nourish-primary font-medium">€{autoTotal.toFixed(2)}</span>
          {priceOverride !== '' && (
            <button type="button" onClick={() => onOverrideChange('')} className="ml-2 underline focus:outline-none">repor</button>
          )}
        </p>
      )}
      <div className="relative">
        <span className="absolute left-4 top-1/2 -translate-y-1/2 text-nourish-text-dim text-sm pointer-events-none">€</span>
        <input type="number" value={priceOverride} onChange={(e) => onOverrideChange(e.target.value)}
          placeholder={autoTotal > 0 ? autoTotal.toFixed(2) : '0.00'}
          className={`${inputClass} pl-8`} min="0" step="0.01" />
      </div>
      {priceOverride !== '' && autoTotal > 0 && parseFloat(priceOverride) !== autoTotal && (
        <p className="text-xs text-nourish-text-dim mt-1">A usar valor manual em vez da soma</p>
      )}
    </div>
  )
}

export function PortionsSection({ portions, onChange, inputClass, labelClass }: {
  portions: string
  onChange: (v: string) => void
  inputClass: string
  labelClass: string
}) {
  return (
    <div>
      <label className={labelClass}>Porções no frigorífico <span className="text-nourish-border font-normal">(opcional)</span></label>
      <input
        type="number"
        value={portions}
        onChange={(e) => onChange(e.target.value)}
        min="0"
        placeholder="0"
        className={inputClass}
      />
      <p className="text-xs text-nourish-text-dim mt-1">Quantas porções prontas tens guardadas</p>
    </div>
  )
}
