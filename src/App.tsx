import { useCallback, useEffect, type ReactNode, useState } from 'react'
import { App as CapacitorApp } from '@capacitor/app'
import { Capacitor } from '@capacitor/core'
import { MotionConfig } from 'motion/react'
import { ConfirmationModal } from './components/ConfirmationModal'
import { AppNavigationProvider, PageTransition, currentNavigableUrl, readAppLocation, runAppViewTransition, toNavigablePath, type AppLocation } from './lib/navigation'
import { RulesScreen } from './pages/rules/RulesScreen'
import { FAQScreen } from './pages/faq/FAQScreen'
import { LegalScreen } from './pages/legal/LegalScreen'
import { ContactScreen } from './pages/contact/ContactScreen'
import { DemoScreen } from './pages/game/DemoScreen'
import { BankerScreen } from './pages/game/BankerScreen'
import { MobileApp } from './pages/mobile/MobileApp'
import { useLibrary } from './lib/room-store'
import { preloadCardArtwork } from './game/cardArtworkPreloader'
import { syncTvSharing } from './lib/tv-share'
import { listenLocalRoomHost, syncLocalRoom } from './lib/local-room'
import { GuestRoomScreen } from './pages/mobile/GuestRoomScreen'

const viewTransitionPaths = new Set(['/landing', '/play', '/rules', '/faq', '/privacy', '/terms', '/contact'])

function shouldSkipViewTransition(fromPath: string, toPath: string) {
  return fromPath === '/demo' || toPath === '/demo' || !viewTransitionPaths.has(fromPath) || !viewTransitionPaths.has(toPath)
}

