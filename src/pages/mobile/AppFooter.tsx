import { ShieldCheck } from 'lucide-react'

export function AppFooter() {
  return <footer className="room-app-footer">
    <div className="room-footer-brand">
      <img className="room-footer-logo" src="/assets/flip7-title-logo.webp" alt="Flip7 Companion" />
      <p className="room-footer-tagline">Made for the table. Always offline.</p>
    </div>
    <div className="room-footer-disclaimer-card">
      <div className="room-footer-disclaimer-header">
        <ShieldCheck size={14} />
        <span>DISCLAIMER &amp; LEGAL NOTICE</span>
      </div>
      <p className="room-footer-disclaimer-text">
        <strong>Flip7 Companion</strong> is an independent digital companion and scorekeeping utility created for tabletop players.
        This application is <strong>not affiliated with, endorsed by, sponsored by, or associated with</strong> the original creators, designers, or publishers of the physical <em>Flip 7</em> card game.
      </p>
      <p className="room-footer-disclaimer-sub">
        A physical copy of the Flip 7 card game is required to play. All game concepts, card mechanics, and trademarks belong to their respective copyright holders.
      </p>
    </div>
    <div className="room-footer-copy">
      <span className="room-footer-version">v2.2</span>
      <span className="room-footer-sep">·</span>
      <small>© 2026 Flip7 Companion</small>
    </div>
  </footer>
}
