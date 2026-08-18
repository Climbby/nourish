import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { grocy } from '../../api/grocy'
import { grocyConfig } from '../../config/grocy'
import { IosToggle } from '../../components/IosToggle'
import { Spinner } from '../../components/Spinner'
import { VisitReceiptSheet } from '../../components/VisitReceiptSheet'
import type { Product } from '../../types/grocy'
import { cookingName, getBuyAmountFromDesc } from '../../utils/despensaAnalytics'
import { listKnownGenericos } from '../../utils/genericoSuggestions'
import { GenericoAutocomplete } from '../../components/GenericoAutocomplete'
import { suggestReceiptGenericos } from '../../api/ai'
import { getActiveProfileId, profileScopedKey } from '../../utils/householdProfiles'
import { useProfileScopedKey } from '../../hooks/useProfileScopedKey'
import {
  fetchVisitReceipts,
  linkReceiptToVisit,
  type VisitReceiptLink,
} from '../../utils/visitReceipts'
import { postStorePrices } from '../../utils/storePrices'
import { autoLinkCarToVisit } from '../../utils/autoLinkCar'
import { inferDefaultCarId } from '../../utils/defaultCar'
import { buildReviewLines } from './buildReviewLines'
import { commitReceiptLines, type CommitResult } from './commitReceipt'
import { parseReceipt } from './parsers'
import { extractReceiptVision } from './extractReceiptVision'
import { matchVisitForReceipt } from './matchVisit'
import { resolveReceiptStore } from './resolveReceiptStore'
import { fetchSupermarketVisits, type SupermarketVisit } from '../../api/homelabMetrics'
import { rankProductMatches } from './matchProduct'
import { formatPtDate } from '../../utils/formatPtDate'
import { useReceiptOcr } from './useReceiptOcr'
import { useFuelPrices } from '../../hooks/useFuelPrices'
import { fetchCars } from '../../hooks/useCars'
import { fetchVisitCars } from '../../utils/visitCars'
import { fetchSupermarkets } from '../../utils/supermarkets'
import { useAutoOpenCamera } from '../../utils/useAutoOpenCamera'
import {
  draftLineCount,
  draftTotalEur,
  loadReceiptDrafts,
  newReceiptDraftId,
  removeReceiptDraft,
  upsertReceiptDraft,
  type ReceiptDraft,
  RECEIPT_DRAFTS_LEGACY_KEY,
} from './receiptDrafts'
import type { ReceiptLine, ReceiptStore, ReviewLine } from './types'

const { despensaGroupId: DESPENSA_GROUP_ID } = grocyConfig

type Step = 'capture' | 'ocr' | 'review' | 'done'
type CaptureMode = 'full' | 'products'

const CAPTURE_MODE_LEGACY = 'nourish-receipt-capture-mode'
const RECENT_VISIBLE = 5

type RecentTalão =
  | { kind: 'draft'; draft: ReceiptDraft; sortKey: string }
  | { kind: 'done'; receipt: VisitReceiptLink; sortKey: string }

const inputClass =
  'w-full px-3 py-2 bg-nourish-surface-high border border-nourish-border rounded-lg text-nourish-text text-sm focus:outline-none focus:ring-2 focus:ring-nourish-primary'

/** Compact store/date rows — no focus ring (clipped by overflow-hidden parents on capture). */
const compactFieldClass =
  'w-full px-3 py-2 bg-nourish-surface-high border border-nourish-border rounded-lg text-nourish-text text-sm outline-none focus:outline-none focus:ring-0 focus-visible:outline-none focus-visible:ring-0 [-webkit-tap-highlight-color:transparent]'

/** Controlled number field that keeps an empty string while clearing (avoids `|| 0` snap-back). */
function DraftNumberInput({
  value,
  onValueChange,
  min,
  step,
  className,
}: {
  value: number
  onValueChange: (n: number) => void
  min?: string
  step?: string
  className?: string
}) {
  const [text, setText] = useState(() => String(value))
  const focusedRef = useRef(false)

  useEffect(() => {
    if (!focusedRef.current) setText(String(value))
  }, [value])

  return (
    <input
      type="number"
      min={min}
      step={step}
      value={text}
      className={className}
      onFocus={() => {
        focusedRef.current = true
      }}
      onChange={(e) => {
        const raw = e.target.value
        setText(raw)
        if (raw === '' || raw === '-' || raw === '.') {
          onValueChange(0)
          return
        }
        const n = parseFloat(raw)
        if (Number.isFinite(n)) onValueChange(n)
      }}
      onBlur={() => {
        focusedRef.current = false
        const n = parseFloat(text)
        const next = Number.isFinite(n) ? n : 0
        onValueChange(next)
        setText(String(next))
      }}
    />
  )
}

const STORE_OPTIONS: { value: ReceiptStore; label: string }[] = [
  { value: 'mixed', label: 'Misto / auto' },
  { value: 'continente', label: 'Continente' },
  { value: 'auchan', label: 'Auchan' },
]

const STORE_OPTIONS_MANUAL: { value: ReceiptStore; label: string }[] = [
  { value: 'continente', label: 'Continente' },
  { value: 'auchan', label: 'Auchan' },
  { value: 'mixed', label: 'Outro / misto' },
]

const STORE_LABELS: Record<ReceiptStore, string> = {
  mixed: 'Misto',
  continente: 'Continente',
  auchan: 'Auchan',
}

