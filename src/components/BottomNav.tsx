import { NavLink } from 'react-router-dom'
import { getLastNavPath } from '../utils/navMemory'

/** Fork · plate · knife — same motif as “Restaurante” on Planear */
function DiningIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.75" className="w-6 h-6" aria-hidden>
      <path strokeLinecap="round" d="M3.5 3.5v4M5 3.5v4M6.5 3.5v4" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.5 7.5h3V9c0 1-.75 1.75-1.5 1.75H5v8.75" />
      <circle cx="12" cy="12" r="5" />
      <circle cx="12" cy="12" r="2.75" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M18.5 3.5c1.25 0 2.25 1 2.25 2.5V11H18.5V3.5Z" />
      <path strokeLinecap="round" d="M19.75 11v8.5" />
    </svg>
  )
}

function PlusIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path fillRule="evenodd" d="M12 3.75a.75.75 0 0 1 .75.75v6.75h6.75a.75.75 0 0 1 0 1.5h-6.75v6.75a.75.75 0 0 1-1.5 0v-6.75H4.5a.75.75 0 0 1 0-1.5h6.75V4.5a.75.75 0 0 1 .75-.75Z" clipRule="evenodd" />
    </svg>
  )
}

function UserIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path fillRule="evenodd" d="M7.5 6a4.5 4.5 0 1 1 9 0 4.5 4.5 0 0 1-9 0ZM3.751 20.105a8.25 8.25 0 0 1 16.498 0 .75.75 0 0 1-.437.695A18.683 18.683 0 0 1 12 22.5c-2.786 0-5.433-.608-7.812-1.7a.75.75 0 0 1-.437-.695Z" clipRule="evenodd" />
    </svg>
  )
}

function CalendarIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="w-6 h-6">
      <rect x="3" y="4" width="18" height="18" rx="2" />
      <path strokeLinecap="round" d="M16 2v4M8 2v4M3 10h18" />
    </svg>
  )
}

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors min-h-[56px] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-nourish-primary ${
    isActive ? 'text-nourish-primary' : 'text-nourish-text-dim'
  }`

export function BottomNav() {
  return (
    <nav
      className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm bg-nourish-surface border-t border-nourish-border flex z-40"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
    >
      <NavLink to={getLastNavPath('plan')} className={linkClass}>
        <CalendarIcon />
        Planear
      </NavLink>
      <NavLink to={getLastNavPath('meals')} className={linkClass}>
        <DiningIcon />
        Refeições
      </NavLink>
      <NavLink to="/adicionar" className={linkClass}>
        <PlusIcon />
        Adicionar
      </NavLink>
      <NavLink to={getLastNavPath('profile')} className={linkClass}>
        <UserIcon />
        Perfil
      </NavLink>
    </nav>
  )
}
