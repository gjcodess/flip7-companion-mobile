import { useSyncExternalStore } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { bankerReducer, type BankerAction, type BankerState } from '../game/bankerGame'
import { pickerCards } from '../game/cards'
import { getLibrary, saveRoomState, updateLibrary, type PlayerProfile, type Room, type RoomLibrary } from './room-store'
import { isPlayerAvatarId } from './player-avatars'
import { newLocalId } from './local-id'

export type JoinRequest = { id: string; name: string; avatar: string; color: string; seatId: string; status: string }
type Session = { roomId: string; joinUrl: string; code: string; requests: JoinRequest[]; claimedSeats: string[] }
type Plugin = {
  start(options: { roomId: string; roomJson: string }): Promise<{ roomId: string; joinUrl: string; code: string }>
  publish(options: { roomId: string; roomJson: string }): Promise<void>
  stop(): Promise<void>
  listRequests(): Promise<{ requests: JoinRequest[]; claimedSeats: string[] }>
  approve(options: { requestId: string; seatId: string }): Promise<void>
  deny(options: { requestId: string }): Promise<void>
  revoke(options: { seatId: string }): Promise<void>
  respondAction(options: { actionId: string; ok: boolean; error?: string }): Promise<void>
  request(options: { url: string; method: string; body?: string }): Promise<{ status: number; body: string }>
  findCode(options: { code: string }): Promise<{ joinUrl: string }>
  addListener(event: string, callback: (data: Record<string, unknown>) => void): Promise<{ remove: () => Promise<void> }>
}

const plugin = registerPlugin<Plugin>('LocalRoom')
const listeners = new Set<() => void>()
let session: Session | null = null
let listening = false

function publicRoomJson(room: Room) {
  return JSON.stringify(room, (key, value) => key === 'past' || key === 'future' ? [] : value)
}

function setSession(next: Session | null) { session = next; listeners.forEach(listener => listener()) }
export function useLocalRoomSession() { return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener) }, () => session) }
export function localRoomAvailable() { return Capacitor.getPlatform() === 'android' }

export async function refreshLocalRoomRequests() {
  if (!session) return
  const next = await plugin.listRequests()
  if (session) setSession({ ...session, requests: next.requests, claimedSeats: next.claimedSeats })
}

export async function startLocalRoom(room: Room) {
  if (!localRoomAvailable()) throw new Error('Hosting a local room requires the Android app.')
  const next = await plugin.start({ roomId: room.id, roomJson: publicRoomJson(room) })
  setSession({ ...next, requests: [], claimedSeats: [] })
  await refreshLocalRoomRequests()
  return next
}

export async function stopLocalRoom() { await plugin.stop(); setSession(null) }

export async function syncLocalRoom(_library: RoomLibrary) {
  if (!session) return
  const room = getLibrary().rooms.find(item => item.id === session?.roomId)
  if (!room) { await stopLocalRoom(); return }
  await plugin.publish({ roomId: room.id, roomJson: publicRoomJson(room) })
}

