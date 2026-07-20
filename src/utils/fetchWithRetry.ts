import { friendlyNetworkError, isNetworkFetchError, nudgeServiceWorkerUpdate } from './pwaRecovery'

type FetchWithRetryOptions = {
  retries?: number
  retryDelayMs?: number
  nudgeSwOnFailure?: boolean
}

export async function fetchWithRetry(
  input: RequestInfo | URL,
  init?: RequestInit,
  options: FetchWithRetryOptions = {}
): Promise<Response> {
  const { retries = 2, retryDelayMs = 400, nudgeSwOnFailure = true } = options
  let lastError: unknown

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await fetch(input, init)
    } catch (error) {
      lastError = error
      if (!isNetworkFetchError(error) || attempt === retries) break
      if (nudgeSwOnFailure && attempt === 0) {
        await nudgeServiceWorkerUpdate().catch(() => {})
      }
      await new Promise((resolve) => setTimeout(resolve, retryDelayMs * (attempt + 1)))
    }
  }

  throw new Error(friendlyNetworkError(lastError))
}
