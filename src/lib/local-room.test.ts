import { describe, expect, it } from 'vitest'
import { bankerInitialState, bankerReducer } from '../game/bankerGame'
import { pickerCards } from '../game/cards'
import { checkedGuestAction, parseJoinUrl } from './local-room'

const started = () => bankerReducer(bankerInitialState(), { type: 'start', targetScore: 200, names: ['Alex', 'Sam', 'Joy'] })
const card = (id: string) => pickerCards.find(item => item.id === id)!

describe('local room invites', () => {
  it('accepts only local room addresses with an invite token', () => {
    expect(parseJoinUrl('http://192.168.1.5:1234/join/ABCDEFGHJKLMNPQR')).toBe('http://192.168.1.5:1234/join/ABCDEFGHJKLMNPQR')
    expect(parseJoinUrl('http://10.0.0.1:2222/join/ABCDEFGHJKLMNPQR')).toContain('/join/')
    expect(() => parseJoinUrl('https://192.168.1.5:1234/join/ABCDEFGHJKLMNPQR')).toThrow()
    expect(() => parseJoinUrl('http://8.8.8.8:1234/join/ABCDEFGHJKLMNPQR')).toThrow()
    expect(() => parseJoinUrl('http://192.168.1.5:1234/other/ABCDEFGHJKLMNPQR')).toThrow()
  })
})

describe('guest table authority', () => {
  it('rejects another player’s card and private host controls', () => {
    const state = started()
    expect(() => checkedGuestAction(state, 'banker-player-1', { type: 'record-card', playerId: 'banker-player-2', card: card('number-5') })).toThrow()
    expect(() => checkedGuestAction(state, 'banker-player-1', { type: 'advance-round' })).toThrow()
    expect(() => checkedGuestAction(state, 'banker-player-1', { type: 'player', playerId: 'banker-player-2', action: { type: 'remove', index: 0 } })).toThrow()
  })

  it('replaces forged card details with the bundled card catalog', () => {
    const action = checkedGuestAction(started(), 'banker-player-1', { type: 'record-card', playerId: 'banker-player-1', card: { id: 'number-5', points: 5000, kind: 'modifier' } })
    expect(action).toEqual({ type: 'record-card', playerId: 'banker-player-1', card: card('number-5') })
  })

  it('allows correction only for a card on the guest’s active or busted table', () => {
    const state = bankerReducer(started(), { type: 'record-card', playerId: 'banker-player-1', card: card('number-5') })
    expect(checkedGuestAction(state, 'banker-player-1', { type: 'player', playerId: 'banker-player-1', action: { type: 'remove', index: 0 } })).toEqual({ type: 'player', playerId: 'banker-player-1', action: { type: 'remove', index: 0 } })
    expect(() => checkedGuestAction(state, 'banker-player-1', { type: 'player', playerId: 'banker-player-1', action: { type: 'remove', index: 1 } })).toThrow()
    const actionOnTable = { ...state, players: state.players.map(player => player.id === 'banker-player-1' ? { ...player, round: { ...player.round, entries: [{ instanceId: 'demo-card-1', card: card('action-freeze'), voided: false }] } } : player) }
    expect(() => checkedGuestAction(actionOnTable, 'banker-player-1', { type: 'player', playerId: 'banker-player-1', action: { type: 'remove', index: 0 } })).toThrow()
    const stayed = { ...state, players: state.players.map(player => player.id === 'banker-player-1' ? { ...player, round: { ...player.round, status: 'stayed' as const } } : player) }
    expect(() => checkedGuestAction(stayed, 'banker-player-1', { type: 'player', playerId: 'banker-player-1', action: { type: 'remove', index: 0 } })).toThrow()
  })
})