export default function App() {
  const [showExitPrompt, setShowExitPrompt] = useState(false)
  useEffect(() => {
    const splash = document.getElementById('launch-splash')
    if (!splash) return
    if (Capacitor.getPlatform() !== 'android') { splash.remove(); return }
    const dismissTimer = window.setTimeout(() => {
      splash.classList.add('is-dismissing')
      const removeSplash = () => splash.remove()
      splash.addEventListener('transitionend', removeSplash, { once: true })
      window.setTimeout(removeSplash, 500)
    }, 700)
    return () => window.clearTimeout(dismissTimer)
  }, [])
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return
    let active = true
    let listener: { remove: () => Promise<void> } | undefined
    void CapacitorApp.addListener('backButton', () => {
      setShowExitPrompt(current => !current)
    }).then(handle => {
      if (active) listener = handle
      else void handle.remove()
    })
    return () => { active = false; void listener?.remove() }
  }, [])
  useEffect(() => {
    let cleanup: (() => void) | undefined
    let active = true
    void listenLocalRoomHost().then(stop => { if (active) cleanup = stop; else stop() })
    return () => { active = false; cleanup?.() }
  }, [])
  useEffect(() => {
    // Warm the lightweight picker previews after the first screen has painted.
    if ('requestIdleCallback' in window) {
      const idle = window.requestIdleCallback(() => { void preloadCardArtwork() }, { timeout: 1500 })
      return () => window.cancelIdleCallback(idle)
    }
    const timer = setTimeout(() => { void preloadCardArtwork() }, 200)
    return () => clearTimeout(timer)
  }, [])
  const library = useLibrary()
  useEffect(() => { void syncTvSharing(library).catch(() => {}) }, [library])
  useEffect(() => { void syncLocalRoom(library).catch(() => {}) }, [library])
  useEffect(() => { document.documentElement.classList.toggle('room-reduced-motion', library.settings.reducedMotion) }, [library.settings.reducedMotion])
  const [location, setLocation] = useState<AppLocation>(() => {
    const current = readAppLocation()
    return { ...current, pathname: current.pathname === '/' ? '/landing' : current.pathname }
  })
  const navigate = useCallback((to: string, options?: { replace?: boolean; skipGuard?: boolean }) => {
    const next = toNavigablePath(to)
    if (next === currentNavigableUrl()) return
    const currentPath = window.location.pathname
    const nextPath = new URL(next, window.location.origin).pathname
    runAppViewTransition(() => {
      if (options?.replace) window.history.replaceState({}, '', next)
      else window.history.pushState({}, '', next)
      const current = readAppLocation()
      setLocation({ ...current, pathname: current.pathname === '/' ? '/landing' : current.pathname })
    }, { skip: shouldSkipViewTransition(currentPath === '/' ? '/landing' : currentPath, nextPath) })
  }, [])
  useEffect(() => {
    if (Capacitor.getPlatform() !== 'android') return
    let active = true
    let listener: { remove: () => Promise<void> } | undefined
    void CapacitorApp.addListener('appUrlOpen', event => {
      try {
        const link = new URL(event.url)
        if (link.protocol === 'flip7:' && link.host === 'join') {
          const url = link.searchParams.get('url')
          if (url) navigate(`/join?url=${encodeURIComponent(url)}`)
        }
      } catch { /* Ignore other application links. */ }
    }).then(handle => { if (active) listener = handle; else void handle.remove() })
    return () => { active = false; void listener?.remove() }
  }, [navigate])
  useEffect(() => {
    if (window.location.pathname === '/') {
      const next = toNavigablePath(`${window.location.pathname}${window.location.search}${window.location.hash}`)
      window.history.replaceState({}, '', next)
    }
  }, [])
  const syncLocationFromHistory = useCallback((fromPath = '/landing') => {
    const nextPath = window.location.pathname === '/' ? '/landing' : window.location.pathname
    runAppViewTransition(() => {
      const next = readAppLocation()
      setLocation({ ...next, pathname: next.pathname === '/' ? '/landing' : next.pathname })
    }, { skip: shouldSkipViewTransition(fromPath, nextPath) })
  }, [])

  const isRulesPage = location.pathname === '/rules'
  const isFAQPage = location.pathname === '/faq'
  const isPrivacyPage = location.pathname === '/privacy'
  const isTermsPage = location.pathname === '/terms'
  const isContactPage = location.pathname === '/contact'
  const isDemoPage = location.pathname === '/demo'
  const isBankerPage = location.pathname === '/banker'
  const isPlayPage = location.pathname === '/play'
  const isJoinPage = location.pathname === '/join' || location.pathname.startsWith('/join/')
  useEffect(() => {
    const frame = window.requestAnimationFrame(() => {
      if (location.hash) {
        document.getElementById(location.hash.slice(1))?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      } else {
        window.scrollTo({ top: 0, behavior: 'auto' })
      }
    })
    return () => window.cancelAnimationFrame(frame)
  }, [location.pathname, location.search, location.hash])

  let content: ReactNode
  if (isRulesPage) content = <RulesScreen />
  else if (isFAQPage) content = <FAQScreen />
  else if (isPrivacyPage) content = <LegalScreen kind="privacy" />
  else if (isTermsPage) content = <LegalScreen kind="terms" />
  else if (isContactPage) content = <ContactScreen />
  else if (isDemoPage) content = <DemoScreen />
  else if (isJoinPage) content = <GuestRoomScreen inviteUrl={location.pathname.startsWith('/join/') ? window.location.origin + location.pathname : new URLSearchParams(location.search).get('url') ?? ''} />
  else if (isBankerPage) { const roomId = new URLSearchParams(location.search).get('room'); content = roomId ? <BankerScreen key={roomId} roomId={roomId} /> : <MobileApp key="new" page="new" /> }
  else if (isPlayPage || location.pathname === '/new') content = <MobileApp key="new" page="new" />
  else if (location.pathname === '/players') content = <MobileApp key="players" page="players" />
  else if (location.pathname === '/history') content = <MobileApp key="history" page="history" />
  else if (location.pathname === '/settings') content = <MobileApp key="settings" page="settings" />
  else if (location.pathname === '/room') content = <MobileApp key={`room-${location.search}`} page="room" roomId={new URLSearchParams(location.search).get('id') ?? undefined} />
  else content = <MobileApp key="home" page="home" />

  return <MotionConfig reducedMotion={library.settings.reducedMotion ? 'always' : 'user'}><AppNavigationProvider navigate={navigate} onPopState={syncLocationFromHistory}>
    <PageTransition routeKey={`${location.pathname}${location.search}`}>{content}</PageTransition>
    {showExitPrompt && <ConfirmationModal variant="floating" eyebrow="EXIT APP" title="Leave Flip7 Companion?" message="Your saved rooms and player records will be here when you come back." cancelLabel="Stay" confirmLabel="Exit app" onCancel={() => setShowExitPrompt(false)} onConfirm={() => { void CapacitorApp.exitApp() }} />}
  </AppNavigationProvider></MotionConfig>
}
