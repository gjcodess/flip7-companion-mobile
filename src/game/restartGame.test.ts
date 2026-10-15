import { describe, expect, it } from 'vitest'
import { bankerInitialState, bankerReducer, type BankerState } from './bankerGame'
import { vengeanceInitialState, vengeanceReducer, type VState } from './vengeanceGame'
import { pickerCards } from './cards'
import { vengeanceCard } from './vengeanceCards'

function classicRound(): BankerState {
  let state = bankerReducer(bankerInitialState(), { type: 'start', names: ['Ana', 'Ben'], targetScore: 300 })
  for (const player of state.players) {
    state = bankerReducer(state, { type: 'record-card', playerId: player.id, card: pickerCards.find(card => card.id === 'number-8')! })
  }
  for (const player of state.players) state = bankerReducer(state, { type: 'settle-player', playerId: player.id })
  state = bankerReducer(state, { type: 'advance-round' })
  return bankerReducer(state, { type: 'reveal-action', sourcePlayerId: state.turnPlayerId!, card: pickerCards.find(card => card.id === 'action-flip-three')! })
}

function vengeanceRound(variant: 'standard' | 'brutal'): VState {
  let state = vengeanceInitialState(['a', 'b'].map(id => ({ id, name: id, color: '#132d67' })), 300, 'a', variant)
  for (const cardId of ['v-number-8', 'v-number-9']) state = vengeanceReducer(state, { type: 'record', cardId })
  state = vengeanceReducer(state, { type: 'stay' })
  state = vengeanceReducer(state, { type: 'stay' })
  state = vengeanceReducer(state, { type: 'advance-round' })
  state = vengeanceReducer(state, { type: 'record', cardId: 'v-action-flip-four' })
  state = vengeanceReducer(state, { type: 'choose-actor', playerId: state.turnPlayerId! })
  return vengeanceReducer(state, { type: 'record', cardId: 'v-modifier-minus-4' })
}

describe('restart choices', () => {
  it.each(['game', 'round'] as const)('restarts the Classic %s with stable player identities and clean actions', scope => {
    const previous = classicRound()
    expect(previous.history).toHaveLength(1)
    expect(previous.pendingAction).toBeTruthy()
    const state = bankerReducer(previous, { type: 'restart', scope })
    expect(state.phase).toBe('round')
    expect(state.roundNumber).toBe(scope === 'game' ? 1 : previous.roundNumber)
    expect(state.dealerId).toBe(scope === 'game' ? previous.players[0].id : previous.dealerId)
    expect(state.turnPlayerId).toBe(state.dealerId)
    expect(state.selectedPlayerId).toBe(state.dealerId)
    expect(state.players.map(player => player.id)).toEqual(previous.players.map(player => player.id))
    expect(state.players.map(player => player.totalScore)).toEqual(scope === 'game' ? [0, 0] : previous.players.map(player => player.totalScore))
    expect(state.players.every(player => player.round.status === 'active' && player.round.entries.length === 0)).toBe(true)
    expect(state.targetScore).toBe(300)
    expect(state.history).toEqual(scope === 'game' ? [] : previous.history)
    expect(state.pendingAction).toBeNull()
    expect(state.forcedTurns).toEqual([])
    expect(bankerReducer(state, { type: 'undo' })).toBe(state)
    expect(bankerReducer(state, { type: 'redo' })).toBe(state)
  })

  for (const variant of ['standard', 'brutal'] as const) {
    it.each(['game', 'round'] as const)(`restarts the ${variant} Vengeance %s and removes forced draws and queues`, scope => {
      const previous = vengeanceRound(variant)
      expect(previous.history).toHaveLength(1)
      expect(previous.forced[0].deferred[0].card).toBe(vengeanceCard('v-modifier-minus-4'))
      const state = vengeanceReducer(previous, { type: 'restart', scope })
      expect(state.phase).toBe('deal')
      expect(state.roundNumber).toBe(scope === 'game' ? 1 : previous.roundNumber)
      expect(state.dealerId).toBe(scope === 'game' ? previous.players[0].id : previous.dealerId)
      expect(state.turnPlayerId).toBe(state.dealerId)
      expect(state.players.map(player => player.id)).toEqual(previous.players.map(player => player.id))
      expect(state.players.map(player => player.totalScore)).toEqual(scope === 'game' ? [0, 0] : previous.players.map(player => player.totalScore))
      expect(state.players.every(player => player.status === 'active' && player.entries.length === 0)).toBe(true)
      expect(state.targetScore).toBe(300)
      expect(state.variant).toBe(variant)
      expect(state.history).toEqual(scope === 'game' ? [] : previous.history)
      expect(state.pending).toBeNull()
      expect(state.pendingFlipSeven).toBeNull()
      expect(state.flipSevenChoice).toBeNull()
      expect(state.forced).toEqual([])
      expect(state.resolving).toEqual([])
      expect(state.events).toEqual([])
      expect(vengeanceReducer(state, { type: 'undo' })).toBe(state)
      expect(vengeanceReducer(state, { type: 'redo' })).toBe(state)
    })
  }
})
