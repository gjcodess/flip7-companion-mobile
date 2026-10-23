import { describe, expect, it } from 'vitest'
import { pickerCards, type Card } from './cards'
import { bankerInitialState, bankerReducer, type BankerState } from './bankerGame'

const card = (id: string) => {
  const found = pickerCards.find((candidate) => candidate.id === id)
  if (!found) throw new Error(`Missing card ${id}`)
  return found
}

const numberCard = (value: number) => card(`number-${value}`)
const secondChance = () => card('action-second-chance')
const freeze = () => card('action-freeze')
const flipThree = () => card('action-flip-three')

function start(names = ['Ana', 'Ben', 'Cy']) {
  return bankerReducer(bankerInitialState(), { type: 'start', targetScore: 200, names })
}

function record(state: BankerState, playerId: string, nextCard: Card) {
  return bankerReducer(state, { type: 'record-card', playerId, card: nextCard })
}

function action(state: BankerState, sourcePlayerId: string, targetPlayerId: string, nextCard: Card) {
  return bankerReducer(state, { type: 'record-action', sourcePlayerId, targetPlayerId, card: nextCard })
}

describe('Banker turn progression', () => {
  it('requires the room minimum for voluntary Stay but still lets Freeze settle a short hand', () => {
    let state = bankerReducer(bankerInitialState(), { type: 'start', targetScore: 200, names: ['Ana', 'Ben', 'Cy'], minimumNumberCardsToStay: 3 })
    const a = state.players[0].id
    state = bankerReducer(state, { type: 'player', playerId: a, action: { type: 'add', card: numberCard(1) } })
    expect(bankerReducer(state, { type: 'settle-player', playerId: a })).toBe(state)
    expect(bankerReducer(state, { type: 'player', playerId: a, action: { type: 'stay' } })).toBe(state)
    state = bankerReducer(state, { type: 'player', playerId: a, action: { type: 'add', card: numberCard(2) } })
    expect(bankerReducer(state, { type: 'settle-player', playerId: a })).toBe(state)
    state = bankerReducer(state, { type: 'player', playerId: a, action: { type: 'add', card: numberCard(3) } })
    expect(bankerReducer(state, { type: 'settle-player', playerId: a }).players[0].round.status).toBe('stayed')
    const frozen = action(state, a, state.players[1].id, freeze())
    expect(frozen.players[1].round.status).toBe('frozen')
  })
  it('advances through the configured order and skips terminal tables', () => {
    let state = start()
    state = record(state, 'banker-player-1', numberCard(1))
    expect(state.turnPlayerId).toBe('banker-player-2')
    state = record(state, 'banker-player-2', numberCard(2))
    state = record(state, 'banker-player-3', numberCard(5))
    state = record(state, 'banker-player-1', numberCard(6))
    state = record(state, 'banker-player-2', numberCard(2))
    expect(state.players.find((player) => player.id === 'banker-player-2')?.round.status).toBe('busted')
    expect(state.turnPlayerId).toBe('banker-player-3')
  })

  it('keeps corrections and manual table browsing separate from the turn cursor', () => {
    let state = start()
    state = record(state, 'banker-player-1', numberCard(1))
    const turnBeforeView = state.turnPlayerId
    state = bankerReducer(state, { type: 'select-player', playerId: 'banker-player-3' })
    state = bankerReducer(state, { type: 'player', playerId: 'banker-player-3', action: { type: 'add', card: numberCard(9) } })
    expect(state.selectedPlayerId).toBe('banker-player-3')
    expect(state.turnPlayerId).toBe(turnBeforeView)
  })

  it('restores the turn cursor when undoing and redoing a card', () => {
    let state = record(start(), 'banker-player-1', numberCard(1))
    expect(state.turnPlayerId).toBe('banker-player-2')
    state = bankerReducer(state, { type: 'undo' })
    expect(state.turnPlayerId).toBe('banker-player-1')
    expect(state.players[0].round.entries).toHaveLength(0)
    state = bankerReducer(state, { type: 'redo' })
    expect(state.turnPlayerId).toBe('banker-player-2')
    expect(state.players[0].round.entries.map((entry) => entry.card.id)).toEqual(['number-1'])
  })

  it('restores the full Flip Three queue when undoing and redoing its assignment', () => {
    let state = action(start(), 'banker-player-1', 'banker-player-2', flipThree())
    expect(state.forcedTurns[0]?.targetPlayerId).toBe('banker-player-2')
    state = bankerReducer(state, { type: 'undo' })
    expect(state.forcedTurns).toHaveLength(0)
    expect(state.turnPlayerId).toBe('banker-player-1')
    state = bankerReducer(state, { type: 'redo' })
    expect(state.forcedTurns[0]).toMatchObject({ targetPlayerId: 'banker-player-2', remaining: 3 })
  })

  it('rejects action cards targeted at terminal tables', () => {
    let state = start()
    state = bankerReducer(state, { type: 'player', playerId: 'banker-player-2', action: { type: 'add', card: numberCard(2) } })
    state = bankerReducer(state, { type: 'player', playerId: 'banker-player-2', action: { type: 'add', card: numberCard(3) } })
    state = bankerReducer(state, { type: 'player', playerId: 'banker-player-2', action: { type: 'stay' } })
    const unchanged = action(state, 'banker-player-1', 'banker-player-2', secondChance())
    expect(unchanged).toBe(state)
  })

  it('assigns Second Chance to an active target and advances from the source', () => {
    const state = action(start(), 'banker-player-1', 'banker-player-3', secondChance())
    expect(state.players[2].round.entries.map((entry) => entry.card.id)).toEqual(['action-second-chance'])
    expect(state.turnPlayerId).toBe('banker-player-2')
  })

  it('freezes the target, voids the Freeze card, and skips it in the next normal turn', () => {
    const state = action(start(), 'banker-player-1', 'banker-player-2', freeze())
    expect(state.players[1].round.status).toBe('frozen')
    expect(state.players[1].round.entries[0].voided).toBe(true)
    expect(state.turnPlayerId).toBe('banker-player-3')
  })

  it('routes Flip Three cards one by one, then voids Flip Three and resumes after the source player', () => {
    let state = action(start(), 'banker-player-1', 'banker-player-2', flipThree())
    expect(state.forcedTurns[0]).toMatchObject({ targetPlayerId: 'banker-player-2', remaining: 3, resumeAfterPlayerId: 'banker-player-1' })
    expect(state.players[1].round.entries[0].voided).toBe(false)
    state = record(state, 'banker-player-2', numberCard(1))
    expect(state.players[1].round.entries[0].voided).toBe(false)
    state = record(state, 'banker-player-2', numberCard(2))
    expect(state.players[1].round.entries[0].voided).toBe(false)
    state = record(state, 'banker-player-2', numberCard(3))
    expect(state.forcedTurns).toHaveLength(0)
    expect(state.players[1].round.entries[0].voided).toBe(true)
    expect(state.turnPlayerId).toBe('banker-player-2')
  })

  it('stops a Flip Three sequence and voids Flip Three when the target busts', () => {
    let state = action(start(), 'banker-player-1', 'banker-player-2', flipThree())
    state = record(state, 'banker-player-2', numberCard(4))
    state = record(state, 'banker-player-2', numberCard(4))
    expect(state.players[1].round.status).toBe('busted')
    expect(state.players[1].round.entries[0].voided).toBe(true)
    expect(state.forcedTurns).toHaveLength(0)
    expect(state.turnPlayerId).toBe('banker-player-3')
  })

  it('waits for the original three reveals before assigning a nested Flip Three', () => {
    let state = action(start(), 'banker-player-1', 'banker-player-2', flipThree())
    state = action(state, 'banker-player-2', 'banker-player-3', flipThree())
    expect(state.forcedTurns[0]).toMatchObject({ targetPlayerId: 'banker-player-2', remaining: 2 })
    state = record(state, 'banker-player-2', numberCard(1))
    state = record(state, 'banker-player-2', numberCard(2))
    expect(state.pendingAction?.card.id).toBe('action-flip-three')
    state = action(state, 'banker-player-2', 'banker-player-3', flipThree())
    expect(state.forcedTurns[0]).toMatchObject({ targetPlayerId: 'banker-player-3', remaining: 3 })
    for (const value of [3, 4, 5]) state = record(state, 'banker-player-3', numberCard(value))
    expect(state.forcedTurns).toHaveLength(0)
    expect(state.turnPlayerId).toBe('banker-player-2')
  })

  it('ends the round on Flip 7 and banks all other active tables', () => {
    let state = start()
    for (let value = 0; value < 7; value += 1) {
      state = record(state, 'banker-player-1', numberCard(value))
      if (value < 6) {
        state = record(state, 'banker-player-2', numberCard(value))
        state = record(state, 'banker-player-3', numberCard(value))
      }
    }
    expect(state.players[0].round.status).toBe('flip-seven')
    expect(state.players[1].round.status).toBe('stayed')
    expect(state.players[2].round.status).toBe('stayed')
    expect(state.roundFinisherId).toBe('banker-player-1')
  })

  it('rotates the starting seat after scoring', () => {
    let state = start(['Ana', 'Ben'])
    state = record(state, 'banker-player-1', numberCard(1))
    state = record(state, 'banker-player-2', numberCard(2))
    state = record(state, 'banker-player-1', numberCard(3))
    state = record(state, 'banker-player-2', numberCard(4))
    state = bankerReducer(state, { type: 'settle-player', playerId: 'banker-player-1' })
    state = bankerReducer(state, { type: 'settle-player', playerId: 'banker-player-2' })
    expect(state.roundFinisherId).toBe('banker-player-2')
    state = bankerReducer(state, { type: 'advance-round' })
    expect(state.roundNumber).toBe(2)
    expect(state.turnPlayerId).toBe('banker-player-2')
    expect(state.selectedPlayerId).toBe('banker-player-2')
  })
})


