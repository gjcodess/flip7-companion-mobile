import { useEffect, useRef, useState, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight, Play } from 'lucide-react'
import { useAppNavigation } from '../../lib/navigation'
import { updateLibrary, type Edition } from '../../lib/room-store'

interface SlideItem {
  name: string
  kicker: string
  titleAria: string
  title: ReactNode
  copy: string
  buttonText: string
  onAction: () => void
  renderArt: () => ReactNode
}

const classicSlides = (navigate: (path: string) => void): SlideItem[] => [
  {
    name: 'Create a room',
    kicker: 'LET THE GOOD TIMES FLIP',
    titleAria: 'A new room. A fresh shot at 200.',
    title: <><span>A new room.</span><span>A fresh shot</span><span>at 200.</span></>,
    copy: 'Gather your crew and start keeping score.',
    buttonText: 'Create a room',
    onAction: () => navigate('/new'),
    renderArt: () => <img className="room-promo-art" src="/assets/promo-2.webp" alt="" decoding="async" />
  },
  {
    name: 'Try the demo',
    kicker: 'DEMO PRACTICE TABLE',
    titleAria: 'Try the game. Know every flip.',
    title: <><span>Try the game.</span><span>Know every</span><span>flip.</span></>,
    copy: 'Explore the cards and scoring before game night.',
    buttonText: 'Try the demo',
    onAction: () => navigate('/demo'),
    renderArt: () => <img className="room-promo-art" src="/assets/promo-1.webp" alt="" decoding="async" />
  },
  {
    name: 'How to play',
    kicker: 'THE QUICK GUIDE',
    titleAria: 'Learn the rules. Flip with confidence.',
    title: <><span>Learn the rules.</span><span>Flip with</span><span>confidence.</span></>,
    copy: 'Get to know the cards, scoring, and special actions.',
    buttonText: 'How to play',
    onAction: () => navigate('/rules'),
    renderArt: () => <div className="room-rules-art" aria-hidden="true"><img src="/cards/Back.webp" alt="" decoding="async" /><img src="/cards/7.webp" alt="" decoding="async" /></div>
  },
  {
    name: 'Play Vengeance',
    kicker: 'NOW AT YOUR TABLE',
    titleAria: 'Flip7 Vengeance Companion.',
    title: <><span>Flip7</span><span>Vengeance</span><span>Companion.</span></>,
    copy: 'Use your physical Vengeance deck with a separate companion space.',
    buttonText: 'Switch mode',
    onAction: () => updateLibrary(current => ({ ...current, settings: { ...current.settings, edition: 'vengeance' } })),
    renderArt: () => <div className="room-vengeance-art"><img className="room-vengeance-base-logo" src="/assets/flip7-title-logo.webp" alt="" decoding="async" /><img className="room-vengeance-logo" src="/assets/flip7-vengeance-logo.webp" alt="" decoding="async" /></div>
  }
]

const vengeanceSlides = (navigate: (path: string) => void): SlideItem[] => [
  {
    name: 'Create a room',
    kicker: 'THE PHYSICAL DECK LEADS',
    titleAria: 'Flip. Move. Track the chaos.',
    title: <><span>Flip. Move.</span><span>Track the</span><span>chaos.</span></>,
    copy: 'Record the cards on your real table and track every consequence.',
    buttonText: 'Create a room',
    onAction: () => navigate('/new'),
    renderArt: () => <div className="room-rules-art" aria-hidden="true"><img src="/cards/vengeance/back.webp" alt="" decoding="async" /><img src="/cards/vengeance/v-number-unlucky-7.webp" alt="" decoding="async" /></div>
  },
  {
    name: 'Try practice',
    kicker: 'SOLO PRACTICE TABLE',
    titleAria: 'Try practice. Master the moves.',
    title: <><span>Try practice.</span><span>Master the</span><span>moves.</span></>,
    copy: 'Test Steal, Swap, and Flip Four on a solo practice table.',
    buttonText: 'Try practice',
    onAction: () => navigate('/vengeance-demo'),
    renderArt: () => <div className="room-rules-art" aria-hidden="true"><img src="/cards/vengeance/v-action-steal.webp" alt="" decoding="async" /><img src="/cards/vengeance/v-action-flip-four.webp" alt="" decoding="async" /></div>
  },
  {
    name: 'Special rules',
    kicker: 'SPECIAL CARDS GUIDE',
    titleAria: 'Learn the rules. Unlucky 7 to Lucky 13.',
    title: <><span>Learn the rules.</span><span>Unlucky 7 to</span><span>Lucky 13.</span></>,
    copy: 'Get to know the Zero, negative modifiers, and action resolution order.',
    buttonText: 'How to play',
    onAction: () => navigate('/rules'),
    renderArt: () => <div className="room-rules-art" aria-hidden="true"><img src="/cards/vengeance/v-number-zero.webp" alt="" decoding="async" /><img src="/cards/vengeance/v-modifier-minus-10.webp" alt="" decoding="async" /></div>
  },
  {
    name: 'Play Classic',
    kicker: 'PLAY THE ORIGINAL',
    titleAria: 'Flip7 Classic Companion.',
    title: <><span>Flip7 Classic</span><span>Companion.</span></>,
    copy: 'Switch back to the standard deck scoring and card tracker.',
    buttonText: 'Switch mode',
    onAction: () => updateLibrary(current => ({ ...current, settings: { ...current.settings, edition: 'classic' } })),
    renderArt: () => <div className="room-vengeance-art"><img className="room-vengeance-base-logo" src="/assets/flip7-title-logo.webp" alt="" decoding="async" /><img className="room-promo-art" style={{ width: 85, height: 120, marginLeft: 0, marginTop: 4 }} src="/assets/promo-1.webp" alt="" decoding="async" /></div>
  }
]

