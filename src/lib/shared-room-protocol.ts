import { bankerEligibleActionTargets, bankerReducer, type BankerAction } from '../game/bankerGame'
import { pickerCards } from '../game/cards'
import { vengeancePending, vengeancePendingKey, vengeanceReducer, type VAction } from '../game/vengeanceGame'
import type { Room } from './room-store'

// Bump whenever commands or game-rule compatibility change, independently of marketing versions.
export const SHARED_PROTOCOL = 1
export type SeatGrant = { secret: string; name: string; requestedSeat: string; playerId?: string; status: 'pending' | 'approved' | 'rejected' }
export type SharedHost = { revision: number; grants: Record<string, SeatGrant>; receipts: string[] }
export type JoinedCopy = { revision: number; playerId: string; localProfileId?: string; syncedAt: number }
export type ParticipantCommand =
  | { type: 'record'; cardId: string }
  | { type: 'bank' }
  | { type: 'classic-target'; playerId: string }
  | { type: 'choose-actor'; playerId: string }
  | { type: 'choose-target'; playerId: string }
  | { type: 'choose-card'; instanceId: string }
  | { type: 'confirm' }
  | { type: 'flip-seven'; choice: 'self' | 'penalize'; playerId?: string }
export type RoomRequest = { protocol: number; deviceId: string; secret: string; type: 'claim' | 'poll' | 'action' | 'leave'; name?: string; playerId?: string; operationId?: string; revision?: number; command?: ParticipantCommand }
export type RoomReply = { ok: boolean; error?: string; status?: SeatGrant['status']; room?: Room; revision?: number; playerId?: string; seats?: { id: string; name: string; occupied: boolean }[]; roomName?: string; roomEdition?: 'classic' | 'vengeance' }

export function emptySharedHost(): SharedHost { return { revision: 0, grants: {}, receipts: [] } }
export function publicRoom(room: Room): Room {
  // Neither invitations nor participant credentials belong in shared history.
  const { sharedHost: _host, joinedCopy: _copy, ...publicData } = room
  return JSON.parse(JSON.stringify(publicData, (key, value) => key === 'past' || key === 'future' ? [] : value)) as Room
}

export function vengeanceDecisionOwner(room: Room): string | undefined {
  const state = room.vengeanceState
  if (!state) return undefined
  if (state.pendingFlipSeven) return state.pendingFlipSeven.finisherId
  const pending = vengeancePending(state)
  if (!pending) return undefined
  // The revealer distributes modifiers/actions. The recipient of Steal chooses its card.
  if (pending.card.id === 'v-action-steal' && pending.actorId) return pending.actorId
  return pending.sourceId
}

/** Reconstruct only explicitly allowed reducer actions; never trust incoming reducer objects. */
export function applyParticipantCommand(room: Room, seat: string, command: ParticipantCommand): Room {
  if (!command || typeof command.type !== 'string') throw new Error('Invalid player action.')
  if (room.edition === 'vengeance') {
    const state = room.vengeanceState
    if (!state || state.phase === 'results') throw new Error('This match is not accepting cards.')
    const turn = state.forced[0]?.targetId ?? state.turnPlayerId
    let action: VAction
    if (command.type === 'record' || command.type === 'bank') {
      if (turn !== seat || state.pending || state.pendingFlipSeven) throw new Error('Wait for your turn or the current action to finish.')
      action = command.type === 'record' ? { type: 'record', cardId: command.cardId } : { type: 'stay' }
    } else {
      if (vengeanceDecisionOwner(room) !== seat) throw new Error('This decision belongs to another player.')
      switch (command.type) {
        case 'choose-actor': action = { type: 'choose-actor', playerId: command.playerId }; break
        case 'choose-target': action = { type: 'choose-target', playerId: command.playerId }; break
        case 'choose-card': action = { type: 'choose-card', instanceId: command.instanceId }; break
        case 'confirm': action = { type: 'confirm' }; break
        case 'flip-seven':
          if (!state.pendingFlipSeven) throw new Error('There is no Flip 7 decision.')
          if (command.choice === 'self') action = { type: 'resolve-flip-seven', choice: 'self' }
          else {
            if (command.choice !== 'penalize' || !state.players.some(p => p.id === command.playerId && p.id !== seat)) throw new Error('Choose another player.')
            action = { type: 'resolve-flip-seven', choice: 'penalize', targetPlayerId: command.playerId! }
          }
          break
        default: throw new Error('Only the host can correct cards or manage the room.')
      }
      action = { ...action, expectedPendingKey: vengeancePendingKey(state) ?? undefined }
    }
    const next = vengeanceReducer(state, action)
    if (next === state) throw new Error('That action is not available. Check the latest table.')
    return { ...room, vengeanceState: next }
  }
  const state = room.state
  if (!state || state.phase !== 'round') throw new Error('This match is not accepting cards.')
  const turn = state.forcedTurns[0]?.targetPlayerId ?? state.turnPlayerId
  let action: BankerAction
  if (command.type === 'classic-target') {
    const pending = state.pendingAction
    if (!pending || pending.sourcePlayerId !== seat) throw new Error('This decision belongs to another player.')
    if (!bankerEligibleActionTargets(state, pending.card).some(p => p.id === command.playerId)) throw new Error('Choose an eligible player.')
    action = { type: 'record-action', sourcePlayerId: seat, targetPlayerId: command.playerId, card: pending.card }
  } else {
    if (turn !== seat || state.pendingAction) throw new Error('Wait for your turn or the current action to finish.')
    if (command.type === 'record') {
      const card = pickerCards.find(card => card.id === command.cardId)
      if (!card) throw new Error('Unknown card.')
      action = card.kind === 'action' ? { type: 'reveal-action', sourcePlayerId: seat, card } : { type: 'record-card', playerId: seat, card }
    } else if (command.type === 'bank') action = { type: 'settle-player', playerId: seat }
    else throw new Error('Only the host can correct cards or manage the room.')
  }
  const next = bankerReducer(state, action)
  if (next === state) throw new Error('That action is not available. Check the latest table.')
  return { ...room, state: next }
}

