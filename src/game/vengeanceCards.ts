import type { Card } from './cards'

export type VengeanceCard = Card & { value?: number }

const number = (value: number): VengeanceCard => ({ id: `v-number-${value}`, label: String(value), kind: 'number', points: value, value })
const modifier = (name: string, label: string, points?: number): VengeanceCard => ({ id: `v-modifier-${name}`, label, kind: 'modifier', points })
const action = (name: string, label: string): VengeanceCard => ({ id: `v-action-${name}`, label, kind: 'action' })

// Missing artwork leaves a legible card face. Adding the matching WebP files enables art automatically.
const catalog: VengeanceCard[] = [
  ...Array.from({ length: 13 }, (_, index) => number(index + 1)),
  { id: 'v-number-zero', label: 'The Zero', kind: 'number', points: 0, value: 0 },
  { id: 'v-number-unlucky-7', label: 'Unlucky 7', kind: 'number', points: 7, value: 7 },
  { id: 'v-number-lucky-13', label: 'Lucky 13', kind: 'number', points: 13, value: 13 },
  modifier('half', '÷2'),
  ...[2, 4, 6, 8, 10].map(value => modifier(`minus-${value}`, `−${value}`, -value)),
  action('just-one-more', 'Just One More!'),
  action('swap', 'Swap'),
  action('steal', 'Steal'),
  action('discard', 'Discard'),
  action('flip-four', 'Flip Four!'),
]

export const vengeanceCards: VengeanceCard[] = catalog.map(card => ({ ...card, image: vengeanceArtwork(card) }))

export function vengeanceCard(id: string) { return vengeanceCards.find(card => card.id === id) }

export function vengeanceArtwork(card: VengeanceCard) {
  return `/cards/vengeance/${card.id}.webp`
}
