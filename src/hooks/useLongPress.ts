import { useRef, type MouseEvent as ReactMouseEvent, type PointerEvent as ReactPointerEvent } from 'react'

const MOVE_CANCEL_PX = 10

/**
 * Long-press / tap-and-hold. Ignores presses that start on buttons/links.
 * Also treats contextmenu (desktop right-click, some long-presses) as the action.
 */
export function useLongPress(onLongPress: () => void, ms = 480) {
  const timer = useRef<number | null>(null)
  const startPos = useRef<{ x: number; y: number } | null>(null)
  const fired = useRef(false)

  function clearTimer() {
    if (timer.current != null) {
      window.clearTimeout(timer.current)
      timer.current = null
    }
    startPos.current = null
  }

  function fromControl(target: EventTarget | null): boolean {
    return target instanceof Element && !!target.closest('button, a, input, textarea, select, label')
  }

  function onPointerDown(e: ReactPointerEvent) {
    if (e.pointerType === 'mouse' && e.button !== 0) return
    if (fromControl(e.target)) return
    fired.current = false
    startPos.current = { x: e.clientX, y: e.clientY }
    timer.current = window.setTimeout(() => {
      fired.current = true
      timer.current = null
      onLongPress()
    }, ms)
  }

  function onPointerMove(e: ReactPointerEvent) {
    if (!startPos.current) return
    const dx = e.clientX - startPos.current.x
    const dy = e.clientY - startPos.current.y
    if (dx * dx + dy * dy > MOVE_CANCEL_PX * MOVE_CANCEL_PX) clearTimer()
  }

  function onPointerUp() {
    clearTimer()
  }

  function onContextMenu(e: ReactMouseEvent) {
    if (fromControl(e.target)) return
    e.preventDefault()
    fired.current = true
    onLongPress()
  }

  function onClickCapture(e: ReactMouseEvent) {
    if (!fired.current) return
    e.preventDefault()
    e.stopPropagation()
    fired.current = false
  }

  return {
    onPointerDown,
    onPointerMove,
    onPointerUp,
    onPointerCancel: onPointerUp,
    onContextMenu,
    onClickCapture,
  }
}
