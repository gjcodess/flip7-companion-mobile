import { Layers3 } from 'lucide-react'
import './ForcedDrawStatus.css'

type Props = { label: string; remaining: number; total: 1 | 3 | 4 }

export function ForcedDrawStatus({ label, remaining, total }: Props) {
  return <section className="forced-draw-status" role="status" aria-live="polite" aria-label={`${label}: ${remaining} of ${total} reveals remaining`}>
    <div className="forced-draw-heading">
      <span className="forced-draw-icon" aria-hidden="true"><Layers3 size={17} /></span>
      <strong>{label}</strong>
      <span className="forced-draw-count">{remaining} {remaining === 1 ? 'flip' : 'flips'} left</span>
    </div>
    <div className="forced-draw-progress" aria-hidden="true">{Array.from({ length: total }, (_, i) => <span key={i} className={i < total - remaining ? 'complete' : ''} />)}</div>
  </section>
}
