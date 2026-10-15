import { LoaderCircle, Play, Redo2, Undo2 } from 'lucide-react'

type GameControlsProps = {
  isHost: boolean
  allPlayersSettled: boolean
  submitting: boolean
  canEditCards: boolean | undefined
  canSettle?: boolean
  canUseHistory?: boolean
  hasCardsOrRemoval: boolean
  hasRedo: boolean
  isStaying: boolean
  busted: boolean
  frozen: boolean
  playerStatus: 'active' | 'stayed' | 'busted' | 'frozen' | undefined
  confirmedAt: string | null | undefined
  onNextRound: () => void
  onUndo: () => void
  onStay: () => void
  onRedo: () => void
}

export function GameControls({ isHost, allPlayersSettled, submitting, canEditCards, canSettle = false, canUseHistory = canEditCards, hasCardsOrRemoval, hasRedo, isStaying, busted, frozen, playerStatus, confirmedAt, onNextRound, onUndo, onStay, onRedo }: GameControlsProps) {
  return <section className="actions">
    {isHost && allPlayersSettled && <button className="next-round-button" disabled={submitting} onClick={onNextRound}>{submitting ? <LoaderCircle className="spin" size={17} /> : <Play size={17} />} Proceed to next round</button>}
    <button className="secondary-action" disabled={!hasCardsOrRemoval || submitting || !canUseHistory} onClick={onUndo}><Undo2 size={19} /> Undo</button>
    <button className={`stay-action ${isStaying || busted || frozen || (playerStatus != null && playerStatus !== 'active') ? 'confirmed' : ''} ${busted ? 'bust-state' : ''} ${frozen ? 'frozen-state' : ''}`} disabled={!canSettle || busted || frozen || submitting || confirmedAt !== null} onClick={onStay}>{busted ? <>BUST!</> : frozen ? <>FREEZED!</> : confirmedAt ? <>BANKED!</> : playerStatus && playerStatus !== 'active' ? <>Confirm round</> : isStaying ? <>Staying</> : <>STAY / BANK</>}</button>
    <button className="secondary-action redo-action" disabled={!hasRedo || submitting || !canUseHistory} onClick={onRedo}><Redo2 size={19} /> Redo</button>
  </section>
}
