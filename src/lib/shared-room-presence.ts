import { useSyncExternalStore } from 'react'

// Approval is saved with the room; connection is inferred from recent requests and never saved.
export const ROOM_PRESENCE_TIMEOUT_MS = 5000
const seen = new Map<string, Map<string, number>>()
const snapshots = new Map<string, ReadonlySet<string>>()
const listeners = new Set<() => void>()
const empty = new Set<string>()

function publish(roomId: string, now: number) {
  const devices = seen.get(roomId)
  const connected = new Set<string>()
  if (devices) for (const [deviceId, lastSeen] of devices) {
    if (now - lastSeen < ROOM_PRESENCE_TIMEOUT_MS) connected.add(deviceId)
    else devices.delete(deviceId)
  }
  if (devices && devices.size === 0) seen.delete(roomId)
  const previous = snapshots.get(roomId) ?? empty
  if (previous.size === connected.size && [...previous].every(id => connected.has(id))) return
  if (connected.size) snapshots.set(roomId, connected)
  else snapshots.delete(roomId)
  listeners.forEach(listener => listener())
}

export function noteRoomRequest(roomId: string, deviceId: string, now = Date.now()) {
  const devices = seen.get(roomId) ?? new Map<string, number>()
  devices.set(deviceId, now)
  seen.set(roomId, devices)
  publish(roomId, now)
}

export function expireRoomPresence(now = Date.now()) {
  for (const roomId of seen.keys()) publish(roomId, now)
}

export function forgetRoomDevice(roomId: string, deviceId: string) {
  seen.get(roomId)?.delete(deviceId)
  publish(roomId, Date.now())
}

export function clearRoomPresence(roomId: string) {
  seen.delete(roomId)
  if (!snapshots.delete(roomId)) return
  listeners.forEach(listener => listener())
}

export function connectedRoomDevices(roomId: string) { return snapshots.get(roomId) ?? empty }

export function useRoomPresence(roomId?: string) {
  return useSyncExternalStore(
    listener => { listeners.add(listener); return () => { listeners.delete(listener) } },
    () => roomId ? connectedRoomDevices(roomId) : empty,
  )
}
