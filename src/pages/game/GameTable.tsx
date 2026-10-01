import { useEffect } from 'react'
import { motion, AnimatePresence } from 'motion/react'
import { Crown, ListOrdered, LoaderCircle, Plus } from 'lucide-react'
import type { Card } from '../../game/cards'
import { preloadCardArtwork } from '../../game/cardArtworkPreloader'
import { CardArtwork } from '../../components/CardArtwork'

type GameTableProps = {
  table: Card[]
  tableCardIds: string[]
  isVoidedCard: (index: number) => boolean
  score: number
  flipSevenBonus: number
  busted: boolean
  frozen: boolean
  submitting: boolean
  interactionLocked: boolean
  canEditCards: boolean | undefined
  canAddCards?: boolean
  confirmedAt: string | null | undefined
  isStaying: boolean
  isOrganized: boolean
  playerName: string
  isHost: boolean
  onOrganize: () => void
  onOpenPicker: () => void
  onSelectCard: (index: number, card: Card) => void
}

export function GameTable({ table, tableCardIds, isVoidedCard, score, flipSevenBonus, busted, frozen, submitting, interactionLocked, canEditCards, canAddCards = true, confirmedAt, isStaying, isOrganized, playerName, isHost, onOrganize, onOpenPicker, onSelectCard }: GameTableProps) {
  useEffect(() => {
    void preloadCardArtwork()
  }, [])

  const cardRows = Array.from({ length: Math.ceil(table.length / 5) }, (_, rowIndex) => table.slice(rowIndex * 5, rowIndex * 5 + 5))
  return <section className="table-area">
    <div className="table-toolbar">
      <div className="table-heading">
        <div className="score-display">
          <span>{isHost && <Crown size={13} aria-label="Table owner" />} {playerName.toUpperCase()}'S SCORE</span>
          <motion.b key={score} initial={{ scale: 1.25, color: '#ed4f7e' }} animate={{ scale: 1, color: '#132d67' }}>{score}</motion.b>
          {busted ? (
            <small className="flip-seven-bonus bust-badge">BUST</small>
          ) : frozen ? (
            <small className="flip-seven-bonus freeze-badge">FREEZE</small>
          ) : isStaying || Boolean(confirmedAt && !busted && !frozen && !flipSevenBonus) ? (
            <small className="flip-seven-bonus stay-badge">STAY</small>
          ) : flipSevenBonus > 0 ? (
            <small className="flip-seven-bonus">+15</small>
          ) : null}
        </div>
      </div>
      <button className="organize-button" onClick={onOrganize} disabled={table.length < 2 || submitting || interactionLocked} title={isOrganized ? 'Restore original card order' : 'Organize cards'}><ListOrdered size={12} /> {isOrganized ? 'Original' : 'Organize'}</button>
    </div>
    <AnimatePresence>{submitting && <motion.div className="card-operation-status" initial={{ opacity: 0, scale: .9 }} animate={{ opacity: 1, scale: 1 }} exit={{ opacity: 0, scale: .9 }} role="status"><LoaderCircle className="spin" size={16} /> Updating table…</motion.div>}</AnimatePresence>
    <div className="card-table">
      <AnimatePresence initial={false}>
        <div className="card-rows" key="card-rows">
          {cardRows.map((row, rowIndex) => <div className={`card-row cards-${row.length}`} key={`card-row-${rowIndex}`}>
            <AnimatePresence initial={false}>
              {row.map((card, rowCardIndex) => {
                const index = rowIndex * 5 + rowCardIndex
                const cardVoided = isVoidedCard(index)
                return <motion.button
                  className={`table-card ${card.kind} ${cardVoided ? 'card-voided' : ''} ${busted ? 'card-busted' : ''}`}
                  key={tableCardIds[index] || card.id}
                  layout
                  initial={{ opacity: 0, y: -32, rotate: rowCardIndex % 2 ? 3 : -3 }}
                  animate={{ opacity: cardVoided || busted ? .42 : 1, y: 0, rotate: rowCardIndex % 2 ? 2 : -2 }}
                  exit={{ opacity: 0, y: -28 }}
                  transition={{ type: 'spring', stiffness: 380, damping: 22 }}
                  disabled={interactionLocked}
                  onClick={() => onSelectCard(index, card)}
                ><CardArtwork card={card} /></motion.button>
              })}
            </AnimatePresence>
          </div>)}
        </div>
        {!confirmedAt && !isStaying && !busted && !frozen && <button className="add-card-card" disabled={submitting || interactionLocked || !canEditCards || !canAddCards} onClick={() => { if (submitting || interactionLocked || !canEditCards || !canAddCards) return; onOpenPicker() }} aria-label="Record a physical card"><Plus size={30} /></button>}
      </AnimatePresence>
    </div>
  </section>
}
