const PT_DMY: Intl.DateTimeFormatOptions = {
  day: 'numeric',
  month: 'numeric',
  year: 'numeric',
}

/**
 * Portuguese day/month/year (e.g. 13/08/2026).
 * ISO calendar days are parsed as local dates so UTC midnight cannot shift the day.
 */
export function formatPtDate(input: string): string {
  const trimmed = input.trim()
  if (!trimmed) return ''
  const dayOnly = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/)
  if (dayOnly) {
    const d = new Date(Number(dayOnly[1]), Number(dayOnly[2]) - 1, Number(dayOnly[3]))
    return d.toLocaleDateString('pt-PT', PT_DMY)
  }
  const d = new Date(trimmed.includes('T') ? trimmed : trimmed.replace(' ', 'T'))
  if (isNaN(d.getTime())) return trimmed
  return d.toLocaleDateString('pt-PT', PT_DMY)
}
