import type { ReactNode } from 'react'
import { useHouseholdProfiles } from '../hooks/useHouseholdProfiles'
import { ProfilePicker } from './ProfilePicker'
import { Spinner } from './Spinner'

export function ProfileGate({ children }: { children: ReactNode }) {
  const { loading, needsPicker } = useHouseholdProfiles()

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-nourish-bg">
        <Spinner />
      </div>
    )
  }

  if (needsPicker) return <ProfilePicker />

  return <>{children}</>
}
