import { useSyncExternalStore } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { bankerInitialState, bankerPlayerColors, bankerReducer, type BankerState } from '../game/bankerGame'
import { pickerCards } from '../game/cards'
import { demoInitialState } from '../game/demoGame'
import { vengeanceCards } from '../game/vengeanceCards'
import { vengeanceInitialState, type VState } from '../game/vengeanceGame'
import { defaultPlayerAvatarFor, isPlayerAvatarId, type PlayerAvatarId } from './player-avatars'

type NativeBackupPlugin = {
  shareBackup(options: { data: string; fileName: string; text?: string }): Promise<{ success: boolean }>
}

const getNativeBackup = () => registerPlugin<NativeBackupPlugin>('NativeBackup')

export type PlayerProfile = { id: string; name: string; color: string; avatar?: PlayerAvatarId }
export type Edition = 'classic' | 'vengeance'
export type RoomVariant = 'standard' | 'brutal'
export type Room = {
  id: string; name: string; createdAt: number; updatedAt: number
  targetScore: number; roster: PlayerProfile[]; state: BankerState | null; pinned: boolean
  edition?: Edition; vengeanceState?: VState | null; vengeanceDealerId?: string; variant?: RoomVariant
}
export type PlayerStats = { matches: number; wins: number; best: number }
export type RoomLibrary = { version: 3; rooms: Room[]; players: PlayerProfile[]; vengeancePlayers: PlayerProfile[]; archivedStats: Record<string, PlayerStats>; vengeanceArchivedStats: Record<string, PlayerStats>; settings: { targetScore: number; vengeanceTargetScore: number; edition: Edition; reducedMotion: boolean } }
export const STORAGE_KEY = 'flip7.rooms.v1'
export const STORAGE_LIMIT = 10 * 1024 * 1024
const listeners = new Set<() => void>()
const emptyLibrary = (): RoomLibrary => ({ version: 3, rooms: [], players: [], vengeancePlayers: [], archivedStats: {}, vengeanceArchivedStats: {}, settings: { targetScore: 200, vengeanceTargetScore: 200, edition: 'classic', reducedMotion: false } })
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
    const card = [...pickerCards, ...vengeanceCards].find((item) => item.id === value)
    if (!card) throw new Error('Unknown card in saved game.')
    return card
  }) as Omit<RoomLibrary, 'version' | 'archivedStats'> & { version: number; archivedStats?: Record<string, PlayerStats> }
  if (!data || ![1, 2, 3].includes(data.version) || !Array.isArray(data.rooms) || !Array.isArray(data.players) || !data.settings) throw new Error('Unsupported save file.')
  if (data.version === 2 || data.archivedStats !== undefined) {
    if (!data.archivedStats || typeof data.archivedStats !== 'object' || Array.isArray(data.archivedStats) || !Object.entries(data.archivedStats).every(([id, stats]) => id.length > 0 && stats && typeof stats === 'object' && Number.isSafeInteger(stats.matches) && stats.matches >= 0 && Number.isSafeInteger(stats.wins) && stats.wins >= 0 && stats.wins <= stats.matches && Number.isSafeInteger(stats.best) && stats.best >= 0)) throw new Error('Invalid saved lifetime stats.')
  }
  if (!Number.isInteger(data.settings.targetScore) || data.settings.targetScore < 50 || data.settings.targetScore > 500 || typeof data.settings.reducedMotion !== 'boolean') throw new Error('Invalid saved settings.')
  if (data.version === 3 && (!['classic', 'vengeance'].includes(data.settings.edition) || !Number.isInteger(data.settings.vengeanceTargetScore) || data.settings.vengeanceTargetScore < 50 || data.settings.vengeanceTargetScore > 500)) throw new Error('Invalid saved edition settings.')
  const ids = new Set<string>()
  const validProfile = (p: PlayerProfile) => typeof p?.id === 'string' && typeof p.name === 'string' && p.name.trim().length > 0 && p.name.length <= 24 && /^#[0-9a-f]{6}$/i.test(p.color) && (p.avatar === undefined || isPlayerAvatarId(p.avatar))
  if (!data.players.every(validProfile) || new Set(data.players.map(p => p.id)).size !== data.players.length) throw new Error('Invalid saved players.')
  if (data.version === 3 && (!Array.isArray(data.vengeancePlayers) || !data.vengeancePlayers.every(validProfile) || new Set(data.vengeancePlayers.map(p => p.id)).size !== data.vengeancePlayers.length || !data.vengeanceArchivedStats || typeof data.vengeanceArchivedStats !== 'object' || Array.isArray(data.vengeanceArchivedStats) || !Object.values(data.vengeanceArchivedStats).every(stats => stats && Number.isSafeInteger(stats.matches) && stats.matches >= 0 && Number.isSafeInteger(stats.wins) && stats.wins >= 0 && stats.wins <= stats.matches && Number.isSafeInteger(stats.best) && stats.best >= 0))) throw new Error('Invalid saved Vengeance players.')
  for (const room of data.rooms) {
    if (typeof room.id !== 'string' || ids.has(room.id) || typeof room.name !== 'string' || !room.name.trim() || room.name.length > 40 || !Number.isFinite(room.createdAt) || !Number.isFinite(room.updatedAt) || !Number.isInteger(room.targetScore) || room.targetScore < 50 || room.targetScore > 500 || !Array.isArray(room.roster) || room.roster.length < 2 || room.roster.length > 18 || !room.roster.every(validProfile) || new Set(room.roster.map(p => p.id)).size !== room.roster.length) throw new Error('Invalid saved room.')
    ids.add(room.id)
    if (room.edition !== undefined && !['classic', 'vengeance'].includes(room.edition)) throw new Error('Invalid saved edition.')
    if (room.variant !== undefined && !['standard', 'brutal'].includes(room.variant)) throw new Error('Invalid saved variant.')
    if (room.edition === 'vengeance') {
      if (room.vengeanceDealerId && !room.roster.some(player => player.id === room.vengeanceDealerId)) throw new Error('Invalid Vengeance dealer.')
      if (room.state || (room.vengeanceState && (!['deal', 'turn', 'settlement', 'results'].includes(room.vengeanceState.phase) || !Array.isArray(room.vengeanceState.players) || room.vengeanceState.players.length !== room.roster.length || !Array.isArray(room.vengeanceState.history) || !Array.isArray(room.vengeanceState.forced) || !Array.isArray(room.vengeanceState.resolving) || !Array.isArray(room.vengeanceState.events) || !Number.isInteger(room.vengeanceState.nextId)))) throw new Error('Invalid saved Vengeance match.')
      if (room.vengeanceState) {
        const state = room.vengeanceState
        const playerIds = new Set(state.players.map(player => player.id))
        const validPending = (pending: VState['pending']) => !pending || (pending.card?.id?.startsWith('v-') && playerIds.has(pending.sourceId) && (!pending.actorId || playerIds.has(pending.actorId)) && (!pending.targetId || playerIds.has(pending.targetId)) && Array.isArray(pending.selectedCards) && pending.selectedCards.every(id => typeof id === 'string'))
        if (state.targetScore !== room.targetScore || !Number.isInteger(state.roundNumber) || state.roundNumber < 1 || !Number.isInteger(state.dealIndex) || state.dealIndex < 0 || state.dealIndex > state.players.length || !playerIds.has(state.dealerId) || !playerIds.has(state.selectedPlayerId) || (state.turnPlayerId !== null && !playerIds.has(state.turnPlayerId)) || playerIds.size !== state.players.length || !state.players.every(player => validProfile(player) && room.roster.some(profile => profile.id === player.id) && ['active', 'stayed', 'busted', 'frozen', 'flip-seven'].includes(player.status) && Number.isFinite(player.totalScore) && Array.isArray(player.entries) && player.entries.every(entry => typeof entry.instanceId === 'string' && entry.card?.id?.startsWith('v-')))) throw new Error('Invalid saved Vengeance hand.')
        if (!validPending(state.pending) || !state.resolving.every(validPending) || !state.forced.every(force => ['one', 'four'].includes(force.kind) && playerIds.has(force.targetId) && Number.isInteger(force.remaining) && force.remaining >= 0 && force.remaining <= 4 && Array.isArray(force.deferred) && force.deferred.every(validPending)) || !state.history.every(round => Number.isInteger(round.round) && round.round >= 1 && round.scores && Object.values(round.scores).every(score => Number.isInteger(score)) && round.hands && Array.isArray(round.events))) throw new Error('Invalid pending Vengeance action.')
        state.past = []; state.future = []
      }
      continue
    }
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
  return { ...data, version: 3, rooms: data.rooms.map(room => ({ ...room, edition: room.edition ?? 'classic', variant: room.variant ?? 'standard' })), archivedStats: data.archivedStats ?? {}, vengeancePlayers: data.vengeancePlayers ?? [], vengeanceArchivedStats: data.vengeanceArchivedStats ?? {}, settings: { ...data.settings, edition: data.settings.edition ?? 'classic', vengeanceTargetScore: data.settings.vengeanceTargetScore ?? 200 } }
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
  const vengeanceArchivedStats = { ...next.vengeanceArchivedStats }
  // Archive only removed, completed matches, in the same atomic save as cleanup.
  for (const room of current.rooms) {
    const finished = room.edition === 'vengeance' ? room.vengeanceState : room.state
    if (retainedIds.has(room.id) || finished?.phase !== 'results') continue
    const destination = room.edition === 'vengeance' ? vengeanceArchivedStats : archivedStats
    for (const player of finished.players) {
      const previous = Object.hasOwn(destination, player.id) ? destination[player.id] : { matches: 0, wins: 0, best: 0 }
      Object.defineProperty(destination, player.id, { value: {
        matches: previous.matches + 1,
        wins: previous.wins + Number(finished.winnerIds.includes(player.id)),
        best: Math.max(previous.best, player.totalScore),
      }, enumerable: true, configurable: true, writable: true })
    }
  }
  next = { ...next, archivedStats, vengeanceArchivedStats }
  const raw = encodeLibrary(next)
  if (raw.length * 2 > STORAGE_LIMIT) throw new Error('Game storage is full. Export a backup, then remove old completed rooms in Settings to free space. Your previous save is safe.')
  try { localStorage.setItem(STORAGE_KEY, raw) }
  catch { throw new Error('This device could not save your changes. Free some device storage and try again. Your previous save is safe.') }
  library = next
  listeners.forEach(listener => listener())
}
export function newProfile(name: string, index = getLibrary().players.length): PlayerProfile {
  return { id: crypto.randomUUID(), name: name.trim(), color: bankerPlayerColors[index % bankerPlayerColors.length], avatar: defaultPlayerAvatarFor(undefined, index) }
}
export function savePlayerProfile(profile: PlayerProfile, edition: Edition = 'classic') {
  updateLibrary(current => {
    const key = edition === 'vengeance' ? 'vengeancePlayers' : 'players'
    const exists = current[key].some(player => player.id === profile.id)
    if (!exists) return { ...current, [key]: [...current[key], profile] }

    const withProfile = <T extends PlayerProfile>(player: T): T => player.id === profile.id
      ? { ...player, name: profile.name, color: profile.color, avatar: profile.avatar ?? defaultPlayerAvatarFor(profile.id) }
      : player

    return {
      ...current,
      [key]: current[key].map(withProfile),
      rooms: current.rooms.map(room => {
        if ((room.edition ?? 'classic') !== edition || !room.roster.some(player => player.id === profile.id)) return room
        if (edition === 'vengeance') return { ...room, roster: room.roster.map(withProfile), vengeanceState: room.vengeanceState && { ...room.vengeanceState, players: room.vengeanceState.players.map(withProfile) } }
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
export function createRoom(name: string, targetScore: number, roster: PlayerProfile[], edition: Edition = 'classic', vengeanceDealerId?: string, variant: RoomVariant = 'standard') {
  const room: Room = { id: crypto.randomUUID(), name: name.trim(), targetScore, roster, createdAt: Date.now(), updatedAt: Date.now(), pinned: false, state: null, edition, vengeanceState: null, vengeanceDealerId, variant }
  updateLibrary(current => { const key = edition === 'vengeance' ? 'vengeancePlayers' : 'players'; return { ...current, rooms: [room, ...current.rooms], [key]: [...current[key], ...roster.filter(p => !current[key].some(existing => existing.id === p.id))] } })
  return room
}
export function saveRoom(room: Room) { updateLibrary(current => ({ ...current, rooms: current.rooms.map(existing => existing.id === room.id ? { ...room, updatedAt: Date.now() } : existing) })) }
export function saveRoomState(roomId: string, state: BankerState) {
  const room = getLibrary().rooms.find(r => r.id === roomId)
  if (!room) throw new Error('This room is no longer available.')
  saveRoom({ ...room, state })
}
export function saveVengeanceState(roomId: string, state: VState) {
  const room = getLibrary().rooms.find(r => r.id === roomId && r.edition === 'vengeance')
  if (!room) throw new Error('This Vengeance room is no longer available.')
  saveRoom({ ...room, vengeanceState: state })
}
export function startRoom(room: Room) {
  if (room.edition === 'vengeance') { saveRoom({ ...room, vengeanceState: vengeanceInitialState(room.roster, room.targetScore, room.vengeanceDealerId, room.variant ?? 'standard') }); return }
  const started = bankerReducer(bankerInitialState(), { type: 'start', targetScore: room.targetScore, names: room.roster.map(p => p.name) })
  const firstId = room.roster[0].id
  const state: BankerState = { ...started, players: started.players.map((p, i) => ({ ...p, ...room.roster[i] })), dealerId: firstId, selectedPlayerId: firstId, turnPlayerId: firstId }
  saveRoom({ ...room, state })
}
export function canEditRoster(room: Room) { return room.edition === 'vengeance' ? !room.vengeanceState || (room.vengeanceState.phase === 'deal' && room.vengeanceState.events.length === 0) : !room.state || (room.state.phase === 'round' && room.state.forcedTurns.length === 0 && room.state.players.every(p => p.round.status === 'active' && p.round.entries.length === 0)) }
export function editRoom(room: Room, name: string, targetScore: number, roster: PlayerProfile[], vengeanceDealerId?: string, variant?: RoomVariant) {
  if (!canEditRoster(room)) throw new Error('Change players before the first card of a round.')
  if (roster.length < 2 || roster.length > 18) throw new Error('A room needs 2–18 players.')
  const nextVariant = variant ?? room.variant ?? 'standard'
  if (room.edition === 'vengeance') {
    const previous = room.vengeanceState
    if (previous && targetScore <= Math.max(...previous.players.map(player => player.totalScore))) throw new Error('The new target must be higher than the current leading score.')
    const selectedDealer = roster.some(player => player.id === vengeanceDealerId) ? vengeanceDealerId! : roster.some(player => player.id === previous?.dealerId) ? previous!.dealerId : roster[roster.length - 1].id
    const fresh = previous && vengeanceInitialState(roster, targetScore, selectedDealer, nextVariant)
    const vengeanceState = fresh && { ...fresh, roundNumber: previous!.roundNumber, history: previous!.history, players: fresh.players.map(player => ({ ...player, totalScore: previous!.players.find(old => old.id === player.id)?.totalScore ?? 0 })) }
    updateLibrary(current => ({ ...current, rooms: current.rooms.map(item => item.id === room.id ? { ...room, name: name.trim(), targetScore, roster, variant: nextVariant, vengeanceDealerId: selectedDealer, vengeanceState, updatedAt: Date.now() } : item), vengeancePlayers: [...current.vengeancePlayers, ...roster.filter(player => !current.vengeancePlayers.some(existing => existing.id === player.id))] }))
    return
  }
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
export function roomStatus(room: Room) { const state = room.edition === 'vengeance' ? room.vengeanceState : room.state; return !state ? 'Ready to play' : state.phase === 'results' ? 'Completed' : 'In progress' }
export function playerStats(id: string, rooms = getLibrary().rooms, archivedStats = getLibrary().archivedStats, edition: Edition = 'classic'): PlayerStats {
  const completed = rooms.filter(r => (r.edition ?? 'classic') === edition && (edition === 'vengeance' ? r.vengeanceState?.phase : r.state?.phase) === 'results' && r.roster.some(p => p.id === id))
  const archived = Object.hasOwn(archivedStats, id) ? archivedStats[id] : { matches: 0, wins: 0, best: 0 }
  return { matches: archived.matches + completed.length, wins: archived.wins + completed.filter(r => (edition === 'vengeance' ? r.vengeanceState : r.state)?.winnerIds.includes(id)).length, best: Math.max(archived.best, ...completed.map(r => (edition === 'vengeance' ? r.vengeanceState : r.state)?.players.find(p => p.id === id)?.totalScore ?? 0)) }
}
export async function exportBackup(): Promise<{ success: boolean; canceled?: boolean; method: string }> {
  const raw = storageError ? localStorage.getItem(STORAGE_KEY) ?? '' : encodeLibrary(getLibrary())
  const dateStr = new Date().toISOString().slice(0, 10)
  const fileName = `flip7-backup-${dateStr}.json`

  // 1. Android Native Platform
  if (Capacitor.getPlatform() === 'android') {
    try {
      await getNativeBackup().shareBackup({
        data: raw,
        fileName,
        text: 'Flip7 Companion game data backup'
      })
      return { success: true, method: 'native-share' }
    } catch (err: any) {
      const msg = String(err?.message ?? err).toLowerCase()
      if (msg.includes('cancel') || msg.includes('dismiss') || msg.includes('abort')) {
        return { success: false, canceled: true, method: 'native-share' }
      }
      throw err
    }
  }

  // 2. Modern Web File System Access API (allows user to choose exact save folder)
  if (typeof window !== 'undefined' && 'showSaveFilePicker' in window) {
    try {
      const handle = await (window as any).showSaveFilePicker({
        suggestedName: fileName,
        types: [{
          description: 'JSON Backup File',
          accept: { 'application/json': ['.json'] }
        }]
      })
      const writable = await handle.createWritable()
      await writable.write(raw)
      await writable.close()
      return { success: true, method: 'file-picker' }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { success: false, canceled: true, method: 'file-picker' }
      }
    }
  }

  // 3. Web Share API with File
  if (typeof navigator !== 'undefined' && typeof navigator.share === 'function') {
    try {
      const file = new File([raw], fileName, { type: 'application/json' })
      if (navigator.canShare && navigator.canShare({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: 'Flip7 Backup',
          text: 'Flip7 Companion game data backup'
        })
        return { success: true, method: 'web-share' }
      }
    } catch (err: any) {
      if (err?.name === 'AbortError') {
        return { success: false, canceled: true, method: 'web-share' }
      }
    }
  }

  // 4. Standard Browser Anchor Download Fallback
  if (typeof document !== 'undefined') {
    const blob = new Blob([raw], { type: 'application/json' })
    const url = URL.createObjectURL(blob)
    const link = document.createElement('a')
    link.href = url
    link.download = fileName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
    setTimeout(() => URL.revokeObjectURL(url), 1000)
    return { success: true, method: 'browser-download' }
  }

  return { success: true, method: 'unknown' }
}

export function getBackupRawData(): string {
  return storageError ? localStorage.getItem(STORAGE_KEY) ?? '' : encodeLibrary(getLibrary())
}
export function restoreBackup(raw: string) {
  const next = decodeLibrary(raw)
  if (storageBytes(next) > STORAGE_LIMIT) throw new Error('This backup exceeds the 10 MB game-data limit.')
  // Restore replaces the whole library, including lifetime stats, rather than merging counts.
  try { localStorage.setItem(STORAGE_KEY, encodeLibrary(next)) }
  catch { throw new Error('This device could not restore the backup. Its storage limit may be lower than 10 MB. Your previous save is safe.') }
  library = next; storageError = ''; listeners.forEach(listener => listener())
}
