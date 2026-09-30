import { useCallback, useEffect, useMemo, useReducer, useRef, useState } from 'react'
import { ArrowDown, ArrowLeft, ArrowUp, CircleHelp, ClipboardList, LogOut, Menu, Play, RotateCcw, UserPlus, Users, X } from 'lucide-react'
import { AnimatePresence, motion } from 'motion/react'
import type { Card } from '../../game/cards'
import { allBankerPlayersSettled, bankerInitialState, bankerPlayerDerived, bankerReducer, isBankerTerminal, type BankerPlayer, type BankerRoundResult, type BankerState } from '../../game/bankerGame'
import { organizeDemoEntries } from '../../game/demoGame'
import { pointLabel } from '../../lib/app-utils'
import { createLocalId, getSavedMatch, listSavedPlayers, saveMatch, updateMatch, type SavedMatch, type SavedPlayer } from '../../lib/local-store'
import { useAppNavigation } from '../../lib/navigation'
import { ConfirmationModal } from '../../components/ConfirmationModal'
import { AppBottomNav } from '../../components/AppBottomNav'
import { CardActionsPanel, CardPickerPanel } from './CardDialogs'
import { GameControls } from './GameControls'
import { GameTable } from './GameTable'

const defaultNames = ['', '', '']

function compactSavedState(state: BankerState): BankerState {
  return {
    ...state,
    past: [],
    future: [],
    players: state.players.map((player) => ({ ...player, round: { ...player.round, past: [], future: [] } })),
  }
}

function newSavedMatch(): SavedMatch {
  const now = Date.now()
  return { id: createLocalId(), title: 'New match', status: 'draft', targetScore: 200, playerNames: [...defaultNames], state: null, createdAt: now, updatedAt: now }
}

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

