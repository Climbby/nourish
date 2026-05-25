import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { grocy } from '../api/grocy'
import { PhotoField } from '../components/PhotoField'

const DESPENSA_GROUP_ID = 6
const DEFAULT_LOCATION_ID = 2

const inputClass =
  'w-full px-4 py-3 bg-nourish-surface border border-nourish-border rounded-xl text-nourish-text placeholder-nourish-border text-sm focus:outline-none focus:ring-2 focus:ring-nourish-primary focus:border-transparent transition-shadow'

const labelClass = 'block text-sm font-medium text-nourish-text-dim mb-1.5'

function BackIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.31 12l6.97 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5Z" clipRule="evenodd" />
    </svg>
  )
}

export function AddProduct() {
  const navigate = useNavigate()
  const [name, setName] = useState('')
  const [calories, setCalories] = useState('')
  const [buyAmount, setBuyAmount] = useState('1')
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    if (!name.trim()) return
    setSaving(true)
    setError(null)
    try {
      const result = await grocy.createProduct({
        name: name.trim(),
        product_group_id: DESPENSA_GROUP_ID,
        location_id: DEFAULT_LOCATION_ID,
        qu_id_purchase: 2,
        qu_id_stock: 2,
        qu_id_consume: 2,
        qu_id_price: 2,
        calories: calories ? parseFloat(calories) : null,
        active: 1,
        quick_consume_amount: 1,
        default_best_before_days: 0,
      })

      if (photoFile) {
        const filename = `product_${result.created_object_id}_${Date.now()}.webp`
        const b64name = btoa(filename).replace(/=+$/, '')
        await fetch(`/api/files/productpictures/${b64name}`, {
          method: 'PUT',
          headers: { 'Content-Type': photoFile.type },
          body: photoFile,
        })
        await grocy.updateProduct(result.created_object_id, { picture_file_name: filename })
      }

      // Store custom buy amount in the BUY_AMOUNTS config if != 1
      // For now navigate back; user can adjust buy amount per-product later
      navigate(-1)
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao guardar')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen bg-nourish-bg">
      <header className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-nourish-border">
        <button onClick={() => navigate(-1)} className="text-nourish-text-dim">
          <BackIcon />
        </button>
        <h1 className="text-lg font-bold text-nourish-text">Novo produto</h1>
      </header>

      <form onSubmit={handleSubmit} className="px-4 py-5 space-y-5" style={{ paddingBottom: '100px' }}>
        <PhotoField
          preview={photoPreview}
          onChange={(f, p) => { setPhotoFile(f); setPhotoPreview(p) }}
          labelClass={labelClass}
        />

        <div>
          <label className={labelClass}>Nome *</label>
          <input
            type="text"
            value={name}
            onChange={e => setName(e.target.value)}
            placeholder="ex: Leite, Manteiga…"
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Calorias (por unidade)</label>
          <input
            type="number"
            value={calories}
            onChange={e => setCalories(e.target.value)}
            placeholder="ex: 52"
            min="0"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Quantidade que compras de cada vez</label>
          <input
            type="number"
            value={buyAmount}
            onChange={e => setBuyAmount(e.target.value)}
            min="1"
            className={inputClass}
          />
          <p className="text-xs text-nourish-text-dim mt-1">
            Ex: 6 para água (pack de 6 garrafas), 1 para tudo o resto
          </p>
        </div>

        {error && (
          <p className="text-red-400 text-sm">{error}</p>
        )}

        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="w-full py-3.5 rounded-xl font-semibold text-nourish-on-primary bg-nourish-primary disabled:opacity-40 active:bg-nourish-primary-dim transition-colors"
        >
          {saving ? 'A guardar…' : 'Adicionar produto'}
        </button>
      </form>
    </div>
  )
}
