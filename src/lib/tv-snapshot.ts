import { bankerPlayerDerived } from '../game/bankerGame'
import type { Room } from './room-store'
import type { PlayerAvatarId } from './player-avatars'

export type TvSnapshot = {
  roomId: string
  roomName: string
  targetScore: number
  round: number
  phase: 'ready' | 'round' | 'results'
  winnerIds: string[]
  players: {
    id: string
    name: string
    color: string
    avatar?: PlayerAvatarId
    total: number
    roundScore: number
    status: string
    isTurn: boolean
    cards: { image: string; label: string; voided: boolean }[]
  }[]
}

export function buildTvSnapshot(room: Room): TvSnapshot {
  const state = room.state
  return {
    roomId: room.id,
    roomName: room.name,
    targetScore: room.targetScore,
    round: state?.roundNumber ?? 1,
    phase: state?.phase === 'results' ? 'results' : state?.phase === 'round' ? 'round' : 'ready',
    winnerIds: state?.winnerIds ?? [],
    players: state ? state.players.map(player => ({
      id: player.id,
      name: player.name,
      color: player.color,
      avatar: player.avatar,
      total: player.totalScore,
      roundScore: bankerPlayerDerived(player).score,
      status: player.round.status,
      isTurn: state.phase === 'round' && player.id === (state.forcedTurns[0]?.targetPlayerId ?? state.turnPlayerId),
      cards: player.round.entries.map(entry => ({ image: entry.card.image ?? '', label: entry.card.label, voided: entry.voided })),
    })) : room.roster.map(player => ({
      id: player.id,
      name: player.name,
      color: player.color,
      avatar: player.avatar,
      total: 0,
      roundScore: 0,
      status: 'ready',
      isTurn: false,
      cards: [],
    })),
  }
}
