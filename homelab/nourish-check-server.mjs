#!/usr/bin/env node
/**
 * LAN HTTP API for n8n / HA: despensa check, visit metrics, shopping list at store.
 */
import http from 'http'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { buildSupermarketVisits } from './supermarket-visits.mjs'
import { getFuelPricesCached } from './fuel-prices.mjs'
import { enrichVisitsWithTripDistance, roundTripToSupermarket } from './trip-distance.mjs'
import { fetchZoneCoordsFromHa, loadZoneCoords, saveZoneCoords } from './zone-coords.mjs'
import {
  blockSupermarket,
  loadSupermarkets,
  removeTrackedSupermarket,
  shouldPromptForPlace,
  trackSupermarket,
  unblockSupermarket,
} from './supermarkets.mjs'

const PORT = 8787
const HOST = '0.0.0.0'
const EVENTS_FILE = process.env.NOURISH_EVENTS_FILE || '/opt/nourish/events.jsonl'
const DATA_DIR = process.env.NOURISH_DATA_DIR || '/opt/nourish/data'
const FUEL_CACHE_FILE = path.join(DATA_DIR, 'fuel-prices-cache.json')

function dataPath(name) {
  return path.join(DATA_DIR, name)
}

function readJsonFile(name, fallback) {
  const file = dataPath(name)
  if (!fs.existsSync(file)) return fallback
  try {
    return JSON.parse(fs.readFileSync(file, 'utf8'))
  } catch {
    return fallback
  }
}

function writeJsonFile(name, data) {
  fs.mkdirSync(DATA_DIR, { recursive: true })
  fs.writeFileSync(dataPath(name), JSON.stringify(data, null, 2))
}

function loadJsonList(name, key) {
  const raw = readJsonFile(name, {})
  const list = raw[key]
  return Array.isArray(list) ? list : []
}

function upsertJsonListItem(name, key, item, matchFn) {
  const list = loadJsonList(name, key)
  const idx = list.findIndex(matchFn)
  if (idx >= 0) list[idx] = item
  else list.push(item)
  writeJsonFile(name, { [key]: list })
  return list
}

function removeJsonListItem(name, key, matchFn) {
  const list = loadJsonList(name, key).filter((item) => !matchFn(item))
  writeJsonFile(name, { [key]: list })
  return list
}
const VISIT_RECEIPTS_FILE = process.env.NOURISH_VISIT_RECEIPTS_FILE || '/opt/nourish/visit-receipts.json'
const VISIT_CARS_FILE = process.env.NOURISH_VISIT_CARS_FILE || '/opt/nourish/visit-cars.json'

function loadJsonArray(file) {
  if (!fs.existsSync(file)) return []
  try {
    const data = JSON.parse(fs.readFileSync(file, 'utf8'))
    return Array.isArray(data) ? data : []
  } catch {
    return []
  }
}

function saveJsonArray(file, items) {
  fs.mkdirSync(path.dirname(file), { recursive: true })
  fs.writeFileSync(file, JSON.stringify(items, null, 2))
}

function upsertByKey(items, item, key) {
  const next = items.filter((x) => x[key] !== item[key])
  next.push(item)
  next.sort((a, b) => String(b[key]).localeCompare(String(a[key])))
  return next
}

function readBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => resolve(body))
  })
}

function appendEvent(event) {
  const line =
    JSON.stringify({
      ...event,
      at: event.at ?? new Date().toISOString(),
    }) + '\n'
  fs.mkdirSync(path.dirname(EVENTS_FILE), { recursive: true })
  fs.appendFileSync(EVENTS_FILE, line)
}

function loadEvents(days = 30) {
  if (!fs.existsSync(EVENTS_FILE)) return []
  const cutoff = Date.now() - days * 86400000
  return fs
    .readFileSync(EVENTS_FILE, 'utf8')
    .trim()
    .split('\n')
    .filter(Boolean)
    .map((l) => { try { return JSON.parse(l) } catch { return null } })
    .filter((e) => e && new Date(e.at).getTime() >= cutoff)
}