function zoneLabel(zone?: string): string {
  if (!zone) return 'supermercado'
  const s = zone.replace(/^zone\./, '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

function visitTimeLabel(iso: string): string {
  return new Date(iso).toLocaleString('pt-PT', {
    day: '2-digit',
    month: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  })
}

function loadCaptureMode(key: string): CaptureMode {
  try {
    const raw = localStorage.getItem(key) ?? localStorage.getItem(CAPTURE_MODE_LEGACY)
    return raw === 'products' ? 'products' : 'full'
  } catch {
    return 'full'
  }
}

function saveCaptureMode(key: string, mode: CaptureMode) {
  try {
    localStorage.setItem(key, mode)
  } catch {
    /* ignore */
  }
}

function BackIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path fillRule="evenodd" d="M7.72 12.53a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.31 12l6.97 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5Z" clipRule="evenodd" />
    </svg>
  )
}

function SmallCameraIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
      <path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
      <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 0 1-3 3h-15a3 3 0 0 1-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 0 0 1.11-.71l.822-1.315a2.942 2.942 0 0 1 2.332-1.39ZM6.75 12.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Zm12-1.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
    </svg>
  )
}

function GalleryIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5 shrink-0">
      <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z" clipRule="evenodd" />
    </svg>
  )
}

export function ReceiptScanPage() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const visitEnteredAt = searchParams.get('visit')
  const autoCamera = searchParams.get('camera') === '1'
  const cameraRef = useRef<HTMLInputElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const { recognize, progress, running, error: ocrError } = useReceiptOcr()
  const { priceForCar } = useFuelPrices()
  const captureModeKey = useProfileScopedKey(CAPTURE_MODE_LEGACY)

  const [step, setStep] = useState<Step>('capture')
  const [captureMode, setCaptureMode] = useState<CaptureMode>(() =>
    loadCaptureMode(profileScopedKey(CAPTURE_MODE_LEGACY))
  )
  const [store, setStore] = useState<ReceiptStore>('mixed')
  const [detectedStore, setDetectedStore] = useState<ReceiptStore | null>(null)
  const [useVision, setUseVision] = useState(true)
  const [visitMatchBusy, setVisitMatchBusy] = useState(false)
  const [autoVisit, setAutoVisit] = useState<SupermarketVisit | null>(null)
  const [paramVisit, setParamVisit] = useState<SupermarketVisit | null>(null)
  const [autoLink, setAutoLink] = useState(true)
  const [preview, setPreview] = useState<string | null>(null)
  const [ocrText, setOcrText] = useState('')
  const [products, setProducts] = useState<Product[]>([])
  const [reviewLines, setReviewLines] = useState<ReviewLine[]>([])
  const [committing, setCommitting] = useState(false)
  const [commitResult, setCommitResult] = useState<CommitResult | null>(null)
  const [pricesSavedCount, setPricesSavedCount] = useState(0)
  const [linkedVisit, setLinkedVisit] = useState(false)
  const [rememberAliases, setRememberAliases] = useState(true)
  const [aiGenericoBusy, setAiGenericoBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [purchasedDate, setPurchasedDate] = useState(() =>
    new Date().toISOString().slice(0, 10)
  )
  const [draftId, setDraftId] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<ReceiptDraft[]>(() => loadReceiptDrafts())
  const [completedReceipts, setCompletedReceipts] = useState<VisitReceiptLink[]>([])
  const [viewingReceipt, setViewingReceipt] = useState<VisitReceiptLink | null>(null)
  const [recentExpanded, setRecentExpanded] = useState(false)
  const draftsKey = useProfileScopedKey(RECEIPT_DRAFTS_LEGACY_KEY)
  const draftSaveTimer = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => {
    setCaptureMode(loadCaptureMode(captureModeKey))
  }, [captureModeKey])

  useEffect(() => {
    setDrafts(loadReceiptDrafts(getActiveProfileId()))
  }, [draftsKey])

  useEffect(() => {
    if (!visitEnteredAt) {
      setParamVisit(null)
      return
    }
    let cancelled = false
    void fetchSupermarketVisits(90).then((visits) => {
      if (cancelled || !visits) return
      setParamVisit(visits.find((v) => v.entered_at === visitEnteredAt) ?? null)
    })
    return () => {
      cancelled = true
    }
  }, [visitEnteredAt])

  useEffect(() => {
    grocy
      .getProducts()
      .then((all) => setProducts(all.filter((p) => p.product_group_id === DESPENSA_GROUP_ID)))
      .catch(() => setError('Não foi possível carregar produtos'))
  }, [])

  const knownGenericos = useMemo(() => listKnownGenericos(products), [products])

  const pendingGenericoCount = useMemo(
    () =>
      reviewLines.filter(
        (l) =>
          l.included &&
          l.genericoChoice === 'pending' &&
          (l.nameOrigin === 'ocr' || l.nameOrigin === 'fuzzy' || l.nameOrigin === 'alias')
      ).length,
    [reviewLines]
  )

  const refreshRecent = useCallback(() => {
    setDrafts(loadReceiptDrafts(getActiveProfileId()))
    void fetchVisitReceipts().then((list) => {
      const sorted = [...list].sort((a, b) =>
        (b.linked_at || b.purchased_date).localeCompare(a.linked_at || a.purchased_date)
      )
      setCompletedReceipts(sorted.slice(0, 10))
    })
  }, [])

  useEffect(() => {
    if (step === 'capture') refreshRecent()
  }, [step, refreshRecent])

  const persistDraftNow = useCallback(
    (lines: ReviewLine[], id: string | null) => {
      if (!id || lines.length === 0) return
      upsertReceiptDraft(
        {
          id,
          createdAt: drafts.find((d) => d.id === id)?.createdAt ?? new Date().toISOString(),
          store,
          purchasedDate,
          captureMode,
          reviewLines: lines,
          visitEnteredAt: visitEnteredAt ?? null,
          detectedStore,
        },
        getActiveProfileId()
      )
      setDrafts(loadReceiptDrafts(getActiveProfileId()))
    },
    [drafts, store, purchasedDate, captureMode, visitEnteredAt, detectedStore]
  )

  const scheduleDraftSave = useCallback(
    (lines: ReviewLine[], id: string | null) => {
      if (!id || lines.length === 0) return
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current)
      draftSaveTimer.current = setTimeout(() => persistDraftNow(lines, id), 400)
    },
    [persistDraftNow]
  )

  useEffect(() => {
    return () => {
      if (draftSaveTimer.current) clearTimeout(draftSaveTimer.current)
    }
  }, [])

  useEffect(() => {
    if (step !== 'review' || !draftId || reviewLines.length === 0) return
    scheduleDraftSave(reviewLines, draftId)
    // Only re-save when store/date change; line edits call scheduleDraftSave directly.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- intentional
  }, [store, purchasedDate, draftId, step])

  const revokePreview = useCallback(() => {
    if (preview) URL.revokeObjectURL(preview)
  }, [preview])

  useEffect(() => () => revokePreview(), [revokePreview])

  useAutoOpenCamera(autoCamera, cameraRef, step === 'capture' && !preview)

  const matchVisitInBackground = useCallback(
    async (purchasedAt: string, receiptStore: ReceiptStore | 'other' | null) => {
      setVisitMatchBusy(true)
      try {
        const visits = await fetchSupermarketVisits(21)
        const match = visits ? matchVisitForReceipt(purchasedAt, receiptStore, visits) : null
        setAutoVisit(match)
        setAutoLink(!!match)
      } finally {
        setVisitMatchBusy(false)
      }
    },
    []
  )

  function changeCaptureMode(mode: CaptureMode) {
    setCaptureMode(mode)
    saveCaptureMode(captureModeKey, mode)
    if (mode === 'products' && store === 'mixed') setStore('continente')
  }

  async function handleImage(file: File) {
    if (captureMode === 'products' && store === 'mixed') {
      setError('No modo só produtos, escolhe o supermercado antes de fotografar.')
      return
    }
    revokePreview()
    const url = URL.createObjectURL(file)
    setPreview(url)
    setError(null)
    setStep('ocr')

    try {
      let parsed: ReceiptLine[]
      let visionResult: Awaited<ReturnType<typeof extractReceiptVision>> | null = null
      if (useVision) {
        visionResult = await extractReceiptVision(file)
        parsed = visionResult.lines
        setOcrText(JSON.stringify(visionResult, null, 2))
        if (captureMode === 'full') {
          if (visionResult.store === 'auchan' || visionResult.store === 'continente') {
            setStore(visionResult.store)
            setDetectedStore(visionResult.store)
          } else {
            setDetectedStore(null)
          }
          if (visionResult.purchasedDate) setPurchasedDate(visionResult.purchasedDate)
        } else {
          setDetectedStore(null)
        }
      } else {
        setDetectedStore(null)
        const text = await recognize(url)
        setOcrText(text)
        parsed = parseReceipt(text, store)
      }
      if (parsed.length === 0) {
        setError(
          useVision
            ? 'Não consegui ler linhas. Tenta outra foto (de cima, fundo escuro, boa luz).'
            : 'Nenhuma linha encontrada. Tenta outro ângulo ou escolhe a loja correta.'
        )
        setStep('capture')
        return
      }
      let prodList = products
      if (prodList.length === 0) {
        prodList = (await grocy.getProducts()).filter((p) => p.product_group_id === DESPENSA_GROUP_ID)
        setProducts(prodList)
      }
      const lines = buildReviewLines(parsed, prodList)
      setReviewLines(lines)
      const id = newReceiptDraftId()
      setDraftId(id)
      upsertReceiptDraft(
        {
          id,
          createdAt: new Date().toISOString(),
          store:
            captureMode === 'full' &&
            (visionResult?.store === 'auchan' || visionResult?.store === 'continente')
              ? visionResult.store
              : store,
          purchasedDate:
            captureMode === 'full' && visionResult?.purchasedDate
              ? visionResult.purchasedDate
              : purchasedDate,
          captureMode,
          reviewLines: lines,
          visitEnteredAt: visitEnteredAt ?? null,
          detectedStore:
            captureMode === 'full' &&
            (visionResult?.store === 'auchan' || visionResult?.store === 'continente')
              ? visionResult.store
              : null,
        },
        getActiveProfileId()
      )
      setDrafts(loadReceiptDrafts(getActiveProfileId()))
      setStep('review')
      saveCaptureMode(captureModeKey, captureMode)

      if (captureMode === 'full' && visionResult?.purchasedAt && !visitEnteredAt) {
        void matchVisitInBackground(visionResult.purchasedAt, visionResult.store)
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Falha ao ler o talão')
      setStep('capture')
    }
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (file) handleImage(file)
  }

  function updateLine(id: string, patch: Partial<ReviewLine>) {
    setReviewLines((prev) => {
      const next = prev.map((l) => {
        if (l.id !== id) return l
        const updated = { ...l, ...patch }
        if (patch.productId !== undefined && patch.productId !== l.productId) {
          const p =
            patch.productId != null ? products.find((x) => x.id === patch.productId) : undefined
          if (p) {
            updated.stockAmount = getBuyAmountFromDesc(p.description, p.id)
          }
          if (patch.nameOrigin === undefined) {
            updated.nameOrigin = 'manual'
            updated.genericoChoice = 'keep'
          }
        }
        return updated
      })
      scheduleDraftSave(next, draftId)
      return next
    })
  }

  async function handleSuggestGenericosAi() {
    const targets = reviewLines.filter(
      (l) =>
        l.included &&
        l.genericoChoice === 'pending' &&
        !l.generico.trim() &&
        (l.nameOrigin === 'ocr' || l.nameOrigin === 'fuzzy')
    )
    if (targets.length === 0) return
    setAiGenericoBusy(true)
    try {
      const suggestions = await suggestReceiptGenericos(
        targets.map((l) => ({ id: l.id, name: l.receiptLine.name })),
        knownGenericos
      )
      setReviewLines((prev) => {
        const next = prev.map((l) => {
          const s = suggestions[l.id]
          if (!s) return l
          return { ...l, generico: s, genericoChoice: 'generic' as const }
        })
        scheduleDraftSave(next, draftId)
        return next
      })
    } finally {
      setAiGenericoBusy(false)
    }
  }

  function resumeDraft(draft: ReceiptDraft) {
    setDraftId(draft.id)
    setReviewLines(draft.reviewLines)
    setStore(draft.store)
    setPurchasedDate(draft.purchasedDate)
    setCaptureMode(draft.captureMode)
    setDetectedStore(draft.detectedStore ?? null)
    setOcrText('')
    setPreview(null)
    setError(null)
    setStep('review')
  }

  function deleteDraft(id: string) {
    removeReceiptDraft(id, getActiveProfileId())
    if (draftId === id) setDraftId(null)
    setDrafts(loadReceiptDrafts(getActiveProfileId()))
  }

  async function handleCommit() {
    const included = reviewLines.filter((l) => l.included)
    if (included.length === 0) {
      setError('Seleciona pelo menos um produto para guardar.')
      return
    }
    if (captureMode === 'products' && store === 'mixed') {
      setError('Escolhe o supermercado antes de guardar.')
      return
    }
    setCommitting(true)
    setError(null)
    setPricesSavedCount(0)
    setLinkedVisit(false)
    try {
      const linkVisitEnteredAt = visitEnteredAt ?? (autoLink && autoVisit ? autoVisit.entered_at : null)
      const linkVisitZone =
        (visitEnteredAt ? paramVisit?.zone : null) ??
        (autoLink && autoVisit ? autoVisit.zone : null) ??
        null
      const supers = await fetchSupermarkets()
      const effectiveStore =
        store === 'mixed' && (detectedStore === 'continente' || detectedStore === 'auchan')
          ? detectedStore
          : store
      const resolved = resolveReceiptStore(
        effectiveStore,
        supers?.tracked ?? [],
        linkVisitEnteredAt ? linkVisitZone : null
      )
      const storeId = resolved.store_id
      const storeLabel = resolved.store_label

      const result = await commitReceiptLines(reviewLines, purchasedDate, rememberAliases, {
        storeLabel,
      })

      const productIdByLine = new Map(result.productIds.map((p) => [p.lineId, p.productId]))
      for (const s of result.succeeded) productIdByLine.set(s.lineId, s.productId)
      const priceItems = included
        .map((l) => {
          const productId = productIdByLine.get(l.id) ?? l.productId
          const unitPrice =
            l.receiptLine.unitPrice > 0
              ? l.receiptLine.unitPrice
              : l.price > 0 && l.receiptLine.qty > 0
                ? l.price / l.receiptLine.qty
                : l.price
          const unit: 'kg' | 'un' =
            l.receiptLine.qty > 0 &&
            (l.receiptLine.qty < 1 || !Number.isInteger(l.receiptLine.qty))
              ? 'kg'
              : 'un'
          return {
            product_name: l.productName?.trim() || l.receiptLine.name,
            product_id: productId ?? null,
            unit_price: unitPrice,
            qty: l.receiptLine.qty > 0 ? l.receiptLine.qty : l.stockAmount,
            unit,
          }
        })
        .filter((i) => i.unit_price > 0)

      if (priceItems.length > 0) {
        const posted = await postStorePrices({
          store_id: storeId,
          store_label: storeLabel,
          observed_at: new Date(`${purchasedDate}T12:00:00`).toISOString(),
          source: 'receipt',
          items: priceItems,
        })
        if (!posted) {
          setError(
            `Stock: ${result.succeeded.length} ok` +
              (result.failed.length ? `, ${result.failed.length} falharam` : '') +
              '. Preços não gravados — tenta de novo.'
          )
          setCommitResult(result)
          if (draftId) {
            removeReceiptDraft(draftId, getActiveProfileId())
            setDraftId(null)
            setDrafts(loadReceiptDrafts(getActiveProfileId()))
          }
          setStep('done')
          return
        }
        setPricesSavedCount(priceItems.length)
      }

      if (linkVisitEnteredAt) {
        const totalEur = included.reduce((sum, l) => sum + (l.price > 0 ? l.price : 0), 0)
        const lines = included.map((l) => {
          const productId = productIdByLine.get(l.id) ?? l.productId
          const unitPrice =
            l.receiptLine.unitPrice > 0
              ? l.receiptLine.unitPrice
              : l.price > 0 && l.receiptLine.qty > 0
                ? l.price / l.receiptLine.qty
                : l.price
          const qty = l.receiptLine.qty > 0 ? l.receiptLine.qty : l.stockAmount
          const name = l.receiptLine.name
          const productName = (l.productName || name).trim()
          return {
            name,
            qty,
            unit_price: Math.round(unitPrice * 100) / 100,
            line_total: Math.round((l.price > 0 ? l.price : unitPrice * qty) * 100) / 100,
            product_id: productId ?? null,
            product_name: productName !== name ? productName : null,
          }
        })
        await linkReceiptToVisit({
          visit_entered_at: linkVisitEnteredAt,
          purchased_date: purchasedDate,
          item_count: result.succeeded.length,
          total_eur: Math.round(totalEur * 100) / 100,
          store: effectiveStore,
          linked_at: new Date().toISOString(),
          lines,
        })
        setLinkedVisit(true)
        const cars = await fetchCars()
        const visitCars = await fetchVisitCars()
        const defaultCarId = inferDefaultCarId(cars, visitCars)
        const defaultCar = defaultCarId ? cars.find((c) => c.id === defaultCarId) : undefined
        if (defaultCar) {
          await autoLinkCarToVisit(linkVisitEnteredAt, {
            zone: linkVisitZone ?? undefined,
            cars,
            visitCars,
            fuelPricePerL: priceForCar(defaultCar),
          })
        }
      }
      setCommitResult(result)
      if (draftId) {
        removeReceiptDraft(draftId, getActiveProfileId())
        setDraftId(null)
        setDrafts(loadReceiptDrafts(getActiveProfileId()))
      }
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
    setPricesSavedCount(0)
    setLinkedVisit(false)
    setAutoVisit(null)
    setDetectedStore(null)
    setVisitMatchBusy(false)
    setDraftId(null)
    setStep('capture')
    setError(null)
    refreshRecent()
  }

  const includedCount = reviewLines.filter((l) => l.included).length
  const createCount = reviewLines.filter((l) => l.included && l.productId == null).length
  const reviewStoreLabel =
    STORE_LABELS[
      store === 'mixed' && (detectedStore === 'continente' || detectedStore === 'auchan')
        ? detectedStore
        : store
    ]
  const associatedVisit =
    visitEnteredAt != null
      ? {
          entered_at: visitEnteredAt,
          zone: paramVisit?.zone,
        }
      : null

  const recentTalões: RecentTalão[] = [
    ...drafts.map((draft) => ({
      kind: 'draft' as const,
      draft,
      sortKey: draft.updatedAt || draft.createdAt || draft.purchasedDate,
    })),
    ...completedReceipts.map((receipt) => ({
      kind: 'done' as const,
      receipt,
      sortKey: receipt.linked_at || receipt.purchased_date,
    })),
  ].sort((a, b) => b.sortKey.localeCompare(a.sortKey))
  const visibleRecent = recentExpanded ? recentTalões : recentTalões.slice(0, RECENT_VISIBLE)
  const hasMoreRecent = recentTalões.length > RECENT_VISIBLE

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
        {associatedVisit && step !== 'done' && (
          <div className="text-xs text-nourish-primary bg-nourish-primary/10 border border-nourish-primary/30 rounded-xl px-3 py-2 space-y-0.5">
            <p className="font-semibold">Associado à ida no historial</p>
            <p>
              {zoneLabel(associatedVisit.zone)} · {visitTimeLabel(associatedVisit.entered_at)}
            </p>
          </div>
        )}
        {step === 'capture' && (
          <>
            <div className="flex rounded-xl border border-nourish-border overflow-hidden">
              <button
                type="button"
                onClick={() => changeCaptureMode('full')}
                className={`flex-1 py-2.5 text-sm font-semibold focus:outline-none ${
                  captureMode === 'full'
                    ? 'bg-nourish-primary text-nourish-on-primary'
                    : 'bg-nourish-surface text-nourish-text-dim'
                }`}
              >
                Talão inteiro
              </button>
              <button
                type="button"
                onClick={() => changeCaptureMode('products')}
                className={`flex-1 py-2.5 text-sm font-semibold focus:outline-none ${
                  captureMode === 'products'
                    ? 'bg-nourish-primary text-nourish-on-primary'
                    : 'bg-nourish-surface text-nourish-text-dim'
                }`}
              >
                Só produtos
              </button>
            </div>

            <ul className="text-xs text-nourish-text-dim list-disc pl-4 space-y-0.5">
              <li>Tira a foto a direito, de cima (não de lado).</li>
              <li>Fundo escuro e mate, boa luz, sem sombras nem brilhos.</li>
              <li>Enche o ecrã com o talão e toca para focar.</li>
            </ul>

            <div
              className={`grid transition-[grid-template-rows,opacity,margin] duration-200 ease-out ${
                captureMode === 'products'
                  ? 'grid-rows-[1fr] opacity-100'
                  : 'grid-rows-[0fr] opacity-0 pointer-events-none -mb-4'
              }`}
              aria-hidden={captureMode !== 'products'}
            >
              <div className="overflow-hidden min-h-0">
                <div className="space-y-3">
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-nourish-text-dim shrink-0">Loja *</label>
                    <select
                      value={store}
                      onChange={(e) => setStore(e.target.value as ReceiptStore)}
                      className={compactFieldClass}
                      tabIndex={captureMode === 'products' ? undefined : -1}
                    >
                      {STORE_OPTIONS_MANUAL.map((o) => (
                        <option key={o.value} value={o.value}>
                          {o.label}
                        </option>
                      ))}
                    </select>
                  </div>
                  <div className="flex items-center gap-3">
                    <label className="text-sm text-nourish-text-dim shrink-0">Data</label>
                    <input
                      type="date"
                      value={purchasedDate}
                      onChange={(e) => setPurchasedDate(e.target.value)}
                      className={compactFieldClass}
                      tabIndex={captureMode === 'products' ? undefined : -1}
                    />
                  </div>
                </div>
              </div>
            </div>

            {captureMode === 'full' && !useVision && (
              <div className="flex items-center gap-3 animate-soft-fade">
                <label className="text-sm text-nourish-text-dim shrink-0">Loja</label>
                <select
                  value={store}
                  onChange={(e) => setStore(e.target.value as ReceiptStore)}
                  className={compactFieldClass}
                >
                  {STORE_OPTIONS.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

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

            <div className="flex gap-2">
              <button
                type="button"
                onClick={() => cameraRef.current?.click()}
                disabled={running}
                className="flex-1 min-w-0 py-3 rounded-xl text-sm font-semibold text-nourish-text bg-nourish-surface-high border border-nourish-border active:opacity-80 disabled:opacity-40 inline-flex items-center justify-center gap-2"
              >
                <SmallCameraIcon />
                Foto
              </button>
              <button
                type="button"
                onClick={() => galleryRef.current?.click()}
                disabled={running}
                className="flex-1 min-w-0 py-3 rounded-xl text-sm font-semibold text-nourish-text bg-nourish-surface-high border border-nourish-border active:opacity-80 disabled:opacity-40 inline-flex items-center justify-center gap-2"
              >
                <GalleryIcon />
                Galeria
              </button>
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl bg-nourish-surface-high border border-nourish-border px-3 py-2.5">
              <p className="text-sm font-medium text-nourish-text">Leitura inteligente (recomendado)</p>
              <IosToggle
                checked={useVision}
                onChange={setUseVision}
                label="Leitura inteligente (recomendado)"
              />
            </div>
            {error && <p className="text-red-400 text-sm">{error}</p>}

            {recentTalões.length > 0 && (
              <section className="space-y-2 pt-2">
                <h2 className="text-sm font-semibold text-nourish-text">Talões recentes</h2>
                <ul className="space-y-2">
                  {visibleRecent.map((item) => {
                    if (item.kind === 'draft') {
                      const d = item.draft
                      const n = draftLineCount(d)
                      const total = draftTotalEur(d)
                      const storeLabel = STORE_LABELS[d.store] ?? d.store
                      return (
                        <li key={d.id}>
                          <div className="flex items-stretch gap-2 rounded-xl border border-amber-500/40 bg-nourish-surface px-3 py-2.5">
                            <button
                              type="button"
                              onClick={() => resumeDraft(d)}
                              className="flex-1 min-w-0 text-left focus:outline-none focus:ring-2 focus:ring-nourish-primary rounded-lg"
                            >
                              <div className="flex items-center justify-between gap-2">
                                <span className="text-xs text-nourish-text-dim truncate">
                                  {storeLabel} · {d.purchasedDate}
                                </span>
                                <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-amber-500/15 text-amber-400">
                                  Incompleto
                                </span>
                              </div>
                              <p className="text-sm text-nourish-text mt-1 tabular-nums">
                                {n} produto{n !== 1 ? 's' : ''}
                                {total > 0 ? ` · €${total.toFixed(2)}` : ''}
                              </p>
                            </button>
                            <button
                              type="button"
                              onClick={() => deleteDraft(d.id)}
                              className="shrink-0 px-2 text-xs text-nourish-text-dim hover:text-red-400 focus:outline-none"
                              aria-label="Apagar rascunho"
                            >
                              Apagar
                            </button>
                          </div>
                        </li>
                      )
                    }
                    const r = item.receipt
                    const storeLabel =
                      r.store && STORE_LABELS[r.store] ? STORE_LABELS[r.store] : r.store ?? 'Loja'
                    return (
                      <li key={`done-${r.visit_entered_at}`}>
                        <button
                          type="button"
                          onClick={() => setViewingReceipt(r)}
                          className="w-full text-left rounded-xl border border-nourish-border bg-nourish-surface px-3 py-2.5 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                        >
                          <div className="flex items-center justify-between gap-2">
                            <span className="text-xs text-nourish-text-dim truncate">
                              {storeLabel} · {formatPtDate(r.purchased_date)}
                            </span>
                            <span className="shrink-0 text-[10px] font-semibold uppercase tracking-wide px-2 py-0.5 rounded bg-nourish-primary/15 text-nourish-primary">
                              Completo
                            </span>
                          </div>
                          <p className="text-sm text-nourish-text mt-1 tabular-nums">
                            {r.item_count} produto{r.item_count !== 1 ? 's' : ''}
                            {r.total_eur > 0 ? ` · €${r.total_eur.toFixed(2)}` : ''}
                          </p>
                        </button>
                      </li>
                    )
                  })}
                </ul>
                {hasMoreRecent && (
                  <button
                    type="button"
                    onClick={() => setRecentExpanded((v) => !v)}
                    className="w-full py-2 text-sm font-medium text-nourish-primary focus:outline-none focus:ring-2 focus:ring-nourish-primary rounded-lg"
                  >
                    {recentExpanded ? 'Ver menos' : 'Ver mais'}
                  </button>
                )}
              </section>
            )}
          </>
        )}

        {viewingReceipt && (
          <VisitReceiptSheet
            receipt={viewingReceipt}
            onClose={() => setViewingReceipt(null)}
            onReplace={() => {
              const visit = viewingReceipt.visit_entered_at
              setViewingReceipt(null)
              navigate(`/receipt?visit=${encodeURIComponent(visit)}`)
            }}
          />
        )}

        {step === 'ocr' && (
          <div className="flex flex-col items-center gap-4 pt-8">
            <Spinner />
            <p className="text-sm text-nourish-text-dim text-center">
              {useVision
                ? 'A analisar o talão com IA… pode demorar até um minuto.'
                : `A ler talão… ${progress}%`}
            </p>
            {(ocrError || error) && (
              <p className="text-red-400 text-sm text-center">{ocrError ?? error}</p>
            )}
          </div>
        )}

        {step === 'review' && (
          <>
            <div className="rounded-xl border border-nourish-primary/30 bg-nourish-primary/10 px-3 py-2.5">
              <p className="text-sm font-semibold text-nourish-text">
                Extraído · {reviewStoreLabel} · {reviewLines.length} produto
                {reviewLines.length !== 1 ? 's' : ''}
              </p>
              {detectedStore && captureMode === 'full' && (
                <p className="text-xs text-nourish-text-dim mt-0.5">
                  Loja detectada: {STORE_LABELS[detectedStore]}
                </p>
              )}
            </div>

            {(captureMode === 'products' || !detectedStore) && (
              <div>
                <label className="block text-sm font-medium text-nourish-text-dim mb-1.5">Loja</label>
                <select
                  value={store}
                  onChange={(e) => setStore(e.target.value as ReceiptStore)}
                  className={compactFieldClass}
                >
                  {STORE_OPTIONS_MANUAL.map((o) => (
                    <option key={o.value} value={o.value}>
                      {o.label}
                    </option>
                  ))}
                </select>
              </div>
            )}

            {!visitEnteredAt && visitMatchBusy && (
              <p className="text-xs text-nourish-text-dim">A procurar ida no historial…</p>
            )}

            {!visitEnteredAt && !visitMatchBusy && !autoVisit && (
              <p className="text-xs text-nourish-text-dim leading-snug rounded-xl border border-nourish-border bg-nourish-surface px-3 py-2">
                Sem ida no historial — os preços gravam-se na mesma no catálogo por loja. O stock na
                Despensa também tenta actualizar-se.
              </p>
            )}

            {!visitEnteredAt && autoVisit && (
              <label className="flex items-center gap-2 text-sm text-nourish-text rounded-xl bg-nourish-primary/10 border border-nourish-primary/30 px-3 py-2">
                <input
                  type="checkbox"
                  checked={autoLink}
                  onChange={(e) => setAutoLink(e.target.checked)}
                  className="rounded border-nourish-border"
                />
                <span>
                  Associar à ida (opcional): {zoneLabel(autoVisit.zone)} ·{' '}
                  {visitTimeLabel(autoVisit.entered_at)}
                </span>
              </label>
            )}

            <div className="flex items-center gap-3">
              <label className="text-sm text-nourish-text-dim shrink-0">Data</label>
              <input
                type="date"
                value={purchasedDate}
                onChange={(e) => setPurchasedDate(e.target.value)}
                className={compactFieldClass}
              />
            </div>

            <div className="flex items-center justify-between gap-3 rounded-xl bg-nourish-surface-high border border-nourish-border px-3 py-2.5">
              <div className="min-w-0">
                <p className="text-sm font-medium text-nourish-text">Lembrar associação de produtos</p>
                <p className="text-xs text-nourish-text-dim leading-snug mt-0.5">
                  Liga o nome do talão ao produto da Despensa nos próximos talões.
                </p>
              </div>
              <IosToggle
                checked={rememberAliases}
                onChange={setRememberAliases}
                label="Lembrar associação de produtos"
              />
            </div>

            <p className="text-xs text-nourish-text-dim">
              {includedCount} de {reviewLines.length} linhas incluídas
              {pendingGenericoCount > 0 && (
                <span className="text-amber-700/90">
                  {' '}
                  · {pendingGenericoCount} com nome automático
                </span>
              )}
            </p>

            {pendingGenericoCount > 0 && (
              <button
                type="button"
                onClick={() => void handleSuggestGenericosAi()}
                disabled={aiGenericoBusy}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border border-nourish-border text-nourish-text disabled:opacity-40"
              >
                {aiGenericoBusy ? 'A sugerir genéricos…' : 'Sugerir nomes genéricos (IA)'}
              </button>
            )}

            <div className="space-y-3">
              {reviewLines.map((line) => {
                const matches = rankProductMatches(line.receiptLine.name, products)
                const isNewProduct = line.productId == null
                const creating = isNewProduct && line.included
                const autoSelected =
                  line.nameOrigin === 'ocr' ||
                  line.nameOrigin === 'fuzzy' ||
                  line.nameOrigin === 'alias'
                const originLabel =
                  line.nameOrigin === 'fuzzy'
                    ? 'Correspondência automática'
                    : line.nameOrigin === 'alias'
                      ? 'Associado guardado'
                      : line.nameOrigin === 'ocr'
                        ? 'Nome do talão'
                        : null
                const needsResolve = autoSelected && line.genericoChoice === 'pending'
                const showGenericoField =
                  line.genericoChoice === 'generic' ||
                  (creating && Boolean(line.generico.trim()))

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
                        <div className="flex flex-wrap items-center gap-1.5">
                          <p className="text-xs text-nourish-text-dim truncate min-w-0">
                            {line.receiptLine.name}
                          </p>
                          {originLabel && (
                            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-amber-500/15 text-amber-700 border border-amber-500/30">
                              {originLabel}
                            </span>
                          )}
                          {line.genericoChoice === 'keep' && autoSelected && (
                            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-nourish-surface-high text-nourish-text-dim border border-nourish-border">
                              Mantido
                            </span>
                          )}
                          {line.genericoChoice === 'generic' && line.generico.trim() && (
                            <span className="shrink-0 text-[10px] font-medium px-1.5 py-0.5 rounded-md bg-nourish-primary/15 text-nourish-primary border border-nourish-primary/30">
                              Genérico: {line.generico.trim()}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-nourish-text-dim tabular-nums">
                          €{line.receiptLine.lineTotal.toFixed(2)}
                          {line.receiptLine.qty !== 1 &&
                            ` · ${line.receiptLine.qty} × €${line.receiptLine.unitPrice.toFixed(2)}`}
                          {creating && ' · novo'}
                        </p>
                      </div>
                    </div>

                    {needsResolve && (
                      <div className="rounded-xl bg-nourish-surface-high/80 border border-nourish-border p-2.5 space-y-2">
                        <p className="text-[11px] text-nourish-text-dim leading-snug">
                          Nome veio do talão. Mantém o SKU ou define um nome genérico (família) para
                          agrupar na Despensa.
                        </p>
                        <div className="grid grid-cols-2 gap-2">
                          <button
                            type="button"
                            onClick={() =>
                              updateLine(line.id, { genericoChoice: 'keep', generico: '' })
                            }
                            className="py-2 rounded-lg text-xs font-semibold border border-nourish-border text-nourish-text"
                          >
                            Manter como está
                          </button>
                          <button
                            type="button"
                            onClick={() =>
                              updateLine(line.id, {
                                genericoChoice: 'generic',
                                generico: line.generico || '',
                              })
                            }
                            className="py-2 rounded-lg text-xs font-semibold bg-nourish-primary/15 text-nourish-primary border border-nourish-primary/40"
                          >
                            Definir genérico
                          </button>
                        </div>
                      </div>
                    )}

                    {creating && (
                      <div>
                        <label className="text-xs text-nourish-text-dim">
                          Nome da variante (SKU)
                        </label>
                        <input
                          type="text"
                          value={line.productName}
                          onChange={(e) =>
                            updateLine(line.id, {
                              productName: e.target.value,
                              nameOrigin: 'manual',
                            })
                          }
                          className={inputClass}
                          placeholder="Nome como no talão"
                        />
                      </div>
                    )}

                    {showGenericoField && (
                      <div>
                        <label className="text-xs text-nourish-text-dim">
                          Nome genérico (família)
                        </label>
                        <GenericoAutocomplete
                          value={line.generico}
                          known={knownGenericos}
                          onChange={(v) =>
                            updateLine(line.id, {
                              generico: v,
                              genericoChoice: v.trim() ? 'generic' : line.genericoChoice,
                            })
                          }
                        />
                      </div>
                    )}

                    <select
                      value={line.productId ?? ''}
                      onChange={(e) => {
                        const v = e.target.value
                        updateLine(line.id, {
                          productId: v ? parseInt(v, 10) : null,
                          included: true,
                          nameOrigin: 'manual',
                          genericoChoice: 'keep',
                        })
                      }}
                      className={inputClass}
                    >
                      <option value="">Criar entrada nova…</option>
                      {matches.map((m) => {
                        const p = products.find((x) => x.id === m.productId)!
                        const label = cookingName(p.name, p.description)
                        return (
                          <option key={m.productId} value={m.productId}>
                            {label}
                            {label !== p.name ? ` · ${p.name}` : ''} ({Math.round(m.score * 100)}%)
                          </option>
                        )
                      })}
                      {products
                        .filter((p) => !matches.some((m) => m.productId === p.id))
                        .map((p) => {
                          const label = cookingName(p.name, p.description)
                          return (
                            <option key={p.id} value={p.id}>
                              {label}
                              {label !== p.name ? ` · ${p.name}` : ''}
                            </option>
                          )
                        })}
                    </select>
                    <p className="text-[11px] text-nourish-text-dim leading-snug">
                      {isNewProduct
                        ? 'Cria uma variante com o nome do talão; o genérico agrupa na Despensa.'
                        : 'Stock e preço somam a esta variante — mesmo se o talão tiver outro nome.'}
                    </p>

                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-xs text-nourish-text-dim">Stock (+)</label>
                        <DraftNumberInput
                          min="0.01"
                          step="0.01"
                          value={line.stockAmount}
                          onValueChange={(n) => updateLine(line.id, { stockAmount: n })}
                          className={inputClass}
                        />
                      </div>
                      <div>
                        <label className="text-xs text-nourish-text-dim">Preço (€)</label>
                        <DraftNumberInput
                          min="0"
                          step="0.01"
                          value={line.price}
                          onValueChange={(n) => updateLine(line.id, { price: n })}
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
              {committing
                ? 'A guardar…'
                : createCount > 0
                  ? `Guardar ${includedCount} (criar ${createCount} + preços)`
                  : `Guardar ${includedCount} (stock + preços)`}
            </button>
          </>
        )}

        {step === 'done' && commitResult && (
          <div className="space-y-4 text-center">
            <p className="text-lg font-semibold text-nourish-text">
              {commitResult.succeeded.length} no stock
              {commitResult.succeeded.some((s) => s.created)
                ? ` · ${commitResult.succeeded.filter((s) => s.created).length} novos`
                : ''}
              {pricesSavedCount > 0 ? ` · ${pricesSavedCount} preços` : ''}
            </p>
            {!linkedVisit && !visitEnteredAt && (
              <p className="text-xs text-nourish-text-dim leading-snug">
                Sem ida associada — preços no catálogo por loja na mesma.
              </p>
            )}
            {linkedVisit && (
              <p className="text-xs text-nourish-primary leading-snug">Ida do historial associada.</p>
            )}
            {error && <p className="text-red-400 text-sm text-left">{error}</p>}
            {commitResult.failed.length > 0 && (
              <div className="text-left p-3 bg-red-900/30 border border-red-800 rounded-xl text-sm text-red-400">
                <p className="font-semibold mb-1">Stock falhou em {commitResult.failed.length}:</p>
                <ul className="list-disc pl-4 space-y-1">
                  {commitResult.failed.map((f) => (
                    <li key={f.lineId}>{f.error}</li>
                  ))}
                </ul>
                {pricesSavedCount > 0 && (
                  <p className="mt-2 text-nourish-text-dim text-xs">
                    Os preços dessas linhas foram gravados na mesma.
                  </p>
                )}
              </div>
            )}
            {visitEnteredAt && (
              <button
                type="button"
                onClick={() => navigate('/history?tab=supermarket')}
                className="w-full py-3.5 rounded-xl font-semibold text-nourish-text bg-nourish-surface-high border border-nourish-border"
              >
                Voltar ao historial
              </button>
            )}
            <button
              type="button"
              onClick={() => navigate('/meals?filter=despensa')}
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
