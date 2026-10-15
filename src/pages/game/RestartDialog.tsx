import { useEffect, useRef } from 'react'
import { RotateCcw, X } from 'lucide-react'

export function RestartDialog({ edition = 'classic', disabled = false, onClose, onRestart }: {
  edition?: 'classic' | 'vengeance'
  disabled?: boolean
  onClose: () => void
  onRestart: (scope: 'game' | 'round') => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog ref={dialog} className={`room-dialog banker-menu-dialog edition-${edition}`} aria-labelledby="restart-title"
    onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="room-dialog-heading">
      <div><span className="room-kicker">RESTART</span><h2 id="restart-title">What would you like to restart?</h2></div>
      <button type="button" className="room-icon-button" aria-label="Cancel restart" onClick={onClose}><X size={20} /></button>
    </div>
    <p>Players and game settings stay the same. Choose what to clear.</p>
    <div className="banker-menu-list">
      <button type="button" className="banker-menu-item" disabled={disabled} onClick={() => onRestart('round')}>
        <div className="banker-menu-item-icon"><RotateCcw size={20} /></div>
        <div className="banker-menu-item-text"><strong>Restart current round</strong><span>Clear this round’s cards and actions. Keep scores from completed rounds.</span></div>
      </button>
      <button type="button" className="banker-menu-item banker-menu-item-danger" disabled={disabled} onClick={() => onRestart('game')}>
        <div className="banker-menu-item-icon"><RotateCcw size={20} /></div>
        <div className="banker-menu-item-text"><strong>Restart whole game</strong><span>Clear all scores and round history. Start again at round 1.</span></div>
      </button>
    </div>
  </dialog>
}
