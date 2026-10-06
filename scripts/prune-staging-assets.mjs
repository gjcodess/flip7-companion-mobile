// Vite copies public/ verbatim. Keep the supplied PNG originals for editing,
// but leave their large staging copies out of the web and Android bundles.
import { readdir, rmdir, unlink } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const dist = fileURLToPath(new URL('../dist/', import.meta.url))
const staging = path.resolve(dist, 'cards', 'thumbnails_vengeance')
if (path.relative(dist, staging).startsWith('..')) throw new Error('Refusing to prune outside dist.')

let files = []
try { files = await readdir(staging) }
catch (error) { if (error.code !== 'ENOENT') throw error }
for (const name of files.filter(file => file.toLowerCase().endsWith('.png'))) {
  await unlink(path.join(staging, name))
}
if (files.length && files.every(file => file.toLowerCase().endsWith('.png'))) await rmdir(staging)
console.log(`Excluded ${files.filter(file => file.toLowerCase().endsWith('.png')).length} staging PNGs from dist.`)
