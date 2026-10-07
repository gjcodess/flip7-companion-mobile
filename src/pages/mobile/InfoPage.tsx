import { useEffect, type ReactNode } from 'react'
import { ArrowLeft, ArrowRight } from 'lucide-react'
import { useAppNavigation } from '../../lib/navigation'
import { useKeyboardVisible } from '../../lib/use-keyboard-visible'
import { BottomNav } from './MobileApp'
import { PageArtwork } from './PageArtwork'
import { AppFooter } from './AppFooter'
import { EditionFab } from './EditionFab'
import { updateLibrary, useLibrary, type Edition } from '../../lib/room-store'

export type InfoPageKind = 'rules' | 'faq' | 'privacy' | 'terms' | 'contact'

export function AssetCardFan({ cards }: { cards: string[] }) {
  return <div className="info-card-fan" aria-hidden="true">{cards.map((card, i) => <img key={`${card}-${i}`} src={`/cards/${card}.webp`} alt="" decoding="async" />)}</div>
}

export function InfoPage({ kind, kicker, title, accent, intro, children }: { kind: InfoPageKind; kicker: string; title: string; accent: string; intro: string; children: ReactNode }) {
  const navigate = useAppNavigation()
  const library = useLibrary()
  const keyboardVisible = useKeyboardVisible()
  const edition = library.settings.edition
  const nextEdition: Edition = edition === 'classic' ? 'vengeance' : 'classic'
  const switchEdition = (next: Edition) => {
    if (next === library.settings.edition) return
    try { updateLibrary(current => ({ ...current, settings: { ...current.settings, edition: next } })) }
    catch (cause) { window.alert((cause as Error).message) }
  }

  useEffect(() => {
    document.documentElement.classList.add('room-app-active')
    return () => document.documentElement.classList.remove('room-app-active')
  }, [])
  const links = [{ kind: 'rules', label: 'How to play', href: '/rules' }, { kind: 'faq', label: 'FAQs', href: '/faq' }, { kind: 'privacy', label: 'Privacy', href: '/privacy' }, { kind: 'terms', label: 'Terms', href: '/terms' }]
  return <div className={`room-app-shell info-app-shell edition-${edition}`}><main className={`room-app-main info-page info-${kind}`}>
    <PageArtwork edition={edition} />
    <div className="info-top-row"><button type="button" onClick={() => navigate('/settings')}><ArrowLeft size={18} /> Settings</button></div>
    <header className="info-heading"><span className="room-kicker">{kicker}</span><h1>{title}{accent && <><br /><em>{accent}</em></>}</h1><p>{intro}</p></header>
    <nav className="info-page-tabs" aria-label="Help and app information">{links.map(link => <a key={link.kind} href={link.href} aria-current={kind === link.kind ? 'page' : undefined}>{link.label}</a>)}</nav>
    {children}
    <AppFooter />
  </main>{!keyboardVisible && <EditionFab target={nextEdition} onSwitch={() => switchEdition(nextEdition)} page={kind} />}<BottomNav page="settings" /></div>
}

export function InfoPlayCallout({ practice = false }: { practice?: boolean }) {
  const edition = useLibrary().settings.edition
  const imageSrc = edition === 'vengeance' ? '/assets/flip7-vengeance-logo.webp' : `/assets/${practice ? 'promo-1' : 'promo-2'}.webp`
  return <section className="info-play-callout"><div><span className="room-kicker">{practice ? 'LEARN BY DOING' : 'BACK TO THE GOOD TIMES'}</span><h2>{practice ? 'Give it a practice flip.' : 'Your next game is waiting.'}</h2><p>{practice ? 'Try the cards and scoring on a solo practice table.' : 'Bring your crew, create a room, and press your luck.'}</p><a href={practice ? '/demo' : '/new'}>{practice ? 'Try the demo' : 'Create a room'} <ArrowRight size={16} /></a></div><img className={edition === 'vengeance' ? 'info-play-callout-vengeance-art' : undefined} src={imageSrc} alt="" loading="lazy" decoding="async" /></section>
}
