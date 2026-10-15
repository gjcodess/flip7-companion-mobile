import { describe, expect, it } from 'vitest'
import { bankerInitialState, bankerReducer } from './bankerGame'
import { pickerCards } from './cards'
import { bankerTableEntries, vengeanceTableEntries } from './tableEntries'
import { vengeanceInitialState, vengeanceReducer, vengeanceScore, vengeanceEligibleCards, type VState } from './vengeanceGame'
import { vengeanceCard } from './vengeanceCards'

const roster = ['a', 'b', 'c'].map(id => ({ id, name: id, color: '#132d67' }))
const record = (state: VState, cardId: string) => vengeanceReducer(state, { type: 'record', cardId })
function forcedVengeance() {
  let state = vengeanceInitialState(roster)
  for (const id of ['v-number-10', 'v-number-8', 'v-number-3']) state = record(state, id)
  state = record(state, 'v-action-flip-four')
  return vengeanceReducer(state, { type: 'choose-actor', playerId: 'a' })
}

describe('queued cards on the table', () => {
  it('shows Vengeance effects on the flipper table without changing their hand, score, or legal targets', () => {
    let state = forcedVengeance()
    for (const id of ['v-modifier-minus-4', 'v-action-discard', 'v-number-2']) state = record(state, id)
    const saved = JSON.stringify(state)
    const entries = vengeanceTableEntries(state, 'a')
    const previews = entries.filter(entry => entry.resolution)
    expect(previews.map(entry => [entry.card.id, entry.resolution])).toEqual([
      ['v-modifier-minus-4', 'queued'], ['v-action-discard', 'queued'],
    ])
    expect(vengeanceTableEntries(state, 'b').some(entry => entry.resolution)).toBe(false)
    expect(vengeanceScore(state.players[0])).toBe(12)
    expect(state.players[0].entries).toHaveLength(3)
    const selecting: VState = { ...state, pending: { card: vengeanceCard('v-action-discard')!, sourceId: 'a', actorId: 'a', selectedCards: [] } }
    expect(vengeanceEligibleCards(selecting).some(face => previews.some(preview => preview.instanceId === face.entry.instanceId))).toBe(false)
    expect(JSON.stringify(state)).toBe(saved)
  })

  it('replaces a resolved preview with the actual card on its chosen target', () => {
    let state = forcedVengeance()
    for (const id of ['v-modifier-minus-4', 'v-action-discard', 'v-number-2', 'v-action-just-one-more']) state = record(state, id)
    const before = vengeanceTableEntries(state, 'a').filter(entry => entry.resolution)
    expect(before.map(entry => entry.resolution)).toEqual(['resolving', 'queued', 'queued'])
    state = vengeanceReducer(state, { type: 'choose-target', playerId: 'b', preview: true })
    expect(vengeanceTableEntries(state, 'a').filter(entry => entry.card.id === 'v-modifier-minus-4')).toHaveLength(1)
    state = vengeanceReducer(state, { type: 'confirm' })
    expect(vengeanceTableEntries(state, 'a').some(entry => entry.card.id === 'v-modifier-minus-4')).toBe(false)
    const received = vengeanceTableEntries(state, 'b').find(entry => entry.card.id === 'v-modifier-minus-4')
    expect(received?.resolution).toBeUndefined()
    expect(vengeanceScore(state.players[0])).toBe(12)
    expect(vengeanceScore(state.players[1])).toBe(4)
  })

  it('gives identical queued cards distinct preview identities', () => {
    let state = forcedVengeance()
    state = record(record(state, 'v-modifier-minus-2'), 'v-modifier-minus-2')
    const previews = vengeanceTableEntries(state, 'a').filter(entry => entry.resolution)
    expect(previews).toHaveLength(2)
    expect(new Set(previews.map(entry => entry.instanceId)).size).toBe(2)
    const ids = previews.map(entry => entry.instanceId)
    state = record(state, 'v-number-2')
    expect(vengeanceTableEntries(state, 'a').filter(entry => entry.resolution).map(entry => entry.instanceId)).toEqual(ids)
  })

  it('removes queued previews on an early bust', () => {
    let state = forcedVengeance()
    state = record(record(state, 'v-modifier-minus-4'), 'v-number-10')
    expect(state.players[0].status).toBe('busted')
    expect(vengeanceTableEntries(state, 'a').some(entry => entry.resolution)).toBe(false)
  })

  it('restores queued previews with undo after a bust', () => {
    let state = forcedVengeance()
    state = record(record(state, 'v-modifier-minus-4'), 'v-number-10')
    state = vengeanceReducer(state, { type: 'undo' })
    expect(vengeanceTableEntries(state, 'a').find(entry => entry.resolution)?.card.id).toBe('v-modifier-minus-4')
  })

  it('also shows a deferred Classic Freeze and replaces it after resolution', () => {
    const card = (id: string) => pickerCards.find(card => card.id === id)!
    let state = bankerReducer(bankerInitialState(), { type: 'start', names: ['A', 'B'], targetScore: 200 })
    const [a, b] = state.players.map(player => player.id)
    state = bankerReducer(state, { type: 'record-action', sourcePlayerId: a, targetPlayerId: b, card: card('action-flip-three') })
    state = bankerReducer(state, { type: 'reveal-action', sourcePlayerId: b, card: card('action-freeze') })
    expect(bankerTableEntries(state, b).find(entry => entry.resolution)?.resolution).toBe('queued')
    expect(state.players[1].round.status).toBe('active')
    for (const n of [1, 2]) state = bankerReducer(state, { type: 'record-card', playerId: b, card: card(`number-${n}`) })
    expect(bankerTableEntries(state, b).find(entry => entry.resolution)?.resolution).toBe('resolving')
    state = bankerReducer(state, { type: 'record-action', sourcePlayerId: b, targetPlayerId: a, card: card('action-freeze') })
    expect(bankerTableEntries(state, b).some(entry => entry.resolution)).toBe(false)
    expect(bankerTableEntries(state, a).some(entry => entry.card.id === 'action-freeze' && !entry.resolution)).toBe(true)
  })
})
