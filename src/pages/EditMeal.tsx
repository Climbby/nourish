import { useEffect, useRef, useState, useCallback } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { grocy } from '../api/grocy'
import { analyzeMeal, suggestIngredients } from '../api/ai'
import type { Recipe } from '../types/grocy'
import { Spinner } from '../components/Spinner'
import { parseDescription } from '../utils/parseDescription'
import { buildDescription, computeAutoTotal, type IngredientRow } from '../utils/buildDescription'
import { IngredientSection, NutritionSection, PriceSection, PortionsSection } from './AddMeal'
import { AiGenerateButton } from '../components/AiGenerateButton'
import { MealOriginField } from '../components/MealOriginField'
import { PhotoField } from '../components/PhotoField'
import { VerifyCheckbox } from '../components/VerifiedBadge'
import type { VerifiedField } from '../utils/verification'
import { resolveMealOrigin, type MealOrigin } from '../utils/mealOrigin'

function BackIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.31 12l6.97 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5Z" clipRule="evenodd" />
    </svg>
  )
}

const inputClass =
  'w-full px-4 py-3 bg-nourish-surface border border-nourish-border rounded-xl text-nourish-text placeholder-nourish-border text-sm focus:outline-none focus:ring-2 focus:ring-nourish-primary focus:border-transparent transition-shadow'

const labelClass = 'block text-sm font-medium text-nourish-text-dim mb-1.5'

