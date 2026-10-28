import { useCallback, useEffect, useRef, useState } from 'react'
import { Capacitor } from '@capacitor/core'
import { Clipboard } from '@capacitor/clipboard'
import jsQR from 'jsqr'
import { ArrowLeft, Camera, Check, ChevronDown, ChevronRight, ClipboardPaste, Clock3, PencilLine, QrCode, RefreshCw, Users, Wifi, X } from 'lucide-react'
import { PlayerAvatar } from '../../components/PlayerAvatar'
import { ConfirmationModal } from '../../components/ConfirmationModal'
import { isPlayerAvatarId } from '../../lib/player-avatars'
import { getLibrary, newProfile, savePlayerProfile, updateLibrary, useLibrary } from '../../lib/room-store'
import { useAppNavigation, useNavigationGuard } from '../../lib/navigation'
import { connectInvitation, formatRoomCode, invitationCode, localRoomsAvailable, normalizeRoomCode, parseInvitation, readJoinedSession, requestJoined, resolveInvitation, submitJoined } from '../../lib/shared-room'
import { type ParticipantCommand, type RoomReply } from '../../lib/shared-room-protocol'
import { PageArtwork } from './PageArtwork'
import { JoinedGameView } from './JoinedGameView'
import './SharedRooms.css'

function CameraScanner({ onRead, onClose }: { onRead: (value: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let stopped = false, stream: MediaStream | undefined, frame = 0, lastScan = 0
    const canvas = document.createElement('canvas')
    if (!navigator.mediaDevices?.getUserMedia) { setError('Camera unavailable. Enter the 6-character room code below.'); return }
    const tick = (time: number) => {
      if (stopped) return
      const element = video.current
      if (element?.readyState === 4 && time - lastScan > 160) {
        lastScan = time
        const scale = Math.min(1, 1000 / element.videoWidth)
        canvas.width = element.videoWidth * scale; canvas.height = element.videoHeight * scale
        const context = canvas.getContext('2d', { willReadFrequently: true })!
        context.drawImage(element, 0, 0, canvas.width, canvas.height)
        const pixels = context.getImageData(0, 0, canvas.width, canvas.height)
        const result = jsQR(pixels.data, pixels.width, pixels.height)
        if (result) { stopped = true; stream?.getTracks().forEach(track => track.stop()); onRead(result.data); return }
      }
      frame = requestAnimationFrame(tick)
    }
    void navigator.mediaDevices?.getUserMedia({ video: { facingMode: 'environment', width: { ideal: 1280 } }, audio: false }).then(async camera => {
      stream = camera
      if (stopped) { camera.getTracks().forEach(track => track.stop()); return }
      if (video.current) { video.current.srcObject = camera; await video.current.play(); frame = requestAnimationFrame(tick) }
    }).catch(() => setError('Camera unavailable. Allow camera access or enter the room code below.'))
    return () => { stopped = true; cancelAnimationFrame(frame); stream?.getTracks().forEach(track => track.stop()) }
  }, [onRead])
  return <div className="shared-scanner-box">
    <div className="shared-scanner-header">
      <span><Camera size={15} /> Center the host’s QR code in the frame</span>
      <button type="button" className="shared-scanner-close" onClick={onClose}><X size={15} /> Close</button>
    </div>
    <div className="shared-scanner-viewport">
      <video className="shared-scan-video" ref={video} playsInline muted aria-label="Room QR scanner" />
      <div className="shared-scanner-reticle" aria-hidden="true"><span /><span /><span /><span /><i /></div>
    </div>
    {error && <p className="shared-scanner-error" role="alert">{error}</p>}
  </div>
}

