import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { ForcedDrawStatus } from './ForcedDrawStatus'

describe('forced draw status', () => {
  it('shows the remaining count and progress without a duplicate queue list', () => {
    const markup = renderToStaticMarkup(<ForcedDrawStatus label="Flip Four" remaining={1} total={4} />)
    expect(markup).toContain('aria-label="Flip Four: 1 of 4 reveals remaining"')
    expect(markup).toContain('1 flip left')
    expect(markup.match(/class="complete"/g)).toHaveLength(3)
    expect(markup).not.toContain('Resolve afterward')
    expect(markup).not.toContain('Resolve after all four reveals.')
  })
  it('does not show a queue section for Just One More without deferred effects', () => {
    const markup = renderToStaticMarkup(<ForcedDrawStatus label="Just One More" remaining={1} total={1} />)
    expect(markup).toContain('1 flip left')
    expect(markup).not.toContain('forced-draw-queue')
  })
})
