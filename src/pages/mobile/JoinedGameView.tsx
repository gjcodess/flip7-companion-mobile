import { useEffect, useRef, useState, type ReactNode } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { Cast, Check, ChevronRight, Clock3, History, LogOut, Menu, RefreshCw, ShieldCheck, Trash2, Trophy, UserRound, Users, Wifi, WifiOff, X } from 'lucide-react'
import { bankerEligibleActionTargets, bankerPlayerDerived } from '../../game/bankerGame'
import { pickerCards, type Card } from '../../game/cards'
import { bankerTableEntries, vengeanceTableEntries } from '../../game/tableEntries'
import { vengeanceCards } from '../../game/vengeanceCards'
import { vengeanceEligibleActors, vengeanceEligibleCards, vengeancePending, vengeanceScore } from '../../game/vengeanceGame'
import { CardArtwork } from '../../components/CardArtwork'
import { PlayerAvatar } from '../../components/PlayerAvatar'
import { ConfirmationModal } from '../../components/ConfirmationModal'
import { CardPickerPanel } from '../game/CardDialogs'
import { ForcedDrawStatus } from '../game/ForcedDrawStatus'
import { GameTable } from '../game/GameTable'
import type { Room } from '../../lib/room-store'
import type { ParticipantCommand } from '../../lib/shared-room-protocol'
import { joinedRoomView } from './joined-room-view'
import '../game/VengeanceScreen.css'

type Props = {
  room: Room
  owner?: string
  live: boolean
  online: boolean
  busy: boolean
  pendingAction: boolean
  approved: boolean
  error: string
  canReconnect: boolean
  onSend: (command?: ParticipantCommand) => Promise<void>
  onReconnect: () => void
  onRelease: () => Promise<void>
  onExit: () => void
  onDelete?: () => void
}

function Panel({ title, eyebrow, onClose, children, className = '' }: { title: string; eyebrow: string; onClose: () => void; children: ReactNode; className?: string }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog ref={dialog} className={`room-dialog tv-share-dialog shared-room-dialog shared-game-dialog ${className}`} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="room-dialog-heading"><div><span className="room-kicker">{eyebrow}</span><h2>{title}</h2></div><button className="room-icon-button" aria-label={`Close ${title.toLowerCase()}`} onClick={onClose}><X size={20} /></button></div>
    {children}
  </dialog>
}

