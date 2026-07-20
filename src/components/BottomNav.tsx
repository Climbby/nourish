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

const ADD_OPTIONS = [
  { type: 'completa', label: 'Refeição completa', desc: 'Almoço, jantar ou prato principal' },
  { type: 'ligeira', label: 'Refeição ligeira', desc: 'Snack, petisco ou lanche' },
  { type: 'despensa', label: 'Produto de despensa', desc: 'Água, leite, pão, cereais…' },
  { type: 'receipt', label: 'Compra (talão)', desc: 'Ler talão e atualizar stock com preços' },
]

const linkClass = ({ isActive }: { isActive: boolean }) =>
  `flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium transition-colors min-h-[56px] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-nourish-primary ${
    isActive ? 'text-nourish-primary' : 'text-nourish-text-dim'
  }`

export function BottomNav() {
  const navigate = useNavigate()
  const [showSheet, setShowSheet] = useState(false)

  function handleOption(type: string) {
    setShowSheet(false)
    if (type === 'receipt') {
      navigate('/receipt')
    } else {
      navigate(`/add?type=${type}`)
    }
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
        <NavLink to="/meals" className={linkClass}>
          <HomeIcon />
          Refeições
        </NavLink>
        <NavLink to="/plan" className={linkClass}>
          <CalendarIcon />
          Planear
        </NavLink>
        <button
          onClick={() => setShowSheet(true)}
          className="flex-1 flex flex-col items-center justify-center py-2 gap-0.5 text-[10px] font-medium text-nourish-text-dim transition-colors min-h-[56px] focus:outline-none focus:ring-2 focus:ring-inset focus:ring-nourish-primary"
        >
          <PlusIcon />
          Adicionar
        </button>
        <NavLink to="/profile" className={linkClass}>
          <UserIcon />
          Perfil
        </NavLink>
      </nav>
    </>
  )
}
