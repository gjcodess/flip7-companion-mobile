import { open, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

// The release catalog has 27 selectable faces. The app uses readable labels
// during development, but a release needs both full faces and picker previews.
const ids = [
  ...Array.from({ length: 13 }, (_, index) => `v-number-${index + 1}`),
  'v-number-zero', 'v-number-unlucky-7', 'v-number-lucky-13',
  'v-modifier-half',
  ...[2, 4, 6, 8, 10].map(value => `v-modifier-minus-${value}`),
  ...['just-one-more', 'swap', 'steal', 'discard', 'flip-four'].map(name => `v-action-${name}`),
]
const cards = fileURLToPath(new URL('../public/cards/vengeance/', import.meta.url))
const missing = []

for (const id of ids) {
  for (const directory of ['', 'thumbnails']) {
    const file = path.join(cards, directory, `${id}.webp`)
    try {
      if ((await stat(file)).size < 12) { missing.push(file); continue }
      const handle = await open(file, 'r')
      try {
        const signature = Buffer.alloc(12)
        await handle.read(signature, 0, 12, 0)
        if (signature.toString('ascii', 0, 4) !== 'RIFF' || signature.toString('ascii', 8, 12) !== 'WEBP') missing.push(file)
      } finally { await handle.close() }
    } catch { missing.push(file) }
  }
}

if (missing.length) {
  console.error(`Vengeance release artwork is incomplete (${missing.length} missing or empty files):\n${missing.join('\n')}`)
  process.exitCode = 1
} else {
  console.log(`All ${ids.length} Vengeance faces and thumbnails are present.`)
}
