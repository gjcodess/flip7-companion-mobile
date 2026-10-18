import { useEffect, useId, useRef, useState } from 'react'
import { Cast, Check, CheckCircle2, ChevronRight, Clock3, Copy, Link2, Monitor, Power, QrCode, ShieldCheck, Users, Wifi, X } from 'lucide-react'
import { PlayerAvatar } from '../../components/PlayerAvatar'
import { getLibrary, saveRoom, useLibrary } from '../../lib/room-store'
import { decideSeat } from '../../lib/shared-room-protocol'
import { invitationText, localRoomsAvailable, startHosting, stopHosting, useHostedRoom } from '../../lib/shared-room'
import { useTvSession } from '../../lib/tv-share'
import { TvSharePanel } from './TvShareDialog'
import './SharedRooms.css'
import './SharingDialog.css'

export function RoomSharingButton({ roomId, onClick }: { roomId?: string; onClick: () => void }) {
  const library = useLibrary(), hosted = useHostedRoom(), tv = useTvSession()
  const room = library.rooms.find(item => item.id === roomId && !item.joinedCopy)
  const active = Boolean(roomId && (hosted?.roomId === roomId || tv?.roomId === roomId))
  const waiting = Object.values(room?.sharedHost?.grants ?? {}).filter(grant => grant.status === 'pending').length
  const label = `Share & connect${waiting ? `, ${waiting} seat request${waiting === 1 ? '' : 's'} waiting` : active ? ', sharing active' : ''}`
  return <button className={`brand-button cast-button ${active ? 'is-sharing' : ''}`} aria-label={label} title="Share & connect" onClick={onClick}><Cast size={20} />{waiting > 0 ? <span className="sharing-request-badge" aria-hidden="true">{waiting > 9 ? '9+' : waiting}</span> : active && <span className="sharing-status-dot connected" aria-hidden="true" />}<span className="sharing-status-text" role="status">{waiting ? `${waiting} seat requests waiting` : active ? 'Sharing active' : 'Sharing is off'}</span></button>
}

