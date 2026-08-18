import { useCallback, useEffect, useState } from 'react'
import { extractShoppingNamesFromTranscript } from '../api/ai'
import { grocy } from '../api/grocy'
import { loadReceiptIgnoreList } from '../features/receipt/receiptIgnore'
import { usePortugueseSpeech } from '../hooks/usePortugueseSpeech'
import type { Product, ShoppingListItem } from '../types/grocy'
import { loadGenericoFavorites } from '../utils/genericoFavorites'
import { parseShoppingVoice } from '../utils/parseShoppingVoice'
import { resolveHeardShoppingNames } from '../utils/parseShoppingVoice'
import {
  alreadyOnShoppingList,
  classifyHeardShoppingNames,
  dismissHeardKey,
  isLinkedShoppingProductId,
  shoppingItemLabel,
  voiceShoppingKeeps,
} from '../utils/voiceShopping'
import { Spinner } from './Spinner'

export function CartIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h15l-1.5 9h-12L6 6Z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6 5 3H2" />
      <circle cx="9" cy="20" r="1" />
      <circle cx="18" cy="20" r="1" />
    </svg>
  )
}

function MicIcon({ className = 'w-5 h-5' }: { className?: string }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className={className}>
      <rect x="9" y="3" width="6" height="11" rx="3" />
      <path strokeLinecap="round" d="M5 11a7 7 0 0 0 14 0" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M12 18v3M8 21h8" />
    </svg>
  )
}

interface ShoppingListSheetProps {
  open: boolean
  onClose: () => void
  /** Called after list changes (e.g. despensa cards refresh badges). */
  onListChange?: () => void
}

interface VoiceSuggestion {
  key: string
  displayName: string
  listId: number | null
}

export function ShoppingListButton({
  count,
  onClick,
}: {
  count: number
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="relative flex items-center gap-1.5 px-3 py-2 rounded-xl bg-nourish-surface-high border border-nourish-border text-nourish-text text-xs font-semibold active:bg-nourish-border/20 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
      aria-label="Compras"
    >
      <CartIcon />
      Compras
      {count > 0 && (
        <span className="min-w-[1.25rem] h-5 px-1 flex items-center justify-center rounded-full bg-nourish-primary text-nourish-on-primary text-[10px] font-bold">
          {count > 99 ? '99+' : count}
        </span>
      )}
    </button>
  )
}

