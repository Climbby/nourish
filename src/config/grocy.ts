function envInt(key: string, fallback: number): number {
  const raw = import.meta.env[key]
  if (raw === undefined || raw === '') return fallback
  const n = parseInt(String(raw), 10)
  return isNaN(n) ? fallback : n
}

export const grocyConfig = {
  despensaGroupId: envInt('VITE_GROCY_DESPENSA_GROUP_ID', 6),
  defaultLocationId: envInt('VITE_GROCY_DEFAULT_LOCATION_ID', 2),
  defaultQuId: envInt('VITE_GROCY_DEFAULT_QU_ID', 2),
}
