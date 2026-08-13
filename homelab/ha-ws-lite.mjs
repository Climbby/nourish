/**
 * Minimal WebSocket client for Node 18 (no npm). Enough for HA auth + RPCs.
 * Prefer global WebSocket on Node 21+.
 */
import http from 'http'
import https from 'https'
import crypto from 'crypto'
import { URL } from 'url'

export function createNodeWebSocket(urlString) {
  const url = new URL(urlString)
  const isTls = url.protocol === 'wss:'
  const key = crypto.randomBytes(16).toString('base64')
  const listeners = { open: [], message: [], error: [], close: [] }
  let socket = null
  let buffer = Buffer.alloc(0)
  let readyState = 0 // CONNECTING

  const emit = (type, arg) => {
    for (const fn of listeners[type] || []) fn(arg)
  }

  const api = {
    get readyState() {
      return readyState
    },
    addEventListener(type, fn) {
      listeners[type]?.push(fn)
    },
    removeEventListener(type, fn) {
      const arr = listeners[type]
      if (!arr) return
      const i = arr.indexOf(fn)
      if (i >= 0) arr.splice(i, 1)
    },
    on(type, fn) {
      api.addEventListener(type, fn)
    },
    off(type, fn) {
      api.removeEventListener(type, fn)
    },
    once(type, fn) {
      const wrap = (arg) => {
        api.removeEventListener(type, wrap)
        fn(arg)
      }
      api.addEventListener(type, wrap)
    },
    send(data) {
      if (!socket || readyState !== 1) throw new Error('WebSocket not open')
      const payload = Buffer.from(String(data))
      const len = payload.length
      let header
      if (len < 126) {
        header = Buffer.alloc(6)
        header[0] = 0x81
        header[1] = 0x80 | len
      } else if (len < 65536) {
        header = Buffer.alloc(8)
        header[0] = 0x81
        header[1] = 0x80 | 126
        header.writeUInt16BE(len, 2)
      } else {
        header = Buffer.alloc(14)
        header[0] = 0x81
        header[1] = 0x80 | 127
        header.writeUInt32BE(0, 2)
        header.writeUInt32BE(len, 6)
      }
      const mask = crypto.randomBytes(4)
      mask.copy(header, header.length - 4)
      const masked = Buffer.alloc(len)
      for (let i = 0; i < len; i++) masked[i] = payload[i] ^ mask[i % 4]
      socket.write(Buffer.concat([header, masked]))
    },
    close() {
      try {
        socket?.end()
      } catch {
        /* ignore */
      }
      readyState = 3
    },
  }

  const reqLib = isTls ? https : http
  const req = reqLib.request({
    protocol: isTls ? 'https:' : 'http:',
    hostname: url.hostname,
    port: url.port || (isTls ? 443 : 80),
    path: url.pathname + url.search,
    headers: {
      Connection: 'Upgrade',
      Upgrade: 'websocket',
      'Sec-WebSocket-Version': '13',
      'Sec-WebSocket-Key': key,
    },
  })

  req.on('upgrade', (_res, sock) => {
    socket = sock
    readyState = 1
    sock.on('data', (chunk) => {
      buffer = Buffer.concat([buffer, chunk])
      while (true) {
        if (buffer.length < 2) return
        const opcode = buffer[0] & 0x0f
        const second = buffer[1]
        const masked = (second & 0x80) !== 0
        let payloadLen = second & 0x7f
        let offset = 2
        if (payloadLen === 126) {
          if (buffer.length < 4) return
          payloadLen = buffer.readUInt16BE(2)
          offset = 4
        } else if (payloadLen === 127) {
          if (buffer.length < 10) return
          payloadLen = Number(buffer.readBigUInt64BE(2))
          offset = 10
        }
        const maskLen = masked ? 4 : 0
        if (buffer.length < offset + maskLen + payloadLen) return
        let payload = buffer.subarray(offset + maskLen, offset + maskLen + payloadLen)
        if (masked) {
          const m = buffer.subarray(offset, offset + 4)
          const out = Buffer.alloc(payloadLen)
          for (let i = 0; i < payloadLen; i++) out[i] = payload[i] ^ m[i % 4]
          payload = out
        }
        buffer = buffer.subarray(offset + maskLen + payloadLen)
        if (opcode === 0x1) emit('message', { data: payload.toString('utf8') })
        else if (opcode === 0x8) {
          readyState = 3
          emit('close')
          sock.end()
          return
        }
      }
    })
    sock.on('error', (e) => emit('error', e))
    sock.on('close', () => {
      readyState = 3
      emit('close')
    })
    emit('open')
  })
  req.on('error', (e) => emit('error', e))
  req.end()
  return api
}
