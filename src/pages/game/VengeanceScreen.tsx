import { useCallback, useEffect, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { ArrowLeft, Cast, Check, CircleHelp, Eye, Redo2, RotateCcw, Undo2, X } from 'lucide-react'
import { useAppNavigation, useNavigationGuard } from '../../lib/navigation'
import { getLibrary, saveVengeanceState, updateLibrary, type PlayerProfile } from '../../lib/room-store'
import { vengeanceCards, type VengeanceCard } from '../../game/vengeanceCards'
import { vengeanceEligibleActors, vengeanceEligibleCards, vengeanceInitialState, vengeanceReducer, vengeanceScore, type VAction, type VPlayer, type VState } from '../../game/vengeanceGame'
import { TvShareDialog } from '../mobile/TvShareDialog'
import { tvSharingAvailable } from '../../lib/tv-share'
import { PlayerAvatar } from '../../components/PlayerAvatar'
import { cardThumbnailUrl } from '../../game/cardThumbnailUrl'
import './VengeanceScreen.css'

const demoColors = ['#e93234', '#193c89', '#da8736', '#257878', '#802e80']

function VCardFace({ card, small = false }: { card: VengeanceCard; small?: boolean }) {
  const [artReady, setArtReady] = useState(false)
  return <span className={`v-card-face ${card.kind} ${small ? 'small' : ''}`}>
    <span className="v-card-type">{card.id.includes('unlucky') || card.id.includes('lucky') || card.id.includes('zero') ? 'SPECIAL NUMBER' : card.kind.toUpperCase()}</span>
    <strong>{card.label}</strong>
    {card.image && <img src={small ? cardThumbnailUrl(card.image) : card.image} alt="" aria-hidden="true" onLoad={() => setArtReady(true)} onError={() => setArtReady(false)} style={{ display: artReady ? 'block' : 'none' }} />}
  </span>
}

function DemoSetup({ onStart, onExit }: { onStart: (players: PlayerProfile[]) => void; onExit: () => void }) {
  const [names, setNames] = useState(['Player 1', 'Player 2', 'Player 3'])
  const [name, setName] = useState('')
  return <div className="v-app"><main className="v-shell"><button className="v-back" onClick={onExit}><ArrowLeft size={17} /> Back to Vengeance</button><img className="v-logo" src="/assets/flip7-vengeance-logo.webp" alt="Flip 7 With a Vengeance" /><h1>Practice table</h1><p>Set up temporary hands. You can enter physical cards or try example reveals; the app never draws from a deck.</p><div className="v-demo-names">{names.map((item, index) => <label key={index}>Player {index + 1}<input aria-label={`Player ${index + 1} name`} value={item} maxLength={24} onChange={event => setNames(current => current.map((entry, i) => i === index ? event.target.value : entry))} /></label>)}</div><div className="v-demo-add"><input aria-label="Additional player name" value={name} maxLength={24} placeholder="Another player" onChange={event => setName(event.target.value)} /><button disabled={!name.trim() || names.length >= 18} onClick={() => { setNames([...names, name.trim()]); setName('') }}>Add</button></div><button className="v-primary" disabled={names.length < 2 || names.some(item => !item.trim())} onClick={() => onStart(names.map((item, index) => ({ id: `demo-${index}`, name: item.trim(), color: demoColors[index % demoColors.length] })))}>Start practice</button><small>Practice resets when you leave. It does not affect saved players or stats.</small></main></div>
}

function scoreLabel(player: VPlayer) { return player.status === 'busted' ? 'BUSTED · 0' : `${player.status === 'stayed' ? 'STAYED · SCORE PENDING' : player.status === 'flip-seven' ? 'FLIP 7' : 'ACTIVE'} · ${vengeanceScore(player)} PTS` }

export function VengeanceScreen({ roomId, demo = false }: { roomId?: string; demo?: boolean }) {
  const navigate = useAppNavigation()
  useEffect(() => {
    if (getLibrary().settings.edition !== 'vengeance') {
      try { updateLibrary(current => ({ ...current, settings: { ...current.settings, edition: 'vengeance' } })) }
      catch { /* The table still works; the save error appears when recording. */ }
    }
  }, [])
  const room = roomId ? getLibrary().rooms.find(item => item.id === roomId && item.edition === 'vengeance') : undefined
  const [state, setState] = useState<VState | null>(() => room?.vengeanceState ?? null)
  const stateRef = useRef<VState | null>(state)
  const pendingSaveRef = useRef<VState | null>(null)
  const [saveError, setSaveError] = useState('')
  const [pickerOpen, setPickerOpen] = useState(false)
  const [tvOpen, setTvOpen] = useState(false)
  const [shareNotice, setShareNotice] = useState('')
  const exit = () => navigate(roomId ? `/room?id=${roomId}` : '/landing', { replace: true })
  useNavigationGuard(demo && state || saveError ? { title: demo ? 'Leave practice table?' : 'Leave with an unsaved action?', message: demo ? 'Temporary hands and scores will be cleared.' : 'Retry saving the last action before leaving if you want to keep it.', shouldBlock: () => true, confirmLabel: 'Leave table' } : null)
  const persist = useCallback((next: VState) => {
    if (demo) { stateRef.current = next; setState(next); return }
    if (!roomId) return
    try { saveVengeanceState(roomId, next); stateRef.current = next; pendingSaveRef.current = null; setState(next); setSaveError('') }
    catch (error) { pendingSaveRef.current = next; setSaveError(`${(error as Error).message} Retry before continuing.`) }
  }, [demo, roomId])
  const dispatch = (action: VAction) => {
    if (!stateRef.current || pendingSaveRef.current) return
    const next = vengeanceReducer(stateRef.current, action)
    if (next !== stateRef.current) persist(next)
  }
  if (!state) return demo ? <DemoSetup onExit={exit} onStart={players => { const next = vengeanceInitialState(players); stateRef.current = next; setState(next) }} /> : <div className="v-app"><main className="v-shell"><h1>Room unavailable</h1><button onClick={exit}>Back to rooms</button></main></div>

  const selected = state.players.find(player => player.id === state.selectedPlayerId) ?? state.players[0]
  const drawing = state.players.find(player => player.id === (state.forced[0]?.targetId ?? state.turnPlayerId))
  const dealer = state.players.find(player => player.id === state.dealerId)
  const pending = state.pending
  const eligibleActors = vengeanceEligibleActors(state)
  const eligibleCards = vengeanceEligibleCards(state)
  const needsCards = pending?.card.id === 'v-action-steal' || pending?.card.id === 'v-action-swap' || pending?.card.id === 'v-action-discard'
  const selectedCount = pending?.card.id === 'v-action-swap' ? 2 : 1
  const ready = pending && (pending.card.kind === 'modifier' ? !!pending.targetId : !!pending.actorId && (!needsCards || pending.selectedCards.length === selectedCount))
  const canRecord = (state.phase === 'deal' || state.phase === 'turn') && !pending && !!drawing && !saveError
  const share = async () => {
    const sorted = [...state.players].sort((a, b) => b.totalScore - a.totalScore)
    const message = `Flip 7: With a Vengeance · ${room?.name ?? 'Practice'}\n${sorted.map((player, index) => `${index + 1}. ${player.name} — ${player.totalScore} pts`).join('\n')}`
    try { if (navigator.share) await navigator.share({ title: 'Vengeance results', text: message }); else { await navigator.clipboard.writeText(message); setShareNotice('Results copied to clipboard.') } }
    catch (error) { if ((error as Error).name !== 'AbortError') setShareNotice('Sharing is unavailable on this device.') }
  }
  return <div className="v-app"><main className="v-shell">
    <header className="v-top"><button className="v-back" onClick={exit}><ArrowLeft size={17} /> {demo ? 'Exit practice' : 'Room'}</button><img src="/assets/flip7-vengeance-logo.webp" alt="Flip 7 With a Vengeance" />{roomId && tvSharingAvailable() && <button className="v-icon" aria-label="Show TV scoreboard" onClick={() => setTvOpen(true)}><Cast size={21} /></button>}</header>
    <div className="v-meta"><span>ROUND <b>{state.roundNumber}</b></span><span>FIRST TO <b>{state.targetScore}</b></span><span>DEALER <b>{dealer?.name}</b></span></div>
    {saveError && <div className="v-save-error" role="alert">{saveError}<button onClick={() => pendingSaveRef.current && persist(pendingSaveRef.current)}>Retry save</button></div>}
    {state.phase === 'results' ? <section className="v-results"><h1>Match complete!</h1><p>{state.players.filter(player => state.winnerIds.includes(player.id)).map(player => player.name).join(' and ')} won.</p>{[...state.players].sort((a, b) => b.totalScore - a.totalScore).map(player => <div key={player.id}><strong>{player.name}</strong><b>{player.totalScore}</b></div>)}<button className="v-primary" onClick={() => void share()}>Share results</button>{shareNotice && <p role="status">{shareNotice}</p>}<button className="v-secondary" onClick={exit}>View room</button></section> : <>
      <section className="v-turn" role="status"><span>{state.phase === 'settlement' ? 'ROUND COMPLETE' : state.phase === 'deal' ? 'INITIAL DEAL · REVEAL A PHYSICAL CARD' : state.forced.length ? `${state.forced[0].kind === 'four' ? 'FLIP FOUR' : 'JUST ONE MORE'} · ${state.forced[0].remaining} LEFT` : 'CURRENT TURN'}</span><strong>{state.phase === 'settlement' ? 'Review scores' : drawing?.name ?? '—'}</strong><small>{state.phase === 'turn' && !state.forced.length ? 'Choose Hit or Stay at the physical table.' : 'Enter each card revealed from the real deck.'}</small><img className="v-deck-back" src="/cards/vengeance/back.webp" alt="" aria-hidden="true" /></section>
      <section className="v-overview" aria-label="All player hands"><h2>Table overview</h2><div className="v-player-grid">{state.players.map(player => <button className={`v-player-tile ${selected.id === player.id ? 'selected' : ''} ${drawing?.id === player.id ? 'drawing' : ''} ${player.status}`} key={player.id} onClick={() => dispatch({ type: 'select-player', playerId: player.id })}><PlayerAvatar player={player} className="v-avatar" /><span><strong>{player.name}</strong><small>{scoreLabel(player)}</small><small>{player.entries.length} cards · {player.totalScore} total</small></span><span className="v-mini-hand">{player.entries.map(entry => <motion.i layoutId={`overview-${entry.instanceId}`} key={entry.instanceId} title={entry.card.label}><span>{entry.card.label}</span><img src={cardThumbnailUrl(entry.card.image ?? '')} alt="" aria-hidden="true" onError={event => { event.currentTarget.style.display = 'none' }} /></motion.i>)}</span></button>)}</div></section>
      <section className="v-hand"><div className="v-hand-heading"><div><span>SELECTED HAND</span><h2>{selected.name}</h2></div><strong>{vengeanceScore(selected)} <small>ROUND PTS</small></strong></div><p>{selected.status === 'stayed' ? 'Stayed · score is provisional until the round ends.' : selected.status === 'busted' ? 'Busted · these physical cards are out of play.' : selected.status === 'flip-seven' ? 'Flip 7 ends the round.' : 'Cards currently face up in this line.'}</p><div className={`v-hand-cards ${selected.status === 'busted' ? 'busted' : ''}`}>{selected.entries.map(entry => <motion.div layout key={entry.instanceId}><VCardFace card={entry.card} /></motion.div>)}{selected.entries.length === 0 && <span className="v-no-cards">No face-up cards yet</span>}</div></section>
      {state.phase === 'settlement' ? <section className="v-settlement"><h2>Confirm round scores</h2>{state.players.map(player => <div key={player.id}><span>{player.name}</span><strong>{vengeanceScore(player)}</strong></div>)}<button className="v-primary" disabled={!!saveError} onClick={() => dispatch({ type: 'advance-round' })}><Check size={17} /> Confirm scores</button></section> : pending ? <section className="v-action" aria-label="Resolve revealed card"><span>ACTION TO RESOLVE</span><h2>{pending.card.label}</h2><p>{pending.card.kind === 'modifier' ? 'Choose a player who has not busted, including someone who stayed.' : !pending.actorId ? 'Choose who receives and performs this action. Stayed players are eligible.' : needsCards ? `Tap ${selectedCount === 2 ? 'two cards from different hands' : 'one eligible face-up card'} on the table below.` : `Confirm ${state.players.find(player => player.id === pending.actorId)?.name} as the target.`}</p>{!pending.actorId && pending.card.kind !== 'modifier' || pending.card.kind === 'modifier' && !pending.targetId ? <div className="v-choice-grid">{eligibleActors.map(player => <button key={player.id} onClick={() => dispatch({ type: pending.card.kind === 'modifier' ? 'choose-target' : 'choose-actor', playerId: player.id })}>{player.name}{player.status === 'stayed' ? ' · stayed' : ''}</button>)}</div> : null}{needsCards && pending.actorId && <div className="v-target-hands">{state.players.filter(player => player.status !== 'busted' && player.entries.length).map(player => <div key={player.id}><h3>{player.name}</h3><div>{player.entries.map(entry => <button key={entry.instanceId} className={pending.selectedCards.includes(entry.instanceId) ? 'chosen' : ''} disabled={!eligibleCards.some(face => face.entry.instanceId === entry.instanceId)} onClick={() => dispatch({ type: 'choose-card', instanceId: entry.instanceId })}><VCardFace card={entry.card} small /></button>)}</div></div>)}</div>}{ready && <div className="v-preview"><p><Eye size={16} /> Preview: {pending.card.label} {pending.card.kind === 'modifier' ? `to ${state.players.find(player => player.id === pending.targetId)?.name}` : `played by ${state.players.find(player => player.id === pending.actorId)?.name}`}. {pending.selectedCards.map(id => state.players.flatMap(player => player.entries).find(entry => entry.instanceId === id)?.card.label).join(' ↔ ')}</p><button className="v-primary" onClick={() => dispatch({ type: 'confirm' })}>Confirm physical move</button></div>}</section> : <div className="v-controls"><button className="v-primary" disabled={!canRecord} onClick={() => setPickerOpen(true)}>Record a physical card</button>{state.phase === 'turn' && !state.forced.length && <button className="v-secondary" disabled={!canRecord || !!drawing?.entries.some(entry => entry.card.id === 'v-number-zero')} onClick={() => dispatch({ type: 'stay' })}>Stay</button>}</div>}
      <div className="v-tools"><button disabled={!state.past.length || !!saveError} onClick={() => dispatch({ type: 'undo' })}><Undo2 size={16} /> Undo</button><button disabled={!state.future.length || !!saveError} onClick={() => dispatch({ type: 'redo' })}><Redo2 size={16} /> Redo</button><button onClick={() => navigate('/rules')}><CircleHelp size={16} /> Rules</button></div>
      <section className="v-events"><h2>Round actions</h2>{state.events.length ? <ol>{state.events.slice(-8).reverse().map((event, index) => <li key={`${index}-${event}`}>{event}</li>)}</ol> : <p>Physical reveals and card moves will appear here.</p>}</section>
    </>}
  </main><AnimatePresence>{pickerOpen && <motion.div className="v-picker-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}><section className="v-picker" role="dialog" aria-modal="true" aria-label="Record a physical card"><header><div><span>PHYSICAL DECK</span><h2>What did you reveal?</h2></div><button aria-label="Close card picker" onClick={() => setPickerOpen(false)}><X size={20} /></button></header><p>The app records the real card. It does not draw one.</p><div className="v-picker-grid">{vengeanceCards.map(card => <button key={card.id} onClick={() => { dispatch({ type: 'record', cardId: card.id }); setPickerOpen(false) }}><VCardFace card={card} small /></button>)}</div></section></motion.div>}</AnimatePresence>{tvOpen && roomId && <TvShareDialog roomId={roomId} onClose={() => setTvOpen(false)} />}</div>
}
