import { useEffect, useId, useState, type ReactNode } from 'react'

export interface HelpInfoSection {
  title: string
  body: string
}

interface HelpInfoProps {
  /** Sheet heading */
  title: string
  subtitle?: string
  /** Structured sections — preferred for reuse */
  sections?: HelpInfoSection[]
  /** Free-form body when sections aren't enough */
  children?: ReactNode
  /** Aria label for the trigger button */
  label?: string
  className?: string
}

function InfoIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-4 h-4">
      <circle cx="12" cy="12" r="9" />
      <path strokeLinecap="round" d="M12 11v5M12 8h.01" />
    </svg>
  )
}

function CloseIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-5 h-5">
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18 18 6M6 6l12 12" />
    </svg>
  )
}

/**
 * Reusable help trigger + info sheet.
 * Drop next to a heading anywhere in the app; content is passed per call site.
 */
export function HelpInfo({
  title,
  subtitle,
  sections,
  children,
  label = 'Ajuda',
  className = '',
}: HelpInfoProps) {
  const [open, setOpen] = useState(false)
  const titleId = useId()

  useEffect(() => {
    if (!open) return
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') setOpen(false)
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open])

  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        aria-label={label}
        className={`inline-flex items-center justify-center w-8 h-8 rounded-full text-nourish-text-dim border border-nourish-border bg-nourish-surface active:bg-nourish-surface-high focus:outline-none focus:ring-2 focus:ring-nourish-primary ${className}`}
      >
        <InfoIcon />
      </button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-end justify-center">
          <button
            type="button"
            className="absolute inset-0 bg-black/60"
            aria-label="Fechar"
            onClick={() => setOpen(false)}
          />
          <div
            role="dialog"
            aria-modal="true"
            aria-labelledby={titleId}
            className="relative w-full max-w-sm bg-nourish-surface rounded-t-2xl max-h-[min(85vh,640px)] flex flex-col border-t border-nourish-border"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
          >
            <div className="flex items-start justify-between gap-3 p-4 border-b border-nourish-border/60 shrink-0">
              <div className="min-w-0">
                <p id={titleId} className="text-sm font-semibold text-nourish-text">
                  {title}
                </p>
                {subtitle && (
                  <p className="text-xs text-nourish-text-dim mt-0.5">{subtitle}</p>
                )}
              </div>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="p-1.5 -mr-1 text-nourish-text-dim focus:outline-none focus:ring-2 focus:ring-nourish-primary rounded-lg"
                aria-label="Fechar"
              >
                <CloseIcon />
              </button>
            </div>

            <div className="overflow-y-auto p-4 space-y-4 flex-1 min-h-0">
              {sections?.map((section) => (
                <div key={section.title}>
                  <p className="text-xs font-semibold text-nourish-primary uppercase tracking-wider mb-1">
                    {section.title}
                  </p>
                  <p className="text-sm text-nourish-text leading-relaxed">{section.body}</p>
                </div>
              ))}
              {children}
            </div>
          </div>
        </div>
      )}
    </>
  )
}
