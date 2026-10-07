import type { PlayerAvatarId } from '../lib/player-avatars'
import { vengeanceCard, type VengeanceCard } from './vengeanceCards'

export type VStatus = 'active' | 'stayed' | 'busted' | 'flip-seven'
export type VEntry = { instanceId: string; card: VengeanceCard; voided?: boolean }
export type VPlayer = { id: string; name: string; color: string; avatar?: PlayerAvatarId; totalScore: number; status: VStatus; entries: VEntry[] }
export type VPending = { card: VengeanceCard; sourceId: string; actorId?: string; targetId?: string; selectedCards: string[] }
export type VForced = { kind: 'one' | 'four'; targetId: string; remaining: number; deferred: VPending[] }
export type VHistory = { round: number; scores: Record<string, number>; hands: Record<string, { name: string; color: string; avatar?: PlayerAvatarId; status: VStatus; entries: VEntry[] }>; events: string[] }
export type VSnapshot = Pick<VState, 'phase' | 'dealerId' | 'dealIndex' | 'turnPlayerId' | 'selectedPlayerId' | 'roundFinisherId' | 'players' | 'pending' | 'forced' | 'resolving' | 'events' | 'nextId'>
export type VState = {
  phase: 'deal' | 'turn' | 'settlement' | 'results'
  targetScore: number
  roundNumber: number
  dealerId: string
  dealIndex: number
  turnPlayerId: string | null
  selectedPlayerId: string
  roundFinisherId: string | null
  players: VPlayer[]
  pending: VPending | null
  forced: VForced[]
  resolving: VPending[]
  events: string[]
  nextId: number
  history: VHistory[]
  winnerIds: string[]
  past: VSnapshot[]
  future: VSnapshot[]
}
export type VAction =
  | { type: 'select-player'; playerId: string }
  | { type: 'record'; cardId: string }
  | { type: 'choose-actor'; playerId: string }
  | { type: 'choose-target'; playerId: string }
  | { type: 'choose-card'; instanceId: string }
  | { type: 'confirm' }
  | { type: 'stay' }
  | { type: 'advance-round' }
  | { type: 'undo' }
  | { type: 'redo' }

export function vengeanceInitialState(roster: Pick<VPlayer, 'id' | 'name' | 'color' | 'avatar'>[], targetScore = 200, starterId = roster[0]?.id): VState {
  const first = roster.find(player => player.id === starterId) ?? roster[0]
  return {
    phase: 'deal',
    targetScore,
    roundNumber: 1,
    dealerId: first?.id ?? '',
    dealIndex: 0,
    turnPlayerId: first?.id ?? null,
    selectedPlayerId: first?.id ?? '',
    roundFinisherId: null,
    players: roster.map(player => ({ ...player, totalScore: 0, status: 'active', entries: [] })),
    pending: null,
    forced: [],
    resolving: [],
    events: [],
    nextId: 1,
    history: [],
    winnerIds: [],
    past: [],
    future: []
  }
}

const isNumber = (entry: VEntry) => !entry.voided && entry.card.kind === 'number'
const value = (entry: VEntry) => entry.card.value ?? entry.card.points ?? 0
export function vengeanceScore(player: VPlayer) {
  if (player.status === 'busted') return 0
  const numbers = player.entries.filter(isNumber)
  if (player.entries.some(entry => !entry.voided && entry.card.id === 'v-number-zero') && numbers.length < 7) return 0
  const total = numbers.reduce((sum, entry) => sum + value(entry), 0)
  const halved = player.entries.some(entry => !entry.voided && entry.card.id === 'v-modifier-half') ? Math.floor(total / 2) : total
  const penalties = player.entries.filter(entry => !entry.voided && entry.card.kind === 'modifier').reduce((sum, entry) => sum + (entry.card.points ?? 0), 0)
  return Math.max(0, halved + penalties) + (player.status === 'flip-seven' || numbers.length >= 7 ? 15 : 0)
}

function evaluate(player: VPlayer): VPlayer {
  if (player.status === 'busted') return player
  const numbers = player.entries.filter(isNumber)
  const counts = new Map<number, number>()
  for (const entry of numbers) counts.set(value(entry), (counts.get(value(entry)) ?? 0) + 1)
  const lucky = numbers.some(entry => entry.card.id === 'v-number-lucky-13')
  const busted = [...counts].some(([number, count]) => count > (number === 13 && lucky ? 2 : 1))
  if (busted) return { ...player, status: 'busted' }
  if (numbers.length >= 7) return { ...player, status: 'flip-seven' }
  return player
}

