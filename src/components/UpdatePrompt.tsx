import { useState, useEffect, useCallback } from 'react'
import { useRegisterSW } from 'virtual:pwa-register/react'

export function UpdatePrompt() {
  const [updateAvailable, setUpdateAvailable] = useState(false)
  const [offlineReady, setOfflineReady] = useState(false)

  const { updateServiceWorker } = useRegisterSW({
    onRegisteredSW(_, registration) {
      if (!registration) return
      setInterval(() => registration.update(), 60 * 1000)
      document.addEventListener('visibilitychange', () => {
        if (document.visibilityState === 'visible') registration.update()
      })
    },
    onNeedRefresh() {
      setUpdateAvailable(true)
    },
    onOfflineReady() {
      setOfflineReady(true)
      setTimeout(() => setOfflineReady(false), 3000)
    },
  })

  const handleUpdate = useCallback(() => {
    updateServiceWorker(true)
    setUpdateAvailable(false)
  }, [updateServiceWorker])

  useEffect(() => {
    const reload = () => window.location.reload()
    navigator.serviceWorker?.addEventListener('controllerchange', reload)
    return () => navigator.serviceWorker?.removeEventListener('controllerchange', reload)
  }, [])

  return (
    <>
      {offlineReady && (
        <div className="fixed top-4 left-1/2 -translate-x-1/2 z-[100] px-4 py-2 bg-green-600 text-white rounded-xl shadow-lg text-sm font-medium animate-fade-in">
          Pronto para usar offline
        </div>
      )}

      {updateAvailable && (
        <div className="fixed bottom-20 left-1/2 -translate-x-1/2 z-[100] w-[calc(100%-2rem)] max-w-sm bg-nourish-surface border border-nourish-border rounded-2xl shadow-2xl p-4 animate-slide-up">
          <div className="flex items-start gap-3">
            <div className="flex-shrink-0 w-10 h-10 bg-nourish-primary/20 rounded-xl flex items-center justify-center">
              <svg className="w-5 h-5 text-nourish-primary" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
              </svg>
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-sm font-semibold text-nourish-text">Nova versão disponível</p>
              <p className="text-xs text-nourish-text-dim mt-0.5">Atualiza para teres as últimas novidades.</p>
            </div>
          </div>
          <div className="flex gap-2 mt-3">
            <button
              type="button"
              onClick={() => setUpdateAvailable(false)}
              className="flex-1 py-2.5 rounded-xl text-sm font-medium border border-nourish-border text-nourish-text-dim hover:bg-nourish-border/10 transition-colors focus:outline-none"
            >
              Depois
            </button>
            <button
              type="button"
              onClick={handleUpdate}
              className="flex-1 py-2.5 rounded-xl text-sm font-semibold bg-nourish-primary text-nourish-on-primary hover:opacity-90 transition-opacity focus:outline-none"
            >
              Atualizar
            </button>
          </div>
        </div>
      )}
    </>
  )
}
