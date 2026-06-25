import { useEffect, useRef, type RefObject } from 'react'

/** Programmatically open a hidden file/camera input once (e.g. from a PWA shortcut). */
export function useAutoOpenCamera(
  enabled: boolean,
  inputRef: RefObject<HTMLInputElement | null>,
  ready = true
) {
  const opened = useRef(false)

  useEffect(() => {
    if (!enabled || !ready || opened.current) return
    opened.current = true
    const timer = setTimeout(() => inputRef.current?.click(), 350)
    return () => clearTimeout(timer)
  }, [enabled, ready, inputRef])
}
