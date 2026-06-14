/**
 * National median fuel prices from DGEG (precoscombustiveis.dgeg.gov.pt).
 * Samples station data; cache refreshed daily (prices update through the week).
 */

const DGEG_BASE = 'https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb'
const SAMPLE_STATIONS = 24
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000

function parsePreco(preco) {
  const s = String(preco)
    .replace(/€\/litro/gi, '')
    .replace(/€/g, '')
    .replace(/\s/g, '')
    .replace(',', '.')
  const n = parseFloat(s)
  return Number.isFinite(n) && n > 0 ? n : null
}

function median(values) {
  if (values.length === 0) return null
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

async function fetchJson(url) {
  const res = await fetch(url, { headers: { Accept: 'application/json' } })
  if (!res.ok) throw new Error(`DGEG ${res.status}`)
  return res.json()
}

async function collectStationIds() {
  const ids = new Set()
  for (let page = 1; page <= 4 && ids.size < SAMPLE_STATIONS; page++) {
    const data = await fetchJson(
      `${DGEG_BASE}/PesquisarPostos?idsTiposComb=3201&pagina=${page}&qtdPorPagina=20&f=json`
    )
    for (const row of data.resultado ?? []) {
      if (row.Id) ids.add(row.Id)
    }
  }
  return [...ids].slice(0, SAMPLE_STATIONS)
}

function priceForFuel(combustiveis, matcher) {
  const row = (combustiveis ?? []).find((c) =>
    matcher(c.TipoCombustivel ?? '')
  )
  return row ? parsePreco(row.Preco) : null
}

export async function fetchNationalFuelPrices() {
  const ids = await collectStationIds()
  const diesel = []
  const gasoline = []
  const gpl = []

  for (const id of ids) {
    try {
      const data = await fetchJson(`${DGEG_BASE}/GetDadosPostoMapa?id=${id}&f=json`)
      const fuels = data.resultado?.Combustiveis
      const d = priceForFuel(fuels, (t) => /gasóleo simples/i.test(t))
      const g = priceForFuel(fuels, (t) => /gasolina simples 95/i.test(t))
      const lp = priceForFuel(fuels, (t) => /gpl/i.test(t))
      if (d != null) diesel.push(d)
      if (g != null) gasoline.push(g)
      if (lp != null) gpl.push(lp)
    } catch {
      /* skip station */
    }
  }

  const dieselEur = median(diesel)
  const gasolineEur = median(gasoline)
  const gplEur = median(gpl)

  if (dieselEur == null && gasolineEur == null && gplEur == null) {
    throw new Error('No fuel prices from DGEG')
  }

  const fallback = dieselEur ?? gasolineEur ?? gplEur

  return {
    diesel_eur_per_l: dieselEur ?? fallback,
    gasoline_eur_per_l: gasolineEur ?? fallback,
    gpl_eur_per_l: gplEur ?? gasolineEur ?? fallback,
    source: 'dgeg',
    sampled_stations: ids.length,
    updated_at: new Date().toISOString(),
  }
}

export function loadFuelPriceCache(readFile, cachePath) {
  try {
    const raw = readFile(cachePath)
    if (!raw) return null
    const data = JSON.parse(raw)
    if (!data?.updated_at) return null
    const age = Date.now() - new Date(data.updated_at).getTime()
    if (age > CACHE_MAX_AGE_MS) return null
    return data
  } catch {
    return null
  }
}

export async function getFuelPricesCached(readFile, writeFile, cachePath) {
  const cached = loadFuelPriceCache(readFile, cachePath)
  if (cached) return cached
  const fresh = await fetchNationalFuelPrices()
  writeFile(cachePath, JSON.stringify(fresh, null, 2))
  return fresh
}
