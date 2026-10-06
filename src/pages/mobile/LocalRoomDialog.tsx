import { useEffect, useRef, useState } from 'react'
import { Check, Copy, Radio, Users, X } from 'lucide-react'
import QRCode from 'qrcode'
import { useLibrary } from '../../lib/room-store'
import { PlayerAvatar } from '../../components/PlayerAvatar'
import { approveLocalJoin, denyLocalJoin, refreshLocalRoomRequests, revokeLocalSeat, startLocalRoom, stopLocalRoom, useLocalRoomSession } from '../../lib/local-room'
import type { PlayerAvatarId } from '../../lib/player-avatars'
import './LocalRoom.css'

export function LocalRoomDialog({ roomId, onClose, autoStart = false }: { roomId: string; onClose: () => void; autoStart?: boolean }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const library = useLibrary()
  const room = library.rooms.find(item => item.id === roomId)
  const session = useLocalRoomSession()
  const sharing = session?.roomId === roomId
  const [qr, setQr] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)
  const [showUrl, setShowUrl] = useState(false)

  useEffect(() => { dialog.current?.showModal() }, [])
  useEffect(() => { if (sharing) void refreshLocalRoomRequests() }, [sharing])
  useEffect(() => {
    let active = true
    if (sharing && session?.joinUrl) {
      void QRCode.toDataURL(session.joinUrl, {
        width: 360,
        margin: 1,
        color: { dark: '#132d67', light: '#ffffff' }
      }).then(image => {
        if (active) setQr(image)
      })
    }
    return () => { active = false }
  }, [sharing, session?.joinUrl])

  const act = async (operation: () => Promise<unknown>) => {
    setBusy(true)
    setError('')
    try { await operation() }
    catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }

  useEffect(() => {
    if (!autoStart || !room || sharing) return
    setBusy(true)
    void startLocalRoom(room).catch(failure => setError((failure as Error).message)).finally(() => setBusy(false))
  }, [autoStart, room?.id])

  const copy = async () => {
    if (!session) return
    try {
      await navigator.clipboard.writeText(session.joinUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2200)
    } catch {
      setError('Could not copy the address.')
    }
  }

  const claimedPlayers = (session?.claimedSeats ?? [])
    .map(seatId => room?.roster.find(p => p.id === seatId))
    .filter((p): p is import('../../lib/room-store').PlayerProfile => Boolean(p))

  return (
    <dialog
      ref={dialog}
      className="room-dialog local-share-dialog"
      onCancel={onClose}
      onClick={event => { if (event.target === event.currentTarget) onClose() }}
    >
      <div className="room-dialog-heading">
        <div>
          <span className="room-kicker">LOCAL MULTIPLAYER</span>
          <h2>Invite players</h2>
        </div>
        <button className="room-icon-button" aria-label="Close invites" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <p className="local-dialog-subtitle">Connect everyone to the same Wi-Fi or hotspot.</p>

      {sharing && session ? (
        <>
          {session.requests.length > 0 && (
            <div className="local-requests-panel">
              <div className="local-requests-header">
                <span>Join requests</span>
                <span className="local-requests-count">{session.requests.length}</span>
              </div>
              <div className="local-requests-list">
                {session.requests.map(request => (
                  <div className="local-join-request-row" key={request.id}>
                    <PlayerAvatar player={{ name: request.name, color: request.color, avatar: request.avatar as PlayerAvatarId }} />
                    <div className="local-join-request-info">
                      <b>{request.name}</b>
                      <small>{room?.state ? 'Joins next round' : 'Ready to join'}</small>
                    </div>
                    <div className="local-join-actions">
                      <button
                        type="button"
                        className="local-action-accept"
                        disabled={busy || !room || room.roster.length + (room.pendingPlayers?.length ?? 0) >= 18 || room.state?.phase === 'results'}
                        aria-label={`Accept ${request.name}`}
                        onClick={() => void act(() => approveLocalJoin(request))}
                      >
                        <Check size={14} /> Accept
                      </button>
                      <button
                        type="button"
                        className="local-action-decline"
                        disabled={busy}
                        aria-label={`Decline ${request.name}`}
                        onClick={() => void act(() => denyLocalJoin(request.id))}
                      >
                        <X size={14} />
                      </button>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}

          <div className="local-invite-card">
            <div className="local-card-badge">
              <span className="local-card-dot" />
              <span>Room open on Wi-Fi</span>
            </div>

            {qr && (
              <div className="local-qr-frame">
                <img src={qr} alt="Scan QR code to join this room" />
              </div>
            )}

            <div className="local-code-display">
              <span className="local-code-kicker">ROOM CODE</span>
              <strong className="local-code-digits">{session.code}</strong>
            </div>

            <div className="local-invite-actions">
              <button type="button" className="local-copy-button" onClick={() => void copy()}>
                {copied ? <Check size={16} /> : <Copy size={16} />}
                <span>{copied ? 'Address copied!' : 'Copy join address'}</span>
              </button>
              <button
                type="button"
                className="local-toggle-url-button"
                onClick={() => setShowUrl(v => !v)}
              >
                {showUrl ? 'Hide full address' : 'Show full address'}
              </button>
              {showUrl && <code className="local-url-preview">{session.joinUrl}</code>}
            </div>
          </div>

          {claimedPlayers.length > 0 && (
            <div className="local-seats-block">
              <div className="local-seats-title">
                <Users size={13} />
                <span>Connected players ({claimedPlayers.length})</span>
              </div>
              <div className="local-seats-list">
                {claimedPlayers.map(player => (
                  <div className="local-seat-card" key={player.id}>
                    <PlayerAvatar player={player} />
                    <b>{player.name}</b>
                    <span className="local-seat-pill">Connected</span>
                    <button
                      type="button"
                      className="local-disconnect-btn"
                      disabled={busy}
                      aria-label={`${room?.state ? 'Disconnect' : 'Remove'} ${player.name}`}
                      onClick={() => void act(() => revokeLocalSeat(player.id))}
                    >
                      {room?.state ? 'Disconnect' : 'Remove'}
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {room?.pendingPlayers && room.pendingPlayers.length > 0 && (
            <div className="local-seats-block">
              <div className="local-seats-title">
                <Users size={13} />
                <span>Joining next round ({room.pendingPlayers.length})</span>
              </div>
              <div className="local-seats-list">
                {room.pendingPlayers.map(player => (
                  <div className="local-seat-card" key={player.id}>
                    <PlayerAvatar player={player} />
                    <b>{player.name}</b>
                    <span className="local-seat-pill pending">Waiting</span>
                    <button
                      type="button"
                      className="local-disconnect-btn"
                      disabled={busy}
                      onClick={() => void act(() => revokeLocalSeat(player.id))}
                    >
                      Remove
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          <button
            type="button"
            className="local-stop-host-btn"
            disabled={busy}
            onClick={() => void act(stopLocalRoom)}
          >
            Stop sharing room
          </button>
        </>
      ) : (
        <div className="local-start-host-box">
          <div className="local-start-host-icon">
            <Radio size={28} />
          </div>
          <h3>Host this table</h3>
          <p>Let nearby friends join and play from their own devices on the same Wi-Fi.</p>
          <button
            type="button"
            className="room-button"
            disabled={busy || !room}
            onClick={() => room && void act(() => startLocalRoom(room))}
          >
            <Radio size={16} /> {busy ? 'Starting…' : 'Start sharing room'}
          </button>
        </div>
      )}

      {session && !sharing && (
        <p className="tv-share-switch">Opening this room will close invites for the other room.</p>
      )}
      {error && <p className="room-error" role="alert">{error}</p>}
    </dialog>
  )
}

