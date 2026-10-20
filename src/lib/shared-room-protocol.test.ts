import { describe, expect, it } from 'vitest'
import { bankerReducer, bankerInitialState } from '../game/bankerGame'
import { vengeanceInitialState, vengeanceReducer } from '../game/vengeanceGame'
import { pickerCards } from '../game/cards'
import type { Room } from './room-store'
import { applyParticipantCommand, decideSeat, emptySharedHost, processRoomRequest, publicRoom, reconcileApprovedSeatNames, SHARED_PROTOCOL, vengeanceDecisionOwner, type RoomRequest } from './shared-room-protocol'

const deviceId = '12345678-1234-1234-1234-123456789abc', secret = 'abcdefab-1234-1234-1234-123456789abcdefab-1234'
const secondDevice = '22345678-1234-1234-1234-123456789abc'
function fixture(vengeance = false): Room {
  const state = bankerReducer(bankerInitialState(), { type: 'start', targetScore: 200, names: ['Ana', 'Ben', 'Cy'] })
  const roster = state.players.map(({ id, name, color }) => ({ id, name, color }))
  return { id: 'room-1234', name: 'Friday', createdAt: 1, updatedAt: 1, pinned: false, targetScore: 200, roster, state: vengeance ? null : state, edition: vengeance ? 'vengeance' : 'classic', vengeanceState: vengeance ? vengeanceInitialState(roster, 200, roster[0].id) : null, sharedHost: emptySharedHost() }
}
function request(type: RoomRequest['type'], extra: Partial<RoomRequest> = {}): RoomRequest { return { protocol: SHARED_PROTOCOL, deviceId, secret, type, ...extra } }
function approved(room = fixture(), seat = room.roster[0].id) {
  const claimed = processRoomRequest(room, request('claim', { name: 'Ana phone', playerId: seat })).next
  return decideSeat(claimed, deviceId, true)
}
function record(room: Room, cardId = 'number-7', operationId = crypto.randomUUID()) {
  return processRoomRequest(room, request('action', { revision: room.sharedHost!.revision, operationId, command: { type: 'record', cardId } }))
}

describe('shared room seat authorization', () => {
  it('reveals no hands or credentials until the host approves a seat', () => {
    const room = fixture()
    const visitor = processRoomRequest(room, request('poll')).reply
    expect(visitor.room).toBeUndefined()
    expect(visitor.seats).toHaveLength(3)
    const pending = processRoomRequest(room, request('claim', { name: 'Ana phone', playerId: room.roster[0].id }))
    expect(pending.reply.status).toBe('pending')
    expect(pending.reply.room).toBeUndefined()
    const allowed = processRoomRequest(decideSeat(pending.next, deviceId, true), request('poll')).reply
    expect(allowed.room?.state?.players).toHaveLength(3)
    expect(allowed.room?.sharedHost).toBeUndefined()
    expect(JSON.stringify(allowed)).not.toContain(secret)
  })
  it('rejects an action before approval and rejects impersonation', () => {
    expect(() => record(fixture())).toThrow('approve')
    expect(() => processRoomRequest(approved(), request('poll', { secret: 'f'.repeat(64) }))).toThrow('another device')
  })
  it('enforces one controller even when two pending requests target the same seat', () => {
    let room = fixture()
    for (const device of [deviceId, secondDevice]) room = processRoomRequest(room, request('claim', { deviceId: device, name: 'Phone', playerId: room.roster[0].id })).next
    room = decideSeat(room, deviceId, true)
    expect(() => decideSeat(room, secondDevice, true)).toThrow('no longer available')
  })
  it('reconnects without new approval and revokes a released controller', () => {
    const room = approved()
    expect(processRoomRequest(room, request('poll')).reply.status).toBe('approved')
    const released = decideSeat(room, deviceId, false)
    expect(() => record(released)).toThrow('approve')
    expect(processRoomRequest(released, request('poll')).reply.room).toBeUndefined()
  })
  it.each([false, true])('uses the approved joiner name at the claimed table (vengeance: %s)', vengeance => {
    let room = fixture(vengeance)
    const seat = room.roster[1].id
    const claim = processRoomRequest(room, request('claim', { name: 'Wang', playerId: seat }))
    room = decideSeat(claim.next, deviceId, true)
    expect(room.roster[1].name).toBe('Wang')
    expect((vengeance ? room.vengeanceState : room.state)?.players[1].name).toBe('Wang')
    expect((vengeance ? room.vengeanceState : room.state)?.past.every(snapshot => snapshot.players[1].name === 'Wang')).toBe(true)
    expect(processRoomRequest(room, request('poll')).reply.room?.roster[1].name).toBe('Wang')
  })
  it('repairs names from seats approved before the table-name fix', () => {
    const room = fixture()
    const seat = room.roster[1].id
    room.sharedHost!.grants[deviceId] = { secret, name: 'Wang', requestedSeat: seat, playerId: seat, status: 'approved' }
    const repaired = reconcileApprovedSeatNames(room)
    expect(repaired.roster[1].name).toBe('Wang')
    expect(repaired.state!.players[1].name).toBe('Wang')
    expect(reconcileApprovedSeatNames(repaired)).toBe(repaired)
  })
  it('leaving releases control without removing any player or card', () => {
    const room = record(approved()).next
    const result = processRoomRequest(room, request('leave'))
    expect(result.next.roster).toEqual(room.roster)
    expect(result.next.state).toBe(room.state)
    expect(result.reply.status).toBeUndefined()
  })
  it('rejects incompatible protocol versions and malformed credentials', () => {
    expect(() => processRoomRequest(fixture(), request('poll', { protocol: 999 }))).toThrow('incompatible')
    expect(() => processRoomRequest(fixture(), request('poll', { deviceId: '__proto__' }))).toThrow('credentials')
  })
})

