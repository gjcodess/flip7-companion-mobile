import { describe, expect, it } from 'vitest'
import { vengeanceCard } from './vengeanceCards'
import { vengeanceEligibleActors, vengeanceInitialState, vengeanceReducer, vengeanceScore, type VEntry, type VPlayer, type VState } from './vengeanceGame'

const roster = [
  { id: 'a', name: 'Ari', color: '#e93234' },
  { id: 'b', name: 'Bea', color: '#193c89' },
  { id: 'c', name: 'Cal', color: '#da8736' },
]
const entry = (id: string, instanceId: string): VEntry => ({ instanceId, card: vengeanceCard(id)! })
const player = (id: string, cards: string[], status: VPlayer['status'] = 'active'): VPlayer => ({ ...roster.find(item => item.id === id)!, totalScore: 0, status, entries: cards.map((card, i) => entry(card, `${id}-${i}`)) })
const round = (players: VPlayer[]): VState => ({ ...vengeanceInitialState(roster), phase: 'turn', turnPlayerId: 'a', selectedPlayerId: 'a', players })
const resolve = (state: VState, cardId: string, actorId: string, cards: string[] = []) => {
  let next: VState = { ...state, pending: { card: vengeanceCard(cardId)!, sourceId: 'a', selectedCards: [] } }
  next = vengeanceReducer(next, { type: 'choose-actor', playerId: actorId })
  for (const instanceId of cards) next = vengeanceReducer(next, { type: 'choose-card', instanceId })
  return vengeanceReducer(next, { type: 'confirm' })
}

