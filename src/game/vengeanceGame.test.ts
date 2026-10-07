import { describe, expect, it } from 'vitest'
import { vengeanceCard, vengeanceCards } from './vengeanceCards'
import { vengeanceEligibleActors, vengeanceEligibleCards, vengeanceInitialState, vengeanceReducer, vengeanceScore, type VEntry, type VPlayer, type VState } from './vengeanceGame'

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

  it('steals a card between active hands, can bust, and undoes both hands together', () => {
    const initial = round([player('a', ['v-number-13']), player('b', ['v-number-13']), player('c', [])])
    const next = resolve(initial, 'v-action-steal', 'a', ['b-0'])
    expect(next.players[0].status).toBe('busted')
    expect(next.players[0].entries).toHaveLength(3)
    expect(next.players[0].entries[2].card.id).toBe('v-action-steal')
    expect(next.players[0].entries[2].voided).toBe(true)
    expect(next.players[1].entries).toHaveLength(0)
    const undone = vengeanceReducer(next, { type: 'undo' })
    expect(undone.players[0].status).toBe('active')
    expect(undone.players[0].entries).toHaveLength(1)
    expect(undone.players[1].entries).toHaveLength(1)
  })

  it('does not allow actions or modifiers to target stayed, frozen, or busted players', () => {
    const state = round([player('a', ['v-number-2']), player('b', ['v-number-5'], 'stayed'), player('c', ['v-number-8'], 'frozen')])
    const pendingSteal: VState = { ...state, pending: { card: vengeanceCard('v-action-steal')!, sourceId: 'a', selectedCards: [] } }
    // Only 'a' is active, but stealing from self is invalid, so 0 eligible actors
    expect(vengeanceEligibleActors(pendingSteal)).toHaveLength(0)

    const pendingModifier: VState = { ...state, pending: { card: vengeanceCard('v-modifier-minus-2')!, sourceId: 'a', selectedCards: [] } }
    expect(vengeanceEligibleActors(pendingModifier).map(p => p.id)).toEqual(['a'])

    const pendingJustOneMore: VState = { ...state, pending: { card: vengeanceCard('v-action-just-one-more')!, sourceId: 'a', selectedCards: [] } }
    expect(vengeanceEligibleActors(pendingJustOneMore).map(p => p.id)).toEqual(['a'])
  })

  it('cancels pending action dialog with cancel-pending or undo even if past is empty', () => {
    const initial: VState = { ...round([player('a', ['v-number-2']), player('b', [])]), past: [] }
    const withPending: VState = { ...initial, pending: { card: vengeanceCard('v-action-just-one-more')!, sourceId: 'a', selectedCards: [] } }
    const canceled = vengeanceReducer(withPending, { type: 'cancel-pending' })
    expect(canceled.pending).toBeNull()

    const undone = vengeanceReducer(withPending, { type: 'undo' })
    expect(undone.pending).toBeNull()
  })
  it('a swap can bust both players', () => {
    const initial = round([player('a', ['v-number-10', 'v-number-11']), player('b', ['v-number-10', 'v-number-11']), player('c', [])])
    const next = resolve(initial, 'v-action-swap', 'c', ['a-0', 'b-1'])
    expect(next.players.slice(0, 2).map(item => item.status)).toEqual(['busted', 'busted'])
  })

  it('Unlucky 7 discards prior cards by marking them voided before a matching seven can bust', () => {
    let state = round([player('a', ['v-number-7', 'v-modifier-minus-2']), player('b', []), player('c', [])])
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-number-unlucky-7' })
    expect(state.players[0].entries.map(item => item.card.id)).toEqual(['v-number-7', 'v-modifier-minus-2', 'v-number-unlucky-7'])
    expect(state.players[0].entries[0].voided).toBe(true)
    expect(state.players[0].entries[1].voided).toBe(true)
    expect(state.players[0].entries[2].voided).toBeFalsy()
    expect(vengeanceScore(state.players[0])).toBe(7)
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

  it('forces use of a valid action and keeps untargetable Swap, Steal, or Discard on flipper table marked voided', () => {
    const noCards = round([player('a', []), player('b', []), player('c', [])])
    const discardedSwap = vengeanceReducer(noCards, { type: 'record', cardId: 'v-action-swap' })
    expect(discardedSwap.pending).toBeNull()
    expect(discardedSwap.events.at(-1)).toContain('no valid target')
    expect(discardedSwap.players[0].entries).toHaveLength(1)
    expect(discardedSwap.players[0].entries[0].card.id).toBe('v-action-swap')
    expect(discardedSwap.players[0].entries[0].voided).toBe(true)

    const discardedSteal = vengeanceReducer(noCards, { type: 'record', cardId: 'v-action-steal' })
    expect(discardedSteal.pending).toBeNull()
    expect(discardedSteal.players[0].entries).toHaveLength(1)
    expect(discardedSteal.players[0].entries[0].card.id).toBe('v-action-steal')
    expect(discardedSteal.players[0].entries[0].voided).toBe(true)

    const discardedDiscard = vengeanceReducer(noCards, { type: 'record', cardId: 'v-action-discard' })
    expect(discardedDiscard.pending).toBeNull()
    expect(discardedDiscard.players[0].entries).toHaveLength(1)
    expect(discardedDiscard.players[0].entries[0].card.id).toBe('v-action-discard')
    expect(discardedDiscard.players[0].entries[0].voided).toBe(true)

    const withCard = round([player('a', []), player('b', ['v-number-3']), player('c', [])])
    const pending = vengeanceReducer(withCard, { type: 'record', cardId: 'v-action-steal' })
    expect(vengeanceEligibleActors(pending).map(item => item.id)).toContain('a')
    expect(vengeanceReducer(pending, { type: 'choose-actor', playerId: 'b' })).toBe(pending)

    const onlyOwnCards = round([player('a', ['v-number-3']), player('b', []), player('c', [])])
    const ownSteal = vengeanceReducer(onlyOwnCards, { type: 'record', cardId: 'v-action-steal' })
    expect(ownSteal.pending).toBeNull()
    expect(ownSteal.events.at(-1)).toContain('no valid target')
    expect(ownSteal.players[0].entries.at(-1)?.card.id).toBe('v-action-steal')
    expect(ownSteal.players[0].entries.at(-1)?.voided).toBe(true)

    // Swap needs cards on two different players' tables; only one table has cards -> discarded
    const swapOneTable = vengeanceReducer(onlyOwnCards, { type: 'record', cardId: 'v-action-swap' })
    expect(swapOneTable.pending).toBeNull()
    expect(swapOneTable.events.at(-1)).toContain('no valid target')

    // Discard can hit the revealer's own card, so it stays pending
    const discardOwn = vengeanceReducer(onlyOwnCards, { type: 'record', cardId: 'v-action-discard' })
    expect(discardOwn.pending?.card.id).toBe('v-action-discard')
    expect(vengeanceEligibleCards(discardOwn).map(face => face.entry.card.id)).toEqual(['v-number-3'])

    // The in-play Just One More marker is not a legal target for Discard
    let forcedState = round([player('a', []), player('b', []), player('c', [])])
    forcedState = vengeanceReducer(forcedState, { type: 'record', cardId: 'v-action-just-one-more' })
    forcedState = vengeanceReducer(forcedState, { type: 'choose-actor', playerId: 'a' })
    const discardMarker = vengeanceReducer(forcedState, { type: 'record', cardId: 'v-action-discard' })
    expect(discardMarker.pending).toBeNull()
    expect(discardMarker.events.at(-1)).toContain('no valid target')
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
    expect(state.players[1].entries.find(e => e.card.id === 'v-number-4')?.voided).toBe(true)
    expect(state.players[1].entries.find(e => e.card.id === 'v-action-discard')?.voided).toBe(true)
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

  it('updates hand and scores for an active Flip Four recipient', () => {
    let state = round([player('a', []), player('b', ['v-number-2']), player('c', [])])
    state = resolve(state, 'v-action-flip-four', 'b')
    for (const cardId of ['v-number-3', 'v-number-4', 'v-number-5', 'v-number-6']) state = vengeanceReducer(state, { type: 'record', cardId })
    expect(state.players[1].status).toBe('active')
    expect(state.players[1].entries).toHaveLength(6)
    expect(vengeanceScore(state.players[1])).toBe(20)
  })

  it('continues the initial deal after Just One More makes its first recipient freeze', () => {
    let state = vengeanceInitialState(roster)
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-action-just-one-more' })
    state = vengeanceReducer(state, { type: 'choose-actor', playerId: 'b' })
    state = vengeanceReducer(state, { type: 'confirm' })
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-number-1' })
    expect(state.players[1].status).toBe('frozen')
    expect(state.players[1].entries.map(e => e.card.id)).toEqual(['v-action-just-one-more', 'v-number-1'])
    expect(state.phase).toBe('deal')
    // Next deal turn advances to 'c' because 'b' is already frozen
    expect(state.turnPlayerId).toBe('c')
  })

  it('freezes the target player, transfers the card, and advances turn away from them on Just One More in turn phase', () => {
    // 3 players with 1 card each in turn phase, turn is on player 'a'
    let state = round([player('a', ['v-number-1']), player('b', ['v-number-2']), player('c', ['v-number-3'])])
    expect(state.turnPlayerId).toBe('a')

    // Player 'a' plays Just One More on player 'b'
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-action-just-one-more' })
    state = vengeanceReducer(state, { type: 'choose-actor', playerId: 'b' })

    // Forced flip for 'b'
    expect(state.forced[0]?.targetId).toBe('b')
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-number-4' })

    // 'b' is now frozen with 3 cards ('v-number-2', 'v-action-just-one-more', 'v-number-4') and 6 points
    expect(state.players[1].status).toBe('frozen')
    expect(state.players[1].entries.map(e => e.card.id)).toEqual(['v-number-2', 'v-action-just-one-more', 'v-number-4'])
    expect(vengeanceScore(state.players[1])).toBe(6)

    // Turn advances past 'a' and skips 'b' (who is frozen), landing on 'c'
    expect(state.phase).toBe('turn')
    expect(state.turnPlayerId).toBe('c')

    // When 'c' takes a card, next turn goes back to 'a' (skipping frozen 'b')
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-number-5' })
    expect(state.turnPlayerId).toBe('a')
  })

  it('starts the initial deal with player 1 and starts next round with the round finisher', () => {
    let state = vengeanceInitialState(roster)
    expect(state.turnPlayerId).toBe('a')
    for (const cardId of ['v-number-1', 'v-number-2', 'v-number-3']) state = vengeanceReducer(state, { type: 'record', cardId })
    expect(state.phase).toBe('turn')
    expect(state.turnPlayerId).toBe('a')

    // Cannot stay with only 1 number card
    const cannotStayState = vengeanceReducer(state, { type: 'stay' })
    expect(cannotStayState.players[0].status).toBe('active')
    expect(cannotStayState.turnPlayerId).toBe('a')

    // Hit to get second number card for each player
    for (const cardId of ['v-number-4', 'v-number-5', 'v-number-6']) state = vengeanceReducer(state, { type: 'record', cardId })
    expect(state.players[0].entries).toHaveLength(2)

    // Now all players have at least 2 number cards and can stay
    for (let i = 0; i < 3; i++) state = vengeanceReducer(state, { type: 'stay' })
    expect(state.phase).toBe('settlement')
    expect(state.roundFinisherId).toBe('c')
    state = vengeanceReducer(state, { type: 'advance-round' })
    expect(state.dealerId).toBe('c')
    expect(state.turnPlayerId).toBe('c')
    expect(state.selectedPlayerId).toBe('c')
  })

  it('supports fluid card selection, toggling, and switching for Steal, Swap, and Discard', () => {
    let state = round([player('a', ['v-number-1', 'v-number-2']), player('b', ['v-number-3', 'v-number-4']), player('c', ['v-number-5'])])
    
    // Test Steal selection & deselect
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-action-steal' })
    state = vengeanceReducer(state, { type: 'choose-actor', playerId: 'a' })
    state = vengeanceReducer(state, { type: 'choose-card', instanceId: 'b-0' })
    expect(state.pending?.selectedCards).toEqual(['b-0'])
    // Switch to another card
    state = vengeanceReducer(state, { type: 'choose-card', instanceId: 'c-0' })
    expect(state.pending?.selectedCards).toEqual(['c-0'])
    // Deselect
    state = vengeanceReducer(state, { type: 'choose-card', instanceId: 'c-0' })
    expect(state.pending?.selectedCards).toEqual([])
    
    // Change actor
    state = vengeanceReducer(state, { type: 'choose-actor', playerId: '' })
    expect(state.pending?.actorId).toBeUndefined()
    state = vengeanceReducer(state, { type: 'choose-actor', playerId: 'b' })
    expect(state.pending?.actorId).toBe('b')

    // Test Swap multi-slot selection
    let swapState = round([player('a', ['v-number-1', 'v-number-2']), player('b', ['v-number-3']), player('c', ['v-number-5'])])
    swapState = vengeanceReducer(swapState, { type: 'record', cardId: 'v-action-swap' })
    swapState = vengeanceReducer(swapState, { type: 'choose-actor', playerId: 'a' })
    // Pick 1st card from a
    swapState = vengeanceReducer(swapState, { type: 'choose-card', instanceId: 'a-0' })
    expect(swapState.pending?.selectedCards).toEqual(['a-0'])
    // Switch 1st card from a to another card of a
    swapState = vengeanceReducer(swapState, { type: 'choose-card', instanceId: 'a-1' })
    expect(swapState.pending?.selectedCards).toEqual(['a-1'])
    // Pick 2nd card from b
    swapState = vengeanceReducer(swapState, { type: 'choose-card', instanceId: 'b-0' })
    expect(swapState.pending?.selectedCards).toEqual(['a-1', 'b-0'])
    // Switch 2nd card to c
    swapState = vengeanceReducer(swapState, { type: 'choose-card', instanceId: 'c-0' })
    expect(swapState.pending?.selectedCards).toEqual(['a-1', 'c-0'])
    // Deselect 2nd card
    swapState = vengeanceReducer(swapState, { type: 'choose-card', instanceId: 'c-0' })
    expect(swapState.pending?.selectedCards).toEqual(['a-1'])

    // Single click undo immediately closes the modal and cancels the action card
    const canceled = vengeanceReducer(swapState, { type: 'undo' })
    expect(canceled.pending).toBeNull()
    expect(canceled.past.length).toBe(round([]).past.length)
  })

  it('handles drawing next cards when holding The Zero', () => {
    // Initial deal with The Zero for player 'a'
    let state = vengeanceInitialState(roster)
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-number-zero' })
    expect(state.players[0].entries[0].card.id).toBe('v-number-zero')
    expect(state.turnPlayerId).toBe('b')

    // Deal to b and c
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-number-1' })
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-number-2' })
    expect(state.phase).toBe('turn')
    expect(state.turnPlayerId).toBe('a')

    // Now player 'a' holds The Zero and chooses the next card
    for (const card of vengeanceCards) {
      const testState = vengeanceReducer(state, { type: 'record', cardId: card.id })
      expect(testState).toBeDefined()
    }

    // 2-player flow where player 'b' stays and 'a' keeps hitting with The Zero
    let twoPlayer = vengeanceInitialState(roster.slice(0, 2))
    twoPlayer = vengeanceReducer(twoPlayer, { type: 'record', cardId: 'v-number-zero' })
    twoPlayer = vengeanceReducer(twoPlayer, { type: 'record', cardId: 'v-number-5' })
    expect(twoPlayer.phase).toBe('turn')
    expect(twoPlayer.turnPlayerId).toBe('a')

    // Player 'a' hits with card 2
    twoPlayer = vengeanceReducer(twoPlayer, { type: 'record', cardId: 'v-number-2' })
    expect(twoPlayer.turnPlayerId).toBe('b')

    // Player 'b' hits with card 7, then on their next turn has 2 cards and stays
    twoPlayer = vengeanceReducer(twoPlayer, { type: 'record', cardId: 'v-number-7' })
    expect(twoPlayer.turnPlayerId).toBe('a')

    // Player 'a' hits with card 3
    twoPlayer = vengeanceReducer(twoPlayer, { type: 'record', cardId: 'v-number-3' })
    expect(twoPlayer.turnPlayerId).toBe('b')

    // Player 'b' now has 2 number cards (5, 7) and stays
    twoPlayer = vengeanceReducer(twoPlayer, { type: 'stay' })
    expect(twoPlayer.players[1].status).toBe('stayed')
    expect(twoPlayer.turnPlayerId).toBe('a')

    // Player 'a' draws cards continuously until Flip 7
    for (const id of ['v-number-4', 'v-number-6', 'v-number-8', 'v-number-9']) {
      expect(twoPlayer.turnPlayerId).toBe('a')
      twoPlayer = vengeanceReducer(twoPlayer, { type: 'record', cardId: id })
    }
    expect(twoPlayer.players[0].status).toBe('flip-seven')
    expect(twoPlayer.phase).toBe('settlement')
    expect(vengeanceScore(twoPlayer.players[0])).toBe(0 + 2 + 3 + 4 + 6 + 8 + 9 + 15)
  })

  it('immediately applies modifiers upon choose-target without needing confirm', () => {
    let state = round([player('a', ['v-number-5']), player('b', ['v-number-8']), player('c', [])])
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-modifier-minus-4' })
    expect(state.pending?.card.id).toBe('v-modifier-minus-4')
    state = vengeanceReducer(state, { type: 'choose-target', playerId: 'b' })
    expect(state.pending).toBeNull()
    expect(state.players[1].entries.map(e => e.card.id)).toContain('v-modifier-minus-4')
  })

  it('immediately applies forced action upon choose-actor without needing confirm', () => {
    let state = round([player('a', ['v-number-5']), player('b', ['v-number-8']), player('c', [])])
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-action-just-one-more' })
    expect(state.pending?.card.id).toBe('v-action-just-one-more')
    state = vengeanceReducer(state, { type: 'choose-actor', playerId: 'b' })
    expect(state.pending).toBeNull()
    expect(state.forced[0]).toEqual({
      kind: 'one',
      targetId: 'b',
      remaining: 1,
      deferred: [],
      actionInstanceId: 'v-card-1'
    })
    expect(state.players[1].entries.find(e => e.card.id === 'v-action-just-one-more')?.voided).toBe(false)
  })

  it('keeps Swap card on the flipper table marked as voided after swapping cards', () => {
    // Player 'a' flips Swap and swaps a card between player 'b' and player 'c'
    let state = round([player('a', ['v-number-2']), player('b', ['v-number-5']), player('c', ['v-number-9'])])
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-action-swap' })
    state = vengeanceReducer(state, { type: 'choose-actor', playerId: 'a' })
    state = vengeanceReducer(state, { type: 'choose-card', instanceId: 'b-0' })
    state = vengeanceReducer(state, { type: 'choose-card', instanceId: 'c-0' })
    state = vengeanceReducer(state, { type: 'confirm' })

    // Swap card stays on 'a' (the flipper) and is voided
    expect(state.players[0].entries.find(e => e.card.id === 'v-action-swap')?.voided).toBe(true)
    // b received 9, c received 5
    expect(state.players[1].entries.some(e => e.card.id === 'v-number-9')).toBe(true)
    expect(state.players[2].entries.some(e => e.card.id === 'v-number-5')).toBe(true)
  })

  it('transfers Discard card to targeted player table voided, and marks chosen discarded card voided', () => {
    // Player 'a' flips Discard and targets player 'b's 5
    let state = round([player('a', ['v-number-2']), player('b', ['v-number-5']), player('c', [])])
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-action-discard' })
    state = vengeanceReducer(state, { type: 'choose-actor', playerId: 'a' })
    state = vengeanceReducer(state, { type: 'choose-card', instanceId: 'b-0' })
    state = vengeanceReducer(state, { type: 'confirm' })

    // Discard card is transferred to 'b' (the target whose card was discarded) and is voided
    expect(state.players[1].entries.find(e => e.card.id === 'v-action-discard')?.voided).toBe(true)
    // 'a' has only their original 2
    expect(state.players[0].entries.map(e => e.card.id)).toEqual(['v-number-2'])
    // 'b' still has the card in entries, but it is marked voided
    const bCard = state.players[1].entries.find(e => e.card.id === 'v-number-5')
    expect(bCard?.voided).toBe(true)
    // Neither counts towards b's score
    expect(vengeanceScore(state.players[1])).toBe(0)
  })

  it('allows removing and replacing a card from player table, updating score and bust status', () => {
    // Player 'a' had a duplicate 5 causing a bust
    let state = round([player('a', ['v-number-5', 'v-number-5'], 'busted'), player('b', ['v-number-3'])])
    expect(state.players[0].status).toBe('busted')

    // Replace the duplicate 5 with a 6
    state = vengeanceReducer(state, {
      type: 'replace-card',
      playerId: 'a',
      instanceId: 'a-1',
      cardId: 'v-number-6',
    })
    expect(state.players[0].status).toBe('active')
    expect(vengeanceScore(state.players[0])).toBe(11)

    // Remove the 6
    state = vengeanceReducer(state, {
      type: 'remove-card',
      playerId: 'a',
      instanceId: 'a-1',
    })
    expect(state.players[0].entries).toHaveLength(1)
    expect(vengeanceScore(state.players[0])).toBe(5)
  })

  describe('Brutal Mode rules', () => {
    it('allows round scores to go below zero with negative modifiers', () => {
      // 5 points minus 10 modifier = -5 in Brutal Mode
      const p = player('a', ['v-number-5', 'v-modifier-minus-10'])
      expect(vengeanceScore(p, 'standard')).toBe(0)
      expect(vengeanceScore(p, 'brutal')).toBe(-5)
    })

    it('allows busted players to receive negative modifiers and score negative in Brutal Mode', () => {
      const bustedWithMod = player('a', ['v-number-5', 'v-number-5', 'v-modifier-minus-6'], 'busted')
      expect(vengeanceScore(bustedWithMod, 'standard')).toBe(0)
      expect(vengeanceScore(bustedWithMod, 'brutal')).toBe(-6)
    })

    it('discards ÷2 if given to a busted player in Brutal Mode with no effect', () => {
      let state = round([player('a', ['v-number-2']), player('b', ['v-number-5', 'v-number-5'], 'busted')])
      state = { ...state, variant: 'brutal', pending: { card: vengeanceCard('v-modifier-half')!, sourceId: 'a', selectedCards: [] } }
      expect(vengeanceEligibleActors(state)).toHaveLength(2)

      const after = vengeanceReducer(state, { type: 'choose-target', playerId: 'b' })
      expect(after.pending).toBeNull()
      expect(after.players[1].entries.some(e => e.card.id === 'v-modifier-half' && e.voided)).toBe(true)
      expect(vengeanceScore(after.players[1], 'brutal')).toBe(0)
      expect(after.events.some(e => e.includes('÷2 while busted; it had no effect and was discarded'))).toBe(true)
    })

    it('allows targeting busted players with negative modifiers in Brutal Mode', () => {
      let state = round([player('a', ['v-number-2']), player('b', ['v-number-5', 'v-number-5'], 'busted')])
      state = { ...state, variant: 'brutal', pending: { card: vengeanceCard('v-modifier-minus-8')!, sourceId: 'a', selectedCards: [] } }
      expect(vengeanceEligibleActors(state)).toHaveLength(2)

      const after = vengeanceReducer(state, { type: 'choose-target', playerId: 'b' })
      expect(after.pending).toBeNull()
      expect(after.players[1].entries.some(e => e.card.id === 'v-modifier-minus-8' && !e.voided)).toBe(true)
      expect(vengeanceScore(after.players[1], 'brutal')).toBe(-8)
    })

    it('handles Flip 7 choice in Brutal Mode: claim self (+15) vs penalize rival (-15)', () => {
      const pA = player('a', ['v-number-1', 'v-number-2', 'v-number-3', 'v-number-4', 'v-number-5', 'v-number-6', 'v-number-7'], 'flip-seven')
      const pB = player('b', ['v-number-10'])

      // When choosing self:
      expect(vengeanceScore(pA, 'brutal', { finisherId: 'a', choice: 'self' })).toBe(28 + 15) // 43
      expect(vengeanceScore(pB, 'brutal', { finisherId: 'a', choice: 'self' })).toBe(10)

      // When choosing penalize:
      expect(vengeanceScore(pA, 'brutal', { finisherId: 'a', choice: 'penalize', targetId: 'b' })).toBe(28)
      expect(vengeanceScore(pB, 'brutal', { finisherId: 'a', choice: 'penalize', targetId: 'b' })).toBe(10 - 15) // -5

      // Can penalize a busted opponent:
      const pBusted = player('b', ['v-number-5', 'v-number-5'], 'busted')
      expect(vengeanceScore(pBusted, 'brutal', { finisherId: 'a', choice: 'penalize', targetId: 'b' })).toBe(-15)
    })

    it('requires resolving Flip 7 decision before advancing round, and accumulates negative total score', () => {
      let state = round([
        player('a', ['v-number-1', 'v-number-2', 'v-number-3', 'v-number-4', 'v-number-5', 'v-number-6', 'v-number-7'], 'flip-seven'),
        player('b', ['v-number-5', 'v-number-5'], 'busted')
      ])
      state = { ...state, variant: 'brutal', phase: 'settlement', pendingFlipSeven: { finisherId: 'a' } }

      // Advance round should be blocked while pendingFlipSeven
      const blocked = vengeanceReducer(state, { type: 'advance-round' })
      expect(blocked.roundNumber).toBe(1)

      // Resolve Flip 7 penalizing 'b'
      const resolved = vengeanceReducer(state, { type: 'resolve-flip-seven', choice: 'penalize', targetPlayerId: 'b' })
      expect(resolved.pendingFlipSeven).toBeNull()
      expect(resolved.flipSevenChoice).toEqual({ finisherId: 'a', choice: 'penalize', targetId: 'b' })

      // Now advance round
      const nextRound = vengeanceReducer(resolved, { type: 'advance-round' })
      expect(nextRound.roundNumber).toBe(2)
      expect(nextRound.players.find(p => p.id === 'a')?.totalScore).toBe(28)
      expect(nextRound.players.find(p => p.id === 'b')?.totalScore).toBe(-15) // Cumulative total goes below zero!
    })
  })
})



