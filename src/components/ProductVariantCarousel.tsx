import { useEffect, useRef, useCallback, useState, type ReactNode } from 'react'
import { grocy } from '../api/grocy'
import type { FamilyVariantSummary } from '../utils/productFamily'
import { formatDespensaPriceLabel } from '../utils/despensaAnalytics'
import { ImageCropper } from './ImageCropper'

interface Props {
  variants: FamilyVariantSummary[]
  activeId: number
  /** Local preview override for the active variant (after upload). */
  activePreview: string | null
  onActiveChange: (id: number) => void
  onPhotoChange: (file: File, previewUrl: string) => void
  overlay?: ReactNode
  /** Family favorite SKU — shown as a star on the photo (upper-right). */
  favoriteId?: number
  onToggleFavorite?: (id: number) => void
}

function SmallCameraIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
      <path
        fillRule="evenodd"
        d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 0 1-3 3h-15a3 3 0 0 1-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 0 0 1.11-.71l.822-1.315a2.942 2.942 0 0 1 2.332-1.39ZM6.75 12.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Zm12-1.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function StarIcon({ filled }: { filled: boolean }) {
  return filled ? (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path
        fillRule="evenodd"
        d="M10.788 3.21c.448-1.077 1.976-1.077 2.424 0l2.082 5.006 5.404.434c1.164.093 1.636 1.545.749 2.305l-4.117 3.527 1.257 5.273c.271 1.136-.964 2.033-1.96 1.425L12 18.354 7.373 21.18c-.996.608-2.231-.29-1.96-1.425l1.257-5.273-4.117-3.527c-.887-.76-.415-2.212.749-2.305l5.404-.434 2.082-5.005Z"
        clipRule="evenodd"
      />
    </svg>
  ) : (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      fill="none"
      viewBox="0 0 24 24"
      strokeWidth={1.5}
      stroke="currentColor"
      className="w-6 h-6"
    >
      <path
        strokeLinecap="round"
        strokeLinejoin="round"
        d="M11.48 3.499a.562.562 0 0 1 1.04 0l2.125 5.111a.563.563 0 0 0 .475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 0 0-.182.557l1.285 5.385a.562.562 0 0 1-.84.61l-4.725-2.885a.562.562 0 0 0-.586 0L6.982 20.54a.562.562 0 0 1-.84-.61l1.285-5.386a.562.562 0 0 0-.182-.557l-4.204-3.602a.562.562 0 0 1 .321-.988l5.518-.442a.563.563 0 0 0 .475-.345L11.48 3.5Z"
      />
    </svg>
  )
}

function GalleryIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path
        fillRule="evenodd"
        d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

/**
 * Horizontal snap carousel of Generico SKU photos.
 * Swipe changes the active variant; parent updates `/product/:id`.
 */
