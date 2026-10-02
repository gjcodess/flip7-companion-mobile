import { useSyncExternalStore } from 'react'
import { bankerInitialState, bankerPlayerColors, bankerReducer, type BankerState } from '../game/bankerGame'
import { pickerCards } from '../game/cards'
import { demoInitialState } from '../game/demoGame'
import { defaultPlayerAvatarFor, isPlayerAvatarId, type PlayerAvatarId } from './player-avatars'
import { newLocalId } from './local-id'

export type PlayerProfile = { id: string; name: string; color: string; avatar?: PlayerAvatarId }
export type Room = {
  id: string; name: string; createdAt: number; updatedAt: number
  targetScore: number; roster: PlayerProfile[]; state: BankerState | null; pinned: boolean
}
export type PlayerStats = { matches: number; wins: number; best: number }
export type RoomLibrary = { version: 2; rooms: Room[]; players: PlayerProfile[]; archivedStats: Record<string, PlayerStats>; settings: { targetScore: number; reducedMotion: boolean } }
export const STORAGE_KEY = 'flip7.rooms.v1'
export const STORAGE_LIMIT = 10 * 1024 * 1024
const listeners = new Set<() => void>()
const emptyLibrary = (): RoomLibrary => ({ version: 2, rooms: [], players: [], archivedStats: {}, settings: { targetScore: 200, reducedMotion: false } })
let library: RoomLibrary | undefined
let storageError = ''

// Artwork is bundled once. Each recorded card is stored as its catalog ID.
export function encodeLibrary(data: RoomLibrary) {
  return JSON.stringify(data, (key, value) => {
    if (key === 'card' && value?.id) return value.id
    if (key === 'past' || key === 'future') return []
    return value
  })
}

