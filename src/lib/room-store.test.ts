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

async function completedFixture(tied = false) {
  const result = await fixture(50)
  let state = result.room.state!
  for (const [index, p] of result.roster.entries()) {
    const ids = index === 0 || tied ? ['number-12', 'number-11', 'number-10', 'number-9', 'number-8'] : ['number-2', 'number-3']
    for (const id of ids) state = bankerReducer(state, { type: 'player', playerId: p.id, action: { type: 'add', card: card(id) } })
    state = bankerReducer(state, { type: 'player', playerId: p.id, action: { type: 'stay' } })
  }
  state = bankerReducer(state, { type: 'advance-round' })
  result.store.saveRoomState(result.room.id, state)
  return { ...result, room: result.store.getLibrary().rooms[0] }
}

describe('offline room saves', () => {
  it('updates a saved player by ID across rooms, active games, and round history', async () => {
    const { store, roster, room } = await completedFixture()
    const active = store.createRoom('Another table', 200, roster)
    store.startRoom(active)
    const updated = { ...roster[0], name: 'Annie', color: '#39bca8' }

    store.savePlayerProfile(updated)
    const completed = store.getLibrary().rooms.find(savedRoom => savedRoom.id === room.id)!
    const playing = store.getLibrary().rooms.find(savedRoom => savedRoom.id === active.id)!
    expect(store.getLibrary().players.find(player => player.id === updated.id)).toEqual(updated)
    for (const savedRoom of [completed, playing]) {
      expect(savedRoom.roster[0]).toEqual(updated)
      expect(savedRoom.state?.players[0]).toMatchObject(updated)
      expect(savedRoom.roster[1]).toEqual(roster[1])
    }
    expect(completed.state?.history[0].hands?.[updated.id]).toMatchObject({ name: 'Annie', color: '#39bca8' })

    vi.resetModules()
    const reloaded = await import('./room-store')
    expect(reloaded.getLibrary().rooms.find(savedRoom => savedRoom.id === active.id)?.state?.players[0]).toMatchObject(updated)
    expect(reloaded.getLibrary().rooms.find(savedRoom => savedRoom.id === room.id)?.state?.history[0].hands?.[updated.id]).toMatchObject({ name: 'Annie', color: '#39bca8' })
  })

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
    expect(() => store.updateLibrary(current => ({ ...current, padding: 'x'.repeat(store.STORAGE_LIMIT / 2) }))).toThrow('storage is full')
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
    expect(() => store.restoreBackup(previous.replace('"version":2', '"version":3'))).toThrow('Unsupported')
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

  it('preserves lifetime matches, wins, and best scores after clearing completed rooms and reloading', async () => {
    const { store, roster } = await completedFixture()
    const ready = store.createRoom('Next table', 200, roster)
    const active = store.createRoom('Still playing', 200, roster)
    store.startRoom(active)
    store.updateLibrary(current => ({ ...current, rooms: current.rooms.filter(r => r.state?.phase !== 'results') }))
    expect(store.getLibrary().rooms.map(r => r.id)).toEqual([active.id, ready.id])
    expect(store.playerStats(roster[0].id)).toEqual({ matches: 1, wins: 1, best: 50 })
    expect(store.playerStats(roster[1].id)).toEqual({ matches: 1, wins: 0, best: 5 })
    expect(store.getLibrary().archivedStats[roster[0].id]).toEqual({ matches: 1, wins: 1, best: 50 })
    vi.resetModules()
    const reloaded = await import('./room-store')
    expect(reloaded.playerStats(roster[0].id)).toEqual({ matches: 1, wins: 1, best: 50 })
  })

  it('archives an individually deleted completed room only once and retains ties', async () => {
    const { store, room, roster } = await completedFixture(true)
    const remove = () => store.updateLibrary(current => ({ ...current, rooms: current.rooms.filter(r => r.id !== room.id) }))
    remove()
    remove()
    store.updateLibrary(current => ({ ...current, settings: { ...current.settings, reducedMotion: true } }))
    for (const p of roster) expect(store.playerStats(p.id)).toEqual({ matches: 1, wins: 1, best: 50 })
  })

  it('combines archived totals with newer retained matches without counting repeated saves twice', async () => {
    const { store, room, roster } = await completedFixture()
    store.updateLibrary(current => ({ ...current, rooms: [] }))
    const rematch = store.createRoom('Rematch', 50, roster)
    const state = { ...room.state!, players: room.state!.players.map(p => ({ ...p, totalScore: p.id === roster[1].id ? 75 : 20 })), winnerIds: [roster[1].id] }
    store.saveRoomState(rematch.id, state)
    store.saveRoomState(rematch.id, state)
    expect(store.playerStats(roster[0].id)).toEqual({ matches: 2, wins: 1, best: 50 })
    expect(store.playerStats(roster[1].id)).toEqual({ matches: 2, wins: 1, best: 75 })
    store.updateLibrary(current => ({ ...current, rooms: [] }))
    expect(store.playerStats(roster[1].id)).toEqual({ matches: 2, wins: 1, best: 75 })
    expect(store.getLibrary().archivedStats[roster[1].id].matches).toBe(2)
  })

  it('does not count unfinished or ready rooms that are removed', async () => {
    const { store, roster } = await fixture()
    store.createRoom('Not started', 200, roster)
    store.updateLibrary(current => ({ ...current, rooms: [] }))
    expect(store.getLibrary().archivedStats).toEqual({})
    expect(store.playerStats(roster[0].id)).toEqual({ matches: 0, wins: 0, best: 0 })
  })

  it('keeps original rooms and stats when cleanup cannot be saved', async () => {
    const { store, room, roster } = await completedFixture()
    const previous = saved.get(store.STORAGE_KEY)
    vi.stubGlobal('localStorage', { getItem: (key: string) => saved.get(key), setItem: () => { throw new Error('QuotaExceededError') } })
    expect(() => store.updateLibrary(current => ({ ...current, rooms: [] }))).toThrow('could not save')
    expect(saved.get(store.STORAGE_KEY)).toBe(previous)
    expect(store.getLibrary().rooms[0].id).toBe(room.id)
    expect(store.getLibrary().archivedStats).toEqual({})
    expect(store.playerStats(roster[0].id)).toEqual({ matches: 1, wins: 1, best: 50 })
  })

  it('migrates version 1 saves and backups without losing histories or duplicating stats', async () => {
    const { store, roster } = await completedFixture()
    const old = { ...store.getLibrary(), version: 1 } as Record<string, unknown>
    delete old.archivedStats
    const legacy = JSON.stringify(old, (key, value) => key === 'card' && value?.id ? value.id : value)
    saved.set(store.STORAGE_KEY, legacy)
    vi.resetModules()
    const migrated = await import('./room-store')
    expect(migrated.getLibrary().version).toBe(2)
    expect(migrated.getLibrary().archivedStats).toEqual({})
    expect(migrated.getLibrary().rooms[0].state?.history).toHaveLength(1)
    expect(migrated.playerStats(roster[0].id)).toEqual({ matches: 1, wins: 1, best: 50 })
    migrated.updateLibrary(current => ({ ...current, rooms: [] }))
    expect(migrated.playerStats(roster[0].id).matches).toBe(1)
    migrated.restoreBackup(legacy)
    expect(migrated.playerStats(roster[0].id).matches).toBe(1)
    expect(migrated.getLibrary().rooms).toHaveLength(1)
  })

  it('backs up archived totals and restores them by replacement, not addition', async () => {
    const { store, room, roster } = await completedFixture()
    store.updateLibrary(current => ({ ...current, rooms: [] }))
    const rematch = store.createRoom('Again', 50, roster)
    store.saveRoomState(rematch.id, room.state!)
    const backup = store.encodeLibrary(store.getLibrary())
    store.updateLibrary(current => ({ ...current, rooms: [] }))
    store.restoreBackup(backup)
    store.restoreBackup(backup)
    expect(store.getLibrary().rooms).toHaveLength(1)
    expect(store.playerStats(roster[0].id)).toEqual({ matches: 2, wins: 2, best: 50 })
    expect(store.getLibrary().archivedStats[roster[0].id].matches).toBe(1)
  })

  it('rejects invalid lifetime totals without touching existing data', async () => {
    const { store, roster } = await completedFixture()
    const previous = saved.get(store.STORAGE_KEY)
    for (const stats of [null, { matches: -1, wins: 0, best: 0 }, { matches: 1, wins: 2, best: 50 }, { matches: 1.5, wins: 1, best: 50 }, { matches: 1, wins: 0, best: -1 }]) {
      const raw = JSON.stringify({ ...store.getLibrary(), rooms: [], archivedStats: { [roster[0].id]: stats } })
      expect(() => store.restoreBackup(raw)).toThrow('Invalid saved lifetime stats')
      expect(saved.get(store.STORAGE_KEY)).toBe(previous)
    }
  })

  it('raises the game-data ceiling to 10 MB, accepts over 2 MB, and rejects oversized backups safely', async () => {
    const { store } = await fixture()
    expect(store.STORAGE_LIMIT).toBe(10 * 1024 * 1024)
    store.updateLibrary(current => ({ ...current, padding: 'x'.repeat(2 * 1024 * 1024) }))
    expect(store.storageBytes()).toBeGreaterThan(2 * 1024 * 1024)
    const previous = saved.get(store.STORAGE_KEY)
    const tooBig = JSON.stringify({ ...store.getLibrary(), padding: 'x'.repeat(store.STORAGE_LIMIT / 2) })
    expect(() => store.restoreBackup(tooBig)).toThrow('10 MB')
    expect(saved.get(store.STORAGE_KEY)).toBe(previous)
  })

  it('keeps archived totals and the existing save on a restore write failure', async () => {
    const { store } = await completedFixture()
    store.updateLibrary(current => ({ ...current, rooms: [] }))
    const previous = saved.get(store.STORAGE_KEY)!
    const current = store.getLibrary()
    vi.stubGlobal('localStorage', { getItem: (key: string) => saved.get(key), setItem: () => { throw new Error('QuotaExceededError') } })
    expect(() => store.restoreBackup(previous)).toThrow('could not restore')
    expect(store.getLibrary()).toBe(current)
    expect(saved.get(store.STORAGE_KEY)).toBe(previous)
  })
})
