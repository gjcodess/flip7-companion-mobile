import { useEffect, useRef, useState } from 'react'
import { ArrowLeft, ArrowRight, Play } from 'lucide-react'
import { useAppNavigation } from '../../lib/navigation'

const slideNames = ['Create a room', 'Try the demo', 'How to play', 'Vengeance coming soon']

export function HomePromoCarousel() {
  const navigate = useAppNavigation()
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchStart = useRef<number | null>(null)

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('room-reduced-motion')) return
    const timer = window.setTimeout(() => setActive(current => (current + 1) % slideNames.length), 8000)
    return () => window.clearTimeout(timer)
  }, [active, paused])

  const showRelative = (direction: number) => setActive(current => (current + direction + slideNames.length) % slideNames.length)

  return <div className="room-promo-carousel" aria-roledescription="carousel" aria-label="Home highlights"
    onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
    onFocusCapture={() => setPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false) }}
    onTouchStart={event => { touchStart.current = event.touches[0]?.clientX ?? null }}
    onTouchEnd={event => { if (touchStart.current === null) return; const distance = event.changedTouches[0]?.clientX - touchStart.current; touchStart.current = null; if (distance && Math.abs(distance) > 45) showRelative(distance < 0 ? 1 : -1) }}>
    <section key={active} className={`room-create-banner room-promo-slide room-promo-slide-${active}`} aria-label={`${slideNames[active]}, slide ${active + 1} of ${slideNames.length}`}>
      {active === 0 ? <><div className="room-promo-copy"><span className="room-kicker">LET THE GOOD TIMES FLIP</span><h2 aria-label="A new room. A fresh shot at 200."><span>A new room.</span><span>A fresh shot</span><span>at 200.</span></h2><p>Gather your crew and start keeping score.</p><button type="button" onClick={() => navigate('/new')}>Create a room <Play size={16} fill="currentColor" /></button></div><img className="room-promo-art" src="/assets/promo-2.webp" alt="" decoding="async" /></> :
        active === 1 ? <><div className="room-promo-copy"><span className="room-kicker">DEMO PRACTICE TABLE</span><h2 aria-label="Try the game. Know every flip."><span>Try the game.</span><span>Know every</span><span>flip.</span></h2><p>Explore the cards and scoring before game night.</p><button type="button" onClick={() => navigate('/demo')}>Try the demo <Play size={16} fill="currentColor" /></button></div><img className="room-promo-art" src="/assets/promo-1.webp" alt="" decoding="async" /></> :
          active === 2 ? <><div className="room-promo-copy"><span className="room-kicker">THE QUICK GUIDE</span><h2 aria-label="Learn the rules. Flip with confidence."><span>Learn the rules.</span><span>Flip with</span><span>confidence.</span></h2><p>Get to know the cards, scoring, and special actions.</p><button type="button" onClick={() => navigate('/rules')}>How to play <Play size={16} fill="currentColor" /></button></div><div className="room-rules-art" aria-hidden="true"><img src="/cards/Back.webp" alt="" decoding="async" /><img src="/cards/7.webp" alt="" decoding="async" /></div></> :
            <><div className="room-promo-copy"><span className="room-kicker">COMING SOON</span><h2 aria-label="Flip7 Vengeance Companion."><span>Flip7</span><span>Vengeance</span><span>Companion.</span></h2><p>A new companion for the next game night.</p><span className="room-promo-soon-label">IN THE WORKS</span></div><div className="room-vengeance-art"><img className="room-vengeance-base-logo" src="/assets/flip7-title-logo.webp" alt="" decoding="async" /><img className="room-vengeance-logo" src="/assets/flip7-vengeance-logo.webp" alt="" decoding="async" /></div></>}
    </section>
    <div className="room-promo-controls" aria-label="Choose a home highlight">
      <button type="button" className="room-promo-arrow" aria-label="Previous highlight" onClick={() => showRelative(-1)}><ArrowLeft size={16} /></button>
      <div className="room-promo-dots">{slideNames.map((name, index) => <button type="button" key={name} className={active === index ? 'active' : ''} aria-label={`Show ${name}`} aria-current={active === index ? 'true' : undefined} onClick={() => setActive(index)} />)}</div>
      <button type="button" className="room-promo-arrow" aria-label="Next highlight" onClick={() => showRelative(1)}><ArrowRight size={16} /></button>
    </div>
  </div>
}
