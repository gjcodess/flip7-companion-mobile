import { useEffect, useSyncExternalStore } from 'react'
import { App } from '@capacitor/app'
import { Capacitor, registerPlugin } from '@capacitor/core'
import { getLibrary, saveJoinedRoom, saveRoom, type Room } from './room-store'
import { emptySharedHost, processRoomRequest, publicRoom, reconcileApprovedSeatNames, SHARED_PROTOCOL, type ParticipantCommand, type RoomReply, type RoomRequest } from './shared-room-protocol'
import { clearRoomPresence, expireRoomPresence, forgetRoomDevice, noteRoomRequest } from './shared-room-presence'
import { generateId } from './uuid'

export type RoomInvitation = { protocol: number; roomId: string; url: string; publicKey: string; invitationSecret: string; code?: string }
type NativeRoom = {
  start(options: { roomId: string }): Promise<Omit<RoomInvitation, 'protocol' | 'roomId'>>
  stop(): Promise<void>
  drain(): Promise<{ messages: { id: string; request: RoomRequest }[] }>
  reply(options: { id: string; response: RoomReply }): Promise<void>
  request(options: RoomInvitation & { request: RoomRequest }): Promise<RoomReply>
  resolveCode(options: { code: string }): Promise<RoomInvitation>
}
const transport = registerPlugin<NativeRoom>('SharedRoom')
const listeners = new Set<() => void>()
let hosting: RoomInvitation | null = null
const blockedHosts = new Set<string>()
export function blockSharedHost(roomId: string, blocked: boolean) { if (blocked) blockedHosts.add(roomId); else blockedHosts.delete(roomId) }
export const localRoomsAvailable = () => Capacitor.getPlatform() === 'android'
export function useHostedRoom() { return useSyncExternalStore(callback => { listeners.add(callback); return () => listeners.delete(callback) }, () => hosting) }
function publishHosting(next: RoomInvitation | null) { hosting = next; listeners.forEach(callback => callback()) }

const CODE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'
function deriveRoomCode(seed: string): string {
  let hash = 2166136261
  for (let i = 0; i < seed.length; i++) hash = Math.imul(hash ^ seed.charCodeAt(i), 16777619) >>> 0
  let out = ''
  for (let i = 0; i < 6; i++) {
    out += CODE_ALPHABET[hash % CODE_ALPHABET.length]
    hash = Math.imul(hash ^ (i + 17), 2246822519) >>> 0
  }
  return out
}
export function normalizeRoomCode(value: string): string {
  return value.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 6)
}
export function formatRoomCode(code: string): string {
  const clean = normalizeRoomCode(code)
  return clean.length > 3 ? `${clean.slice(0, 3)} ${clean.slice(3)}` : clean
}
export function invitationCode(invitation: RoomInvitation): string {
  const explicit = invitation.code ? normalizeRoomCode(invitation.code) : ''
  return explicit.length === 6 ? explicit : deriveRoomCode(`${invitation.roomId}:${invitation.invitationSecret}`)
}

