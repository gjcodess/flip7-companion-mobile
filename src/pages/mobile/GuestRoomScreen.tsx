import { useEffect, useMemo, useRef, useState } from 'react'
import { AlertCircle, ArrowLeft, CheckCircle2, ChevronRight, CircleHelp, ClipboardList, LoaderCircle, LogOut, Menu, Pencil, QrCode, Radio, Users, WifiOff, X } from 'lucide-react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { AnimatePresence, motion } from 'motion/react'
import type { Card } from '../../game/cards'
import { bankerPlayerDerived, type BankerAction, type BankerPlayer } from '../../game/bankerGame'
import { organizeDemoEntries } from '../../game/demoGame'
import { PlayerAvatar } from '../../components/PlayerAvatar'
import { CardPickerPanel, CardActionsPanel } from '../game/CardDialogs'
import { GameTable } from '../game/GameTable'
import { GameControls } from '../game/GameControls'
import { findJoinedRoom, forgetJoinedRoom, saveJoinedRoom } from '../../lib/joined-rooms'
import { findLocalRoomCode, localRoomRequest, parseJoinUrl } from '../../lib/local-room'
import { useMyProfile } from '../../lib/my-profile'
import { newLocalId } from '../../lib/local-id'
import { MyProfileEditor } from './MyProfileEditor'
import type { Room } from '../../lib/room-store'
import { useAppNavigation } from '../../lib/navigation'
import { pointLabel } from '../../lib/app-utils'
import './LocalRoom.css'

function formatUserFriendlyError(error: string): string {
  if (/failed to connect|ECONNREFUSED|ETIMEDOUT|after \d+ms/i.test(error)) {
    return 'Could not reach the host table. Reconnecting…'
  }
  if (/NetworkError|Failed to fetch/i.test(error)) {
    return 'Lost connection to table. Reconnecting…'
  }
  return error
}

type StateResponse = { revision: number; room?: Room; claimedSeats?: string[]; credentialValid?: boolean }
type JoinResponse = { id: string; status: string; seatId: string; secret?: string }
const qrScanner = registerPlugin<{ scan(): Promise<{ text: string }> }>('QrScanner')
const pause = (time: number) => new Promise(resolve => window.setTimeout(resolve, time))
const pendingKey = 'flip7.pending-local-join.v1'
function pendingJoinId(url: string) {
  try { const item = JSON.parse(localStorage.getItem(pendingKey) || 'null'); return item?.url === url && typeof item.id === 'string' ? item.id : '' }
  catch { return '' }
}
function rememberPendingJoin(url: string, id: string) {
  try { if (id) localStorage.setItem(pendingKey, JSON.stringify({ url, id })); else localStorage.removeItem(pendingKey) }
  catch { /* A guest can still stay on the live waiting screen. */ }
}
const statusClass = (player: BankerPlayer) => player.round.status === 'flip-seven' ? 'stayed' : player.round.status
function tabSummary(player: BankerPlayer) {
  const score = bankerPlayerDerived(player).score
  const cards = player.round.entries.filter(entry => !entry.voided && entry.card.kind === 'number').length
  if (player.round.status === 'active') return `${cards} cards · ${score} ${pointLabel(score)}`
  if (player.round.status === 'stayed') return `Banked · ${score} ${pointLabel(score)}`
  if (player.round.status === 'frozen') return `Frozen · ${score} ${pointLabel(score)}`
  if (player.round.status === 'flip-seven') return `Flip 7 · ${score} ${pointLabel(score)}`
  return 'Busted'
}