function configuredDaysUntilShop() {
  const n = parseFloat(process.env.DAYS_UNTIL_SHOP || process.env.NOURISH_DAYS_UNTIL_SHOP || '4')
  return Number.isFinite(n) && n > 0 ? n : 4
}

function computeMetrics(events) {
  const supermarket = events.filter((e) => e.type === 'supermarket_enter')
  const leaveHome = events.filter((e) => e.type === 'leave_home')
  const now = Date.now()
  const weekAgo = now - 7 * 86400000
  const monthAgo = now - 30 * 86400000
  const inWeek = (e) => new Date(e.at).getTime() >= weekAgo
  const inMonth = (e) => new Date(e.at).getTime() >= monthAgo

  const shopTimes = supermarket.map((e) => new Date(e.at).getTime()).sort((a, b) => a - b)
  let avgDaysBetween = null
  if (shopTimes.length >= 2) {
    const gaps = []
    for (let i = 1; i < shopTimes.length; i++) {
      gaps.push((shopTimes[i] - shopTimes[i - 1]) / 86400000)
    }
    gaps.sort((a, b) => a - b)
    const median = gaps[Math.floor(gaps.length / 2)]
    if (median > 0) avgDaysBetween = Math.round(median * 10) / 10
  }

  const daysUntilShop = configuredDaysUntilShop()
  const suggested =
    avgDaysBetween != null && avgDaysBetween > 0 ? avgDaysBetween : daysUntilShop

  return {
    days_until_shop: daysUntilShop,
    supermarket_visits_week: supermarket.filter(inWeek).length,
    supermarket_visits_month: supermarket.filter(inMonth).length,
    leave_home_week: leaveHome.filter(inWeek).length,
    leave_home_month: leaveHome.filter(inMonth).length,
    avg_days_between_shops: avgDaysBetween,
    suggested_days_until_shop: suggested,
  }
}

function runCheck(days) {
  return new Promise((resolve, reject) => {
    const args = days ? [String(days)] : []
    const proc = spawn('/opt/nourish/check.sh', args)
    let out = ''
    let err = ''
    proc.stdout.on('data', (d) => { out += d })
    proc.stderr.on('data', (d) => { err += d })
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(err || 'check failed'))
      else resolve(out)
    })
  })
}

function runScript(name, env = {}) {
  return new Promise((resolve, reject) => {
    const proc = spawn('node', [`/opt/nourish/${name}`], { env: { ...process.env, ...env } })
    let out = ''
    let err = ''
    proc.stdout.on('data', (d) => { out += d })
    proc.stderr.on('data', (d) => { err += d })
    proc.on('close', (code) => {
      if (code !== 0) reject(new Error(err || `${name} failed`))
      else resolve(out)
    })
  })
}