function SavedProfileDialog({ profiles, selectedId, onSelect, onClose }: {
  profiles: ReturnType<typeof getLibrary>['players']
  selectedId: string
  onSelect: (id: string) => void
  onClose: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])

  return <dialog ref={dialog} className="shared-profile-dialog" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }} aria-labelledby="shared-profile-dialog-title">
    <div className="shared-profile-dialog-header">
      <div><span>YOUR SAVED PROFILES</span><h2 id="shared-profile-dialog-title">Choose your profile</h2></div>
      <button type="button" className="shared-profile-dialog-close" aria-label="Close profile picker" onClick={onClose}><X size={19} /></button>
    </div>
    <p>Pick the profile you’ll use to join this room.</p>
    <div className="shared-profile-options">
      {profiles.map(player => <button key={player.id} type="button" className={`shared-profile-option ${selectedId === player.id ? 'is-selected' : ''}`} onClick={() => onSelect(player.id)}>
        <PlayerAvatar player={player} className="shared-profile-avatar" />
        <span>{player.name}</span>
        {selectedId === player.id && <Check size={19} aria-label="Selected" />}
      </button>)}
    </div>
  </dialog>
}

export function JoinedRoomScreen({ historyId }: { historyId?: string }) {
  const library = useLibrary(), navigate = useAppNavigation()
  const initialSession = useRef(readJoinedSession())
  const savedRoom = historyId ? library.rooms.find(room => room.id === historyId && room.joinedCopy) : undefined
  const [raw, setRaw] = useState(''), [code, setCode] = useState(''), [name, setName] = useState(''), [profile, setProfile] = useState(''), [seat, setSeat] = useState('')
  const [live, setLive] = useState(false), [busy, setBusy] = useState(false), [connecting, setConnecting] = useState(false), [online, setOnline] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [reply, setReply] = useState<RoomReply | null>(null), [scanner, setScanner] = useState(false)
  const [profilePicker, setProfilePicker] = useState(false)
  const [pendingAction, setPendingAction] = useState(Boolean(initialSession.current?.pending))
  const [deletePrompt, setDeletePrompt] = useState(false)
  const operation = useRef(false), pollBusy = useRef(false), mounted = useRef(true)
  const codeInput = useRef<HTMLInputElement>(null), nameInput = useRef<HTMLInputElement>(null)
  const lastGood = useRef(0)
  useEffect(() => { mounted.current = true; return () => { mounted.current = false } }, [])
  useNavigationGuard(live ? { title: 'Leave this room?', message: 'Your received history stays on this phone. Reconnect to continue; the host can record your hand while you are away.', confirmLabel: 'Leave room', cancelLabel: 'Stay', shouldBlock: () => true } : null)
  const acceptReply = useCallback((next: RoomReply) => {
    if (!mounted.current) return
    if (!next.ok) { setOnline(false); setError(next.error ?? 'The host could not accept this request.'); return }
    lastGood.current = Date.now(); setOnline(true); setReply(next); setError('')
  }, [])
  useEffect(() => {
    if (!live) return
    let cancelled = false
    const poll = async () => {
      if (operation.current || pollBusy.current || cancelled) return
      pollBusy.current = true
      try { const next = await requestJoined({ type: 'poll' }); if (!cancelled) acceptReply(next) }
      catch (error) { if (!cancelled) { setOnline(false); setError((error as Error).message) } }
      finally { pollBusy.current = false }
    }
    void poll()
    const timer = window.setInterval(() => { if (Date.now() - lastGood.current > 3500) setOnline(false); void poll() }, 900)
    return () => { cancelled = true; clearInterval(timer) }
  }, [live, acceptReply])

  const openInvitation = useCallback((invitation: ReturnType<typeof parseInvitation>) => {
    if (getLibrary().rooms.some(room => room.id === invitation.roomId && !room.joinedCopy)) throw new Error('You already own this room. Open it as host.')
    connectInvitation(invitation, profile || undefined)
    setLive(true); setOnline(false); setReply(null); setError(''); setNotice('')
  }, [profile])

  const readQR = useCallback((text: string) => {
    setScanner(false)
    try {
      const invitation = parseInvitation(text)
      setRaw(text)
      setCode(invitationCode(invitation))
      openInvitation(invitation)
    } catch (error) { setError((error as Error).message) }
  }, [openInvitation])

  const handleCodeInput = (value: string) => {
    const trimmed = value.trim()
    if (trimmed.startsWith('flip7-local:')) {
      try {
        const invitation = parseInvitation(trimmed)
        setRaw(trimmed)
        setCode(invitationCode(invitation))
        setError('')
        return
      } catch (error) {
        setError((error as Error).message)
        return
      }
    }
    const clean = normalizeRoomCode(value)
    setCode(clean)
    if (raw) setRaw('')
    if (error) setError('')
  }

  const pasteFromClipboard = async () => {
    try {
      const text = Capacitor.isNativePlatform()
        ? (await Clipboard.read()).value
        : await navigator.clipboard?.readText()
      if (!text?.trim()) {
        setError('Clipboard is empty. Copy a room code, then tap Paste code.')
        return
      }
      handleCodeInput(text)
      setError('')
      codeInput.current?.focus()
    } catch {
      codeInput.current?.focus()
      setError('Could not access the clipboard. Tap a code box and choose Paste from the keyboard menu.')
    }
  }

  const connect = async () => {
    if (connecting) return
    setConnecting(true); setError('')
    try {
      const source = raw || code
      const invitation = source ? await resolveInvitation(source) : readJoinedSession()?.invitation
      if (!invitation) throw new Error('Scan the QR code or enter the 6-character room code first.')
      openInvitation(invitation)
    } catch (error) { setError((error as Error).message) }
    finally { setConnecting(false) }
  }

  const reconnectSaved = () => {
    try {
      const invitation = readJoinedSession()?.invitation
      if (!invitation) throw new Error('Scan the QR code or enter the 6-character room code first.')
      openInvitation(invitation)
    } catch (error) { setError((error as Error).message) }
  }

  const claim = async () => {
    if (operation.current) return
    operation.current = true; setBusy(true); setError('')
    try {
      let profileId = profile
      const session = readJoinedSession()!
      // The host returns edition before approval; profiles remain local to their edition.
      const roomEdition = reply?.roomEdition ?? 'classic'
      if (!profileId) {
        if (!name.trim()) throw new Error('Enter your name or select a saved profile.')
        const profiles = roomEdition === 'vengeance' ? getLibrary().vengeancePlayers : getLibrary().players
        const existing = profiles.find(p => p.name.toLowerCase() === name.trim().toLowerCase())
        const player = existing ?? newProfile(name)
        if (!existing) savePlayerProfile(player, roomEdition)
        profileId = player.id; setProfile(profileId)
      }
      connectInvitation(session.invitation, profileId)
      const profiles = roomEdition === 'vengeance' ? getLibrary().vengeancePlayers : getLibrary().players
      const playerName = profiles.find(p => p.id === profileId)?.name ?? name
      acceptReply(await requestJoined({ type: 'claim', playerId: seat, name: playerName }))
    } catch (error) { setError((error as Error).message) }
    finally { operation.current = false; setBusy(false) }
  }
  const send = async (command?: ParticipantCommand) => {
    if (operation.current || !online) return
    operation.current = true; setBusy(true); setError('')
    try {
      const next = await submitJoined(command, reply?.revision)
      setPendingAction(false)
      if (!next.ok) { setError(next.error ?? 'Action rejected.'); const latest = await requestJoined({ type: 'poll' }); acceptReply(latest); setError(next.error ?? 'Action rejected. Review the current table.') }
      else acceptReply(next)
    } catch (error) { setPendingAction(Boolean(readJoinedSession()?.pending)); setOnline(false); setError((error as Error).message) }
    finally { operation.current = false; setBusy(false) }
  }
  const leaveSeat = async () => {
    if (operation.current || pendingAction) return
    operation.current = true; setBusy(true)
    try { acceptReply(await requestJoined({ type: 'leave' })); setNotice('Your seat is released. The match and your received history are kept.') }
    catch (error) { setError((error as Error).message) }
    finally { operation.current = false; setBusy(false) }
  }
  const room = live && reply?.room ? reply.room : savedRoom
  const owner = live ? reply?.playerId : savedRoom?.joinedCopy?.playerId
  const activeSession = readJoinedSession()
  const canReconnect = Boolean(activeSession && (!savedRoom || savedRoom.id === `joined-${activeSession.invitation.roomId}`))
  const profiles = reply?.roomEdition === 'vengeance' ? library.vengeancePlayers : library.players
  const selectedProfile = profiles.find(player => player.id === profile)
  const edition = room?.edition ?? reply?.roomEdition ?? library.settings.edition
  const canOpenRoom = Boolean(raw || code.length === 6)
  const removeCopy = () => {
    if (!savedRoom) return
    try { updateLibrary(current => ({ ...current, rooms: current.rooms.filter(r => r.id !== savedRoom.id) })); setDeletePrompt(false); navigate('/history') }
    catch (error) { setDeletePrompt(false); setError((error as Error).message) }
  }

  return <>
    {room && (!live || reply?.status === 'approved') ? <JoinedGameView key={room.id} room={room} owner={owner} live={live} online={online} busy={busy} pendingAction={pendingAction} approved={reply?.status === 'approved'} error={error} canReconnect={canReconnect} onSend={send} onReconnect={reconnectSaved} onRelease={leaveSeat} onExit={() => navigate('/landing')} onDelete={!live && savedRoom ? () => setDeletePrompt(true) : undefined} /> : <div className={`room-app-shell edition-${edition}`}><main className="room-app-main shared-join-page">
      <PageArtwork edition={edition} />
      <header className="shared-join-nav"><button className="shared-back" onClick={() => navigate('/landing')}><ArrowLeft size={18} /> Your rooms</button></header>
      <section className="room-welcome shared-join-heading"><span className="room-kicker">PLAY TOGETHER</span><h1>{live ? reply?.roomName ?? 'Connecting to room…' : <>Join a<br /><em>shared room.</em></>}</h1></section>
      {!live && <>
        <section className="shared-network-tip" aria-label="Connection method">
          <div className="shared-network-copy">
            <span className="shared-network-icon"><Wifi size={17} /></span>
            <div><span className="shared-network-label">CONNECTION METHOD</span><b>Same Wi-Fi or hotspot</b><p>Connect both phones to the same Wi-Fi network or phone hotspot.</p></div>
          </div>
        </section>
        {!localRoomsAvailable() ? <div className="shared-notice"><QrCode size={22} /><p>Open the Android app to join a room over Wi-Fi or hotspot. You can view saved history here.</p></div> : <section className="shared-join-card">
          <div className="shared-card-top">
            <div>
              <span className="shared-step-label">01 · FIND YOUR ROOM</span>
              <h2>Scan or enter code</h2>
            </div>
            <span className="shared-card-badge"><QrCode size={20} /></span>
          </div>

          {scanner ? <CameraScanner onRead={readQR} onClose={() => setScanner(false)} /> : <div className="shared-scan-grid">
            <button type="button" className="shared-action-tile scan-tile" onClick={() => setScanner(true)}>
              <span className="shared-tile-icon"><Camera size={22} /></span>
              <span className="shared-tile-copy">
                <b>Scan host QR code</b>
                <small>Point your camera at the code to join instantly.</small>
              </span>
            </button>
          </div>}

          <div className="shared-or-divider"><span>OR ENTER 6-CHARACTER CODE</span></div>

          <div className="shared-code-section">
            <div className="shared-code-header">
              <label htmlFor="shared-room-code-input">ROOM CODE</label>
              {code || raw ? <button type="button" className="shared-code-Action shared-code-clear" aria-label="Clear room code" onClick={() => { setCode(''); setRaw(''); setError(''); codeInput.current?.focus() }}><X size={14} /> Clear</button> : <button type="button" className="shared-code-Action shared-code-paste" onClick={() => void pasteFromClipboard()}><ClipboardPaste size={14} /> Paste code</button>}
            </div>

            <div className="shared-code-slots-wrap" onClick={() => codeInput.current?.focus()}>
              <input
                id="shared-room-code-input"
                ref={codeInput}
                className="shared-code-hidden-input"
                value={code}
                onChange={event => handleCodeInput(event.target.value)}
                onPaste={event => {
                  const text = event.clipboardData.getData('text')
                  if (text) { event.preventDefault(); handleCodeInput(text) }
                }}
                onKeyDown={event => { if (event.key === 'Enter' && canOpenRoom) void connect() }}
                maxLength={6}
                inputMode="text"
                autoCapitalize="characters"
                autoComplete="off"
                autoCorrect="off"
                spellCheck={false}
                aria-label="6-character room code"
                placeholder="A7K9M2"
              />
              <div className="shared-code-slots" aria-hidden="true">
                {Array.from({ length: 6 }, (_, index) => {
                  const char = code[index] ?? ''
                  const isActive = code.length === index || (code.length === 6 && index === 5)
                  return <span key={index} className={`shared-code-slot ${char ? 'filled' : ''} ${isActive ? 'active' : ''}`}>{char || '·'}</span>
                })}
              </div>
            </div>

            {raw && <div className="shared-scanned-invite"><Check size={16} /><span>QR invitation loaded ({formatRoomCode(code)})</span></div>}

            <button type="button" className="room-button shared-open-room-btn" disabled={!canOpenRoom || connecting} onClick={() => void connect()}>
              {connecting ? <><RefreshCw size={17} className="spin" /> Connecting…</> : <>Open room <ChevronRight size={17} /></>}
            </button>
          </div>
        </section>}
        {canReconnect && localRoomsAvailable() && <button className="shared-reconnect-card" onClick={reconnectSaved}><span className="shared-feature-icon"><RefreshCw size={21} /></span><span><b>Reconnect to room</b>{activeSession?.invitation && <small>Room code {formatRoomCode(invitationCode(activeSession.invitation))}</small>}</span><ChevronRight size={20} /></button>}
      </>}
      {live && !online && <section className="shared-waiting-card" role="status"><span className="shared-feature-icon"><RefreshCw size={27} className="spin" /></span><h2>Connecting to the host</h2><p>Check that both phones are on the same Wi-Fi or hotspot and that the host room is open.</p><button className="room-button secondary" onClick={() => { setLive(false); setScanner(false) }}>Use another code or QR</button></section>}
      {live && online && reply?.status === 'pending' && <section className="shared-waiting-card" role="status"><span className="shared-feature-icon"><Clock3 size={30} /></span><h2>Waiting for host approval</h2><p>{reply.seats?.find(player => player.id === seat)?.name ?? 'Your seat'}</p><div className="shared-waiting-dots" aria-hidden="true"><i /><i /><i /></div><button className="room-button secondary" disabled={busy || pendingAction} onClick={() => void leaveSeat()}>Cancel seat request</button></section>}
      {live && online && reply?.status !== 'approved' && reply?.status !== 'pending' && <section className="shared-join-card shared-claim-card">
        <div className="shared-card-top">
          <div>
            <span className="shared-step-label">02 · TAKE YOUR SEAT</span>
            <h2>Who’s playing?</h2>
          </div>
          <span className="shared-card-badge"><Users size={20} /></span>
        </div>

        {reply?.status === 'rejected' && <p className="shared-notice">Your request was declined or your seat was released. Check with the host before trying again.</p>}

        <div className="shared-identity-section">
          {profiles.length > 0 && <div className="shared-form-field">
            <span className="shared-field-label">YOUR SAVED PROFILE</span>
            <button type="button" className="shared-profile-trigger" aria-haspopup="dialog" onClick={() => setProfilePicker(true)}>
              {selectedProfile && <PlayerAvatar player={selectedProfile} className="shared-profile-avatar" />}
              <span>{selectedProfile?.name ?? 'Choose a saved profile'}</span>
              <ChevronDown size={17} aria-hidden="true" />
            </button>
            {selectedProfile && <button type="button" className="shared-use-display-name" onClick={() => { setProfile(''); setName(''); window.requestAnimationFrame(() => nameInput.current?.focus()) }}><PencilLine size={15} /> Enter a different name</button>}
          </div>}

          {!profile && <div className="shared-form-field">
            <label className="shared-field-label" htmlFor="shared-name-input">YOUR DISPLAY NAME</label>
            <input
              id="shared-name-input"
              ref={nameInput}
              value={name}
              maxLength={24}
              placeholder="What should we call you?"
              onChange={event => setName(event.target.value)}
              autoComplete="name"
            />
          </div>}
        </div>

        <div className="shared-seat-section-header">
          <div className="shared-seat-title-group">
            <h3>Choose your seat</h3>
            <p>Pick your spot at the table</p>
          </div>
          <span className="shared-seat-count-badge">
            {reply?.seats?.filter(player => !player.occupied).length ?? 0} available
          </span>
        </div>

        <div className="shared-seat-grid">
          {reply?.seats?.map((player, index) => {
            const isSelected = seat === player.id
            const isOccupied = player.occupied
            return (
              <button
                key={player.id}
                type="button"
                className={`shared-seat-card ${isSelected ? 'is-selected' : ''} ${isOccupied ? 'is-occupied' : ''}`}
                aria-pressed={isSelected}
                disabled={isOccupied || busy}
                onClick={() => {
                  setSeat(player.id)
                  if (!name.trim() && !profile) setName(player.name)
                }}
              >
                <div className="shared-seat-avatar-wrap">
                  <PlayerAvatar
                    player={{
                      ...player,
                      avatar: isPlayerAvatarId(player.avatar) ? player.avatar : undefined,
                      color: player.color || ['#ed4f7e', '#57b8d7', '#ffe05c', '#97c844'][index % 4]
                    }}
                    className="shared-seat-avatar"
                  />
                </div>
                <div className="shared-seat-info">
                  <b className="shared-seat-name">{player.name}</b>
                  <span className={`shared-seat-status ${isOccupied ? 'status-occupied' : isSelected ? 'status-selected' : 'status-available'}`}>
                    {isOccupied ? 'Seat taken' : isSelected ? 'Selected' : 'Available'}
                  </span>
                </div>
                {isSelected && (
                  <span className="shared-seat-check-badge" aria-hidden="true">
                    <Check size={13} strokeWidth={3} />
                  </span>
                )}
              </button>
            )
          })}
        </div>

        <button
          type="button"
          className="room-button shared-claim-button"
          disabled={!seat || busy || (!profile && !name.trim()) || Boolean(reply?.seats?.find(player => player.id === seat)?.occupied)}
          onClick={() => void claim()}
        >
          {busy ? <><RefreshCw size={17} className="spin" /> Requesting seat…</> : <>Request this seat <ChevronRight size={17} /></>}
        </button>
      </section>}
      {notice && <p className="shared-notice" role="status">{notice}</p>}{error && <p className="room-error" role="alert">{error}</p>}
    </main></div>}
    {profilePicker && <SavedProfileDialog profiles={profiles} selectedId={profile} onSelect={id => { setProfile(id); setProfilePicker(false) }} onClose={() => setProfilePicker(false)} />}
    {deletePrompt && savedRoom && <ConfirmationModal eyebrow="REMOVE JOINED HISTORY" title="Remove this history copy?" message="Only the copy on this phone is removed. Lifetime statistics stay. Export a backup first to keep the detailed cards and scores." cancelLabel="Keep history" confirmLabel="Remove copy" onCancel={() => setDeletePrompt(false)} onConfirm={removeCopy} />}
  </>
}
