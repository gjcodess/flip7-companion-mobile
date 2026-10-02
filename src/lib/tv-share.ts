import { useSyncExternalStore } from 'react'
import { Capacitor, registerPlugin } from '@capacitor/core'
import type { Room, RoomLibrary } from './room-store'
import { buildTvSnapshot, type TvSnapshot } from './tv-snapshot'

type TvSession = { roomId: string; url: string }
type TvServerPlugin = {
  start(options: { roomId: string; snapshot: TvSnapshot }): Promise<TvSession>
  publish(options: { roomId: string; snapshot: TvSnapshot }): Promise<void>
  stop(): Promise<void>
}

const tvServer = registerPlugin<TvServerPlugin>('TvServer')
const listeners = new Set<() => void>()
let session: TvSession | null = null

function setSession(next: TvSession | null) {
  session = next
  listeners.forEach(listener => listener())
}

export function useTvSession() {
  return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener) }, () => session)
}

export function tvSharingAvailable() { return Capacitor.getPlatform() === 'android' }

export async function startTvSharing(room: Room) {
  if (!tvSharingAvailable()) throw new Error('TV sharing is available in the Android app.')
  const next = await tvServer.start({ roomId: room.id, snapshot: buildTvSnapshot(room) })
  setSession(next)
  return next
}

export async function stopTvSharing() {
  await tvServer.stop()
  setSession(null)
}

export async function syncTvSharing(library: RoomLibrary) {
  if (!session) return
  const room = library.rooms.find(item => item.id === session?.roomId)
  if (!room) { await stopTvSharing(); return }
  await tvServer.publish({ roomId: room.id, snapshot: buildTvSnapshot(room) })
}
