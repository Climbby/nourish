import { useEffect, useRef, useState } from 'react'
import type { KnownSupermarketRef } from '../utils/supermarketSearch'
import {
  blockSupermarket,
  registerSupermarketVisit,
  trackSupermarket,
  type TrackedSupermarket,
} from '../utils/supermarkets'
import {
  coordsForTracking,
  filterKnownSupermarkets,
  findSupermarketNear,
  getCurrentPosition,
  haversineM,
  searchSupermarkets,
  SUPERMARKET_BRAND_CHIPS,
  type SupermarketSearchHit,
} from '../utils/supermarketSearch'

const AT_STORE_M = 250

interface Props {
  onChanged: () => void
  /** Tracked + ignored — hidden from “new” search results. */
  known?: KnownSupermarketRef[]
  /** Currently tracked stores — shown for “Registar ida” when nearby. */
  tracked?: TrackedSupermarket[]
}

function zoneIdForTracked(t: TrackedSupermarket): string {
  return t.zone_id || `zone.${t.place_key}`
}

export function SupermarketSearchAdd({ onChanged, known = [], tracked = [] }: Props) {
  const [query, setQuery] = useState('')
  const [results, setResults] = useState<SupermarketSearchHit[]>([])
  const [nearbyTracked, setNearbyTracked] = useState<
    { store: TrackedSupermarket; distanceM: number }[]
  >([])
  const [searching, setSearching] = useState(false)
  const [locating, setLocating] = useState(false)
  const [actingId, setActingId] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [hint, setHint] = useState<string | null>(null)
  const [near, setNear] = useState<{ latitude: number; longitude: number } | null>(null)
  /** GPS used for the current result list (Estou aqui / live location). */
  const [resultGps, setResultGps] = useState<{ latitude: number; longitude: number } | null>(null)
  const debounceRef = useRef<number | null>(null)

  useEffect(() => {
    let cancelled = false
    getCurrentPosition()
      .then((pos) => {
        if (!cancelled) setNear(pos)
      })
      .catch(() => {
        /* optional bias */
      })
    return () => {
      cancelled = true
    }
  }, [])

  useEffect(() => {
    if (debounceRef.current != null) window.clearTimeout(debounceRef.current)
    const q = query.trim()
    if (q.length < 2) {
      setResults([])
      setSearching(false)
      return
    }
    setSearching(true)
    setResultGps(near)
    debounceRef.current = window.setTimeout(() => {
      void searchSupermarkets(q, near)
        .then((hits) => {
          setResults(filterKnownSupermarkets(hits, known))
          setError(null)
        })
        .catch(() => {
          setResults([])
          setError('Pesquisa indisponível')
        })
        .finally(() => setSearching(false))
    }, 320)
    return () => {
      if (debounceRef.current != null) window.clearTimeout(debounceRef.current)
    }
  }, [query, near, known])

  function atStoreNow(hit: SupermarketSearchHit): boolean {
    const gps = resultGps ?? near
    if (!gps) return false
    if (hit.distanceM != null) return hit.distanceM <= AT_STORE_M
    return haversineM(hit, gps) <= AT_STORE_M
  }

  async function handleTrack(hit: SupermarketSearchHit) {
    setActingId(hit.id)
    setError(null)
    try {
      const coords = coordsForTracking(hit, resultGps ?? near)
      const registerVisit = atStoreNow(hit)
      const ok = await trackSupermarket({
        place: hit.name,
        latitude: coords.latitude,
        longitude: coords.longitude,
        registerVisit,
      })
      if (!ok) throw new Error('fail')
      setQuery('')
      setResults([])
      setHint(
        registerVisit
          ? `${hit.name} adicionado · ida registada (estás no local)`
          : `${hit.name} adicionado a Acompanhar`
      )
      onChanged()
    } catch {
      setError('Não foi possível acompanhar')
    } finally {
      setActingId(null)
    }
  }

  async function handleBlock(hit: SupermarketSearchHit | { id: string; name: string }) {
    setActingId(hit.id)
    setError(null)
    try {
      const ok = await blockSupermarket(hit.name)
      if (!ok) throw new Error('fail')
      setQuery('')
      setResults([])
      setHint(`${hit.name} adicionado a Ignorados`)
      onChanged()
    } catch {
      setError('Não foi possível ignorar')
    } finally {
      setActingId(null)
    }
  }

  async function handleTrackByName() {
    const name = query.trim()
    if (name.length < 2) return
    setActingId('name-track')
    setError(null)
    try {
      const ok = await trackSupermarket({
        place: name,
        latitude: near?.latitude,
        longitude: near?.longitude,
        registerVisit: false,
      })
      if (!ok) throw new Error('fail')
      setQuery('')
      setResults([])
      setHint(`${name} adicionado a Acompanhar`)
      onChanged()
    } catch {
      setError('Não foi possível acompanhar')
    } finally {
      setActingId(null)
    }
  }

  async function handleRegisterVisit(store: TrackedSupermarket) {
    setActingId(store.place_key)
    setError(null)
    try {
      const ok = await registerSupermarketVisit(zoneIdForTracked(store))
      if (!ok) throw new Error('fail')
      setNearbyTracked((prev) => prev.filter((n) => n.store.place_key !== store.place_key))
      setHint(`Ida registada: ${store.name}`)
      onChanged()
    } catch {
      setError('Não foi possível registar a ida')
    } finally {
      setActingId(null)
    }
  }

  async function handleImHere() {
    setLocating(true)
    setError(null)
    setHint(null)
    try {
      const pos = await getCurrentPosition()
      setNear(pos)
      setResultGps(pos)
      const hits = filterKnownSupermarkets(
        await findSupermarketNear(pos.latitude, pos.longitude),
        known
      )
      setResults(hits)

      const atTracked = tracked
        .filter((t) => typeof t.latitude === 'number' && typeof t.longitude === 'number')
        .map((t) => ({
          store: t,
          distanceM: Math.round(
            haversineM(
              { latitude: t.latitude!, longitude: t.longitude! },
              pos
            )
          ),
        }))
        .filter((x) => x.distanceM <= AT_STORE_M)
        .sort((a, b) => a.distanceM - b.distanceM)
      setNearbyTracked(atTracked)

      setQuery('')
      if (hits.length === 0 && atTracked.length === 0) {
        setHint('Nenhum super aqui — pesquisa pelo nome ou move-te para o local')
      } else if (atTracked.length > 0) {
        setHint(
          'Estás num super que já acompanhas — podes registar a ida agora. Novos supers: Acompanhar / Ignorar.'
        )
      } else {
        setHint(
          'Supers perto de ti — Acompanhar no local também regista a ida'
        )
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Localização falhou')
    } finally {
      setLocating(false)
    }
  }

  return (
    <div className="space-y-2">
      <div className="flex gap-2">
        <input
          type="search"
          value={query}
          onChange={(e) => {
            setQuery(e.target.value)
            setHint(null)
          }}
          placeholder="Procurar supermercado…"
          className="flex-1 min-w-0 px-3 py-2 rounded-xl bg-nourish-bg border border-nourish-border text-sm text-nourish-text placeholder:text-nourish-text-dim focus:outline-none focus:ring-2 focus:ring-nourish-primary"
        />
        <button
          type="button"
          onClick={() => void handleImHere()}
          disabled={locating}
          className="flex-shrink-0 px-2.5 py-2 rounded-xl border border-nourish-border text-xs font-semibold text-nourish-primary disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-nourish-primary"
          title="Usar a minha localização"
        >
          {locating ? '…' : 'Estou aqui'}
        </button>
      </div>

      {query.trim().length < 2 && results.length === 0 && nearbyTracked.length === 0 && (
        <div className="flex gap-1.5 overflow-x-auto pb-0.5" style={{ scrollbarWidth: 'none' }}>
          {SUPERMARKET_BRAND_CHIPS.map((brand) => (
            <button
              key={brand}
              type="button"
              onClick={() => setQuery(brand)}
              className="flex-shrink-0 px-2.5 py-1 rounded-full text-[11px] font-semibold bg-nourish-bg border border-nourish-border text-nourish-text-dim focus:outline-none"
            >
              {brand}
            </button>
          ))}
        </div>
      )}

      {searching && (
        <p className="text-[11px] text-nourish-text-dim">A procurar…</p>
      )}
      {hint && !error && (
        <p className="text-[11px] text-nourish-text-dim leading-snug">{hint}</p>
      )}
      {error && (
        <p className="text-[11px] text-amber-500 leading-snug">{error}</p>
      )}

      {nearbyTracked.length > 0 && (
        <ul className="space-y-1.5">
          {nearbyTracked.map(({ store, distanceM }) => (
            <li
              key={store.place_key}
              className="rounded-xl border border-nourish-primary/40 bg-nourish-primary/5 p-2.5 space-y-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-nourish-text leading-snug">{store.name}</p>
                <p className="text-[11px] text-nourish-text-dim mt-0.5">
                  Já acompanhas · {distanceM} m
                </p>
              </div>
              <button
                type="button"
                disabled={actingId === store.place_key}
                onClick={() => void handleRegisterVisit(store)}
                className="w-full py-1.5 rounded-lg text-xs font-semibold bg-nourish-primary text-nourish-on-primary disabled:opacity-50 focus:outline-none"
              >
                Registar ida agora
              </button>
            </li>
          ))}
        </ul>
      )}

      {results.length > 0 && (
        <ul className="space-y-1.5">
          {results.map((hit) => (
            <li
              key={hit.id}
              className="rounded-xl border border-nourish-border bg-nourish-bg p-2.5 space-y-2"
            >
              <div className="min-w-0">
                <p className="text-sm font-medium text-nourish-text leading-snug">{hit.title}</p>
                <p className="text-[11px] text-nourish-text-dim mt-0.5 leading-snug">
                  {hit.subtitle}
                  {hit.distanceM != null && hit.distanceM < 2000
                    ? ` · ${hit.distanceM < 1000 ? `${hit.distanceM} m` : `${(hit.distanceM / 1000).toFixed(1)} km`}`
                    : ''}
                </p>
              </div>
              <div className="grid grid-cols-2 gap-1.5">
                <button
                  type="button"
                  disabled={actingId === hit.id}
                  onClick={() => void handleTrack(hit)}
                  className="py-1.5 rounded-lg text-xs font-semibold bg-nourish-primary text-nourish-on-primary disabled:opacity-50 focus:outline-none"
                >
                  Acompanhar
                </button>
                <button
                  type="button"
                  disabled={actingId === hit.id}
                  onClick={() => void handleBlock(hit)}
                  className="py-1.5 rounded-lg text-xs font-semibold border border-nourish-border text-nourish-text-dim disabled:opacity-50 focus:outline-none"
                >
                  Ignorar
                </button>
              </div>
            </li>
          ))}
        </ul>
      )}

      {!searching && query.trim().length >= 2 && results.length === 0 && (
        <div className="rounded-xl border border-dashed border-nourish-border p-2.5 space-y-2">
          <p className="text-xs text-nourish-text-dim">
            Sem resultados novos no mapa. Podes guardar só o nome.
          </p>
          <div className="grid grid-cols-2 gap-1.5">
            <button
              type="button"
              disabled={actingId === 'name-track'}
              onClick={() => void handleTrackByName()}
              className="py-1.5 rounded-lg text-xs font-semibold bg-nourish-primary text-nourish-on-primary disabled:opacity-50 focus:outline-none"
            >
              Acompanhar
            </button>
            <button
              type="button"
              disabled={actingId != null}
              onClick={() =>
                void handleBlock({ id: 'name-block', name: query.trim() })
              }
              className="py-1.5 rounded-lg text-xs font-semibold border border-nourish-border text-nourish-text-dim disabled:opacity-50 focus:outline-none"
            >
              Ignorar
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
