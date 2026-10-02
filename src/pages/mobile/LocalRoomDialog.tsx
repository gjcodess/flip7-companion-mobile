import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Radio, Users, X } from 'lucide-react'
import QRCode from 'qrcode'
import { useLibrary } from '../../lib/room-store'
import { approveLocalJoin, denyLocalJoin, refreshLocalRoomRequests, revokeLocalSeat, startLocalRoom, stopLocalRoom, useLocalRoomSession } from '../../lib/local-room'
import './LocalRoom.css'

export function LocalRoomDialog({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const library = useLibrary()
  const room = library.rooms.find(item => item.id === roomId)
  const session = useLocalRoomSession()
  const sharing = session?.roomId === roomId
  const [qr, setQr] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  useEffect(() => { dialog.current?.showModal() }, [])
  useEffect(() => { if (sharing) void refreshLocalRoomRequests() }, [sharing])
  useEffect(() => {
    let active = true
    if (sharing && session?.joinUrl) void QRCode.toDataURL(session.joinUrl, { width: 320, margin: 1, color: { dark: '#132d67', light: '#ffffff' } }).then(image => { if (active) setQr(image) })
    return () => { active = false }
  }, [sharing, session?.joinUrl])
  const act = async (operation: () => Promise<unknown>) => {
    setBusy(true); setError('')
    try { await operation() } catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }
  const copy = async () => {
    if (!session) return
    try { await navigator.clipboard.writeText(session.joinUrl); setCopied(true) }
    catch { setError('Could not copy the address. Players can scan the QR code instead.') }
  }
  return <dialog ref={dialog} className="room-dialog tv-share-dialog local-share-dialog" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="room-dialog-heading"><div><span className="room-kicker">PLAY TOGETHER · OFFLINE</span><h2>Invite players</h2></div><button className="room-icon-button" aria-label="Close invites" onClick={onClose}><X size={20} /></button></div>
    <p>Connect everyone to the same Wi-Fi or your phone’s hotspot. Keep this app open while you play.</p>
    {sharing && session ? <><div className="tv-share-active"><span><Radio size={16} /> ROOM OPEN ON YOUR LOCAL NETWORK</span><p>Players can scan this QR, or enter the room code in their Android app:</p>{qr && <div className="local-share-qr"><img src={qr} alt="QR code to join this room" /></div>}<strong className="local-share-code">{session.code}</strong><p>If the code cannot find the host, use this full address:</p><code className="local-share-url">{session.joinUrl}</code><button type="button" onClick={() => void copy()}><Copy size={15} /> {copied ? 'Copied' : 'Copy address'}</button></div>
      <div className="local-share-requests"><h3>Join requests {session.requests.length ? `(${session.requests.length})` : ''}</h3>{session.requests.length ? session.requests.map(request => <div className="local-join-request" key={request.id}><span><b>{request.name}</b><small>Wants to play as {room?.roster.find(player => player.id === request.seatId)?.name ?? 'a removed player'}</small></span><button type="button" disabled={busy || !room?.roster.some(player => player.id === request.seatId)} aria-label={`Approve ${request.name}`} onClick={() => void act(() => approveLocalJoin(request))}><Check size={15} /> Approve</button><button type="button" disabled={busy} aria-label={`Decline ${request.name}`} onClick={() => void act(() => denyLocalJoin(request.id))}><X size={15} /></button></div>) : <p>No one is waiting. Players who scan the code will appear here.</p>}</div>
      <div className="local-share-claims"><h3>Player-controlled seats</h3>{session.claimedSeats.length ? session.claimedSeats.map(seatId => <div className="local-claimed-seat" key={seatId}><span>{room?.roster.find(player => player.id === seatId)?.name ?? 'Removed player'}</span><button type="button" disabled={busy} onClick={() => void act(() => revokeLocalSeat(seatId))}>Take back control</button></div>) : <p>All seats are controlled by this phone.</p>}</div>
      <button type="button" className="tv-share-stop" disabled={busy} onClick={() => void act(stopLocalRoom)}>Stop sharing this room</button>
    </> : <button type="button" className="room-button tv-share-start" disabled={busy || !room} onClick={() => room && void act(() => startLocalRoom(room))}><Users size={18} /> {busy ? 'Starting…' : 'Show invite QR code'}</button>}
    {session && !sharing && <p className="tv-share-switch">Opening this room will close invites for the other room.</p>}
    {error && <p className="room-error" role="alert">{error}</p>}
    <p className="tv-share-note">A player can edit only their claimed seat. You can edit every seat, including theirs, and take back control at any time.</p>
  </dialog>
}
