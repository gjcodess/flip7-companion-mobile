import type { Edition } from '../../lib/room-store'

/** Non-interactive corner artwork for the mobile library. */
export function PageArtwork({ edition = 'classic' }: { edition?: Edition }) {
  return <div className={`room-page-art room-page-art--${edition}`} aria-hidden="true"><img className="room-home-promo" src={edition === 'vengeance' ? '/assets/flip7-vengeance-logo.webp' : '/assets/promo-1.webp'} alt="" decoding="async" /></div>
}
