import { useEffect, useState } from 'react'
import { createRoot } from 'react-dom/client'
import type { TvSnapshot } from '../lib/tv-snapshot'
import './TvDisplay.css'

const preview: TvSnapshot = {
  roomId: 'preview', roomName: 'Friday game night', targetScore: 200, round: 5, phase: 'round', winnerIds: [],
  players: [
    { id: '1', name: 'Maron', color: '#ed4f7e', total: 85, roundScore: 5, status: 'frozen', isTurn: false, cards: [{ image: '/cards/5.webp', label: '5', voided: false }] },
    { id: '2', name: 'Glenn', color: '#57b8d7', total: 29, roundScore: 0, status: 'busted', isTurn: false, cards: [{ image: '/cards/7.webp', label: '7', voided: false }, { image: '/cards/7.webp', label: '7', voided: false }] },
    { id: '3', name: 'Vann', color: '#97c844', total: 114, roundScore: 16, status: 'active', isTurn: true, cards: [{ image: '/cards/5.webp', label: '5', voided: false }, { image: '/cards/11.webp', label: '11', voided: false }] },
  ],
}

function statusText(status: string) {
  return status === 'stayed' ? 'BANKED' : status === 'flip-seven' ? 'FLIP 7!' : status.toUpperCase()
}

function TvDisplay() {
  const previewMode = import.meta.env.DEV && new URLSearchParams(location.search).has('preview')
  const [snapshot, setSnapshot] = useState<TvSnapshot | null>(previewMode ? preview : null)
  const [connected, setConnected] = useState(previewMode)

  useEffect(() => {
    if (previewMode) return
    const token = location.pathname.split('/').filter(Boolean).pop()
    if (!token || token === 'tv.html') return
    let closed = false
    let socket: WebSocket | null = null
    let retry: number | undefined
    let socketConnected = false
    const readSnapshot = async () => {
      if (socketConnected || closed) return
      try {
        const response = await fetch(`/state/${encodeURIComponent(token)}`, { cache: 'no-store' })
        if (!response.ok) throw new Error('TV session unavailable')
        const next = await response.json() as TvSnapshot
        if (!socketConnected && !closed) { setSnapshot(next); setConnected(true) }
      } catch { if (!socketConnected && !closed) setConnected(false) }
    }
    const poll = window.setInterval(() => { void readSnapshot() }, 3000)
    void readSnapshot()
    const connect = () => {
      if (typeof WebSocket === 'undefined') return
      let current: WebSocket
      try { current = new WebSocket(`${location.protocol === 'https:' ? 'wss:' : 'ws:'}//${location.host}/live/${encodeURIComponent(token)}`) }
      catch { retry = window.setTimeout(connect, 3000); return }
      socket = current
      current.onopen = () => { socketConnected = true; setConnected(true) }
      current.onmessage = event => {
        try { setSnapshot(JSON.parse(event.data) as TvSnapshot) } catch { /* Ignore an invalid update and keep the last good scoreboard. */ }
      }
      current.onclose = () => { socketConnected = false; if (!closed) { setConnected(false); retry = window.setTimeout(connect, 1500) } }
      current.onerror = () => current.close()
    }
    connect()
    return () => { closed = true; window.clearTimeout(retry); window.clearInterval(poll); socket?.close() }
  }, [previewMode])

  return <div className="tv-shell">
    <header className="tv-header"><img src="/assets/flip7-title-logo.png" alt="Flip7 Companion" /><div className="tv-connection"><span className={connected ? 'online' : ''} />{connected ? 'LIVE FROM THE TABLE' : snapshot ? 'RECONNECTING…' : 'WAITING FOR THE TABLE'}</div></header>
    {snapshot ? <main className="tv-main">
      <section className="tv-hero"><div><span className="tv-kicker">{snapshot.phase === 'results' ? 'MATCH COMPLETE' : snapshot.phase === 'ready' ? 'READY TO PLAY' : 'GAME NIGHT LIVE'}</span><h1>{snapshot.roomName}</h1><p>{snapshot.players.length} players at the table</p></div><div className="tv-hero-stats"><span><small>ROUND</small><strong>{String(snapshot.round).padStart(2, '0')}</strong></span><span><small>FIRST TO</small><strong>{snapshot.targetScore}</strong></span></div></section>
      <div className="tv-section-heading"><div><span className="tv-kicker">AT THIS TABLE</span><h2>{snapshot.phase === 'results' ? 'Final standings' : 'Players & scores'}</h2></div><span className="tv-view-only">VIEW ONLY</span></div>
      <section className="tv-player-grid" aria-label="Live player scores">{snapshot.players.map(player => <article key={player.id} className={`tv-player tv-status-${player.status}${player.isTurn ? ' tv-current' : ''}${snapshot.winnerIds.includes(player.id) ? ' tv-winner' : ''}`}>
        <div className="tv-player-top"><span className="tv-avatar" style={{ background: player.color }}>{player.name.slice(0, 1).toUpperCase()}</span><div className="tv-player-identity"><h3>{player.name}</h3><span>{player.isTurn ? 'CURRENT TURN' : snapshot.winnerIds.includes(player.id) ? 'WINNER' : statusText(player.status)}</span></div></div>
        <div className="tv-player-scores"><div><small>ROUND</small><strong>{player.roundScore}</strong></div><div><small>TOTAL POINTS</small><strong>{player.total}</strong></div></div>
        <div className="tv-card-row" aria-label={`${player.cards.length} cards this round`}>{player.cards.slice(-6).map((card, index) => card.image && <img key={`${card.image}-${index}`} src={card.image} alt={card.label} className={card.voided ? 'voided' : ''} />)}{player.cards.length > 6 && <span>+{player.cards.length - 6}</span>}{player.cards.length === 0 && <span className="tv-no-cards">No cards yet</span>}</div>
      </article>)}</section>
    </main> : <main className="tv-waiting"><div className="tv-waiting-card"><span className="tv-kicker">LIVE TV SCOREBOARD</span><h1>Waiting for your table…</h1><p>Keep the game open on your phone. Scores will appear here as soon as the connection is ready.</p></div></main>}
    <footer className="tv-footer">FLIP7 COMPANION <span>·</span> THE PHONE CONTROLS THE GAME</footer>
  </div>
}

createRoot(document.getElementById('root')!).render(<TvDisplay />)
