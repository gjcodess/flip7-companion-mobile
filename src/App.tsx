import { useCallback, useEffect, type ReactNode, useState } from 'react'
import { AppNavigationProvider, PageTransition, currentNavigableUrl, readAppLocation, runAppViewTransition, toNavigablePath, type AppLocation } from './lib/navigation'
import { LandingScreen } from './pages/landing/LandingScreen'
import { RulesScreen } from './pages/rules/RulesScreen'
import { FAQScreen } from './pages/faq/FAQScreen'
import { LegalScreen } from './pages/legal/LegalScreen'
import { ContactScreen } from './pages/contact/ContactScreen'
import { LocalModeScreen } from './pages/local/LocalModeScreen'
import { DemoScreen } from './pages/game/DemoScreen'
import { BankerScreen } from './pages/game/BankerScreen'

const viewTransitionPaths = new Set(['/landing', '/play', '/rules', '/faq', '/privacy', '/terms', '/contact'])

function shouldSkipViewTransition(fromPath: string, toPath: string) {
  return fromPath === '/demo' || toPath === '/demo' || !viewTransitionPaths.has(fromPath) || !viewTransitionPaths.has(toPath)
}

export default function App() {
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
  const showLanding = location.pathname === '/landing'
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

  const enterApp = () => navigate('/play', { replace: true })

  let content: ReactNode
  if (isRulesPage) content = <RulesScreen />
  else if (isFAQPage) content = <FAQScreen />
  else if (isPrivacyPage) content = <LegalScreen kind="privacy" />
  else if (isTermsPage) content = <LegalScreen kind="terms" />
  else if (isContactPage) content = <ContactScreen />
  else if (isDemoPage) content = <DemoScreen />
  else if (isBankerPage) content = <BankerScreen />
  else if (isPlayPage) content = <LocalModeScreen />
  else if (showLanding) content = <LandingScreen onStart={enterApp} />
  else content = <LandingScreen onStart={enterApp} />

  return <AppNavigationProvider navigate={navigate} onPopState={syncLocationFromHistory}>
    <PageTransition routeKey={`${location.pathname}${location.search}`}>{content}</PageTransition>
  </AppNavigationProvider>
}