describe('host command ordering and rules', () => {
  it('records an accepted action once even after a lost reply and subsequent moves', () => {
    const room = approved(), operationId = crypto.randomUUID()
    const first = record(room, 'number-7', operationId).next
    const second = { ...first, state: bankerReducer(first.state!, { type: 'record-card', playerId: first.roster[1].id, card: pickerCards.find(c => c.id === 'number-8')! }), sharedHost: { ...first.sharedHost!, revision: 2 } }
    const retry = processRoomRequest(second, request('action', { operationId, revision: 0, command: { type: 'record', cardId: 'number-7' } }))
    expect(retry.next).toBe(second)
    expect(retry.reply.revision).toBe(2)
    expect(retry.next.state!.players[0].round.entries).toHaveLength(1)
  })
  it('rejects another phone trying to record out of turn', () => {
    const room = fixture()
    expect(() => record(approved(room, room.roster[1].id))).toThrow('Wait')
  })
  it('rejects stale submissions after the host changes the table', () => {
    const room = record(approved()).next
    expect(() => processRoomRequest(room, request('action', { revision: 0, operationId: crypto.randomUUID(), command: { type: 'record', cardId: 'number-8' } }))).toThrow('table changed')
  })
  it('never accepts host correction or round-management commands from a participant', () => {
    const room = approved()
    for (const type of ['undo', 'redo', 'advance-round', 'restart', 'player', 'select-player', 'replace-card']) {
      expect(() => applyParticipantCommand(room, room.roster[0].id, { type } as never)).toThrow()
    }
  })
  it('uses canonical cards and the actual game rules', () => {
    const room = approved()
    expect(() => record(room, 'fake-card')).toThrow('Unknown card')
    expect(() => applyParticipantCommand(room, room.roster[0].id, { type: 'bank' })).toThrow('not available')
    const result = record(room).next
    expect(result.state!.players[0].round.entries[0].card).toBe(pickerCards.find(card => card.id === 'number-7'))
  })
  it('routes Classic target choices to the revealer and forced draws to the recipient', () => {
    let room = approved()
    room = record(room, 'action-flip-three').next
    const [ana, ben] = room.roster
    expect(() => applyParticipantCommand(room, ben.id, { type: 'classic-target', playerId: ben.id })).toThrow('another player')
    room = applyParticipantCommand(room, ana.id, { type: 'classic-target', playerId: ben.id })
    expect(room.state!.forcedTurns[0].targetPlayerId).toBe(ben.id)
    expect(() => applyParticipantCommand(room, ana.id, { type: 'record', cardId: 'number-7' })).toThrow('Wait')
    room = applyParticipantCommand(room, ben.id, { type: 'record', cardId: 'number-7' })
    expect(room.state!.players[1].round.entries.some(entry => entry.card.id === 'number-7')).toBe(true)
    expect(room.state!.forcedTurns[0].remaining).toBe(2)
  })
  it('strips all undo snapshots from shared history without mutating the host', () => {
    const room = record(approved()).next
    expect(room.state!.past.length).toBeGreaterThan(0)
    expect(publicRoom(room).state!.past).toEqual([])
    expect(room.state!.past.length).toBeGreaterThan(0)
  })
})

describe('Vengeance participant permissions', () => {
  it('routes Flip Four decisions and records to the proper seats', () => {
    let room = approved(fixture(true))
    const [ana, ben] = room.roster
    room = applyParticipantCommand(room, ana.id, { type: 'record', cardId: 'v-action-flip-four' })
    expect(vengeanceDecisionOwner(room)).toBe(ana.id)
    expect(() => applyParticipantCommand(room, ben.id, { type: 'choose-actor', playerId: ben.id })).toThrow('another player')
    room = applyParticipantCommand(room, ana.id, { type: 'choose-actor', playerId: ben.id })
    expect(room.vengeanceState!.forced[0].targetId).toBe(ben.id)
    room = applyParticipantCommand(room, ben.id, { type: 'record', cardId: 'v-number-5' })
    expect(room.vengeanceState!.forced[0].remaining).toBe(3)
  })
  it('permits only the Brutal finisher to choose a Flip 7 penalty', () => {
    const room = fixture(true), [ana, ben] = room.roster
    room.vengeanceState = { ...room.vengeanceState!, variant: 'brutal', phase: 'settlement', pendingFlipSeven: { finisherId: ana.id } }
    expect(() => applyParticipantCommand(room, ben.id, { type: 'flip-seven', choice: 'self' })).toThrow('another player')
    expect(() => applyParticipantCommand(room, ana.id, { type: 'flip-seven', choice: 'penalize', playerId: ana.id })).toThrow('another player')
    const next = applyParticipantCommand(room, ana.id, { type: 'flip-seven', choice: 'penalize', playerId: ben.id })
    expect(next.vengeanceState!.flipSevenChoice?.targetId).toBe(ben.id)
  })
  it('does not allow a player to alter another table through reducer payload injection', () => {
    const room = fixture(true), [ana, ben] = room.roster
    for (const type of ['remove-card', 'replace-card', 'cancel-pending', 'undo', 'advance-round']) expect(() => applyParticipantCommand(room, ana.id, { type, playerId: ben.id } as never)).toThrow()
    const withHostRecord = { ...room, vengeanceState: vengeanceReducer(room.vengeanceState!, { type: 'record', cardId: 'v-number-5' }) }
    expect(() => applyParticipantCommand(withHostRecord, ana.id, { type: 'bank' })).toThrow('Wait')
  })
})
