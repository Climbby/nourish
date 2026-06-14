/**
 * Create HA zone + enter/leave automations for a tracked supermarket.
 * Requires HA_URL + HA_TOKEN on the nourish server (optional but recommended).
 */

export const DEFAULT_ZONE_RADIUS_M = Number(process.env.NOURISH_ZONE_RADIUS_M || 130)
export const HA_PERSON_ENTITY = process.env.HA_PERSON_ENTITY || 'person.francisco_fernandes'
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

function eventBody(type, zoneId) {
  return JSON.stringify({ type, zone: zoneId })
}

/**
 * @param {string} haUrl
 * @param {string} haToken
 * @param {{ name: string, placeKey: string, latitude: number, longitude: number, radius?: number }} opts
 */
export async function setupHaSupermarketZone(haUrl, haToken, opts) {
  const { name, placeKey, latitude, longitude } = opts
  const radius = opts.radius ?? DEFAULT_ZONE_RADIUS_M
  const zoneId = `zone.${placeKey}`

  await haFetch(haUrl, haToken, '/api/services/zone/create', {
    method: 'POST',
    body: JSON.stringify({
      name,
      latitude,
      longitude,
      radius,
      icon: 'mdi:cart',
    }),
  })

  const enterId = `nourish_super_enter_${placeKey}`
  const leaveId = `nourish_super_leave_${placeKey}`

  const enterConfig = {
    alias: `Nourish — chegada ${name}`,
    description: `Auto-criada para ${zoneId}`,
    mode: 'single',
    max_exceeded: 'silent',
    trigger: [
      {
        platform: 'zone',
        entity_id: HA_PERSON_ENTITY,
        zone: zoneId,
        event: 'enter',
      },
    ],
    action: [
      {
        service: 'rest_command.nourish_event_supermarket_zone',
        data: {
          body: eventBody('supermarket_enter', zoneId),
        },
      },
    ],
  }

  const leaveConfig = {
    alias: `Nourish — saída ${name}`,
    description: `Auto-criada para ${zoneId}`,
    mode: 'single',
    max_exceeded: 'silent',
    trigger: [
      {
        platform: 'zone',
        entity_id: HA_PERSON_ENTITY,
        zone: zoneId,
        event: 'leave',
      },
    ],
    action: [
      {
        service: 'rest_command.nourish_event_supermarket_zone',
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

  return { zone_id: zoneId, radius, automations: [enterId, leaveId] }
}

/** Fire enter event for the visit in progress (user tapped Acompanhar while still there). */
export async function fireSupermarketEvent(zoneId, type = 'supermarket_enter') {
  await fetch(NOURISH_EVENT_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: eventBody(type, zoneId),
  })
}