describe('Classic multiplayer rule regressions', () => {
  const a = 'banker-player-1', b = 'banker-player-2', c = 'banker-player-3'
  const reveal = (state: BankerState, sourcePlayerId: string, id: string) => bankerReducer(state, { type: 'reveal-action', sourcePlayerId, card: card(id) })

  it('allows staying with a single Number or lone Modifier', () => {
    for (const id of ['number-5', 'modifier-plus-4']) {
      let state = record(start(), a, card(id))
      state = record(state, b, numberCard(1))
      state = record(state, c, numberCard(2))
      state = bankerReducer(state, { type: 'settle-player', playerId: a })
      expect(state.players[0].round.status).toBe('stayed')
      expect(state.turnPlayerId).toBe(b)
    }
  })

  it('waits to choose a Freeze target and permits assigning it elsewhere after surviving', () => {
    let state = action(start(), a, b, flipThree())
    state = reveal(state, b, 'action-freeze')
    expect(state.pendingAction).toBeFalsy()
    expect(state.players.every(p => p.round.status === 'active')).toBe(true)
    state = record(state, b, numberCard(1))
    state = record(state, b, numberCard(2))
    expect(state.pendingAction?.card.id).toBe('action-freeze')
    expect(bankerReducer(state, { type: 'settle-player', playerId: b })).toBe(state)
    state = action(state, b, c, freeze())
    expect(state.players[2].round.status).toBe('frozen')
    expect(state.players[1].round.status).toBe('active')
    expect(state.forcedTurns).toHaveLength(0)
    expect(state.turnPlayerId).toBe(b)
  })

  it.each([2, 3])('discards queued effects when forced reveal %i busts', revealCount => {
    let state = bankerReducer(start(), { type: 'player', playerId: b, action: { type: 'add', card: numberCard(5) } })
    state = action(state, a, b, flipThree())
    state = reveal(state, b, 'action-freeze')
    if (revealCount === 3) state = record(state, b, numberCard(1))
    state = record(state, b, numberCard(5))
    expect(state.players[1].round.status).toBe('busted')
    expect(state.pendingAction).toBeFalsy()
    expect(state.forcedTurns).toHaveLength(0)
    expect(state.players[2].round.status).toBe('active')
  })

  it('keeps resolving an outer sequence after its recipient freezes themselves', () => {
    let state = action(start(), a, b, flipThree())
    state = reveal(state, b, 'action-freeze')
    state = reveal(state, b, 'action-flip-three')
    state = record(state, b, numberCard(1))
    state = action(state, b, b, freeze())
    expect(state.players[1].round.status).toBe('frozen')
    expect(state.pendingAction?.card.id).toBe('action-flip-three')
    state = action(state, b, c, flipThree())
    for (const n of [2, 3, 4]) state = record(state, c, numberCard(n))
    expect(state.forcedTurns).toHaveLength(0)
    expect(state.turnPlayerId).toBe(c)
  })

  it('uses Second Chance during forced draws and preserves the reveal count when passed elsewhere', () => {
    let state = action(start(), a, b, flipThree())
    state = reveal(state, b, 'action-second-chance')
    state = action(state, b, c, secondChance())
    expect(state.forcedTurns[0].remaining).toBe(2)
    state = record(state, b, numberCard(1))
    state = record(state, b, numberCard(2))
    expect(state.forcedTurns).toHaveLength(0)
    expect(state.players[1].round.flipThreeRemaining).toBe(0)
    expect(bankerReducer(state, { type: 'settle-player', playerId: b }).players[1].round.status).toBe('stayed')
  })

  it('prevents stacking Second Chance and discards an extra when all active players have one', () => {
    let state = start()
    for (const p of [a, b, c]) state = bankerReducer(state, { type: 'player', playerId: p, action: { type: 'add', card: secondChance() } })
    expect(action(state, a, a, secondChance())).toBe(state)
    state = reveal(state, a, 'action-second-chance')
    expect(state.pendingAction).toBeNull()
    expect(state.players[0].round.entries.at(-1)?.discarded).toBe(true)
    expect(state.turnPlayerId).toBe(b)
  })

  it('consumes a forced reveal when an extra Second Chance must be discarded', () => {
    let state = start()
    for (const p of [a, b, c]) state = bankerReducer(state, { type: 'player', playerId: p, action: { type: 'add', card: secondChance() } })
    state = action(state, a, b, flipThree())
    state = reveal(state, b, 'action-second-chance')
    expect(state.pendingAction).toBeNull()
    expect(state.forcedTurns[0].remaining).toBe(2)
  })

  it('preserves queued Actions through undo and redo of the final reveal', () => {
    let state = action(start(), a, b, flipThree())
    state = reveal(state, b, 'action-freeze')
    state = record(state, b, numberCard(1))
    state = record(state, b, numberCard(2))
    expect(state.pendingAction?.card.id).toBe('action-freeze')
    const undone = bankerReducer(state, { type: 'undo' })
    expect(undone.pendingAction).toBeFalsy()
    expect(undone.forcedTurns[0].remaining).toBe(1)
    state = bankerReducer(undone, { type: 'redo' })
    expect(state.pendingAction?.card.id).toBe('action-freeze')
    expect(state.forcedTurns[0].remaining).toBe(0)
  })

  it('rotates the first seat independently of the last player to finish, including wraparound', () => {
    let state = start()
    state = { ...state, dealerId: c, roundFinisherId: b, players: state.players.map(p => ({ ...p, round: { ...p.round, status: 'stayed' } })) }
    state = bankerReducer(state, { type: 'advance-round' })
    expect(state.turnPlayerId).toBe(a)
    expect(state.dealerId).toBe(a)
  })

  it('continues ties at the target until one player leads', () => {
    let state = start()
    state = { ...state, players: state.players.map(p => ({ ...p, totalScore: 200, round: { ...p.round, status: 'stayed' } })) }
    state = bankerReducer(state, { type: 'advance-round' })
    expect(state.phase).toBe('round')
    expect(state.winnerIds).toEqual([])
    expect(state.history).toHaveLength(1)
    for (const [i, p] of state.players.entries()) {
      state = bankerReducer(state, { type: 'player', playerId: p.id, action: { type: 'add', card: numberCard(i + 1) } })
      state = bankerReducer(state, { type: 'player', playerId: p.id, action: { type: 'stay' } })
    }
    state = bankerReducer(state, { type: 'advance-round' })
    expect(state.phase).toBe('results')
    expect(state.winnerIds).toEqual([c])
  })
})
