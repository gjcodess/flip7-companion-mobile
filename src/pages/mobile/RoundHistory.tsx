import { ArrowRight, ChevronDown, History, Play } from 'lucide-react'
import type { BankerRoundResult } from '../../game/bankerGame'
import type { VHistory } from '../../game/vengeanceGame'
import type { PlayerProfile } from '../../lib/room-store'
import { CardArtwork } from '../../components/CardArtwork'
import { PlayerAvatar } from '../../components/PlayerAvatar'

export type RoundHistoryProps = {
  roster: PlayerProfile[]
  showHeading?: boolean
  currentRound?: number
  onReturnToTable?: () => void
} & (
  | { edition: 'classic'; history: BankerRoundResult[] }
  | { edition: 'vengeance'; history: VHistory[] }
)

function RoundHeading({ round, playerCount }: { round: number; playerCount: number }) {
  return <summary>
    <span className="round-number">{String(round).padStart(2, '0')}</span>
    <div><b>Round {round}</b><small>{playerCount} players · scores &amp; cards</small></div>
    <ChevronDown size={19} />
  </summary>
}

function HistoryCards({ entries }: { entries?: { instanceId: string; card: Parameters<typeof CardArtwork>[0]['card']; voided?: boolean }[] }) {
  return <div className="room-history-cards">
    {entries?.map(entry => <div className={entry.voided ? 'voided' : ''} key={entry.instanceId} title={entry.voided ? `${entry.card.label} · discarded` : entry.card.label}>
      <CardArtwork card={entry.card} lazy />{entry.voided && <span>DISCARD</span>}
    </div>)}
    {!entries?.length && <p>No cards recorded.</p>}
  </div>
}

function ClassicRounds({ history, roster }: { history: BankerRoundResult[]; roster: PlayerProfile[] }) {
  return [...history].reverse().map(round => <details className="room-round-detail" key={round.round}>
    <RoundHeading round={round.round} playerCount={Object.keys(round.scores).length} />
    <div className="room-round-hands">{Object.entries(round.scores).map(([id, score]) => {
      const hand = round.hands?.[id]
      const player = hand ? { id, name: hand.name, color: hand.color, avatar: hand.avatar ?? roster.find(p => p.id === id)?.avatar } : roster.find(p => p.id === id)
      const status = hand?.status ?? 'stayed'
      const statusLabel = status === 'busted' ? 'BUST' : status === 'flip-seven' ? 'FLIP 7!' : status === 'frozen' ? 'FROZEN' : 'BANKED'
      return <article className="room-history-hand" key={id}>
        <header>{player && <PlayerAvatar player={player} className="room-avatar small" />}<b>{player?.name ?? 'Player'}</b><span className={`${status}-label`}>{statusLabel}</span><strong>{score}<small>pts</small></strong></header>
        <HistoryCards entries={hand?.entries} />
      </article>
    })}</div>
  </details>)
}

function VengeanceRounds({ history, roster }: { history: VHistory[]; roster: PlayerProfile[] }) {
  return [...history].reverse().map(round => <details className="room-round-detail" key={round.round}>
    <RoundHeading round={round.round} playerCount={Object.keys(round.scores).length} />
    <div className="room-round-hands">{Object.entries(round.hands).map(([playerId, hand]) => {
      const player = roster.find(item => item.id === playerId) ?? { id: playerId, name: hand.name ?? 'Former player', color: hand.color ?? '#132d67', avatar: hand.avatar }
      const isPenalizedFinisher = round.flipSevenChoice?.choice === 'penalize' && round.flipSevenChoice.finisherId === playerId
      const isPenalizedTarget = round.flipSevenChoice?.choice === 'penalize' && round.flipSevenChoice.targetId === playerId
      const status = isPenalizedFinisher ? 'stayed' : hand.status ?? 'stayed'
      const statusLabel = status === 'busted' ? 'BUST' : status === 'flip-seven' ? 'FLIP 7' : status === 'frozen' ? 'FROZEN' : 'BANKED'
      const score = round.scores[playerId] ?? 0
      return <article className="room-history-hand" key={playerId}>
        <header><PlayerAvatar player={player} className="room-avatar small" /><b>{player.name}</b><span className={`${status}-label`}>{statusLabel}</span>{isPenalizedTarget && <span className="penalty-label">-15 PENALTY</span>}<strong className={score < 0 ? 'score-negative' : ''}>{score}<small>pts</small></strong></header>
        <HistoryCards entries={hand.entries} />
      </article>
    })}</div>
  </details>)
}

export function RoundHistory(props: RoundHistoryProps) {
  const { roster, currentRound, onReturnToTable } = props
  return <div className="round-history-content">
    {props.history.length ? props.edition === 'vengeance'
      ? <VengeanceRounds history={props.history} roster={roster} />
      : <ClassicRounds history={props.history} roster={roster} />
      : <section className="room-empty"><div className="room-empty-icon"><History size={29} /></div><h2>Your story starts on round one</h2><p>{props.edition === 'vengeance' ? 'Actions and card ownership will be kept with each round.' : 'Finish a round to save each player’s score and cards here.'}</p></section>}
    {props.edition === 'classic' && currentRound !== undefined && onReturnToTable && <div className="room-current-note"><Play size={16} /><p>Round {currentRound} is saved and waiting.<button onClick={onReturnToTable}>Back to the table <ArrowRight size={13} /></button></p></div>}
  </div>
}
