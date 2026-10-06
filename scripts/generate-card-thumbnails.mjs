// Mechanical preview generation only; the original card assets are never modified.
// Run with sharp installed, or set FLIP7_SHARP_PATH to an existing sharp package.
import { createRequire } from 'node:module'
import { mkdir, readdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const require = createRequire(import.meta.url)
const sharp = require(process.env.FLIP7_SHARP_PATH || 'sharp')
const source = fileURLToPath(new URL('../public/cards/', import.meta.url))
let originalBytes = 0
let previewBytes = 0
let count = 0
for (const directory of [source, path.join(source, 'vengeance')]) {
  let names
  try { names = (await readdir(directory)).filter(name => name.endsWith('.webp') && name !== 'Back.webp') }
  catch { continue }
  const output = path.join(directory, 'thumbnails')
  await mkdir(output, { recursive: true })
  for (const name of names) {
    const input = path.join(directory, name)
    const filename = name.replace(/\+/g, 'plus-').replace(/ /g, '-').toLowerCase()
    const destination = path.join(output, filename)
    await sharp(input).resize({ width: 256, withoutEnlargement: true }).webp({ quality: 84, effort: 6 }).toFile(destination)
    originalBytes += (await stat(input)).size
    previewBytes += (await stat(destination)).size
    count++
  }
}
console.log(`${count} previews: ${originalBytes} original bytes → ${previewBytes} preview bytes (${Math.round(100 * (1 - previewBytes / originalBytes))}% smaller).`)
