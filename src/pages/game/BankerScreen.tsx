import { RoomSharingButton, SharedRoomDialog } from '../mobile/SharedRoomControls'
import { RestartDialog } from './RestartDialog'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, ChevronRight, CircleHelp, ClipboardList, History, LogOut, Menu, Monitor, Play, RotateCcw, Share2, Users, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import { useRoomSheetMotion } from '../../lib/use-room-sheet-motion'
import type { Card } from '../../game/cards'
import { ForcedDrawStatus } from './ForcedDrawStatus'
import { bankerTableEntries } from '../../game/tableEntries'
import { allBankerPlayersSettled, bankerEligibleActionTargets, bankerInitialState, bankerPlayerDerived, bankerReducer, isBankerTerminal, type BankerAction, type BankerPlayer, type BankerState } from '../../game/bankerGame'
import { getLibrary, saveRoomState, useLibrary } from '../../lib/room-store'
import { blockSharedHost } from '../../lib/shared-room'
import { useRoomPresence } from '../../lib/shared-room-presence'
import { SeatConnectionBadge, seatConnection } from '../mobile/SeatConnectionBadge'
import { organizeDemoEntries } from '../../game/demoGame'
import { pointLabel } from '../../lib/app-utils'
import { useAppNavigation, useNavigationGuard } from '../../lib/navigation'
import { ConfirmationModal } from '../../components/ConfirmationModal'
import { CardActionsPanel, CardPickerPanel } from './CardDialogs'
import { GameControls } from './GameControls'
import { GameTable } from './GameTable'
import { tvSharingAvailable } from '../../lib/tv-share'
import { PlayerAvatar } from '../../components/PlayerAvatar'
import { ResultsShareDialog } from './ResultsShareDialog'
import { RoundHistoryDialog } from './RoundHistoryDialog'

function statusLabel(player: BankerPlayer) {
  const status = player.round.status
  return status === 'busted' ? 'Busted' : status === 'frozen' ? 'Frozen' : status === 'flip-seven' ? 'Flip 7!' : status === 'stayed' ? 'Banked' : 'Active'
}

function statusClass(player: BankerPlayer) {
  return player.round.status === 'flip-seven' ? 'stayed' : player.round.status
}

function playerTabSummary(player: BankerPlayer) {
  const derived = bankerPlayerDerived(player)
  const numberCardCount = player.round.entries.filter((entry) => !entry.voided && entry.card.kind === 'number').length
  if (player.round.status === 'active') return `${numberCardCount} cards · ${derived.score} ${pointLabel(derived.score)}`
  if (player.round.status === 'stayed') return `Banked · ${derived.score} ${pointLabel(derived.score)}`
  if (player.round.status === 'frozen') return `Frozen · ${derived.score} ${pointLabel(derived.score)}`
  if (player.round.status === 'flip-seven') return `Flip 7 · ${derived.score} ${pointLabel(derived.score)}`
  return 'Busted'
}

function BankerResults({ players, history, targetScore, onNewGame, onExit }: { players: BankerPlayer[]; history: { round: number; scores: Record<string, number> }[]; targetScore: number; onNewGame: () => void; onExit: () => void }) {
  const ordered = [...players].sort((a, b) => b.totalScore - a.totalScore)
  const winnerScore = ordered[0]?.totalScore ?? 0
  return <div className="banker-results">
    <section className="results-hero"><span className="eyebrow">BANKER TABLE COMPLETE</span><h1>Match complete!</h1><p>{ordered.filter((player) => player.totalScore === winnerScore).map((player) => player.name).join(' and ')} won with {winnerScore} points. Target: {targetScore}.</p></section>
    <section className="results-card">
      <div className="results-heading"><div><span className="eyebrow">FINAL SCORES</span><h2>Game results</h2></div><span className="results-heading-icon" aria-hidden="true"><ClipboardList size={21} /></span></div>
      <div className="results-list">{ordered.map((player) => {
        const rank = ordered.findIndex((entry) => entry.totalScore === player.totalScore) + 1
        return <article className={`results-player ${player.totalScore === winnerScore ? 'winner' : ''}`} key={player.id}>
          <span className="results-rank" aria-label={`Rank ${rank}`}>{rank}</span>
          <PlayerAvatar player={player} className="mini-avatar" />
          <div className="results-player-copy"><div className="results-player-name"><b>{player.name}</b></div><div className="results-rounds">{history.map((round) => <span className="round-score" key={`${player.id}-${round.round}`}>R{round.round}: {round.scores[player.id] ?? 0}</span>)}</div></div>
          <div className="results-total"><small>Total pts</small><strong>{player.totalScore}</strong></div>
        </article>
      })}</div>
    </section>
    <section className="results-actions"><p>Your final scores and round cards are saved in this room on your device.</p><div className="banker-results-actions"><button className="secondary-action" onClick={onNewGame}><RotateCcw size={16} /> New game</button><button className="primary-wide" onClick={onExit}><ArrowLeft size={16} /> View room</button></div></section>
  </div>
}

