import { beforeEach, describe, expect, it, vi } from 'vitest'
import { bankerReducer } from '../game/bankerGame'
import { pickerCards } from '../game/cards'
import { emptySharedHost, publicRoom } from './shared-room-protocol'

let saved: Map<string, string>
beforeEach(() => {
  vi.resetModules(); saved = new Map()
  vi.stubGlobal('localStorage', { getItem: (key: string) => saved.get(key) ?? null, setItem: (key: string, value: string) => saved.set(key, value) })
})
async function fixture() {
  const store = await import('./room-store')
  const roster = ['Ana', 'Ben'].map((name, i) => store.newProfile(name, i))
  const room = store.createRoom('Friday', 50, roster); store.startRoom(room)
  const local = store.newProfile('My profile'); store.savePlayerProfile(local)
  return { store, room: store.getLibrary().rooms.find(r => r.id === room.id)!, local }
}
async function finalFixture() {
  const result = await fixture(), { store, room } = result
  let state = room.state!
  for (const [index, player] of state.players.entries()) {
    for (const number of index === 0 ? [12, 11, 10, 9, 8] : [2, 3]) state = bankerReducer(state, { type: 'player', playerId: player.id, action: { type: 'add', card: pickerCards.find(c => c.id === `number-${number}`)! } })
    state = bankerReducer(state, { type: 'player', playerId: player.id, action: { type: 'stay' } })
  }
  state = bankerReducer(state, { type: 'advance-round' }); store.saveRoomState(room.id, state)
  return { ...result, room: store.getLibrary().rooms.find(r => r.id === room.id)! }
}

describe('joined history and player statistics', () => {
  it('keeps all tables and cards without importing other participants into the local crew', async () => {
    const { store, room, local } = await finalFixture()
    const count = store.getLibrary().players.length
    store.saveJoinedRoom(publicRoom(room), 7, room.roster[0].id, local.id)
    const copy = store.getLibrary().rooms.find(r => r.joinedCopy)!
    expect(store.canEditRoster(copy)).toBe(false)
    expect(copy.state!.history[0].hands![room.roster[1].id].entries).toHaveLength(2)
    expect(store.getLibrary().players).toHaveLength(count)
    expect(store.playerStats(local.id)).toEqual({ matches: 1, wins: 1, best: 50 })
    for (let i = 0; i < 5; i++) store.saveJoinedRoom(publicRoom(room), 7, room.roster[0].id, local.id)
    expect(store.playerStats(local.id).matches).toBe(1)
  })
  it('retains incomplete history without counting it as a completed match', async () => {
    const { store, room, local } = await fixture()
    store.saveJoinedRoom(room, 0, room.roster[0].id, local.id)
    expect(store.roomStatus(store.getLibrary().rooms.find(r => r.joinedCopy)!)).toContain('Incomplete')
    expect(store.playerStats(local.id).matches).toBe(0)
  })
  it('retains stats after removing a completed copy and does not recount a later delivery', async () => {
    const { store, room, local } = await finalFixture()
    store.saveJoinedRoom(room, 7, room.roster[0].id, local.id)
    store.updateLibrary(current => ({ ...current, rooms: current.rooms.filter(r => !r.joinedCopy) }))
    expect(store.playerStats(local.id)).toEqual({ matches: 1, wins: 1, best: 50 })
    store.saveJoinedRoom(room, 8, room.roster[0].id, local.id)
    expect(store.getLibrary().rooms.some(r => r.joinedCopy)).toBe(false)
    expect(store.playerStats(local.id).matches).toBe(1)
  })
  it('does not overwrite a newer history copy with an older host save', async () => {
    const { store, room } = await fixture()
    store.saveJoinedRoom(room, 5, room.roster[0].id)
    expect(() => store.saveJoinedRoom(room, 4, room.roster[0].id)).toThrow('older save')
    expect(store.getLibrary().rooms.find(r => r.joinedCopy)!.joinedCopy!.revision).toBe(5)
  })
  it('round-trips joined history, profile mapping and host approvals through a full backup', async () => {
    const { store, room, local } = await finalFixture()
    store.saveRoom({ ...room, sharedHost: emptySharedHost() })
    store.saveJoinedRoom(room, 7, room.roster[0].id, local.id)
    const raw = store.encodeLibrary(store.getLibrary()), decoded = store.decodeLibrary(raw)
    expect(decoded.rooms.find(r => r.joinedCopy)!.joinedCopy!.localProfileId).toBe(local.id)
    expect(decoded.rooms.find(r => r.id === room.id)!.sharedHost!.revision).toBe(0)
    expect(store.playerStats(local.id, decoded.rooms)).toEqual({ matches: 1, wins: 1, best: 50 })
  })
  it('rejects edits, starting and roster changes on a participant copy', async () => {
    const { store, room } = await fixture()
    store.saveJoinedRoom(room, 0, room.roster[0].id)
    const copy = store.getLibrary().rooms.find(r => r.joinedCopy)!
    expect(() => store.saveRoom(copy)).toThrow('read-only')
    expect(() => store.saveRoomState(copy.id, copy.state!)).toThrow('read-only')
    expect(() => store.startRoom(copy)).toThrow('original host')
    expect(() => store.editRoom(copy, 'Altered', 100, copy.roster)).toThrow('original host')
  })
  it('rehydrates compact network card IDs and rejects malformed snapshots', async () => {
    const { store, room } = await finalFixture()
    const compact = JSON.parse(JSON.stringify(room, (key, value) => key === 'card' && value?.id ? value.id : key === 'past' || key === 'future' ? [] : value))
    const clean = store.saveJoinedRoom(compact, 4, room.roster[0].id)
    expect(clean.state!.history[0].hands![room.roster[0].id].entries[0].card.id).toBe('number-12')
    compact.state.players[0].totalScore = 'fake'
    expect(() => store.saveJoinedRoom(compact, 5, room.roster[0].id)).toThrow('saved hand')
  })
  it('does not report a save as accepted when storage fails', async () => {
    const { store, room } = await fixture()
    vi.stubGlobal('localStorage', { getItem: (key: string) => saved.get(key), setItem: () => { throw new Error('Quota exceeded') } })
    expect(() => store.saveJoinedRoom(room, 0, room.roster[0].id)).toThrow('could not save')
    expect(store.getLibrary().rooms.some(r => r.joinedCopy)).toBe(false)
  })
})

