/**
 * Turn a Portuguese shopping utterance into product names.
 * Local NLU only — no fuzzy expansion of foods.
 */

const LIST_SPLIT = /\s*(?:,|;| e também | também | depois | mais |\s+e\s+)\s*/i

const FILLER_WORD =
  /^(eu|preciso|queria|quero|podes|pode|adicionar|adiciona|comprar|compra|trazer|traz|traga|tragas|poe|põe|mete|lista|de|do|da|dos|das|dum|duma|disto|disso|daquilo|um|uma|uns|umas|o|a|os|as)$/i

// "aquilo do costume", "isso": a reference, not an item. Leave it to the fallback (or ask again).
const VAGUE = /(^|\s)(aquilo|isso|isto|costume|habitual)(\s|$)/i

// The unit must end at a word boundary: otherwise "l" (litres) eats the start of "latas".
const LEADING_QTY =
  /^\d+([.,]\d+)?\s*(?:(?:kg|g|gr|l|lt|ml|un|unid\.?|unidades?|latas?|pacotes?|sacos?)(?![a-zà-ú]))?\s*(de\s+)?/i

export function parseShoppingVoice(transcript: string): string[] {
  const text = transcript.replace(/\s+/g, ' ').trim().replace(/[.!?]+$/g, '').trim()
  if (!text) return []

  const seen = new Set<string>()
  const names: string[] = []
  for (const raw of text.split(LIST_SPLIT)) {
    const name = cleanHeardItem(raw)
    if (name.length < 2 || VAGUE.test(name)) continue
    const key = name.toLowerCase()
    if (seen.has(key)) continue
    seen.add(key)
    names.push(name)
  }
  return names
}

function cleanHeardItem(raw: string): string {
  let s = raw.replace(/\s+/g, ' ').trim().replace(/[.!?]+$/g, '').trim()
  s = s.replace(LEADING_QTY, '').trim()
  const words = s.split(' ').filter(Boolean)
  while (words.length > 0 && FILLER_WORD.test(words[0])) words.shift()
  s = words.join(' ').replace(LEADING_QTY, '').trim()
  return s
}

/** Local parse first; OpenRouter (or any fallback) only when that yields nothing. */
export async function resolveHeardShoppingNames(
  transcript: string,
  fallback?: (text: string) => Promise<string[]>
): Promise<string[]> {
  const local = parseShoppingVoice(transcript)
  if (local.length > 0) return local
  if (!fallback) return []
  try {
    return await fallback(transcript)
  } catch {
    return []
  }
}

