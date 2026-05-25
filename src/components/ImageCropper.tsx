import { useRef, useState } from 'react'

const OUT_W = 1200
const OUT_H = 900

function clamp(v: number, lo: number, hi: number) {
  return v < lo ? lo : v > hi ? hi : v
}

interface Props {
  src: string
  onConfirm: (file: File) => void
  onCancel: () => void
}

export function ImageCropper({ src, onConfirm, onCancel }: Props) {
  const containerRef = useRef<HTMLDivElement>(null)
  const imgRef = useRef<HTMLImageElement>(null)
  const [ready, setReady] = useState(false)

  const natW = useRef(0)
  const natH = useRef(0)
  const cropW = useRef(0)
  const cropH = useRef(0)
  const minS = useRef(1)

  const [scale, setScale] = useState(1)
  const [off, setOff] = useState({ x: 0, y: 0 })
  const liveScale = useRef(1)
  const liveOff = useRef({ x: 0, y: 0 })

  function apply(s: number, o: { x: number; y: number }) {
    liveScale.current = s
    liveOff.current = o
    setScale(s)
    setOff(o)
  }

  function clampOff(ox: number, oy: number, s: number) {
    const mx = Math.max(0, (natW.current * s) / 2 - cropW.current / 2)
    const my = Math.max(0, (natH.current * s) / 2 - cropH.current / 2)
    return { x: clamp(ox, -mx, mx), y: clamp(oy, -my, my) }
  }

  function onImgLoad() {
    const img = imgRef.current!
    const container = containerRef.current!
    natW.current = img.naturalWidth
    natH.current = img.naturalHeight
    const cw = container.clientWidth * 0.88
    const ch = cw * (3 / 4)
    cropW.current = cw
    cropH.current = ch
    const ms = Math.max(cw / img.naturalWidth, ch / img.naturalHeight)
    minS.current = ms
    apply(ms, { x: 0, y: 0 })
    setReady(true)
  }

  const ptrs = useRef(new Map<number, { x: number; y: number }>())
  const gRef = useRef<{
    mode: 'pan' | 'pinch'
    startOff: { x: number; y: number }
    startScale: number
    p0x: number
    p0y: number
    startDist: number
    startMidX: number
    startMidY: number
  } | null>(null)

  function onPtrDown(e: React.PointerEvent<HTMLDivElement>) {
    e.currentTarget.setPointerCapture(e.pointerId)
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })

    if (ptrs.current.size === 1) {
      gRef.current = {
        mode: 'pan',
        startOff: { ...liveOff.current },
        startScale: liveScale.current,
        p0x: e.clientX, p0y: e.clientY,
        startDist: 0, startMidX: 0, startMidY: 0,
      }
    } else if (ptrs.current.size === 2) {
      const [a, b] = [...ptrs.current.values()]
      gRef.current = {
        mode: 'pinch',
        startOff: { ...liveOff.current },
        startScale: liveScale.current,
        p0x: 0, p0y: 0,
        startDist: Math.hypot(b.x - a.x, b.y - a.y),
        startMidX: (a.x + b.x) / 2,
        startMidY: (a.y + b.y) / 2,
      }
    }
  }

  function onPtrMove(e: React.PointerEvent<HTMLDivElement>) {
    if (!ptrs.current.has(e.pointerId)) return
    ptrs.current.set(e.pointerId, { x: e.clientX, y: e.clientY })
    const g = gRef.current
    if (!g) return

    if (g.mode === 'pan' && ptrs.current.size === 1) {
      apply(g.startScale, clampOff(g.startOff.x + e.clientX - g.p0x, g.startOff.y + e.clientY - g.p0y, g.startScale))
    } else if (g.mode === 'pinch' && ptrs.current.size >= 2) {
      const [a, b] = [...ptrs.current.values()]
      const dist = Math.hypot(b.x - a.x, b.y - a.y)
      const midX = (a.x + b.x) / 2
      const midY = (a.y + b.y) / 2
      const newS = clamp(g.startScale * (dist / g.startDist), minS.current, minS.current * 6)
      apply(newS, clampOff(g.startOff.x + midX - g.startMidX, g.startOff.y + midY - g.startMidY, newS))
    }
  }

  function onPtrUp(e: React.PointerEvent<HTMLDivElement>) {
    ptrs.current.delete(e.pointerId)
    if (ptrs.current.size === 1 && gRef.current?.mode === 'pinch') {
      const [[, p]] = [...ptrs.current.entries()]
      gRef.current = { mode: 'pan', startOff: { ...liveOff.current }, startScale: liveScale.current, p0x: p.x, p0y: p.y, startDist: 0, startMidX: 0, startMidY: 0 }
    } else if (ptrs.current.size === 0) {
      gRef.current = null
    }
  }

  function confirm() {
    const img = imgRef.current!
    const s = liveScale.current
    const { x: ox, y: oy } = liveOff.current
    const cw = cropW.current
    const ch = cropH.current
    const nw = natW.current
    const nh = natH.current
    const srcX = nw / 2 - (cw / 2 + ox) / s
    const srcY = nh / 2 - (ch / 2 + oy) / s
    const canvas = document.createElement('canvas')
    canvas.width = OUT_W
    canvas.height = OUT_H
    canvas.getContext('2d')!.drawImage(img, srcX, srcY, cw / s, ch / s, 0, 0, OUT_W, OUT_H)
    canvas.toBlob(
      (blob) => { if (blob) onConfirm(new File([blob], 'photo.jpg', { type: 'image/jpeg' })) },
      'image/jpeg', 0.92
    )
  }

  const cw = cropW.current
  const ch = cropH.current

  const corners = [
    { top: `calc(50% - ${ch / 2 + 1}px)`, left: `calc(50% - ${cw / 2 + 1}px)`, borderTop: '3px solid white', borderLeft: '3px solid white' },
    { top: `calc(50% - ${ch / 2 + 1}px)`, right: `calc(50% - ${cw / 2 + 1}px)`, borderTop: '3px solid white', borderRight: '3px solid white' },
    { bottom: `calc(50% - ${ch / 2 + 1}px)`, left: `calc(50% - ${cw / 2 + 1}px)`, borderBottom: '3px solid white', borderLeft: '3px solid white' },
    { bottom: `calc(50% - ${ch / 2 + 1}px)`, right: `calc(50% - ${cw / 2 + 1}px)`, borderBottom: '3px solid white', borderRight: '3px solid white' },
  ] as const

  return (
    <div className="fixed inset-0 z-50 bg-black flex flex-col" style={{ touchAction: 'none' }}>
      <div
        ref={containerRef}
        className="flex-1 relative overflow-hidden select-none"
        onPointerDown={onPtrDown}
        onPointerMove={onPtrMove}
        onPointerUp={onPtrUp}
        onPointerCancel={onPtrUp}
      >
        <img
          ref={imgRef}
          src={src}
          onLoad={onImgLoad}
          draggable={false}
          alt=""
          className="absolute pointer-events-none"
          style={ready ? {
            width: natW.current,
            height: natH.current,
            left: '50%',
            top: '50%',
            transform: `translate(calc(-50% + ${off.x}px), calc(-50% + ${off.y}px)) scale(${scale})`,
            transformOrigin: '50% 50%',
          } : { opacity: 0 }}
        />

        {ready && (
          <div className="absolute inset-0 pointer-events-none">
            <div className="absolute inset-x-0 top-0 bg-black/60" style={{ height: `calc(50% - ${ch / 2}px)` }} />
            <div className="absolute inset-x-0 bottom-0 bg-black/60" style={{ height: `calc(50% - ${ch / 2}px)` }} />
            <div className="absolute bg-black/60" style={{ top: `calc(50% - ${ch / 2}px)`, bottom: `calc(50% - ${ch / 2}px)`, left: 0, width: `calc(50% - ${cw / 2}px)` }} />
            <div className="absolute bg-black/60" style={{ top: `calc(50% - ${ch / 2}px)`, bottom: `calc(50% - ${ch / 2}px)`, right: 0, width: `calc(50% - ${cw / 2}px)` }} />
            <div className="absolute border border-white/50" style={{ top: `calc(50% - ${ch / 2}px)`, left: `calc(50% - ${cw / 2}px)`, width: cw, height: ch }} />
            {corners.map((style, i) => (
              <div key={i} className="absolute w-6 h-6" style={style} />
            ))}
          </div>
        )}

        {!ready && (
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-8 h-8 border-2 border-white border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      <p className="text-white/40 text-xs text-center py-2 bg-black">Arrasta para mover · Aperta para zoom</p>

      <div
        className="px-4 pb-4 flex gap-3 bg-black"
        style={{ paddingBottom: 'max(env(safe-area-inset-bottom, 0px), 16px)' }}
      >
        <button
          onClick={onCancel}
          className="flex-1 py-3.5 rounded-xl border border-white/20 text-white/70 font-semibold text-sm"
        >
          Cancelar
        </button>
        <button
          onClick={confirm}
          disabled={!ready}
          className="flex-1 py-3.5 rounded-xl bg-white text-black font-semibold text-sm disabled:opacity-40"
        >
          Usar foto
        </button>
      </div>
    </div>
  )
}