/** Pure host-side transaction. The caller must persist next before returning reply. */
export function processRoomRequest(room: Room, request: RoomRequest): { next: Room; reply: RoomReply } {
  if (request.protocol !== SHARED_PROTOCOL) throw new Error('App versions are incompatible. Update both apps.')
  if (!/^[a-zA-Z0-9-]{16,80}$/.test(request.deviceId) || !/^[a-zA-Z0-9-]{32,100}$/.test(request.secret)) throw new Error('Invalid device credentials.')
  const shared = room.sharedHost ?? emptySharedHost()
  const grant = shared.grants[request.deviceId]
  if (grant && grant.secret !== request.secret) throw new Error('This seat belongs to another device.')
  let next = room
  if (request.type === 'claim') {
    if (!room.roster.some(player => player.id === request.playerId)) throw new Error('Choose a seat in this room.')
    if (grant?.status === 'approved') throw new Error('Release your current seat before claiming another.')
    if (Object.keys(shared.grants).length >= 64 && !grant) throw new Error('Too many join requests. Ask the host to start a new invitation.')
    const name = request.name?.trim().slice(0, 24)
    if (!name) throw new Error('Enter your name.')
    if (Object.values(shared.grants).some(g => g.status === 'approved' && g.playerId === request.playerId)) throw new Error('That seat is already controlled by another phone.')
    next = { ...room, sharedHost: { ...shared, grants: { ...shared.grants, [request.deviceId]: { secret: request.secret, name, requestedSeat: request.playerId!, status: 'pending' } } } }
  } else if (request.type === 'leave') {
    if (grant) {
      const grants = { ...shared.grants }; delete grants[request.deviceId]
      next = { ...room, sharedHost: { ...shared, grants } }
    }
  } else if (request.type === 'action') {
    if (grant?.status !== 'approved' || !grant.playerId || !room.roster.some(p => p.id === grant.playerId)) throw new Error('The host must approve your seat first.')
    if (!request.operationId || !/^[a-zA-Z0-9-]{16,80}$/.test(request.operationId)) throw new Error('Invalid action identifier.')
    const receipt = `${request.deviceId}:${request.operationId}`
    if (!shared.receipts.includes(receipt)) {
      if (request.revision !== shared.revision) throw new Error('The table changed. Review the latest state before trying again.')
      next = applyParticipantCommand(room, grant.playerId, request.command!)
      next = { ...next, sharedHost: { ...shared, revision: shared.revision + 1, receipts: [...shared.receipts.slice(-255), receipt] } }
    }
  } else if (request.type !== 'poll') throw new Error('Unknown room request.')
  const currentGrant = next.sharedHost?.grants[request.deviceId]
  const reply: RoomReply = { ok: true, roomName: next.name, roomEdition: next.edition ?? 'classic', status: currentGrant?.status, playerId: currentGrant?.playerId,
    seats: next.roster.map(player => ({ id: player.id, name: player.name, occupied: Object.values(next.sharedHost?.grants ?? {}).some(g => g.status === 'approved' && g.playerId === player.id) })) }
  if (currentGrant?.status === 'approved') {
    reply.revision = next.sharedHost?.revision ?? 0
    if (request.type !== 'poll' || request.revision !== reply.revision) reply.room = publicRoom(next)
  }
  return { next, reply }
}

export function decideSeat(room: Room, deviceId: string, approve: boolean): Room {
  const shared = room.sharedHost
  const grant = shared?.grants[deviceId]
  if (!shared || !grant) throw new Error('This join request is no longer available.')
  if (approve && (!room.roster.some(p => p.id === grant.requestedSeat) || Object.entries(shared.grants).some(([id, g]) => id !== deviceId && g.status === 'approved' && g.playerId === grant.requestedSeat))) throw new Error('That seat is no longer available.')
  const next = { ...room, sharedHost: { ...shared, grants: { ...shared.grants, [deviceId]: { ...grant, status: approve ? 'approved' as const : 'rejected' as const, playerId: approve ? grant.requestedSeat : undefined } } } }
  if (!approve) return next
  const rename = <T extends { id: string; name: string }>(player: T): T => player.id === grant.requestedSeat ? { ...player, name: grant.name } : player
  return {
    ...next,
    roster: room.roster.map(rename),
    state: room.state && { ...room.state, players: room.state.players.map(rename), past: room.state.past.map(snapshot => ({ ...snapshot, players: snapshot.players.map(rename) })), future: room.state.future.map(snapshot => ({ ...snapshot, players: snapshot.players.map(rename) })) },
    vengeanceState: room.vengeanceState && { ...room.vengeanceState, players: room.vengeanceState.players.map(rename), past: room.vengeanceState.past.map(snapshot => ({ ...snapshot, players: snapshot.players.map(rename) })), future: room.vengeanceState.future.map(snapshot => ({ ...snapshot, players: snapshot.players.map(rename) })) },
  }
}
