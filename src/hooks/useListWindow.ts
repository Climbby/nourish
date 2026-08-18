import { useCallback, useEffect, useRef, useState } from 'react'

/** First page, then more as the sentinel enters view (or via loadMore). */
export function useListWindow(total: number, pageSize: number, resetKey: unknown) {
  const [state, setState] = useState({ key: resetKey, visible: pageSize })
  if (state.key !== resetKey) {
    setState({ key: resetKey, visible: pageSize })
  }
  const visible = state.key !== resetKey ? pageSize : state.visible
  const sentinelRef = useRef<HTMLDivElement>(null)

  const loadMore = useCallback(() => {
    setState((prev) => ({
      ...prev,
      visible: Math.min(prev.visible + pageSize, total),
    }))
  }, [pageSize, total])

  useEffect(() => {
    const el = sentinelRef.current
    if (!el || visible >= total) return
    const obs = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) loadMore()
      },
      { rootMargin: '240px' }
    )
    obs.observe(el)
    return () => obs.disconnect()
  }, [visible, total, loadMore])

  return {
    visibleCount: Math.min(visible, total),
    sentinelRef,
    hasMore: visible < total,
    loadMore,
  }
}