export function JoinedGameView({ room, owner, live, online, busy, pendingAction, approved, error, canReconnect, onSend, onReconnect, onRelease, onExit, onDelete }: Props) {
  const [viewSeat, setViewSeat] = useState(owner ?? '')
  const [organized, setOrganized] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [focusCard, setFocusCard] = useState<Card | null>(null)
  const [panel, setPanel] = useState<'menu' | 'history' | 'players' | 'connection' | null>(null)
  const [releasePrompt, setReleasePrompt] = useState(false)
  const [dismissedDecision, setDismissedDecision] = useState('')
  const tabs = useRef<Record<string, HTMLButtonElement | null>>({})
  const enabled = live && online && !busy && !pendingAction && approved
  const { vengeance: v, classic, state, turn, decisionOwner, complete, settled, mayRecord, mayBank } = joinedRoomView(room, owner, enabled)
  const players = state?.players ?? []
  const selected = players.find(player => player.id === viewSeat) ?? players.find(player => player.id === owner) ?? players[0]
  const mine = selected?.id === owner
  const selectedClassic = classic?.players.find(player => player.id === selected?.id)
  const selectedV = v?.players.find(player => player.id === selected?.id)
  const status = selectedClassic?.round.status ?? selectedV?.status
  const score = selectedClassic ? bankerPlayerDerived(selectedClassic).score : selectedV ? vengeanceScore(selectedV, v?.variant, v?.flipSevenChoice) : 0
  const bonus = selectedClassic ? bankerPlayerDerived(selectedClassic).flipSevenBonus : selectedV?.status === 'flip-seven' && (!v?.flipSevenChoice || v.flipSevenChoice.choice === 'self') ? 15 : 0
  const rawEntries = v && selected ? vengeanceTableEntries(v, selected.id) : classic && selected ? bankerTableEntries(classic, selected.id) : []
  const entries = organized ? [...rawEntries].sort((a, b) => {
    const order = { number: 0, modifier: 1, action: 2 }
    return order[a.card.kind] - order[b.card.kind] || (a.card.points ?? 0) - (b.card.points ?? 0) || a.card.label.localeCompare(b.card.label, undefined, { numeric: true })
  }) : rawEntries
  const pending = v ? vengeancePending(v) : undefined
  const decisionKey = decisionOwner ? JSON.stringify([state?.roundNumber, decisionOwner, classic?.pendingAction ?? pending ?? v?.pendingFlipSeven]) : ''
  const myDecision = Boolean(live && approved && decisionOwner === owner && decisionKey)
  const showDecision = myDecision && online && dismissedDecision !== decisionKey && !panel
  const forced = v?.forced[0] ?? classic?.forcedTurns[0]
  const turnName = players.find(player => player.id === turn)?.name
  const decisionName = players.find(player => player.id === decisionOwner)?.name
  const terminal = status !== 'active'

  useEffect(() => { if (!mayRecord || !mine) setPickerOpen(false) }, [mayRecord, mine])
  useEffect(() => { tabs.current[selected?.id ?? '']?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'nearest' }) }, [selected?.id])
  useEffect(() => {
    const close = (event: KeyboardEvent) => {
      if (event.key === 'Escape') { setPickerOpen(false); setFocusCard(null); if (showDecision) setDismissedDecision(decisionKey) }
    }
    window.addEventListener('keydown', close)
    return () => window.removeEventListener('keydown', close)
  }, [showDecision, decisionKey])

  if (!state || !selected) return null
  const selectSeat = (id: string) => { setViewSeat(id); setOrganized(false); setFocusCard(null); setPickerOpen(false) }
  const record = (card: Card) => { if (mayRecord && mine) { setPickerOpen(false); void onSend({ type: 'record', cardId: card.id }) } }
  const playerStatus = (player: typeof selected) => 'round' in player ? player.round.status : player.status
  const playerScore = (player: typeof selected) => 'round' in player ? bankerPlayerDerived(player).score : vengeanceScore(player, v?.variant, v?.flipSevenChoice)
  const summary = (player: typeof selected) => {
    const status = playerStatus(player)
    const count = ('round' in player ? player.round.entries : player.entries).filter(entry => !entry.voided && entry.card.kind === 'number').length
    return status === 'busted' ? 'Busted' : `${status === 'active' ? `${count} cards` : status === 'flip-seven' ? 'Flip 7!' : status === 'stayed' ? 'Banked' : 'Frozen'} · ${playerScore(player)} pts`
  }
  const context = !live ? 'Saved history · Read only' : !online ? 'Paused · Waiting for host' : pendingAction ? 'Entry awaiting confirmation' : busy ? 'Saving with host…' : `Connected · ${players.find(player => player.id === owner)?.name ?? 'Your seat'}`
  const connectionStatus = !live ? 'saved' : !online ? 'paused' : pendingAction ? 'pending' : 'connected'
  const hint = !live ? 'This is your saved copy. Reconnect to receive the latest table.' : !online ? 'Keep the host’s room open and stay on the same Wi-Fi or hotspot.' : pendingAction ? 'Check your last entry before recording another card.' : settled ? 'Round complete. The host will confirm the scores and continue.' : decisionOwner ? `${decisionName ?? 'A player'} is choosing ${classic?.pendingAction?.card.label ?? pending?.card.label ?? 'a Flip 7 reward'}.` : !mine ? `Viewing ${selected.name}’s table. You can record cards on your own table.` : mayRecord ? 'Your turn! Tap + to record the physical card in front of you.' : terminal ? 'Your hand is settled. You can still view every player’s table.' : `Waiting for ${turnName ?? 'the host'}. Your table is ready.`
  const modalClass = room.edition === 'vengeance' ? 'edition-vengeance' : ''
  const ordered = [...players].sort((a, b) => b.totalScore - a.totalScore)

  return <div className={`app-shell banker-shell saved-room-game joined-game edition-${room.edition ?? 'classic'}`}>
    <aside className="desktop-marquee left"><div>FLIP<br />7</div></aside>
    <main className="game-shell">
      <header className="topbar banker-topbar">
        <button className={`brand-button cast-button ${live && online ? 'is-sharing' : ''}`} aria-label={`Room connection: ${context}`} title="Room connection" onClick={() => setPanel('connection')}><Cast size={20} /><span className={`sharing-status-dot ${connectionStatus}`} aria-hidden="true" /><span className="sharing-status-text" role="status">{context}</span></button>
        <span className="game-topbar-brand"><img src={v ? '/assets/flip7-vengeance-logo.webp' : '/assets/flip7-title-logo.webp'} alt={v ? 'Flip 7 Vengeance' : 'Flip 7'} /></span>
        <button className="brand-button menu-button" aria-label="Open game menu" onClick={() => setPanel('menu')}><Menu size={20} /></button>
      </header>
      <section className="match-strip"><div><span>ROUND</span><b>{String(state.roundNumber).padStart(2, '0')}</b></div><div className="target"><span>FIRST TO</span><b>{room.targetScore}</b></div><div><span>VIEWING</span><b>{selected.name}</b></div></section>
      {room.variant === 'brutal' && <div className="shared-brutal-tag">BRUTAL MODE</div>}
      <div className="banker-turn-callout" role="status"><span>{complete ? 'MATCH COMPLETE' : settled ? 'ROUND COMPLETE' : decisionOwner ? 'CHOOSING' : 'CURRENT TURN'}</span><b>{complete ? 'Final scores saved' : settled ? 'Waiting for host' : decisionName ?? turnName ?? '—'}</b>{!settled && !complete && turn === owner && !decisionOwner && <em className="shared-you-tag">YOU</em>}</div>
      {forced && forced.remaining > 0 && <ForcedDrawStatus label={v ? ('kind' in forced && forced.kind === 'one' ? 'Flip One' : 'Flip Four') : 'Flip Three'} remaining={forced.remaining} total={v ? ('kind' in forced && forced.kind === 'one' ? 1 : 4) : 3} />}
      {error && <div className="shared-game-error" role="alert">{error}</div>}
      {pendingAction && live && <div className="shared-retry"><p>Your last entry has not been confirmed. Check it safely without recording it twice.</p><button className="secondary-action" disabled={!online || busy} onClick={() => void onSend()}><RefreshCw size={15} /> Check entry</button></div>}
      <section className={`banker-player-strip ${v ? 'vengeance-player-strip' : ''}`} aria-label="Player tables">{players.map(player => <button key={player.id} ref={element => { tabs.current[player.id] = element }} className={`banker-player-tab opponent ${player.id === selected.id ? 'selected' : ''} ${player.id === turn ? 'turn' : ''} ${playerStatus(player) === 'flip-seven' ? 'stayed' : playerStatus(player)}`} aria-pressed={selected.id === player.id} aria-current={player.id === turn ? 'step' : undefined} onClick={() => selectSeat(player.id)}><PlayerAvatar player={player} className="mini-avatar" /><span className="opponent-copy"><b>{player.name}{player.id === owner && <small className="shared-tab-you">YOU</small>}</b><span>{summary(player)}</span></span><strong><small>Total pts:</small> <b>{player.totalScore}</b></strong></button>)}</section>
      {complete ? <div className="banker-results shared-results">
        <section className="results-hero"><span className="eyebrow">SHARED TABLE COMPLETE</span><h1>Match complete!</h1><p>{ordered.filter(player => player.totalScore === ordered[0]?.totalScore).map(player => player.name).join(' and ')} won with {ordered[0]?.totalScore} points.</p></section>
        <section className="results-card"><div className="results-heading"><div><span className="eyebrow">FINAL SCORES</span><h2>Game results</h2></div><Trophy size={22} /></div><div className="results-list">{ordered.map(player => <article key={player.id} className={`results-player ${player.totalScore === ordered[0]?.totalScore ? 'winner' : ''}`}><span className="results-rank">{ordered.findIndex(p => p.totalScore === player.totalScore) + 1}</span><PlayerAvatar player={player} className="mini-avatar" /><div className="results-player-copy"><div className="results-player-name"><b>{player.name}{player.id === owner ? ' (You)' : ''}</b></div><div className="results-rounds">{state.history.map(round => <span className="round-score" key={round.round}>R{round.round}: {round.scores[player.id] ?? 0}</span>)}</div></div><div className="results-total"><small>Total pts</small><strong>{player.totalScore}</strong></div></article>)}</div></section>
        <section className="results-actions"><p>Scores and received round cards are saved on this phone.</p><button className="primary-wide" onClick={() => setPanel('history')}><History size={17} /> View round history</button></section>
      </div> : <>
        <GameTable table={entries.map(entry => entry.card)} tableCardIds={entries.map(entry => entry.instanceId)} isVoidedCard={index => Boolean(entries[index]?.voided)} cardResolution={index => entries[index]?.resolution} score={score} flipSevenBonus={bonus} busted={status === 'busted'} frozen={status === 'frozen' && !mayRecord} submitting={busy && mine} interactionLocked={false} canEditCards={mine && mayRecord} canAddCards={mine && mayRecord} showAddCard={Boolean(live && mine)} canDrawWhileStayed={Boolean(v?.forced.length && turn === selected.id)} confirmedAt={terminal ? 'settled' : null} isStaying={status === 'stayed'} isOrganized={organized} playerName={selected.name} isHost={false} onOrganize={() => setOrganized(value => !value)} onOpenPicker={() => { if (mine && mayRecord) setPickerOpen(true) }} onSelectCard={(_, card) => setFocusCard(card)} />
        {!entries.length && <p className="shared-empty-table">{mine && mayRecord ? 'Your first flip goes here.' : 'No cards on this table yet.'}</p>}
        <div className="shared-table-hint" role="status"><p>{hint}</p>{myDecision && online && !showDecision && <button className="secondary-action" disabled={busy || pendingAction} onClick={() => { setDismissedDecision(''); setPanel(null) }}>Make your choice <ChevronRight size={15} /></button>}{!live && canReconnect && <button className="secondary-action" onClick={onReconnect}><RefreshCw size={15} /> Reconnect</button>}</div>
        <section className="actions shared-player-actions">
          <button className="secondary-action" onClick={() => owner && selectSeat(owner)}><UserRound size={19} /> My table</button>
          <button className={`stay-action ${terminal && mine ? 'confirmed' : ''} ${status === 'busted' && mine ? 'bust-state' : ''} ${status === 'frozen' && mine ? 'frozen-state' : ''}`} disabled={!mine || !mayBank} onClick={() => { if (mine && mayBank) void onSend({ type: 'bank' }) }}>{!mine ? 'VIEW ONLY' : status === 'busted' ? 'BUST!' : status === 'frozen' ? 'FROZEN' : terminal ? 'BANKED!' : 'STAY / BANK'}</button>
          <button className="secondary-action redo-action" onClick={() => setPanel('history')}><History size={19} /> History</button>
        </section>
      </>}
    </main>
    <aside className="desktop-marquee right"><div>PRESS<br />YOUR<br />LUCK</div></aside>
    <AnimatePresence>
      {pickerOpen && mayRecord && mine && <motion.div key="picker" className="picker-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={() => setPickerOpen(false)}><CardPickerPanel cards={v ? vengeanceCards : pickerCards} submitting={!enabled} onClose={() => setPickerOpen(false)} onSelect={record} /></motion.div>}
      {focusCard && <motion.div key="card-focus" className="picker-backdrop card-focus-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={() => setFocusCard(null)}><motion.section className="card-picker card-focus-panel shared-card-focus" role="dialog" aria-modal="true" aria-label={focusCard.label} initial={{ scale: .9, y: 30 }} animate={{ scale: 1, y: 0 }} onClick={event => event.stopPropagation()}><div className="picker-heading"><div><span>{selected.name.toUpperCase()}’S TABLE</span><h2>{focusCard.label}</h2></div><button className="close-button" aria-label="Close card" onClick={() => setFocusCard(null)}><X size={19} /></button></div><div className="card-focus-art"><CardArtwork card={focusCard} /></div><p><ShieldCheck size={16} /> Ask the host to correct or remove a card.</p></motion.section></motion.div>}
    </AnimatePresence>
    {panel === 'connection' && <Panel title="Room connection" eyebrow={live ? 'PLAYING TOGETHER' : 'JOINED HISTORY'} onClose={() => setPanel(null)} className={modalClass}>
      <p>{room.name} · {room.edition === 'vengeance' ? 'Vengeance' : 'Classic'}{room.variant === 'brutal' ? ' · Brutal' : ''}</p>
      <div className={`sharing-connection-card ${connectionStatus}`} role="status"><span className="sharing-connection-icon">{!live ? <History size={25} /> : online ? <Wifi size={25} /> : <WifiOff size={25} />}</span><div><strong>{context}</strong><p>{!live ? 'This is the history copy saved on your phone.' : !online ? 'Play is paused. Reconnection happens automatically when the host returns.' : pendingAction ? 'Check your last entry before recording another card.' : 'Your entries go straight to the host and are saved on both phones.'}</p></div></div>
      <div className="sharing-seat-details"><span>YOUR SEAT</span><div>{players.find(player => player.id === owner) && <PlayerAvatar player={players.find(player => player.id === owner)!} className="mini-avatar" />}<b>{players.find(player => player.id === owner)?.name ?? 'Saved player'}</b><small>{live ? 'Approved player' : 'Read-only history'}</small></div></div>
      <button className="room-button secondary" onClick={() => setPanel('players')}><Users size={17} /> Players & scores</button>
      {!live && canReconnect && <button className="room-button sharing-reconnect" onClick={onReconnect}><RefreshCw size={17} /> Reconnect to host</button>}
      {live && pendingAction && <button className="room-button sharing-reconnect" disabled={!online || busy} onClick={() => void onSend()}><RefreshCw size={17} /> Check unconfirmed entry</button>}
      <div className="shared-permission-note"><ShieldCheck size={18} /><p>{live ? 'Stay on the same Wi-Fi or hotspot. The host needs to keep the room open. You control your own seat and can view every table.' : 'Reconnect to the host for updates. Your received cards and scores stay saved on this phone.'}</p></div>
      {live && <button className="shared-stop-hosting" disabled={!enabled} onClick={() => { setPanel(null); setReleasePrompt(true) }}>Release my seat</button>}
    </Panel>}
    {panel === 'menu' && <Panel title="Game menu" eyebrow={live ? 'PLAYING TOGETHER' : 'JOINED HISTORY'} onClose={() => setPanel(null)} className={`banker-menu-dialog ${modalClass}`}>
      <div className="banker-menu-list">
        {([{ icon: Cast, title: 'Room connection', copy: 'Connection status and your approved seat', action: () => setPanel('connection') }, { icon: Users, title: 'Players', copy: 'View every table, score, and player status', action: () => setPanel('players') }, { icon: History, title: 'Round history', copy: 'Received cards and scores saved on this phone', action: () => setPanel('history') }, ...(!live && onDelete ? [{ icon: Trash2, title: 'Remove history copy', copy: 'Remove this game from this phone', action: () => { setPanel(null); onDelete() } }] : []), { icon: LogOut, title: live ? 'Exit room' : 'Your rooms', copy: live ? 'Leave the room; received history stays saved' : 'Return to your saved rooms', action: () => { setPanel(null); onExit() } }]).map(item => <button key={item.title} className="banker-menu-item" onClick={item.action}><div className="banker-menu-item-icon"><item.icon size={20} /></div><div className="banker-menu-item-text"><strong>{item.title}</strong><span>{item.copy}</span></div><ChevronRight size={18} className="banker-menu-item-chevron" /></button>)}
      </div>
    </Panel>}
    {panel === 'players' && <Panel title="Players" eyebrow="AT THIS TABLE" onClose={() => setPanel(null)} className={modalClass}><div className="info-list shared-player-list">{players.map(player => <button className={`info-player ${player.id === selected.id ? 'current-player' : ''}`} key={player.id} onClick={() => { selectSeat(player.id); setPanel(null) }}><PlayerAvatar player={player} className="mini-avatar" /><div><b>{player.name}{player.id === owner ? ' (You)' : ''}</b><small>{summary(player)}</small></div><span className="info-player-scores"><span><small>ROUND</small><strong>{playerScore(player)}</strong></span><span><small>TOTAL</small><strong>{player.totalScore}</strong></span></span></button>)}</div></Panel>}
    {panel === 'history' && <Panel title="Round history" eyebrow="SAVED ON THIS PHONE" onClose={() => setPanel(null)} className={modalClass}>
      <p>Each completed round received from the host is kept here.{room.joinedCopy && ` Last saved ${new Date(room.joinedCopy.syncedAt).toLocaleString()}.`}</p>
      {!state.history.length ? <div className="shared-history-empty"><Clock3 size={32} /><h3>The first round is in play.</h3><p>Completed rounds will appear here with every player’s cards and score.</p></div> : <div className="shared-history-list">{[...state.history].reverse().map(round => <details className="shared-round" key={round.round}><summary><span>ROUND {String(round.round).padStart(2, '0')}</span><b>{Object.keys(round.scores).length} players</b><ChevronRight size={17} /></summary>{Object.entries(round.scores).map(([id, points]) => { const hand = round.hands?.[id]; return <article className="shared-history-hand" key={id}><header>{hand && <PlayerAvatar player={{ ...hand, id }} className="mini-avatar" />}<strong>{hand?.name ?? room.roster.find(p => p.id === id)?.name ?? 'Player'}</strong><b>{points} pts</b></header><div className="shared-history-cards">{hand?.entries.map(entry => <div key={entry.instanceId} className={entry.voided ? 'shared-voided' : ''}><CardArtwork card={entry.card} /></div>)}</div></article> })}</details>)}</div>}
    </Panel>}
    {showDecision && <Panel title={v?.pendingFlipSeven ? 'You hit Flip 7!' : `Who gets ${classic?.pendingAction?.card.label ?? pending?.card.label ?? 'this card'}?`} eyebrow="YOUR DECISION" onClose={() => setDismissedDecision(decisionKey)} className={`shared-decision-dialog ${modalClass}`}>
      <p>{v?.pendingFlipSeven ? 'Take the +15 bonus or give another player −15 points.' : 'Choose below to resolve your action. The host can also make this choice.'}</p>
      <fieldset disabled={!enabled} className="shared-decision-options">
        {classic?.pendingAction && <div className="target-list banker-target-list">{bankerEligibleActionTargets(classic, classic.pendingAction.card).map(player => <button key={player.id} className="banker-actor-select-btn" onClick={() => void onSend({ type: 'classic-target', playerId: player.id })}><PlayerAvatar player={player} className="mini-avatar" /><b>{player.name}</b><ChevronRight size={17} /></button>)}</div>}
        {v && pending && <>
          {(pending.card.kind === 'modifier' || !['v-action-steal', 'v-action-swap', 'v-action-discard'].includes(pending.card.id)) && <div className="target-list banker-target-list">{vengeanceEligibleActors(v).map(player => <button key={player.id} className="banker-actor-select-btn" onClick={() => void onSend({ type: pending.card.kind === 'modifier' ? 'choose-target' : 'choose-actor', playerId: player.id })}><PlayerAvatar player={player} className="mini-avatar" /><b>{player.name}</b><ChevronRight size={17} /></button>)}</div>}
          <div className="shared-decision-cards">{vengeanceEligibleCards(v).map(({ player, entry }) => <button key={entry.instanceId} aria-label={`${player.name}: ${entry.card.label}`} aria-pressed={pending.selectedCards.includes(entry.instanceId)} onClick={() => void onSend({ type: 'choose-card', instanceId: entry.instanceId })}><CardArtwork card={entry.card} /><small>{player.name}</small>{pending.selectedCards.includes(entry.instanceId) && <Check size={17} />}</button>)}</div>
          {['v-action-steal', 'v-action-swap', 'v-action-discard'].includes(pending.card.id) && <button className="room-button" disabled={!enabled || pending.selectedCards.length !== (pending.card.id === 'v-action-swap' ? 2 : 1)} onClick={() => void onSend({ type: 'confirm' })}>Confirm selection</button>}
        </>}
        {v?.pendingFlipSeven && <><button className="room-button" onClick={() => void onSend({ type: 'flip-seven', choice: 'self' })}>Take +15 points</button><span className="shared-option-label">OR CHOOSE A PLAYER TO LOSE 15 POINTS</span><div className="target-list banker-target-list">{players.filter(player => player.id !== owner).map(player => <button key={player.id} className="banker-actor-select-btn" onClick={() => void onSend({ type: 'flip-seven', choice: 'penalize', playerId: player.id })}><PlayerAvatar player={player} className="mini-avatar" /><b>{player.name}</b><ChevronRight size={17} /></button>)}</div></>}
      </fieldset>
    </Panel>}
    {releasePrompt && <ConfirmationModal title="Release your seat?" eyebrow="PLAYING TOGETHER" message="Another phone can claim this seat. Your received history stays saved, and the host can keep recording this hand." confirmLabel="Release seat" cancelLabel="Keep my seat" confirming={busy} onCancel={() => setReleasePrompt(false)} onConfirm={() => { setReleasePrompt(false); void onRelease() }} />}
  </div>
}