describe('host revision tracking', () => {
  it('releases a controller when the host removes its seat between rounds', async () => {
    const { store, room } = await fixture()
    const device = crypto.randomUUID()
    store.saveRoom({ ...room, sharedHost: { revision: 0, receipts: [], grants: { [device]: { secret: `${crypto.randomUUID()}${crypto.randomUUID()}`, name: 'Phone', status: 'approved', requestedSeat: room.roster[0].id, playerId: room.roster[0].id } } } })
    const current = store.getLibrary().rooms.find(r => r.id === room.id)!
    store.editRoom(current, current.name, current.targetScore, [current.roster[1], store.newProfile('Cy')])
    expect(store.getLibrary().rooms.find(r => r.id === room.id)!.sharedHost!.grants[device].status).toBe('rejected')
  })
  it('does not invalidate participant input when the host merely views another table', async () => {
    const { store, room } = await fixture()
    store.saveRoom({ ...room, sharedHost: emptySharedHost() })
    store.saveRoomState(room.id, bankerReducer(room.state!, { type: 'select-player', playerId: room.roster[1].id }))
    expect(store.getLibrary().rooms.find(r => r.id === room.id)!.sharedHost!.revision).toBe(0)
  })
  it('invalidates stale input for host card corrections and roster changes', async () => {
    const { store, room } = await fixture()
    store.saveRoom({ ...room, sharedHost: emptySharedHost() })
    store.editRoom(store.getLibrary().rooms.find(r => r.id === room.id)!, 'Updated', 100, room.roster)
    let current = store.getLibrary().rooms.find(r => r.id === room.id)!
    expect(current.sharedHost!.revision).toBe(1)
    store.saveRoomState(room.id, bankerReducer(current.state!, { type: 'record-card', playerId: room.roster[0].id, card: pickerCards.find(c => c.id === 'number-7')! }))
    current = store.getLibrary().rooms.find(r => r.id === room.id)!
    expect(current.sharedHost!.revision).toBe(2)
  })
})
