import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { existsSync, statSync } from 'node:fs'
import { pickerCards } from './cards'
import { cardThumbnailUrl } from './cardThumbnailUrl'

let images: FakeImage[]
let failOnce: string | null
let decodeFailure: boolean
let decodeWait: Promise<void> | null

class FakeImage {
  decoding = ''
  complete = false
  naturalWidth = 0
  onload: (() => void) | null = null
  onerror: (() => void) | null = null
  url = ''
  constructor() { images.push(this) }
  decode = vi.fn(() => decodeFailure ? Promise.reject(new Error('decode unavailable')) : decodeWait ?? Promise.resolve())
  set src(url: string) {
    this.url = url
    queueMicrotask(() => {
      this.complete = true
      if (failOnce === url) { failOnce = null; this.onerror?.(); return }
      this.naturalWidth = 256
      this.onload?.()
    })
  }
}

beforeEach(() => {
  vi.resetModules()
  images = []
  failOnce = null
  decodeFailure = false
  decodeWait = null
  vi.stubGlobal('Image', FakeImage)
})
afterEach(() => { vi.unstubAllGlobals() })

describe('picker preview artwork', () => {
  it('uses URL-safe preview names without changing card definitions', () => {
    expect(cardThumbnailUrl('/cards/+10.webp')).toBe('/cards/thumbnails/plus-10.webp')
    expect(cardThumbnailUrl('/cards/SECOND CHANCE.webp')).toBe('/cards/thumbnails/second-chance.webp')
    expect(pickerCards.find(card => card.label === '+10')?.image).toBe('/cards/+10.webp')
  })

  it('ships a smaller local preview for every selectable card', () => {
    let sourceBytes = 0
    let previewBytes = 0
    for (const card of pickerCards) {
      if (!card.image) continue
      const preview = `public${decodeURIComponent(cardThumbnailUrl(card.image))}`
      expect(existsSync(preview)).toBe(true)
      sourceBytes += statSync(`public${card.image}`).size
      previewBytes += statSync(preview).size
    }
    expect(previewBytes).toBeLessThan(sourceBytes * .35)
  })

  it('preloads and decodes only previews once, including concurrent requests', async () => {
    const { preloadCardArtwork, isCardArtworkPreloaded } = await import('./cardArtworkPreloader')
    const first = preloadCardArtwork()
    expect(preloadCardArtwork()).toBe(first)
    await first
    expect(isCardArtworkPreloaded()).toBe(true)
    expect(images).toHaveLength(pickerCards.length)
    expect(images.every(image => image.url.startsWith('/cards/thumbnails/'))).toBe(true)
    expect(images.every(image => image.decode.mock.calls.length === 1)).toBe(true)
    await preloadCardArtwork()
    expect(images).toHaveLength(pickerCards.length)
  })

  it('does not report decoded readiness until decoding finishes', async () => {
    let release!: () => void
    decodeWait = new Promise(resolve => { release = resolve })
    const { preloadCardArtwork, isCardArtworkPreloaded } = await import('./cardArtworkPreloader')
    const pending = preloadCardArtwork()
    await Promise.resolve()
    expect(isCardArtworkPreloaded()).toBe(false)
    release()
    await pending
    expect(isCardArtworkPreloaded()).toBe(true)
  })

  it('retries failed images without reloading successful previews', async () => {
    failOnce = '/cards/thumbnails/plus-6.webp'
    const { preloadCardArtwork, isCardArtworkPreloaded } = await import('./cardArtworkPreloader')
    await preloadCardArtwork()
    expect(isCardArtworkPreloaded()).toBe(false)
    await preloadCardArtwork()
    expect(isCardArtworkPreloaded()).toBe(true)
    expect(images).toHaveLength(pickerCards.length + 1)
  })

  it('handles WebViews that reject explicit decoding', async () => {
    decodeFailure = true
    const { preloadCardArtwork, isCardArtworkPreloaded } = await import('./cardArtworkPreloader')
    await expect(preloadCardArtwork()).resolves.toBeUndefined()
    expect(isCardArtworkPreloaded()).toBe(true)
  })
})