export function HomePromoCarousel({ edition = 'classic' }: { edition?: Edition }) {
  const navigate = useAppNavigation()
  const slides = edition === 'vengeance' ? vengeanceSlides(navigate) : classicSlides(navigate)
  const [active, setActive] = useState(0)
  const [paused, setPaused] = useState(false)
  const touchStart = useRef<number | null>(null)

  useEffect(() => {
    setActive(0)
  }, [edition])

  useEffect(() => {
    if (paused || window.matchMedia('(prefers-reduced-motion: reduce)').matches || document.documentElement.classList.contains('room-reduced-motion')) return
    const timer = window.setTimeout(() => setActive(current => (current + 1) % slides.length), 8000)
    return () => window.clearTimeout(timer)
  }, [active, paused, slides.length])

  const showRelative = (direction: number) => setActive(current => (current + direction + slides.length) % slides.length)
  const currentSlide = slides[active]

  return (
    <div className={`room-promo-carousel room-promo-carousel--${edition}`} aria-roledescription="carousel" aria-label="Home highlights"
      onMouseEnter={() => setPaused(true)} onMouseLeave={() => setPaused(false)}
      onFocusCapture={() => setPaused(true)} onBlurCapture={event => { if (!event.currentTarget.contains(event.relatedTarget)) setPaused(false) }}
      onTouchStart={event => { touchStart.current = event.touches[0]?.clientX ?? null }}
      onTouchEnd={event => { if (touchStart.current === null) return; const distance = event.changedTouches[0]?.clientX - touchStart.current; touchStart.current = null; if (distance && Math.abs(distance) > 45) showRelative(distance < 0 ? 1 : -1) }}>
      <section key={`${edition}-${active}`} className={`room-create-banner room-promo-slide room-promo-slide-${active}`} aria-label={`${currentSlide.name}, slide ${active + 1} of ${slides.length}`}>
        <div className="room-promo-copy">
          <span className="room-kicker">{currentSlide.kicker}</span>
          <h2 aria-label={currentSlide.titleAria}>{currentSlide.title}</h2>
          <p>{currentSlide.copy}</p>
          <button type="button" onClick={currentSlide.onAction}>{currentSlide.buttonText} <Play size={16} fill="currentColor" /></button>
        </div>
        {currentSlide.renderArt()}
      </section>
      <div className="room-promo-controls" aria-label="Choose a home highlight">
        <button type="button" className="room-promo-arrow" aria-label="Previous highlight" onClick={() => showRelative(-1)}><ArrowLeft size={16} /></button>
        <div className="room-promo-dots">{slides.map((s, index) => <button type="button" key={s.name} className={active === index ? 'active' : ''} aria-label={`Show ${s.name}`} aria-current={active === index ? 'true' : undefined} onClick={() => setActive(index)} />)}</div>
        <button type="button" className="room-promo-arrow" aria-label="Next highlight" onClick={() => showRelative(1)}><ArrowRight size={16} /></button>
      </div>
    </div>
  )
}
