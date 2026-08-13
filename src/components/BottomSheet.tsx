import { useEffect, useId, useRef, useState, type ReactNode, type PointerEvent as ReactPointerEvent } from 'react'
import { createPortal } from 'react-dom'

const ANIM_MS = 250
const DISMISS_PX = 80
const DISMISS_VELOCITY = 0.45 // px/ms

interface Props {
  open: boolean
  onClose: () => void
  children: ReactNode
  ariaLabel?: string
}

/**
 * Instagram-style bottom sheet: slide up/down, drag handle, backdrop tap, Escape.
 * Stays mounted briefly while closing so the exit animation can play.
 * Portaled to document.body (same as HelpInfo) so transform ancestors don't clip it.
 */
export function BottomSheet({ open, onClose, children, ariaLabel = 'Menu' }: Props) {
  const titleId = useId()
  const [mounted, setMounted] = useState(open)
  const [visible, setVisible] = useState(false)
  const panelRef = useRef<HTMLDivElement>(null)
  const dragY = useRef(0)
  const dragStartY = useRef(0)
  const dragStartT = useRef(0)
  const dragging = useRef(false)

  useEffect(() => {
    if (open) {
      setMounted(true)
      const id = requestAnimationFrame(() => {
        requestAnimationFrame(() => setVisible(true))
      })
      return () => cancelAnimationFrame(id)
    }
    setVisible(false)
    const t = window.setTimeout(() => setMounted(false), ANIM_MS)
    return () => window.clearTimeout(t)
  }, [open])

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  function setPanelOffset(y: number) {
    const el = panelRef.current
    if (!el) return
    el.style.transform = y > 0 ? `translateY(${y}px)` : ''
    el.style.transition = y > 0 ? 'none' : ''
  }

  function onHandlePointerDown(e: ReactPointerEvent<HTMLDivElement>) {
    dragging.current = true
    dragStartY.current = e.clientY
    dragStartT.current = performance.now()
    dragY.current = 0
    e.currentTarget.setPointerCapture(e.pointerId)
  }

  function onHandlePointerMove(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current) return
    const dy = Math.max(0, e.clientY - dragStartY.current)
    dragY.current = dy
    setPanelOffset(dy)
  }

  function onHandlePointerUp(e: ReactPointerEvent<HTMLDivElement>) {
    if (!dragging.current) return
    dragging.current = false
    try {
      e.currentTarget.releasePointerCapture(e.pointerId)
    } catch {
      /* already released */
    }
    const elapsed = Math.max(1, performance.now() - dragStartT.current)
    const velocity = dragY.current / elapsed
    const shouldClose = dragY.current >= DISMISS_PX || velocity >= DISMISS_VELOCITY
    const el = panelRef.current
    if (el) {
      el.style.transition = `transform ${ANIM_MS}ms ease-out`
      el.style.transform = ''
    }
    dragY.current = 0
    if (shouldClose) onClose()
  }

  if (!mounted) return null

  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center" role="presentation">
      <button
        type="button"
        className={`absolute inset-0 bg-black/60 transition-opacity ease-out ${
          visible ? 'opacity-100' : 'opacity-0'
        }`}
        style={{ transitionDuration: `${ANIM_MS}ms` }}
        aria-label="Fechar"
        onClick={onClose}
      />
      <div
        ref={panelRef}
        role="dialog"
        aria-modal="true"
        aria-label={ariaLabel}
        aria-labelledby={titleId}
        className={`relative w-full max-w-sm bg-nourish-surface rounded-t-2xl border-t border-nourish-border shadow-lg transition-transform ease-out ${
          visible ? 'translate-y-0' : 'translate-y-full'
        }`}
        style={{
          paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)',
          transitionDuration: `${ANIM_MS}ms`,
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div
          className="flex justify-center pt-3 pb-1 cursor-grab active:cursor-grabbing touch-none"
          onPointerDown={onHandlePointerDown}
          onPointerMove={onHandlePointerMove}
          onPointerUp={onHandlePointerUp}
          onPointerCancel={onHandlePointerUp}
        >
          <div className="w-10 h-1 rounded-full bg-nourish-border" aria-hidden />
        </div>
        <span id={titleId} className="sr-only">
          {ariaLabel}
        </span>
        {children}
      </div>
    </div>,
    document.body
  )
}
