export const playerAvatars = [
  { id: 'neutral-1', label: 'Robot', group: 'Any style' },
  { id: 'neutral-2', label: 'Alien', group: 'Any style' },
  { id: 'neutral-3', label: 'Chameleon', group: 'Any style' },
  { id: 'neutral-4', label: 'Cat', group: 'Any style' },
  { id: 'male-1', label: 'Character 3', group: 'Male' },
  { id: 'male-2', label: 'Character 4', group: 'Male' },
  { id: 'male-3', label: 'Character 5', group: 'Male' },
  { id: 'male-4', label: 'Character 6', group: 'Male' },
  { id: 'female-1', label: 'Character 7', group: 'Female' },
  { id: 'female-2', label: 'Character 8', group: 'Female' },
  { id: 'female-3', label: 'Character 9', group: 'Female' },
  { id: 'female-4', label: 'Character 10', group: 'Female' },
] as const

export type PlayerAvatarId = typeof playerAvatars[number]['id']
export const defaultPlayerAvatar: PlayerAvatarId = 'neutral-1'
const defaultAvatars: PlayerAvatarId[] = ['neutral-1', 'neutral-2', 'neutral-3', 'neutral-4']

export function defaultPlayerAvatarFor(id?: string, index = 0): PlayerAvatarId {
  const number = id ? [...id].reduce((sum, char) => sum + char.charCodeAt(0), 0) : index
  return defaultAvatars[number % defaultAvatars.length]
}

export function isPlayerAvatarId(value: unknown): value is PlayerAvatarId {
  return typeof value === 'string' && playerAvatars.some(avatar => avatar.id === value)
}

export function playerAvatarSrc(id?: PlayerAvatarId, playerId?: string) {
  return `/assets/avatars/${id ?? defaultPlayerAvatarFor(playerId)}.webp`
}
