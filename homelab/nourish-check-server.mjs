#!/usr/bin/env node
/**
 * LAN-only HTTP trigger for despensa check (n8n / HA).
 * Listens on 127.0.0.1:8787 — use nginx or allow n8n IP.
 */
import http from 'http'
import { spawn } from 'child_process'

const PORT = 8787
const HOST = '0.0.0.0'

const server = http.createServer((req, res) => {
  if (req.method !== 'POST' || req.url !== '/check') {
    res.writeHead(404)
    res.end('Not found')
    return
  }

  let body = ''
  req.on('data', (c) => { body += c })
  req.on('end', () => {
    let days = ''
    try {
      const j = JSON.parse(body || '{}')
      days = String(j.days_until_shop ?? j.days ?? '')
    } catch { /* empty */ }

    const args = days ? [days] : []
    const proc = spawn('/opt/nourish/check.sh', args)
    let out = ''
    let err = ''
    proc.stdout.on('data', (d) => { out += d })
    proc.stderr.on('data', (d) => { err += d })
    proc.on('close', (code) => {
      res.writeHead(code === 0 ? 200 : 500, { 'Content-Type': 'application/json' })
      res.end(out || JSON.stringify({ error: err || 'empty output' }))
    })
  })
})

server.listen(PORT, HOST, () => {
  console.log(`nourish check server on ${HOST}:${PORT}`)
})
