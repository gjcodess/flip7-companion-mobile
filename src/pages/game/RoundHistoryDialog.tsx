import { useEffect, useRef } from 'react'
import { ChevronDown, Clock3, X } from 'lucide-react'
import { motion } from 'motion/react'
import type { BankerRoundResult } from '../../game/bankerGame'
import type { VHistory } from '../../game/vengeanceGame'
import { useRoomSheetMotion } from '../../lib/use-room-sheet-motion'
import { CardArtwork } from '../../components/CardArtwork'
import { PlayerAvatar } from '../../components/PlayerAvatar'
import type { Room } from '../../lib/room-store'
import '../mobile/SharedRooms.css'

export function RoundHistoryContent({ history, room }: { history: readonly (BankerRoundResult | VHistory)[]; room: Room }) {
  if (!history.length) return <div className="shared-history-empty"><Clock3 size={32} /><h3>No completed rounds yet</h3></div>
  return <div className="shared-history-list">{[...history].reverse().map(round =>
    <details className="room-round-detail" key={round.round}>
      <summary><span className="round-number">{String(round.round).padStart(2, '0')}</span><div><b>Round {round.round}</b><small>Scores & cards</small></div><ChevronDown size={19} /></summary>
      <div className="room-round-hands">{Object.entries(round.scores).map(([id, points]) => {
        const hand = round.hands?.[id]
        const rosterPlayer = room.roster.find(p => p.id === id)
        const player = { id, name: hand?.name ?? rosterPlayer?.name ?? 'Player', color: hand?.color ?? rosterPlayer?.color ?? '#57b8d7', avatar: hand?.avatar ?? rosterPlayer?.avatar }
        const penalizedFinisher = 'flipSevenChoice' in round && round.flipSevenChoice?.choice === 'penalize' && round.flipSevenChoice.finisherId === id
        const penalizedTarget = 'flipSevenChoice' in round && round.flipSevenChoice?.choice === 'penalize' && round.flipSevenChoice.targetId === id
        const status = penalizedFinisher ? 'stayed' : hand?.status ?? 'stayed'
        const statusLabel = status === 'busted' ? 'BUST' : status === 'flip-seven' ? 'FLIP 7!' : status === 'frozen' ? 'FROZEN' : 'BANKED'
        return <article className="room-history-hand" key={id}>
          <header><PlayerAvatar player={player} className="room-avatar small" /><b>{player.name}</b><span className={`${status}-label`}>{statusLabel}</span>{penalizedTarget && <span className="penalty-label">−15</span>}<strong className={points < 0 ? 'score-negative' : ''}>{points}<small>pts</small></strong></header>
          <div className="room-history-cards">{hand?.entries.map(entry => <div className={entry.voided ? 'voided' : ''} key={entry.instanceId} title={entry.voided ? `${entry.card.label} · discarded` : entry.card.label}><CardArtwork card={entry.card} lazy />{entry.voided && <span>DISCARD</span>}</div>)}</div>
        </article>
      })}</div>
    </details>
  )}</div>
}

export function RoundHistoryDialog({ history, room, onClose }: { history: readonly (BankerRoundResult | VHistory)[]; room: Room; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const sheetMotion = useRoomSheetMotion()
  useEffect(() => { dialog.current?.showModal() }, [])
  return <motion.dialog {...sheetMotion} ref={dialog} className={`room-dialog tv-share-dialog shared-room-dialog shared-game-dialog game-history-dialog ${room.edition === 'vengeance' ? 'edition-vengeance' : ''}`} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="room-dialog-heading"><div><span className="room-kicker">THIS GAME</span><h2>Round history</h2></div><button className="room-icon-button" aria-label="Close round history" onClick={onClose}><X size={20} /></button></div>
    <RoundHistoryContent history={history} room={room} />
  </motion.dialog>
}