export function SharedRoomDialog({ roomId, onClose, initialView }: { roomId: string; onClose: () => void; initialView?: 'invite' | 'players' | 'tv' }) {
  const titleId = useId()
  const library = useLibrary(), hosted = useHostedRoom()
  const [busy, setBusy] = useState(false), [error, setError] = useState(''), [qr, setQr] = useState(''), [copied, setCopied] = useState(false)
  const [tab, setTab] = useState<'invite' | 'players' | 'tv'>(() => initialView ?? (hosted?.roomId === roomId && Object.values(library.rooms.find(item => item.id === roomId)?.sharedHost?.grants ?? {}).some(grant => grant.status === 'pending') ? 'players' : 'invite'))
  const dialog = useRef<HTMLDialogElement>(null), operating = useRef(false)
  const room = library.rooms.find(room => room.id === roomId && !room.joinedCopy)
  const active = Boolean(hosted && hosted.roomId === roomId)
  const grants = Object.entries(room?.sharedHost?.grants ?? {}).filter(([, grant]) => grant.status !== 'rejected').sort((a, b) => Number(b[1].status === 'pending') - Number(a[1].status === 'pending'))
  const waiting = grants.filter(([, grant]) => grant.status === 'pending').length
  const connected = grants.filter(([, grant]) => grant.status === 'approved').length
  useEffect(() => { dialog.current?.showModal() }, [])
  useEffect(() => {
    let cancelled = false
    setQr(''); setCopied(false)
    if (active && hosted) void import('qrcode').then(module => module.default.toDataURL(invitationText(hosted), { width: 720, margin: 4, errorCorrectionLevel: 'M', color: { dark: '#132d67', light: '#ffffff' } })).then(value => { if (!cancelled) setQr(value) }).catch(() => { if (!cancelled) setError('Could not display the QR code. Copy the invitation instead.') })
    return () => { cancelled = true }
  }, [active, hosted])
  if (!room) return null
  const change = async (operation: () => void | Promise<void>) => {
    if (operating.current) return
    operating.current = true; setBusy(true); setError('')
    try { await operation() } catch (error) { setError((error as Error).message) } finally { operating.current = false; setBusy(false) }
  }
  const currentRoom = () => {
    const current = getLibrary().rooms.find(r => r.id === room.id)
    if (!current) throw new Error('This room is no longer available.')
    return current
  }
  return <dialog ref={dialog} className={`room-dialog tv-share-dialog shared-room-dialog sharing-modal edition-${room.edition ?? 'classic'}`} aria-labelledby={titleId} onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <header className="sharing-modal-header">
      <div className="sharing-modal-heading">
        <span className="sharing-title-icon" aria-hidden="true"><Cast size={22} /></span>
        <div><span className="sharing-eyebrow">YOUR LOCAL ROOM</span><h2 id={titleId}>Share & connect</h2></div>
        <button className="room-icon-button" aria-label="Close sharing" onClick={onClose}><X size={20} /></button>
      </div>
      <div className="sharing-room-meta"><b>{room.name}</b><span>{room.edition === 'vengeance' ? 'Vengeance' : 'Classic'}{room.variant === 'brutal' ? ' · Brutal' : ''}</span></div>
      <div className="sharing-dialog-tabs" role="group" aria-label="Sharing options">
        <button aria-pressed={tab === 'invite'} onClick={() => setTab('invite')}><QrCode size={17} /><span>Invite</span></button>
        <button aria-pressed={tab === 'players'} disabled={!active} onClick={() => setTab('players')}><Users size={17} /><span>Players</span>{waiting > 0 && <b>{waiting}</b>}</button>
        <button aria-pressed={tab === 'tv'} onClick={() => setTab('tv')}><Monitor size={17} /><span>TV</span></button>
      </div>
    </header>
    <div className="sharing-modal-body">
      {!localRoomsAvailable() ? <p className="sharing-description">Room sharing is available in the Android app.</p> : tab === 'tv' ? <TvSharePanel roomId={roomId} /> : !active ? <>
        <div className="sharing-intro"><span className="sharing-hero-icon"><Users size={30} /></span><h3>One game. Every phone.</h3><p>Friends record their own cards.<br />You keep control of every table.</p></div>
        <ol className="sharing-steps"><li><span>1</span><p>Connect to the same <b>Wi-Fi or hotspot</b>.</p></li><li><span>2</span><p>Share your QR code and <b>approve each seat</b>.</p></li><li><span>3</span><p>Keep the room open. <b>Your phone is the host.</b></p></li></ol>
        <button className="sharing-action primary" disabled={busy || !room.state && !room.vengeanceState} onClick={() => void change(() => startHosting(currentRoom()))}><QrCode size={18} />{busy ? 'Starting…' : hosted ? 'Host this room instead' : 'Open room for friends'}</button>
        {!room.state && !room.vengeanceState && <p className="sharing-description">Start the game before inviting players.</p>}
      </> : tab === 'invite' ? <section aria-label="Invite friends">
        <div className="sharing-section-heading"><span className="sharing-section-icon"><QrCode size={20} /></span><div><h3>Pull up a seat.</h3><p>Ask your friends to scan this code.</p></div></div>
        <div className="sharing-qr-ticket">
          <div className="sharing-ticket-label"><Wifi size={15} /> SAME WI-FI OR HOTSPOT</div>
          {qr ? <img className="sharing-qr-image" src={qr} alt="Room invitation QR code" /> : <div className="sharing-qr-loading" role="status"><QrCode size={36} /><span>Preparing your invitation…</span></div>}
          <p>In their app, open <b>Join a nearby room</b>,<br />then scan and request a seat.</p>
        </div>
        <button className="sharing-action secondary" disabled={busy} onClick={() => void change(async () => { await navigator.clipboard.writeText(invitationText(hosted!)); setCopied(true) })}>{copied ? <Check size={18} /> : <Copy size={18} />}{copied ? 'Invitation copied' : 'Copy invitation'}</button>
        <span className="sharing-status-text" role="status">{copied ? 'Invitation copied' : ''}</span>
        {waiting > 0 && <button className="sharing-request-notice" onClick={() => setTab('players')}><Users size={17} /><span>{waiting} seat request{waiting === 1 ? '' : 's'} waiting</span><ChevronRight size={17} /></button>}
      </section> : <section aria-label="Seats and requests">
        <div className="sharing-section-heading"><span className="sharing-section-icon"><Users size={20} /></span><div><h3>Your players</h3><p>{!grants.length ? 'Waiting for your first player' : `${connected} seat${connected === 1 ? '' : 's'} approved${waiting ? ` · ${waiting} waiting for you` : ' · No pending requests'}`}</p></div></div>
        {!grants.length && <div className="sharing-empty"><span className="sharing-hero-icon"><Users size={28} /></span><h3>Save a seat for your friends.</h3><p>Share the invitation. Their seat requests will appear right here.</p><button className="sharing-action secondary" onClick={() => setTab('invite')}><QrCode size={17} /> Show room QR</button></div>}
        <div className="sharing-player-cards">{grants.map(([device, grant]) => {
          const player = room.roster.find(p => p.id === (grant.playerId ?? grant.requestedSeat))
          return <article className={`sharing-player-card ${grant.status}`} key={device}>
            <div className="sharing-player-top">{player && <PlayerAvatar player={player} className="mini-avatar" />}<div><strong>{grant.name}</strong><span><Link2 size={12} /> {player ? `${player.name}’s table` : 'Seat removed'}</span></div></div>
            <div className="sharing-player-bottom"><span className="sharing-player-status">{grant.status === 'approved' ? <CheckCircle2 size={14} /> : <Clock3 size={14} />}{grant.status === 'pending' ? 'Needs your approval' : 'Seat approved'}</span>{grant.status === 'approved' && <button className="sharing-release" disabled={busy} onClick={() => void change(() => saveRoom(decideSeat(currentRoom(), device, false)))}>Release seat</button>}</div>
            {grant.status === 'pending' && <div className="sharing-approval-actions"><button className="sharing-action secondary" disabled={busy} onClick={() => void change(() => saveRoom(decideSeat(currentRoom(), device, false)))}>Decline</button><button className="sharing-action primary" disabled={busy} onClick={() => void change(() => saveRoom(decideSeat(currentRoom(), device, true)))}><Check size={16} /> Approve</button></div>}
          </article>
        })}</div>
      </section>}
      {error && <p className="room-error" role="alert">{error}</p>}
    </div>
    {active && tab !== 'tv' && <footer className="sharing-modal-footer"><div className="sharing-host-note"><ShieldCheck size={18} /><p><b>You’re hosting this game.</b> Keep the room open so everyone can keep playing.</p></div><button className="sharing-action stop" disabled={busy} onClick={() => void change(async () => { await stopHosting(); setTab('invite') })}><Power size={16} /> Stop hosting</button></footer>}
  </dialog>
}
