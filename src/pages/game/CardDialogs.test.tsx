import { describe, expect, it } from 'vitest'
import { renderToStaticMarkup } from 'react-dom/server'
import { CardPickerPanel } from './CardDialogs'
import { pickerCards } from '../../game/cards'

const renderPicker = () => renderToStaticMarkup(<CardPickerPanel submitting={false} onClose={() => undefined} onSelect={() => undefined} />)

describe('physical card picker presentation', () => {
  it('renders every choice immediately without waiting for the preload batch', () => {
    const markup = renderPicker()
    expect(markup.match(/aria-label="Record /g)).toHaveLength(pickerCards.length)
    expect(markup).not.toContain('Loading card artwork')
  })

  it('gives every tile a readable fallback and lightweight local image', () => {
    const markup = renderPicker()
    expect(markup.match(/class="picker-card-placeholder /g)).toHaveLength(pickerCards.length)
    expect(markup).toContain('/cards/thumbnails/plus-10.webp')
    expect(markup).toContain('/cards/thumbnails/second-chance.webp')
    expect(markup).not.toContain('src="/cards/+10.webp"')
  })

  it('keeps the title and close control before the independently scrolling grid', () => {
    const markup = renderPicker()
    expect(markup).toContain('aria-labelledby="physical-card-picker-title"')
    expect(markup.indexOf('Close card picker')).toBeLessThan(markup.indexOf('physical-picker-scroll'))
    expect(markup.indexOf('physical-card-picker-title')).toBeLessThan(markup.indexOf('physical-picker-scroll'))
  })
})
