import { useEffect, useState } from 'react'
import { useHouseholdProfiles } from '../hooks/useHouseholdProfiles'
import type { HouseholdProfile } from '../utils/householdProfiles'

function Avatar({ profile, selected }: { profile: HouseholdProfile; selected?: boolean }) {
  return (
    <span
      className={`inline-flex h-16 w-16 items-center justify-center rounded-full text-xl font-bold text-nourish-bg ${
        selected ? 'ring-2 ring-nourish-primary ring-offset-2 ring-offset-nourish-bg' : ''
      }`}
      style={{ backgroundColor: profile.color }}
      aria-hidden
    >
      {profile.name.trim().charAt(0).toUpperCase() || '?'}
    </span>
  )
}

interface ProfilePickerProps {
  /** Compact mode for settings (no full-screen). */
  embedded?: boolean
  onPicked?: () => void
}

export function ProfilePicker({ embedded = false, onPicked }: ProfilePickerProps) {
  const { profiles, activeId, loading, selectProfile, addProfile, renameProfile } = useHouseholdProfiles()
  const [adding, setAdding] = useState(false)
  const [newName, setNewName] = useState('')
  const [renamingId, setRenamingId] = useState<string | null>(null)
  const [renameValue, setRenameValue] = useState('')

  useEffect(() => {
    if (!embedded && activeId) onPicked?.()
  }, [activeId, embedded, onPicked])

  async function handleAdd() {
    const created = await addProfile(newName)
    if (created) {
      setNewName('')
      setAdding(false)
      selectProfile(created.id)
      onPicked?.()
    }
  }

  async function handleRename(id: string) {
    await renameProfile(id, renameValue)
    setRenamingId(null)
    setRenameValue('')
  }

  const body = (
    <div className={`space-y-5 ${embedded ? '' : 'px-4 pt-16 pb-8'}`}>
      {!embedded && (
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-nourish-text">Quem está a usar?</h1>
          <p className="text-sm text-nourish-text-dim">Escolhe o teu perfil — sem palavra-passe.</p>
        </div>
      )}

      {loading ? (
        <p className="text-sm text-nourish-text-dim text-center">A carregar…</p>
      ) : (
        <div className="grid grid-cols-2 gap-3">
          {profiles.map((p) => (
            <div key={p.id} className="flex flex-col items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  selectProfile(p.id)
                  onPicked?.()
                }}
                className="flex flex-col items-center gap-2 p-3 rounded-2xl w-full bg-nourish-surface border border-nourish-border active:border-nourish-primary focus:outline-none focus:ring-2 focus:ring-nourish-primary"
              >
                <Avatar profile={p} selected={activeId === p.id} />
                <span className="text-sm font-semibold text-nourish-text truncate max-w-full">
                  {p.name}
                </span>
              </button>
              {embedded && (
                <button
                  type="button"
                  className="text-[11px] text-nourish-text-dim"
                  onClick={() => {
                    setRenamingId(p.id)
                    setRenameValue(p.name)
                  }}
                >
                  Renomear
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {renamingId && (
        <div className="flex gap-2">
          <input
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            className="flex-1 px-3 py-2 rounded-xl bg-nourish-surface border border-nourish-border text-nourish-text text-sm focus:outline-none focus:ring-2 focus:ring-nourish-primary"
            autoFocus
          />
          <button
            type="button"
            onClick={() => void handleRename(renamingId)}
            className="px-3 py-2 rounded-xl bg-nourish-primary text-nourish-on-primary text-sm font-semibold"
          >
            OK
          </button>
        </div>
      )}

      {adding ? (
        <div className="flex gap-2">
          <input
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            placeholder="Nome"
            className="flex-1 px-3 py-2 rounded-xl bg-nourish-surface border border-nourish-border text-nourish-text text-sm focus:outline-none focus:ring-2 focus:ring-nourish-primary"
            autoFocus
          />
          <button
            type="button"
            onClick={() => void handleAdd()}
            className="px-3 py-2 rounded-xl bg-nourish-primary text-nourish-on-primary text-sm font-semibold"
          >
            Criar
          </button>
          <button
            type="button"
            onClick={() => setAdding(false)}
            className="px-3 py-2 text-sm text-nourish-text-dim"
          >
            Cancelar
          </button>
        </div>
      ) : (
        <button
          type="button"
          onClick={() => setAdding(true)}
          className="w-full py-2.5 rounded-xl border border-dashed border-nourish-border text-nourish-text-dim text-sm font-semibold"
        >
          Adicionar perfil
        </button>
      )}
    </div>
  )

  if (embedded) return body
  return <div className="min-h-screen bg-nourish-bg">{body}</div>
}
