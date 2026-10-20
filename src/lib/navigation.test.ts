import { describe, expect, it } from 'vitest'
import { backDestination } from './navigation'

describe('Android back destinations', () => {
  it('returns each saved game to its room', () => {
    expect(backDestination('/banker', '?room=classic-1')).toBe('/room?id=classic-1')
    expect(backDestination('/vengeance', '?room=vengeance%20one')).toBe('/room?id=vengeance%20one')
  })

  it('moves secondary screens toward home', () => {
    expect(backDestination('/room', '?id=classic-1')).toBe('/landing')
    expect(backDestination('/new', '')).toBe('/landing')
    expect(backDestination('/players', '')).toBe('/landing')
    expect(backDestination('/demo', '')).toBe('/landing')
    expect(backDestination('/rules', '')).toBe('/settings')
  })

  it('only requests app exit from home', () => {
    expect(backDestination('/landing', '')).toBeNull()
    expect(backDestination('/', '')).toBeNull()
  })
})
