import { useCallback, useEffect, useRef, useState } from 'react'
import jsQR from 'jsqr'
import { ArrowLeft, Camera, Check, ChevronRight, ClipboardPaste, Clock3, ImagePlus, QrCode, RefreshCw, Users, Wifi, X } from 'lucide-react'
import { PlayerAvatar } from '../../components/PlayerAvatar'
import { ConfirmationModal } from '../../components/ConfirmationModal'
import { getLibrary, newProfile, savePlayerProfile, updateLibrary, useLibrary } from '../../lib/room-store'
import { useAppNavigation, useNavigationGuard } from '../../lib/navigation'
import { connectInvitation, formatRoomCode, invitationCode, localRoomsAvailable, normalizeRoomCode, parseInvitation, readJoinedSession, requestJoined, resolveInvitation, submitJoined } from '../../lib/shared-room'
import { type ParticipantCommand, type RoomReply } from '../../lib/shared-room-protocol'
import { JoinedGameView } from './JoinedGameView'
import './SharedRooms.css'

function CameraScanner({ onRead, onClose }: { onRead: (value: string) => void; onClose: () => void }) {
  const video = useRef<HTMLVideoElement>(null)
  const [error, setError] = useState('')
  useEffect(() => {
    let stopped = false, stream: MediaStream | undefined, frame = 0, lastScan = 0
    const canvas = document.createElement('canvas')
    if (!navigator.mediaDevices?.getUserMedia) { setError('Camera unavailable. Upload a QR photo or enter the 6-character code below.'); return }
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
    }).catch(() => setError('Camera unavailable. Allow camera access, upload a QR photo, or enter the room code.'))
    return () => { stopped = true; cancelAnimationFrame(frame); stream?.getTracks().forEach(track => track.stop()) }
  }, [onRead])
  return <div className="shared-scanner-box">
    <div className="shared-scanner-header">
      <span><Camera size={15} /> Point camera at host’s QR</span>
      <button type="button" className="shared-scanner-close" onClick={onClose}><X size={15} /> Close</button>
    </div>
    <div className="shared-scanner-viewport">
      <video className="shared-scan-video" ref={video} playsInline muted aria-label="Room QR scanner" />
      <div className="shared-scanner-reticle" aria-hidden="true"><span /><span /><span /><span /></div>
    </div>
    {error && <p className="shared-scanner-error" role="alert">{error}</p>}
  </div>
}

