import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { grocy } from '../api/grocy'
import { grocyConfig } from '../config/grocy'
import { PhotoField } from '../components/PhotoField'
import { buildDespensaDescription, inferUnitGramsFromName } from '../utils/despensaAnalytics'
import type { NavigationFeedbackState } from '../utils/navigationFeedback'
import type { VerifiedField } from '../utils/verification'
import { VerifyCheckbox } from '../components/VerifiedBadge'

const { despensaGroupId: DESPENSA_GROUP_ID, defaultLocationId: DEFAULT_LOCATION_ID, defaultQuId: DEFAULT_QU_ID } = grocyConfig

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
  const [searchParams] = useSearchParams()
  const prefillGenerico = searchParams.get('generico')?.trim() || ''

  const [name, setName] = useState('')
  const [nomeCurto, setNomeCurto] = useState(prefillGenerico)
  const [generico, setGenerico] = useState(prefillGenerico)
  const [buyAmount, setBuyAmount] = useState('1')
  const [unitPrice, setUnitPrice] = useState('')
  const [unitGrams, setUnitGrams] = useState('')
  const [unitGramsTouched, setUnitGramsTouched] = useState(false)
  const [verifyPrice, setVerifyPrice] = useState(false)
  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const isVariant = Boolean(prefillGenerico)

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
        qu_id_purchase: DEFAULT_QU_ID,
        qu_id_stock: DEFAULT_QU_ID,
        qu_id_consume: DEFAULT_QU_ID,
        qu_id_price: DEFAULT_QU_ID,
        calories: null,
        active: 1,
        quick_consume_amount: 1,
        default_best_before_days: 0,
        description: buildDespensaDescription(buyAmount || '1', unitPrice, {
          verified: (() => {
            const v = new Set<VerifiedField>()
            if (verifyPrice && unitPrice.trim() && parseFloat(unitPrice) > 0) v.add('preco')
            return v
          })(),
          nomeCurto: nomeCurto || generico || null,
          generico: generico || null,
          unitGrams: unitGrams || inferUnitGramsFromName(name) || null,
        }),
      })

      if (photoFile) {
        const filename = await grocy.uploadProductPicture(photoFile, result.created_object_id)
        await grocy.updateProduct(result.created_object_id, { picture_file_name: filename })
      }

      navigate('/meals?filter=despensa', {
        replace: true,
        state: {
          feedback: {
            kind: 'success',
            message: isVariant ? 'Variante guardada.' : 'Produto guardado com sucesso.',
          },
        } satisfies NavigationFeedbackState,
      })
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
        <h1 className="text-lg font-bold text-nourish-text">
          {isVariant ? 'Nova variante' : 'Novo produto'}
        </h1>
      </header>

      <form onSubmit={handleSubmit} className="px-4 py-5 space-y-5" style={{ paddingBottom: '100px' }}>
        <PhotoField
          preview={photoPreview}
          onChange={(f, p) => {
            setPhotoFile(f)
            setPhotoPreview(p)
          }}
          labelClass={labelClass}
        />

        <div>
          <label className={labelClass}>Nome da variante *</label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              const next = e.target.value
              setName(next)
              if (!unitGramsTouched) {
                const inferred = inferUnitGramsFromName(next)
                setUnitGrams(inferred != null ? String(inferred) : '')
              }
            }}
            placeholder="ex: Cogumelos laminados Continente 250g"
            required
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>
            Nome genérico <span className="text-nourish-border font-normal">(família)</span>
          </label>
          <input
            type="text"
            value={generico}
            onChange={(e) => setGenerico(e.target.value)}
            placeholder="ex: Cogumelos"
            className={inputClass}
          />
          <p className="text-xs text-nourish-text-dim mt-1">
            Agrupa variantes na Despensa (vários packs, um nome)
          </p>
        </div>

        <div>
          <label className={labelClass}>
            Nome curto <span className="text-nourish-border font-normal">(cozinhar)</span>
          </label>
          <input
            type="text"
            value={nomeCurto}
            onChange={(e) => setNomeCurto(e.target.value)}
            placeholder="ex: Cogumelos"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>Preço (por unidade, €)</label>
          <input
            type="number"
            value={unitPrice}
            onChange={(e) => {
              setUnitPrice(e.target.value)
              setVerifyPrice(false)
            }}
            placeholder="ex: 1.29"
            min="0"
            step="0.01"
            className={inputClass}
          />
          <div className="mt-1.5">
            <VerifyCheckbox
              id="add-verify-price"
              checked={verifyPrice}
              onChange={setVerifyPrice}
              label="Preço verificado"
              disabled={!unitPrice.trim() || parseFloat(unitPrice) <= 0}
            />
          </div>
        </div>

        <div>
          <label className={labelClass}>Quantidade que compras de cada vez</label>
          <input
            type="number"
            value={buyAmount}
            onChange={(e) => setBuyAmount(e.target.value)}
            min="1"
            className={inputClass}
          />
        </div>

        <div>
          <label className={labelClass}>
            Gramas por unidade <span className="text-nourish-border font-normal">(opcional)</span>
          </label>
          <input
            type="number"
            value={unitGrams}
            onChange={(e) => {
              setUnitGramsTouched(true)
              setUnitGrams(e.target.value)
            }}
            placeholder="ex: 120"
            min="0"
            step="1"
            className={inputClass}
          />
        </div>

        {error && <p className="text-red-400 text-sm">{error}</p>}

        <button
          type="submit"
          disabled={saving || !name.trim()}
          className="w-full py-3.5 rounded-xl font-semibold text-nourish-on-primary bg-nourish-primary disabled:opacity-40 active:bg-nourish-primary-dim transition-colors"
        >
          {saving ? 'A guardar…' : isVariant ? 'Adicionar variante' : 'Adicionar produto'}
        </button>
      </form>
    </div>
  )
}
