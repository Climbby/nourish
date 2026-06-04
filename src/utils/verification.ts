/** Fields that can be marked as manually verified in description storage. */
export type VerifiedField = 'preco' | 'nutricao' | 'calorias'

const FIELD_SET = new Set<string>(['preco', 'nutricao', 'calorias'])

export function isVerifiedField(s: string): s is VerifiedField {
  return FIELD_SET.has(s)
}

export function parseVerifiedFields(description: string | null): Set<VerifiedField> {
  if (!description) return new Set()
  const m = description.match(/\[Verificado\]\s*([\s\S]*?)(?=\n\n\[|$)/)
  if (!m) return new Set()
  const fields = new Set<VerifiedField>()
  for (const line of m[1].split('\n')) {
    const key = line.trim().toLowerCase()
    if (isVerifiedField(key)) fields.add(key)
  }
  return fields
}

export function formatVerifiedSection(fields: Iterable<VerifiedField>): string {
  const lines = [...fields].sort()
  return `[Verificado]\n${lines.join('\n')}`
}

/** Remove [Verificado] and optionally append an updated block. */
export function upsertVerifiedSection(
  description: string | null,
  fields: Set<VerifiedField>
): string {
  const base = (description ?? '')
    .replace(/\n?\[Verificado\]\s*[\s\S]*?(?=\n\n\[|$)/, '')
    .trim()
  if (fields.size === 0) return base
  const block = formatVerifiedSection(fields)
  return base ? `${base}\n\n${block}` : block
}

export function isVerified(
  description: string | null,
  field: VerifiedField
): boolean {
  return parseVerifiedFields(description).has(field)
}
