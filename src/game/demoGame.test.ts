import { describe, expect, it } from 'vitest'
import { pickerCards } from './cards'
import { demoDerived, demoInitialState, demoReducer } from './demoGame'

const card = (id: string) => pickerCards.find(c => c.id === id)!
const hand = (...ids: string[]) => ids.reduce((state, id) => demoReducer(state, { type: 'add', card: card(id) }), demoInitialState())

describe('Classic practice rules', () => {
  it.each(['number-1', 'modifier-plus-4', 'modifier-x2', 'action-second-chance'])('allows staying with just %s', id => {
    const state = hand(id)
    expect(demoDerived(state).canStay).toBe(true)
    expect(demoReducer(state, { type: 'stay' }).status).toBe('stayed')
  })

  it('blocks Stay on an empty hand or during forced draws', () => {
    expect(demoDerived(demoInitialState()).canStay).toBe(false)
    expect(demoDerived(hand('action-flip-three', 'number-1')).canStay).toBe(false)
  })

  it('defers Freeze until all three reveals finish', () => {
    let state = hand('action-flip-three', 'action-freeze')
    expect(state.status).toBe('active')
    expect(state.flipThreeRemaining).toBe(2)
    state = demoReducer(state, { type: 'add', card: card('number-1') })
    expect(state.status).toBe('active')
    state = demoReducer(state, { type: 'add', card: card('number-2') })
    expect(state.status).toBe('frozen')
    expect(demoDerived(state).score).toBe(3)
    expect(demoReducer(state, { type: 'undo' }).status).toBe('active')
  })

  it('can bust before a deferred Freeze resolves', () => {
    const state = hand('number-5', 'action-flip-three', 'action-freeze', 'number-5')
    expect(state.status).toBe('busted')
    expect(state.flipThreeRemaining).toBe(0)
    expect(state.entries.filter(e => e.card.kind === 'action').every(e => e.voided)).toBe(true)
  })

  it('starts a nested Flip Three only after the original three reveals', () => {
    const state = hand('action-flip-three', 'action-flip-three', 'number-1', 'number-2')
    expect(state.status).toBe('active')
    expect(state.flipThreeRemaining).toBe(3)
    expect(state.entries[0].voided).toBe(true)
    expect(state.entries[1].voided).toBe(false)
  })

  it('uses Second Chance immediately and counts the saved duplicate as one reveal', () => {
    const state = hand('number-5', 'action-flip-three', 'action-second-chance', 'number-5', 'number-2')
    expect(state.status).toBe('active')
    expect(state.flipThreeRemaining).toBe(0)
    expect(demoDerived(state).score).toBe(7)
    expect(demoDerived(state).secondChanceCount).toBe(0)
  })

  it('discards an extra Second Chance instead of protecting twice', () => {
    const state = hand('number-5', 'action-second-chance', 'action-second-chance', 'number-5', 'number-5')
    expect(state.status).toBe('busted')
    expect(state.entries[2].voided).toBe(true)
  })

  it('ends immediately on Flip 7 instead of applying deferred Freeze', () => {
    const state = hand('number-1', 'number-2', 'number-3', 'number-4', 'number-5', 'number-6', 'action-flip-three', 'action-freeze', 'number-7')
    expect(state.status).toBe('flip-seven')
    expect(state.flipThreeRemaining).toBe(0)
    expect(demoDerived(state).score).toBe(43)
  })
})