describe('Vengeance rules', () => {
  it('scores ÷2 before penalties, clamps at zero, then adds the Flip 7 bonus', () => {
    expect(vengeanceScore(player('a', ['v-number-13', 'v-number-9', 'v-modifier-half', 'v-modifier-minus-4']))).toBe(7)
    expect(vengeanceScore(player('a', ['v-number-1', 'v-modifier-minus-10']))).toBe(0)
    expect(vengeanceScore(player('a', ['v-number-zero', 'v-number-13']))).toBe(0)
    expect(vengeanceScore(player('a', ['v-number-zero', 'v-number-1', 'v-number-2', 'v-number-3', 'v-number-4', 'v-number-5', 'v-number-6'], 'flip-seven'))).toBe(36)
  })

  it('steals a card into a stayed hand, can bust it, and undoes both hands together', () => {
    const initial = round([player('a', ['v-number-13'], 'stayed'), player('b', ['v-number-13']), player('c', [])])
    const next = resolve(initial, 'v-action-steal', 'a', ['b-0'])
    expect(next.players[0].status).toBe('busted')
    expect(next.players[0].entries).toHaveLength(2)
    expect(next.players[1].entries).toHaveLength(0)
    const undone = vengeanceReducer(next, { type: 'undo' })
    expect(undone.players[0].status).toBe('stayed')
    expect(undone.players[0].entries).toHaveLength(1)
    expect(undone.players[1].entries).toHaveLength(1)
  })

  it('a swap can bust both players', () => {
    const initial = round([player('a', ['v-number-10', 'v-number-11']), player('b', ['v-number-10', 'v-number-11']), player('c', [])])
    const next = resolve(initial, 'v-action-swap', 'c', ['a-0', 'b-1'])
    expect(next.players.slice(0, 2).map(item => item.status)).toEqual(['busted', 'busted'])
  })

  it('Unlucky 7 discards prior cards before a matching seven can bust', () => {
    let state = round([player('a', ['v-number-7', 'v-modifier-minus-2']), player('b', []), player('c', [])])
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-number-unlucky-7' })
    expect(state.players[0].entries.map(item => item.card.id)).toEqual(['v-number-unlucky-7'])
    expect(state.players[0].status).toBe('active')
    state = vengeanceReducer({ ...state, phase: 'turn', turnPlayerId: 'a' }, { type: 'record', cardId: 'v-number-7' })
    expect(state.players[0].status).toBe('busted')
  })

  it('Lucky 13 allows one other 13 but a third busts', () => {
    let state = round([player('a', ['v-number-lucky-13']), player('b', []), player('c', [])])
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-number-13' })
    expect(state.players[0].status).toBe('active')
    state = vengeanceReducer({ ...state, phase: 'turn', turnPlayerId: 'a' }, { type: 'record', cardId: 'v-number-13' })
    expect(state.players[0].status).toBe('busted')
  })

  it('forces use of a valid action and discards an untargetable one', () => {
    const noCards = round([player('a', []), player('b', []), player('c', [])])
    const discarded = vengeanceReducer(noCards, { type: 'record', cardId: 'v-action-swap' })
    expect(discarded.pending).toBeNull()
    expect(discarded.events.at(-1)).toContain('no valid target')
    const withCard = round([player('a', []), player('b', ['v-number-3']), player('c', [])])
    const pending = vengeanceReducer(withCard, { type: 'record', cardId: 'v-action-steal' })
    expect(vengeanceEligibleActors(pending).map(item => item.id)).toContain('a')
    expect(vengeanceReducer(pending, { type: 'choose-actor', playerId: 'b' })).toBe(pending)
  })

  it('resolves queued Flip Four actions after four reveals, even if Just One More then busts', () => {
    let state = round([player('a', ['v-number-13']), player('b', ['v-number-4']), player('c', [])])
    state = resolve(state, 'v-action-flip-four', 'b')
    for (const id of ['v-action-just-one-more', 'v-action-discard', 'v-number-5', 'v-number-6']) state = vengeanceReducer(state, { type: 'record', cardId: id })
    expect(state.pending?.card.id).toBe('v-action-just-one-more')
    state = vengeanceReducer(state, { type: 'choose-actor', playerId: 'a' })
    state = vengeanceReducer(state, { type: 'confirm' })
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-number-13' })
    expect(state.players[0].status).toBe('busted')
    expect(state.pending?.card.id).toBe('v-action-discard')
    state = vengeanceReducer(state, { type: 'choose-actor', playerId: 'b' })
    state = vengeanceReducer(state, { type: 'choose-card', instanceId: 'b-0' })
    state = vengeanceReducer(state, { type: 'confirm' })
    expect(state.players[1].entries.map(item => item.card.id)).not.toContain('v-number-4')
  })

  it('drops queued Flip Four actions after an early bust', () => {
    let state = round([player('a', ['v-number-5']), player('b', ['v-number-2']), player('c', [])])
    state = resolve(state, 'v-action-flip-four', 'a')
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-action-swap' })
    expect(state.forced[0].deferred).toHaveLength(1)
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-number-5' })
    expect(state.players[0].status).toBe('busted')
    expect(state.pending).toBeNull()
    expect(state.resolving).toHaveLength(0)
    expect(state.events.some(event => event.includes('queued card effect') && event.includes('discarded'))).toBe(true)
  })

  it('stops Flip Four and ends the round when its first reveal completes Flip 7', () => {
    let state = round([player('a', ['v-number-1', 'v-number-2', 'v-number-3', 'v-number-4', 'v-number-5', 'v-number-6']), player('b', []), player('c', [])])
    state = resolve(state, 'v-action-flip-four', 'a')
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-number-7' })
    expect(state.players[0].status).toBe('flip-seven')
    expect(state.phase).toBe('settlement')
    expect(state.forced).toHaveLength(0)
    expect(vengeanceScore(state.players[0])).toBe(43)
  })

  it('keeps a stayed Flip Four recipient inactive while updating their hand', () => {
    let state = round([player('a', []), player('b', ['v-number-2'], 'stayed'), player('c', [])])
    state = resolve(state, 'v-action-flip-four', 'b')
    for (const cardId of ['v-number-3', 'v-number-4', 'v-number-5', 'v-number-6']) state = vengeanceReducer(state, { type: 'record', cardId })
    expect(state.players[1].status).toBe('stayed')
    expect(state.players[1].entries).toHaveLength(5)
    expect(vengeanceScore(state.players[1])).toBe(20)
  })

  it('continues the initial deal after Just One More makes its first recipient stay', () => {
    let state = vengeanceInitialState(roster)
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-action-just-one-more' })
    state = vengeanceReducer(state, { type: 'choose-actor', playerId: 'b' })
    state = vengeanceReducer(state, { type: 'confirm' })
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-number-1' })
    expect(state.players[1].status).toBe('stayed')
    expect(state.phase).toBe('deal')
    expect(state.turnPlayerId).toBe('b')
  })

  it('starts the initial deal with player 1 and passes the dealer each round', () => {
    let state = vengeanceInitialState(roster)
    expect(state.turnPlayerId).toBe('a')
    for (const cardId of ['v-number-1', 'v-number-2', 'v-number-3']) state = vengeanceReducer(state, { type: 'record', cardId })
    expect(state.phase).toBe('turn')
    expect(state.turnPlayerId).toBe('a')
    for (let i = 0; i < 3; i++) state = vengeanceReducer(state, { type: 'stay' })
    expect(state.phase).toBe('settlement')
    state = vengeanceReducer(state, { type: 'advance-round' })
    expect(state.dealerId).toBe('a')
    expect(state.turnPlayerId).toBe('b')
  })
})
