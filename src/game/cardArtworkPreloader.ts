import { pickerCards } from './cards'

let preloadPromise: Promise<void> | null = null
let preloadComplete = false

/**
 * Fetch the card artwork once so reopening a picker can reuse the browser's
 * cached resources instead of starting the image requests from scratch.
 * Errors are intentionally ignored here; the individual card images still
 * render normally and can retry through their own <img> elements.
 */
export function preloadCardArtwork(): Promise<void> {
  if (preloadPromise) return preloadPromise

  const imageUrls = pickerCards.flatMap((card) => card.image ? [card.image] : [])
  preloadPromise = Promise.all(imageUrls.map((url) => new Promise<void>((resolve) => {
    const image = new Image()
    let settled = false
    image.decoding = 'async'
    const finish = () => {
      if (settled) return
      settled = true
      if (typeof image.decode === 'function') {
        void image.decode().catch(() => undefined).finally(resolve)
      } else {
        resolve()
      }
    }
    image.onload = finish
    image.onerror = () => {
      if (settled) return
      settled = true
      resolve()
    }
    image.src = url
    if (image.complete) finish()
  }))).then(() => {
    preloadComplete = true
  })

  return preloadPromise
}

export function isCardArtworkPreloaded(): boolean {
  return preloadComplete
}
