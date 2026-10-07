/** Preview paths are presentation-only: saved card IDs and full-size faces stay unchanged. */
export function cardThumbnailUrl(imageUrl: string): string {
  const filename = imageUrl.slice(imageUrl.lastIndexOf('/') + 1).replace(/\+/g, 'plus-').replace(/ /g, '-').toLowerCase()
  return imageUrl.startsWith('/cards/vengeance/') ? `/cards/vengeance/thumbnails/${filename}` : `/cards/thumbnails/${filename}`
}
