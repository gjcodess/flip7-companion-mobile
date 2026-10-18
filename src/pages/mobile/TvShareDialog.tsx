import { useState } from 'react'
import { Check, Copy, Monitor, Power, Radio, ShieldCheck } from 'lucide-react'
import { PlayerAvatar } from '../../components/PlayerAvatar'
import { useLibrary } from '../../lib/room-store'
import { startTvSharing, stopTvSharing, useTvSession } from '../../lib/tv-share'

export function TvSharePanel({ roomId }: { roomId: string }) {
  const library = useLibrary()
  const session = useTvSession()
  const room = library.rooms.find(item => item.id === roomId)
  const sharingThisRoom = session?.roomId === roomId
  const state = room?.edition === 'vengeance' ? room.vengeanceState : room?.state
  const previewPlayers = [...(state?.players ?? room?.roster.map(player => ({ ...player, totalScore: 0 })) ?? [])].sort((a, b) => b.totalScore - a.totalScore).slice(0, 3)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [copied, setCopied] = useState(false)

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
  return <section className="sharing-tv-panel" aria-label="TV scoreboard">
    <div className="sharing-section-heading"><span className="sharing-section-icon"><Monitor size={20} /></span><div><h3>{sharingThisRoom ? 'Your scoreboard is live.' : 'Give the game a big screen.'}</h3><p>{sharingThisRoom ? 'Let everyone follow every flip.' : 'Live scores. A view for the whole table.'}</p></div></div>
    {sharingThisRoom && session ? <div className="sharing-tv-live">
      <span className="sharing-live-label"><Radio size={15} /> LIVE ON YOUR NETWORK</span>
      <p>Open your TV’s web browser and enter:</p>
      <code>{session.url}</code>
      <button className="sharing-action secondary" onClick={copy}>{copied ? <Check size={17} /> : <Copy size={17} />}{copied ? 'Address copied' : 'Copy TV address'}</button>
      <span className="sharing-status-text" role="status">{copied ? 'TV address copied' : ''}</span>
    </div> : <>
      <figure className="sharing-tv-preview"><div className="sharing-tv-screen" aria-hidden="true"><header><img src={room?.edition === 'vengeance' ? '/assets/flip7-vengeance-logo.webp' : '/assets/flip7-title-logo.webp'} alt="" /><span>ROUND {String(state?.roundNumber ?? 1).padStart(2, '0')}</span></header><div className="sharing-tv-scores">{previewPlayers.map((player, index) => <div key={player.id}><span>{index + 1}</span><PlayerAvatar player={player} className="mini-avatar" /><b>{player.name}</b><strong>{player.totalScore}<small>PTS</small></strong></div>)}</div></div><span className="sharing-tv-stand" aria-hidden="true" /><figcaption>YOUR ROOM · ON THE BIG SCREEN</figcaption></figure>
      <ol className="sharing-steps"><li><span>1</span><p>Put your phone and TV on the <b>same network</b>.</p></li><li><span>2</span><p>Open the address in your <b>TV’s web browser</b>.</p></li></ol>
    </>}
    {session && !sharingThisRoom && <p className="sharing-tv-switch">The TV will switch from your other room to {room?.name}.</p>}
    {error && <p className="room-error" role="alert">{error}</p>}
    {sharingThisRoom ? <button type="button" className="sharing-action stop" disabled={busy} onClick={stop}><Power size={16} /> Stop TV sharing</button> : <button type="button" className="sharing-action primary" disabled={busy || !room} onClick={start}><Monitor size={18} /> {busy ? 'Starting…' : 'Show TV address'}</button>}
    <div className="sharing-tv-note sharing-host-note"><ShieldCheck size={18} /><p>{sharingThisRoom ? 'Keep the app open. If the network changes, restart TV sharing for a new address.' : 'The TV shows scores only. Cards stay on your phones. No internet needed.'}</p></div>
  </section>
}
