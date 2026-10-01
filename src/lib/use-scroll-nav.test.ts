import { describe, expect, it } from 'vitest'
import { nextScrollNav, type ScrollNavState } from './use-scroll-nav'

const visible: ScrollNavState = { position: 100, distance: 0, hidden: false }

describe('scroll-aware bottom navigation', () => {
  it('hides on a deliberate downward scroll and reveals on upward scroll', () => {
    const hidden = nextScrollNav(visible, 120, 500)
    expect(hidden.hidden).toBe(true)
    expect(nextScrollNav(hidden, 112, 500).hidden).toBe(false)
  })

  it('accumulates small movements without flickering on tiny reversals', () => {
    let state = nextScrollNav(visible, 104, 500)
    state = nextScrollNav(state, 110, 500)
    expect(state.hidden).toBe(false)
    state = nextScrollNav(state, 116, 500)
    expect(state.hidden).toBe(true)
    state = nextScrollNav(state, 114, 500)
    expect(state.hidden).toBe(true)
    state = nextScrollNav(state, 117, 500)
    expect(state.distance).toBe(3)
    expect(state.hidden).toBe(true)
  })

  it('keeps the bar visible near the top and reveals it on return to the top', () => {
    expect(nextScrollNav({ position: 0, distance: 0, hidden: false }, 70, 500).hidden).toBe(false)
    expect(nextScrollNav({ ...visible, hidden: true }, 0, 500).hidden).toBe(false)
  })

  it('ignores rubber-band overscroll at both edges and non-scrollable pages', () => {
    const bottom = { position: 500, distance: 0, hidden: true }
    const bounce = nextScrollNav(bottom, 540, 500)
    expect(bounce).toEqual(bottom)
    expect(nextScrollNav(bounce, 500, 500).hidden).toBe(true)
    expect(nextScrollNav(visible, -20, 500)).toEqual({ position: 0, distance: 0, hidden: false })
    expect(nextScrollNav(visible, 100, 0).hidden).toBe(false)
  })

  it('clamps the position when content shrinks', () => {
    expect(nextScrollNav({ position: 500, distance: 0, hidden: true }, 500, 0)).toEqual({ position: 0, distance: 0, hidden: false })
  })
})
