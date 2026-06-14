import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { grocy } from '../../api/grocy'
import { grocyConfig } from '../../config/grocy'
import { Spinner } from '../../components/Spinner'
import type { Product } from '../../types/grocy'
import { getBuyAmountFromDesc } from '../../utils/despensaAnalytics'
import { linkReceiptToVisit } from '../../utils/visitReceipts'
import { buildReviewLines } from './buildReviewLines'
import { commitReceiptLines, type CommitResult } from './commitReceipt'
import { parseReceipt } from './parsers'
import { rankProductMatches } from './matchProduct'
import { useReceiptOcr } from './useReceiptOcr'
import type { ReceiptStore, ReviewLine } from './types'

const { despensaGroupId: DESPENSA_GROUP_ID } = grocyConfig

type Step = 'capture' | 'ocr' | 'review' | 'done'

const inputClass =
  'w-full px-3 py-2 bg-nourish-surface-high border border-nourish-border rounded-lg text-nourish-text text-sm focus:outline-none focus:ring-2 focus:ring-nourish-primary'

const STORE_OPTIONS: { value: ReceiptStore; label: string }[] = [
  { value: 'mixed', label: 'Misto / auto' },
  { value: 'continente', label: 'Continente' },
  { value: 'auchan', label: 'Auchan' },
]

function BackIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.31 12l6.97 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5Z" clipRule="evenodd" />
    </svg>
  )
}

