import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { grocy } from '../api/grocy'
import { buildDescription, computeAutoTotal, type IngredientRow } from '../utils/buildDescription'

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

export function AddMeal() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)
  const rowIdRef = useRef(1)

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
  const [priceOverride, setPriceOverride] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState(false)

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
    setError(null)
    try {
      let pictureName: string | null = null
      if (photoFile) pictureName = await grocy.uploadPicture(photoFile)

      const description = buildDescription(
        ingredientRows,
        comoFazer,
        { calories, protein, carbs, fat },
        priceOverride,
        autoTotal
      )

      await grocy.createRecipe({
        name: name.trim(),
        description,
        base_servings: 1,
        desired_servings: 1,
        not_check_shoppinglist: 0,
        ...(pictureName ? { picture_file_name: pictureName } : {}),
      })
      navigate('/')
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
        <h2 className="font-semibold text-nourish-text text-lg">Nova Refeição</h2>
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

        {/* Ingredients */}
        <IngredientSection
          rows={ingredientRows}
          onUpdate={updateRow}
          onAdd={addRow}
          onRemove={removeRow}
          inputClass={inputClass}
          labelClass={labelClass}
        />

        {/* Steps */}
        <div>
          <label className={labelClass}>Como fazer <span className="text-nourish-border font-normal">(opcional)</span></label>
          <textarea value={comoFazer} onChange={(e) => setComoFazer(e.target.value)}
            rows={4} placeholder="Descreve os passos de preparação..." className={`${inputClass} resize-none`} />
        </div>

        {/* Nutrition */}
        <NutritionSection
          calories={calories} protein={protein} carbs={carbs} fat={fat}
          onChange={{ calories: setCalories, protein: setProtein, carbs: setCarbs, fat: setFat }}
          inputClass={inputClass} labelClass={labelClass}
        />

        {/* Total price */}
        <PriceSection
          autoTotal={autoTotal} priceOverride={priceOverride}
          onOverrideChange={setPriceOverride} inputClass={inputClass} labelClass={labelClass}
        />

        {error && <div className="p-3 bg-red-900/30 border border-red-800 text-red-400 rounded-xl text-sm">{error}</div>}
      </div>

      <div className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm bg-nourish-surface border-t border-nourish-border p-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}>
        <button onClick={handleSave} disabled={saving}
          className="w-full bg-nourish-primary text-nourish-on-primary font-semibold py-3.5 rounded-xl active:opacity-90 transition-opacity disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-nourish-primary focus:ring-offset-2 focus:ring-offset-nourish-surface">
          {saving ? 'A guardar...' : 'Guardar refeição'}
        </button>
      </div>
    </div>
  )
}

// ── Shared sub-sections (also used by EditMeal) ──────────────────────────────

export function IngredientSection({ rows, onUpdate, onAdd, onRemove, inputClass, labelClass }: {
  rows: IngredientRow[]
  onUpdate: (id: number, field: 'name' | 'price', value: string) => void
  onAdd: () => void
  onRemove: (id: number) => void
  inputClass: string
  labelClass: string
}) {
  return (
    <div>
      <label className={labelClass}>Ingredientes <span className="text-nourish-border font-normal">(opcional)</span></label>
      <div className="space-y-2">
        {rows.map((row) => (
          <div key={row.id} className="flex gap-2 items-center">
            <input type="text" value={row.name} onChange={(e) => onUpdate(row.id, 'name', e.target.value)}
              placeholder="Ingrediente" className={`${inputClass} flex-1`} />
            <div className="relative w-24 flex-shrink-0">
              <span className="absolute left-3 top-1/2 -translate-y-1/2 text-nourish-text-dim text-sm pointer-events-none">€</span>
              <input type="number" value={row.price} onChange={(e) => onUpdate(row.id, 'price', e.target.value)}
                placeholder="0.00" className={`${inputClass} pl-7 pr-2`} min="0" step="0.01" />
            </div>
            <button type="button" onClick={() => onRemove(row.id)}
              className="p-2 text-nourish-border hover:text-red-400 transition-colors flex-shrink-0 focus:outline-none focus:ring-2 focus:ring-nourish-primary rounded-lg">
              <TrashIcon />
            </button>
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
