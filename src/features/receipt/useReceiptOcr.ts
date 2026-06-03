import { useCallback, useRef, useState } from 'react'

export function useReceiptOcr() {
  const workerRef = useRef<{ terminate: () => Promise<unknown> } | null>(null)
  const [progress, setProgress] = useState(0)
  const [running, setRunning] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const terminate = useCallback(async () => {
    if (workerRef.current) {
      await workerRef.current.terminate()
      workerRef.current = null
    }
  }, [])

  const recognize = useCallback(
    async (imageUrl: string): Promise<string> => {
      setRunning(true)
      setError(null)
      setProgress(0)

      try {
        const { createWorker } = await import('tesseract.js')
        await terminate()

        const worker = await createWorker('por', 1, {
          logger: (m) => {
            if (m.status === 'recognizing text' && typeof m.progress === 'number') {
              setProgress(Math.round(m.progress * 100))
            }
          },
        })
        workerRef.current = worker

        const { data } = await worker.recognize(imageUrl)
        setProgress(100)
        return data.text
      } catch (e) {
        const msg = e instanceof Error ? e.message : 'OCR falhou'
        setError(msg)
        throw e
      } finally {
        setRunning(false)
        await terminate()
      }
    },
    [terminate]
  )

  return { recognize, progress, running, error }
}