function BankerSetup({ initialNames, initialTargetScore, initialTitle, savedPlayers, onChange, onStart, onSaveDraft }: {
  initialNames: string[]
  initialTargetScore: number
  initialTitle: string
  savedPlayers: SavedPlayer[]
  onChange: (title: string, targetScore: number, names: string[]) => void
  onStart: (targetScore: number, names: string[]) => void
  onSaveDraft: (title: string, targetScore: number, names: string[]) => void
}) {
  const [names, setNames] = useState(initialNames.length ? initialNames : defaultNames)
  const [title, setTitle] = useState(initialTitle)
  const [targetScore, setTargetScore] = useState<number | ''>(initialTargetScore)
  const [warning, setWarning] = useState('')
  useEffect(() => onChange(title, typeof targetScore === 'number' ? targetScore : initialTargetScore, names), [title, targetScore, names, initialTargetScore, onChange])
  const updateName = (index: number, name: string) => setNames((current) => current.map((value, valueIndex) => valueIndex === index ? name : value))
  const moveName = (index: number, direction: -1 | 1) => setNames((current) => {
    const nextIndex = index + direction
    if (nextIndex < 0 || nextIndex >= current.length) return current
    const next = [...current]
      ;[next[index], next[nextIndex]] = [next[nextIndex], next[index]]
    return next
  })
  const addSavedPlayer = (player: SavedPlayer) => setNames((current) => {
    const emptyIndex = current.findIndex((name) => !name.trim())
    if (current.some((name) => name.trim().toLowerCase() === player.name.toLowerCase())) return current
    if (emptyIndex >= 0) return current.map((name, index) => index === emptyIndex ? player.name : name)
    if (current.length >= 18) return current
    return [...current, player.name]
  })
  const start = () => {
    const cleaned = names.map((name) => name.trim())
    if (cleaned.length < 3) return setWarning('A banker table needs at least 3 players.')
    if (cleaned.some((name) => !name)) return setWarning('Every player needs a name.')
    if (new Set(cleaned.map((name) => name.toLowerCase())).size !== cleaned.length) return setWarning('Player names must be unique.')
    if (typeof targetScore !== 'number' || !Number.isInteger(targetScore) || targetScore < 50 || targetScore > 500) return setWarning('First-to target must be between 50 and 500.')
    setWarning('')
    onStart(targetScore, cleaned)
  }
  const cleanedNames = names.map((name) => name.trim())
  const validTarget = typeof targetScore === 'number' && Number.isInteger(targetScore) && targetScore >= 50 && targetScore <= 500
  const canStart = names.length >= 3 && cleanedNames.every(Boolean) && new Set(cleanedNames.map((name) => name.toLowerCase())).size === cleanedNames.length && validTarget
  return <div className="banker-setup-wrap">
    <section className="banker-hero"><div><span className="eyebrow">BANKER TABLE</span><h1>Run the table.</h1><p>One device for the banker. Log each physical card, switch player tables, and keep the round moving.</p></div><div className="banker-setup-art" aria-hidden="true"><img className="setup-card-back" src="/cards/Back.webp" alt="" /><img className="setup-card-seven" src="/cards/7.webp" alt="" /></div></section>
    <section className="banker-setup-card">
      <label className="banker-room-title"><span>MATCH NAME</span><input value={title} maxLength={32} onChange={(event) => setTitle(event.target.value)} placeholder="e.g. Friday game night" aria-label="Match name" /></label>
      <div className="banker-section-heading"><div><span className="eyebrow">SET UP PLAYERS</span><h2>Who is at the table?</h2></div><span className="banker-count">{names.length}/18</span></div>
      <p className="banker-muted">Set the order used for player switching and dealer rotation. You can change the order during the game.</p>
      <div className="banker-name-list">{names.map((name, index) => <div className="banker-name-row" key={`draft-${index}`}><span className="banker-seat-number">{String(index + 1).padStart(2, '0')}</span><input value={name} placeholder={`Player ${index + 1}`} maxLength={24} aria-label={`Player ${index + 1} name`} onChange={(event) => updateName(index, event.target.value)} /><div className="banker-order-actions"><button type="button" className="banker-order-button" aria-label={`Move ${name || `player ${index + 1}`} up`} title="Move up" disabled={index === 0} onClick={() => moveName(index, -1)}><ArrowUp size={15} /></button><button type="button" className="banker-order-button" aria-label={`Move ${name || `player ${index + 1}`} down`} title="Move down" disabled={index === names.length - 1} onClick={() => moveName(index, 1)}><ArrowDown size={15} /></button></div>{names.length > 1 && <button type="button" className="banker-remove-player" aria-label={`Remove ${name || `player ${index + 1}`}`} onClick={() => setNames((current) => current.filter((_, valueIndex) => valueIndex !== index))}><X size={16} /></button>}</div>)}</div>
      {savedPlayers.length > 0 && <div className="banker-saved-players"><span>QUICK ADD</span><div>{savedPlayers.map((player) => <button type="button" key={player.id} onClick={() => addSavedPlayer(player)} disabled={names.length >= 18 && names.every(Boolean)}>{player.name}</button>)}</div></div>}
      <div className="banker-setup-actions"><button type="button" className="banker-add-player" disabled={names.length >= 18} onClick={() => setNames((current) => [...current, ''])}><UserPlus size={16} /> Add player</button><label className="banker-target-control"><span>FIRST TO</span><div className="banker-target-value"><input type="number" min="50" max="500" value={targetScore} aria-label="First to target score" onChange={(event) => setTargetScore(event.target.value === '' ? '' : Number(event.target.value))} /><b>PTS</b></div></label></div>
      {warning && <p className="banker-warning" role="alert">{warning}</p>}
      <button type="button" className="primary-wide banker-start-button" disabled={!canStart} onClick={start}><Play size={17} /> Start match</button>
      <button type="button" className="secondary-wide banker-save-draft" onClick={() => onSaveDraft(title, typeof targetScore === 'number' ? targetScore : initialTargetScore, names)}>Save draft & return home</button>
    </section>
  </div>
}