export function ShoppingListSheet({ open, onClose, onListChange }: ShoppingListSheetProps) {
  const [items, setItems] = useState<ShoppingListItem[]>([])
  const [products, setProducts] = useState<Map<number, Product>>(new Map())
  const [productList, setProductList] = useState<Product[]>([])
  const [loading, setLoading] = useState(false)
  const [busyId, setBusyId] = useState<number | null>(null)
  const [voiceBusy, setVoiceBusy] = useState(false)
  const [suggestions, setSuggestions] = useState<VoiceSuggestion[]>([])
  const [dismissedKeys, setDismissedKeys] = useState<Set<string>>(() => new Set())
  const [voiceHint, setVoiceHint] = useState<string | null>(null)

  const load = useCallback(async () => {
    setLoading(true)
    try {
      const [sl, prods] = await Promise.all([grocy.getShoppingList(), grocy.getProducts()])
      setItems(sl.filter((i) => !i.done))
      setProductList(prods)
      setProducts(new Map(prods.map((p) => [p.id, p])))
    } finally {
      setLoading(false)
    }
  }, [])

  useEffect(() => {
    if (open) load()
    else {
      setSuggestions([])
      setDismissedKeys(new Set())
      setVoiceHint(null)
    }
  }, [open, load])

  const productName = (productId: number) => products.get(productId)?.name ?? `Produto #${productId}`

  const handleTranscript = useCallback(
    async (transcript: string) => {
      setVoiceBusy(true)
      setVoiceHint(null)
      try {
        let names = parseShoppingVoice(transcript)
        if (names.length === 0) {
          names = await extractShoppingNamesFromTranscript(transcript)
        }
        if (names.length === 0) {
          setVoiceHint('Não apanhei produtos. Tenta dizer os nomes, separados por vírgulas ou «e».')
          return
        }

        const [sl, catalog] = await Promise.all([
          grocy.getShoppingList(),
          productList.length > 0 ? Promise.resolve(productList) : grocy.getProducts(),
        ])
        const classified = classifyHeardShoppingNames(names, catalog, {
          dismissedKeys,
          ignoreList: loadReceiptIgnoreList(),
          favorites: loadGenericoFavorites(),
        })
        const { linked, unlinked } = voiceShoppingKeeps(classified)

        const newSuggestions: VoiceSuggestion[] = []
        await Promise.all(
          linked.map(async (item) => {
            if (alreadyOnShoppingList(item, sl) || !item.product) return
            await grocy.addToShoppingList(item.product.id, item.buyAmount)
          })
        )
        await Promise.all(
          unlinked.map(async (item) => {
            if (alreadyOnShoppingList(item, sl)) return
            const created = await grocy.addFreeTextToShoppingList(item.heardName)
            newSuggestions.push({
              key: item.key,
              displayName: item.heardName,
              listId: created.created_object_id ?? null,
            })
          })
        )

        setSuggestions(newSuggestions)
        await load()
        onListChange?.()
        if (linked.length === 0 && newSuggestions.length === 0) {
          setVoiceHint('Já estavam na lista, ou ignoraste esse palpite.')
        }
      } catch {
        setVoiceHint('Não consegui adicionar o que ouvi. Tenta outra vez.')
      } finally {
        setVoiceBusy(false)
      }
    },
    [dismissedKeys, load, onListChange, productList]
  )

  const speech = usePortugueseSpeech(handleTranscript)

  useEffect(() => {
    if (!open) speech.stop()
  }, [open, speech])

  const handleDismissSuggestion = async (suggestion: VoiceSuggestion) => {
    setDismissedKeys((prev) => dismissHeardKey(prev, suggestion.displayName))
    setSuggestions((prev) => prev.filter((s) => s.key !== suggestion.key))
    if (suggestion.listId != null) {
      setBusyId(suggestion.listId)
      try {
        await grocy.removeFromShoppingList(suggestion.listId)
        await load()
        onListChange?.()
      } finally {
        setBusyId(null)
      }
    }
  }

  const handleDone = async (item: ShoppingListItem) => {
    setBusyId(item.id)
    try {
      await grocy.markShoppingListDone(item)
      await load()
      onListChange?.()
    } finally {
      setBusyId(null)
    }
  }

  const handleRemove = async (item: ShoppingListItem) => {
    setBusyId(item.id)
    try {
      await grocy.removeFromShoppingList(item.id)
      setSuggestions((prev) => prev.filter((s) => s.listId !== item.id))
      await load()
      onListChange?.()
    } finally {
      setBusyId(null)
    }
  }

  if (!open) return null

  const micLabel = !speech.supported
    ? 'Ditado não disponível neste browser'
    : speech.listening
      ? 'Parar ditado'
      : 'Ditar produtos'

  return (
    <div className="fixed inset-0 z-50 bg-black/60" onClick={onClose}>
      <div
        className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm bg-nourish-surface rounded-t-2xl max-h-[85vh] flex flex-col"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-4 border-b border-nourish-border flex items-center justify-between gap-2 flex-shrink-0">
          <div className="min-w-0 flex-1">
            <p className="font-semibold text-nourish-text">Lista de compras</p>
            <p className="text-xs text-nourish-text-dim mt-0.5 truncate">
              {speech.listening
                ? speech.interim
                  ? speech.interim
                  : 'A ouvir… fala os produtos'
                : voiceBusy
                  ? 'A acrescentar o que ouvi…'
                  : items.length === 0
                    ? 'Vazia — dita produtos ou usa o check ao sair'
                    : `${items.length} item${items.length !== 1 ? 's' : ''} por comprar`}
            </p>
          </div>
          <button
            type="button"
            onClick={speech.toggle}
            disabled={!speech.supported || voiceBusy}
            aria-label={micLabel}
            aria-pressed={speech.listening}
            title={micLabel}
            className={`p-2 rounded-lg focus:outline-none focus:ring-2 focus:ring-nourish-primary disabled:opacity-40 ${
              speech.listening
                ? 'text-red-400 bg-red-400/10 animate-pulse'
                : 'text-nourish-text-dim'
            }`}
          >
            <MicIcon />
          </button>
          <button
            type="button"
            onClick={onClose}
            className="p-2 text-nourish-text-dim rounded-lg focus:outline-none focus:ring-2 focus:ring-nourish-primary"
            aria-label="Fechar"
          >
            ✕
          </button>
        </div>

        {(speech.error || voiceHint) && (
          <p className="px-4 pt-2 text-xs text-nourish-text-dim">{speech.error ?? voiceHint}</p>
        )}

        <div className="overflow-y-auto flex-1 p-4">
          {loading && (
            <div className="flex justify-center py-8">
              <Spinner />
            </div>
          )}

          {!loading && items.length === 0 && (
            <p className="text-sm text-nourish-text-dim text-center py-8">
              Nada na lista. Toca no microfone e diz o que precisas, ou usa o ícone de lista na despensa.
            </p>
          )}

          {!loading && items.length > 0 && (
            <ul className="space-y-2">
              {items.map((item) => (
                <li
                  key={item.id}
                  className="flex items-center gap-3 p-3 bg-nourish-surface-high border border-nourish-border rounded-xl"
                >
                  <div className="flex-1 min-w-0">
                    <p className="font-medium text-sm text-nourish-text truncate">
                      {shoppingItemLabel(item, productName)}
                    </p>
                    <p className="text-xs text-nourish-text-dim tabular-nums">
                      {isLinkedShoppingProductId(item.product_id)
                        ? `× ${item.amount}`
                        : 'Texto livre'}
                    </p>
                  </div>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => handleDone(item)}
                    className="px-3 py-2 rounded-xl text-xs font-semibold bg-nourish-primary text-nourish-on-primary disabled:opacity-50"
                  >
                    Comprado
                  </button>
                  <button
                    type="button"
                    disabled={busyId === item.id}
                    onClick={() => handleRemove(item)}
                    className="p-2 text-nourish-text-dim hover:text-red-400 disabled:opacity-50"
                    aria-label="Remover"
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          )}
        </div>

        {suggestions.length > 0 && (
          <div className="flex-shrink-0 border-t border-nourish-border px-4 pt-3 pb-1">
            <p className="text-xs text-nourish-text-dim mb-2">
              Palpites — toca ✕ se não for isto
            </p>
            <ul className="space-y-2">
              {suggestions.map((s) => (
                <li
                  key={s.key}
                  className="flex items-center gap-2 px-3 py-2 rounded-xl bg-nourish-surface-high border border-dashed border-nourish-border"
                >
                  <span className="flex-1 min-w-0 text-sm text-nourish-text truncate">{s.displayName}</span>
                  <button
                    type="button"
                    disabled={busyId === s.listId}
                    onClick={() => void handleDismissSuggestion(s)}
                    className="p-2 text-nourish-text-dim hover:text-red-400 disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-nourish-primary rounded-lg"
                    aria-label={`Ignorar ${s.displayName}`}
                  >
                    ✕
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}
