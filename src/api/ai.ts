import { stepsTextFromAi } from '../utils/parseDescription'

const AI_URL = '/ai/v1/chat/completions'

function aiRequestError(status: number, body: string): Error {
  if (status === 401) {
    return new Error(
      'Chave OpenRouter em falta ou inválida. Adiciona OPENROUTER_API_KEY ao .env e reinicia npm run dev. Em produção, faz deploy do nginx com a chave (skill /deploy).'
    )
  }
  if (status === 404 && body.includes('No endpoints found')) {
    return new Error(
      'Modelo IA indisponível no OpenRouter. Atualiza VITE_OPENROUTER_TEXT_MODEL e VITE_OPENROUTER_VISION_MODEL no .env (ex.: deepseek/deepseek-v4-flash e google/gemini-2.5-flash) e reinicia o servidor.'
    )
  }
  return new Error(`Análise IA falhou (${status}): ${body}`)
}

const VISION_MODEL = import.meta.env.VITE_OPENROUTER_VISION_MODEL || 'google/gemini-2.5-flash'
const TEXT_MODEL = import.meta.env.VITE_OPENROUTER_TEXT_MODEL || 'deepseek/deepseek-v4-flash'

export interface MealAnalysis {
  calories: number | null
  protein: number | null
  carbs: number | null
  fat: number | null
  totalPrice: number | null
  ingredients: string[]
  steps: string
}

const SYSTEM_PROMPT = `És um assistente de cozinha Português. Dado o nome de uma refeição, opcionalmente uma foto e ingredientes conhecidos, devolve:

1. Estimativa nutricional por dose (calorias, proteína, hidratos, gordura)
2. Custo total estimado dos ingredientes em EUR (preços de supermercado Português)
3. Lista de ingredientes prováveis (só nomes, sem quantidades nem preços)
4. Passos de preparação curtos em PORTUGUÊS — um passo por entrada no array (4–8 passos), sem numerar no texto

Devolve APENAS JSON válido:
{
  "calories": number | null,
  "protein": number | null,
  "carbs": number | null,
  "fat": number | null,
  "totalPrice": number | null,
  "ingredients": string[],
  "steps": string[]
}

TUDO em Português. Cada passo = uma frase curta. Não juntes vários passos numa só string.`

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result as string)
    reader.onerror = () => reject(new Error('Falha ao ler a imagem'))
    reader.readAsDataURL(file)
  })
}

function parseJsonContent(content: string): unknown {
  const jsonStr = content.replace(/```json\s*/g, '').replace(/```\s*/g, '').trim()
  return JSON.parse(jsonStr)
}

function stripQuantity(name: string): string {
  return name
    .replace(/^\s*\d+[\s.,]?\d*\s*(g|kg|ml|l|cl|unid(?:ade)?s?|colh(?:eres?)?\s*(?:de\s*)?(sopa|chá|café)?|xícaras?|chávenas?|dentes?|folhas?|ramos?|fatias?|pedaços?|pequeno|média|grande|maior|menor)\s*/i, '')
    .replace(/^\s*\d+\s*[xX]\s*/, '')
    .replace(/^\s*\d+\s*/, '')
    .replace(/,\s*.*$/, '')
    .replace(/\s*\(.*?\)\s*/g, '')
    .trim()
    .toLowerCase()
}

export async function analyzeMeal(
  mealName: string,
  knownIngredients?: string[],
  photoFile?: File | null
): Promise<MealAnalysis> {
  const knownText =
    knownIngredients && knownIngredients.length > 0
      ? `\nIngredientes conhecidos: ${knownIngredients.filter(Boolean).join(', ')}`
      : ''

  const userText = `Refeição: ${mealName.trim() || 'refeição'}${knownText}`
  const useVision = !!photoFile

  const messages: unknown[] = [{ role: 'system', content: SYSTEM_PROMPT }]

  if (useVision) {
    const b64DataUrl = await fileToBase64(photoFile!)
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: userText },
        { type: 'image_url', image_url: { url: b64DataUrl } },
      ],
    })
  } else {
    messages.push({ role: 'user', content: userText })
  }

  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: useVision ? VISION_MODEL : TEXT_MODEL,
      messages,
      max_tokens: 1024,
      temperature: 0.2,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw aiRequestError(res.status, text)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Resposta vazia da IA')

  const raw = parseJsonContent(content) as Record<string, unknown>
  const cleanIngredients = (Array.isArray(raw.ingredients) ? raw.ingredients : [])
    .map((n) => stripQuantity(String(n)))
    .filter((n) => n.length > 1)

  return {
    calories: raw.calories != null ? Number(raw.calories) : null,
    protein: raw.protein != null ? Number(raw.protein) : null,
    carbs: raw.carbs != null ? Number(raw.carbs) : null,
    fat: raw.fat != null ? Number(raw.fat) : null,
    totalPrice: raw.totalPrice != null ? Number(raw.totalPrice) : null,
    ingredients: cleanIngredients,
    steps: stepsTextFromAi(raw.steps),
  }
}

export async function suggestIngredients(
  query: string,
  existingProducts: string[]
): Promise<string[]> {
  if (!query.trim() || query.length < 2) return []

  const q = query.toLowerCase()
  const local = existingProducts.filter((p) => p.toLowerCase().includes(q)).slice(0, 5)
  if (local.length >= 3) return local

  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: 'openrouter/auto',
      messages: [
        {
          role: 'system',
          content:
            'Sugere 3-5 nomes de ingredientes comuns em Português. Devolve APENAS um array JSON de strings, ex: ["frango", "frango desfiado", "peito de frango"]. Sem explicações.',
        },
        { role: 'user', content: `Input parcial: "${query}"` },
      ],
      max_tokens: 128,
      temperature: 0.3,
    }),
  })

  if (!res.ok) return local

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) return local

  try {
    const suggestions = parseJsonContent(content) as string[]
    return [...new Set([...local, ...suggestions])].slice(0, 6)
  } catch {
    return local
  }
}

export async function analyzeProduct(
  productName: string,
  photoFile?: File | null
): Promise<{ calories: number | null; price: number | null }> {
  const useVision = !!photoFile
  const messages: unknown[] = [
    {
      role: 'system',
      content:
        'Dado um nome de produto e opcionalmente uma foto, estima as calorias por unidade e preço em EUR. Devolve APENAS {"calories": number|null, "price": number|null}.',
    },
  ]

  if (useVision) {
    const b64DataUrl = await fileToBase64(photoFile!)
    messages.push({
      role: 'user',
      content: [
        { type: 'text', text: `Produto: ${productName}` },
        { type: 'image_url', image_url: { url: b64DataUrl } },
      ],
    })
  } else {
    messages.push({ role: 'user', content: `Produto: ${productName}` })
  }

  const res = await fetch(AI_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      model: useVision ? VISION_MODEL : TEXT_MODEL,
      messages,
      max_tokens: 128,
      temperature: 0.1,
    }),
  })

  if (!res.ok) {
    const text = await res.text().catch(() => '')
    throw aiRequestError(res.status, text)
  }

  const data = await res.json()
  const content = data.choices?.[0]?.message?.content
  if (!content) throw new Error('Resposta vazia da IA')

  return parseJsonContent(content) as { calories: number | null; price: number | null }
}
