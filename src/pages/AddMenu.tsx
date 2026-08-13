import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { BottomNav } from '../components/BottomNav'
import { HelpInfo } from '../components/HelpInfo'
import { Spinner } from '../components/Spinner'
import { loadAddMenuPreviews, type AddMenuPreviews } from '../utils/addMenuPreviews'

type AddType = 'completa' | 'ligeira' | 'despensa' | 'receipt'

const OPTIONS: {
  type: AddType
  label: string
  desc: string
  previewKey?: keyof AddMenuPreviews
  /** Static image (e.g. Talão illustration) when not loaded from Grocy */
  imageUrl?: string
  /** Fallback when no photo — solid tint */
  tint: string
}[] = [
  {
    type: 'completa',
    label: 'Refeição\ncompleta',
    desc: 'Almoço, jantar ou prato principal',
    previewKey: 'completa',
    tint: 'bg-emerald-950',
  },
  {
    type: 'ligeira',
    label: 'Refeição\nligeira',
    desc: 'Snack, petisco ou lanche',
    previewKey: 'ligeira',
    tint: 'bg-amber-950',
  },
  {
    type: 'despensa',
    label: 'Despensa',
    desc: 'Água, leite, pão, cereais…',
    previewKey: 'despensa',
    tint: 'bg-sky-950',
  },
  {
    type: 'receipt',
    label: 'Talão',
    desc: 'Ler talão e atualizar stock com preços',
    tint: 'bg-violet-950',
    imageUrl: '/talao.svg',
  },
]

function AddTile({
  label,
  imageUrl,
  tint,
  onClick,
}: {
  label: string
  imageUrl?: string
  tint: string
  onClick: () => void
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`relative w-full h-full rounded-2xl overflow-hidden text-left focus:outline-none focus:ring-2 focus:ring-nourish-primary focus:ring-offset-2 focus:ring-offset-nourish-bg active:scale-[0.98] transition-transform ${tint}`}
    >
      {imageUrl && (
        <img
          src={imageUrl}
          alt=""
          className="absolute inset-0 w-full h-full object-cover"
        />
      )}
      <div className="absolute inset-0 bg-black/55" aria-hidden />
      <div className="relative z-10 flex h-full items-end p-4">
        <span className="text-white text-xl font-bold leading-tight whitespace-pre-line drop-shadow-sm">
          {label}
        </span>
      </div>
    </button>
  )
}

export function AddMenu() {
  const navigate = useNavigate()
  const [previews, setPreviews] = useState<AddMenuPreviews | null>(null)

  useEffect(() => {
    let cancelled = false
    loadAddMenuPreviews().then((next) => {
      if (!cancelled) setPreviews(next)
    })
    return () => {
      cancelled = true
    }
  }, [])

  function go(type: AddType) {
    if (type === 'receipt') navigate('/receipt')
    else navigate(`/add?type=${type}`)
  }

  return (
    <div className="h-[100dvh] bg-nourish-bg flex flex-col">
      <header className="px-4 pt-12 pb-3 flex items-center justify-between gap-2 flex-shrink-0">
        <h1 className="text-2xl font-bold text-nourish-text">Adicionar</h1>
        <HelpInfo
          title="O que podes adicionar"
          label="Ajuda sobre adicionar"
          sections={OPTIONS.map(({ label, desc }) => ({
            title: label.replace(/\n/g, ' '),
            body: desc,
          }))}
        />
      </header>

      <main
        className="flex-1 min-h-0 px-3 pb-3 grid grid-cols-2 grid-rows-2 gap-3"
        style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 80px)' }}
      >
        {previews == null ? (
          <div className="col-span-2 row-span-2 flex items-center justify-center">
            <Spinner />
          </div>
        ) : (
          OPTIONS.map(({ type, label, previewKey, tint, imageUrl }) => (
            <AddTile
              key={type}
              label={label}
              tint={tint}
              imageUrl={imageUrl ?? (previewKey ? previews[previewKey][0] : undefined)}
              onClick={() => go(type)}
            />
          ))
        )}
      </main>

      <BottomNav />
    </div>
  )
}
