// Convert the supplied PNG artwork without changing the originals.
import sharp from 'sharp'
import { mkdir, readdir, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const source = fileURLToPath(new URL('../public/cards/thumbnails_vengeance/', import.meta.url))
const output = fileURLToPath(new URL('../public/cards/vengeance/', import.meta.url))
const previews = path.join(output, 'thumbnails')
const names = ['one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen']
const faces = new Map([
  ...names.map((name, index) => [`${name}.png`, `v-number-${index + 1}.webp`]),
  ['the_zero.png', 'v-number-zero.webp'],
  ['unlucky.png', 'v-number-unlucky-7.webp'],
  ['lucky.png', 'v-number-lucky-13.webp'],
  ['÷2.png', 'v-modifier-half.webp'],
  ...[2, 4, 6, 8, 10].map(value => [`-${value}.png`, `v-modifier-minus-${value}.webp`]),
  ...['just-one-more', 'swap', 'steal', 'discard', 'flip-four'].map(name => [`${name}.png`, `v-action-${name}.webp`]),
  ['back.png', 'back.webp'],
])

const supplied = (await readdir(source)).filter(name => name.toLowerCase().endsWith('.png'))
const missing = [...faces.keys()].filter(name => !supplied.includes(name))
const unmapped = supplied.filter(name => !faces.has(name))
if (missing.length || unmapped.length) {
  throw new Error(`Vengeance artwork mapping needs attention. Missing: ${missing.join(', ') || 'none'}. Unmapped: ${unmapped.join(', ') || 'none'}.`)
}

await mkdir(previews, { recursive: true })
let sourceBytes = 0
let outputBytes = 0
for (const [inputName, outputName] of faces) {
  const input = path.join(source, inputName)
  const full = path.join(output, outputName)
  const preview = path.join(previews, outputName)
  await sharp(input).webp({ quality: 90, effort: 6 }).toFile(full)
  await sharp(input).resize({ width: 256, withoutEnlargement: true }).webp({ quality: 84, effort: 6 }).toFile(preview)
  sourceBytes += (await stat(input)).size
  outputBytes += (await stat(full)).size + (await stat(preview)).size
}
console.log(`Converted ${faces.size - 1} Vengeance faces plus the card back to full-size and 256px-wide WebP art. ${Math.round(sourceBytes / 1024 / 1024)} MB PNG → ${(outputBytes / 1024 / 1024).toFixed(1)} MB WebP.`)
