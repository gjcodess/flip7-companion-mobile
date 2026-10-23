import { allBankerPlayersSettled, bankerPlayerDerived } from '../../game/bankerGame'
import type { Room } from '../../lib/room-store'
import { vengeanceDecisionOwner } from '../../lib/shared-room-protocol'

/** Input rights are independent of which table a participant is inspecting. */
export function joinedRoomView(room: Room, owner: string | undefined, enabled: boolean) {
  const vengeance = room.edition === 'vengeance' ? room.vengeanceState : undefined
  const classic = room.edition !== 'vengeance' ? room.state : undefined
  const state = vengeance ?? classic
  const turn = vengeance ? vengeance.forced[0]?.targetId ?? vengeance.turnPlayerId : classic?.forcedTurns[0]?.targetPlayerId ?? classic?.turnPlayerId
  const decisionOwner = vengeance ? vengeanceDecisionOwner(room) : classic?.pendingAction?.sourcePlayerId
  const complete = state?.phase === 'results'
  const settled = vengeance?.phase === 'settlement' || Boolean(classic && allBankerPlayersSettled(classic))
  const myClassic = classic?.players.find(player => player.id === owner)
  const myVengeance = vengeance?.players.find(player => player.id === owner)
  const mayRecord = Boolean(enabled && owner && turn === owner && !decisionOwner && !complete && !settled)
  const mayBank = Boolean(mayRecord && (vengeance
    ? vengeance.phase === 'turn' && !vengeance.forced.length && myVengeance?.status === 'active' && !myVengeance.entries.some(entry => !entry.voided && entry.card.id === 'v-number-zero') && (vengeance.minimumNumberCardsToStay === undefined || myVengeance.entries.filter(entry => !entry.voided && entry.card.kind === 'number').length >= vengeance.minimumNumberCardsToStay)
    : classic && !classic.forcedTurns.length && myClassic && bankerPlayerDerived(myClassic).canStay && (classic.minimumNumberCardsToStay === undefined || bankerPlayerDerived(myClassic).numberCardCount >= classic.minimumNumberCardsToStay)))
  return { vengeance, classic, state, turn, decisionOwner, complete, settled, mayRecord, mayBank }
}
