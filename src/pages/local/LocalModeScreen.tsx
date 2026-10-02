import { ClipboardList, Eye, LogOut } from 'lucide-react'
import { useAppNavigation } from '../../lib/navigation'

export function LocalModeScreen() {
  const navigate = useAppNavigation()

  return <div className="app-shell local-shell">
    <aside className="desktop-marquee left"><div>FLIP<br />7</div></aside>
    <main className="game-shell local-main">
      <header className="topbar"><button className="brand-button" aria-label="Go to landing page" onClick={() => navigate('/')}><img className="brand-logo" src="/assets/flip7-title-logo.webp" alt="Flip 7" /></button><span className="topbar-caption">OFFLINE GAME · LOCAL ONLY</span><button className="account-pill exit-button" aria-label="Return to landing page" onClick={() => navigate('/')}><LogOut size={15} /> Exit</button></header>
      <section className="auth-hero"><span className="eyebrow">CARNIVAL TABLE</span><h1>Track the cards<br />you actually flip.</h1><p>Use your physical deck. Choose a local mode and keep the whole game on this device.</p></section>
      <section className="auth-local-card auth-banker-card"><div className="auth-local-copy"><span className="eyebrow">BANKER MODE</span><h2>Run the table together.</h2><p>Manage every player table yourself, or invite nearby phones over local Wi-Fi so players can record their own cards.</p></div><button className="auth-local-button auth-banker-button" onClick={() => navigate('/banker')}><ClipboardList size={17} /> Start Banker Mode</button></section>
      <section className="auth-local-card auth-demo-card"><div className="auth-local-copy"><span className="eyebrow">TRY DEMO</span><h2>Practice the game.</h2><p>Choose cards and explore the rules by yourself. Your practice session stays offline.</p></div><button className="auth-local-button auth-demo-button" onClick={() => navigate('/demo')}><Eye size={17} /> Try the demo</button></section>
    </main>
    <aside className="desktop-marquee right"><div>PRESS<br />YOUR<br />LUCK</div></aside>
  </div>
}