export function ProductVariantCarousel({
  variants,
  activeId,
  activePreview,
  onActiveChange,
  onPhotoChange,
  overlay,
  favoriteId,
  onToggleFavorite,
}: Props) {
  const scrollerRef = useRef<HTMLDivElement>(null)
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const skipScrollSync = useRef(false)
  const settleTimer = useRef<number | null>(null)
  const [showSheet, setShowSheet] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  const scrollToId = useCallback(
    (id: number, behavior: ScrollBehavior = 'smooth') => {
      const el = scrollerRef.current
      if (!el) return
      const idx = variants.findIndex((v) => v.id === id)
      if (idx < 0) return
      const slide = el.children[idx] as HTMLElement | undefined
      if (!slide) return
      skipScrollSync.current = true
      el.scrollTo({ left: slide.offsetLeft, behavior })
      window.setTimeout(() => {
        skipScrollSync.current = false
      }, behavior === 'smooth' ? 350 : 50)
    },
    [variants]
  )

  useEffect(() => {
    scrollToId(activeId, 'auto')
  }, [activeId, scrollToId])

  function handleScroll() {
    if (skipScrollSync.current) return
    const el = scrollerRef.current
    if (!el) return
    if (settleTimer.current != null) window.clearTimeout(settleTimer.current)
    settleTimer.current = window.setTimeout(() => {
      const slideW = el.clientWidth
      if (slideW <= 0) return
      const idx = Math.round(el.scrollLeft / slideW)
      const next = variants[idx]
      if (next && next.id !== activeId) onActiveChange(next.id)
    }, 80)
  }

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCropSrc(URL.createObjectURL(file))
  }

  function handleCropConfirm(file: File) {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    onPhotoChange(file, URL.createObjectURL(file))
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  const activeIdx = Math.max(
    0,
    variants.findIndex((v) => v.id === activeId)
  )

  return (
    <>
      {cropSrc && (
        <ImageCropper src={cropSrc} onConfirm={handleCropConfirm} onCancel={handleCropCancel} />
      )}

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
                <SmallCameraIcon />
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

      <div>
        <div
          ref={scrollerRef}
          onScroll={handleScroll}
          className="flex overflow-x-auto snap-x snap-mandatory"
          style={{ scrollbarWidth: 'none', msOverflowStyle: 'none' }}
        >
          {variants.map((v) => {
            const isActive = v.id === activeId
            const src =
              isActive && activePreview
                ? activePreview
                : v.picture_file_name
                  ? grocy.productPictureUrl(v.picture_file_name)
                  : null
            return (
              <div
                key={v.id}
                className="min-w-full flex-shrink-0 snap-center relative"
                style={{ scrollSnapStop: 'always' }}
              >
                <button
                  type="button"
                  onClick={() => setShowSheet(true)}
                  className="relative w-full rounded-2xl overflow-hidden bg-nourish-surface focus:outline-none focus:ring-2 focus:ring-nourish-primary"
                  style={{ aspectRatio: '4/3' }}
                  aria-label={
                    src ? `Alterar foto · ${v.name}` : `Adicionar foto · ${v.name}`
                  }
                >
                  {src ? (
                    <img
                      src={src}
                      alt=""
                      className="absolute inset-0 w-full h-full object-cover"
                    />
                  ) : (
                    <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 bg-nourish-surface border-2 border-dashed border-nourish-border rounded-2xl">
                      <p className="text-sm text-nourish-text-dim px-4 text-center">
                        Toca para adicionar foto
                      </p>
                    </div>
                  )}
                  {isActive && overlay && (
                    <div className="absolute inset-x-0 bottom-0 z-10 pointer-events-none">
                      {overlay}
                    </div>
                  )}
                  {!isActive && (
                    <div className="absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/70 to-transparent px-4 pt-10 pb-3">
                      <p className="text-white text-sm font-medium truncate drop-shadow-sm">
                        {v.name}
                      </p>
                      {v.price != null && (
                        <p className="text-white/90 text-xs tabular-nums mt-0.5">
                          {formatDespensaPriceLabel(v.price, v.description)}
                        </p>
                      )}
                    </div>
                  )}
                </button>
                {onToggleFavorite && (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.preventDefault()
                      e.stopPropagation()
                      onToggleFavorite(v.id)
                    }}
                    className={`absolute top-2 right-2 z-20 p-2 rounded-full backdrop-blur-sm focus:outline-none focus:ring-2 focus:ring-white/80 ${
                      v.id === favoriteId
                        ? 'bg-black/35 text-amber-400'
                        : 'bg-black/35 text-white'
                    }`}
                    aria-label={
                      v.id === favoriteId
                        ? 'Variante favorita'
                        : 'Definir como variante favorita'
                    }
                    aria-pressed={v.id === favoriteId}
                  >
                    <StarIcon filled={v.id === favoriteId} />
                  </button>
                )}
              </div>
            )
          })}
        </div>

        <div
          className="flex items-center justify-center gap-0.5 mt-2"
          role="tablist"
          aria-label="Variantes"
        >
          {variants.map((v, i) => (
            <button
              key={v.id}
              type="button"
              role="tab"
              aria-selected={i === activeIdx}
              aria-label={`${v.name} (${i + 1} de ${variants.length})`}
              onClick={() => {
                if (v.id !== activeId) onActiveChange(v.id)
                else scrollToId(v.id)
              }}
              className="flex items-center justify-center p-2 rounded-full focus:outline-none focus:ring-2 focus:ring-nourish-primary"
            >
              <span
                className={`block h-1.5 rounded-full transition-all ${
                  i === activeIdx ? 'w-4 bg-nourish-primary' : 'w-1.5 bg-nourish-border'
                }`}
              />
            </button>
          ))}
        </div>

        <div className="flex gap-2 overflow-x-auto mt-3 pb-0.5 -mx-1 px-1" style={{ scrollbarWidth: 'none' }}>
          {variants.map((v) => {
            const selected = v.id === activeId
            return (
              <button
                type="button"
                key={v.id}
                onClick={() => {
                  if (v.id !== activeId) onActiveChange(v.id)
                  else scrollToId(v.id)
                }}
                className={`flex-shrink-0 max-w-[70%] px-3 py-1.5 rounded-lg text-left text-xs border transition-colors focus:outline-none focus:ring-2 focus:ring-nourish-primary ${
                  selected
                    ? 'bg-nourish-primary text-nourish-on-primary border-nourish-primary'
                    : 'bg-nourish-surface-high text-nourish-text border-nourish-border'
                }`}
              >
                <span className="block truncate font-medium">
                  {v.id === favoriteId ? '★ ' : ''}
                  {v.name}
                </span>
                {v.price != null && (
                  <span
                    className={`block tabular-nums mt-0.5 ${
                      selected ? 'text-nourish-on-primary/80' : 'text-nourish-text-dim'
                    }`}
                  >
                    {formatDespensaPriceLabel(v.price, v.description)}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>

      <input
        ref={galleryRef}
        type="file"
        accept="image/*"
        className="hidden"
        onChange={handleFileSelect}
      />
      <input
        ref={cameraRef}
        type="file"
        accept="image/*"
        capture="environment"
        className="hidden"
        onChange={handleFileSelect}
      />
    </>
  )
}
