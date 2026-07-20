/** True when fetch failed before getting an HTTP response (offline, DNS, SW, etc.). */
export function isNetworkFetchError(error: unknown): boolean {
  if (!(error instanceof Error)) return false
  const msg = error.message.toLowerCase()
  return (
    error.name === 'TypeError' ||
    msg.includes('failed to fetch') ||
    msg.includes('networkerror') ||
    msg.includes('load failed') ||
    msg.includes('network request failed')
  )
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
