/**
 * National median fuel prices from DGEG (precoscombustiveis.dgeg.gov.pt).
 * Samples station data; cache refreshed daily (prices update through the week).
 *
 * Fuel type IDs (GetTiposCombustiveis):
 *   2101 Gasóleo simples · 3201 Gasolina simples 95 · 1120 GPL Auto
 *
 * Missing fuels stay null — never invent gasoline-as-GPL or other estimates.
 */

const DGEG_BASE = 'https://precoscombustiveis.dgeg.gov.pt/api/PrecoComb'
const SAMPLE_PER_TYPE = 16
const CACHE_MAX_AGE_MS = 24 * 60 * 60 * 1000

const FUEL_TYPE_IDS = {
  diesel: 2101,
  gasoline: 3201,
  gpl: 1120,
}

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

/** Collect station ids that sell a given fuel type. */
async function collectStationIdsForType(tipoCombId, limit = SAMPLE_PER_TYPE) {
  const ids = new Set()
  for (let page = 1; page <= 4 && ids.size < limit; page++) {
    const data = await fetchJson(
      `${DGEG_BASE}/PesquisarPostos?idsTiposComb=${tipoCombId}&pagina=${page}&qtdPorPagina=20&f=json`
    )
    for (const row of data.resultado ?? []) {
      if (row.Id) ids.add(row.Id)
    }
  }
  return [...ids].slice(0, limit)
}

function priceForFuel(combustiveis, matcher) {
  const row = (combustiveis ?? []).find((c) => matcher(c.TipoCombustivel ?? ''))
  return row ? parsePreco(row.Preco) : null
}

export async function fetchNationalFuelPrices() {
  const [dieselIds, gasolineIds, gplIds] = await Promise.all([
    collectStationIdsForType(FUEL_TYPE_IDS.diesel),
    collectStationIdsForType(FUEL_TYPE_IDS.gasoline),
    collectStationIdsForType(FUEL_TYPE_IDS.gpl),
  ])
  const ids = [...new Set([...dieselIds, ...gasolineIds, ...gplIds])]

  const diesel = []
  const gasoline = []
  const gpl = []

  for (const id of ids) {
    try {
      const data = await fetchJson(`${DGEG_BASE}/GetDadosPostoMapa?id=${id}&f=json`)
      const fuels = data.resultado?.Combustiveis
      const d = priceForFuel(fuels, (t) => /gasóleo simples/i.test(t))
      const g = priceForFuel(fuels, (t) => /gasolina simples 95/i.test(t))
      const lp = priceForFuel(fuels, (t) => /gpl\s*auto/i.test(t) || /^gpl$/i.test(t.trim()))
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

  /** @type {('diesel'|'gasoline'|'gpl')[]} */
  const missing = []
  if (dieselEur == null) missing.push('diesel')
  if (gasolineEur == null) missing.push('gasoline')
  if (gplEur == null) missing.push('gpl')

  return {
    diesel_eur_per_l: dieselEur,
    gasoline_eur_per_l: gasolineEur,
    gpl_eur_per_l: gplEur,
    missing,
    gpl_samples: gpl.length,
    diesel_samples: diesel.length,
    gasoline_samples: gasoline.length,
    source: 'dgeg',
    source_label: 'DGEG · precoscombustiveis.dgeg.gov.pt',
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

/**
 * Persist a user report that a fuel price is missing / wrong.
 * Optionally notify via ntfy if NTFY_URL + NTFY_TOPIC are set.
 */
export async function reportFuelPriceIssue(input, opts = {}) {
  const reportsPath = opts.reportsPath
  const appendFile = opts.appendFile
  const notify = opts.notify
  const row = {
    at: new Date().toISOString(),
    fuel: String(input.fuel || 'unknown'),
    note: input.note ? String(input.note).slice(0, 500) : null,
    prices_snapshot: input.prices_snapshot ?? null,
  }
  if (appendFile && reportsPath) {
    appendFile(reportsPath, JSON.stringify(row) + '\n')
  }
  if (typeof notify === 'function') {
    await notify(row)
  }
  return { ok: true, report: row }
}
