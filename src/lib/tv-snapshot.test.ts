import { describe, expect, it } from 'vitest'
import { bankerInitialState, type BankerPlayer } from '../game/bankerGame'
import { pickerCards } from '../game/cards'
import { demoInitialState } from '../game/demoGame'
import type { Room } from './room-store'
import { buildTvSnapshot } from './tv-snapshot'

const card = (id: string) => pickerCards.find(item => item.id === id)!
const roster = [
  { id: 'a', name: 'Ana', color: '#ed4f7e' },
  { id: 'b', name: 'Ben', color: '#57b8d7' },
  { id: 'c', name: 'Cy', color: '#97c844' },
]
const room: Room = { id: 'room-1', name: 'Friday flips', createdAt: 1, updatedAt: 1, targetScore: 200, roster, state: null, pinned: false }

function player(index: number, totalScore: number, status: BankerPlayer['round']['status'], cardId: string): BankerPlayer {
  return { ...roster[index], totalScore, round: { ...demoInitialState(), status, entries: [{ instanceId: `card-${index}`, card: card(cardId), voided: false }] } }
}

describe('TV scoreboard snapshot', () => {
  it('shows a saved room before play without inventing scores', () => {
    const snapshot = buildTvSnapshot(room)
    expect(snapshot.phase).toBe('ready')
    expect(snapshot.players.map(p => [p.name, p.total, p.roundScore, p.status])).toEqual([
      ['Ana', 0, 0, 'ready'], ['Ben', 0, 0, 'ready'], ['Cy', 0, 0, 'ready'],
    ])
  })

  it('keeps round points separate from totals and follows the actual turn', () => {
    const state = { ...bankerInitialState(), phase: 'round' as const, roundNumber: 5, turnPlayerId: 'c', players: [
      player(0, 85, 'frozen', 'number-5'),
      player(1, 29, 'busted', 'number-7'),
      player(2, 114, 'active', 'number-11'),
    ] }
    const snapshot = buildTvSnapshot({ ...room, state })
    expect(snapshot.players.map(p => p.roundScore)).toEqual([5, 0, 11])
    expect(snapshot.players.map(p => p.total)).toEqual([85, 29, 114])
    expect(snapshot.players.find(p => p.isTurn)?.name).toBe('Cy')
    expect(snapshot.players[2].cards[0].image).toBe('/cards/11.webp')
    const forced = buildTvSnapshot({ ...room, state: { ...state, forcedTurns: [{ targetPlayerId: 'a', remaining: 2, resumeAfterPlayerId: 'c' }] } })
    expect(forced.players.find(p => p.isTurn)?.name).toBe('Ana')
  })

  it('marks winners on a completed match', () => {
    const state = { ...bankerInitialState(), phase: 'results' as const, winnerIds: ['a'], players: [player(0, 215, 'stayed', 'number-7')] }
    const snapshot = buildTvSnapshot({ ...room, state })
    expect(snapshot.phase).toBe('results')
    expect(snapshot.winnerIds).toEqual(['a'])
    expect(snapshot.players[0].isTurn).toBe(false)
  })
})
