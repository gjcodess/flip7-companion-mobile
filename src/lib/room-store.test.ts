import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bankerReducer } from '../game/bankerGame'
import { pickerCards } from '../game/cards'
import { vengeanceReducer } from '../game/vengeanceGame'

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
  it('migrates a version 2 Classic save without mixing Vengeance players or rooms', async () => {
    const { store, room, roster } = await fixture()
    const old = JSON.parse(saved.get(store.STORAGE_KEY)!)
    old.version = 2
    delete old.vengeancePlayers
    delete old.vengeanceArchivedStats
    delete old.settings.edition
    delete old.settings.vengeanceTargetScore
    delete old.rooms[0].edition
    delete old.rooms[0].vengeanceState
    const migrated = store.decodeLibrary(JSON.stringify(old))
    expect(migrated.version).toBe(3)
    expect(migrated.rooms[0].edition).toBe('classic')
    expect(migrated.rooms[0].state?.players.map(player => player.id)).toEqual(roster.map(player => player.id))
    expect(migrated.vengeancePlayers).toEqual([])
    expect(migrated.rooms[0].id).toBe(room.id)
  })

  it('saves a pending Vengeance action and keeps edition profiles separate after reload', async () => {
    const store = await import('./room-store')
    const classic = [store.newProfile('Ari', 0), store.newProfile('Bea', 1)]
    store.createRoom('Classic', 200, classic)
    const vengeance = [store.newProfile('Ari', 0), store.newProfile('Bea', 1)]
    const room = store.createRoom('Vengeance', 200, vengeance, 'vengeance', vengeance[1].id)
    store.startRoom(room)
    let state = store.getLibrary().rooms.find(item => item.id === room.id)!.vengeanceState!
    expect(state.dealerId).toBe(vengeance[1].id)
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-action-flip-four' })
    expect(state.pending?.card.id).toBe('v-action-flip-four')
    store.saveVengeanceState(room.id, state)
    vi.resetModules()
    const reloaded = await import('./room-store')
    const restored = reloaded.getLibrary().rooms.find(item => item.id === room.id)!.vengeanceState!
    expect(restored.pending?.card.id).toBe('v-action-flip-four')
    expect(restored.turnPlayerId).toBe(state.turnPlayerId)
    expect(reloaded.getLibrary().players).toHaveLength(2)
    expect(reloaded.getLibrary().vengeancePlayers).toHaveLength(2)
    expect(reloaded.getLibrary().rooms.filter(item => item.edition === 'vengeance')).toHaveLength(1)
  })

  it('saves and restores a Vengeance game with a frozen player without corruption', async () => {
    const store = await import('./room-store')
    const roster = [store.newProfile('P1', 0), store.newProfile('P2', 1), store.newProfile('P3', 2)]
    const room = store.createRoom('Vengeance Game', 200, roster, 'vengeance')
    store.startRoom(room)
    let state = store.getLibrary().rooms.find(item => item.id === room.id)!.vengeanceState!
    // P1 deals Just One More to P2
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-action-just-one-more' })
    state = vengeanceReducer(state, { type: 'choose-actor', playerId: roster[1].id })
    // P2 flips card 12 and freezes
    state = vengeanceReducer(state, { type: 'record', cardId: 'v-number-12' })
    expect(state.players[1].status).toBe('frozen')
    store.saveVengeanceState(room.id, state)

    vi.resetModules()
    const reloaded = await import('./room-store')
    expect(reloaded.getStorageError()).toBe('')
    const restored = reloaded.getLibrary().rooms.find(item => item.id === room.id)!.vengeanceState!
    expect(restored.players[1].status).toBe('frozen')
    expect(restored.turnPlayerId).toBe(roster[2].id)
  })
  it('updates a saved player by ID across rooms, active games, and round history', async () => {
    const { store, roster, room } = await completedFixture()
    const active = store.createRoom('Another table', 200, roster)
    store.startRoom(active)
    const updated = { ...roster[0], name: 'Annie', color: '#39bca8', avatar: 'female-3' as const }

    store.savePlayerProfile(updated)
    const completed = store.getLibrary().rooms.find(savedRoom => savedRoom.id === room.id)!
    const playing = store.getLibrary().rooms.find(savedRoom => savedRoom.id === active.id)!
    expect(store.getLibrary().players.find(player => player.id === updated.id)).toEqual(updated)
    for (const savedRoom of [completed, playing]) {
      expect(savedRoom.roster[0]).toEqual(updated)
      expect(savedRoom.state?.players[0]).toMatchObject(updated)
      expect(savedRoom.roster[1]).toEqual(roster[1])
    }
    expect(completed.state?.history[0].hands?.[updated.id]).toMatchObject({ name: 'Annie', color: '#39bca8', avatar: 'female-3' })

    vi.resetModules()
    const reloaded = await import('./room-store')
    expect(reloaded.getLibrary().rooms.find(savedRoom => savedRoom.id === active.id)?.state?.players[0]).toMatchObject(updated)
    expect(reloaded.getLibrary().rooms.find(savedRoom => savedRoom.id === room.id)?.state?.history[0].hands?.[updated.id]).toMatchObject({ name: 'Annie', color: '#39bca8', avatar: 'female-3' })
  })

  it('accepts old saves without avatars and rejects unknown avatar IDs', async () => {
    const { store } = await fixture()
    const oldSave = JSON.parse(saved.get(store.STORAGE_KEY)!)
    for (const player of oldSave.players) delete player.avatar
    for (const player of oldSave.rooms[0].roster) delete player.avatar
    for (const player of oldSave.rooms[0].state.players) delete player.avatar
    expect(store.decodeLibrary(JSON.stringify(oldSave)).players[0].avatar).toBeUndefined()
    oldSave.players[0].avatar = 'unknown-character'
    expect(() => store.decodeLibrary(JSON.stringify(oldSave))).toThrow('Invalid saved players')
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

  it('removes a player between rounds while keeping their completed round history', async () => {
    const { store, room, roster } = await fixture()
    const extra = store.newProfile('Dee', 3)
    store.editRoom(room, room.name, 200, [...roster, extra])
    let state = store.getLibrary().rooms[0].state!
    state = bankerReducer(state, { type: 'player', playerId: roster[0].id, action: { type: 'add', card: card('number-5') } })
    state = bankerReducer(state, { type: 'player', playerId: roster[0].id, action: { type: 'add', card: card('number-2') } })
    for (const player of [roster[1], roster[2], extra, roster[0]]) {
      if (player.id !== roster[0].id) for (const id of ['number-1', 'number-2']) state = bankerReducer(state, { type: 'player', playerId: player.id, action: { type: 'add', card: card(id) } })
      state = bankerReducer(state, { type: 'player', playerId: player.id, action: { type: 'stay' } })
    }
    store.saveRoomState(room.id, bankerReducer(state, { type: 'advance-round' }))
    const current = store.getLibrary().rooms[0]
    expect(current.state?.turnPlayerId).toBe(roster[0].id)

    store.editRoom(current, current.name, current.targetScore, [roster[1], roster[2], extra])
    const updated = store.decodeLibrary(saved.get(store.STORAGE_KEY)!).rooms[0]
    expect(updated.roster.map(player => player.id)).toEqual([roster[1].id, roster[2].id, extra.id])
    expect(updated.state?.players.map(player => player.id)).toEqual([roster[1].id, roster[2].id, extra.id])
    expect(updated.state?.turnPlayerId).toBe(roster[1].id)
    expect(updated.state?.selectedPlayerId).toBe(roster[1].id)
    expect(updated.state?.history[0].scores[roster[0].id]).toBe(7)
    expect(updated.state?.history[0].hands?.[roster[0].id].entries).toHaveLength(2)
    expect(store.getLibrary().players.some(player => player.id === roster[0].id)).toBe(true)
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
    expect(() => store.restoreBackup(previous.replace('"version":3', '"version":4'))).toThrow('Unsupported')
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
    expect(migrated.getLibrary().version).toBe(3)
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
