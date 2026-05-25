import { useEffect, useRef, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { grocy } from '../api/grocy'
import type { Recipe } from '../types/grocy'
import { Spinner } from '../components/Spinner'
import { parseDescription } from '../utils/parseDescription'
import { buildDescription, computeAutoTotal, type IngredientRow } from '../utils/buildDescription'
import { IngredientSection, NutritionSection, PriceSection } from './AddMeal'

function BackIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.31 12l6.97 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5Z" clipRule="evenodd" />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-nourish-border">
      <path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
      <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 0 1-3 3h-15a3 3 0 0 1-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 0 0 1.11-.71l.822-1.315a2.942 2.942 0 0 1 2.332-1.39ZM6.75 12.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Zm12-1.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
    </svg>
  )
}

const inputClass =
  'w-full px-4 py-3 bg-nourish-surface border border-nourish-border rounded-xl text-nourish-text placeholder-nourish-border text-sm focus:outline-none focus:ring-2 focus:ring-nourish-primary focus:border-transparent transition-shadow'

const labelClass = 'block text-sm font-medium text-nourish-text-dim mb-1.5'

export function EditMeal() {
  const { id } = useParams<{ id: string }>()
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
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
  const [priceOverride, setPriceOverride] = useState('')
  const [saving, setSaving] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [nameError, setNameError] = useState(false)

  const numId = id ? parseInt(id, 10) : NaN

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

  function updateRow(id: number, field: 'name' | 'price', value: string) {
    setIngredientRows((prev) => prev.map((r) => (r.id === id ? { ...r, [field]: value } : r)))
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

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!name.trim()) { setNameError(true); return }
    setNameError(false)
    setSaving(true)
    setSaveError(null)
    try {
      let pictureName = existingPhoto
      if (photoFile) pictureName = await grocy.uploadPicture(photoFile)

      const description = buildDescription(
        ingredientRows,
        comoFazer,
        { calories, protein, carbs, fat },
        priceOverride,
        autoTotal
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
        {/* Photo */}
        <div>
          <label className={labelClass}>Foto</label>
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full bg-nourish-surface border-2 border-dashed border-nourish-border rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-2 active:bg-nourish-surface-high transition-colors focus:outline-none focus:ring-2 focus:ring-nourish-primary"
            style={{ aspectRatio: '4/3' }}
          >
            {photoPreview ? <img src={photoPreview} className="w-full h-full object-cover" alt="preview" /> : (
              <><CameraIcon /><p className="text-sm text-nourish-text-dim">Toca para adicionar foto</p></>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </div>

        {/* Name */}
        <div>
          <label className={labelClass}>Nome <span className="text-red-400">*</span></label>
          <input type="text" value={name} onChange={(e) => { setName(e.target.value); setNameError(false) }}
            placeholder="Ex: Esparguete com atum" className={`${inputClass} ${nameError ? 'border-red-500' : ''}`} />
          {nameError && <p className="text-red-400 text-xs mt-1">Nome é obrigatório</p>}
        </div>

        <IngredientSection rows={ingredientRows} onUpdate={updateRow} onAdd={addRow} onRemove={removeRow}
          inputClass={inputClass} labelClass={labelClass} />

        {/* Steps */}
        <div>
          <label className={labelClass}>Como fazer <span className="text-nourish-border font-normal">(opcional)</span></label>
          <textarea value={comoFazer} onChange={(e) => setComoFazer(e.target.value)}
            rows={4} placeholder="Descreve os passos de preparação..." className={`${inputClass} resize-none`} />
        </div>

        <NutritionSection calories={calories} protein={protein} carbs={carbs} fat={fat}
          onChange={{ calories: setCalories, protein: setProtein, carbs: setCarbs, fat: setFat }}
          inputClass={inputClass} labelClass={labelClass} />

        <PriceSection autoTotal={autoTotal} priceOverride={priceOverride} onOverrideChange={setPriceOverride}
          inputClass={inputClass} labelClass={labelClass} />

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