function receive(player: VPlayer, entry: VEntry): VPlayer {
  const entries = entry.card.id === 'v-number-unlucky-7'
    ? player.entries.map(item => item.card.kind !== 'action' ? { ...item, voided: true } : item)
    : player.entries
  return evaluate({ ...player, entries: [...entries, entry] })
}

function snapshot(state: VState): VSnapshot {
  const { phase, dealerId, dealIndex, turnPlayerId, selectedPlayerId, roundFinisherId, players, pending, forced, resolving, events, nextId } = state
  return { phase, dealerId, dealIndex, turnPlayerId, selectedPlayerId, roundFinisherId, players, pending, forced, resolving, events, nextId }
}
function commit(previous: VState, next: VState): VState { return { ...next, past: [...previous.past, snapshot(previous)].slice(-30), future: [] } }
function playerIndex(state: VState, id: string) { return state.players.findIndex(player => player.id === id) }
function nextActive(state: VState, afterId: string) {
  const start = playerIndex(state, afterId)
  for (let step = 1; step <= state.players.length; step++) {
    const player = state.players[(start + step + state.players.length) % state.players.length]
    if (player?.status === 'active') return player.id
  }
  return null
}
function faceUp(state: VState) { return state.players.flatMap(player => player.status === 'busted' ? [] : player.entries.filter(entry => !entry.voided).map(entry => ({ player, entry }))) }
export function vengeanceEligibleActors(state: VState, pending = state.pending): VPlayer[] {
  if (!pending) return []
  const faces = faceUp(state)
  if (pending.card.id === 'v-action-swap' && new Set(faces.map(face => face.player.id)).size < 2) return []
  if (pending.card.id === 'v-action-discard' && faces.length === 0) return []
  return state.players.filter(player => player.status !== 'busted' && (pending.card.id !== 'v-action-steal' || faces.some(face => face.player.id !== player.id)))
}
export function vengeanceEligibleCards(state: VState, pending = state.pending) {
  if (!pending?.actorId) return []
  const faces = faceUp(state)
  if (pending.card.id === 'v-action-steal') return faces.filter(face => face.player.id !== pending.actorId)
  if (pending.card.id === 'v-action-swap') return faces
  return pending.card.id === 'v-action-discard' ? faces : []
}
function addEvent(state: VState, message: string): VState { return { ...state, events: [...state.events, message].slice(-80) } }

function applyNumber(state: VState, targetId: string, card: VengeanceCard): VState {
  let message = `${state.players.find(p => p.id === targetId)?.name} received ${card.label}`
  const players = state.players.map(player => {
    if (player.id !== targetId) return player
    let entries = player.entries
    if (card.id === 'v-number-unlucky-7') {
      entries = entries.map(entry => entry.card.kind !== 'action' ? { ...entry, voided: true } : entry)
      message += '; previous number and modifier cards were discarded'
    }
    return evaluate({ ...player, entries: [...entries, { instanceId: `v-card-${state.nextId}`, card }] })
  })
  return addEvent({ ...state, players, nextId: state.nextId + 1, selectedPlayerId: targetId }, message)
}
function advanceNormal(state: VState): VState {
  if (state.players.some(player => player.status === 'flip-seven') || state.players.every(player => player.status !== 'active')) return { ...state, phase: 'settlement', turnPlayerId: null }
  if (state.phase === 'deal') {
    const startIndex = state.players.findIndex(player => player.id === state.dealerId)
    const actualStart = startIndex >= 0 ? startIndex : 0
    for (let next = state.dealIndex + 1; next < state.players.length; next++) {
      const candidate = state.players[(actualStart + next) % state.players.length]
      if (candidate.status !== 'busted') return { ...state, dealIndex: next, turnPlayerId: candidate.id, selectedPlayerId: candidate.id }
    }
    const first = nextActive(state, state.players[(actualStart + state.players.length - 1) % state.players.length].id)
    return { ...state, phase: first ? 'turn' : 'settlement', turnPlayerId: first, selectedPlayerId: first ?? state.selectedPlayerId }
  }
  const next = nextActive(state, state.turnPlayerId ?? state.dealerId)
  return { ...state, phase: next ? 'turn' : 'settlement', turnPlayerId: next, selectedPlayerId: next ?? state.selectedPlayerId }
}
function normalize(state: VState): VState {
  let next = state
  for (let guard = 0; guard < 50; guard++) {
    if (next.players.some(player => player.status === 'flip-seven')) {
      const finisher = next.players.find(p => p.status === 'flip-seven')?.id ?? next.roundFinisherId
      return { ...next, phase: 'settlement', pending: null, forced: [], resolving: [], turnPlayerId: null, roundFinisherId: finisher }
    }
    if (next.pending) {
      if (vengeanceEligibleActors(next).length > 0) return next
      next = addEvent({ ...next, pending: null }, `${next.pending.card.label} discarded: no valid target`)
      continue
    }
    const force = next.forced[0]
    if (force?.remaining === 0) {
      let players = next.players
      if (force.kind === 'one') players = players.map(player => player.id === force.targetId && player.status === 'active' ? { ...player, status: 'stayed' as const } : player)
      next = { ...next, players, forced: next.forced.slice(1), resolving: [...force.deferred, ...next.resolving] }
      continue
    }
    if (force) return { ...next, selectedPlayerId: force.targetId }
    if (next.resolving.length) {
      next = { ...next, pending: next.resolving[0], resolving: next.resolving.slice(1) }
      continue
    }
    return advanceNormal(next)
  }
  throw new Error('Vengeance action chain exceeded its safe limit.')
}

