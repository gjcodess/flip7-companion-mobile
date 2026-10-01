import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { TargetScorePicker } from './TargetScorePicker'

describe('default target score picker', () => {
  it('provides an inline disclosure with the classic score selected', () => {
    const markup = renderToStaticMarkup(<TargetScorePicker value={200} onChange={() => undefined} />)
    expect(markup).toContain('<details')
    expect(markup).toContain('aria-label="Default target score choices"')
    expect(markup.match(/aria-pressed="true"/g)).toHaveLength(1)
    expect(markup).toContain('<span>200 pts</span>')
    expect(markup).not.toContain('<dialog')
    expect(markup).not.toContain('<select')
  })

  it('keeps a saved custom target available alongside all three presets', () => {
    const markup = renderToStaticMarkup(<TargetScorePicker value={250} onChange={() => undefined} />)
    expect(markup).toContain('Default target score: 250 points')
    expect(markup.match(/aria-pressed=/g)).toHaveLength(4)
    expect(markup).toContain('<span>250 pts</span>')
  })
})
