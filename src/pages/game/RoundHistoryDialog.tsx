import { useEffect, useRef } from 'react'
import { X } from 'lucide-react'
import { useBackAction } from '../../lib/back-actions'
import { RoundHistory, type RoundHistoryProps } from '../mobile/RoundHistory'

export function RoundHistoryDialog({ onClose, ...historyProps }: RoundHistoryProps & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useBackAction(true, onClose, 100)
  useEffect(() => { dialog.current?.showModal() }, [])

  return <dialog ref={dialog} className={`room-dialog round-history-dialog edition-${historyProps.edition}`} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="room-dialog-heading"><div><span className="room-kicker">{historyProps.edition === 'vengeance' ? 'WITH A VENGEANCE' : 'BANKER MODE'}</span><h2>Round History</h2></div><button type="button" className="room-icon-button" aria-label="Close round history" onClick={onClose}><X size={20} /></button></div>
    <RoundHistory {...historyProps} />
  </dialog>
}
