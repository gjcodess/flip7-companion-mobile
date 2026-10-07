import { ShieldAlert, Swords, Target, TrendingDown, X } from 'lucide-react'
import { motion } from 'motion/react'
import { createPortal } from 'react-dom'

type BrutalWarningModalProps = {
  onCancel: () => void
  onConfirm: () => void
}

export function BrutalWarningModal({ onCancel, onConfirm }: BrutalWarningModalProps) {
  const modal = (
    <motion.div
      className="picker-backdrop confirmation-backdrop floating-confirmation-backdrop brutal-warning-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, pointerEvents: 'none' }}
      onClick={onCancel}
    >
      <motion.section
        className="card-picker home-prompt confirmation-modal floating-confirmation-modal brutal-warning-modal"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="brutal-modal-title"
        aria-describedby="brutal-modal-copy"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(event) => event.stopPropagation()}
      >
        <div className="picker-heading">
          <div>
            <span className="brutal-eyebrow">
              <ShieldAlert size={13} /> HIGH STAKES RULESET
            </span>
            <h2 id="brutal-modal-title">BRUTAL MODE</h2>
          </div>
          <button
            className="close-button"
            type="button"
            aria-label="Close"
            onClick={onCancel}
          >
            <X size={19} />
          </button>
        </div>

        <p id="brutal-modal-copy" className="home-prompt-copy brutal-intro">
          Brutal Mode removes all safety nets. Scores can plunge into negative numbers and no player is ever safe from attack:
        </p>

        <div className="brutal-rules-list">
          <div className="brutal-rule-card">
            <div className="brutal-rule-badge">
              <TrendingDown size={17} />
            </div>
            <div className="brutal-rule-content">
              <strong>Sub-Zero Scoring</strong>
              <p>Round scores and cumulative match totals can drop below 0 (e.g. −8 PTS). There is no floor!</p>
            </div>
          </div>

          <div className="brutal-rule-card">
            <div className="brutal-rule-badge">
              <Target size={17} />
            </div>
            <div className="brutal-rule-content">
              <strong>Target Busted Players</strong>
              <p>Modifiers can be dealt to any player—even after they’ve busted. (÷2 has no effect on a busted player and is discarded).</p>
            </div>
          </div>

          <div className="brutal-rule-card">
            <div className="brutal-rule-badge">
              <Swords size={17} />
            </div>
            <div className="brutal-rule-content">
              <strong>Flip 7 Steal or Score</strong>
              <p>When you hit Flip 7, choose either to claim <b>+15 PTS</b> for yourself OR deduct <b>−15 PTS</b> directly from another player!</p>
            </div>
          </div>
        </div>

        <div className="home-prompt-actions">
          <button
            className="secondary-action"
            type="button"
            autoFocus
            onClick={onCancel}
          >
            Stay in Standard
          </button>
          <button
            className="primary-wide confirmation-confirm brutal-confirm-btn"
            type="button"
            onClick={onConfirm}
          >
            Accept the Challenge
          </button>
        </div>
      </motion.section>
    </motion.div>
  )

  return createPortal(modal, document.body)
}
