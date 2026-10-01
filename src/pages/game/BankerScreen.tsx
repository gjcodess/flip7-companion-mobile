import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { ArrowLeft, Check, CircleHelp, ClipboardList, LogOut, Menu, Play, RotateCcw, Users, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { Card } from '../../game/cards'
import { allBankerPlayersSettled, bankerInitialState, bankerPlayerDerived, bankerReducer, isBankerTerminal, type BankerAction, type BankerPlayer, type BankerState } from '../../game/bankerGame'
import { getLibrary, saveRoomState } from '../../lib/room-store'
import { organizeDemoEntries } from '../../game/demoGame'
import { pointLabel } from '../../lib/app-utils'
import { useAppNavigation, useNavigationGuard } from '../../lib/navigation'
import { ConfirmationModal } from '../../components/ConfirmationModal'
import { CardActionsPanel, CardPickerPanel } from './CardDialogs'
import { GameControls } from './GameControls'
import { GameTable } from './GameTable'

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
  return <div className="banker-results"><section className="results-hero"><span className="eyebrow">BANKER TABLE COMPLETE</span><h1>Match complete!</h1><p>{ordered.filter((player) => player.totalScore === winnerScore).map((player) => player.name).join(' and ')} won with {winnerScore} points. Target: {targetScore}.</p></section><section className="results-card"><div className="results-heading"><div><span className="eyebrow">FINAL SCORES</span><h2>Game results</h2></div><ClipboardList size={24} /></div><div className="results-list">{ordered.map((player, index) => <article className={`results-player ${index === 0 ? 'winner' : ''}`} key={player.id}><span className="results-rank">{index + 1}</span><span className="mini-avatar" style={{ background: player.color }}>{player.name[0]}</span><div className="results-player-copy"><div className="results-player-name"><b>{player.name}</b><small>{player.totalScore} {pointLabel(player.totalScore)} total</small></div><div className="results-rounds">{history.map((round) => <span className="round-score" key={`${player.id}-${round.round}`}>R{round.round}: {round.scores[player.id] ?? 0}</span>)}</div></div><div className="results-total"><small>Total pts</small><strong>{player.totalScore}</strong></div></article>)}</div></section><section className="results-actions"><p>Your final scores and round cards are saved in this room on your device.</p><div className="banker-results-actions"><button className="secondary-action" onClick={onNewGame}><RotateCcw size={16} /> New game</button><button className="primary-wide" onClick={onExit}><ArrowLeft size={16} /> View room</button></div></section></div>
}

