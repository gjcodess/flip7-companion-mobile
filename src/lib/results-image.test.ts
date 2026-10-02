import { describe, expect, it } from 'vitest'
import { demoInitialState } from '../game/demoGame'
import type { BankerPlayer } from '../game/bankerGame'
import { resultsShareText } from './results-image'

function player(id: string, name: string, totalScore: number): BankerPlayer {
  return { id, name, color: '#ed4f7e', totalScore, round: demoInitialState() }
}

describe('resultsShareText', () => {
  it('shares every final score in rank order and preserves ties', () => {
    const text = resultsShareText('Friday table', [
      player('third', 'Joy', 12),
      player('first', 'Vann', 201),
      player('second', 'Glenn', 201),
    ], 200)

    expect(text).toContain('Vann & Glenn tied at 201 points')
    expect(text).toContain('1. Vann — 201 pts\n1. Glenn — 201 pts\n3. Joy — 12 pts')
  })
})
