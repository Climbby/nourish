import { useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { grocy } from '../api/grocy'

function BackIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-6 h-6">
      <path
        fillRule="evenodd"
        d="M7.72 12.53a.75.75 0 0 1 0-1.06l7.5-7.5a.75.75 0 1 1 1.06 1.06L9.31 12l6.97 6.97a.75.75 0 1 1-1.06 1.06l-7.5-7.5Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

function CameraIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-gray-300">
      <path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
      <path
        fillRule="evenodd"
        d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 0 1-3 3h-15a3 3 0 0 1-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 0 0 1.11-.71l.822-1.315a2.942 2.942 0 0 1 2.332-1.39ZM6.75 12.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Zm12-1.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z"
        clipRule="evenodd"
      />
    </svg>
  )
}

const inputClass =
  'w-full px-4 py-3 bg-white border rounded-xl text-gray-900 placeholder-gray-400 text-sm focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-1 transition-shadow'

export function AddMeal() {
  const navigate = useNavigate()
  const fileRef = useRef<HTMLInputElement>(null)

  const [photoFile, setPhotoFile] = useState<File | null>(null)
  const [photoPreview, setPhotoPreview] = useState<string | null>(null)
  const [name, setName] = useState('')
  const [ingredientes, setIngredientes] = useState('')
  const [comoFazer, setComoFazer] = useState('')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [nameError, setNameError] = useState(false)

  function handlePhoto(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    if (!file) return
    setPhotoFile(file)
    setPhotoPreview(URL.createObjectURL(file))
  }

  async function handleSave() {
    if (!name.trim()) {
      setNameError(true)
      return
    }
    setNameError(false)
    setSaving(true)
    setError(null)

    try {
      let pictureName: string | null = null
      if (photoFile) {
        pictureName = await grocy.uploadPicture(photoFile)
      }

      const parts: string[] = []
      if (ingredientes.trim()) parts.push(`[Ingredientes]\n${ingredientes.trim()}`)
      if (comoFazer.trim()) parts.push(`[Passos]\n${comoFazer.trim()}`)
      const description = parts.join('\n\n')

      await grocy.createRecipe({
        name: name.trim(),
        description,
        base_servings: 1,
        desired_servings: 1,
        not_check_shoppinglist: 0,
        ...(pictureName ? { picture_file_name: pictureName } : {}),
      })

      navigate('/')
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Erro desconhecido')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="min-h-screen">
      <header className="flex items-center gap-3 px-4 pt-12 pb-4 bg-white border-b border-gray-100">
        <button
          onClick={() => navigate(-1)}
          className="p-2 -ml-2 text-gray-600 rounded-lg focus:outline-none focus:ring-2 focus:ring-green-500"
        >
          <BackIcon />
        </button>
        <h2 className="font-semibold text-gray-900 text-lg">Nova Refeição</h2>
      </header>

      <div className="p-4 space-y-5" style={{ paddingBottom: 'calc(env(safe-area-inset-bottom, 0px) + 100px)' }}>
        {/* Photo upload */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-2">Foto</label>
          <button
            onClick={() => fileRef.current?.click()}
            className="w-full bg-gray-50 border-2 border-dashed border-gray-200 rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-2 active:bg-gray-100 transition-colors focus:outline-none focus:ring-2 focus:ring-green-500"
            style={{ aspectRatio: '4/3' }}
          >
            {photoPreview ? (
              <img src={photoPreview} className="w-full h-full object-cover" alt="preview" />
            ) : (
              <>
                <CameraIcon />
                <p className="text-sm text-gray-400">Toca para adicionar foto</p>
              </>
            )}
          </button>
          <input ref={fileRef} type="file" accept="image/*" className="hidden" onChange={handlePhoto} />
        </div>

        {/* Name */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Nome <span className="text-red-400">*</span>
          </label>
          <input
            type="text"
            value={name}
            onChange={(e) => {
              setName(e.target.value)
              setNameError(false)
            }}
            placeholder="Ex: Esparguete com atum"
            className={`${inputClass} ${nameError ? 'border-red-400' : 'border-gray-200'}`}
          />
          {nameError && <p className="text-red-500 text-xs mt-1">Nome é obrigatório</p>}
        </div>

        {/* Ingredients */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Ingredientes{' '}
            <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea
            value={ingredientes}
            onChange={(e) => setIngredientes(e.target.value)}
            rows={3}
            placeholder="Ex: esparguete, carne picada, molho de tomate"
            className={`${inputClass} border-gray-200 resize-none`}
          />
        </div>

        {/* Steps */}
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1.5">
            Como fazer{' '}
            <span className="text-gray-400 font-normal">(opcional)</span>
          </label>
          <textarea
            value={comoFazer}
            onChange={(e) => setComoFazer(e.target.value)}
            rows={5}
            placeholder="Descreve os passos de preparação..."
            className={`${inputClass} border-gray-200 resize-none`}
          />
        </div>

        {error && (
          <div className="p-3 bg-red-50 border border-red-200 text-red-700 rounded-xl text-sm">{error}</div>
        )}
      </div>

      {/* Save button — fixed at bottom */}
      <div
        className="fixed bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm bg-white border-t border-gray-100 p-4"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
      >
        <button
          onClick={handleSave}
          disabled={saving}
          className="w-full bg-green-600 text-white font-semibold py-3.5 rounded-xl active:bg-green-700 transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-green-500 focus:ring-offset-2"
        >
          {saving ? 'A guardar...' : 'Guardar refeição'}
        </button>
      </div>
    </div>
  )
}