export function BankerScreen({ roomId }: { roomId: string }) {
  const navigate = useAppNavigation()
  const room = getLibrary().rooms.find(r => r.id === roomId)
  const [state, setState] = useState(() => room?.state ?? bankerInitialState())
  const stateRef = useRef(state)
  const pendingSaveRef = useRef<BankerState | null>(null)
  const [saveError, setSaveError] = useState('')
  const persist = useCallback((next: BankerState) => {
    try { saveRoomState(roomId, next); stateRef.current = next; pendingSaveRef.current = null; setState(next); setSaveError('') }
    catch (error) { pendingSaveRef.current = next; setSaveError(`${(error as Error).message} The last action is waiting to be saved. Retry before continuing.`) }
  }, [roomId])
  const dispatch = useCallback((action: BankerAction) => {
    if (action.type === 'reset') { navigate('/new'); return }
    if (pendingSaveRef.current) return
    const next = bankerReducer(stateRef.current, action)
    if (next !== stateRef.current) persist(next)
  }, [navigate, persist])
  const [newGamePromptOpen, setNewGamePromptOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [organized, setOrganized] = useState(false)
  const [cardDialogClosing, setCardDialogClosing] = useState(false)
  const [pendingAction, setPendingAction] = useState<Card | null>(null)
  const [pendingActionSourceId, setPendingActionSourceId] = useState<string | null>(null)
  const [roundSummaryOpen, setRoundSummaryOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [playersOpen, setPlayersOpen] = useState(false)
  const [showMenu, setShowMenu] = useState(false)
  const cardSelectionRef = useRef(false)
  const pickerSessionRef = useRef(0)
  const activePickerSessionRef = useRef<number | null>(null)
  const actionTargetRef = useRef(false)
  const playerTabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const selectedPlayer = state.players.find((player) => player.id === state.selectedPlayerId) ?? state.players[0]
  const forcedTurn = state.forcedTurns[0] ?? null
  const turnPlayerId = forcedTurn?.targetPlayerId ?? state.turnPlayerId
  const turnPlayer = state.players.find((player) => player.id === turnPlayerId)
  const derived = useMemo(() => selectedPlayer ? bankerPlayerDerived(selectedPlayer) : null, [selectedPlayer])
  const terminal = selectedPlayer ? isBankerTerminal(selectedPlayer.round.status) : false
  const allSettled = allBankerPlayersSettled(state)
  const canEdit = selectedPlayer?.round.status === 'active' || selectedPlayer?.round.status === 'busted'
  const canRecordCards = selectedPlayer?.id === turnPlayerId && selectedPlayer.round.status === 'active'
  const canSettle = canRecordCards && !forcedTurn
  const interactionLocked = pickerOpen || selectedCardIndex !== null || cardDialogClosing || pendingAction !== null || roundSummaryOpen || !canEdit
  const table = selectedPlayer?.round.entries.map((entry) => entry.card) ?? []
  const cardIds = selectedPlayer?.round.entries.map((entry) => entry.instanceId) ?? []

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
    if (state.phase !== 'round' || !turnPlayerId) return
    playerTabRefs.current[turnPlayerId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [state.phase, turnPlayerId])

  if (!room || !room.state) return <div className="room-app-shell"><main className="room-app-main"><h1>{room ? 'This room is ready to start.' : 'This room is unavailable.'}</h1><button className="room-button" onClick={() => navigate(room ? `/room?id=${roomId}` : '/landing')}>Back to rooms</button></main></div>


  if (state.phase === 'results') return <div className="app-shell banker-shell saved-room-game"><aside className="desktop-marquee left"><div>FLIP<br />7</div></aside><main className="game-shell"><header className="topbar banker-topbar"><button className="brand-button" aria-label="Exit banker mode" onClick={exit}><img className="brand-logo" src="/assets/flip7-title-logo.png" alt="Flip 7" /></button><span className="topbar-caption">BANKER MODE · LOCAL ONLY</span></header><BankerResults players={state.players} history={state.history} targetScore={state.targetScore} onNewGame={() => setNewGamePromptOpen(true)} onExit={exit} />{newGamePromptOpen && <ConfirmationModal eyebrow="NEW BANKER GAME" title="Start a new game?" message="Your completed match stays saved in its room. Create a separate room for your next game." cancelLabel="Keep results" confirmLabel="New game" onCancel={() => setNewGamePromptOpen(false)} onConfirm={() => { setNewGamePromptOpen(false); dispatch({ type: 'reset' }) }} />}</main><aside className="desktop-marquee right"><div>PRESS<br />YOUR<br />LUCK</div></aside></div>

  const newRound = () => { dispatch({ type: 'advance-round' }); setRoundSummaryOpen(false); setOrganized(false) }
  const resetForNewGame = () => setNewGamePromptOpen(true)
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
      setPendingAction(card)
      setPendingActionSourceId(selectedPlayer.id)
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
  const closePendingAction = () => { actionTargetRef.current = false; activePickerSessionRef.current = null; cardSelectionRef.current = false; setCardDialogClosing(true); setPendingAction(null); setPendingActionSourceId(null); setEditingIndex(null) }
  const chooseActionTarget = (playerId: string) => {
    if (!pendingAction || actionTargetRef.current) return
    if (state.players.find((player) => player.id === playerId)?.round.status !== 'active') return
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
    <header className="topbar banker-topbar"><button className="brand-button" aria-label="Back to saved room" onClick={exit}><ArrowLeft size={21} /></button><span className="game-topbar-brand"><img src="/assets/flip7-title-logo.png" alt="Flip 7" /></span><button className="account-pill exit-button" aria-label="Open banker menu" onClick={() => setShowMenu((open) => !open)}><Menu size={16} /> Menu</button>{showMenu && <div className="banker-menu"><div className="banker-menu-title">BANKER MODE</div><div className="banker-menu-divider" /><button onClick={() => { setShowMenu(false); setPlayersOpen(true) }}><Users size={16} /> Players</button><button onClick={() => { setShowMenu(false); setRulesOpen(true) }}><CircleHelp size={16} /> Rules</button><button onClick={exit}><LogOut size={16} /> Exit</button></div>}</header>
    {saveError && <div className="room-game-save-error" role="alert"><span>{saveError}</span><button onClick={() => { if (pendingSaveRef.current) persist(pendingSaveRef.current) }}>Retry save</button></div>}
    <section className="match-strip"><div><span>ROUND</span><b>{String(state.roundNumber).padStart(2, '0')}</b></div><div className="target"><span>FIRST TO</span><b>{state.targetScore}</b></div><div><span>VIEWING</span><b>{selectedPlayer?.name || '—'}</b></div></section>
    <div className="banker-turn-callout" role="status"><span>CURRENT TURN</span><b>{turnPlayer?.name || '—'}</b></div>
    <section className="banker-player-strip" aria-label="Player tables">{state.players.map((player) => <button key={player.id} ref={(element) => { playerTabRefs.current[player.id] = element }} className={`banker-player-tab opponent ${player.id === selectedPlayer?.id ? 'selected' : ''} ${player.id === turnPlayerId ? 'turn' : ''} ${statusClass(player)}`} aria-current={player.id === turnPlayerId ? 'step' : undefined} onClick={() => { dispatch({ type: 'select-player', playerId: player.id }); setOrganized(false); setSelectedCardIndex(null) }}><span className="mini-avatar" style={{ background: player.color }}><span className="banker-avatar-initial">{player.name[0]}</span></span><span className="opponent-copy"><b>{player.name}</b><span>{playerTabSummary(player)}</span></span><strong><small>Total pts:</small> <b>{player.totalScore}</b></strong></button>)}</section>
    <GameTable table={table} tableCardIds={cardIds} isVoidedCard={(index) => Boolean(selectedPlayer?.round.entries[index]?.voided)} score={derived?.score ?? 0} flipSevenBonus={derived?.flipSevenBonus ?? 0} busted={selectedPlayer?.round.status === 'busted'} frozen={selectedPlayer?.round.status === 'frozen'} submitting={false} interactionLocked={interactionLocked || Boolean(saveError)} canEditCards={canEdit} canAddCards={canRecordCards} confirmedAt={terminal ? 'banker' : null} isStaying={selectedPlayer?.round.status === 'stayed'} isOrganized={organized} playerName={selectedPlayer?.name ?? 'Player'} isHost={false} onOrganize={organize} onOpenPicker={() => { if (!interactionLocked && canRecordCards) openPicker() }} onSelectCard={(index) => { if (!interactionLocked) setSelectedCardIndex(index) }} />
    <GameControls isHost allPlayersSettled={allSettled} submitting={false} canEditCards={canEdit} canSettle={canSettle} canUseHistory={state.phase === 'round'} hasCardsOrRemoval={state.past.length > 0} hasRedo={state.future.length > 0} isStaying={selectedPlayer?.round.status === 'stayed'} busted={selectedPlayer?.round.status === 'busted'} frozen={selectedPlayer?.round.status === 'frozen'} numberCardCount={derived?.numberCardCount ?? 0} playerStatus={playerStatus} confirmedAt={terminal ? 'banker' : null} onNextRound={newRound} onUndo={() => dispatch({ type: 'undo' })} onStay={() => selectedPlayer && dispatch({ type: 'settle-player', playerId: selectedPlayer.id })} onRedo={() => dispatch({ type: 'redo' })} />
  </main><aside className="desktop-marquee right"><div>PRESS<br />YOUR<br />LUCK</div></aside>
    <AnimatePresence onExitComplete={() => { setCardDialogClosing(false) }}>
      {selectedCardIndex !== null && selectedPlayer?.round.entries[selectedCardIndex] && <motion.div key="card-actions" className="picker-backdrop card-focus-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={() => { setCardDialogClosing(true); setSelectedCardIndex(null) }}><CardActionsPanel card={selectedPlayer.round.entries[selectedCardIndex].card} cardVoided={selectedPlayer.round.entries[selectedCardIndex].voided} submitting={false} onClose={() => { setCardDialogClosing(true); setSelectedCardIndex(null) }} onEdit={() => { const index = selectedCardIndex; setSelectedCardIndex(null); openPicker(index) }} onRemove={() => { dispatch({ type: 'player', playerId: selectedPlayer.id, action: { type: 'remove', index: selectedCardIndex } }); setSelectedCardIndex(null); setOrganized(false) }} /></motion.div>}
      {pickerOpen && <motion.div key={`card-picker-${pickerSessionRef.current}`} className="picker-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={closePicker}><CardPickerPanel submitting={false} onClose={closePicker} onSelect={selectCard} /></motion.div>}
      {pendingAction && <motion.div key="action-target" className="picker-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={closePendingAction}><motion.section className="card-picker action-target-picker" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} transition={{ duration: .14, ease: 'easeOut' }} onClick={(event) => event.stopPropagation()}><div className="picker-heading"><div><span>ACTION TARGET</span><h2>Who gets {pendingAction.label}?</h2></div><button className="close-button" aria-label="Close action target" title="Close" onClick={closePendingAction}><X size={19} /></button></div><p>Only active tables can receive action cards. Freeze skips its target, while Flip Three temporarily routes the next cards there.</p><div className="target-list banker-target-list">{state.players.filter((player) => player.round.status === 'active').map((player) => <button key={player.id} onClick={() => chooseActionTarget(player.id)}>{player.name}{player.id === pendingActionSourceId ? ' (current)' : ''}</button>)}{state.players.every((player) => player.round.status !== 'active') && <p className="banker-muted">There are no active player tables available.</p>}</div></motion.section></motion.div>}
      {playersOpen && <motion.div key="players" className="picker-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={() => setPlayersOpen(false)}><motion.section className="card-picker info-panel" initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }} onClick={(event) => event.stopPropagation()}><div className="picker-heading"><div><span>AT THIS TABLE</span><h2>Players</h2></div><div className="panel-heading-actions"><b className="panel-count">{state.players.length} players</b><button className="close-button" aria-label="Close players" title="Close" onClick={() => setPlayersOpen(false)}><X size={19} /></button></div></div><div className="info-list">{state.players.map((player) => { const playerScore = bankerPlayerDerived(player).score; return <div className={`info-player ${player.id === selectedPlayer?.id ? 'current-player' : ''}`} key={player.id}><span className="mini-avatar" style={{ background: player.color }}>{player.name[0]}</span><div><b>{player.name}{player.id === selectedPlayer?.id ? ' (current)' : ''}</b><small>{playerTabSummary(player)}</small></div><strong>{playerScore}</strong></div> })}</div></motion.section></motion.div>}
      {roundSummaryOpen && <motion.div key="round-summary" className="picker-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }}><motion.section className="card-picker banker-summary" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={(event) => event.stopPropagation()}><div className="picker-heading"><div><span>ROUND {String(state.roundNumber).padStart(2, '0')} COMPLETE</span><h2>Everyone is settled.</h2></div><button className="close-button" aria-label="Close round summary" onClick={() => setRoundSummaryOpen(false)}><X size={19} /></button></div><div className="banker-round-summary-list">{state.players.map((player) => <div className={`banker-summary-player ${statusClass(player)}`} key={player.id}><span className="mini-avatar" style={{ background: player.color }}>{player.name[0]}</span><div className="banker-summary-player-copy"><b>{player.name}</b><span className={`banker-status-pill ${statusClass(player)}`}>{statusLabel(player)}</span></div><div className="banker-summary-score"><small>ROUND</small><strong>{bankerPlayerDerived(player).score}</strong></div></div>)}</div><p>Confirm these scores to finish the match or start the next round.</p><div className="banker-results-actions"><button className="secondary-action" onClick={resetForNewGame}><RotateCcw size={16} /> New game</button><button className="primary-wide" onClick={newRound}><Check size={16} /> Confirm scores</button></div></motion.section></motion.div>}
      {newGamePromptOpen && <ConfirmationModal eyebrow="NEW BANKER GAME" title="Start a new game?" message="This match stays saved in its room. Create a separate room for your next game." cancelLabel="Keep table" confirmLabel="New game" onCancel={() => setNewGamePromptOpen(false)} onConfirm={() => { setNewGamePromptOpen(false); setRoundSummaryOpen(false); dispatch({ type: 'reset' }) }} />}
      {rulesOpen && <motion.div key="rules" className="picker-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={() => setRulesOpen(false)}><motion.section className="card-picker info-panel" initial={{ y: 50 }} animate={{ y: 0 }} onClick={(event) => event.stopPropagation()}><div className="picker-heading"><div><span>BANKER MODE</span><h2>How it works</h2></div><button className="close-button" aria-label="Close rules" onClick={() => setRulesOpen(false)}><X size={19} /></button></div><div className="rules-copy"><section><h3>Follow the highlighted table</h3><p>After each card, Banker Mode advances to the next active table. You can still open any table to correct, remove, undo, redo, or organize cards.</p></section><section><h3>Action cards</h3><p>Choose an active target. Freeze skips that table, Second Chance stays on its target, and Flip Three routes the next three cards there one at a time before returning to the original order.</p></section><section><h3>Settle the round</h3><p>Bank, bust, and frozen tables are skipped. Seven unique numbered cards end the round immediately and bank every other active table.</p></section></div></motion.section></motion.div>}
    </AnimatePresence>
  </div>
}
