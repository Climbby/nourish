import { clearPwaCachesAndReload, isNetworkFetchError } from '../utils/pwaRecovery'

type Props = {
  message: string
  onRetry?: () => void
  className?: string
}

export function ConnectionError({ message, onRetry, className = '' }: Props) {
  const showRepair = isNetworkFetchError(message)

  return (
    <div className={`p-4 bg-red-900/30 border border-red-800 text-red-400 rounded-xl text-sm ${className}`}>
      <p>{message}</p>
      <div className="flex flex-wrap gap-2 mt-3">
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="px-3 py-2 rounded-lg text-xs font-semibold bg-red-900/40 border border-red-700/60 hover:bg-red-900/60 transition-colors focus:outline-none"
          >
            Tentar de novo
          </button>
        )}
        {showRepair && (
          <button
            type="button"
            onClick={() => void clearPwaCachesAndReload()}
            className="px-3 py-2 rounded-lg text-xs font-semibold border border-red-700/60 text-red-300 hover:bg-red-900/40 transition-colors focus:outline-none"
          >
            Reparar app
          </button>
        )}
      </div>
    </div>
  )
}
