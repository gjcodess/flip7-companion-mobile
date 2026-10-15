import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { GameTable } from './GameTable'
import { vengeanceCard } from '../../game/vengeanceCards'

const renderTable = (forced: boolean, frozen = false, busted = false) => renderToStaticMarkup(<GameTable
  table={[]} tableCardIds={[]} isVoidedCard={() => false} score={0} flipSevenBonus={0}
  busted={busted} frozen={frozen} submitting={false} interactionLocked={false}
  canEditCards canAddCards canDrawWhileStayed={forced} confirmedAt="stayed" isStaying
  isOrganized={false} playerName="Stayed player" isHost={false}
  onOrganize={() => undefined} onOpenPicker={() => undefined} onSelectCard={() => undefined}
/>)

describe('forced draws on inactive Vengeance hands', () => {
  it.each([false, true])('shows the physical-card button for a forced draw with frozen=%s', frozen => {
    expect(renderTable(true, frozen)).toContain('aria-label="Record a physical card"')
  })
  it('keeps normal stayed hands and busted hands closed to further draws', () => {
    expect(renderTable(false)).not.toContain('aria-label="Record a physical card"')
    expect(renderTable(true, false, true)).not.toContain('aria-label="Record a physical card"')
  })
})


describe('queued card badges', () => {
  it('labels and disables preview cards while keeping ordinary cards selectable', () => {
    const markup = renderToStaticMarkup(<GameTable
      table={[vengeanceCard('v-number-1')!, vengeanceCard('v-modifier-minus-4')!, vengeanceCard('v-action-discard')!]}
      tableCardIds={['real-1', 'preview-1', 'preview-2']} isVoidedCard={() => false}
      cardResolution={index => index === 1 ? 'queued' : index === 2 ? 'resolving' : undefined}
      score={1} flipSevenBonus={0} busted={false} frozen={false} submitting={false}
      interactionLocked={false} canEditCards canAddCards confirmedAt={null} isStaying={false}
      isOrganized={false} playerName="A" isHost={false}
      onOrganize={() => undefined} onOpenPicker={() => undefined} onSelectCard={() => undefined}
    />)
    expect(markup).toContain('card-resolution-badge">Queued</span>')
    expect(markup).toContain('card-resolution-badge">Resolving</span>')
    expect(markup).toContain('aria-label="−4, queued, effect not applied"')
    expect(markup.match(/disabled=""/g)).toHaveLength(2)
  })
})
