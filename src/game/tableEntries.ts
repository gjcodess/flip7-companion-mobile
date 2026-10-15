import type { BankerState } from './bankerGame'
import type { DemoEntry } from './demoGame'
import type { VEntry, VState } from './vengeanceGame'

export type CardResolution = 'queued' | 'resolving'
export type VTableEntry = VEntry & { resolution?: CardResolution }
export type ClassicTableEntry = DemoEntry & { resolution?: CardResolution }

// Presentation only: previews never enter a hand's score or legal card targets.
export function vengeanceTableEntries(state: VState, playerId: string): VTableEntry[] {
  const effects = [
    ...(state.pending ? [{ pending: state.pending, resolution: 'resolving' as const }] : []),
    ...state.forced.flatMap(force => force.deferred.map(pending => ({ pending, resolution: 'queued' as const }))),
    ...state.resolving.map(pending => ({ pending, resolution: 'queued' as const })),
  ].filter(effect => effect.pending.sourceId === playerId)
  return [
    ...(state.players.find(player => player.id === playerId)?.entries ?? []),
    ...effects.map(({ pending, resolution }, i) => ({
      instanceId: `preview-v-${playerId}-${i}-${pending.card.id}`, card: pending.card, resolution,
    })),
  ]
}

export function bankerTableEntries(state: BankerState, playerId: string): ClassicTableEntry[] {
  const effects = [
    ...(state.pendingAction ? [{ pending: state.pendingAction, resolution: 'resolving' as const }] : []),
    ...state.forcedTurns.flatMap(force => (force.deferred ?? []).map(pending => ({ pending, resolution: 'queued' as const }))),
  ].filter(effect => effect.pending.sourcePlayerId === playerId)
  return [
    ...(state.players.find(player => player.id === playerId)?.round.entries ?? []),
    ...effects.map(({ pending, resolution }, i) => ({
      instanceId: `preview-c-${playerId}-${i}-${pending.card.id}`, card: pending.card, voided: false, resolution,
    })),
  ]
}