export function ReceiptScanPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const visitEnteredAt = searchParams.get('visit')
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const { recognize, progress, running, error: ocrError } = useReceiptOcr()

  const [step, setStep] = useState<Step>('capture')
  const [store, setStore] = useState<ReceiptStore>('mixed')
  const [preview, setPreview] = useState<string | null>(null)
  const [ocrText, setOcrText] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [reviewLines, setReviewLines] = useState<ReviewLine[]>([])
  const [committing, setCommitting] = useState(false)
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null)
  const [rememberAliases, setRememberAliases] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [purchasedDate, setPurchasedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )

  useEffect(() => {
    grocy
      .getProducts()
      .then((all) => setProducts(all.filter((p) => p.product_group_id === DESPENSA_GROUP_ID)))
      .catch(() => setError('Não foi possível carregar produtos'))
  }, [])

  const revokePreview = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  useEffect(() => () => revokePreview(), [revokePreview])

  async function handleImage(file: File) {
    revokePreview()
    const url = URL.createObjectURL(file)
    setPreview(url)
    setError(null)
    setStep('ocr')

    try {
      const text = await recognize(url)
      setOcrText(text)
      const parsed = parseReceipt(text, store)
      if (parsed.length === 0) {
        setError('Nenhuma linha encontrada. Tenta outro ângulo ou escolhe a loja correta.')
        setStep('capture')
        return
      }
      let prodList = products
      if (prodList.length === 0) {
        prodList = (await grocy.getProducts()).filter((p) => p.product_group_id === DESPENSA_GROUP_ID)
        setProducts(prodList)
      }
      setReviewLines(buildReviewLines(parsed, prodList))
      setStep('review')
    } catch {
      setStep('capture')
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) handleImage(file)
  }

  function updateLine(id: string, patch: Partial<ReviewLine>) {
    setReviewLines((prev) =>
      prev.map((l) => {
        if (l.id !== id) return l
        const next = { ...l, ...patch }
        if (patch.productId != null && patch.productId !== l.productId) {
          const p = products.find((x) => x.id === patch.productId)
          if (p) {
            next.stockAmount = getBuyAmountFromDesc(p.description, p.id)
          }
        }
        return next
      })
    )
  }

  async function handleCommit() {
    const included = reviewLines.filter((l) => l.included && l.productId != null)
    if (included.length === 0) {
      setError('Seleciona pelo menos um produto para adicionar ao stock.')
      return
    }
    setCommitting(true)
    setError(null)
    try {
      const result = await commitReceiptLines(reviewLines, purchasedDate, rememberAliases)
      if (visitEnteredAt) {
        const included = reviewLines.filter((l) => l.included && l.productId != null)
        const totalEur = included.reduce((sum, l) => sum + (l.price > 0 ? l.price : 0), 0)
        await linkReceiptToVisit({
          visit_entered_at: visitEnteredAt,
          purchased_date: purchasedDate,
          item_count: result.succeeded.length,
          total_eur: Math.round(totalEur * 100) / 100,
          store,
          linked_at: new Date().toISOString(),
        })
      }
      setCommitResult(result)
      setStep('done')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro ao guardar')
    } finally {
      setCommitting(false)
    }
  }

  function resetFlow() {
    revokePreview()
    setPreview(null)
    setOcrText('')
    setReviewLines([])
    setCommitResult(null)
    setStep('capture')
    setError(null)
  }

  const includedCount = reviewLines.filter((l) => l.included && l.productId).length

  return (
    <div className="min-h-screen bg-nourish-bg" style={{ paddingBottom: '100px' }}>
      <header className="flex items-center gap-3 px-4 pt-12 pb-4 border-b border-nourish-border">
        <button
          type="button"
          onClick={() => (step === 'review' ? setStep('capture') : navigate(-1))}
          className="p-2 -ml-2 text-nourish-text-dim rounded-lg focus:outline-none focus:ring-2 focus:ring-nourish-primary"
        >
          <BackIcon />
        </button>
        <h1 className="text-lg font-bold text-nourish-text flex-1 truncate">
          {step === 'review' ? 'Rever compra' : visitEnteredAt ? 'Talão da ida' : 'Talão'}
        </h1>
      </header>

      <div className="px-4 py-5 space-y-4">
        {visitEnteredAt && step !== 'done' && (
          <p className="text-xs text-nourish-primary bg-nourish-primary/10 border border-nourish-primary/30 rounded-xl px-3 py-2">
            Este talão será associado à ida ao supermercado no historial.
          </p>
        )}
        {step === 'capture' && (
          <>
            <p className="text-sm text-nourish-text-dim">
              Fotografa o talão. O texto é lido no telemóvel — a imagem não sai do dispositivo.
              Na primeira vez pode descarregar dados de idioma português.
            </p>

            <div>
              <label className="block text-sm font-medium text-nourish-text-dim mb-1.5">Loja</label>
              <select
                value={store}
                onChange={(e) => setStore(e.target.value as ReceiptStore)}
                className={inputClass}
              >
                {STORE_OPTIONS.map((o) => (
                  <option key={o.value} value={o.value}>
                    {o.label}
                  </option>
                ))}
              </select>
            </div>

            {preview && (
              <img src={preview} alt="Pré-visualização do talão" className="w-full rounded-xl border border-nourish-border" />
            )}

            <input
              ref={cameraRef}
              type="file"
              accept="image/*"
              capture="environment"
              className="hidden"
              onChange={handleFileChange}
            />
            <input
              ref={galleryRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handleFileChange}
            />

            <button
              type="button"
              onClick={() => cameraRef.current?.click()}
              disabled={running}
              className="w-full py-3.5 rounded-xl font-semibold text-nourish-on-primary bg-nourish-primary active:bg-nourish-primary-dim disabled:opacity-40"
            >
              Tirar foto
            </button>
            <button
              type="button"
              onClick={() => galleryRef.current?.click()}
              disabled={running}
              className="w-full py-3 rounded-xl font-semibold text-nourish-text bg-nourish-surface-high border border-nourish-border active:opacity-80 disabled:opacity-40"
            >
              Escolher da galeria
            </button>
          </>
        )}

        {step === 'ocr' && (
          <div className="flex flex-col items-center gap-4 pt-8">
            <Spinner />
            <p className="text-sm text-nourish-text-dim">A ler talão… {progress}%</p>
            {(ocrError || error) && (
              <p className="text-red-400 text-sm text-center">{ocrError ?? error}</p>
            )}
          </div>
        )}

        {step === 'review' && (
          <>
            <div className="flex items-center gap-3">
              <label className="text-sm text-nourish-text-dim shrink-0">Data</label>
              <input
                type="date"
                value={purchasedDate}
                onChange={(e) => setPurchasedDate(e.target.value)}
                className={inputClass}
              />
            </div>

            <label className="flex items-center gap-2 text-sm text-nourish-text-dim">
              <input
                type="checkbox"
                checked={rememberAliases}
                onChange={(e) => setRememberAliases(e.target.checked)}
                className="rounded border-nourish-border"
              />
              Lembrar associações para próximos talões
            </label>

            <p className="text-xs text-nourish-text-dim">
              {includedCount} de {reviewLines.length} linhas incluídas
            </p>

            <div className="space-y-3">
              {reviewLines.map((line) => {
                const matches = rankProductMatches(line.receiptLine.name, products)
                return (
                  <div
                    key={line.id}
                    className={`rounded-2xl border p-3 space-y-2 ${
                      line.included
                        ? 'border-nourish-primary/40 bg-nourish-surface'
                        : 'border-nourish-border bg-nourish-surface opacity-70'
                    }`}
                  >
                    <div className="flex items-start gap-2">
                      <input
                        type="checkbox"
                        checked={line.included}
                        onChange={(e) => updateLine(line.id, { included: e.target.checked })}
                        className="mt-1 rounded border-nourish-border"
                      />
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-nourish-text leading-snug">
                          {line.receiptLine.name}
                        </p>
                        <p className="text-xs text-nourish-text-dim tabular-nums">
                          €{line.receiptLine.lineTotal.toFixed(2)}
                          {line.receiptLine.qty !== 1 && ` · qty ${line.receiptLine.qty}`}
                        </p>
                      </div>
                    </div>

                    <select
                      value={line.productId ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        updateLine(line.id, {
                          productId: v ? parseInt(v, 10) : null,
                          included: !!v,
                        })
                      }}
                      className={inputClass}
                    >
                      <option value="">— Escolher produto —</option>
                      {matches.map((m) => {
                        const p = products.find((x) => x.id === m.productId)!
                        return (
                          <option key={m.productId} value={m.productId}>
                            {p.name} ({Math.round(m.score * 100)}%)
                          </option>
                        )
                      })}
                      {products
                        .filter((p) => !matches.some((m) => m.productId === p.id))
                        .map((p) => (
                          <option key={p.id} value={p.id}>
                            {p.name}
                          </option>
                        ))}
                    </select>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-nourish-text-dim">Stock (+)</label>
                        <input
                          type="number"
                          min="0.01"
                          step="0.01"
                          value={line.stockAmount}
                          onChange={(e) =>
                            updateLine(line.id, { stockAmount: parseFloat(e.target.value) || 0 })
                          }
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-nourish-text-dim">Preço (€)</label>
                        <input
                          type="number"
                          min="0"
                          step="0.01"
                          value={line.price}
                          onChange={(e) =>
                            updateLine(line.id, { price: parseFloat(e.target.value) || 0 })
                          }
                          className={inputClass}
                        />
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>

            {reviewLines.length === 0 && (
              <p className="text-sm text-nourish-text-dim text-center">
                Sem linhas.{' '}
                <button type="button" className="text-nourish-primary underline" onClick={resetFlow}>
                  Tentar outra foto
                </button>
              </p>
            )}

            <details className="text-xs text-nourish-text-dim">
              <summary className="cursor-pointer">Texto OCR (debug)</summary>
              <pre className="mt-2 whitespace-pre-wrap break-words bg-nourish-surface-high p-2 rounded-lg max-h-40 overflow-auto">
                {ocrText}
              </pre>
            </details>

            {error && <p className="text-red-400 text-sm">{error}</p>}

            <button
              type="button"
              onClick={handleCommit}
              disabled={committing || includedCount === 0}
              className="w-full py-3.5 rounded-xl font-semibold text-nourish-on-primary bg-nourish-primary disabled:opacity-40"
            >
              {committing ? 'A guardar…' : `Adicionar ${includedCount} ao stock`}
            </button>
          </>
        )}

        {step === 'done' && commitResult && (
          <div className="space-y-4 text-center">
            <p className="text-lg font-semibold text-nourish-text">
              {commitResult.succeeded.length} produto(s) adicionado(s)
            </p>
            {commitResult.failed.length > 0 && (
              <div className="text-left p-3 bg-red-900/30 border border-red-800 rounded-xl text-sm text-red-400">
                <p className="font-semibold mb-1">Falharam {commitResult.failed.length}:</p>
                <ul className="list-disc pl-4 space-y-1">
                  {commitResult.failed.map((f) => (
                    <li key={f.lineId}>{f.error}</li>
                  ))}
                </ul>
              </div>
            )}
            {visitEnteredAt && (
              <button
                type="button"
                onClick={() => navigate('/history', { state: { tab: 'supermarket' } })}
                className="w-full py-3.5 rounded-xl font-semibold text-nourish-text bg-nourish-surface-high border border-nourish-border"
              >
                Voltar ao historial
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/?filter=despensa')}
              className="w-full py-3.5 rounded-xl font-semibold text-nourish-on-primary bg-nourish-primary"
            >
              Ver Despensa
            </button>
            <button
              type="button"
              onClick={resetFlow}
              className="w-full py-3 text-nourish-text-dim text-sm"
            >
              Escanear outro talão
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