export function JoinedRoomScreen({ historyId }: { historyId?: string }) {
  const library = useLibrary(), navigate = useAppNavigation()
  const initialSession = useRef(readJoinedSession())
  const savedRoom = historyId ? library.rooms.find(room => room.id === historyId && room.joinedCopy) : undefined
  const [raw, setRaw] = useState(''), [code, setCode] = useState(''), [name, setName] = useState(''), [profile, setProfile] = useState(''), [seat, setSeat] = useState('')
  const [live, setLive] = useState(false), [busy, setBusy] = useState(false), [connecting, setConnecting] = useState(false), [online, setOnline] = useState(false), [error, setError] = useState(''), [notice, setNotice] = useState('')
  const [reply, setReply] = useState<RoomReply | null>(null), [scanner, setScanner] = useState(false)
  const [pendingAction, setPendingAction] = useState(Boolean(initialSession.current?.pending))
  const [deletePrompt, setDeletePrompt] = useState(false)
  const operation = useRef(false), pollBusy = useRef(false), mounted = useRef(true)
  const file = useRef<HTMLInputElement>(null), codeInput = useRef<HTMLInputElement>(null)
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

  const readPhoto = async (image?: File) => {
    if (!image) return
    let bitmap: ImageBitmap | undefined
    try {
      bitmap = await createImageBitmap(image)
      const scale = Math.min(1, 1800 / Math.max(bitmap.width, bitmap.height)), canvas = document.createElement('canvas')
      canvas.width = bitmap.width * scale; canvas.height = bitmap.height * scale
      const context = canvas.getContext('2d', { willReadFrequently: true })!; context.drawImage(bitmap, 0, 0, canvas.width, canvas.height)
      const data = context.getImageData(0, 0, canvas.width, canvas.height), result = jsQR(data.data, data.width, data.height)
      if (!result) throw new Error('No QR code found in that image. Try a clearer photo or enter the 6-character code.')
      readQR(result.data)
    } catch (error) { setError((error as Error).message) }
    finally { bitmap?.close(); if (file.current) file.current.value = '' }
  }

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
      const text = (await navigator.clipboard.readText()).trim()
      if (!text) throw new Error('Clipboard is empty.')
      handleCodeInput(text)
      codeInput.current?.focus()
    } catch {
      codeInput.current?.focus()
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
  const edition = room?.edition ?? reply?.roomEdition ?? library.settings.edition
  const canOpenRoom = Boolean(raw || code.length === 6)
  const removeCopy = () => {
    if (!savedRoom) return
    try { updateLibrary(current => ({ ...current, rooms: current.rooms.filter(r => r.id !== savedRoom.id) })); setDeletePrompt(false); navigate('/history') }
    catch (error) { setDeletePrompt(false); setError((error as Error).message) }
  }

  return <>
    {room && (!live || reply?.status === 'approved') ? <JoinedGameView key={room.id} room={room} owner={owner} live={live} online={online} busy={busy} pendingAction={pendingAction} approved={reply?.status === 'approved'} error={error} canReconnect={canReconnect} onSend={send} onReconnect={reconnectSaved} onRelease={leaveSeat} onExit={() => navigate('/landing')} onDelete={!live && savedRoom ? () => setDeletePrompt(true) : undefined} /> : <div className={`room-app-shell edition-${edition}`}><main className="room-app-main shared-join-page">
      <header className="shared-join-nav"><button className="shared-back" onClick={() => navigate('/landing')}><ArrowLeft size={18} /> Your rooms</button><img src={edition === 'vengeance' ? '/assets/flip7-vengeance-logo.webp' : '/assets/flip7-title-logo.webp'} alt="Flip 7" /></header>
      <section className="room-welcome shared-join-heading"><span className="room-kicker">PLAY TOGETHER</span><h1>{live ? reply?.roomName ?? 'Finding your room…' : <>Join a<br /><em>nearby room.</em></>}</h1></section>
      {!live && <>
        <div className="shared-network-tip"><Wifi size={20} /><div><b>Same Wi-Fi or hotspot as the host</b></div></div>
        {!localRoomsAvailable() ? <div className="shared-notice"><QrCode size={22} /><p>Open the Android app to join a nearby room. You can view saved history here.</p></div> : <section className="shared-join-card">
          <div className="shared-card-top">
            <div>
              <span className="shared-step-label">01 · FIND YOUR ROOM</span>
              <h2>Scan or enter code</h2>
            </div>
            <span className="shared-card-badge"><QrCode size={20} /></span>
          </div>

          <input hidden ref={file} type="file" accept="image/*" onChange={event => void readPhoto(event.target.files?.[0])} />

          {scanner ? <CameraScanner onRead={readQR} onClose={() => setScanner(false)} /> : <div className="shared-scan-grid">
            <button type="button" className="shared-action-tile scan-tile" onClick={() => setScanner(true)}>
              <span className="shared-tile-icon"><Camera size={22} /></span>
              <span className="shared-tile-copy">
                <b>Scan QR code</b>
                <small>Use your camera</small>
              </span>
            </button>
            <button type="button" className="shared-action-tile upload-tile" onClick={() => file.current?.click()}>
              <span className="shared-tile-icon"><ImagePlus size={22} /></span>
              <span className="shared-tile-copy">
                <b>Upload QR photo</b>
                <small>From your gallery</small>
              </span>
            </button>
          </div>}

          <div className="shared-or-divider"><span>OR ENTER 6-CHARACTER CODE</span></div>

          <div className="shared-code-section">
            <div className="shared-code-header">
              <label htmlFor="shared-room-code-input">ROOM CODE</label>
              {code || raw ? <button type="button" className="shared-code-Action" onClick={() => { setCode(''); setRaw(''); codeInput.current?.focus() }}><X size={13} /> Clear</button> : <button type="button" className="shared-code-Action" onClick={() => void pasteFromClipboard()}><ClipboardPaste size={13} /> Paste</button>}
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
              {connecting ? <><RefreshCw size={17} className="spin" /> Finding room…</> : <>Open room <ChevronRight size={17} /></>}
            </button>
          </div>
        </section>}
        {canReconnect && localRoomsAvailable() && <button className="shared-reconnect-card" onClick={reconnectSaved}><span className="shared-feature-icon"><RefreshCw size={21} /></span><span><b>Reconnect to room</b>{activeSession?.invitation && <small>Room code {formatRoomCode(invitationCode(activeSession.invitation))}</small>}</span><ChevronRight size={20} /></button>}
      </>}
      {live && !online && <section className="shared-waiting-card" role="status"><span className="shared-feature-icon"><RefreshCw size={27} className="spin" /></span><h2>Connecting to the host</h2><p>Check that both phones are on the same Wi-Fi or hotspot.</p><button className="room-button secondary" onClick={() => { setLive(false); setScanner(false) }}>Use another code or QR</button></section>}
      {live && online && reply?.status === 'pending' && <section className="shared-waiting-card" role="status"><span className="shared-feature-icon"><Clock3 size={30} /></span><h2>Waiting for host approval</h2><p>{reply.seats?.find(player => player.id === seat)?.name ?? 'Your seat'}</p><div className="shared-waiting-dots" aria-hidden="true"><i /><i /><i /></div><button className="room-button secondary" disabled={busy || pendingAction} onClick={() => void leaveSeat()}>Cancel seat request</button></section>}
      {live && online && reply?.status !== 'approved' && reply?.status !== 'pending' && <section className="shared-join-card shared-claim-card">
        <span className="shared-step-label">02 · TAKE YOUR SEAT</span><h2>Who’s playing?</h2>
        {reply?.status === 'rejected' && <p className="shared-notice">Your request was declined or your seat was released. Check with the host before trying again.</p>}
        <label className="room-field">YOUR SAVED PROFILE<select value={profile} onChange={event => setProfile(event.target.value)}><option value="">Use my name</option>{profiles.map(player => <option key={player.id} value={player.id}>{player.name}</option>)}</select></label>
        {!profile && <label className="room-field">YOUR NAME<input value={name} maxLength={24} placeholder="What should we call you?" onChange={event => setName(event.target.value)} /></label>}
        <div className="shared-seat-heading"><Users size={17} /><h3>Choose your table</h3><span>{reply?.seats?.filter(player => !player.occupied).length ?? 0} available</span></div>
        <div className="shared-seat-grid">{reply?.seats?.map((player, index) => <button key={player.id} aria-pressed={seat === player.id} disabled={player.occupied || busy} onClick={() => setSeat(player.id)}><PlayerAvatar player={{ ...player, color: ['#ed4f7e', '#57b8d7', '#ffe05c', '#97c844'][index % 4] }} className="mini-avatar" /><span><b>{player.name}</b><small>{player.occupied ? 'Seat taken' : 'Available'}</small></span>{seat === player.id && <Check size={18} />}</button>)}</div>
        <button className="room-button" disabled={!seat || busy || !profile && !name.trim() || Boolean(reply?.seats?.find(player => player.id === seat)?.occupied)} onClick={() => void claim()}>{busy ? 'Requesting…' : 'Request this seat'} <ChevronRight size={17} /></button>
      </section>}
      {notice && <p className="shared-notice" role="status">{notice}</p>}{error && <p className="room-error" role="alert">{error}</p>}
    </main></div>}
    {deletePrompt && savedRoom && <ConfirmationModal eyebrow="REMOVE JOINED HISTORY" title="Remove this history copy?" message="Only the copy on this phone is removed. Lifetime statistics stay. Export a backup first to keep the detailed cards and scores." cancelLabel="Keep history" confirmLabel="Remove copy" onCancel={() => setDeletePrompt(false)} onConfirm={removeCopy} />}
  </>
}
