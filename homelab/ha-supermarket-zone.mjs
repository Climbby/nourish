/**
 * Create HA zone + enter/leave automations for a tracked supermarket.
 * Requires HA_URL + HA_TOKEN on the nourish server.
 *
 * Enter/leave use device_tracker *state* (zone friendly name), not
 * `platform: zone` — the Companion GPS tracker often has no lat/lon attrs,
 * so zone triggers never fire. State flips to the zone name reliably.
 */

export const DEFAULT_ZONE_RADIUS_M = Number(process.env.NOURISH_ZONE_RADIUS_M || 130)
/** Stay in the store zone this long before enter + shopping list (blocks drive-bys). */
export const ENTER_DWELL_MINUTES = Number(process.env.NOURISH_SUPER_ENTER_DWELL_MIN || 2)
export const HA_PERSON_ENTITY = process.env.HA_PERSON_ENTITY || 'person.francisco_fernandes'
export const HA_DEVICE_TRACKER =
  process.env.HA_DEVICE_TRACKER || 'device_tracker.telemovel_francisco'
const NOURISH_EVENT_URL = process.env.NOURISH_EVENT_URL || 'http://127.0.0.1:8787/event'

async function haFetch(haUrl, token, path, options = {}) {
  const base = haUrl.replace(/\/$/, '')
  const res = await fetch(`${base}${path}`, {
    ...options,
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HA ${path}: ${res.status} ${text}`)
  }
  const ct = res.headers.get('content-type') || ''
  if (ct.includes('application/json')) return res.json()
  return null
}

/** Open a WebSocket that works on Node 18 (lite client) and Node 21+ (global). */
async function openHaSocket(haUrl) {
  const wsUrl = haUrl.replace(/^http/i, 'ws').replace(/\/$/, '') + '/api/websocket'
  if (typeof WebSocket !== 'undefined') {
    return new WebSocket(wsUrl)
  }
  const { createNodeWebSocket } = await import('./ha-ws-lite.mjs')
  return createNodeWebSocket(wsUrl)
}

function socketMessage(ws) {
  return new Promise((resolve, reject) => {
    const onMsg = (data) => {
      cleanup()
      try {
        const raw = typeof data === 'string' ? data : data?.data ?? data
        resolve(JSON.parse(String(raw)))
      } catch (e) {
        reject(e)
      }
    }
    const onErr = (err) => {
      cleanup()
      reject(err instanceof Error ? err : new Error(String(err)))
    }
    const cleanup = () => {
      if (typeof ws.removeEventListener === 'function') {
        ws.removeEventListener('message', onMsg)
        ws.removeEventListener('error', onErr)
      } else {
        ws.off?.('message', onMsg)
        ws.off?.('error', onErr)
      }
    }
    if (typeof ws.addEventListener === 'function') {
      ws.addEventListener('message', onMsg)
      ws.addEventListener('error', onErr)
    } else {
      ws.on('message', onMsg)
      ws.on('error', onErr)
    }
  })
}

function socketSend(ws, payload) {
  ws.send(JSON.stringify(payload))
}

/**
 * Core HA has no zone.create *service* — zones are created via websocket storage API.
 * @returns {Promise<{ id: string, name: string, latitude: number, longitude: number, radius: number }>}
 */
export async function createHaZoneViaWebsocket(haUrl, token, opts) {
  const ws = await openHaSocket(haUrl)
  const ready =
    ws.readyState === 1 /* OPEN */
      ? Promise.resolve()
      : new Promise((resolve, reject) => {
          const t = setTimeout(() => reject(new Error('HA websocket open timeout')), 10000)
          const ok = () => {
            clearTimeout(t)
            resolve()
          }
          if (typeof ws.addEventListener === 'function') {
            ws.addEventListener('open', ok, { once: true })
            ws.addEventListener('error', (e) => {
              clearTimeout(t)
              reject(e)
            }, { once: true })
          } else {
            ws.once('open', ok)
            ws.once('error', (e) => {
              clearTimeout(t)
              reject(e)
            })
          }
        })
  await ready
  try {
    const hello = await socketMessage(ws)
    if (hello.type !== 'auth_required') throw new Error(`Unexpected HA hello: ${hello.type}`)
    socketSend(ws, { type: 'auth', access_token: token })
    const auth = await socketMessage(ws)
    if (auth.type !== 'auth_ok') throw new Error(`HA auth failed: ${auth.type}`)
    socketSend(ws, {
      id: 1,
      type: 'zone/create',
      name: opts.name,
      latitude: opts.latitude,
      longitude: opts.longitude,
      radius: opts.radius ?? DEFAULT_ZONE_RADIUS_M,
      icon: opts.icon || 'mdi:cart',
      passive: false,
    })
    const res = await socketMessage(ws)
    if (!res.success) {
      throw new Error(`HA zone/create failed: ${JSON.stringify(res.error || res)}`)
    }
    return res.result
  } finally {
    try {
      ws.close()
    } catch {
      /* ignore */
    }
  }
}

function eventBody(type, zoneId) {
  return JSON.stringify({ type, zone: zoneId })
}

/** @param {string} haUrl @param {string} token */
export async function listHaZones(haUrl, token) {
  const states = await haFetch(haUrl, token, '/api/states')
  if (!Array.isArray(states)) return []
  return states
    .filter((s) => String(s.entity_id || '').startsWith('zone.'))
    .map((s) => ({
      entity_id: s.entity_id,
      name: s.attributes?.friendly_name || s.entity_id,
      latitude: Number(s.attributes?.latitude),
      longitude: Number(s.attributes?.longitude),
      radius: Number(s.attributes?.radius),
    }))
}

/**
 * Resolve existing zone entity id by exact id or friendly name.
 * @param {Awaited<ReturnType<typeof listHaZones>>} zones
 * @param {string} placeKey
 * @param {string} name
 */
export function findExistingZone(zones, placeKey, name) {
  const wantId = `zone.${placeKey}`
  const byId = zones.find((z) => z.entity_id === wantId)
  if (byId) return byId
  const wantName = String(name || '').trim().toLowerCase()
  if (!wantName) return null
  return (
    zones.find((z) => String(z.name || '').trim().toLowerCase() === wantName) || null
  )
}

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000
  const toR = (d) => (d * Math.PI) / 180
  const p1 = toR(lat1)
  const p2 = toR(lat2)
  const dp = toR(lat2 - lat1)
  const dl = toR(lon2 - lon1)
  const a = Math.sin(dp / 2) ** 2 + Math.cos(p1) * Math.cos(p2) * Math.sin(dl / 2) ** 2
  return 2 * R * Math.asin(Math.sqrt(a))
}

/** Reuse a nearby HA zone (e.g. legacy zone.auchan ≈ Auchan Condeixa). */
export function findNearbyZone(zones, latitude, longitude, maxMeters = 100) {
  const lat = Number(latitude)
  const lon = Number(longitude)
  if (!Number.isFinite(lat) || !Number.isFinite(lon)) return null
  let best = null
  let bestD = Infinity
  for (const z of zones || []) {
    if (!Number.isFinite(z.latitude) || !Number.isFinite(z.longitude)) continue
    const d = haversineM(lat, lon, z.latitude, z.longitude)
    if (d <= maxMeters && d < bestD) {
      best = z
      bestD = d
    }
  }
  return best
}

/**
 * @param {string} haUrl
 * @param {string} haToken
 * @param {{ name: string, placeKey: string, latitude: number, longitude: number, radius?: number, send_shopping_list?: boolean }} opts
 */
export async function setupHaSupermarketZone(haUrl, haToken, opts) {
  const { name, placeKey, latitude, longitude } = opts
  const radius = opts.radius ?? DEFAULT_ZONE_RADIUS_M
  const sendShoppingList = opts.send_shopping_list !== false
  const preferredZoneId = `zone.${placeKey}`
  const zones = await listHaZones(haUrl, haToken)
  const existing =
    findExistingZone(zones, placeKey, name) || findNearbyZone(zones, latitude, longitude, 100)
  let zoneId = existing?.entity_id || preferredZoneId
  // State trigger must match the HA zone friendly name (tracker state label).
  const triggerName = existing?.name || name
  let created = false

  if (!existing) {
    const createdZone = await createHaZoneViaWebsocket(haUrl, haToken, {
      name,
      latitude,
      longitude,
      radius,
      icon: 'mdi:cart',
    })
    created = true
    // Storage id becomes the entity object_id → zone.{id}
    if (createdZone?.id) zoneId = `zone.${createdZone.id}`
    const after =
      findExistingZone(await listHaZones(haUrl, haToken), placeKey, name) ||
      findNearbyZone(await listHaZones(haUrl, haToken), latitude, longitude, 100)
    if (after?.entity_id) zoneId = after.entity_id
  }

  const enterId = `nourish_super_enter_${placeKey}`
  const leaveId = `nourish_super_leave_${placeKey}`

  const enterActions = [
    {
      action: 'rest_command.nourish_event_supermarket_zone',
      data: {
        body: eventBody('supermarket_enter', zoneId),
      },
    },
  ]
  if (sendShoppingList) {
    enterActions.push({ action: 'rest_command.nourish_at_supermarket' })
  }

  const enterConfig = {
    id: enterId,
    alias: `Nourish — chegada ${name}`,
    description: `Auto-criada para ${zoneId}; dwell ${ENTER_DWELL_MINUTES} min (ignora drive-by)`,
    mode: 'single',
    max_exceeded: 'silent',
    trigger: [
      {
        platform: 'state',
        entity_id: HA_DEVICE_TRACKER,
        to: triggerName,
        for: {
          minutes: ENTER_DWELL_MINUTES,
        },
      },
    ],
    action: enterActions,
  }

  const leaveConfig = {
    id: leaveId,
    alias: `Nourish — saída ${name}`,
    description: `Auto-criada para ${zoneId} (state trigger em ${HA_DEVICE_TRACKER})`,
    mode: 'single',
    max_exceeded: 'silent',
    trigger: [
      {
        platform: 'state',
        entity_id: HA_DEVICE_TRACKER,
        from: triggerName,
      },
    ],
    action: [
      {
        action: 'rest_command.nourish_event_supermarket_zone',
        data: {
          body: eventBody('supermarket_leave', zoneId),
        },
      },
    ],
  }

  await haFetch(haUrl, haToken, `/api/config/automation/config/${enterId}`, {
    method: 'POST',
    body: JSON.stringify(enterConfig),
  })
  await haFetch(haUrl, haToken, `/api/config/automation/config/${leaveId}`, {
    method: 'POST',
    body: JSON.stringify(leaveConfig),
  })

  return {
    zone_id: zoneId,
    radius,
    created,
    already_existed: Boolean(existing),
    automations: [enterId, leaveId],
  }
}

/** Fire enter event for the visit in progress (user tapped Acompanhar while still there). */
export async function fireSupermarketEvent(zoneId, type = 'supermarket_enter') {
  await fetch(NOURISH_EVENT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: eventBody(type, zoneId),
  })
}

/**
 * Ensure every tracked supermarket with coords has an HA zone + enter/leave automations.
 * @param {string} haUrl
 * @param {string} haToken
 * @param {import('./supermarkets.mjs').TrackedSupermarket[] | object[]} tracked
 */
export async function ensureHaZonesForTracked(haUrl, haToken, tracked) {
  const results = []
  for (const t of tracked || []) {
    const lat = Number(t.latitude)
    const lon = Number(t.longitude)
    const placeKey = t.place_key || t.id
    const name = t.name || placeKey
    if (!placeKey || !Number.isFinite(lat) || !Number.isFinite(lon)) {
      results.push({ place_key: placeKey, skipped: true, reason: 'missing_coords' })
      continue
    }
    try {
      const setup = await setupHaSupermarketZone(haUrl, haToken, {
        name,
        placeKey,
        latitude: lat,
        longitude: lon,
        radius: Number(t.radius) > 0 ? Number(t.radius) : DEFAULT_ZONE_RADIUS_M,
      })
      results.push({ place_key: placeKey, ok: true, ...setup })
    } catch (e) {
      results.push({ place_key: placeKey, ok: false, error: e.message })
    }
  }
  return results
}
