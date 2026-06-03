#!/usr/bin/env node
/**
 * LAN HTTP API for n8n / HA: despensa check, visit metrics, shopping list at store.
 */
import http from 'http'
import { spawn } from 'child_process'
import fs from 'fs'
import path from 'path'
import { buildSupermarketVisits } from './supermarket-visits.mjs'

const PORT = 8787
const HOST = '0.0.0.0'
const EVENTS_FILE = process.env.NOURISH_EVENTS_FILE || '/opt/nourish/events.jsonl'

function readBody(req) {
  return new Promise((resolve) => {
    let body = ''
    req.on('data', (c) => { body += c })
    req.on('end', () => resolve(body))
  })
}

function appendEvent(type) {
  const line = JSON.stringify({ type, at: new Date().toISOString() }) + '\n'
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
      return send(200, { visits: buildSupermarketVisits(events), days })
    }

    if (req.method === 'POST' && req.url === '/event') {
      const body = await readBody(req)
      const j = JSON.parse(body || '{}')
      if (!['supermarket_enter', 'supermarket_leave', 'leave_home'].includes(j.type)) {
        return send(400, {
          error: 'type must be supermarket_enter, supermarket_leave, or leave_home',
        })
      }
      appendEvent(j.type)
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

    send(404, { error: 'Not found' })
  } catch (e) {
    send(500, { error: e.message })
  }
})

server.listen(PORT, HOST, () => {
  console.log(`nourish check server on ${HOST}:${PORT}`)
})
