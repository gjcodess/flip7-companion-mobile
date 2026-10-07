import sharp from 'sharp'
import { readdir, readFile, writeFile, stat } from 'node:fs/promises'
import { fileURLToPath } from 'node:url'
import path from 'node:path'

const cardsDir = fileURLToPath(new URL('../public/cards/', import.meta.url))
const assetsDir = fileURLToPath(new URL('../public/assets/', import.meta.url))
const androidResDir = fileURLToPath(new URL('../android/app/src/main/res/', import.meta.url))

async function optimizeClassicCards() {
  console.log('Optimizing Classic cards...')
  const entries = await readdir(cardsDir)
  const webpCards = entries.filter(f => f.endsWith('.webp') && !f.startsWith('.'))
  let beforeTotal = 0
  let afterTotal = 0

  for (const card of webpCards) {
    const filePath = path.join(cardsDir, card)
    const beforeSize = (await stat(filePath)).size
    beforeTotal += beforeSize

    const inputBuffer = await readFile(filePath)
    const outputBuffer = await sharp(inputBuffer)
      .resize({ width: 640, withoutEnlargement: true })
      .webp({ quality: 85, effort: 6 })
      .toBuffer()

    await writeFile(filePath, outputBuffer)
    const afterSize = (await stat(filePath)).size
    afterTotal += afterSize
  }

  console.log(`Classic cards: ${(beforeTotal / 1024 / 1024).toFixed(2)} MB → ${(afterTotal / 1024 / 1024).toFixed(2)} MB`)
}

async function optimizeWebAssets() {
  console.log('Optimizing web assets...')
  
  // 1. flip7-title-logo.webp
  const logoPath = path.join(assetsDir, 'flip7-title-logo.webp')
  const logoBefore = (await stat(logoPath)).size
  const logoIn = await readFile(logoPath)
  const logoBuf = await sharp(logoIn)
    .resize({ width: 750, withoutEnlargement: true })
    .webp({ quality: 86, effort: 6 })
    .toBuffer()
  await writeFile(logoPath, logoBuf)
  const logoAfter = (await stat(logoPath)).size
  console.log(`flip7-title-logo.webp: ${(logoBefore / 1024).toFixed(1)} KB → ${(logoAfter / 1024).toFixed(1)} KB`)

  // 2. flip7-vengeance-logo.webp
  const vLogoPath = path.join(assetsDir, 'flip7-vengeance-logo.webp')
  const vLogoBefore = (await stat(vLogoPath)).size
  const vLogoIn = await readFile(vLogoPath)
  const vLogoBuf = await sharp(vLogoIn)
    .resize({ width: 700, withoutEnlargement: true })
    .webp({ quality: 85, effort: 6 })
    .toBuffer()
  await writeFile(vLogoPath, vLogoBuf)
  const vLogoAfter = (await stat(vLogoPath)).size
  console.log(`flip7-vengeance-logo.webp: ${(vLogoBefore / 1024).toFixed(1)} KB → ${(vLogoAfter / 1024).toFixed(1)} KB`)

  // 3. promo images
  for (const promoName of ['promo-1.webp', 'promo-2.webp']) {
    const promoPath = path.join(assetsDir, promoName)
    const promoBefore = (await stat(promoPath)).size
    const promoIn = await readFile(promoPath)
    const promoBuf = await sharp(promoIn)
      .resize({ width: 384, withoutEnlargement: true })
      .webp({ quality: 85, effort: 6 })
      .toBuffer()
    await writeFile(promoPath, promoBuf)
    const promoAfter = (await stat(promoPath)).size
    console.log(`${promoName}: ${(promoBefore / 1024).toFixed(1)} KB → ${(promoAfter / 1024).toFixed(1)} KB`)
  }

  // 4. flip7-companion-icon-512-rounded.png
  const iconPath = path.join(assetsDir, 'flip7-companion-icon-512-rounded.png')
  const iconBefore = (await stat(iconPath)).size
  const iconIn = await readFile(iconPath)
  const iconBuf = await sharp(iconIn)
    .png({ compressionLevel: 9, effort: 10 })
    .toBuffer()
  await writeFile(iconPath, iconBuf)
  const iconAfter = (await stat(iconPath)).size
  console.log(`flip7-companion-icon-512-rounded.png: ${(iconBefore / 1024).toFixed(1)} KB → ${(iconAfter / 1024).toFixed(1)} KB`)
}

async function optimizeAndroidIcons() {
  console.log('Optimizing Android launcher foreground icons...')
  const densities = ['mdpi', 'hdpi', 'xhdpi', 'xxhdpi', 'xxxhdpi']
  for (const d of densities) {
    const iconFile = path.join(androidResDir, `mipmap-${d}`, 'ic_launcher_foreground.png')
    try {
      const before = (await stat(iconFile)).size
      const iconIn = await readFile(iconFile)
      const buf = await sharp(iconIn).png({ compressionLevel: 9, effort: 10 }).toBuffer()
      await writeFile(iconFile, buf)
      const after = (await stat(iconFile)).size
      console.log(`mipmap-${d} foreground: ${(before / 1024).toFixed(1)} KB → ${(after / 1024).toFixed(1)} KB`)
    } catch {
      // density might not exist
    }
  }
}

async function main() {
  await optimizeClassicCards()
  await optimizeWebAssets()
  await optimizeAndroidIcons()
  console.log('Asset optimization completed successfully!')
}

main().catch(err => {
  console.error(err)
  process.exit(1)
})
