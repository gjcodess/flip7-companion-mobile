import { renderToStaticMarkup } from 'react-dom/server'
import { describe, expect, it } from 'vitest'
import type { BankerRoundResult } from '../../game/bankerGame'
import { RoundHistory } from './RoundHistory'

const roster = [{ id: 'ben', name: 'Ben', color: '#123456' }]

describe('shared round history', () => {
  it('shows classic scores, cards, and discarded cards', () => {
    const history: BankerRoundResult[] = [{
      round: 2,
      scores: { ben: 12 },
      hands: { ben: { name: 'Ben', color: '#123456', status: 'stayed', entries: [
        { instanceId: 'card-1', card: { id: 'number-7', label: '7', kind: 'number', image: '/cards/7.webp' }, voided: false },
        { instanceId: 'card-2', card: { id: 'number-8', label: '8', kind: 'number', image: '/cards/8.webp' }, voided: true },
      ] } },
    }]
    const markup = renderToStaticMarkup(<RoundHistory edition="classic" roster={roster} history={history} />)

    expect(markup).toContain('Round 2')
    expect(markup).toContain('BANKED')
    expect(markup).toContain('12<small>pts</small>')
    expect(markup).toContain('/cards/7.webp')
    expect(markup).toContain('DISCARD')
  })

  it('shows Vengeance penalties and negative scores', () => {
    const markup = renderToStaticMarkup(<RoundHistory edition="vengeance" roster={roster} history={[{
      round: 1,
      scores: { ben: -15 },
      hands: { ben: { name: 'Ben', color: '#123456', status: 'busted', entries: [] } },
      events: [],
      flipSevenChoice: { finisherId: 'other', choice: 'penalize', targetId: 'ben' },
    }]} />)

    expect(markup).toContain('BUST')
    expect(markup).toContain('-15 PENALTY')
    expect(markup).toContain('score-negative')
  })
})
