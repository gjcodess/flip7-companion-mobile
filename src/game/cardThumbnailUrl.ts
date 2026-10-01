/** Preview paths are presentation-only: saved card IDs and full-size faces stay unchanged. */
export function cardThumbnailUrl(imageUrl: string): string {
  const filename = imageUrl.slice(imageUrl.lastIndexOf('/') + 1).replace(/\+/g, 'plus-').replace(/ /g, '-').toLowerCase()
  return `/cards/thumbnails/${filename}`
}
