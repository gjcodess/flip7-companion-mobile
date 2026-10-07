import { LoaderCircle, X } from 'lucide-react'
import { useId } from 'react'
import { createPortal } from 'react-dom'
import { motion } from 'motion/react'

type ConfirmationModalProps = {
  eyebrow?: string
  title: string
  message: string
  cancelLabel?: string
  confirmLabel?: string
  confirming?: boolean
  variant?: 'floating'
  edition?: 'classic' | 'vengeance'
  onCancel: () => void
  onConfirm: () => void
}

export function ConfirmationModal({ eyebrow = 'CONFIRM ACTION', title, message, cancelLabel = 'Cancel', confirmLabel = 'Continue', confirming = false, variant, edition, onCancel, onConfirm }: ConfirmationModalProps) {
  const id = useId()
  const titleId = `confirmation-modal-title-${id}`
  const messageId = `confirmation-modal-message-${id}`
  const isVengeance = edition === 'vengeance' || (
    edition === undefined &&
    typeof document !== 'undefined' &&
    Boolean(document.querySelector('.edition-vengeance, .page-vengeance-demo'))
  )
  const editionClass = isVengeance ? ' confirmation-modal--vengeance' : (edition ? ` confirmation-modal--${edition}` : '')
  const modal = <motion.div className={`picker-backdrop confirmation-backdrop${variant === 'floating' ? ' floating-confirmation-backdrop' : ''}`} initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={onCancel}>
    <motion.section className={`card-picker home-prompt confirmation-modal${variant === 'floating' ? ' floating-confirmation-modal' : ''}${editionClass}`} role="alertdialog" aria-modal="true" aria-labelledby={titleId} aria-describedby={messageId} initial={{ y: 40, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 40, opacity: 0 }} onClick={(event) => event.stopPropagation()}>
      <div className="picker-heading">
        <div><span>{eyebrow}</span><h2 id={titleId}>{title}</h2></div>
        <button className="close-button" type="button" aria-label="Cancel" title="Cancel" disabled={confirming} onClick={onCancel}><X size={19} /></button>
      </div>
      <p id={messageId} className="home-prompt-copy">{message}</p>
      <div className="home-prompt-actions">
        <button className="secondary-action" type="button" autoFocus disabled={confirming} onClick={onCancel}>{cancelLabel}</button>
        <button className="primary-wide confirmation-confirm" type="button" disabled={confirming} onClick={onConfirm}>{confirming ? <LoaderCircle className="spin" /> : confirmLabel}</button>
      </div>
    </motion.section>
  </motion.div>
  return variant === 'floating' ? createPortal(modal, document.body) : modal
}
