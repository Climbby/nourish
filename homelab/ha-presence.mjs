/**
 * Query Home Assistant person state for at-home presence.
 */

export const HA_PERSON_ENTITY = process.env.HA_PERSON_ENTITY || 'person.francisco_fernandes'

/**
 * @param {string} haUrl
 * @param {string} haToken
 * @param {string} [entityId]
 * @param {typeof fetch} [fetchFn]
 * @returns {Promise<{ at_home: boolean, state: string, entity_id: string }>}
 */
export async function fetchHaAtHome(
  haUrl,
  haToken,
  entityId = HA_PERSON_ENTITY,
  fetchFn = fetch
) {
  const base = haUrl.replace(/\/$/, '')
  const res = await fetchFn(`${base}/api/states/${encodeURIComponent(entityId)}`, {
    headers: {
      Authorization: `Bearer ${haToken}`,
      Accept: 'application/json',
    },
  })
  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw new Error(`HA ${entityId}: ${res.status} ${text}`)
  }
  const body = await res.json()
  const state = String(body.state || '')
  return {
    at_home: state === 'home',
    state,
    entity_id: entityId,
  }
}
