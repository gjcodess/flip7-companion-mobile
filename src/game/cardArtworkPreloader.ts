import { pickerCards } from './cards'
import { cardThumbnailUrl } from './cardThumbnailUrl'

let preloadPromise: Promise<void> | null = null
let preloadComplete = false
// Retain small decoded previews between openings, not full-size card faces.
const decodedPreviews = new Map<string, HTMLImageElement>()

/**
 * Warm only the lightweight picker previews. Failed previews can retry later;
 * the picker renders readable labels immediately and never waits for this batch.
 */
export function preloadCardArtwork(): Promise<void> {
  if (preloadPromise) return preloadPromise

  const imageUrls = [...new Set(pickerCards.flatMap((card) => card.image ? [cardThumbnailUrl(card.image)] : []))]
  preloadPromise = Promise.all(imageUrls.map((url) => new Promise<void>((resolve) => {
    if (decodedPreviews.has(url)) { resolve(); return }
    const image = new Image()
    let settled = false
    image.decoding = 'async'
    const finish = async () => {
      if (settled) return
      settled = true
      if (image.naturalWidth > 0) {
        if (typeof image.decode === 'function') {
          try { await image.decode() } catch { /* Older WebViews may reject decode(). */ }
        }
        decodedPreviews.set(url, image)
      }
      resolve()
    }
    image.onload = () => { void finish() }
    image.onerror = () => {
      if (settled) return
      settled = true
      resolve()
    }
    image.src = url
    if (image.complete) void finish()
  }))).then(() => {
    preloadComplete = decodedPreviews.size === imageUrls.length
    if (!preloadComplete) preloadPromise = null
  })

  return preloadPromise
}

export function isCardArtworkPreloaded(): boolean {
  return preloadComplete
}
