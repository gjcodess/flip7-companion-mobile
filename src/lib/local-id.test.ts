import { afterEach, describe, expect, it, vi } from 'vitest'
import { newLocalId } from './local-id'

afterEach(() => vi.unstubAllGlobals())

describe('local IDs', () => {
  it('works when a local HTTP browser omits randomUUID', () => {
    vi.stubGlobal('crypto', { getRandomValues: (bytes: Uint8Array) => bytes.fill(0xab) })
    expect(newLocalId()).toBe('ab'.repeat(16))
  })
})
