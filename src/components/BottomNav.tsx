import { useState } from 'react'
import { NavLink, useNavigate } from 'react-router-dom'

function HomeIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path d="M11.47 3.841a.75.75 0 0 1 1.06 0l8.69 8.69a.75.75 0 1 0 1.06-1.061l-8.689-8.69a2.25 2.25 0 0 0-3.182 0l-8.69 8.69a.75.75 0 1 0 1.061 1.06l8.69-8.689Z" />
      <path d="m12 5.432 8.159 8.159c.03.03.06.058.091.086v6.198c0 1.035-.84 1.875-1.875 1.875H15a.75.75 0 0 1-.75-.75v-4.5a.75.75 0 0 0-.75-.75h-3a.75.75 0 0 0-.75.75V21a.75.75 0 0 1-.75.75H5.625a1.875 1.875 0 0 1-1.875-1.875v-6.198a2.29 2.29 0 0 0 .091-.086L12 5.432Z" />
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

function HeartIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path d="m11.645 20.91-.007-.003-.022-.012a15.247 15.247 0 0 1-.383-.218 25.18 25.18 0 0 1-4.244-3.17C4.688 15.36 2.25 12.174 2.25 8.25 2.25 5.322 4.714 3 7.688 3A5.5 5.5 0 0 1 12 5.052 5.5 5.5 0 0 1 16.313 3c2.973 0 5.437 2.322 5.437 5.25 0 3.925-2.438 7.111-4.739 9.256a25.175 25.175 0 0 1-4.244 3.17 15.247 15.247 0 0 1-.383.219l-.022.012-.007.004-.003.001a.752.752 0 0 1-.704 0l-.003-.001Z" />
    </svg>
  )
}

function ClockIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path fillRule="evenodd" d="M12 2.25c-5.385 0-9.75 4.365-9.75 9.75s4.365 9.75 9.75 9.75 9.75-4.365 9.75-9.75S17.385 2.25 12 2.25ZM12.75 6a.75.75 0 0 0-1.5 0v6c0 .414.336.75.75.75h4.5a.75.75 0 0 0 0-1.5h-3.75V6Z" clipRule="evenodd" />
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

const ADD_OPTIONS = [
  { type: 'completa', label: 'Refeição completa', desc: 'Almoço, jantar ou prato principal' },
  { type: 'ligeira', label: 'Refeição ligeira', desc: 'Snack, petisco ou lanche' },
  { type: 'despensa', label: 'Produto de despensa', desc: 'Água, leite, pão, cereais…' },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex-1 flex flex-col items-center justify-center py-1.5 gap-0.5 text-[9px] font-medium transition-colors min-h-[56px] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-nourish-primary ${
    isActive ? 'text-nourish-primary' : 'text-nourish-text-dim'
  }`

export function BottomNav() {
  const navigate = useNavigate()
  const [showSheet, setShowSheet] = useState(false)

  function handleOption(type: string) {
    setShowSheet(false)
    navigate(`/add?type=${type}`)
  }

  return (
    <>
      {showSheet && (
        <div
          className="fixed inset-0 z-50 bg-black/60"
          onClick={() => setShowSheet(false)}
        >
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm bg-nourish-surface rounded-t-2xl"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 space-y-2">
              <p className="text-xs text-nourish-text-dim text-center pb-1">O que queres adicionar?</p>
              {ADD_OPTIONS.map(({ type, label, desc }) => (
                <button
                  key={type}
                  onClick={() => handleOption(type)}
                  className="w-full py-4 bg-nourish-surface-high rounded-xl text-nourish-text font-semibold text-sm flex flex-col items-center justify-center gap-0.5 active:opacity-80 focus:outline-none"
                >
                  {label}
                  <span className="text-xs font-normal text-nourish-text-dim">{desc}</span>
                </button>
              ))}
              <button
                onClick={() => setShowSheet(false)}
                className="w-full py-3 text-nourish-text-dim text-sm focus:outline-none"
              >
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <nav
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm bg-nourish-surface border-t border-nourish-border flex z-40"
        style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      >
        <NavLink to="/" end className={linkClass}>
          <HomeIcon />
          Refeições
        </NavLink>
        <button
          onClick={() => setShowSheet(true)}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium text-nourish-text-dim transition-colors min-h-[56px] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-nourish-primary"
        >
          <PlusIcon />
          Adicionar
        </button>
        <NavLink to="/favourites" className={linkClass}>
          <HeartIcon />
          Favoritos
        </NavLink>
        <NavLink to="/history" className={linkClass}>
          <ClockIcon />
          Historial
        </NavLink>
        <NavLink to="/profile" className={linkClass}>
          <UserIcon />
          Perfil
        </NavLink>
      </nav>
    </>
  )
}
