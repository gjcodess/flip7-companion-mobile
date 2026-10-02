import { useSyncExternalStore } from 'react'
import { bankerPlayerColors } from '../game/bankerGame'
import { defaultPlayerAvatarFor, isPlayerAvatarId } from './player-avatars'
import type { PlayerProfile } from './room-store'
import { newLocalId } from './local-id'

const KEY = 'flip7.my-profile.v1'
const listeners = new Set<() => void>()
let cached: PlayerProfile | undefined

export function getMyProfile(): PlayerProfile {
  if (cached) return cached
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const value = JSON.parse(raw) as PlayerProfile
      if (typeof value.id === 'string' && typeof value.name === 'string' && value.name.length <= 24 && /^#[0-9a-f]{6}$/i.test(value.color) && isPlayerAvatarId(value.avatar)) {
        cached = value
        return value
      }
    }
  } catch { /* The profile can be recreated without changing saved rooms. */ }
  cached = { id: newLocalId(), name: '', color: bankerPlayerColors[0], avatar: defaultPlayerAvatarFor(undefined) }
  return cached
}

export function saveMyProfile(profile: PlayerProfile) {
  const next = { ...profile, id: getMyProfile().id, name: profile.name.trim() }
  if (!next.name || next.name.length > 24 || !/^#[0-9a-f]{6}$/i.test(next.color) || !isPlayerAvatarId(next.avatar)) throw new Error('Choose a name, character, and color.')
  localStorage.setItem(KEY, JSON.stringify(next))
  cached = next
  listeners.forEach(listener => listener())
}

export function useMyProfile() { return useSyncExternalStore(listener => { listeners.add(listener); return () => listeners.delete(listener) }, getMyProfile) }
