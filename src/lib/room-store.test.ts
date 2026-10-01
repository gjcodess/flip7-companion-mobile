import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bankerReducer } from '../game/bankerGame'
import { pickerCards } from '../game/cards'

const card = (id: string) => pickerCards.find(c => c.id === id)!
let saved = new Map<string, string>()
beforeEach(() => {
  vi.resetModules()
  saved = new Map()
  vi.stubGlobal('localStorage', { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) })
})

async function fixture(target = 200) {
  const store = await import('./room-store')
  const roster = ['Ana', 'Ben', 'Cy'].map((name, i) => store.newProfile(name, i))
  const room = store.createRoom('Friday flips', target, roster)
  store.startRoom(room)
  return { store, room: store.getLibrary().rooms[0], roster }
}

describe('offline room saves', () => {
  it('resumes the current player and full forced-turn queue after a fresh load, using card IDs', async () => {
    const { store, room, roster } = await fixture()
    let state = bankerReducer(room.state!, { type: 'record-action', sourcePlayerId: roster[0].id, targetPlayerId: roster[1].id, card: card('action-flip-three') })
    state = bankerReducer(state, { type: 'record-card', playerId: roster[1].id, card: card('number-8') })
    store.saveRoomState(room.id, state)
    const raw = saved.get(store.STORAGE_KEY)!
    expect(raw).not.toContain('/cards/')
    expect(raw).not.toContain('"kind"')
    vi.resetModules()
    const reloaded = await import('./room-store')
    const resumed = reloaded.getLibrary().rooms[0].state!
    expect(resumed.forcedTurns).toEqual(state.forcedTurns)
    expect(resumed.selectedPlayerId).toBe(roster[1].id)
    expect(resumed.players[1].round.entries[1].card).toEqual(card('number-8'))
    expect(resumed.past).toEqual([])
    expect(resumed.players[1].round.past).toEqual([])
    expect(reloaded.getStorageError()).toBe('')
  })

  it('keeps completed-round cards, voided second chances, scores, and the original names', async () => {
    const { store, room, roster } = await fixture()
    let state = room.state!
    for (const [index, ids] of [[0, ['action-second-chance', 'number-8', 'number-8', 'number-4']], [1, ['number-2', 'number-3']], [2, ['number-6', 'number-7']]] as const) {
      for (const id of ids) state = bankerReducer(state, { type: 'player', playerId: roster[index].id, action: { type: 'add', card: card(id) } })
      state = bankerReducer(state, { type: 'player', playerId: roster[index].id, action: { type: 'stay' } })
    }
    state = bankerReducer(state, { type: 'advance-round' })
    store.saveRoomState(room.id, state)
    const loaded = store.decodeLibrary(saved.get(store.STORAGE_KEY)!).rooms[0]
    expect(loaded.state?.history[0].scores[roster[0].id]).toBe(12)
    expect(loaded.state?.history[0].hands?.[roster[0].id].entries.filter(e => e.voided)).toHaveLength(2)
    expect(loaded.state?.players[0].round.entries).toEqual([])
    const renamed = { ...roster[0], name: 'Ana later' }
    store.editRoom(loaded, 'Updated room', 200, [renamed, roster[1], roster[2]])
    expect(store.getLibrary().rooms[0].state?.history[0].hands?.[roster[0].id].name).toBe('Ana')
    expect(store.getLibrary().rooms[0].state?.players[0].totalScore).toBe(12)
  })

  it('adds a player with zero points between rounds and rejects mid-hand roster changes', async () => {
    const { store, room, roster } = await fixture()
    const extra = store.newProfile('Dee', 3)
    store.editRoom(room, room.name, 200, [...roster, extra])
    const changed = store.getLibrary().rooms[0]
    expect(changed.state?.players[3]).toMatchObject({ id: extra.id, totalScore: 0 })
    const state = bankerReducer(changed.state!, { type: 'record-card', playerId: roster[0].id, card: card('number-6') })
    store.saveRoomState(room.id, state)
    expect(store.canEditRoster(store.getLibrary().rooms[0])).toBe(false)
    expect(() => store.editRoom(store.getLibrary().rooms[0], 'Nope', 200, roster)).toThrow('before the first card')
  })

  it('retains tied winners and derives player stats from completed matches', async () => {
    const { store, room, roster } = await fixture(50)
    let state = room.state!
    for (const p of roster) {
      for (const id of ['number-12', 'number-11', 'number-10', 'number-9', 'number-8']) state = bankerReducer(state, { type: 'player', playerId: p.id, action: { type: 'add', card: card(id) } })
      state = bankerReducer(state, { type: 'player', playerId: p.id, action: { type: 'stay' } })
    }
    state = bankerReducer(state, { type: 'advance-round' })
    store.saveRoomState(room.id, state)
    expect(state.phase).toBe('results')
    expect(state.winnerIds).toEqual(roster.map(p => p.id))
    expect(store.playerStats(roster[0].id)).toEqual({ matches: 1, wins: 1, best: 50 })
    expect(store.decodeLibrary(saved.get(store.STORAGE_KEY)!).rooms[0].state?.history[0].hands?.[roster[0].id].entries).toHaveLength(5)
  })

  it('preserves the last save when storage is full or the write fails', async () => {
    const { store, room } = await fixture()
    const previous = saved.get(store.STORAGE_KEY)
    expect(() => store.updateLibrary(current => ({ ...current, rooms: Array.from({ length: 4000 }, () => room) }))).toThrow('storage is full')
    expect(saved.get(store.STORAGE_KEY)).toBe(previous)
    vi.stubGlobal('localStorage', { getItem: (key: string) => saved.get(key), setItem: () => { throw new Error('QuotaExceededError') } })
    expect(() => store.saveRoom({ ...room, name: 'Unsaved' })).toThrow('could not save')
    expect(store.getLibrary().rooms[0].name).toBe(room.name)
    expect(saved.get(store.STORAGE_KEY)).toBe(previous)
  })

  it('refuses corrupt backups without overwriting local rooms', async () => {
    const { store } = await fixture()
    const previous = saved.get(store.STORAGE_KEY)!
    expect(() => store.restoreBackup('{')).toThrow()
    expect(() => store.restoreBackup(previous.replace('"card"', '"unknown"').replace('"version":1', '"version":2'))).toThrow('Unsupported')
    expect(saved.get(store.STORAGE_KEY)).toBe(previous)
    vi.resetModules()
    saved.set(store.STORAGE_KEY, '{broken')
    const brokenStore = await import('./room-store')
    expect(brokenStore.getLibrary().rooms).toHaveLength(0)
    expect(brokenStore.getStorageError()).toContain('original save is untouched')
    expect(() => brokenStore.createRoom('New', 200, [brokenStore.newProfile('A'), brokenStore.newProfile('B'), brokenStore.newProfile('C')])).toThrow('could not be read')
    expect(saved.get(store.STORAGE_KEY)).toBe('{broken')
  })

  it('keeps a typical 10-round four-player match compact', async () => {
    const { store, room, roster } = await fixture(500)
    const extra = store.newProfile('Dee', 3)
    store.editRoom(room, room.name, 500, [...roster, extra])
    let state = store.getLibrary().rooms[0].state!
    for (let round = 0; round < 10; round++) {
      for (const p of state.players) {
        for (const id of ['number-1', 'number-2']) state = bankerReducer(state, { type: 'player', playerId: p.id, action: { type: 'add', card: card(id) } })
        state = bankerReducer(state, { type: 'player', playerId: p.id, action: { type: 'stay' } })
      }
      state = bankerReducer(state, { type: 'advance-round' })
    }
    store.saveRoomState(room.id, state)
    expect(state.history).toHaveLength(10)
    expect(store.storageBytes()).toBeLessThan(40000)
  })
})