export function decodeLibrary(raw: string): RoomLibrary {
  const data = JSON.parse(raw, (key, value) => {
    if (key !== 'card') return value
    const card = pickerCards.find((item) => item.id === value)
    if (!card) throw new Error('Unknown card in saved game.')
    return card
  }) as Omit<RoomLibrary, 'version' | 'archivedStats'> & { version: number; archivedStats?: Record<string, PlayerStats> }
  if (!data || ![1, 2].includes(data.version) || !Array.isArray(data.rooms) || !Array.isArray(data.players) || !data.settings) throw new Error('Unsupported save file.')
  if (data.version === 2 || data.archivedStats !== undefined) {
    if (!data.archivedStats || typeof data.archivedStats !== 'object' || Array.isArray(data.archivedStats) || !Object.entries(data.archivedStats).every(([id, stats]) => id.length > 0 && stats && typeof stats === 'object' && Number.isSafeInteger(stats.matches) && stats.matches >= 0 && Number.isSafeInteger(stats.wins) && stats.wins >= 0 && stats.wins <= stats.matches && Number.isSafeInteger(stats.best) && stats.best >= 0)) throw new Error('Invalid saved lifetime stats.')
  }
  if (!Number.isInteger(data.settings.targetScore) || data.settings.targetScore < 50 || data.settings.targetScore > 500 || typeof data.settings.reducedMotion !== 'boolean') throw new Error('Invalid saved settings.')
  const ids = new Set<string>()
  const validProfile = (p: PlayerProfile) => typeof p?.id === 'string' && typeof p.name === 'string' && p.name.trim().length > 0 && p.name.length <= 24 && /^#[0-9a-f]{6}$/i.test(p.color) && (p.avatar === undefined || isPlayerAvatarId(p.avatar))
  if (!data.players.every(validProfile) || new Set(data.players.map(p => p.id)).size !== data.players.length) throw new Error('Invalid saved players.')
  for (const room of data.rooms) {
    if (typeof room.id !== 'string' || ids.has(room.id) || typeof room.name !== 'string' || !room.name.trim() || room.name.length > 40 || !Number.isFinite(room.createdAt) || !Number.isFinite(room.updatedAt) || !Number.isInteger(room.targetScore) || room.targetScore < 50 || room.targetScore > 500 || !Array.isArray(room.roster) || room.roster.length < 3 || room.roster.length > 18 || !room.roster.every(validProfile) || new Set(room.roster.map(p => p.id)).size !== room.roster.length) throw new Error('Invalid saved room.')
    ids.add(room.id)
    if (room.state) {
      const state = room.state
      if (!['round', 'results'].includes(state.phase) || !Number.isInteger(state.roundNumber) || state.roundNumber < 1 || state.targetScore !== room.targetScore || !Array.isArray(state.players) || state.players.length !== room.roster.length || !Array.isArray(state.history) || !Array.isArray(state.forcedTurns) || !Array.isArray(state.winnerIds)) throw new Error('Invalid saved match.')
      if (new Set(state.players.map(p => p.id)).size !== state.players.length || ![state.dealerId, state.selectedPlayerId, state.turnPlayerId, state.roundFinisherId, ...state.winnerIds].every(id => id === null || state.players.some(p => p.id === id)) || !state.forcedTurns.every(turn => state.players.some(p => p.id === turn.targetPlayerId) && state.players.some(p => p.id === turn.resumeAfterPlayerId) && Number.isInteger(turn.remaining) && turn.remaining >= 1 && turn.remaining <= 3)) throw new Error('Invalid saved turn order.')
      for (const player of state.players) {
        if (!validProfile(player) || !room.roster.some(p => p.id === player.id) || !Number.isFinite(player.totalScore) || !player.round || !Array.isArray(player.round.entries) || !['active', 'stayed', 'busted', 'frozen', 'flip-seven'].includes(player.round.status) || !Number.isInteger(player.round.nextId) || !Number.isFinite(player.round.flipThreeRemaining)) throw new Error('Invalid saved hand.')
        if (!player.round.entries.every(e => typeof e.instanceId === 'string' && typeof e.voided === 'boolean' && e.card)) throw new Error('Invalid saved card.')
        player.round.past = []; player.round.future = []
      }
      if (!state.history.every(h => Number.isInteger(h.round) && h.round >= 1 && h.scores && Object.values(h.scores).every(score => Number.isInteger(score) && score >= 0) && (!h.hands || Object.values(h.hands).every(hand => typeof hand.name === 'string' && hand.name.length <= 24 && /^#[0-9a-f]{6}$/i.test(hand.color) && (hand.avatar === undefined || isPlayerAvatarId(hand.avatar)) && ['active', 'stayed', 'busted', 'frozen', 'flip-seven'].includes(hand.status) && Array.isArray(hand.entries) && hand.entries.every(e => e.card && typeof e.instanceId === 'string' && typeof e.voided === 'boolean'))))) throw new Error('Invalid match history.')
      state.past = []; state.future = []
    }
  }
  // Version 1 saves retain all their room history; nothing needs to be counted twice.
  return { ...data, version: 2, archivedStats: data.archivedStats ?? {} }
}

export function getLibrary(): RoomLibrary {
  if (!library) {
    try { const raw = localStorage.getItem(STORAGE_KEY); library = raw ? decodeLibrary(raw) : emptyLibrary() }
    catch { library = emptyLibrary(); storageError = 'Your saved data could not be read. The original save is untouched. Export it from Settings before resetting storage.' }
  }
  return library
}
export function useLibrary() { return useSyncExternalStore((listener) => { listeners.add(listener); return () => listeners.delete(listener) }, getLibrary) }
export function getStorageError() { getLibrary(); return storageError }
export function storageBytes(data = getLibrary()) { return encodeLibrary(data).length * 2 }
export function formatBytes(bytes: number) { return bytes < 1024 ? `${bytes} B` : bytes < 1024 * 1024 ? `${(bytes / 1024).toFixed(1)} KB` : `${(bytes / 1024 / 1024).toFixed(2)} MB` }
export function updateLibrary(change: (current: RoomLibrary) => RoomLibrary) {
  const current = getLibrary()
  if (storageError) throw new Error(storageError)
  let next = change(current)
  const retainedIds = new Set(next.rooms.map(room => room.id))
  const archivedStats = { ...next.archivedStats }
  // Archive only removed, completed matches, in the same atomic save as cleanup.
  for (const room of current.rooms) {
    if (retainedIds.has(room.id) || room.state?.phase !== 'results') continue
    for (const player of room.state.players) {
      const previous = Object.hasOwn(archivedStats, player.id) ? archivedStats[player.id] : { matches: 0, wins: 0, best: 0 }
      Object.defineProperty(archivedStats, player.id, { value: {
        matches: previous.matches + 1,
        wins: previous.wins + Number(room.state.winnerIds.includes(player.id)),
        best: Math.max(previous.best, player.totalScore),
      }, enumerable: true, configurable: true, writable: true })
    }
  }
  next = { ...next, archivedStats }
  const raw = encodeLibrary(next)
  if (raw.length * 2 > STORAGE_LIMIT) throw new Error('Game storage is full. Export a backup, then remove old completed rooms in Settings to free space. Your previous save is safe.')
  try { localStorage.setItem(STORAGE_KEY, raw) }
  catch { throw new Error('This device could not save your changes. Free some device storage and try again. Your previous save is safe.') }
  library = next
  listeners.forEach(listener => listener())
}
export function newProfile(name: string, index = getLibrary().players.length): PlayerProfile {
  return { id: newLocalId(), name: name.trim(), color: bankerPlayerColors[index % bankerPlayerColors.length], avatar: defaultPlayerAvatarFor(undefined, index) }
}
export function savePlayerProfile(profile: PlayerProfile) {
  updateLibrary(current => {
    const exists = current.players.some(player => player.id === profile.id)
    if (!exists) return { ...current, players: [...current.players, profile] }

    const withProfile = <T extends PlayerProfile>(player: T): T => player.id === profile.id
      ? { ...player, name: profile.name, color: profile.color, avatar: profile.avatar ?? defaultPlayerAvatarFor(profile.id) }
      : player

    return {
      ...current,
      players: current.players.map(withProfile),
      rooms: current.rooms.map(room => {
        if (!room.roster.some(player => player.id === profile.id)) return room
        const state = room.state && {
          ...room.state,
          players: room.state.players.map(withProfile),
          history: room.state.history.map(round => {
            const hand = round.hands?.[profile.id]
            return hand ? { ...round, hands: { ...round.hands, [profile.id]: { ...hand, name: profile.name, color: profile.color, avatar: profile.avatar ?? defaultPlayerAvatarFor(profile.id) } } } : round
          }),
          past: room.state.past.map(snapshot => ({ ...snapshot, players: snapshot.players.map(withProfile) })),
          future: room.state.future.map(snapshot => ({ ...snapshot, players: snapshot.players.map(withProfile) })),
        }
        return { ...room, roster: room.roster.map(withProfile), state }
      }),
    }
  })
}
export function createRoom(name: string, targetScore: number, roster: PlayerProfile[]) {
  const room: Room = { id: newLocalId(), name: name.trim(), targetScore, roster, createdAt: Date.now(), updatedAt: Date.now(), pinned: false, state: null }
  updateLibrary(current => ({ ...current, rooms: [room, ...current.rooms], players: [...current.players, ...roster.filter(p => !current.players.some(existing => existing.id === p.id))] }))
  return room
}
export function saveRoom(room: Room) { updateLibrary(current => ({ ...current, rooms: current.rooms.map(existing => existing.id === room.id ? { ...room, updatedAt: Date.now() } : existing) })) }
export function saveRoomState(roomId: string, state: BankerState) {
  const room = getLibrary().rooms.find(r => r.id === roomId)
  if (!room) throw new Error('This room is no longer available.')
  saveRoom({ ...room, state })
}
export function startRoom(room: Room) {
  const started = bankerReducer(bankerInitialState(), { type: 'start', targetScore: room.targetScore, names: room.roster.map(p => p.name) })
  const firstId = room.roster[0].id
  const state: BankerState = { ...started, players: started.players.map((p, i) => ({ ...p, ...room.roster[i] })), dealerId: firstId, selectedPlayerId: firstId, turnPlayerId: firstId }
  saveRoom({ ...room, state })
}
export function canEditRoster(room: Room) { return !room.state || (room.state.phase === 'round' && room.state.forcedTurns.length === 0 && room.state.players.every(p => p.round.status === 'active' && p.round.entries.length === 0)) }
export function editRoom(room: Room, name: string, targetScore: number, roster: PlayerProfile[]) {
  if (!canEditRoster(room)) throw new Error('Change players before the first card of a round.')
  if (roster.length < 3 || roster.length > 18) throw new Error('A room needs 3–18 players.')
  if (room.state && targetScore <= Math.max(...room.state.players.map(p => p.totalScore))) throw new Error('The new target must be higher than the current leading score.')
  const currentState = room.state
  const state = currentState ? (() => {
    const retainedIds = new Set(roster.map(player => player.id))
    const turnPlayerId = currentState.turnPlayerId && retainedIds.has(currentState.turnPlayerId) ? currentState.turnPlayerId : roster[0].id
    return {
      ...currentState,
      targetScore,
      players: roster.map(p => {
        const existing = currentState.players.find(player => player.id === p.id)
        return existing ? { ...existing, ...p } : { ...p, totalScore: 0, round: demoInitialState() }
      }),
      dealerId: currentState.dealerId && retainedIds.has(currentState.dealerId) ? currentState.dealerId : turnPlayerId,
      selectedPlayerId: currentState.selectedPlayerId && retainedIds.has(currentState.selectedPlayerId) ? currentState.selectedPlayerId : turnPlayerId,
      turnPlayerId,
      roundFinisherId: currentState.roundFinisherId && retainedIds.has(currentState.roundFinisherId) ? currentState.roundFinisherId : null,
      winnerIds: currentState.winnerIds.filter(id => retainedIds.has(id)),
      past: [], future: [],
    }
  })() : null
  updateLibrary(current => ({ ...current, rooms: current.rooms.map(r => r.id === room.id ? { ...room, name: name.trim(), targetScore, roster, state, updatedAt: Date.now() } : r), players: [...current.players, ...roster.filter(p => !current.players.some(existing => existing.id === p.id))] }))
}
export function roomStatus(room: Room) { return !room.state ? 'Ready to play' : room.state.phase === 'results' ? 'Completed' : 'In progress' }
export function playerStats(id: string, rooms = getLibrary().rooms, archivedStats = getLibrary().archivedStats): PlayerStats {
  const completed = rooms.filter(r => r.state?.phase === 'results' && r.roster.some(p => p.id === id))
  const archived = Object.hasOwn(archivedStats, id) ? archivedStats[id] : { matches: 0, wins: 0, best: 0 }
  return { matches: archived.matches + completed.length, wins: archived.wins + completed.filter(r => r.state?.winnerIds.includes(id)).length, best: Math.max(archived.best, ...completed.map(r => r.state?.players.find(p => p.id === id)?.totalScore ?? 0)) }
}
export function exportBackup() {
  const raw = storageError ? localStorage.getItem(STORAGE_KEY) ?? '' : encodeLibrary(getLibrary())
  const url = URL.createObjectURL(new Blob([raw], { type: 'application/json' }))
  const link = document.createElement('a'); link.href = url; link.download = `flip7-backup-${new Date().toISOString().slice(0, 10)}.json`; link.click()
  setTimeout(() => URL.revokeObjectURL(url), 1000)
}
export function restoreBackup(raw: string) {
  const next = decodeLibrary(raw)
  if (storageBytes(next) > STORAGE_LIMIT) throw new Error('This backup exceeds the 10 MB game-data limit.')
  // Restore replaces the whole library, including lifetime stats, rather than merging counts.
  try { localStorage.setItem(STORAGE_KEY, encodeLibrary(next)) }
  catch { throw new Error('This device could not restore the backup. Its storage limit may be lower than 10 MB. Your previous save is safe.') }
  library = next; storageError = ''; listeners.forEach(listener => listener())
}
