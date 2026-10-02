import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, Check, LoaderCircle, Pencil, QrCode, Radio, WifiOff, X } from 'lucide-react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { AnimatePresence, motion } from 'motion/react'
import type { Card } from '../../game/cards'
import { bankerPlayerDerived, type BankerAction } from '../../game/bankerGame'
import { organizeDemoEntries } from '../../game/demoGame'
import { PlayerAvatar } from '../../components/PlayerAvatar'
import { CardArtwork } from '../../components/CardArtwork'
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
import './LocalRoom.css'

type StateResponse = { revision: number; room?: Room; claimedSeats?: string[]; credentialValid?: boolean }
type JoinResponse = { id: string; status: string; seatId: string; secret?: string }
const qrScanner = registerPlugin<{ scan(): Promise<{ text: string }> }>('QrScanner')
const pause = (time: number) => new Promise(resolve => window.setTimeout(resolve, time))

export function GuestRoomScreen({ inviteUrl }: { inviteUrl: string }) {
  const navigate = useAppNavigation()
  const profile = useMyProfile()
  const [address, setAddress] = useState(inviteUrl)
  const [url, setUrl] = useState(() => { try { return parseJoinUrl(inviteUrl) } catch { return '' } })
  const [credential, setCredential] = useState(() => { try { return findJoinedRoom(parseJoinUrl(inviteUrl)) ?? null } catch { return null } })
  const [snapshot, setSnapshot] = useState<StateResponse | null>(null)
  const [connected, setConnected] = useState(false)
  const [requestId, setRequestId] = useState('')
  const [seatChoice, setSeatChoice] = useState('')
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
            setNotice('The host took back control of your seat. Ask to join again if you want to play.')
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
            setCredential({ url, room: snapshot.room, seatId: response.seatId, secret: response.secret, savedAt: Date.now() })
            setViewPlayerId(response.seatId)
            setRequestId('')
            setNotice('You joined the table!')
            break
          }
          if (response.status === 'denied') { setRequestId(''); setError('The host did not approve this seat.'); break }
        } catch (failure) { if (active) setError((failure as Error).message) }
        await pause(1500)
      }
    }
    void waitForHost()
    return () => { active = false }
  }, [url, requestId, snapshot?.room?.id])

  const room = snapshot?.room ?? credential?.room ?? null
  const state = room?.state ?? null
  const ownSeatId = credential?.seatId ?? ''
  const displayedId = viewPlayerId || ownSeatId || room?.roster[0]?.id || ''
  const selectedPlayer = state?.players.find(player => player.id === displayedId) ?? null
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
    setRequestId('')
    setSeatChoice('')
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
        catch { setError('That QR code is not a Flip7 room invite. Scan the code in the host’s Invite players screen.') }
      }
    } catch (failure) {
      const message = (failure as Error).message || 'Could not scan the QR code.'
      if (!/cancel|dismiss/i.test(message)) setError(message)
    } finally { setBusy(false) }
  }
  const requestSeat = async () => {
    if (!url || !room || !seatChoice) return
    if (!profile.name.trim()) { setProfileOpen(true); return }
    setBusy(true); setError('')
    try {
      const next = await localRoomRequest<JoinResponse>(url, 'join', { name: profile.name, avatar: profile.avatar, color: profile.color, seatId: seatChoice })
      setRequestId(next.id)
      setNotice('Waiting for the host to approve your seat…')
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

  return <div className="app-shell banker-shell local-guest-shell"><main className="game-shell local-guest-main">
    <header className="local-guest-header"><button type="button" onClick={() => navigate('/landing')}><ArrowLeft size={18} /> My rooms</button><span><Radio size={15} /> LOCAL TABLE</span></header>
    {!url && <section className="local-guest-panel"><span className="room-kicker">JOIN A GAME NIGHT</span><h1>Join a room</h1><p>Connect to the same Wi-Fi or hotspot as the host. Scan their QR code, or enter the six-character code shown on their phone. A full address also works.</p>{Capacitor.getPlatform() === 'android' && <button type="button" className="local-scan-button" disabled={busy} onClick={() => void scanInvite()}><QrCode size={20} /> {busy ? 'Opening camera…' : 'Scan QR code'}</button>}<label className="room-field">ROOM CODE OR ADDRESS<input value={address} placeholder="ABC123 or http://192.168…/join/…" onChange={event => setAddress(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') void connect() }} /></label><button type="button" className="room-button" disabled={busy || !address.trim()} onClick={() => void connect()}>{busy ? 'Looking…' : 'Find room'}</button></section>}
    {url && <div className="local-guest-connection" role="status">{connected ? <><Radio size={16} /> Connected to host</> : <><WifiOff size={16} /> Reconnecting to host…</>}{Capacitor.getPlatform() === 'web' && /Android/i.test(navigator.userAgent) && <a href={`flip7://join?url=${encodeURIComponent(url)}`}>Open in Flip7 app</a>}</div>}
    {room && <><section className="local-guest-hero"><span className="room-kicker">{state?.phase === 'results' ? 'MATCH COMPLETE' : 'GAME NIGHT LIVE'}</span><h1>{room.name}</h1><p>{room.roster.length} players · Round {state?.roundNumber ?? 1} · First to {room.targetScore}</p></section>
      {!ownSeatId && <section className="local-guest-panel"><span className="room-kicker">YOUR SEAT</span><h2>Choose your player</h2><p>The host will approve your request. Seats without a phone stay under the host’s control.</p><button type="button" className="local-profile-row" onClick={() => setProfileOpen(true)}><PlayerAvatar player={{ ...profile, name: profile.name || 'Set my character' }} /><span><b>{profile.name || 'Set my character'}</b><small>Tap to edit your name and character</small></span><Pencil size={17} /></button><div className="local-seat-list">{room.roster.map(player => <button type="button" key={player.id} disabled={snapshot?.claimedSeats?.includes(player.id) || !!requestId} aria-pressed={seatChoice === player.id} onClick={() => setSeatChoice(player.id)}><PlayerAvatar player={player} /><span>{player.name}</span>{snapshot?.claimedSeats?.includes(player.id) ? <small>TAKEN</small> : seatChoice === player.id ? <Check size={17} /> : null}</button>)}</div>{requestId ? <p className="local-waiting"><LoaderCircle size={17} className="spin" /> Waiting for host approval…</p> : <button type="button" className="room-button" disabled={!seatChoice || busy || !connected} onClick={() => void requestSeat()}>Ask to join as {room.roster.find(player => player.id === seatChoice)?.name || 'a player'}</button>}</section>}
      {ownSeatId && <><section className="local-guest-table-heading"><div><span className="room-kicker">CURRENT TURN</span><h2>{state?.players.find(player => player.id === currentTurnId)?.name ?? 'Round complete'}</h2></div><span className="local-round-badge">ROUND {state?.roundNumber ?? 1}</span></section><div className="banker-player-strip local-guest-players">{(state?.players ?? []).map(player => <button type="button" key={player.id} className={`banker-player-tab opponent ${player.id === displayedId ? 'selected' : ''} ${player.id === currentTurnId ? 'turn' : ''} ${player.round.status}`} onClick={() => { setViewPlayerId(player.id); setSelectedCardIndex(null); setOrganized(false) }}><PlayerAvatar player={player} className="mini-avatar" /><span className="opponent-copy"><b>{player.name}{player.id === ownSeatId ? ' · YOU' : ''}</b><span>{player.round.status}</span></span><strong><small>Total pts:</small><b>{player.totalScore}</b></strong></button>)}</div>
        {selectedPlayer && state?.phase === 'round' && <><GameTable table={entries.map(item => item.entry.card)} tableCardIds={entries.map(item => item.entry.instanceId)} isVoidedCard={index => !!entries[index]?.entry.voided} score={derived?.score ?? 0} flipSevenBonus={derived?.flipSevenBonus ?? 0} busted={selectedPlayer.round.status === 'busted'} frozen={selectedPlayer.round.status === 'frozen'} submitting={busy} interactionLocked={!canCorrect || pickerOpen || selectedCardIndex !== null} canEditCards={canCorrect} canAddCards={canRecord} confirmedAt={selectedPlayer.round.status === 'active' ? null : 'banker'} isStaying={selectedPlayer.round.status === 'stayed'} isOrganized={organized} playerName={selectedPlayer.name} isHost={false} onOrganize={() => setOrganized(current => !current)} onOpenPicker={() => { setEditingIndex(null); setPickerOpen(true) }} onSelectCard={index => { if (!canCorrect) return; if (entries[index].entry.card.kind === 'action') { setNotice('Ask the host to correct an action card.'); return } setSelectedCardIndex(entries[index].index) }} /><GameControls isHost={false} allPlayersSettled={false} submitting={busy} canEditCards={canCorrect} canSettle={canRecord && state.forcedTurns.length === 0} canUseHistory={false} hasCardsOrRemoval={false} hasRedo={false} isStaying={selectedPlayer.round.status === 'stayed'} busted={selectedPlayer.round.status === 'busted'} frozen={selectedPlayer.round.status === 'frozen'} numberCardCount={derived?.numberCardCount ?? 0} playerStatus={selectedPlayer.round.status === 'flip-seven' ? 'stayed' : selectedPlayer.round.status} confirmedAt={selectedPlayer.round.status === 'active' ? null : 'banker'} onNextRound={() => {}} onUndo={() => {}} onRedo={() => {}} onStay={() => { void send({ type: 'settle-player', playerId: ownSeatId }) }} /></>}
        {state?.phase === 'results' && <section className="local-guest-panel"><span className="room-kicker">FINAL SCORES</span><h2>Game results</h2>{[...state.players].sort((a, b) => b.totalScore - a.totalScore).map(player => <div className="local-result-row" key={player.id}><PlayerAvatar player={player} /><b>{player.name}</b><strong>{player.totalScore} pts</strong></div>)}</section>}
        {state?.history.length ? <section className="local-guest-panel"><span className="room-kicker">SAVED ON THIS DEVICE</span><h2>Round history</h2>{state.history.map(round => <details className="local-round-history" key={round.round}><summary>Round {round.round}<span>{round.scores[ownSeatId] ?? 0} pts for you</span></summary>{Object.entries(round.scores).map(([id, score]) => <div className="local-round-player" key={id}><b>{round.hands?.[id]?.name ?? state.players.find(player => player.id === id)?.name ?? 'Player'}</b><span>{score} pts</span><div>{round.hands?.[id]?.entries.map(entry => <CardArtwork key={entry.instanceId} card={entry.card} lazy />)}</div></div>)}</details>)}</section> : null}</>}
    </>}
    {!connected && credential?.room && <p className="local-offline-note">Showing your last saved copy. Editing resumes when the host reconnects.</p>}
    {notice && <p className="room-success" role="status">{notice}</p>}{error && <p className="room-error" role="alert">{error}</p>}
    {profileOpen && <MyProfileEditor onClose={() => setProfileOpen(false)} />}
    <AnimatePresence>{pickerOpen && <motion.div className="picker-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => { setPickerOpen(false); setEditingIndex(null) }}><CardPickerPanel submitting={busy} onClose={() => { setPickerOpen(false); setEditingIndex(null) }} onSelect={selectCard} /></motion.div>}{selectedCardIndex !== null && selectedPlayer?.round.entries[selectedCardIndex] && <motion.div className="picker-backdrop card-focus-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setSelectedCardIndex(null)}><CardActionsPanel card={selectedPlayer.round.entries[selectedCardIndex].card} cardVoided={selectedPlayer.round.entries[selectedCardIndex].voided} submitting={busy} onClose={() => setSelectedCardIndex(null)} onEdit={() => { setEditingIndex(selectedCardIndex); setSelectedCardIndex(null); setPickerOpen(true) }} onRemove={() => { void send({ type: 'player', playerId: ownSeatId, action: { type: 'remove', index: selectedCardIndex } }); setSelectedCardIndex(null) }} /></motion.div>}{pendingAction && <motion.div className="picker-backdrop" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} onClick={() => setPendingAction(null)}><motion.section className="card-picker action-target-picker" onClick={event => event.stopPropagation()}><div className="picker-heading"><div><span>ACTION TARGET</span><h2>Who gets {pendingAction.label}?</h2></div><button className="close-button" aria-label="Close action target" onClick={() => setPendingAction(null)}><X size={19} /></button></div><p>Choose the player who receives this action card.</p><div className="target-list banker-target-list">{state?.players.filter(player => player.round.status === 'active').map(player => <button type="button" key={player.id} onClick={() => { void send({ type: 'record-action', sourcePlayerId: ownSeatId, targetPlayerId: player.id, card: pendingAction }); setPendingAction(null) }}>{player.name}</button>)}</div></motion.section></motion.div>}</AnimatePresence>
  </main></div>
}
