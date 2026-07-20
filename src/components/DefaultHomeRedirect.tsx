import { Navigate } from 'react-router-dom'
import { useDisplayPrefs } from '../hooks/useDisplayPrefs'

/** Redirect `/` to the user's preferred home tab. */
export function DefaultHomeRedirect() {
  const { prefs } = useDisplayPrefs()
  return <Navigate to={prefs.defaultTab === 'meals' ? '/meals' : '/plan'} replace />
}