export function EditMeal() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const rowIdRef = useRef(1)

  const [loadError, setLoadError] = useState<string | null>(null)
  const [loading, setLoading] = useState(true)
  const [recipe, setRecipe] = useState<Recipe | null>(null)

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [existingPhoto, setExistingPhoto] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [ingredientRows, setIngredientRows] = useState<IngredientRow[]>([])
  const [comoFazer, setComoFazer] = useState('')
  const [calories, setCalories] = useState('')
  const [protein, setProtein] = useState('')
  const [carbs, setCarbs] = useState('')
  const [fat, setFat] = useState('')
  const [category, setCategory] = useState('')
  const [origin, setOrigin] = useState<MealOrigin>('supermercado')
  const [portions, setPortions] = useState('')
  const [priceOverride, setPriceOverride] = useState('')
  const [verifyNutricao, setVerifyNutricao] = useState(false)
  const [verifyMealPrice, setVerifyMealPrice] = useState(false)
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [nameError, setNameError] = useState(false)
  const [analyzing, setAnalyzing] = useState(false)
  const [aiError, setAiError] = useState<string | null>(null)
  const [existingProducts, setExistingProducts] = useState<string[]>([])
  const [suggestions, setSuggestions] = useState<Record<number, string[]>>({})
  const [focusedRow, setFocusedRow] = useState<number | null>(null)
  const suggestTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  const numId = id ? parseInt(id, 10) : NaN

  useEffect(() => {
    grocy.getProducts().then((products) => {
      setExistingProducts(products.map((p) => p.name))
    }).catch(() => {})
  }, [])

  const debouncedSuggest = useCallback(async (rowId: number, query: string) => {
    if (!query.trim() || query.length < 2) {
      setSuggestions((prev) => ({ ...prev, [rowId]: [] }))
      return
    }
    const results = await suggestIngredients(query, existingProducts)
    setSuggestions((prev) => ({ ...prev, [rowId]: results }))
  }, [existingProducts])

  useEffect(() => {
    if (!id || isNaN(numId)) {
      setLoadError('ID inválido')
      setLoading(false)
      return
    }

    grocy.getRecipe(numId).then((r) => {
      setRecipe(r)
      setName(r.name)

      const parsed = parseDescription(r.description ?? '')

      if (parsed.ingredientItems.length > 0) {
        const rows = parsed.ingredientItems.map((item, i) => ({
          id: i + 1,
          name: item.name,
          price: item.price !== null ? item.price.toFixed(2) : '',
        }))
        setIngredientRows(rows)
        rowIdRef.current = rows.length + 1
      } else {
        setIngredientRows([{ id: rowIdRef.current++, name: '', price: '' }])
      }

      setComoFazer(parsed.steps ?? '')

      if (parsed.nutrition) {
        setCalories(parsed.nutrition.calories > 0 ? String(parsed.nutrition.calories) : '')
        setProtein(parsed.nutrition.protein > 0 ? String(parsed.nutrition.protein) : '')
        setCarbs(parsed.nutrition.carbs > 0 ? String(parsed.nutrition.carbs) : '')
        setFat(parsed.nutrition.fat > 0 ? String(parsed.nutrition.fat) : '')
      }

      if (parsed.price !== null) setPriceOverride(parsed.price.toFixed(2))
      setVerifyNutricao(parsed.verified.includes('nutricao'))
      setVerifyMealPrice(parsed.verified.includes('preco'))
      setCategory(parsed.category ?? '')
      setOrigin(resolveMealOrigin(parsed.origin))
      setPortions(parsed.portions !== null ? String(parsed.portions) : '')

      if (r.picture_file_name) {
        setExistingPhoto(r.picture_file_name)
        setPhotoPreview(grocy.pictureUrl(r.picture_file_name))
      }

      setLoading(false)
    }).catch((e: Error) => {
      setLoadError(e.message)
      setLoading(false)
    })
  }, [numId])

  const autoTotal = computeAutoTotal(ingredientRows)

  async function photoForAi(): Promise<File | null> {
    if (photoFile) return photoFile
    if (!photoPreview || photoPreview.startsWith('blob:')) return null
    try {
      const res = await fetch(photoPreview)
      if (!res.ok) return null
      const blob = await res.blob()
      return new File([blob], 'meal.jpg', { type: blob.type || 'image/jpeg' })
    } catch {
      return null
    }
  }

  async function handleAnalyze() {
    setAnalyzing(true)
    setAiError(null)
    try {
      const ingredientNames = ingredientRows.map((r) => r.name.trim()).filter(Boolean)
      const result = await analyzeMeal(name.trim() || 'refeição', ingredientNames, await photoForAi())
      if (result.calories !== null || result.protein !== null || result.carbs !== null || result.fat !== null) {
        if (result.calories !== null) setCalories(String(Math.round(result.calories)))
        if (result.protein !== null) setProtein(String(Math.round(result.protein)))
        if (result.carbs !== null) setCarbs(String(Math.round(result.carbs)))
        if (result.fat !== null) setFat(String(Math.round(result.fat)))
        setVerifyNutricao(false)
      }
      if (result.totalPrice !== null) {
        setPriceOverride(result.totalPrice.toFixed(2))
        setVerifyMealPrice(false)
      }
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
      if (result.steps.trim() && !comoFazer.trim()) setComoFazer(result.steps.trim())
    } catch (e) {
      setAiError(e instanceof Error ? e.message : 'Erro na análise')
    } finally {
      setAnalyzing(false)
    }
  }

  function updateRow(rowId: number, field: 'name' | 'price', value: string) {
    setIngredientRows((prev) => prev.map((r) => (r.id === rowId ? { ...r, [field]: value } : r)))
    if (field === 'name') {
      if (suggestTimeoutRef.current) clearTimeout(suggestTimeoutRef.current)
      suggestTimeoutRef.current = setTimeout(() => debouncedSuggest(rowId, value), 300)
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
    setSaveError(null)
    try {
      let pictureName = existingPhoto
      if (photoFile) pictureName = await grocy.uploadPicture(photoFile)

      const verified = new Set<VerifiedField>()
      const hasNutricao =
        (calories.trim() && parseFloat(calories) > 0) ||
        (protein.trim() && parseFloat(protein) > 0) ||
        (carbs.trim() && parseFloat(carbs) > 0) ||
        (fat.trim() && parseFloat(fat) > 0)
      const finalPrice = priceOverride !== '' ? parseFloat(priceOverride) : autoTotal
      if (verifyNutricao && hasNutricao) verified.add('nutricao')
      if (verifyMealPrice && !isNaN(finalPrice) && finalPrice > 0) verified.add('preco')

      const description = buildDescription(
        ingredientRows,
        comoFazer,
        { calories, protein, carbs, fat },
        priceOverride,
        autoTotal,
        category,
        origin === 'supermercado' && portions !== '' ? parseInt(portions, 10) : null,
        verified,
        origin
      )

      await grocy.updateRecipe(numId, {
        name: name.trim(),
        description,
        base_servings: recipe?.base_servings ?? 1,
        desired_servings: recipe?.desired_servings ?? 1,
        not_check_shoppinglist: recipe?.not_check_shoppinglist ?? 0,
        picture_file_name: pictureName,
      })

      navigate(`/meal/${id}`)
    } catch (e) {
      setSaveError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setSaving(false)
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-nourish-bg">
        <header className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-nourish-border">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-nourish-text-dim rounded-lg focus:outline-none focus:ring-2 focus:ring-nourish-primary">
            <BackIcon />
          </button>
          <h2 className="font-semibold text-nourish-text text-lg">Editar Refeição</h2>
        </header>
        <Spinner />
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="min-h-screen bg-nourish-bg">
        <header className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-nourish-border">
          <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-nourish-text-dim rounded-lg focus:outline-none focus:ring-2 focus:ring-nourish-primary">
            <BackIcon />
          </button>
          <h2 className="font-semibold text-nourish-text text-lg">Editar Refeição</h2>
        </header>
        <div className="p-4">
          <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 rounded-xl text-sm">{loadError}</div>
        </div>
      </div>
    )
  }

  return (
    <div className="min-h-screen bg-nourish-bg">
      <header className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-nourish-border">
        <button onClick={() => navigate(-1)} className="p-2 -ml-2 text-nourish-text-dim rounded-lg focus:outline-none focus:ring-2 focus:ring-nourish-primary">
          <BackIcon />
        </button>
        <h2 className="font-semibold text-nourish-text text-lg truncate flex-1">{name || 'Editar Refeição'}</h2>
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
            placeholder="Ex: Esparguete com atum" className={`${inputClass} ${nameError ? 'border-red-500' : ''}`} />
          {nameError && <p className="text-red-400 text-xs mt-1">Nome é obrigatório</p>}
          <AiGenerateButton loading={analyzing} disabled={saving} onClick={handleAnalyze} />
          {aiError && <p className="text-red-400 text-xs mt-1">{aiError}</p>}
        </div>

        <MealOriginField value={origin} onChange={setOrigin} labelClass={labelClass} />

        {origin === 'supermercado' && (
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
          </>
        )}

        <NutritionSection
          calories={calories}
          protein={protein}
          carbs={carbs}
          fat={fat}
          onChange={{
            calories: (v) => {
              setCalories(v)
              setVerifyNutricao(false)
            },
            protein: (v) => {
              setProtein(v)
              setVerifyNutricao(false)
            },
            carbs: (v) => {
              setCarbs(v)
              setVerifyNutricao(false)
            },
            fat: (v) => {
              setFat(v)
              setVerifyNutricao(false)
            },
          }}
          inputClass={inputClass}
          labelClass={labelClass}
        />
        <VerifyCheckbox
          id="edit-verify-nutricao"
          checked={verifyNutricao}
          onChange={setVerifyNutricao}
          label="Nutrição verificada"
          disabled={
            !(calories.trim() && parseFloat(calories) > 0) &&
            !(protein.trim() && parseFloat(protein) > 0) &&
            !(carbs.trim() && parseFloat(carbs) > 0) &&
            !(fat.trim() && parseFloat(fat) > 0)
          }
        />

        <PriceSection
          autoTotal={origin === 'supermercado' ? autoTotal : 0}
          priceOverride={priceOverride}
          onOverrideChange={(v) => {
            setPriceOverride(v)
            setVerifyMealPrice(false)
          }}
          inputClass={inputClass}
          labelClass={labelClass}
        />
        <VerifyCheckbox
          id="edit-verify-preco"
          checked={verifyMealPrice}
          onChange={setVerifyMealPrice}
          label="Preço verificado"
          disabled={
            (priceOverride === '' || parseFloat(priceOverride) <= 0) &&
            (origin !== 'supermercado' || autoTotal <= 0)
          }
        />

        {origin === 'supermercado' && (
          <PortionsSection portions={portions} onChange={setPortions}
            inputClass={inputClass} labelClass={labelClass} />
        )}

        {saveError && <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 rounded-xl text-sm">{saveError}</div>}
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm bg-nourish-surface border-t border-nourish-border p-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>
        <button onClick={handleSave} disabled={saving}
          className="w-full bg-nourish-primary text-nourish-on-primary font-semibold py-3.5 rounded-xl active:opacity-90 transition-opacity disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-nourish-primary focus:ring-offset-2 focus:ring-offset-nourish-surface">
          {saving ? 'A guardar...' : 'Guardar alterações'}
        </button>
      </div>
    </div>
  )
}