function GuestGameMenu({ onClose, onPlayers, onRules, onExit }: { onClose: () => void; onPlayers: () => void; onRules: () => void; onExit: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <dialog ref={dialog} className="room-dialog banker-menu-dialog tv-share-dialog" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="room-dialog-heading"><div><span className="room-kicker">BANKER MODE</span><h2>Game menu</h2></div><button className="room-icon-button" aria-label="Close menu" onClick={onClose}><X size={20} /></button></div>
    <p>View the players and rules, or return to your rooms.</p>
    <div className="banker-menu-list">
      <button type="button" className="banker-menu-item" onClick={() => { onClose(); onPlayers() }}><span className="banker-menu-item-icon"><Users size={20} /></span><span className="banker-menu-item-text"><strong>Players & Tables</strong><span>View scores and open another table</span></span><ChevronRight size={18} className="banker-menu-item-chevron" /></button>
      <button type="button" className="banker-menu-item" onClick={() => { onClose(); onRules() }}><span className="banker-menu-item-icon"><CircleHelp size={20} /></span><span className="banker-menu-item-text"><strong>Rules & Guide</strong><span>Scoring, action cards, and banking</span></span><ChevronRight size={18} className="banker-menu-item-chevron" /></button>
      <button type="button" className="banker-menu-item banker-menu-item-danger" onClick={() => { onClose(); onExit() }}><span className="banker-menu-item-icon"><LogOut size={20} /></span><span className="banker-menu-item-text"><strong>Exit game</strong><span>Your seat stays saved on this device</span></span><ChevronRight size={18} className="banker-menu-item-chevron" /></button>
    </div>
  </dialog>
}

export function GuestRoomScreen({ inviteUrl }: { inviteUrl: string }) {
  const navigate = useAppNavigation()
  const profile = useMyProfile()
  const [address, setAddress] = useState(inviteUrl)
  const [url, setUrl] = useState(() => { try { return parseJoinUrl(inviteUrl) } catch { return '' } })
  const [credential, setCredential] = useState(() => { try { return findJoinedRoom(parseJoinUrl(inviteUrl)) ?? null } catch { return null } })
  const [snapshot, setSnapshot] = useState<StateResponse | null>(null)
  const [connected, setConnected] = useState(false)
  const [requestId, setRequestId] = useState(() => { try { return pendingJoinId(parseJoinUrl(inviteUrl)) } catch { return '' } })
  const [showMenu, setShowMenu] = useState(false)
  const [showPlayers, setShowPlayers] = useState(false)
  const [showRules, setShowRules] = useState(false)
  const [profileOpen, setProfileOpen] = useState(false)
  const [pickerOpen, setPickerOpen] = useState(false)
  const [editingIndex, setEditingIndex] = useState<number | null>(null)
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null)
  const [pendingAction, setPendingAction] = useState<Card | null>(null)
  const [viewPlayerId, setViewPlayerId] = useState('')
  const [organized, setOrganized] = useState(false)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')

  useEffect(() => {
    if (!error && !notice) return
    const timer = window.setTimeout(() => {
      setError('')
      setNotice('')
    }, 5000)
    return () => window.clearTimeout(timer)
  }, [error, notice])

  useEffect(() => {
    if (!url) return
    let active = true
    const poll = async () => {
      let after = 0
      while (active) {
        try {
          const next = await localRoomRequest<StateResponse>(url, `state?after=${after}${credential?.secret ? `&key=${encodeURIComponent(credential.secret)}` : ''}`)
          if (!active) break
          if (after === 0 && (!next.room?.id || !Array.isArray(next.room.roster))) throw new Error('The room data is incomplete.')
          after = next.revision
          if (next.room) setSnapshot(next)
          setConnected(true)
          setError('')
          if (credential?.secret && next.credentialValid === false) {
            forgetJoinedRoom(url)
            setCredential(null)
            setViewPlayerId('')
            setNotice(
              next.room?.state
                ? 'The host disconnected your device. Your seat is now controlled on the host phone.'
                : 'You were removed from the table by the host.'
            )
          } else if (credential?.secret && next.room) {
            try { saveJoinedRoom({ url, room: next.room, seatId: credential.seatId, secret: credential.secret, savedAt: Date.now() }) }
            catch { setNotice('Live play works, but this device could not save a history copy.') }
          }
        } catch (failure) {
          if (!active) break
          setConnected(false)
          setError((failure as Error).message)
          await pause(2500)
        }
      }
    }
    void poll()
    return () => { active = false }
  }, [url, credential?.secret, credential?.seatId])

  useEffect(() => {
    if (!url || !requestId) return
    let active = true
    const waitForHost = async () => {
      while (active) {
        try {
          const response = await localRoomRequest<JoinResponse>(url, `join-status?request=${encodeURIComponent(requestId)}`)
          if (!active) break
          if (response.status === 'approved' && response.secret) {
            if (!snapshot?.room) throw new Error('Wait for the room to reconnect.')
            const joined = { url, room: snapshot.room, seatId: response.seatId, secret: response.secret, savedAt: Date.now() }
            setCredential(joined)
            let savedCopy = true
            try { saveJoinedRoom(joined) } catch { savedCopy = false }
            setViewPlayerId(response.seatId)
            setRequestId('')
            rememberPendingJoin(url, '')
            setNotice(savedCopy ? 'You joined the table!' : 'You joined, but this device could not save a history copy.')
            break
          }
          if (response.status === 'denied') { setRequestId(''); rememberPendingJoin(url, ''); setError('The host declined your request.'); break }
        } catch (failure) { if (active) { const message = (failure as Error).message; if (/request expired/i.test(message)) { setRequestId(''); rememberPendingJoin(url, '') }; setError(message) } }
        await pause(1500)
      }
    }
    void waitForHost()
    return () => { active = false }
  }, [url, requestId, snapshot?.room?.id])

  const room = snapshot?.room ?? credential?.room ?? null
  const state = room?.state ?? null
  const ownSeatId = credential?.seatId ?? ''
  const displayedId = state?.players.some(player => player.id === viewPlayerId) ? viewPlayerId : state?.players.some(player => player.id === ownSeatId) ? ownSeatId : state?.players[0]?.id ?? ''
  const selectedPlayer = state?.players.find(player => player.id === displayedId) ?? null
  const joiningNextRound = Boolean(ownSeatId && room?.pendingPlayers?.some(player => player.id === ownSeatId))
  const currentTurnId = state?.forcedTurns[0]?.targetPlayerId ?? state?.turnPlayerId
  const derived = selectedPlayer ? bankerPlayerDerived(selectedPlayer) : null
  const ownTable = Boolean(ownSeatId && displayedId === ownSeatId)
  const canRecord = Boolean(connected && ownTable && state?.phase === 'round' && selectedPlayer?.round.status === 'active' && currentTurnId === ownSeatId && !busy)
  const canCorrect = Boolean(connected && ownTable && state?.phase === 'round' && (selectedPlayer?.round.status === 'active' || selectedPlayer?.round.status === 'busted') && !busy)
  const entries = useMemo(() => {
    if (!selectedPlayer) return []
    const source = selectedPlayer.round.entries
    const order = organized ? organizeDemoEntries(source) : source
    return order.map(entry => ({ entry, index: source.indexOf(entry) }))
  }, [selectedPlayer, organized])

  const openInvite = (next: string) => {
    setAddress(next)
    setSnapshot(null)
    setConnected(false)
    setRequestId(pendingJoinId(next))
    setUrl(next)
    setCredential(findJoinedRoom(next) ?? null)
    setError('')
    setNotice('')
  }
  const connect = async () => {
    setBusy(true)
    try { const next = /^[A-Z2-9]{6}$/i.test(address.trim()) ? await findLocalRoomCode(address) : parseJoinUrl(address); openInvite(next) }
    catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }
  const scanInvite = async () => {
    setBusy(true)
    setError('')
    try {
      const result = await qrScanner.scan()
      if (result.text) {
        try { openInvite(parseJoinUrl(result.text)) }
        catch { setError('That QR code is not a Flip7 room invite. Scan the code shown on the host phone.') }
      }
    } catch (failure) {
      const message = (failure as Error).message || 'Could not scan the QR code.'
      if (!/cancel|dismiss/i.test(message)) setError(message)
    } finally { setBusy(false) }
  }
  const requestSeat = async () => {
    if (!url || !room || room.state?.phase === 'results') return
    if (!profile.name.trim()) { setProfileOpen(true); return }
    setBusy(true); setError('')
    try {
      const next = await localRoomRequest<JoinResponse>(url, 'join', { name: profile.name, avatar: profile.avatar, color: profile.color })
      setRequestId(next.id)
      rememberPendingJoin(url, next.id)
      setNotice('')
    } catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }
  const send = async (action: BankerAction) => {
    if (!url || !credential?.secret || !connected) return
    setBusy(true); setError(''); setNotice('')
    try {
      const result = await localRoomRequest<{ ok: boolean; error?: string }>(url, 'action', { secret: credential.secret, actionId: newLocalId(), action })
      if (!result.ok) throw new Error(result.error || 'The host could not save that move.')
    } catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }
  const selectCard = (card: Card) => {
    setPickerOpen(false)
    if (!ownSeatId) return
    if (editingIndex !== null) {
      const index = editingIndex
      setEditingIndex(null)
      if (card.kind === 'action') { setError('Ask the host to correct an action card.'); return }
      void send({ type: 'player', playerId: ownSeatId, action: { type: 'replace', index, card } })
      return
    }
    if (card.kind === 'action') { setPendingAction(card); return }
    void send({ type: 'record-card', playerId: ownSeatId, card })
  }

  const inGame = Boolean(ownSeatId && state)
  const atCapacity = Boolean(room && room.roster.length + (room.pendingPlayers?.length ?? 0) >= 18)
  return <div className={'app-shell banker-shell local-guest-shell' + (inGame ? ' saved-room-game local-playing-shell' : '')}>
    <AnimatePresence>
      {(error || notice) && (
        <motion.aside
          key={error ? `err-${error}` : `not-${notice}`}
          className="floating-toast-overlay"
          initial={{ opacity: 0, y: -16, scale: 0.96 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -16, scale: 0.96 }}
          transition={{ duration: 0.2 }}
        >
          <div className={`floating-toast ${error ? 'error' : 'notice'}`} role={error ? 'alert' : 'status'}>
            <span className="floating-toast-icon">
              {error ? <AlertCircle size={18} /> : <CheckCircle2 size={18} />}
            </span>
            <span className="floating-toast-message">
              {error ? formatUserFriendlyError(error) : notice}
            </span>
            <button
              type="button"
              className="floating-toast-close"
              aria-label="Dismiss notification"
              onClick={() => { setError(''); setNotice('') }}
            >
              <X size={15} />
            </button>
          </div>
        </motion.aside>
      )}
    </AnimatePresence>
    <main className={'game-shell' + (inGame ? '' : ' local-guest-main')}>
    {inGame ? <>
      <header className="topbar banker-topbar local-player-topbar"><button type="button" className="brand-button local-game-back" aria-label="Back to your rooms" title="Back to your rooms" onClick={() => navigate('/landing')}><ArrowLeft size={20} /></button><span className="game-topbar-brand"><img src="/assets/flip7-title-logo.webp" alt="Flip 7" /></span><button type="button" className="brand-button menu-button" aria-label="Open game menu" title="Menu" onClick={() => setShowMenu(true)}><Menu size={20} /></button></header>
      {!connected && <div className="floating-offline-chip" role="status"><WifiOff size={12} /> Showing saved copy · Reconnecting</div>}
      <section className="match-strip"><div><span>ROUND</span><b>{String(state!.roundNumber).padStart(2, '0')}</b></div><div className="target"><span>FIRST TO</span><b>{state!.targetScore}</b></div><div><span>VIEWING</span><b>{selectedPlayer?.name ?? '—'}</b></div></section>
      <div className="banker-turn-callout" role="status"><span>CURRENT TURN</span><b>{state!.players.find(player => player.id === currentTurnId)?.name ?? (state!.phase === 'results' ? 'Match complete' : 'Round complete')}</b></div>
      {joiningNextRound && <div className="local-next-round-banner"><LoaderCircle size={16} className="spin" /> {state!.phase === 'results' ? 'This match ended before your first turn. Ask the host to invite you to the next match.' : 'You are approved. Your table joins at the next round.'}</div>}
      <section className="banker-player-strip" aria-label="Player tables">{state!.players.map(player => <button type="button" key={player.id} aria-label={`${player.name}${player.id === ownSeatId ? ', your table' : ''}`} className={'banker-player-tab opponent' + (player.id === displayedId ? ' selected' : '') + (player.id === currentTurnId ? ' turn' : '') + ' ' + statusClass(player)} aria-current={player.id === currentTurnId ? 'step' : undefined} onClick={() => { setViewPlayerId(player.id); setSelectedCardIndex(null); setOrganized(false) }}><PlayerAvatar player={player} className="mini-avatar" /><span className="opponent-copy"><b>{player.name}</b><span>{tabSummary(player)}</span></span><strong><small>Total pts:</small> <b>{player.totalScore}</b></strong></button>)}</section>
      {selectedPlayer && state!.phase === 'round' && <>
        <GameTable table={entries.map(item => item.entry.card)} tableCardIds={entries.map(item => item.entry.instanceId)} isVoidedCard={index => !!entries[index]?.entry.voided} score={derived?.score ?? 0} flipSevenBonus={derived?.flipSevenBonus ?? 0} busted={selectedPlayer.round.status === 'busted'} frozen={selectedPlayer.round.status === 'frozen'} submitting={busy} interactionLocked={!canCorrect || pickerOpen || selectedCardIndex !== null} canEditCards={canCorrect} canAddCards={canRecord} confirmedAt={selectedPlayer.round.status === 'active' ? null : 'banker'} isStaying={selectedPlayer.round.status === 'stayed'} isOrganized={organized} playerName={selectedPlayer.name} isHost={false} onOrganize={() => setOrganized(current => !current)} onOpenPicker={() => { setEditingIndex(null); setPickerOpen(true) }} onSelectCard={index => { if (!canCorrect) return; if (entries[index].entry.card.kind === 'action') { setNotice('Ask the host to correct an action card.'); return } setSelectedCardIndex(entries[index].index) }} />
        <GameControls isHost={false} allPlayersSettled={false} submitting={busy} canEditCards={canCorrect} canSettle={canRecord && state!.forcedTurns.length === 0} canUseHistory={false} hasCardsOrRemoval={false} hasRedo={false} isStaying={selectedPlayer.round.status === 'stayed'} busted={selectedPlayer.round.status === 'busted'} frozen={selectedPlayer.round.status === 'frozen'} numberCardCount={derived?.numberCardCount ?? 0} playerStatus={selectedPlayer.round.status === 'flip-seven' ? 'stayed' : selectedPlayer.round.status} confirmedAt={selectedPlayer.round.status === 'active' ? null : 'banker'} onNextRound={() => {}} onUndo={() => {}} onRedo={() => {}} onStay={() => { void send({ type: 'settle-player', playerId: ownSeatId }) }} />
      </>}
      {state!.phase === 'results' && <div className="banker-results local-game-results"><section className="results-hero"><span className="eyebrow">BANKER TABLE COMPLETE</span><h1>Match complete!</h1><p>Final scores from {room?.name}.</p></section><section className="results-card"><div className="results-heading"><div><span className="eyebrow">FINAL SCORES</span><h2>Game results</h2></div><span className="results-heading-icon" aria-hidden="true"><ClipboardList size={21} /></span></div><div className="results-list">{[...state!.players].sort((a, b) => b.totalScore - a.totalScore).map((player, index) => <article className={'results-player' + (state!.winnerIds.includes(player.id) ? ' winner' : '')} key={player.id}><span className="results-rank">{index + 1}</span><PlayerAvatar player={player} className="mini-avatar" /><div className="results-player-copy"><div className="results-player-name"><b>{player.name}</b></div></div><div className="results-total"><small>Total pts</small><strong>{player.totalScore}</strong></div></article>)}</div></section></div>}
    </> : <>
      <header className="local-guest-header"><button type="button" onClick={() => navigate('/landing')}><ArrowLeft size={18} /> My rooms</button><span><Radio size={15} /> LOCAL TABLE</span></header>
      {!url && <section className="local-guest-panel local-join-entry"><span className="room-kicker">JOIN A GAME NIGHT</span><h1>Join a room</h1><p>Use the same Wi-Fi or hotspot as the host. Scan their QR code, enter the six-character code, or use the full room address.</p>{Capacitor.getPlatform() === 'android' && <button type="button" className="local-scan-button" disabled={busy} onClick={() => void scanInvite()}><QrCode size={20} /> {busy ? 'Opening camera…' : 'Scan QR code'}</button>}<label className="room-field">ROOM CODE OR ADDRESS<input value={address} placeholder="ABC123 or http://192.168…/join/…" onChange={event => setAddress(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void connect() }} /></label><button type="button" className="room-button" disabled={busy || !address.trim()} onClick={() => void connect()}>{busy ? 'Looking…' : 'Find room'}</button></section>}
      {url && <div className="local-guest-connection" role="status">{connected ? <><Radio size={16} /> Connected to host</> : <><WifiOff size={16} /> Reconnecting to host…</>}{Capacitor.getPlatform() === 'web' && /Android/i.test(navigator.userAgent) && <a href={'flip7://join?url=' + encodeURIComponent(url)}>Open in Flip7 app</a>}</div>}
      {url && !room && <section className="local-guest-panel"><h1>Finding your room…</h1><p>Keep the host phone open and on the same Wi-Fi or hotspot.</p></section>}
      {room && !ownSeatId && <section className="local-guest-panel local-join-request-panel"><span className="room-kicker">JOIN THIS TABLE</span><h1>{room.name}</h1><p>{room.roster.length} {room.roster.length === 1 ? 'player' : 'players'} · First to {room.targetScore}{room.state ? ' · Round ' + room.state.roundNumber : ' · Waiting to start'}</p><div className="local-join-identity"><span>YOU WILL JOIN AS</span><button type="button" className="local-profile-row" disabled={!!requestId} onClick={() => setProfileOpen(true)}><PlayerAvatar player={{ ...profile, name: profile.name || 'Set my character' }} /><span><b>{profile.name || 'Set my name and character'}</b><small>{profile.name ? 'Tap to edit your character' : 'Choose your name before requesting'}</small></span><Pencil size={17} /></button></div>{requestId ? <div className="local-waiting"><LoaderCircle size={18} className="spin" /><span>Request sent. Waiting for the host to accept you.</span></div> : <button type="button" className="room-button" disabled={busy || !connected || atCapacity || room.state?.phase === 'results'} onClick={() => void requestSeat()}>{room.state?.phase === 'results' ? 'This match is complete' : atCapacity ? 'Room is full' : 'Ask to join this room'}</button>}{room.state?.phase === 'round' && <p className="local-join-next-note">If the game is already underway, you will play from the next round.</p>}</section>}
      {room && ownSeatId && !state && <section className="local-guest-panel local-waiting-room"><span className="room-kicker">YOU ARE IN</span><h1>{room.name}</h1><p>The host will start when the table is ready. Your seat is saved on this device.</p><div className="local-waiting-room-crew">{room.roster.map(player => <div key={player.id}><PlayerAvatar player={player} /><span>{player.name}{player.id === ownSeatId ? ' · YOU' : ''}</span></div>)}</div><div className="local-waiting"><LoaderCircle size={17} className="spin" /> Waiting for the first flip…</div></section>}
    </>}


    {profileOpen && <MyProfileEditor onClose={() => setProfileOpen(false)} />}
    <AnimatePresence>{pickerOpen && <motion.div className="picker-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setPickerOpen(false); setEditingIndex(null) }}><CardPickerPanel submitting={busy} onClose={() => { setPickerOpen(false); setEditingIndex(null) }} onSelect={selectCard} /></motion.div>}{selectedCardIndex !== null && selectedPlayer?.round.entries[selectedCardIndex] && <motion.div className="picker-backdrop card-focus-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedCardIndex(null)}><CardActionsPanel card={selectedPlayer.round.entries[selectedCardIndex].card} cardVoided={selectedPlayer.round.entries[selectedCardIndex].voided} submitting={busy} onClose={() => setSelectedCardIndex(null)} onEdit={() => { setEditingIndex(selectedCardIndex); setSelectedCardIndex(null); setPickerOpen(true) }} onRemove={() => { void send({ type: 'player', playerId: ownSeatId, action: { type: 'remove', index: selectedCardIndex } }); setSelectedCardIndex(null) }} /></motion.div>}{pendingAction && <motion.div className="picker-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPendingAction(null)}><motion.section className="card-picker action-target-picker" onClick={event => event.stopPropagation()}><div className="picker-heading"><div><span>ACTION TARGET</span><h2>Who gets {pendingAction.label}?</h2></div><button className="close-button" aria-label="Close action target" onClick={() => setPendingAction(null)}><X size={19} /></button></div><p>Choose the player who receives this action card.</p><div className="target-list banker-target-list">{state?.players.filter(player => player.round.status === 'active').map(player => <button type="button" key={player.id} onClick={() => { void send({ type: 'record-action', sourcePlayerId: ownSeatId, targetPlayerId: player.id, card: pendingAction }); setPendingAction(null) }}>{player.name}</button>)}</div></motion.section></motion.div>}</AnimatePresence>
    {showMenu && <GuestGameMenu onClose={() => setShowMenu(false)} onPlayers={() => setShowPlayers(true)} onRules={() => setShowRules(true)} onExit={() => navigate('/landing')} />}
    <AnimatePresence>
      {showPlayers && <motion.div key="guest-players" className="picker-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={() => setShowPlayers(false)}><motion.section className="card-picker info-panel" initial={{ y: 80 }} animate={{ y: 0 }} exit={{ y: 80 }} onClick={event => event.stopPropagation()}><div className="picker-heading"><div><span>AT THIS TABLE</span><h2>Players</h2></div><div className="panel-heading-actions"><b className="panel-count">{state?.players.length ?? room?.roster.length ?? 0} players</b><button className="close-button" aria-label="Close players" onClick={() => setShowPlayers(false)}><X size={19} /></button></div></div><div className="info-list">{(state?.players ?? []).map(player => <button type="button" className={'info-player local-info-player' + (player.id === displayedId ? ' current-player' : '')} key={player.id} onClick={() => { setViewPlayerId(player.id); setShowPlayers(false) }}><PlayerAvatar player={player} className="mini-avatar" /><div><b>{player.name}{player.id === ownSeatId ? ' (you)' : ''}</b><small>{tabSummary(player)}</small></div><span className="info-player-scores"><span><small>ROUND</small><strong>{bankerPlayerDerived(player).score}</strong></span><span><small>TOTAL</small><strong>{player.totalScore}</strong></span></span></button>)}</div></motion.section></motion.div>}
      {showRules && <motion.div key="guest-rules" className="picker-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0, pointerEvents: 'none' }} onClick={() => setShowRules(false)}><motion.section className="card-picker info-panel" initial={{ y: 50 }} animate={{ y: 0 }} exit={{ y: 0 }} onClick={event => event.stopPropagation()}><div className="picker-heading"><div><span>BANKER MODE</span><h2>How it works</h2></div><button className="close-button" aria-label="Close rules" onClick={() => setShowRules(false)}><X size={19} /></button></div><div className="rules-copy"><section><h3>Follow the highlighted table</h3><p>After each card, play moves to the next active table. You can view everyone, but you can change only your own cards.</p></section><section><h3>Action cards</h3><p>Choose an active player to receive an action card. Freeze skips that table, Second Chance stays on its target, and Flip Three sends the next three cards there.</p></section><section><h3>Settle the round</h3><p>Bank when you want to keep your points. Busted and frozen tables are skipped. Seven unique number cards end the round immediately.</p></section></div></motion.section></motion.div>}
    </AnimatePresence>
  </main></div>
}
