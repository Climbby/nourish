/** True for raw fetch failures and our friendly Portuguese network messages. */
function messageLooksLikeNetworkFailure(msg: string): boolean {
  const m = msg.toLowerCase()
  return (
    m.includes('failed to fetch') ||
    m.includes('networkerror') ||
    m.includes('load failed') ||
    m.includes('network request failed') ||
    m.includes('não foi possível ligar ao servidor') ||
    m.includes('sem ligação à internet')
  )
}

/** True when fetch failed before getting an HTTP response (offline, DNS, SW, etc.). */
export function isNetworkFetchError(error: unknown): boolean {
  if (typeof error === 'string') return messageLooksLikeNetworkFailure(error)
  if (!(error instanceof Error)) return false
  return error.name === 'TypeError' || messageLooksLikeNetworkFailure(error.message)
}

export function friendlyNetworkError(error: unknown): string {
  if (!isNetworkFetchError(error)) {
    return error instanceof Error ? error.message : 'Erro desconhecido'
  }
  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    return 'Sem ligação à internet. Verifica a rede e tenta de novo.'
  }
  return 'Não foi possível ligar ao servidor. Tenta de novo ou repara a app.'
}

export async function clearPwaCachesAndReload(): Promise<void> {
  if ('serviceWorker' in navigator) {
    const registrations = await navigator.serviceWorker.getRegistrations()
    await Promise.all(registrations.map((r) => r.unregister()))
  }
  if ('caches' in window) {
    const keys = await caches.keys()
    await Promise.all(keys.map((key) => caches.delete(key)))
  }
  window.location.reload()
}

export async function nudgeServiceWorkerUpdate(): Promise<void> {
  if (!('serviceWorker' in navigator)) return
  const registration = await navigator.serviceWorker.getRegistration()
  await registration?.update()
}
