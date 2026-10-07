import { useState } from 'react'
import { motion } from 'motion/react'
import { Check, Sparkles, Swords, X } from 'lucide-react'
import { createPortal } from 'react-dom'
import type { VPlayer } from '../../game/vengeanceGame'
import { vengeanceScore } from '../../game/vengeanceGame'
import { PlayerAvatar } from '../../components/PlayerAvatar'

type BrutalFlipSevenModalProps = {
  finisher: VPlayer
  players: VPlayer[]
  onResolveSelf: () => void
  onResolvePenalize: (targetPlayerId: string) => void
}

export function BrutalFlipSevenModal({
  finisher,
  players,
  onResolveSelf,
  onResolvePenalize,
}: BrutalFlipSevenModalProps) {
  const [choice, setChoice] = useState<'self' | 'penalize'>('self')
  const rivals = players.filter((p) => p.id !== finisher.id)
  const [selectedTargetId, setSelectedTargetId] = useState<string>(rivals[0]?.id ?? '')

  const selectedTarget = rivals.find((p) => p.id === selectedTargetId)

  const handleConfirm = () => {
    if (choice === 'self') {
      onResolveSelf()
    } else if (selectedTargetId) {
      onResolvePenalize(selectedTargetId)
    }
  }

  const modal = (
    <motion.div
      className="picker-backdrop confirmation-backdrop floating-confirmation-backdrop v-flipseven-backdrop"
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0, pointerEvents: 'none' }}
    >
      <motion.section
        className="card-picker home-prompt confirmation-modal floating-confirmation-modal v-flipseven-dialog"
        role="alertdialog"
        aria-modal="true"
        aria-labelledby="v-flipseven-title"
        aria-describedby="v-flipseven-subtitle"
        initial={{ y: 40, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        exit={{ y: 40, opacity: 0 }}
        onClick={(e) => e.stopPropagation()}
      >
        <div className="picker-heading v-flipseven-heading">
          <div>
            <span className="v-flipseven-eyebrow">FLIP 7 BRUTAL REWARD</span>
            <h2 id="v-flipseven-title">{finisher.name} hit Flip 7!</h2>
          </div>
        </div>

        <p id="v-flipseven-subtitle" className="v-flipseven-intro">
          Choose how to deploy your 15-point Flip 7 bonus this round:
        </p>

        <div className="v-flipseven-choices">
          {/* Option 1: Claim for self */}
          <button
            type="button"
            className={`v-flipseven-choice-card ${choice === 'self' ? 'selected' : ''}`}
            onClick={() => setChoice('self')}
          >
            <div className="v-flipseven-radio" />
            <div className="v-flipseven-choice-info">
              <strong>
                <Sparkles size={15} /> Claim +15 PTS for yourself
              </strong>
              <small>Take the traditional bonus to boost your own round score.</small>
            </div>
          </button>

          {/* Option 2: Inflict on rival */}
          <button
            type="button"
            className={`v-flipseven-choice-card penalize ${choice === 'penalize' ? 'selected' : ''}`}
            onClick={() => setChoice('penalize')}
          >
            <div className="v-flipseven-radio" />
            <div className="v-flipseven-choice-info">
              <strong>
                <Swords size={15} /> Deduct −15 PTS from a rival
              </strong>
              <small>Inflict a direct 15-point penalty on an opponent (even if busted!).</small>
            </div>
          </button>
        </div>

        {/* Rival Selector when penalize is chosen */}
        {choice === 'penalize' && (
          <div className="v-flipseven-rival-section">
            <span className="v-flipseven-rival-label">Choose player to penalize:</span>
            <div className="v-flipseven-rival-list">
              {rivals.map((rival) => {
                const isSelected = selectedTargetId === rival.id
                const score = vengeanceScore(rival, 'brutal')
                return (
                  <button
                    key={rival.id}
                    type="button"
                    className={`v-flipseven-rival-btn ${isSelected ? 'selected' : ''}`}
                    onClick={() => setSelectedTargetId(rival.id)}
                  >
                    <PlayerAvatar player={rival} className="mini-avatar" />
                    <div className="v-rival-info">
                      <b>{rival.name}</b>
                      <small>
                        {rival.status === 'busted' ? 'Busted' : rival.status === 'stayed' ? 'Stayed' : 'Active'} · Round: {score} pts
                      </small>
                    </div>
                    {isSelected && <Check size={16} className="v-rival-check" />}
                  </button>
                )
              })}
            </div>
          </div>
        )}

        <div className="v-flipseven-actions">
          <button
            className={`primary-wide v-flipseven-confirm-btn ${choice === 'penalize' ? 'is-penalize' : ''}`}
            type="button"
            disabled={choice === 'penalize' && !selectedTargetId}
            onClick={handleConfirm}
          >
            {choice === 'self' ? (
              <>
                <Sparkles size={16} /> Claim +15 Points
              </>
            ) : (
              <>
                <Swords size={16} /> Deduct −15 from {selectedTarget?.name ?? 'Rival'}
              </>
            )}
          </button>
        </div>
      </motion.section>
    </motion.div>
  )

  return createPortal(modal, document.body)
}
