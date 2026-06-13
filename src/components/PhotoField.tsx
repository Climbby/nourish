import { useRef, useState } from 'react'
import { ImageCropper } from './ImageCropper'

function BigCameraIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-10 h-10 text-nourish-border">
      <path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
      <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 0 1-3 3h-15a3 3 0 0 1-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 0 0 1.11-.71l.822-1.315a2.942 2.942 0 0 1 2.332-1.39ZM6.75 12.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Zm12-1.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
    </svg>
  )
}

function SmallCameraIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path d="M12 9a3.75 3.75 0 1 0 0 7.5A3.75 3.75 0 0 0 12 9Z" />
      <path fillRule="evenodd" d="M9.344 3.071a49.52 49.52 0 0 1 5.312 0c.967.052 1.83.585 2.332 1.39l.821 1.317c.24.383.645.643 1.11.71.386.054.77.113 1.152.177 1.432.239 2.429 1.493 2.429 2.909V18a3 3 0 0 1-3 3h-15a3 3 0 0 1-3-3V9.574c0-1.416.997-2.67 2.429-2.909.382-.064.766-.123 1.151-.178a1.56 1.56 0 0 0 1.11-.71l.822-1.315a2.942 2.942 0 0 1 2.332-1.39ZM6.75 12.75a5.25 5.25 0 1 1 10.5 0 5.25 5.25 0 0 1-10.5 0Zm12-1.5a.75.75 0 1 0 0-1.5.75.75 0 0 0 0 1.5Z" clipRule="evenodd" />
    </svg>
  )
}

function GalleryIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
      <path fillRule="evenodd" d="M1.5 6a2.25 2.25 0 0 1 2.25-2.25h16.5A2.25 2.25 0 0 1 22.5 6v12a2.25 2.25 0 0 1-2.25 2.25H3.75A2.25 2.25 0 0 1 1.5 18V6ZM3 16.06V18c0 .414.336.75.75.75h16.5A.75.75 0 0 0 21 18v-1.94l-2.69-2.689a1.5 1.5 0 0 0-2.12 0l-.88.879.97.97a.75.75 0 1 1-1.06 1.06l-5.16-5.159a1.5 1.5 0 0 0-2.12 0L3 16.061Zm10.125-7.81a1.125 1.125 0 1 1 2.25 0 1.125 1.125 0 0 1-2.25 0Z" clipRule="evenodd" />
    </svg>
  )
}

interface Props {
  preview: string | null
  onChange: (file: File, previewUrl: string) => void
  labelClass: string
}

export function PhotoField({ preview, onChange, labelClass }: Props) {
  const galleryRef = useRef<HTMLInputElement>(null)
  const cameraRef = useRef<HTMLInputElement>(null)
  const [showSheet, setShowSheet] = useState(false)
  const [cropSrc, setCropSrc] = useState<string | null>(null)

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setCropSrc(URL.createObjectURL(file))
  }

  function handleCropConfirm(file: File) {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
    const url = URL.createObjectURL(file)
    onChange(file, url)
  }

  function handleCropCancel() {
    if (cropSrc) URL.revokeObjectURL(cropSrc)
    setCropSrc(null)
  }

  return (
    <>
      {cropSrc && <ImageCropper src={cropSrc} onConfirm={handleCropConfirm} onCancel={handleCropCancel} />}

      {showSheet && (
        <div className="fixed inset-0 z-40 bg-black/60" onClick={() => setShowSheet(false)}>
          <div
            className="absolute bottom-0 left-1/2 -translate-x-1/2 w-full max-w-sm bg-nourish-surface rounded-t-2xl"
            style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
            onClick={(e) => e.stopPropagation()}
          >
            <div className="p-4 space-y-2">
              <button
                onClick={() => { setShowSheet(false); setTimeout(() => cameraRef.current?.click(), 50) }}
                className="w-full py-4 bg-nourish-surface-high rounded-xl text-nourish-text font-semibold text-sm flex items-center justify-center gap-3 active:opacity-80"
              >
                <SmallCameraIcon />
                Tirar foto
              </button>
              <button
                onClick={() => { setShowSheet(false); setTimeout(() => galleryRef.current?.click(), 50) }}
                className="w-full py-4 bg-nourish-surface-high rounded-xl text-nourish-text font-semibold text-sm flex items-center justify-center gap-3 active:opacity-80"
              >
                <GalleryIcon />
                Escolher da galeria
              </button>
              <button onClick={() => setShowSheet(false)} className="w-full py-3 text-nourish-text-dim text-sm">
                Cancelar
              </button>
            </div>
          </div>
        </div>
      )}

      <div>
        <label className={labelClass}>Foto</label>
        <button
          type="button"
          onClick={() => setShowSheet(true)}
          className="relative w-full bg-nourish-surface border-2 border-dashed border-nourish-border rounded-2xl overflow-hidden flex flex-col items-center justify-center gap-2 active:bg-nourish-surface-high transition-colors focus:outline-none focus:ring-2 focus:ring-nourish-primary"
          style={{ aspectRatio: '4/3' }}
        >
          {preview
            ? <img src={preview} className="absolute inset-0 w-full h-full object-cover" alt="preview" />
            : <><BigCameraIcon /><p className="text-sm text-nourish-text-dim">Toca para adicionar foto</p></>
          }
        </button>
        <input ref={galleryRef} type="file" accept="image/*" className="hidden" onChange={handleFileSelect} />
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={handleFileSelect} />
      </div>
    </>
  )
}