const server = http.createServer(async (req, res) => {
  const send = (code, obj) => {
    res.writeHead(code, { 'Content-Type': 'application/json' })
    res.end(typeof obj === 'string' ? obj : JSON.stringify(obj))
  }

  try {
    if (req.method === 'GET' && req.url === '/metrics') {
      const events = loadEvents(90)
      return send(200, computeMetrics(events))
    }

    if (req.method === 'GET' && (req.url === '/supermarket-visits' || req.url?.startsWith('/supermarket-visits?'))) {
      const url = new URL(req.url, 'http://localhost')
      const days = Math.min(365, Math.max(1, parseInt(url.searchParams.get('days') || '90', 10) || 90))
      const events = loadEvents(days).filter(
        (e) => e.type === 'supermarket_enter' || e.type === 'supermarket_leave'
      )
      const visits = buildSupermarketVisits(events)
      const enriched = await enrichVisitsWithTripDistance(visits)
      return send(200, { visits: enriched, days })
    }

    if (req.method === 'GET' && req.url === '/supermarkets') {
      return send(200, loadSupermarkets())
    }

    if (req.method === 'POST' && req.url === '/supermarket-prompt') {
      const body = await readBody(req)
      const j = JSON.parse(body || '{}')
      const place = String(j.place || '').trim()
      if (!place) return send(400, { error: 'place required' })
      const data = loadSupermarkets()
      const check = shouldPromptForPlace(place, data.tracked, data.blocklist)
      return send(200, {
        prompt: check.prompt,
        reason: check.reason ?? null,
        place,
        place_key: check.place_key ?? null,
      })
    }

    if (req.method === 'POST' && req.url === '/supermarkets/respond') {
      const body = await readBody(req)
      const j = JSON.parse(body || '{}')
      const place = String(j.place || '').trim()
      const action = j.action
      if (!place) return send(400, { error: 'place required' })
      if (action === 'track') {
        const result = await trackSupermarket({
          place,
          latitude: j.latitude,
          longitude: j.longitude,
          zone_id: j.zone_id,
          radius: j.radius,
          create_ha_zone: j.create_ha_zone,
        })
        return send(200, result)
      }
      if (action === 'block') {
        return send(200, blockSupermarket(place))
      }
      return send(400, { error: 'action must be track or block' })
    }

    if (req.method === 'DELETE' && req.url === '/supermarkets/blocklist') {
      const body = await readBody(req)
      const j = JSON.parse(body || '{}')
      if (!j.place_key) return send(400, { error: 'place_key required' })
      return send(200, unblockSupermarket(j.place_key))
    }

    if (req.method === 'DELETE' && req.url === '/supermarkets/tracked') {
      const body = await readBody(req)
      const j = JSON.parse(body || '{}')
      if (!j.place_key) return send(400, { error: 'place_key required' })
      return send(200, removeTrackedSupermarket(j.place_key))
    }

    if (req.method === 'GET' && (req.url === '/trip-distance' || req.url?.startsWith('/trip-distance?'))) {
      const url = new URL(req.url, 'http://localhost')
      const zone = url.searchParams.get('zone') || undefined
      const trip = await roundTripToSupermarket(zone)
      if (trip == null) {
        return send(503, { error: 'Trip distance unavailable — configure zone-coords.json' })
      }
      return send(200, {
        zone: zone || loadZoneCoords().default_supermarket_zone,
        round_trip_km: trip.km,
        source: trip.source,
      })
    }

    if (req.method === 'POST' && req.url === '/sync-zone-coords') {
      const haUrl = process.env.HA_URL
      const haToken = process.env.HA_TOKEN
      if (!haUrl || !haToken) {
        return send(503, { error: 'HA_URL and HA_TOKEN required on server' })
      }
      const zoneIds = (process.env.HA_ZONES || 'zone.home,zone.auchan')
        .split(',')
        .map((z) => z.trim())
        .filter(Boolean)
      const config = loadZoneCoords()
      const fetched = await fetchZoneCoordsFromHa(haUrl, haToken, zoneIds)
      config.zones = { ...config.zones, ...fetched }
      saveZoneCoords(config)
      return send(200, { ok: true, zones: fetched })
    }

    if (req.method === 'GET' && req.url === '/cars') {
      return send(200, { cars: loadJsonList('cars.json', 'cars') })
    }

    if (req.method === 'PUT' && req.url === '/cars') {
      const body = await readBody(req)
      const j = JSON.parse(body || '{}')
      const cars = Array.isArray(j.cars) ? j.cars : []
      writeJsonFile('cars.json', { cars })
      return send(200, { ok: true, cars })
    }

    if (req.method === 'GET' && req.url === '/visit-cars') {
      return send(200, { links: loadJsonList('visit-cars.json', 'links') })
    }

    if (req.method === 'POST' && req.url === '/visit-cars') {
      const body = await readBody(req)
      const link = JSON.parse(body || '{}')
      if (!link.visit_entered_at || !link.car_id) {
        return send(400, { error: 'visit_entered_at and car_id required' })
      }
      const links = upsertJsonListItem(
        'visit-cars.json',
        'links',
        link,
        (l) => l.visit_entered_at === link.visit_entered_at
      )
      return send(200, { ok: true, links })
    }

    if (req.method === 'DELETE' && req.url === '/visit-cars') {
      const body = await readBody(req)
      const j = JSON.parse(body || '{}')
      if (!j.visit_entered_at) return send(400, { error: 'visit_entered_at required' })
      const links = removeJsonListItem(
        'visit-cars.json',
        'links',
        (l) => l.visit_entered_at === j.visit_entered_at
      )
      return send(200, { ok: true, links })
    }

    if (req.method === 'GET' && req.url === '/visit-receipts') {
      return send(200, { receipts: loadJsonList('visit-receipts.json', 'receipts') })
    }

    if (req.method === 'POST' && req.url === '/visit-receipts') {
      const body = await readBody(req)
      const receipt = JSON.parse(body || '{}')
      if (!receipt.visit_entered_at) {
        return send(400, { error: 'visit_entered_at required' })
      }
      const receipts = upsertJsonListItem(
        'visit-receipts.json',
        'receipts',
        receipt,
        (r) => r.visit_entered_at === receipt.visit_entered_at
      )
      return send(200, { ok: true, receipts })
    }

    if (req.method === 'GET' && req.url === '/fuel-prices') {
      const prices = await getFuelPricesCached(
        (p) => (fs.existsSync(p) ? fs.readFileSync(p, 'utf8') : null),
        (p, data) => {
          fs.mkdirSync(path.dirname(p), { recursive: true })
          fs.writeFileSync(p, data)
        },
        FUEL_CACHE_FILE
      )
      return send(200, prices)
    }

    if (req.method === 'POST' && req.url === '/event') {
      const body = await readBody(req)
      const j = JSON.parse(body || '{}')
      if (!['supermarket_enter', 'supermarket_leave', 'leave_home'].includes(j.type)) {
        return send(400, {
          error: 'type must be supermarket_enter, supermarket_leave, or leave_home',
        })
      }
      const event = { type: j.type, at: j.at }
      if (j.type === 'supermarket_enter' && j.zone) event.zone = String(j.zone)
      appendEvent(event)
      return send(200, { ok: true })
    }

    if (req.method === 'POST' && req.url === '/check') {
      const body = await readBody(req)
      let days = ''
      try {
        const j = JSON.parse(body || '{}')
        days = String(j.days_until_shop ?? j.days ?? '')
      } catch { /* empty */ }
      const out = await runCheck(days)
      return send(200, out)
    }

    if (req.method === 'POST' && req.url === '/at-supermarket') {
      const out = await runScript('shopping-list-summary.mjs')
      return send(200, out)
    }

    if (req.method === 'GET' && req.url === '/visit-receipts') {
      return send(200, { receipts: loadJsonArray(VISIT_RECEIPTS_FILE) })
    }

    if (req.method === 'POST' && req.url === '/visit-receipts') {
      const body = await readBody(req)
      const j = JSON.parse(body || '{}')
      if (!j.visit_entered_at) return send(400, { error: 'visit_entered_at required' })
      const receipts = upsertByKey(loadJsonArray(VISIT_RECEIPTS_FILE), j, 'visit_entered_at')
      saveJsonArray(VISIT_RECEIPTS_FILE, receipts)
      return send(200, { ok: true })
    }

    if (req.method === 'GET' && req.url === '/visit-cars') {
      return send(200, { links: loadJsonArray(VISIT_CARS_FILE) })
    }

    if (req.method === 'POST' && req.url === '/visit-cars') {
      const body = await readBody(req)
      const j = JSON.parse(body || '{}')
      if (!j.visit_entered_at || !j.car_id) return send(400, { error: 'visit_entered_at and car_id required' })
      const links = upsertByKey(loadJsonArray(VISIT_CARS_FILE), j, 'visit_entered_at')
      saveJsonArray(VISIT_CARS_FILE, links)
      return send(200, { ok: true })
    }

    if (req.method === 'DELETE' && req.url === '/visit-cars') {
      const body = await readBody(req)
      const j = JSON.parse(body || '{}')
      if (!j.visit_entered_at) return send(400, { error: 'visit_entered_at required' })
      const links = loadJsonArray(VISIT_CARS_FILE).filter((x) => x.visit_entered_at !== j.visit_entered_at)
      saveJsonArray(VISIT_CARS_FILE, links)
      return send(200, { ok: true })
    }

    send(404, { error: 'Not found' })
  } catch (e) {
    send(500, { error: e.message })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`nourish check server on ${HOST}:${PORT}`)
})
