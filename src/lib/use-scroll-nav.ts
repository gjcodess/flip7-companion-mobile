import { useEffect, useRef, useState } from 'react'

export type ScrollNavState = { position: number; distance: number; hidden: boolean }

// Accumulate intentional movement; clamp overscroll so edge bounce cannot flip the bar.
export function nextScrollNav(state: ScrollNavState, scrollY: number, maxScroll: number): ScrollNavState {
  const position = Math.max(0, Math.min(scrollY, Math.max(0, maxScroll)))
  const delta = position - state.position
  if (position <= 24) return { position, distance: 0, hidden: false }
  if (!delta) return { ...state, position }
  const distance = Math.sign(delta) === Math.sign(state.distance) ? state.distance + delta : delta
  if (distance >= 16 && position > 80) return { position, distance: 0, hidden: true }
  if (distance <= -8) return { position, distance: 0, hidden: false }
  return { ...state, position, distance }
}

export function useScrollNav(page: string = '') {
  const navRef = useRef<HTMLElement>(null)
  const scrollState = useRef<ScrollNavState>({ position: 0, distance: 0, hidden: false })
  const [hidden, setHidden] = useState(false)

  function reveal() {
    scrollState.current = { position: window.scrollY, distance: 0, hidden: false }
    setHidden(false)
  }

  useEffect(() => {
    scrollState.current = { position: window.scrollY, distance: 0, hidden: false }
    setHidden(false)
    let frame = 0
    const update = () => {
      frame = 0
      const active = document.activeElement
      if (active && navRef.current?.contains(active) && active.matches(':focus-visible')) {
        scrollState.current = { position: window.scrollY, distance: 0, hidden: false }
      } else {
        scrollState.current = nextScrollNav(scrollState.current, window.scrollY, document.documentElement.scrollHeight - window.innerHeight)
      }
      setHidden(scrollState.current.hidden)
    }
    const onScroll = () => { if (!frame) frame = window.requestAnimationFrame(update) }
    window.addEventListener('scroll', onScroll, { passive: true })
    window.addEventListener('resize', onScroll)
    return () => {
      window.removeEventListener('scroll', onScroll)
      window.removeEventListener('resize', onScroll)
      window.cancelAnimationFrame(frame)
    }
  }, [page])

  return { navRef, hidden, reveal }
}