export function vengeanceReducer(state: VState, action: VAction): VState {
  if (action.type === 'select-player') return state.players.some(player => player.id === action.playerId) ? { ...state, selectedPlayerId: action.playerId } : state
  if (action.type === 'undo') {
    if (state.pending) {
      for (let i = state.past.length - 1; i >= 0; i--) {
        if (!state.past[i].pending) {
          const targetSnapshot = state.past[i]
          return {
            ...state,
            ...targetSnapshot,
            past: state.past.slice(0, i),
            future: [snapshot(state), ...state.future]
          }
        }
      }
    }
    const previous = state.past.at(-1)
    return previous ? { ...state, ...previous, past: state.past.slice(0, -1), future: [snapshot(state), ...state.future] } : state
  }
  if (action.type === 'redo') {
    const next = state.future[0]
    return next ? { ...state, ...next, past: [...state.past, snapshot(state)], future: state.future.slice(1) } : state
  }
  if (action.type === 'advance-round') {
    if (state.phase !== 'settlement') return state
    const scores = Object.fromEntries(state.players.map(player => [player.id, vengeanceScore(player)]))
    const history = [...state.history, { round: state.roundNumber, scores, hands: Object.fromEntries(state.players.map(player => [player.id, { name: player.name, color: player.color, avatar: player.avatar, status: player.status, entries: player.entries }])), events: state.events }]
    const players = state.players.map(player => ({ ...player, totalScore: player.totalScore + scores[player.id] }))
    if (players.some(player => player.totalScore >= state.targetScore)) {
      const top = Math.max(...players.map(player => player.totalScore))
      return { ...state, phase: 'results', players, history, winnerIds: players.filter(player => player.totalScore === top).map(player => player.id), past: [], future: [] }
    }
    const starterId = state.roundFinisherId && players.some(player => player.id === state.roundFinisherId)
      ? state.roundFinisherId
      : players[0]?.id ?? ''
    const first = players.find(p => p.id === starterId) ?? players[0]
    return {
      ...state,
      phase: 'deal',
      roundNumber: state.roundNumber + 1,
      dealerId: first.id,
      dealIndex: 0,
      turnPlayerId: first.id,
      selectedPlayerId: first.id,
      roundFinisherId: null,
      players: players.map(player => ({ ...player, status: 'active', entries: [] })),
      pending: null,
      forced: [],
      resolving: [],
      events: [],
      history,
      past: [],
      future: []
    }
  }
  if (state.phase === 'settlement' || state.phase === 'results') return state
  if (action.type === 'stay') {
    if (state.phase !== 'turn' || state.pending || state.forced.length || !state.turnPlayerId) return state
    const player = state.players.find(item => item.id === state.turnPlayerId)
    if (!player || player.status !== 'active' || player.entries.some(entry => !entry.voided && entry.card.id === 'v-number-zero')) return state
    const numberCount = player.entries.filter(isNumber).length
    if (numberCount < 2) return state
    const players = state.players.map(item => item.id === player.id ? { ...item, status: 'stayed' as const } : item)
    return commit(state, advanceNormal(addEvent({ ...state, players, roundFinisherId: player.id }, `${player.name} stayed; score remains provisional`)))
  }
  if (action.type === 'record') {
    const card = vengeanceCard(action.cardId)
    const force = state.forced[0]
    const targetId = force?.targetId ?? state.turnPlayerId
    const target = state.players.find(player => player.id === targetId)
    if (!card || state.pending || !target || (!force && target.status !== 'active' && !(state.phase === 'deal' && target.status === 'stayed')) || (force && target.status === 'busted')) return state
    let next: VState = { ...state, roundFinisherId: target.id }
    if (card.kind === 'number') next = applyNumber(next, target.id, card)
    else {
      const isTargetedAction = card.id === 'v-action-swap' || card.id === 'v-action-steal' || card.id === 'v-action-discard'
      const pending: VPending = {
        card,
        sourceId: target.id,
        actorId: isTargetedAction ? target.id : undefined,
        selectedCards: []
      }
      if (force?.kind === 'four') next = { ...next, forced: [{ ...force, deferred: [...force.deferred, pending] }, ...next.forced.slice(1)] }
      else next = { ...next, pending }
      next = addEvent(next, `${target.name} revealed ${card.label}${force?.kind === 'four' ? ' (queued)' : ''}`)
    }
    if (force) {
      const ended = next.players.some(player => player.status === 'flip-seven') || next.players.find(player => player.id === force.targetId)?.status === 'busted'
      const updated = next.forced[0]
      next = { ...next, forced: [{ ...updated, remaining: ended ? 0 : Math.max(0, updated.remaining - 1), deferred: ended ? [] : updated.deferred }, ...next.forced.slice(1)] }
      if (ended && updated.deferred.length) next = addEvent(next, `${updated.deferred.length} queued card effect${updated.deferred.length === 1 ? '' : 's'} discarded after the forced flip ended`)
    }
    return commit(state, normalize(next))
  }
  const pending = state.pending
  if (!pending) return state
  if (action.type === 'choose-actor') {
    if (action.playerId === '') return { ...state, pending: { ...pending, actorId: undefined, targetId: undefined, selectedCards: [] } }
    if (!vengeanceEligibleActors(state).some(player => player.id === action.playerId)) return state
    const actor = state.players.find(player => player.id === action.playerId)
    if (!actor || actor.status === 'busted') return state
    if (pending.card.id === 'v-action-just-one-more' || pending.card.id === 'v-action-flip-four') {
      let next: VState = {
        ...state,
        forced: [{
          kind: pending.card.id === 'v-action-flip-four' ? 'four' : 'one',
          targetId: actor.id,
          remaining: pending.card.id === 'v-action-flip-four' ? 4 : 1,
          deferred: []
        }, ...state.forced]
      }
      const message = `${actor.name} must flip ${pending.card.id === 'v-action-flip-four' ? 'up to four cards' : 'one card, then stay'}`
      next = addEvent({ ...next, pending: null, roundFinisherId: actor.id }, message)
      return commit(state, normalize(next))
    }
    return { ...state, pending: { ...pending, actorId: action.playerId, targetId: undefined, selectedCards: [] } }
  }
  if (action.type === 'choose-target') {
    if (pending.card.kind !== 'modifier' || !vengeanceEligibleActors(state).some(player => player.id === action.playerId)) return state
    const target = state.players.find(player => player.id === action.playerId)
    if (!target || target.status === 'busted') return state
    let next: VState = {
      ...state,
      players: state.players.map(player => player.id === target.id
        ? { ...player, entries: [...player.entries, { instanceId: `v-card-${state.nextId}`, card: pending.card }] }
        : player),
      nextId: state.nextId + 1
    }
    const message = `${target.name} received ${pending.card.label}`
    next = addEvent({ ...next, pending: null, roundFinisherId: target.id }, message)
    return commit(state, normalize(next))
  }
  if (action.type === 'choose-card') {
    const faces = faceUp(state)
    const clickedFace = faces.find(f => f.entry.instanceId === action.instanceId)
    if (!clickedFace) return state

    // If card is already selected, deselect it
    if (pending.selectedCards.includes(action.instanceId)) {
      return {
        ...state,
        pending: { ...pending, selectedCards: pending.selectedCards.filter(id => id !== action.instanceId) }
      }
    }

    if (pending.card.id === 'v-action-steal') {
      if (clickedFace.player.id === pending.actorId) return state
      return { ...state, pending: { ...pending, selectedCards: [action.instanceId] } }
    }

    if (pending.card.id === 'v-action-discard') {
      return { ...state, pending: { ...pending, selectedCards: [action.instanceId] } }
    }

    if (pending.card.id === 'v-action-swap') {
      const currentSelected = pending.selectedCards
        .map(id => faces.find(f => f.entry.instanceId === id))
        .filter((face): face is { player: VPlayer; entry: VEntry } => Boolean(face))

      if (currentSelected.length === 0) {
        return { ...state, pending: { ...pending, selectedCards: [action.instanceId] } }
      }
      if (currentSelected.length === 1) {
        if (currentSelected[0].player.id === clickedFace.player.id) {
          // Same player: switch the chosen card for that player
          return { ...state, pending: { ...pending, selectedCards: [action.instanceId] } }
        } else {
          // Different player: select as 2nd card
          return { ...state, pending: { ...pending, selectedCards: [currentSelected[0].entry.instanceId, action.instanceId] } }
        }
      }
      if (currentSelected.length >= 2) {
        // If clicked card belongs to player of slot 0, replace slot 0
        if (currentSelected[0].player.id === clickedFace.player.id) {
          return { ...state, pending: { ...pending, selectedCards: [action.instanceId, currentSelected[1].entry.instanceId] } }
        }
        // If clicked card belongs to player of slot 1, replace slot 1
        if (currentSelected[1].player.id === clickedFace.player.id) {
          return { ...state, pending: { ...pending, selectedCards: [currentSelected[0].entry.instanceId, action.instanceId] } }
        }
        // If clicked card belongs to a 3rd player, replace slot 1
        return { ...state, pending: { ...pending, selectedCards: [currentSelected[0].entry.instanceId, action.instanceId] } }
      }
    }

    return state
  }
  if (action.type !== 'confirm') return state
  const actor = state.players.find(player => player.id === pending.actorId)
  const target = state.players.find(player => player.id === pending.targetId)
  const selected = pending.selectedCards.map(id => faceUp(state).find(face => face.entry.instanceId === id))
  let next: VState = state
  let message = ''
  if (pending.card.kind === 'modifier') {
    if (!target || target.status === 'busted') return state
    next = { ...next, players: next.players.map(player => player.id === target.id ? { ...player, entries: [...player.entries, { instanceId: `v-card-${next.nextId}`, card: pending.card }] } : player), nextId: next.nextId + 1 }
    message = `${target.name} received ${pending.card.label}`
  } else if (pending.card.id === 'v-action-just-one-more' || pending.card.id === 'v-action-flip-four') {
    if (!actor || actor.status === 'busted') return state
    next = { ...next, forced: [{ kind: pending.card.id === 'v-action-flip-four' ? 'four' : 'one', targetId: actor.id, remaining: pending.card.id === 'v-action-flip-four' ? 4 : 1, deferred: [] }, ...next.forced] }
    message = `${actor.name} must flip ${pending.card.id === 'v-action-flip-four' ? 'up to four cards' : 'one card, then stay'}`
  } else if (pending.card.id === 'v-action-steal') {
    const face = selected[0]
    if (!actor || !face || face.player.id === actor.id) return state
    next = { ...next, players: next.players.map(player => player.id === face.player.id ? evaluate({ ...player, entries: player.entries.filter(entry => entry.instanceId !== face.entry.instanceId) }) : player.id === actor.id ? receive(player, face.entry) : player) }
    message = `${actor.name} stole ${face.entry.card.label} from ${face.player.name}`
  } else if (pending.card.id === 'v-action-discard') {
    const face = selected[0]
    if (!actor || !face) return state
    next = { ...next, players: next.players.map(player => player.id === face.player.id ? evaluate({ ...player, entries: player.entries.filter(entry => entry.instanceId !== face.entry.instanceId) }) : player) }
    message = `${actor.name} discarded ${face.entry.card.label} from ${face.player.name}`
  } else if (pending.card.id === 'v-action-swap') {
    const [first, second] = selected
    if (!actor || !first || !second || first.player.id === second.player.id) return state
    next = { ...next, players: next.players.map(player => player.id === first.player.id ? receive({ ...player, entries: player.entries.filter(entry => entry.instanceId !== first.entry.instanceId) }, second.entry) : player.id === second.player.id ? receive({ ...player, entries: player.entries.filter(entry => entry.instanceId !== second.entry.instanceId) }, first.entry) : player) }
    message = `${actor.name} swapped ${first.entry.card.label} (${first.player.name}) with ${second.entry.card.label} (${second.player.name})`
  } else return state
  next = addEvent({ ...next, pending: null, roundFinisherId: actor?.id ?? target?.id ?? state.roundFinisherId }, message)
  return commit(state, normalize(next))
}
