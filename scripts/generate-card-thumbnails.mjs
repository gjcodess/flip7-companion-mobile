// Mechanical preview generation only; the original card assets are never modified.
// Run with sharp installed, or set FLIP7_SHARP_PATH to an existing sharp package.
import { createRequire } from 'node:module'
import { mkdir, readdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const sharp = require(process.env.FLIP7_SHARP_PATH || 'sharp')
const source = fileURLToPath(new URL('../public/cards/', import.meta.url))
const output = path.join(source, 'thumbnails')
await mkdir(output, { recursive: true })
let originalBytes = 0
let previewBytes = 0
const names = (await readdir(source)).filter(name => name.endsWith('.webp') && name !== 'Back.webp')
for (const name of names) {
  const input = path.join(source, name)
  const filename = name.replace(/\+/g, 'plus-').replace(/ /g, '-').toLowerCase()
  const destination = path.join(output, filename)
  await sharp(input).resize({ width: 256, withoutEnlargement: true }).webp({ quality: 84, effort: 6 }).toFile(destination)
  originalBytes += (await stat(input)).size
  previewBytes += (await stat(destination)).size
}
console.log(`${names.length} previews: ${originalBytes} original bytes → ${previewBytes} preview bytes (${Math.round(100 * (1 - previewBytes / originalBytes))}% smaller).`)