function BankerMenuDialog({ onClose, onOpenPlayers, onOpenRules, onOpenHistory, onOpenTvShare, onRestart, onExit }: { onClose: () => void; onOpenPlayers: () => void; onOpenRules: () => void; onOpenHistory: () => void; onOpenTvShare: () => void; onRestart: () => void; onExit: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const sheetMotion = useRoomSheetMotion()
  useEffect(() => { dialog.current?.showModal() }, [])
  return <motion.dialog {...sheetMotion} ref={dialog} className="room-dialog banker-menu-dialog tv-share-dialog" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="room-dialog-heading"><div><span className="room-kicker">BANKER MODE</span><h2>Game menu</h2></div><button className="room-icon-button" aria-label="Close menu" onClick={onClose}><X size={20} /></button></div>
    <div className="banker-menu-list">
      <button type="button" className="banker-menu-item" onClick={() => { onClose(); onOpenPlayers() }}>
        <div className="banker-menu-item-icon"><Users size={20} /></div>
        <div className="banker-menu-item-text"><strong>Players</strong><span>View current scores, status, and player details</span></div>
        <ChevronRight size={18} className="banker-menu-item-chevron" />
      </button>
      <button type="button" className="banker-menu-item" onClick={() => { onClose(); onOpenRules() }}>
        <div className="banker-menu-item-icon"><CircleHelp size={20} /></div>
        <div className="banker-menu-item-text"><strong>Rules & Guide</strong><span>Scoring rules, action cards, and banking guide</span></div>
        <ChevronRight size={18} className="banker-menu-item-chevron" />
      </button>
      <button type="button" className="banker-menu-item" onClick={() => { onClose(); onOpenHistory() }}>
        <div className="banker-menu-item-icon"><History size={20} /></div>
        <div className="banker-menu-item-text"><strong>Round history</strong><span>Cards and scores by round</span></div>
        <ChevronRight size={18} className="banker-menu-item-chevron" />
      </button>
      <button type="button" className="banker-menu-item" onClick={() => { onClose(); onRestart() }}>
        <div className="banker-menu-item-icon"><RotateCcw size={20} /></div>
        <div className="banker-menu-item-text"><strong>Restart</strong><span>Restart the current round or the whole game</span></div>
        <ChevronRight size={18} className="banker-menu-item-chevron" />
      </button>
      {tvSharingAvailable() && <button type="button" className="banker-menu-item" onClick={() => { onClose(); onOpenTvShare() }}>
        <div className="banker-menu-item-icon"><Monitor size={20} /></div>
        <div className="banker-menu-item-text"><strong>Share & connect</strong><span>Invite players, manage seats, or show scores on TV</span></div>
        <ChevronRight size={18} className="banker-menu-item-chevron" />
      </button>}
      <button type="button" className="banker-menu-item banker-menu-item-danger" onClick={() => { onClose(); onExit() }}>
        <div className="banker-menu-item-icon"><LogOut size={20} /></div>
        <div className="banker-menu-item-text"><strong>Exit game</strong><span>Return to room details (game stays saved)</span></div>
        <ChevronRight size={18} className="banker-menu-item-chevron" />
      </button>
    </div>
  </motion.dialog>
}

export function BankerScreen({ roomId }: { roomId: string }) {
  const navigate = useAppNavigation()
  const room = useLibrary().rooms.find(r => r.id === roomId)
  const onlineDevices = useRoomPresence(roomId)
  const [state, setState] = useState(() => room?.state ?? bankerInitialState())
  const [followTurns, setFollowTurns] = useState(() => { try { return localStorage.getItem('flip7.host.follow-turns.v1') !== 'false' } catch { return true } })
  const stateRef = useRef(state)
  const pendingSaveRef = useRef<BankerState | null>(null)
  const [saveError, setSaveError] = useState('')
  useEffect(() => {
    if (room?.state && !pendingSaveRef.current) { stateRef.current = room.state; setState(room.state) }
  }, [room?.state])
  useEffect(() => { blockSharedHost(roomId, Boolean(saveError)); return () => blockSharedHost(roomId, false) }, [roomId, saveError])
  const persist = useCallback((next: BankerState) => {
    try { saveRoomState(roomId, next); blockSharedHost(roomId, false); stateRef.current = next; pendingSaveRef.current = null; setState(next); setSaveError('') }
    catch (error) { blockSharedHost(roomId, true); pendingSaveRef.current = next; setSaveError(`${(error as Error).message} The last action is waiting to be saved. Retry before continuing.`) }
  }, [roomId])
  const dispatch = useCallback((action: BankerAction) => {
    if (action.type === 'reset') { navigate('/new'); return }
    if (pendingSaveRef.current) return
    const current = getLibrary().rooms.find(r => r.id === roomId)?.state ?? stateRef.current
    let next = bankerReducer(current, action)
    if (!followTurns && action.type !== 'select-player' && next !== current && current.selectedPlayerId && next.players.some(player => player.id === current.selectedPlayerId)) {
      next = { ...next, selectedPlayerId: current.selectedPlayerId }
    }
    if (next !== current) persist(next)
  }, [navigate, persist, roomId, followTurns])
  const [restartOpen, setRestartOpen] = useState(false)
  const [newGamePromptOpen, setNewGamePromptOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [organized, setOrganized] = useState(false)
  const [cardDialogClosing, setCardDialogClosing] = useState(false)
  const [correctionAction, setPendingAction] = useState<Card | null>(null)
  const [correctionActionSourceId, setPendingActionSourceId] = useState<string | null>(null)
  const [roundSummaryOpen, setRoundSummaryOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [playersOpen, setPlayersOpen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const [tvShareOpen, setTvShareOpen] = useState(false)
  const [resultsShareOpen, setResultsShareOpen] = useState(false)
  const cardSelectionRef = useRef(false)
  const pickerSessionRef = useRef(0)
  const activePickerSessionRef = useRef<number | null>(null)
  const actionTargetRef = useRef(false)
  const playerTabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const selectedPlayer = state.players.find((player) => player.id === state.selectedPlayerId) ?? state.players[0]
  const pendingAction = correctionAction ?? state.pendingAction?.card ?? null
  const pendingActionSourceId = correctionActionSourceId ?? state.pendingAction?.sourcePlayerId ?? null
  const forcedTurn = state.forcedTurns[0] ?? null
  const turnPlayerId = forcedTurn?.targetPlayerId ?? state.turnPlayerId
  const turnPlayer = state.players.find((player) => player.id === turnPlayerId)
  const derived = useMemo(() => selectedPlayer ? bankerPlayerDerived(selectedPlayer) : null, [selectedPlayer])
  const terminal = selectedPlayer ? isBankerTerminal(selectedPlayer.round.status) : false
  const allSettled = allBankerPlayersSettled(state)
  const canEdit = selectedPlayer?.round.status === 'active' || selectedPlayer?.round.status === 'busted'
  const canRecordCards = selectedPlayer?.id === turnPlayerId && selectedPlayer.round.status === 'active' && !state.pendingAction
  const canSettle = canRecordCards && !forcedTurn && Boolean(derived?.canStay) && (state.minimumNumberCardsToStay === undefined || (derived?.numberCardCount ?? 0) >= state.minimumNumberCardsToStay)
  const interactionLocked = pickerOpen || selectedCardIndex !== null || cardDialogClosing || pendingAction !== null || roundSummaryOpen || !canEdit
  const tableEntries = selectedPlayer ? bankerTableEntries(state, selectedPlayer.id) : []
  const table = tableEntries.map(entry => entry.card)
  const cardIds = tableEntries.map(entry => entry.instanceId)

  const exit = useCallback(() => navigate(`/room?id=${roomId}`, { replace: true }), [navigate, roomId])
  useNavigationGuard(saveError ? {
    eyebrow: 'UNSAVED ACTION',
    title: 'Leave without the last action?',
    message: 'Your previous save is safe, but the last action has not been written to this device. Retry saving to keep that action before leaving.',
    confirmLabel: 'Leave room',
    cancelLabel: 'Stay here',
    shouldBlock: () => true,
  } : null)

  useEffect(() => {
    if (state.phase === 'round' && allSettled) setRoundSummaryOpen(true)
    if (!allSettled) setRoundSummaryOpen(false)
  }, [allSettled, state.phase])

  useEffect(() => {
    if (!followTurns || state.phase !== 'round' || !turnPlayerId) return
    playerTabRefs.current[turnPlayerId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [followTurns, state.phase, turnPlayerId])

  const toggleFollowTurns = () => {
    const next = !followTurns
    setFollowTurns(next)
    try { localStorage.setItem('flip7.host.follow-turns.v1', String(next)) } catch { /* Keep this session's choice. */ }
    if (next && turnPlayerId && selectedPlayer?.id !== turnPlayerId) dispatch({ type: 'select-player', playerId: turnPlayerId })
  }

  if (!room || !room.state) return <div className="room-app-shell"><main className="room-app-main"><h1>{room ? 'This room is ready to start.' : 'This room is unavailable.'}</h1><button className="room-button" onClick={() => navigate(room ? `/room?id=${roomId}` : '/landing')}>Back to rooms</button></main></div>


  if (state.phase === 'results') return <div className="app-shell banker-shell saved-room-game"><aside className="desktop-marquee left"><div>FLIP<br />7</div></aside><main className="game-shell"><header className="topbar banker-topbar banker-results-topbar"><button type="button" className="banker-results-back" onClick={exit}><ArrowLeft size={18} /> Back to room</button><button type="button" className="brand-button banker-results-share" aria-label="Share game results" title="Share game results" onClick={() => setResultsShareOpen(true)}><Share2 size={18} /></button></header><BankerResults players={state.players} history={state.history} targetScore={state.targetScore} onNewGame={() => setNewGamePromptOpen(true)} onExit={exit} />{resultsShareOpen && <ResultsShareDialog roomName={room.name} players={state.players} history={state.history} targetScore={state.targetScore} onClose={() => setResultsShareOpen(false)} />}{newGamePromptOpen && <ConfirmationModal variant="floating" eyebrow="NEW BANKER GAME" title="Start a new game?" message="Your completed match stays saved in its room. Create a separate room for your next game." cancelLabel="Keep results" confirmLabel="New game" onCancel={() => setNewGamePromptOpen(false)} onConfirm={() => { setNewGamePromptOpen(false); dispatch({ type: 'reset' }) }} />}</main><aside className="desktop-marquee right"><div>PRESS<br />YOUR<br />LUCK</div></aside></div>

  const newRound = () => { dispatch({ type: 'advance-round' }); setRoundSummaryOpen(false); setOrganized(false) }
  const closePicker = () => { activePickerSessionRef.current = null; cardSelectionRef.current = false; setCardDialogClosing(true); setPickerOpen(false); setEditingIndex(null) }
  const openPicker = (cardIndex: number | null = null) => { activePickerSessionRef.current = ++pickerSessionRef.current; cardSelectionRef.current = false; setCardDialogClosing(false); setEditingIndex(cardIndex); setPickerOpen(true) }
  const selectCard = (card: Card) => {
    const isCorrection = editingIndex !== null
    if (!selectedPlayer || activePickerSessionRef.current === null || cardSelectionRef.current || (!isCorrection && !canRecordCards)) return
    cardSelectionRef.current = true
    activePickerSessionRef.current = null
    if (card.kind === 'action') {
      actionTargetRef.current = false
      setCardDialogClosing(true)
      setPickerOpen(false)
      if (isCorrection) {
        setPendingAction(card)
        setPendingActionSourceId(selectedPlayer.id)
      } else {
        dispatch({ type: 'reveal-action', sourcePlayerId: selectedPlayer.id, card })
        setEditingIndex(null)
      }
      return
    }
    dispatch(editingIndex === null
      ? { type: 'record-card', playerId: selectedPlayer.id, card }
      : { type: 'player', playerId: selectedPlayer.id, action: { type: 'replace', index: editingIndex, card } })
    setCardDialogClosing(false)
    setPickerOpen(false)
    setEditingIndex(null)
    setOrganized(false)
  }
  const closePendingAction = () => { if (state.pendingAction) dispatch({ type: 'undo' }); actionTargetRef.current = false; activePickerSessionRef.current = null; cardSelectionRef.current = false; setCardDialogClosing(true); setPendingAction(null); setPendingActionSourceId(null); setEditingIndex(null) }
  const chooseActionTarget = (playerId: string) => {
    if (!pendingAction || actionTargetRef.current) return
    if (!bankerEligibleActionTargets(state, pendingAction).some(player => player.id === playerId)) return
    actionTargetRef.current = true
    cardSelectionRef.current = true
    if (editingIndex !== null && playerId === selectedPlayer?.id) dispatch({ type: 'player', playerId, action: { type: 'replace', index: editingIndex, card: pendingAction } })
    else {
      if (editingIndex !== null && selectedPlayer) dispatch({ type: 'player', playerId: selectedPlayer.id, action: { type: 'remove', index: editingIndex } })
      if (editingIndex !== null) dispatch({ type: 'player', playerId, action: { type: 'add', card: pendingAction } })
      else if (pendingActionSourceId) dispatch({ type: 'record-action', sourcePlayerId: pendingActionSourceId, targetPlayerId: playerId, card: pendingAction })
    }
    actionTargetRef.current = false
    cardSelectionRef.current = false
    setPendingAction(null)
    setPendingActionSourceId(null)
    setEditingIndex(null)
    setCardDialogClosing(true)
    setOrganized(false)
  }
  const organize = () => {
    if (!selectedPlayer) return
    if (organized) {
      const original = [...selectedPlayer.round.entries].sort((a, b) => Number(a.instanceId.replace('demo-card-', '')) - Number(b.instanceId.replace('demo-card-', '')))
      dispatch({ type: 'player', playerId: selectedPlayer.id, action: { type: 'reorder', entries: original } })
      setOrganized(false)
      return
    }
    dispatch({ type: 'player', playerId: selectedPlayer.id, action: { type: 'reorder', entries: organizeDemoEntries(selectedPlayer.round.entries) } })
    setOrganized(true)
  }
  const playerStatus = selectedPlayer?.round.status === 'flip-seven' ? 'stayed' : selectedPlayer?.round.status
  return <div className="app-shell banker-shell saved-room-game"><aside className="desktop-marquee left"><div>FLIP<br />7</div></aside><main className="game-shell">
    <header className="topbar banker-topbar"><RoomSharingButton roomId={roomId} onClick={() => setTvShareOpen(true)} /><span className="game-topbar-brand"><img src="/assets/flip7-title-logo.webp" alt="Flip 7" /></span><button className="brand-button menu-button" aria-label="Open game menu" title="Menu" onClick={() => setShowMenu(true)}><Menu size={20} /></button></header>
    {saveError && <div className="room-game-save-error" role="alert"><span>{saveError}</span><button onClick={() => { if (pendingSaveRef.current) persist(pendingSaveRef.current) }}>Retry save</button></div>}
    <section className="match-strip"><div><span>ROUND</span><b>{String(state.roundNumber).padStart(2, '0')}</b></div><div className="target"><span>FIRST TO</span><b>{state.targetScore}</b></div><div className="viewing"><span>VIEWING</span><b>{selectedPlayer?.name || '—'}</b></div></section>
    <div className="banker-turn-callout has-follow-toggle" role="status"><span>CURRENT TURN</span><b>{turnPlayer?.name || '—'}</b><button type="button" className="follow-turns-toggle" aria-label={`Follow turns ${followTurns ? 'on' : 'off'}`} aria-pressed={followTurns} title="Follow current turn" onClick={toggleFollowTurns}>Follow</button></div>
    {forcedTurn && forcedTurn.remaining > 0 && <ForcedDrawStatus label="Flip Three" remaining={forcedTurn.remaining} total={3} />}
    <section className="banker-player-strip" aria-label="Player tables">{state.players.map((player) => <button key={player.id} ref={(element) => { playerTabRefs.current[player.id] = element }} className={`banker-player-tab opponent ${player.id === selectedPlayer?.id ? 'selected' : ''} ${player.id === turnPlayerId ? 'turn' : ''} ${statusClass(player)}`} aria-current={player.id === turnPlayerId ? 'step' : undefined} onClick={() => { dispatch({ type: 'select-player', playerId: player.id }); setOrganized(false); setSelectedCardIndex(null) }}><span className="host-player-avatar"><PlayerAvatar player={player} className="mini-avatar" /><SeatConnectionBadge status={seatConnection(room, player.id, onlineDevices)} compact /></span><span className="opponent-copy"><b>{player.name}</b><span>{playerTabSummary(player)}</span></span><strong><small>Total pts:</small> <b>{player.totalScore}</b></strong></button>)}</section>
    <GameTable table={table} tableCardIds={cardIds} isVoidedCard={(index) => Boolean(tableEntries[index]?.voided)} cardResolution={(index) => tableEntries[index]?.resolution} score={derived?.score ?? 0} flipSevenBonus={derived?.flipSevenBonus ?? 0} busted={selectedPlayer?.round.status === 'busted'} frozen={selectedPlayer?.round.status === 'frozen'} submitting={false} interactionLocked={interactionLocked || Boolean(saveError)} canEditCards={canEdit} canAddCards={canRecordCards} confirmedAt={terminal ? 'banker' : null} isStaying={selectedPlayer?.round.status === 'stayed'} isOrganized={organized} playerName={selectedPlayer?.name ?? 'Player'} isHost={false} onOrganize={organize} onOpenPicker={() => { if (!interactionLocked && canRecordCards) openPicker() }} onSelectCard={(index) => { if (!interactionLocked) setSelectedCardIndex(index) }} />
    <GameControls isHost allPlayersSettled={allSettled} submitting={false} canEditCards={canEdit} canSettle={canSettle} canUseHistory={state.phase === 'round'} hasCardsOrRemoval={state.past.length > 0} hasRedo={state.future.length > 0} isStaying={selectedPlayer?.round.status === 'stayed'} busted={selectedPlayer?.round.status === 'busted'} frozen={selectedPlayer?.round.status === 'frozen'} playerStatus={playerStatus} confirmedAt={terminal ? 'banker' : null} onNextRound={newRound} onUndo={() => dispatch({ type: 'undo' })} onStay={() => selectedPlayer && dispatch({ type: 'settle-player', playerId: selectedPlayer.id })} onRedo={() => dispatch({ type: 'redo' })} />
  </main><aside className="desktop-marquee right"><div>PRESS<br />YOUR<br />LUCK</div></aside>
    <AnimatePresence onExitComplete={() => { setCardDialogClosing(false) }}>
      {selectedCardIndex !== null && selectedPlayer?.round.entries[selectedCardIndex] && <motion.div key="card-actions" className="picker-backdrop card-focus-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={() => { setCardDialogClosing(true); setSelectedCardIndex(null) }}><CardActionsPanel card={selectedPlayer.round.entries[selectedCardIndex].card} cardVoided={selectedPlayer.round.entries[selectedCardIndex].voided} submitting={false} onClose={() => { setCardDialogClosing(true); setSelectedCardIndex(null) }} onEdit={() => { const index = selectedCardIndex; setSelectedCardIndex(null); openPicker(index) }} onRemove={() => { dispatch({ type: 'player', playerId: selectedPlayer.id, action: { type: 'remove', index: selectedCardIndex } }); setSelectedCardIndex(null); setOrganized(false) }} /></motion.div>}
      {pickerOpen && <motion.div key={`card-picker-${pickerSessionRef.current}`} className="picker-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={closePicker}><CardPickerPanel submitting={false} onClose={closePicker} onSelect={selectCard} /></motion.div>}
      {pendingAction && (
        <motion.div
          key="action-target"
          className="picker-backdrop"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0, pointerEvents: 'none' }}
          onClick={closePendingAction}
        >
          <motion.section
            className="card-picker physical-card-picker action-target-picker"
            role="dialog"
            aria-modal="true"
            initial={{ y: 50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            exit={{ y: 50, opacity: 0 }}
            transition={{ type: 'spring', stiffness: 450, damping: 32 }}
            onClick={(event) => event.stopPropagation()}
          >
            {(() => {
              const isFlipThree = pendingAction.id === 'action-flip-three'
              const isFreeze = pendingAction.id === 'action-freeze'
              const isSecondChance = pendingAction.id === 'action-second-chance'

              let eyebrow = `ACTION · ${pendingAction.label.toUpperCase()}`
              let title = `Who gets ${pendingAction.label}?`
              if (isFlipThree) title = 'Who flips three cards?'

              let subtitle = 'Only active player tables can receive action cards.'
              if (isFlipThree) {
                subtitle = 'Choose which active player table accepts the next three cards one at a time.'
              } else if (isFreeze) {
                subtitle = 'Choose which active player table freezes and banks their points immediately.'
              } else if (isSecondChance) {
                subtitle = 'Choose an active player without Second Chance. Each player may hold only one.'
              }

              const activePlayers = bankerEligibleActionTargets(state, pendingAction)

              return (
                <>
                  <div className="physical-picker-header">
                    <div className="picker-heading">
                      <div>
                        <span>{eyebrow}</span>
                        <h2>{title}</h2>
                      </div>
                      <button
                        className="close-button"
                        aria-label="Close action target"
                        title="Close"
                        onClick={closePendingAction}
                      >
                        <X size={19} />
                      </button>
                    </div>
                    <p>{subtitle}</p>
                  </div>

                  <div className="physical-picker-scroll action-target-scroll">
                    <div className="target-list banker-target-list">
                      {activePlayers.map((player) => (
                        <button
                          key={player.id}
                          type="button"
                          className="banker-actor-select-btn"
                          onClick={() => chooseActionTarget(player.id)}
                        >
                          <PlayerAvatar player={player} className="mini-avatar" />
                          <span className="banker-actor-btn-name">
                            <b>{player.name}</b>
                            {player.id === pendingActionSourceId && (
                              <span className="banker-current-tag">Current Turn</span>
                            )}
                          </span>
                        </button>
                      ))}
                      {activePlayers.length === 0 && (
                        <p className="banker-muted">There are no active player tables available.</p>
                      )}
                    </div>
                  </div>
                </>
              )
            })()}
          </motion.section>
        </motion.div>
      )}
      {playersOpen && <motion.div key="players" className="picker-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={() => setPlayersOpen(false)}><motion.section className="card-picker info-panel" initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }} onClick={(event) => event.stopPropagation()}><div className="info-panel-header"><div className="picker-heading"><div><span>AT THIS TABLE</span><h2>Players</h2></div><div className="panel-heading-actions"><b className="panel-count">{state.players.length} players</b><button className="close-button" aria-label="Close players" title="Close" onClick={() => setPlayersOpen(false)}><X size={19} /></button></div></div></div><div className="info-panel-scroll"><div className="info-list">{state.players.map((player) => { const playerScore = bankerPlayerDerived(player).score; return <div className={`info-player ${player.id === turnPlayerId ? 'current-player' : ''}`} key={player.id}><PlayerAvatar player={player} className="mini-avatar" /><div><b>{player.name}{player.id === turnPlayerId ? ' (current)' : ''}</b><small>{playerTabSummary(player)}</small><SeatConnectionBadge status={seatConnection(room, player.id, onlineDevices)} /></div><span className="info-player-scores"><span><small>ROUND</small><strong>{playerScore}</strong></span><span><small>TOTAL</small><strong>{player.totalScore}</strong></span></span></div> })}</div></div></motion.section></motion.div>}
      {roundSummaryOpen && <motion.div key="round-summary" className="picker-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }}><motion.section className="card-picker banker-summary" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={(event) => event.stopPropagation()}><div className="picker-heading"><div><span>ROUND {String(state.roundNumber).padStart(2, '0')} COMPLETE</span><h2>Everyone is settled.</h2></div><button className="close-button" aria-label="Close round summary" onClick={() => setRoundSummaryOpen(false)}><X size={19} /></button></div><div className="banker-round-summary-list">{state.players.map((player) => <div className={`banker-summary-player ${statusClass(player)}`} key={player.id}><PlayerAvatar player={player} className="mini-avatar" /><div className="banker-summary-player-copy"><b>{player.name}</b><span className={`banker-status-pill ${statusClass(player)}`}>{statusLabel(player)}</span></div><div className="banker-summary-score"><small>ROUND</small><strong>{bankerPlayerDerived(player).score}</strong></div></div>)}</div><p>Confirm these scores to finish the match or start the next round.</p><div className="banker-results-actions"><button className="primary-wide" onClick={newRound}><Check size={16} /> Confirm scores</button></div></motion.section></motion.div>}
      {newGamePromptOpen && <ConfirmationModal variant="floating" eyebrow="NEW BANKER GAME" title="Start a new game?" message="This match stays saved in its room. Create a separate room for your next game." cancelLabel="Keep table" confirmLabel="New game" onCancel={() => setNewGamePromptOpen(false)} onConfirm={() => { setNewGamePromptOpen(false); setRoundSummaryOpen(false); dispatch({ type: 'reset' }) }} />}
      {rulesOpen && <motion.div key="rules" className="picker-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={() => setRulesOpen(false)}><motion.section className="card-picker info-panel" initial={{ y: 50 }} animate={{ y: 0 }} onClick={(event) => event.stopPropagation()}><div className="info-panel-header"><div className="picker-heading"><div><span>BANKER MODE</span><h2>How it works</h2></div><button className="close-button" aria-label="Close rules" onClick={() => setRulesOpen(false)}><X size={19} /></button></div></div><div className="info-panel-scroll"><div className="rules-copy"><section><h3>Follow the highlighted table</h3><p>After each card, Banker Mode advances to the next active table. You can still open any table to correct, remove, undo, redo, or organize cards.</p></section><section><h3>Action cards</h3><p>Choose an active target. Freeze skips that table, Second Chance stays on its target, and Flip Three routes three cards there. A revealed Freeze or another Flip Three waits until those reveals finish; Second Chance can protect immediately.</p></section><section><h3>Settle the round</h3><p>Bank, bust, and frozen tables are skipped. Seven unique numbered cards end the round immediately and bank every other active table.</p></section></div></div></motion.section></motion.div>}
    </AnimatePresence>
    {showMenu && <BankerMenuDialog onClose={() => setShowMenu(false)} onOpenPlayers={() => setPlayersOpen(true)} onOpenRules={() => setRulesOpen(true)} onOpenHistory={() => setHistoryOpen(true)} onOpenTvShare={() => setTvShareOpen(true)} onRestart={() => setRestartOpen(true)} onExit={exit} />}
    {historyOpen && <RoundHistoryDialog room={room} history={state.history} onClose={() => setHistoryOpen(false)} />}
    {restartOpen && <RestartDialog disabled={Boolean(saveError)} onClose={() => setRestartOpen(false)} onRestart={scope => {
      dispatch({ type: 'restart', scope }); setRestartOpen(false); setRoundSummaryOpen(false);
      setOrganized(false); setSelectedCardIndex(null); setEditingIndex(null); setPendingAction(null); setPendingActionSourceId(null);
    }} />}
    {tvShareOpen && <SharedRoomDialog roomId={roomId} onClose={() => setTvShareOpen(false)} />}
  </div>
}
