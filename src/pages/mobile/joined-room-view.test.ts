import { describe, expect, it } from 'vitest'
import { bankerInitialState, bankerReducer } from '../../game/bankerGame'
import { pickerCards } from '../../game/cards'
import { vengeanceCard } from '../../game/vengeanceCards'
import { vengeanceInitialState } from '../../game/vengeanceGame'
import type { Room } from '../../lib/room-store'
import { joinedRoomView } from './joined-room-view'

describe('joined player Stay rights', () => {
  it('follows the host’s minimum in Classic and Vengeance', () => {
    const roster = ['Ana', 'Ben'].map((name, index) => ({ id: `seat-${index}`, name, color: '#132d67' }))
    let classic = bankerReducer(bankerInitialState(), { type: 'start', targetScore: 200, names: roster.map(player => player.name), minimumNumberCardsToStay: 3 })
    classic = { ...classic, players: classic.players.map((player, index) => ({ ...player, ...roster[index] })), turnPlayerId: roster[0].id }
    const room: Room = { id: 'room', name: 'Friday', createdAt: 1, updatedAt: 1, targetScore: 200, roster, pinned: false, state: classic, minimumNumberCardsToStay: 3 }
    for (const number of [1, 2, 3]) {
      classic = bankerReducer(classic, { type: 'player', playerId: roster[0].id, action: { type: 'add', card: pickerCards.find(card => card.id === `number-${number}`)! } })
      expect(joinedRoomView({ ...room, state: classic }, roster[0].id, true).mayBank).toBe(number === 3)
    }

    const vengeance = vengeanceInitialState(roster, 200, roster[0].id, 'standard', 3)
    const vengeanceRoom: Room = { ...room, edition: 'vengeance', state: null, vengeanceState: { ...vengeance, phase: 'turn', players: vengeance.players.map((player, index) => index === 0 ? { ...player, entries: [1, 2].map(number => ({ instanceId: `card-${number}`, card: vengeanceCard(`v-number-${number}`)! })) } : player) } }
    expect(joinedRoomView(vengeanceRoom, roster[0].id, true).mayBank).toBe(false)
    const ready = { ...vengeanceRoom, vengeanceState: { ...vengeanceRoom.vengeanceState!, players: vengeanceRoom.vengeanceState!.players.map((player, index) => index === 0 ? { ...player, entries: [...player.entries, { instanceId: 'card-3', card: vengeanceCard('v-number-3')! }] } : player) } }
    expect(joinedRoomView(ready, roster[0].id, true).mayBank).toBe(true)
  })
})