export async function startHosting(room: Room) {
  if (!localRoomsAvailable()) throw new Error('Local rooms are available in the Android app.')
  if (room.joinedCopy) throw new Error('Only the original host can host this room.')
  if (!room.state && !room.vengeanceState) throw new Error('Start this match before enabling joining.')
  const current = getLibrary().rooms.find(item => item.id === room.id) ?? room
  const reconciled = reconcileApprovedSeatNames(current)
  if (reconciled !== current) saveRoom(reconciled)
  else if (!current.sharedHost) saveRoom({ ...current, sharedHost: emptySharedHost() })
  const native = await transport.start({ roomId: room.id })
  clearRoomPresence(room.id)
  const full: RoomInvitation = { ...native, protocol: SHARED_PROTOCOL, roomId: room.id }
  full.code = invitationCode(full)
  publishHosting(full)
}
export async function stopHosting() { await transport.stop(); if (hosting) clearRoomPresence(hosting.roomId); publishHosting(null) }
export const invitationText = (invitation: RoomInvitation) => `flip7-local:${JSON.stringify(invitation)}`
export function parseInvitation(raw: string): RoomInvitation {
  const text = raw.trim()
  if (!text.startsWith('flip7-local:') || text.length > 3000) throw new Error('Scan a Flip 7 QR code or enter a 6-character room code.')
  let data: RoomInvitation
  try { data = JSON.parse(text.slice('flip7-local:'.length)) } catch { throw new Error('This room invitation is damaged.') }
  if (!data || data.protocol !== SHARED_PROTOCOL) throw new Error('App versions are incompatible. Update both apps.')
  if (typeof data.roomId !== 'string' || !/^[a-zA-Z0-9-]{1,80}$/.test(data.roomId) || typeof data.publicKey !== 'string' || !/^[a-zA-Z0-9+/=]{300,600}$/.test(data.publicKey) || typeof data.invitationSecret !== 'string' || !/^[a-zA-Z0-9+/=]{40,100}$/.test(data.invitationSecret)) throw new Error('Invalid room invitation.')
  if (data.code !== undefined && (typeof data.code !== 'string' || !/^[A-Z0-9]{6}$/i.test(data.code))) throw new Error('Invalid room code.')
  let url: URL
  try { url = new URL(data.url) } catch { throw new Error('Invalid local-room address.') }
  const parts = url.hostname.split('.').map(Number)
  if (url.protocol !== 'http:' || url.username || url.password || url.search || url.hash || !url.port || url.pathname !== `/room/${data.roomId}` || parts.length !== 4 || parts.some(n => !Number.isInteger(n) || n < 0 || n > 255) || !(parts[0] === 10 || parts[0] === 192 && parts[1] === 168 || parts[0] === 172 && parts[1] >= 16 && parts[1] <= 31)) throw new Error('Rooms must use a local Wi-Fi or hotspot address.')
  return data
}
export async function resolveInvitation(raw: string): Promise<RoomInvitation> {
  const text = raw.trim()
  if (text.startsWith('flip7-local:')) return parseInvitation(text)
  const code = normalizeRoomCode(text)
  if (code.length !== 6) throw new Error('Enter the 6-character room code from your host.')
  if (!localRoomsAvailable()) throw new Error('Join using the Android app on the same Wi-Fi or hotspot.')
  const resolved = await transport.resolveCode({ code })
  return parseInvitation(invitationText({ ...resolved, protocol: resolved.protocol ?? SHARED_PROTOCOL }))
}

export function useHostRoomPump(path: string, search: string) {
  const invitation = useHostedRoom()
  useEffect(() => {
    if (!invitation) return
    let cancelled = false, busy = false, appActive = true
    let listener: { remove(): Promise<void> } | undefined
    void App.addListener('appStateChange', state => { appActive = state.isActive }).then(handle => { if (cancelled) void handle.remove(); else listener = handle }).catch(() => {})
    const params = new URLSearchParams(search)
    const present = (path === '/room' && params.get('id') === invitation.roomId) || (path === '/banker' || path === '/vengeance') && params.get('room') === invitation.roomId
    const tick = async () => {
      if (busy || cancelled) return
      busy = true
      try {
        const { messages } = await transport.drain()
        for (const message of messages) {
          let response: RoomReply
          try {
            if (cancelled || !present || !appActive || document.visibilityState === 'hidden' || blockedHosts.has(invitation.roomId)) throw new Error('The host is paused. Ask them to reopen the room.')
            const room = getLibrary().rooms.find(r => r.id === invitation.roomId && !r.joinedCopy)
            if (!room) throw new Error('The host room is no longer available.')
            const transaction = processRoomRequest(room, message.request)
            // Synchronous durable save occurs before any success response leaves the phone.
            if (transaction.next !== room) saveRoom(transaction.next)
            response = transaction.reply
            if (message.request.type === 'leave') forgetRoomDevice(invitation.roomId, message.request.deviceId)
            else if (response.status === 'approved') noteRoomRequest(invitation.roomId, message.request.deviceId)
            if (response.room) response.room = publicRoom(getLibrary().rooms.find(r => r.id === invitation.roomId)!)
          } catch (error) { response = { ok: false, error: error instanceof Error ? error.message : 'Could not accept this action.' } }
          const compact = JSON.parse(JSON.stringify(response, (key, value) => key === 'card' && value?.id ? value.id : value)) as RoomReply
          await transport.reply({ id: message.id, response: compact })
        }
      } catch { /* Native stop/restart can overlap a poll. */ }
      finally { busy = false }
    }
    const timer = window.setInterval(() => { void tick() }, 180)
    const presenceTimer = window.setInterval(() => expireRoomPresence(), 1000)
    void tick()
    return () => { cancelled = true; clearInterval(timer); clearInterval(presenceTimer); void listener?.remove() }
  }, [invitation, path, search])
}

