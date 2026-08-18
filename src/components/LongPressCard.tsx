import type { ReactNode } from 'react'
import { useLongPress } from '../hooks/useLongPress'

/** Card that fires `onLongPress` on tap-and-hold (ignores presses on controls). */
export function LongPressCard({
  children,
  className,
  onLongPress,
}: {
  children: ReactNode
  className?: string
  onLongPress: () => void
}) {
  const bind = useLongPress(onLongPress)
  return (
    <div
      className={className}
      style={{ WebkitTouchCallout: 'none' }}
      {...bind}
    >
      {children}
    </div>
  )
}
