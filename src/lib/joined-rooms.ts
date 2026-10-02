import { useSyncExternalStore } from 'react'
import type { Room } from './room-store'

export type JoinedRoom = { url: string; room: Room; seatId: string; secret: string; savedAt: number }
const KEY = 'flip7.joined-rooms.v1'
const listeners = new Set<() => void>()
let cached: JoinedRoom[] | undefined

export function getJoinedRooms(): JoinedRoom[] {
  if (cached) return cached
  try {
    const parsed = JSON.parse(localStorage.getItem(KEY) || '[]')
    cached = Array.isArray(parsed) ? parsed.filter(item => typeof item.url === 'string' && typeof item.secret === 'string' && typeof item.seatId === 'string' && item.room?.id) : []
  } catch { cached = [] }
  return cached ?? []
}

export function saveJoinedRoom(entry: JoinedRoom) {
  const next = [entry, ...getJoinedRooms().filter(item => item.room.id !== entry.room.id)].slice(0, 20)
  for (let length = next.length; length > 0; length--) {
    try {
      const stored = next.slice(0, length)
      localStorage.setItem(KEY, JSON.stringify(stored))
      cached = stored
      listeners.forEach(listener => listener())
      return
    } catch { /* Make room by dropping the oldest joined copy. */ }
  }
  throw new Error('This device could not save a copy of the room.')
}

export function forgetJoinedRoom(url: string) {
  const next = getJoinedRooms().filter(item => item.url !== url)
  try { localStorage.setItem(KEY, JSON.stringify(next)) } catch { /* Keep the in-memory copy accurate. */ }
  cached = next
  listeners.forEach(listener => listener())
}

export function findJoinedRoom(url: string) { return getJoinedRooms().find(item => item.url === url) }
export function useJoinedRooms() { return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener) }, getJoinedRooms) }
