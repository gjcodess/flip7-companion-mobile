import { useEffect, useRef, useState } from 'react'
import { Copy, Monitor, Radio, X } from 'lucide-react'
import { useLibrary } from '../../lib/room-store'
import { startTvSharing, stopTvSharing, useTvSession } from '../../lib/tv-share'

export function TvShareDialog({ roomId, onClose }: { roomId: string; onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const library = useLibrary()
  const session = useTvSession()
  const room = library.rooms.find(item => item.id === roomId)
  const sharingThisRoom = session?.roomId === roomId
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

  useEffect(() => { dialog.current?.showModal() }, [])

  const start = async () => {
    if (!room) return
    setBusy(true); setError('')
    try { await startTvSharing(room) }
    catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }
  const stop = async () => {
    setBusy(true); setError('')
    try { await stopTvSharing() }
    catch (failure) { setError((failure as Error).message) }
    finally { setBusy(false) }
  }
  const copy = async () => {
    if (!session) return
    try { await navigator.clipboard.writeText(session.url); setCopied(true) }
    catch { setError('Could not copy the address. You can type it on the TV instead.') }
  }
  return <dialog ref={dialog} className="room-dialog tv-share-dialog" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="room-dialog-heading"><div><span className="room-kicker">LIVE TV SCOREBOARD</span><h2>Show this room on TV</h2></div><button className="room-icon-button" aria-label="Close TV sharing" onClick={onClose}><X size={20} /></button></div>
    <p>Everyone can follow the scores. Only this phone controls the game.</p>
    {sharingThisRoom && session ? <div className="tv-share-active"><span><Radio size={16} /> SHARING ON YOUR LOCAL NETWORK</span><p>Open your TV’s web browser and enter this address:</p><code>{session.url}</code><button type="button" onClick={copy}><Copy size={15} /> {copied ? 'Copied' : 'Copy address'}</button></div> : <div className="tv-share-instructions"><Monitor size={33} /><p>Connect your phone and TV to the same local network, by Wi-Fi or Ethernet. Open the address in the TV’s web browser. Internet and mobile data are not needed.</p></div>}
    {session && !sharingThisRoom && <p className="tv-share-switch">Sharing another room will switch the TV to {room?.name}.</p>}
    {error && <p className="room-error" role="alert">{error}</p>}
    {sharingThisRoom ? <button type="button" className="tv-share-stop" disabled={busy} onClick={stop}>Stop TV sharing</button> : <button type="button" className="room-button tv-share-start" disabled={busy || !room} onClick={start}><Monitor size={18} /> {busy ? 'Starting…' : 'Show TV address'}</button>}
    <p className="tv-share-note">Keep the app open while the TV is watching. If your Wi-Fi changes, stop and start sharing again to get a new address.</p>
  </dialog>
}
