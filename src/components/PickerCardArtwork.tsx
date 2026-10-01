import { useState } from 'react'
import type { Card } from '../game/cards'
import { cardThumbnailUrl } from '../game/cardThumbnailUrl'

/** Small picker previews with an immediate, readable fallback instead of an empty tile. */
export function PickerCardArtwork({ card }: { card: Card }) {
  const [ready, setReady] = useState(false)
  const [failed, setFailed] = useState(false)
  return <span className={`picker-card-art${ready ? ' is-ready' : ''}`} aria-hidden="true">
    <span className={`picker-card-placeholder ${card.kind}`}><small>{card.kind.toUpperCase()}</small><b>{card.label}</b></span>
    {card.image && !failed && <img src={cardThumbnailUrl(card.image)} alt="" loading="eager" decoding="async" onLoad={async event => {
      const image = event.currentTarget
      try { await image.decode() } catch { /* The loaded image can still be displayed. */ }
      setReady(true)
    }} onError={() => setFailed(true)} />}
  </span>
}
