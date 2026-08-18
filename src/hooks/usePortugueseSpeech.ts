import { useCallback, useEffect, useRef, useState } from 'react'

export type SpeechLang = 'pt-PT' | 'pt-BR'

type SpeechCtor = new () => SpeechRecognition

function getSpeechCtor(): SpeechCtor | null {
  if (typeof window === 'undefined') return null
  const w = window as Window & {
    SpeechRecognition?: SpeechCtor
    webkitSpeechRecognition?: SpeechCtor
  }
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null
}

export function isPortugueseSpeechSupported(): boolean {
  return getSpeechCtor() != null
}

function speechErrorMessage(code: string): string {
  if (code === 'not-allowed' || code === 'service-not-allowed') {
    return 'Permite o microfone para ditar a lista.'
  }
  if (code === 'no-speech') return 'Não ouvi nada. Toca no microfone e fala.'
  if (code === 'audio-capture') return 'Não encontrei o microfone.'
  if (code === 'network') return 'Sem rede para o ditado. Tenta outra vez.'
  if (code === 'language-not-supported') {
    return 'Este aparelho não reconhece português. Tenta outro browser.'
  }
  return 'Não consegui ouvir. Tenta outra vez.'
}

export function usePortugueseSpeech(onTranscript: (text: string) => void) {
  const [listening, setListening] = useState(false)
  const [interim, setInterim] = useState('')
  const [error, setError] = useState<string | null>(null)
  const recRef = useRef<SpeechRecognition | null>(null)
  const finalRef = useRef('')
  const interimRef = useRef('')
  const retryBrRef = useRef(false)
  const onTranscriptRef = useRef(onTranscript)
  onTranscriptRef.current = onTranscript

  const stop = useCallback(() => {
    retryBrRef.current = false
    try {
      recRef.current?.stop()
    } catch {
      /* already stopped */
    }
    recRef.current = null
    setListening(false)
  }, [])

  const startWithLang = useCallback((lang: SpeechLang) => {
    const Ctor = getSpeechCtor()
    if (!Ctor) {
      setError('Ditado não está disponível neste browser.')
      setListening(false)
      return
    }

    const rec = new Ctor()
    rec.lang = lang
    rec.interimResults = true
    rec.continuous = false
    rec.maxAlternatives = 1
    recRef.current = rec
    finalRef.current = ''
    setInterim('')
    setError(null)
    setListening(true)

    rec.onresult = (event: SpeechRecognitionEvent) => {
      let interimText = ''
      let finalText = ''
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const piece = event.results[i][0]?.transcript ?? ''
        if (event.results[i].isFinal) finalText += piece
        else interimText += piece
      }
      if (finalText.trim()) finalRef.current = finalText.trim()
      const shown = (finalText || interimText).trim()
      interimRef.current = shown
      setInterim(shown)
    }

    rec.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error === 'aborted') return
      if (event.error === 'language-not-supported' && lang === 'pt-PT') {
        retryBrRef.current = true
        return
      }
      setError(speechErrorMessage(event.error))
      setListening(false)
    }

    rec.onend = () => {
      if (retryBrRef.current && lang === 'pt-PT') {
        retryBrRef.current = false
        startWithLang('pt-BR')
        return
      }
      recRef.current = null
      setListening(false)
      const text = finalRef.current.trim() || interimRef.current.trim()
      finalRef.current = ''
      interimRef.current = ''
      setInterim('')
      if (text) onTranscriptRef.current(text)
    }

    try {
      rec.start()
    } catch {
      setError('Não consegui começar o ditado. Tenta outra vez.')
      setListening(false)
    }
  }, [])

  const toggle = useCallback(() => {
    if (listening) {
      stop()
      return
    }
    retryBrRef.current = false
    startWithLang('pt-PT')
  }, [listening, startWithLang, stop])

  useEffect(() => () => stop(), [stop])

  return {
    supported: isPortugueseSpeechSupported(),
    listening,
    interim,
    error,
    setError,
    toggle,
    stop,
  }
}