export async function approveLocalJoin(request: JoinRequest) {
  if (!session) throw new Error('Start sharing this room first.')
  const room = getLibrary().rooms.find(item => item.id === session?.roomId)
  if (!room) throw new Error('This room is no longer available.')
  if (room.state?.phase === 'results') throw new Error('This match has finished. Start a new room to invite players.')
  if (room.roster.length + (room.pendingPlayers?.length ?? 0) >= 18) throw new Error('This room already has 18 players.')
  if (!request.name.trim() || !/^#[0-9a-f]{6}$/i.test(request.color) || !isPlayerAvatarId(request.avatar)) throw new Error('The player profile is invalid.')
  if ([...room.roster, ...(room.pendingPlayers ?? [])].some(player => player.name.toLowerCase() === request.name.trim().toLowerCase())) throw new Error(`${request.name} is already at the table. Ask them to use a different name.`)
  const profile: PlayerProfile = { id: newLocalId(), name: request.name.trim(), color: request.color, avatar: request.avatar }
  let added = false
  try {
    updateLibrary(current => ({ ...current, rooms: current.rooms.map(item => item.id !== room.id ? item : {
      ...item,
      roster: item.state ? item.roster : [...item.roster, profile],
      pendingPlayers: item.state ? [...(item.pendingPlayers ?? []), profile] : item.pendingPlayers,
      updatedAt: Date.now(),
    }) }))
    added = true
    await plugin.approve({ requestId: request.id, seatId: profile.id })
  } catch (error) {
    if (added) try {
      updateLibrary(current => ({ ...current, rooms: current.rooms.map(item => item.id !== room.id ? item : {
        ...item,
        roster: item.roster.filter(player => player.id !== profile.id),
        pendingPlayers: item.pendingPlayers?.filter(player => player.id !== profile.id),
      }) }))
    } catch { /* Preserve the original approval error. */ }
    throw error
  }
  await refreshLocalRoomRequests()
}

export async function denyLocalJoin(requestId: string) { await plugin.deny({ requestId }); await refreshLocalRoomRequests() }
export async function revokeLocalSeat(seatId: string) {
  const activeSession = session
  const currentRoom = activeSession ? getLibrary().rooms.find(item => item.id === activeSession.roomId) : null
  await plugin.revoke({ seatId })
  if (currentRoom) {
    const inPending = currentRoom.pendingPlayers?.some(p => p.id === seatId)
    const inRosterBeforeStart = !currentRoom.state && currentRoom.roster.some(p => p.id === seatId)
    if (inRosterBeforeStart || inPending) {
      updateLibrary(current => ({
        ...current,
        rooms: current.rooms.map(item => item.id !== currentRoom.id ? item : {
          ...item,
          roster: inRosterBeforeStart ? item.roster.filter(p => p.id !== seatId) : item.roster,
          pendingPlayers: item.pendingPlayers?.filter(p => p.id !== seatId),
          updatedAt: Date.now(),
        })
      }))
    }
    await syncLocalRoom(getLibrary())
  }
  await refreshLocalRoomRequests()
}

export function checkedGuestAction(state: BankerState, seatId: string, raw: unknown): BankerAction {
  if (!raw || typeof raw !== 'object') throw new Error('Invalid action.')
  const owner = state.players.find(player => player.id === seatId)
  if (state.phase !== 'round' || !owner) throw new Error('This player is not at an active table.')
  const value = raw as Record<string, unknown>
  if (value.type === 'record-card' && value.playerId === seatId && typeof (value.card as { id?: unknown })?.id === 'string') {
    const card = pickerCards.find(item => item.id === (value.card as { id: string }).id)
    if (card && card.kind !== 'action') return { type: 'record-card', playerId: seatId, card }
  }
  if (value.type === 'record-action' && value.sourcePlayerId === seatId && typeof value.targetPlayerId === 'string' && typeof (value.card as { id?: unknown })?.id === 'string') {
    const card = pickerCards.find(item => item.id === (value.card as { id: string }).id)
    if (card?.kind === 'action') return { type: 'record-action', sourcePlayerId: seatId, targetPlayerId: value.targetPlayerId, card }
  }
  if (value.type === 'settle-player' && value.playerId === seatId) return { type: 'settle-player', playerId: seatId }
  if (value.type === 'player' && value.playerId === seatId && (owner.round.status === 'active' || owner.round.status === 'busted') && value.action && typeof value.action === 'object') {
    const edit = value.action as Record<string, unknown>
    if (Number.isInteger(edit.index) && Number(edit.index) >= 0 && Number(edit.index) < owner.round.entries.length && owner.round.entries[Number(edit.index)].card.kind !== 'action') {
      if (edit.type === 'remove') return { type: 'player', playerId: seatId, action: { type: 'remove', index: Number(edit.index) } }
      if (edit.type === 'replace' && typeof (edit.card as { id?: unknown })?.id === 'string') {
        const card = pickerCards.find(item => item.id === (edit.card as { id: string }).id)
        if (card && card.kind !== 'action') return { type: 'player', playerId: seatId, action: { type: 'replace', index: Number(edit.index), card } }
      }
    }
  }
  throw new Error('You can change only your own table.')
}

async function handleGuestAction(data: Record<string, unknown>) {
  const actionId = String(data.actionId || '')
  try {
    if (!session) throw new Error('The room is no longer shared.')
    const room = getLibrary().rooms.find(item => item.id === session?.roomId)
    if (!room?.state) throw new Error('The match has not started.')
    const seatId = String(data.seatId || '')
    if (!room.roster.some(player => player.id === seatId)) throw new Error('This player is not at the table.')
    const action = checkedGuestAction(room.state, seatId, data.action)
    const next = bankerReducer(room.state, action)
    if (next === room.state) throw new Error('That move is no longer available. Check the current turn.')
    saveRoomState(room.id, next)
    await plugin.respondAction({ actionId, ok: true })
  } catch (error) {
    await plugin.respondAction({ actionId, ok: false, error: (error as Error).message })
  }
}

export async function listenLocalRoomHost() {
  if (!localRoomAvailable() || listening) return () => {}
  listening = true
  const handles = await Promise.all([
    plugin.addListener('joinRequest', () => { void refreshLocalRoomRequests() }),
    plugin.addListener('roomChanged', () => { void refreshLocalRoomRequests() }),
    plugin.addListener('guestAction', data => { void handleGuestAction(data) }),
  ])
  return () => { listening = false; handles.forEach(handle => { void handle.remove() }) }
}

export function parseJoinUrl(input: string): string {
  const url = new URL(input.trim())
  const parts = url.hostname.split('.').map(Number)
  const privateAddress = parts.length === 4 && parts.every(part => Number.isInteger(part) && part >= 0 && part <= 255) && (parts[0] === 10 || parts[0] === 127 || (parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31) || (parts[0] === 192 && parts[1] === 168))
  if (url.protocol !== 'http:' || !privateAddress || !url.port || !/^\/join\/[A-Z2-9]{16}$/.test(url.pathname)) throw new Error('Enter the full local room address shown on the host phone.')
  return `${url.origin}${url.pathname}`
}

export async function findLocalRoomCode(code: string) {
  if (!localRoomAvailable()) throw new Error('Room-code search is available in the Android app. Scan the QR code or use the full address here.')
  const result = await plugin.findCode({ code: code.trim().toUpperCase() })
  return parseJoinUrl(result.joinUrl)
}

export async function localRoomRequest<T>(url: string, path: string, body?: unknown): Promise<T> {
  const invite = new URL(parseJoinUrl(url))
  const token = invite.pathname.split('/')[2]
  const question = path.indexOf('?')
  const endpoint = question < 0 ? path : path.slice(0, question)
  const query = question < 0 ? '' : path.slice(question)
  const requestUrl = `${invite.origin}/api/${endpoint}/${token}${query}`
  let status: number
  let raw: string
  if (Capacitor.getPlatform() === 'android') {
    const result = await plugin.request({ url: requestUrl, method: body === undefined ? 'GET' : 'POST', body: body === undefined ? undefined : JSON.stringify(body) })
    status = result.status; raw = result.body
  } else {
    const result = await fetch(requestUrl, { method: body === undefined ? 'GET' : 'POST', headers: body === undefined ? undefined : { 'Content-Type': 'application/json' }, body: body === undefined ? undefined : JSON.stringify(body), cache: 'no-store' })
    status = result.status; raw = await result.text()
  }
  let parsed: Record<string, unknown>
  try { parsed = JSON.parse(raw) } catch { throw new Error('The host returned an unreadable response.') }
  if (status >= 400) throw new Error(typeof parsed.error === 'string' ? parsed.error : 'Could not reach this room.')
  return parsed as T
}
