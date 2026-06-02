#!/usr/bin/env node
/** Pending Grocy shopping list as JSON for n8n / at-supermarket. */
import { readFileSync } from 'fs'

const envPath = process.env.NOURISH_ENV || '/etc/nourish/env'
const env = Object.fromEntries(
  readFileSync(envPath, 'utf8')
    .split('\n')
    .filter((l) => l.includes('='))
    .map((l) => {
      const i = l.indexOf('=')
      return [l.slice(0, i), l.slice(i + 1)]
    })
)

const host = env.GROCY_HOST || '192.168.1.61:9192'
const key = env.GROCY_API_KEY
const base = host.startsWith('http') ? host : `http://${host}`

async function api(path) {
  const res = await fetch(`${base}/api${path}`, {
    headers: { 'GROCY-API-KEY': key },
  })
  if (!res.ok) throw new Error(`Grocy ${res.status}`)
  return res.json()
}

const [list, products] = await Promise.all([
  api('/objects/shopping_list'),
  api('/objects/products'),
])
const names = new Map(products.map((p) => [p.id, p.name]))
const pending = list.filter((i) => !i.done)
const lines = pending.map((i) => {
  const name = names.get(i.product_id) ?? `#${i.product_id}`
  return `• ${name} × ${i.amount}`
})
const summary =
  pending.length === 0
    ? 'Lista de compras vazia.'
    : `Lista (${pending.length}):\n${lines.join('\n')}`

console.log(JSON.stringify({ count: pending.length, items: pending, summary }, null, 2))