function BankerResults({ players, history, targetScore, onNewGame, onExit }: { players: BankerPlayer[]; history: BankerRoundResult[]; targetScore: number; onNewGame: () => void; onExit: () => void }) {
  const ordered = [...players].sort((a, b) => b.totalScore - a.totalScore)
  const winnerScore = ordered[0]?.totalScore ?? 0
  return <div className="banker-results"><section className="results-hero"><span className="eyebrow">BANKER TABLE COMPLETE</span><h1>Round the table.</h1><p>{ordered.filter((player) => player.totalScore === winnerScore).map((player) => player.name).join(' and ')} finished first to {targetScore}.</p></section><section className="results-card"><div className="results-heading"><div><span className="eyebrow">FINAL SCORES</span><h2>Game results</h2></div><ClipboardList size={24} /></div><div className="results-list">{ordered.map((player, index) => <article className={`results-player ${index === 0 ? 'winner' : ''}`} key={player.id}><span className="results-rank">{index + 1}</span><span className="mini-avatar" style={{ background: player.color }}>{player.name[0]}</span><div className="results-player-copy"><div className="results-player-name"><b>{player.name}</b><small>{player.totalScore} {pointLabel(player.totalScore)} total</small></div><div className="results-rounds">{history.map((round) => <span className="round-score" key={`${player.id}-${round.round}`}>R{round.round}: {round.scores[player.id] ?? 0}</span>)}</div></div><div className="results-total"><small>Total pts</small><strong>{player.totalScore}</strong></div></article>)}</div></section><section className="results-actions"><p>This match is saved on this device and is now available in History.</p><div className="banker-results-actions"><button className="secondary-action" onClick={onNewGame}><RotateCcw size={16} /> New match</button><button className="primary-wide" onClick={onExit}><ArrowLeft size={16} /> Home</button></div></section></div>
}

