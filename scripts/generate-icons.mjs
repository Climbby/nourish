import sharp from 'sharp'
import { mkdir } from 'node:fs/promises'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const __dirname = dirname(fileURLToPath(import.meta.url))
const publicDir = join(__dirname, '..', 'public')
const source = join(publicDir, 'logo.svg')
const background = '#111416'

async function writeIcon(size, filename) {
  await sharp(source)
    .resize(size, size)
    .flatten({ background })
    .png()
    .toFile(join(publicDir, filename))
}

await mkdir(publicDir, { recursive: true })

await writeIcon(512, 'pwa-512x512.png')
await writeIcon(512, 'maskable-icon-512x512.png')
await writeIcon(192, 'pwa-192x192.png')
await writeIcon(64, 'pwa-64x64.png')
await writeIcon(180, 'apple-touch-icon-180x180.png')

console.log('PWA icons generated from logo.svg')
