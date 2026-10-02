import type { CSSProperties } from 'react'
import type { PlayerAvatarId } from '../lib/player-avatars'
import { playerAvatarSrc } from '../lib/player-avatars'
import './PlayerAvatar.css'

type Appearance = { id?: string; name: string; color: string; avatar?: PlayerAvatarId }

export function PlayerAvatar({ player, className = '' }: { player: Appearance; className?: string }) {
  return <span className={`player-avatar-art ${className}`} style={{ backgroundColor: player.color } as CSSProperties} aria-hidden="true">
    <img src={playerAvatarSrc(player.avatar, player.id)} alt="" />
  </span>
}