export function BankerScreen() {
  const navigate = useAppNavigation()
  const requestedMatchId = new URLSearchParams(window.location.search).get('matchId')
  const [state, dispatch] = useReducer(bankerReducer, undefined, bankerInitialState)
  const [activeMatch, setActiveMatch] = useState<SavedMatch | null>(null)
  const [ready, setReady] = useState(false)
  const [loadError, setLoadError] = useState('')
  const [savedPlayers, setSavedPlayers] = useState<SavedPlayer[]>([])
  const createMatchPromise = useRef<Promise<SavedMatch> | null>(null)
  const [startDraft, setStartDraft] = useState<{ targetScore: number; names: string[] } | null>(null)
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

  useEffect(() => {
    let disposed = false
    setReady(false)
    const loadMatch = async () => {
      try {
        if (!requestedMatchId) {
          if (!createMatchPromise.current) {
            const match = newSavedMatch()
            createMatchPromise.current = saveMatch(match).then(() => match)
          }
          const match = await createMatchPromise.current
          if (disposed) return
          setActiveMatch(match)
          setLoadError('')
          setReady(true)
          navigate(`/banker?matchId=${encodeURIComponent(match.id)}`, { replace: true })
          return
        }
        const match = await getSavedMatch(requestedMatchId)
        if (disposed) return
        if (!match) {
          setLoadError('This saved match could not be found on this device.')
          setReady(true)
          navigate('/landing', { replace: true })
          return
        }
        setActiveMatch(match)
        if (match.state) dispatch({ type: 'restore', state: compactSavedState(match.state) })
        else dispatch({ type: 'reset' })
        setLoadError('')
        setReady(true)
      } catch (cause) {
        if (!disposed) {
          setLoadError(cause instanceof Error ? cause.message : 'Could not open this saved match.')
          setReady(true)
        }
      }
    }
    void loadMatch()
    return () => { disposed = true }
  }, [requestedMatchId, navigate])

  useEffect(() => {
    void listSavedPlayers().then(setSavedPlayers).catch(() => setSavedPlayers([]))
  }, [])

  const persistSetup = useCallback((title: string, targetScore: number, names: string[]) => {
    if (!activeMatch) return
    const updates = { title: title.trim() || 'Untitled match', targetScore, playerNames: [...names] }
    setActiveMatch((match) => match ? { ...match, ...updates, updatedAt: Date.now() } : match)
    void updateMatch(activeMatch.id, updates).catch((cause) => setLoadError(cause instanceof Error ? cause.message : 'Could not save this draft.'))
  }, [activeMatch?.id])

  useEffect(() => {
    if (!ready || !activeMatch || state.phase === 'setup') return
    const completedAt = state.phase === 'results' ? activeMatch.completedAt ?? Date.now() : undefined
    const updates = {
      status: state.phase === 'results' ? 'completed' as const : 'in-progress' as const,
      targetScore: state.targetScore,
      playerNames: state.players.map((player) => player.name),
      state: compactSavedState(state),
      ...(completedAt ? { completedAt } : {}),
    }
    setActiveMatch((match) => match ? { ...match, ...updates, updatedAt: Date.now() } : match)
    void updateMatch(activeMatch.id, updates).catch((cause) => setLoadError(cause instanceof Error ? cause.message : 'Could not save match progress.'))
  }, [state, ready, activeMatch?.id])
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

  const exit = useCallback(() => navigate('/landing', { replace: true }), [navigate])
  const createAnotherMatch = async () => {
    const match = newSavedMatch()
    try {
      await saveMatch(match)
      navigate(`/banker?matchId=${encodeURIComponent(match.id)}`, { replace: true })
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Could not create a new match.')
    }
  }
  const saveDraftAndExit = async (title: string, targetScore: number, names: string[]) => {
    if (!activeMatch) return
    const updates = { title: title.trim() || 'Untitled match', targetScore, playerNames: [...names], status: 'draft' as const, state: null }
    try {
      await updateMatch(activeMatch.id, updates)
      setActiveMatch((match) => match ? { ...match, ...updates, updatedAt: Date.now() } : match)
      navigate('/landing')
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Could not save this draft.')
    }
  }
  const confirmStart = async () => {
    if (!startDraft || !activeMatch) return
    const draft = startDraft
    const started = bankerReducer(bankerInitialState(), { type: 'start', targetScore: draft.targetScore, names: draft.names })
    const saved: SavedMatch = {
      ...activeMatch,
      title: activeMatch.title.trim() || 'Untitled match',
      status: 'in-progress',
      targetScore: draft.targetScore,
      playerNames: draft.names,
      state: compactSavedState(started),
      completedAt: undefined,
      updatedAt: Date.now(),
    }
    try {
      await saveMatch(saved)
      setActiveMatch(saved)
      setStartDraft(null)
      dispatch({ type: 'start', targetScore: draft.targetScore, names: draft.names })
    } catch (cause) {
      setLoadError(cause instanceof Error ? cause.message : 'Could not start and save this match.')
    }
  }

  useEffect(() => {
    if (state.phase === 'round' && allSettled) setRoundSummaryOpen(true)
    if (!allSettled) setRoundSummaryOpen(false)
  }, [allSettled, state.phase])

  useEffect(() => {
    if (state.phase !== 'round' || !turnPlayerId) return
    playerTabRefs.current[turnPlayerId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [state.phase, turnPlayerId])

  if (!ready || (!activeMatch && Boolean(loadError))) return <div className="app-shell banker-shell"><main className="game-shell"><header className="topbar banker-topbar"><img className="brand-logo" src="/assets/flip7-title-logo.png" alt="Flip 7" /></header><div className="banker-loading-state"><span>{loadError || 'Opening your saved match…'}</span>{loadError && <button className="primary-wide" onClick={exit}>Return home</button>}</div></main></div>

  if (state.phase === 'setup') return <div className="app-shell banker-shell banker-setup-app"><aside className="desktop-marquee left"><div>FLIP<br />7</div></aside><main className="game-shell banker-setup-shell"><header className="banker-setup-header"><button className="banker-setup-brand" aria-label="Return home" onClick={exit}><img src="/assets/flip7-title-logo.png" alt="Flip 7 Companion" /></button><span>NEW MATCH</span><button className="banker-setup-home" onClick={exit}><LogOut size={15} /> Home</button></header>{loadError && <p className="banker-warning" role="alert">{loadError}</p>}<BankerSetup initialNames={activeMatch?.playerNames ?? defaultNames} initialTargetScore={activeMatch?.targetScore ?? 200} initialTitle={activeMatch?.title ?? 'New match'} savedPlayers={savedPlayers} onChange={persistSetup} onStart={(targetScore, names) => setStartDraft({ targetScore, names })} onSaveDraft={(title, targetScore, names) => void saveDraftAndExit(title, targetScore, names)} /><AppBottomNav active="/banker" /></main><aside className="desktop-marquee right"><div>PRESS<br />YOUR<br />LUCK</div></aside>{startDraft && <ConfirmationModal eyebrow="START MATCH" title="Start this table?" message={`Start ${activeMatch?.title || 'this match'} for ${startDraft.names.length} players, targeting ${startDraft.targetScore} points? Player names are locked once play begins.`} cancelLabel="Review setup" confirmLabel="Start match" onCancel={() => setStartDraft(null)} onConfirm={() => void confirmStart()} />}</div>

  if (state.phase === 'results') return <div className="app-shell banker-shell"><aside className="desktop-marquee left"><div>FLIP<br />7</div></aside><main className="game-shell"><header className="topbar banker-topbar"><button className="brand-button" aria-label="Return home" onClick={exit}><img className="brand-logo" src="/assets/flip7-title-logo.png" alt="Flip 7" /></button><span className="topbar-caption">{activeMatch?.title ?? 'MATCH COMPLETE'}</span></header><BankerResults players={state.players} history={state.history} targetScore={state.targetScore} onNewGame={() => setNewGamePromptOpen(true)} onExit={exit} />{newGamePromptOpen && <ConfirmationModal eyebrow="NEW MATCH" title="Create another match?" message="Your completed match will stay in History. A fresh editable draft will be created." cancelLabel="Keep results" confirmLabel="New match" onCancel={() => setNewGamePromptOpen(false)} onConfirm={() => { setNewGamePromptOpen(false); void createAnotherMatch() }} />}</main><aside className="desktop-marquee right"><div>PRESS<br />YOUR<br />LUCK</div></aside></div>

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
  return <div className="app-shell banker-shell"><aside className="desktop-marquee left"><div>FLIP<br />7</div></aside><main className="game-shell">
    <header className="topbar banker-topbar"><button className="brand-button" aria-label="Return home" onClick={exit}><img className="brand-logo" src="/assets/flip7-title-logo.png" alt="Flip 7" /></button><span className="topbar-caption">{activeMatch?.title ?? 'BANKER MODE · LOCAL ONLY'}</span><button className="account-pill exit-button" aria-label="Open banker menu" onClick={() => setShowMenu((open) => !open)}><Menu size={16} /> Menu</button>{showMenu && <div className="banker-menu"><div className="banker-menu-title">BANKER MODE</div><div className="banker-menu-divider" /><button onClick={() => { setShowMenu(false); setPlayersOpen(true) }}><Users size={16} /> Players</button><button onClick={() => { setShowMenu(false); setRulesOpen(true) }}><CircleHelp size={16} /> Rules</button><button onClick={exit}><LogOut size={16} /> Exit</button></div>}</header>
    {loadError && <p className="banker-warning" role="alert">{loadError}</p>}
    <section className="match-strip"><div><span>ROUND</span><b>{String(state.roundNumber).padStart(2, '0')}</b></div><div className="target"><span>FIRST TO</span><b>{state.targetScore}</b></div><div><span>VIEWING</span><b>{selectedPlayer?.name || '—'}</b></div></section>
    <div className="banker-turn-callout" role="status"><span>CURRENT TURN</span><b>{turnPlayer?.name || '—'}</b></div>
    <section className="banker-player-strip" aria-label="Player tables">{state.players.map((player) => <button key={player.id} ref={(element) => { playerTabRefs.current[player.id] = element }} className={`banker-player-tab opponent ${player.id === selectedPlayer?.id ? 'selected' : ''} ${player.id === turnPlayerId ? 'turn' : ''} ${statusClass(player)}`} aria-current={player.id === turnPlayerId ? 'step' : undefined} onClick={() => { dispatch({ type: 'select-player', playerId: player.id }); setOrganized(false); setSelectedCardIndex(null) }}><span className="mini-avatar" style={{ background: player.color }}><span className="banker-avatar-initial">{player.name[0]}</span></span><span className="opponent-copy"><b>{player.name}</b><span>{playerTabSummary(player)}</span></span><strong><small>Total pts:</small> <b>{player.totalScore}</b></strong></button>)}</section>
    <GameTable table={table} tableCardIds={cardIds} isVoidedCard={(index) => Boolean(selectedPlayer?.round.entries[index]?.voided)} score={derived?.score ?? 0} flipSevenBonus={derived?.flipSevenBonus ?? 0} busted={selectedPlayer?.round.status === 'busted'} frozen={selectedPlayer?.round.status === 'frozen'} submitting={false} interactionLocked={interactionLocked} canEditCards={canEdit} canAddCards={canRecordCards} confirmedAt={terminal ? 'banker' : null} isStaying={selectedPlayer?.round.status === 'stayed'} isOrganized={organized} playerName={selectedPlayer?.name ?? 'Player'} isHost={false} onOrganize={organize} onOpenPicker={() => { if (!interactionLocked && canRecordCards) openPicker() }} onSelectCard={(index) => { if (!interactionLocked) setSelectedCardIndex(index) }} />
    <GameControls isHost allPlayersSettled={allSettled} submitting={false} canEditCards={canEdit} canSettle={canSettle} canUseHistory={state.phase === 'round'} hasCardsOrRemoval={state.past.length > 0} hasRedo={state.future.length > 0} isStaying={selectedPlayer?.round.status === 'stayed'} busted={selectedPlayer?.round.status === 'busted'} frozen={selectedPlayer?.round.status === 'frozen'} numberCardCount={derived?.numberCardCount ?? 0} playerStatus={playerStatus} confirmedAt={terminal ? 'banker' : null} onNextRound={newRound} onUndo={() => dispatch({ type: 'undo' })} onStay={() => selectedPlayer && dispatch({ type: 'settle-player', playerId: selectedPlayer.id })} onRedo={() => dispatch({ type: 'redo' })} />
  </main><aside className="desktop-marquee right"><div>PRESS<br />YOUR<br />LUCK</div></aside>
    <AnimatePresence onExitComplete={() => { setCardDialogClosing(false) }}>
      {selectedCardIndex !== null && selectedPlayer?.round.entries[selectedCardIndex] && <motion.div key="card-actions" className="picker-backdrop card-focus-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={() => { setCardDialogClosing(true); setSelectedCardIndex(null) }}><CardActionsPanel card={selectedPlayer.round.entries[selectedCardIndex].card} cardVoided={selectedPlayer.round.entries[selectedCardIndex].voided} submitting={false} onClose={() => { setCardDialogClosing(true); setSelectedCardIndex(null) }} onEdit={() => { const index = selectedCardIndex; setSelectedCardIndex(null); openPicker(index) }} onRemove={() => { dispatch({ type: 'player', playerId: selectedPlayer.id, action: { type: 'remove', index: selectedCardIndex } }); setSelectedCardIndex(null); setOrganized(false) }} /></motion.div>}
      {pickerOpen && <motion.div key={`card-picker-${pickerSessionRef.current}`} className="picker-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={closePicker}><CardPickerPanel submitting={false} onClose={closePicker} onSelect={selectCard} /></motion.div>}
      {pendingAction && <motion.div key="action-target" className="picker-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={closePendingAction}><motion.section className="card-picker" initial={{ y: 12, opacity: 0 }} animate={{ y: 0, opacity: 1 }} exit={{ y: 12, opacity: 0 }} transition={{ duration: .14, ease: 'easeOut' }} onClick={(event) => event.stopPropagation()}><div className="picker-heading"><div><span>ACTION TARGET</span><h2>Who gets {pendingAction.label}?</h2></div><button className="close-button" aria-label="Close action target" title="Close" onClick={closePendingAction}><X size={19} /></button></div><p>Only active tables can receive action cards. Freeze skips its target, while Flip Three temporarily routes the next cards there.</p><div className="target-list banker-target-list">{state.players.filter((player) => player.round.status === 'active').map((player) => <button key={player.id} onClick={() => chooseActionTarget(player.id)}>{player.name}{player.id === pendingActionSourceId ? ' (current)' : ''}</button>)}{state.players.every((player) => player.round.status !== 'active') && <p className="banker-muted">There are no active player tables available.</p>}</div></motion.section></motion.div>}
      {playersOpen && <motion.div key="players" className="picker-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={() => setPlayersOpen(false)}><motion.section className="card-picker info-panel" initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }} onClick={(event) => event.stopPropagation()}><div className="picker-heading"><div><span>AT THIS TABLE</span><h2>Players</h2></div><div className="panel-heading-actions"><b className="panel-count">{state.players.length} players</b><button className="close-button" aria-label="Close players" title="Close" onClick={() => setPlayersOpen(false)}><X size={19} /></button></div></div><div className="info-list">{state.players.map((player) => { const playerScore = bankerPlayerDerived(player).score; return <div className={`info-player ${player.id === selectedPlayer?.id ? 'current-player' : ''}`} key={player.id}><span className="mini-avatar" style={{ background: player.color }}>{player.name[0]}</span><div><b>{player.name}{player.id === selectedPlayer?.id ? ' (current)' : ''}</b><small>{playerTabSummary(player)}</small></div><strong>{playerScore}</strong></div> })}</div></motion.section></motion.div>}
      {roundSummaryOpen && <motion.div key="round-summary" className="picker-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }}><motion.section className="card-picker banker-summary" initial={{ y: 50, opacity: 0 }} animate={{ y: 0, opacity: 1 }} onClick={(event) => event.stopPropagation()}><div className="picker-heading"><div><span>ROUND {String(state.roundNumber).padStart(2, '0')} COMPLETE</span><h2>Everyone is settled.</h2></div><button className="close-button" aria-label="Close round summary" onClick={() => setRoundSummaryOpen(false)}><X size={19} /></button></div><div className="banker-round-summary-list">{state.players.map((player) => <div className={`banker-summary-player ${statusClass(player)}`} key={player.id}><span className="mini-avatar" style={{ background: player.color }}>{player.name[0]}</span><div className="banker-summary-player-copy"><b>{player.name}</b><span className={`banker-status-pill ${statusClass(player)}`}>{statusLabel(player)}</span></div><div className="banker-summary-score"><small>ROUND</small><strong>{bankerPlayerDerived(player).score}</strong></div></div>)}</div><p>Confirm the local scores, then start the next round with the player who resolved this round most recently.</p><div className="banker-results-actions"><button className="secondary-action" onClick={resetForNewGame}><RotateCcw size={16} /> New game</button><button className="primary-wide" onClick={newRound}><Play size={16} /> Next round</button></div></motion.section></motion.div>}
      {newGamePromptOpen && <ConfirmationModal eyebrow="NEW MATCH" title="Create another match?" message="This match will remain saved on Home so you can resume it later. A fresh editable draft will be created." cancelLabel="Keep playing" confirmLabel="New match" onCancel={() => setNewGamePromptOpen(false)} onConfirm={() => { setNewGamePromptOpen(false); setRoundSummaryOpen(false); void createAnotherMatch() }} />}
      {rulesOpen && <motion.div key="rules" className="picker-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={() => setRulesOpen(false)}><motion.section className="card-picker info-panel" initial={{ y: 50 }} animate={{ y: 0 }} onClick={(event) => event.stopPropagation()}><div className="picker-heading"><div><span>BANKER MODE</span><h2>How it works</h2></div><button className="close-button" aria-label="Close rules" onClick={() => setRulesOpen(false)}><X size={19} /></button></div><div className="rules-copy"><section><h3>Follow the highlighted table</h3><p>After each card, Banker Mode advances to the next active table. You can still open any table to correct, remove, undo, redo, or organize cards.</p></section><section><h3>Action cards</h3><p>Choose an active target. Freeze skips that table, Second Chance stays on its target, and Flip Three routes the next three cards there one at a time before returning to the original order.</p></section><section><h3>Settle the round</h3><p>Bank, bust, and frozen tables are skipped. Seven unique numbered cards end the round immediately and bank every other active table.</p></section></div></motion.section></motion.div>}
    </AnimatePresence>
  </div>
}