type JoinedSession = { invitation: RoomInvitation; deviceId: string; secret: string; localProfileId?: string; pending?: { operationId: string; revision: number; command: ParticipantCommand } }
const SESSION_KEY = 'flip7.joined-session.v1'
export function readJoinedSession(): JoinedSession | null {
  try {
    const raw = localStorage.getItem(SESSION_KEY)
    if (!raw) return null
    const data = JSON.parse(raw) as JoinedSession
    parseInvitation(invitationText(data.invitation))
    if (typeof data.deviceId !== 'string' || typeof data.secret !== 'string') return null
    return data
  } catch { return null }
}
function writeSession(session: JoinedSession) { localStorage.setItem(SESSION_KEY, JSON.stringify(session)) }
export function connectInvitation(invitation: RoomInvitation, localProfileId?: string): JoinedSession {
  const previous = readJoinedSession()
  if (previous?.pending && previous.invitation.roomId !== invitation.roomId) throw new Error('Reconnect to the previous room to resolve its unconfirmed action first.')
  const sameRoom = previous?.invitation.roomId === invitation.roomId
  const next: JoinedSession = { invitation, deviceId: sameRoom ? previous.deviceId : generateId(), secret: sameRoom ? previous.secret : `${generateId()}${generateId()}`, localProfileId: sameRoom ? previous.localProfileId ?? localProfileId : localProfileId, pending: sameRoom ? previous.pending : undefined }
  writeSession(next); return next
}
let requestTail: Promise<unknown> = Promise.resolve()
let cachedReply: { roomId: string; playerId: string; revision: number; room: Room } | undefined
export function requestJoined(request: Partial<RoomRequest>): Promise<RoomReply> {
  // Serialize polls and actions so a slow earlier poll cannot replace a newer accepted hand.
  const operation = requestTail.then(() => performJoinedRequest(request))
  requestTail = operation.catch(() => {})
  return operation
}
async function performJoinedRequest(request: Partial<RoomRequest>): Promise<RoomReply> {
  if (!localRoomsAvailable()) throw new Error('Join using the Android app on the same Wi-Fi or hotspot.')
  const session = readJoinedSession()
  if (!session) throw new Error('Scan the host’s room QR code first.')
  const known = cachedReply?.roomId === session.invitation.roomId ? cachedReply : undefined
  const response = await transport.request({ ...session.invitation, request: { ...(request.type === 'poll' ? { revision: known?.revision } : {}), ...request, type: request.type ?? 'poll', protocol: SHARED_PROTOCOL, deviceId: session.deviceId, secret: session.secret } })
  if (response.ok && response.room && response.playerId && response.revision !== undefined) {
    if (response.room.id !== session.invitation.roomId || response.room.sharedHost || response.room.joinedCopy) throw new Error('Invalid host response.')
    response.room = saveJoinedRoom(response.room, response.revision, response.playerId, session.localProfileId)
    cachedReply = { roomId: session.invitation.roomId, playerId: response.playerId, revision: response.revision, room: response.room }
  } else if (response.ok && response.status === 'approved' && known && known.revision === response.revision && known.playerId === response.playerId) {
    response.room = known.room
  } else if (response.ok && response.status !== 'approved') {
    cachedReply = undefined
  }
  return response
}
export async function submitJoined(command?: ParticipantCommand, revision?: number) {
  const session = readJoinedSession()
  if (!session) throw new Error('Join a room first.')
  const pending = session.pending ?? (command && revision !== undefined ? { operationId: generateId(), revision, command } : undefined)
  if (!pending) throw new Error('There is no action to retry.')
  // Preserve a request across timeouts/restarts. Retry its ID before accepting a new action.
  writeSession({ ...session, pending })
  const response = await requestJoined({ type: 'action', ...pending })
  const latest = readJoinedSession()
  if (latest?.pending?.operationId === pending.operationId) writeSession({ ...latest, pending: undefined })
  return response
}
