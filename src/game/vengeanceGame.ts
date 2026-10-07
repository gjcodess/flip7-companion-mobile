import type { PlayerAvatarId } from '../lib/player-avatars'
import { vengeanceCard, type VengeanceCard } from './vengeanceCards'

export type VVariant = 'standard' | 'brutal'
export type VFlipSevenChoice = { finisherId: string; choice: 'self' | 'penalize'; targetId?: string }
export type VStatus = 'active' | 'stayed' | 'busted' | 'frozen' | 'flip-seven'
export type VEntry = { instanceId: string; card: VengeanceCard; voided?: boolean }
export type VPlayer = { id: string; name: string; color: string; avatar?: PlayerAvatarId; totalScore: number; status: VStatus; entries: VEntry[] }
export type VPending = { card: VengeanceCard; sourceId: string; actorId?: string; targetId?: string; selectedCards: string[] }
export type VForced = { kind: 'one' | 'four'; targetId: string; remaining: number; deferred: VPending[]; actionInstanceId?: string }
export type VHistory = { round: number; scores: Record<string, number>; hands: Record<string, { name: string; color: string; avatar?: PlayerAvatarId; status: VStatus; entries: VEntry[] }>; events: string[]; variant?: VVariant; flipSevenChoice?: VFlipSevenChoice }
export type VSnapshot = Pick<VState, 'phase' | 'dealerId' | 'dealIndex' | 'turnPlayerId' | 'selectedPlayerId' | 'roundFinisherId' | 'players' | 'pending' | 'pendingFlipSeven' | 'flipSevenChoice' | 'forced' | 'resolving' | 'events' | 'nextId' | 'variant'>
export type VState = {
  phase: 'deal' | 'turn' | 'settlement' | 'results'
  targetScore: number
  variant: VVariant
  roundNumber: number
  dealerId: string
  dealIndex: number
  turnPlayerId: string | null
  selectedPlayerId: string
  roundFinisherId: string | null
  players: VPlayer[]
  pending: VPending | null
  pendingFlipSeven: { finisherId: string } | null
  flipSevenChoice: VFlipSevenChoice | null
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
  | { type: 'cancel-pending' }
  | { type: 'remove-card'; playerId: string; instanceId: string }
  | { type: 'replace-card'; playerId: string; instanceId: string; cardId: string }
  | { type: 'resolve-flip-seven'; choice: 'self' }
  | { type: 'resolve-flip-seven'; choice: 'penalize'; targetPlayerId: string }

export function vengeanceInitialState(roster: Pick<VPlayer, 'id' | 'name' | 'color' | 'avatar'>[], targetScore = 200, starterId = roster[0]?.id, variant: VVariant = 'standard'): VState {
  const first = roster.find(player => player.id === starterId) ?? roster[0]
  return {
    phase: 'deal',
    targetScore,
    variant,
    roundNumber: 1,
    dealerId: first?.id ?? '',
    dealIndex: 0,
    turnPlayerId: first?.id ?? null,
    selectedPlayerId: first?.id ?? '',
    roundFinisherId: null,
    players: roster.map(player => ({ ...player, totalScore: 0, status: 'active', entries: [] })),
    pending: null,
    pendingFlipSeven: null,
    flipSevenChoice: null,
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
export function vengeanceScore(
  player: VPlayer,
  variant: VVariant = 'standard',
  flipSevenChoice?: VFlipSevenChoice | null
): number {
  const isBrutal = variant === 'brutal'
  const penalties = player.entries
    .filter(entry => !entry.voided && entry.card.kind === 'modifier')
    .reduce((sum, entry) => sum + (entry.card.points ?? 0), 0)

  let flipDelta = 0
  if (flipSevenChoice) {
    if (flipSevenChoice.choice === 'self' && player.id === flipSevenChoice.finisherId) {
      flipDelta = 15
    } else if (flipSevenChoice.choice === 'penalize' && player.id === flipSevenChoice.targetId) {
      flipDelta = -15
    }
  } else if (player.status === 'flip-seven') {
    if (!isBrutal) flipDelta = 15
  }

  if (player.status === 'busted') {
    return isBrutal ? penalties + flipDelta : 0
  }

  const numbers = player.entries.filter(isNumber)
  if (player.entries.some(entry => !entry.voided && entry.card.id === 'v-number-zero') && numbers.length < 7) {
    return isBrutal ? penalties + flipDelta : 0
  }

  const total = numbers.reduce((sum, entry) => sum + value(entry), 0)
  const halved = player.entries.some(entry => !entry.voided && entry.card.id === 'v-modifier-half') ? Math.floor(total / 2) : total
  const base = isBrutal ? (halved + penalties) : Math.max(0, halved + penalties)
  return base + flipDelta
}

function evaluate(player: VPlayer): VPlayer {
  const numbers = player.entries.filter(isNumber)
  const counts = new Map<number, number>()
  for (const entry of numbers) counts.set(value(entry), (counts.get(value(entry)) ?? 0) + 1)
  const lucky = numbers.some(entry => entry.card.id === 'v-number-lucky-13')
  const busted = [...counts].some(([number, count]) => count > (number === 13 && lucky ? 2 : 1))
  if (busted) return { ...player, status: 'busted' }
  if (numbers.length >= 7) return { ...player, status: 'flip-seven' }
  if (player.status === 'busted' || player.status === 'flip-seven') {
    return { ...player, status: 'active' }
  }
  return player
}

function receive(player: VPlayer, entry: VEntry): VPlayer {
  const entries = entry.card.id === 'v-number-unlucky-7'
    ? player.entries.map(item => item.card.kind !== 'action' ? { ...item, voided: true } : item)
    : player.entries
  return evaluate({ ...player, entries: [...entries, entry] })
}

function snapshot(state: VState): VSnapshot {
  const { phase, dealerId, dealIndex, turnPlayerId, selectedPlayerId, roundFinisherId, players, pending, pendingFlipSeven, flipSevenChoice, forced, resolving, events, nextId, variant } = state
  return { phase, dealerId, dealIndex, turnPlayerId, selectedPlayerId, roundFinisherId, players, pending, pendingFlipSeven, flipSevenChoice, forced, resolving, events, nextId, variant }
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
function faceUp(state: VState) { return state.players.flatMap(player => player.status !== 'active' ? [] : player.entries.filter(entry => !entry.voided && entry.card.kind !== 'action').map(entry => ({ player, entry }))) }
export function vengeanceEligibleActors(state: VState, pending = state.pending): VPlayer[] {
  if (!pending) return []
  if (pending.card.kind === 'modifier') {
    if (state.variant === 'brutal') {
      return state.players
    }
    return state.players.filter(player => player.status === 'active')
  }
  const faces = faceUp(state)
  if (pending.card.id === 'v-action-swap' && new Set(faces.map(face => face.player.id)).size < 2) return []
  if (pending.card.id === 'v-action-discard' && faces.length === 0) return []
  return state.players.filter(player => player.status === 'active' && (pending.card.id !== 'v-action-steal' || faces.some(face => face.player.id !== player.id)))
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
      if (candidate.status === 'active') return { ...state, dealIndex: next, turnPlayerId: candidate.id, selectedPlayerId: candidate.id }
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
      const players = next.players.map(player => {
        const matchingForce = next.forced.find(f => f.targetId === player.id)
        if (!matchingForce) return player
        return {
          ...player,
          entries: player.entries.map(entry =>
            (entry.instanceId === matchingForce.actionInstanceId || (!entry.voided && entry.card.id === (matchingForce.kind === 'one' ? 'v-action-just-one-more' : 'v-action-flip-four')))
              ? { ...entry, voided: true }
              : entry
          )
        }
      })
      const pendingFlipSeven = next.variant === 'brutal' && !next.flipSevenChoice && finisher
        ? { finisherId: finisher }
        : null
      return { ...next, players, phase: 'settlement', pending: null, pendingFlipSeven, forced: [], resolving: [], turnPlayerId: null, roundFinisherId: finisher }
    }
    if (!next.players.some(player => player.status === 'flip-seven')) {
      if (next.pendingFlipSeven || next.flipSevenChoice) {
        next = { ...next, pendingFlipSeven: null, flipSevenChoice: null }
      }
    }
    if (next.pending) {
      const stealHasNothing = next.pending.card.id === 'v-action-steal' && !!next.pending.actorId && vengeanceEligibleCards(next).length === 0
      if (vengeanceEligibleActors(next).length > 0 && !stealHasNothing) return next
      const pendingCard = next.pending.card
      const sourceId = next.pending.sourceId
      const actionCardEntry: VEntry = { instanceId: `v-card-${next.nextId}`, card: pendingCard, voided: true }
      const players = next.players.map(player =>
        player.id === sourceId
          ? { ...player, entries: [...player.entries, actionCardEntry] }
          : player
      )
      next = addEvent(
        { ...next, players, nextId: next.nextId + 1, pending: null },
        `${pendingCard.label} discarded: no valid target`
      )
      continue
    }
    const force = next.forced[0]
    if (force?.remaining === 0) {
      const players = next.players.map(player => {
        if (player.id !== force.targetId) return player
        const entries = player.entries.map(entry =>
          (entry.instanceId === force.actionInstanceId || (!entry.voided && entry.card.id === (force.kind === 'one' ? 'v-action-just-one-more' : 'v-action-flip-four')))
            ? { ...entry, voided: true }
            : entry
        )
        const status = force.kind === 'one' && player.status === 'active' ? ('frozen' as const) : player.status
        return { ...player, status, entries }
      })
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
  if (action.type === 'cancel-pending') {
    if (!state.pending) return state
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
    return { ...state, pending: null }
  }
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
      return { ...state, pending: null }
    }
    const previous = state.past.at(-1)
    return previous ? { ...state, ...previous, past: state.past.slice(0, -1), future: [snapshot(state), ...state.future] } : state
  }
  if (action.type === 'redo') {
    const next = state.future[0]
    return next ? { ...state, ...next, past: [...state.past, snapshot(state)], future: state.future.slice(1) } : state
  }
  if (action.type === 'resolve-flip-seven') {
    if (!state.pendingFlipSeven) return state
    const finisher = state.players.find(p => p.id === state.pendingFlipSeven?.finisherId)
    if (!finisher) return state
    let message = ''
    let choice: VFlipSevenChoice
    if (action.choice === 'self') {
      choice = { finisherId: finisher.id, choice: 'self' }
      message = `${finisher.name} claimed the +15 pt Flip 7 bonus`
    } else {
      const target = state.players.find(p => p.id === action.targetPlayerId)
      if (!target) return state
      choice = { finisherId: finisher.id, choice: 'penalize', targetId: target.id }
      message = `${finisher.name} reached Flip 7 and inflicted -15 pts on ${target.name}!`
    }
    const next: VState = {
      ...state,
      pendingFlipSeven: null,
      flipSevenChoice: choice
    }
    return commit(state, addEvent(next, message))
  }
  if (action.type === 'advance-round') {
    if (state.phase !== 'settlement') return state
    if (state.pendingFlipSeven) return state
    const scores = Object.fromEntries(state.players.map(player => [player.id, vengeanceScore(player, state.variant, state.flipSevenChoice)]))
    const history = [...state.history, { round: state.roundNumber, scores, hands: Object.fromEntries(state.players.map(player => [player.id, { name: player.name, color: player.color, avatar: player.avatar, status: player.status, entries: player.entries }])), events: state.events, variant: state.variant, flipSevenChoice: state.flipSevenChoice ?? undefined }]
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
      pendingFlipSeven: null,
      flipSevenChoice: null,
      forced: [],
      resolving: [],
      events: [],
      history,
      past: [],
      future: []
    }
  }
  if (action.type === 'remove-card') {
    const player = state.players.find(p => p.id === action.playerId)
    if (!player) return state
    const entryToRemove = player.entries.find(e => e.instanceId === action.instanceId)
    if (!entryToRemove) return state
    const nextEntries = player.entries.filter(e => e.instanceId !== action.instanceId)
    const baseStatus = player.status === 'busted' || player.status === 'flip-seven' ? 'active' : player.status
    const updatedPlayer = evaluate({ ...player, entries: nextEntries, status: baseStatus })
    const players = state.players.map(p => p.id === action.playerId ? updatedPlayer : p)
    const message = `${player.name} removed ${entryToRemove.card.label}`
    return commit(state, addEvent({ ...state, players }, message))
  }
  if (action.type === 'replace-card') {
    const player = state.players.find(p => p.id === action.playerId)
    const newCard = vengeanceCard(action.cardId)
    if (!player || !newCard) return state
    const entryToReplace = player.entries.find(e => e.instanceId === action.instanceId)
    if (!entryToReplace) return state
    let nextEntries = player.entries.map(e => e.instanceId === action.instanceId ? { ...e, card: newCard } : e)
    if (newCard.id === 'v-number-unlucky-7') {
      nextEntries = nextEntries.map(entry => entry.instanceId === action.instanceId ? entry : (entry.card.kind !== 'action' ? { ...entry, voided: true } : entry))
    }
    const baseStatus = player.status === 'busted' || player.status === 'flip-seven' ? 'active' : player.status
    const updatedPlayer = evaluate({ ...player, entries: nextEntries, status: baseStatus })
    const players = state.players.map(p => p.id === action.playerId ? updatedPlayer : p)
    const message = `${player.name} edited card to ${newCard.label}`
    return commit(state, addEvent({ ...state, players }, message))
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
    if (!actor || actor.status !== 'active') return state
    if (pending.card.id === 'v-action-just-one-more' || pending.card.id === 'v-action-flip-four') {
      const actionInstanceId = `v-card-${state.nextId}`
      let next: VState = {
        ...state,
        players: state.players.map(player => player.id === actor.id
          ? { ...player, entries: [...player.entries, { instanceId: actionInstanceId, card: pending.card, voided: false }] }
          : player),
        nextId: state.nextId + 1,
        forced: [{
          kind: pending.card.id === 'v-action-flip-four' ? 'four' : 'one',
          targetId: actor.id,
          remaining: pending.card.id === 'v-action-flip-four' ? 4 : 1,
          deferred: [],
          actionInstanceId
        }, ...state.forced]
      }
      const message = `${actor.name} received ${pending.card.label} and must flip ${pending.card.id === 'v-action-flip-four' ? 'up to four cards' : 'one card, then freeze'}`
      next = addEvent({ ...next, pending: null, roundFinisherId: actor.id }, message)
      return commit(state, normalize(next))
    }
    return { ...state, pending: { ...pending, actorId: action.playerId, targetId: undefined, selectedCards: [] } }
  }
  if (action.type === 'choose-target') {
    if (pending.card.kind !== 'modifier' || !vengeanceEligibleActors(state).some(player => player.id === action.playerId)) return state
    const target = state.players.find(player => player.id === action.playerId)
    if (!target) return state
    if (state.variant !== 'brutal' && target.status !== 'active') return state

    if (state.variant === 'brutal' && target.status === 'busted' && pending.card.id === 'v-modifier-half') {
      const actionCardEntry: VEntry = { instanceId: `v-card-${state.nextId}`, card: pending.card, voided: true }
      let next: VState = {
        ...state,
        players: state.players.map(player => player.id === target.id
          ? { ...player, entries: [...player.entries, actionCardEntry] }
          : player),
        nextId: state.nextId + 1
      }
      const message = `${target.name} received ÷2 while busted; it had no effect and was discarded`
      next = addEvent({ ...next, pending: null, roundFinisherId: target.id }, message)
      return commit(state, normalize(next))
    }

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
    if (!target || target.status !== 'active') return state
    next = { ...next, players: next.players.map(player => player.id === target.id ? { ...player, entries: [...player.entries, { instanceId: `v-card-${next.nextId}`, card: pending.card }] } : player), nextId: next.nextId + 1 }
    message = `${target.name} received ${pending.card.label}`
  } else if (pending.card.id === 'v-action-just-one-more' || pending.card.id === 'v-action-flip-four') {
    if (!actor || actor.status !== 'active') return state
    const actionInstanceId = `v-card-${next.nextId}`
    next = {
      ...next,
      players: next.players.map(player => player.id === actor.id
        ? { ...player, entries: [...player.entries, { instanceId: actionInstanceId, card: pending.card, voided: false }] }
        : player),
      nextId: next.nextId + 1,
      forced: [{
        kind: pending.card.id === 'v-action-flip-four' ? 'four' : 'one',
        targetId: actor.id,
        remaining: pending.card.id === 'v-action-flip-four' ? 4 : 1,
        deferred: [],
        actionInstanceId
      }, ...next.forced]
    }
    message = `${actor.name} received ${pending.card.label} and must flip ${pending.card.id === 'v-action-flip-four' ? 'up to four cards' : 'one card, then freeze'}`
  } else if (pending.card.id === 'v-action-steal') {
    const face = selected[0]
    if (!actor || actor.status !== 'active' || !face || face.player.id === actor.id) return state
    const actionCardEntry: VEntry = { instanceId: `v-card-${next.nextId}`, card: pending.card, voided: true }
    next = {
      ...next,
      nextId: next.nextId + 1,
      players: next.players.map(player => {
        let p = player
        if (p.id === face.player.id) {
          p = evaluate({ ...p, entries: p.entries.filter(entry => entry.instanceId !== face.entry.instanceId) })
        }
        if (p.id === actor.id) {
          p = receive(p, face.entry)
        }
        if (p.id === pending.sourceId) {
          p = { ...p, entries: [...p.entries, actionCardEntry] }
        }
        return p
      })
    }
    message = `${actor.name} stole ${face.entry.card.label} from ${face.player.name}`
  } else if (pending.card.id === 'v-action-discard') {
    const face = selected[0]
    if (!actor || actor.status !== 'active' || !face) return state
    const actionCardEntry: VEntry = { instanceId: `v-card-${next.nextId}`, card: pending.card, voided: true }
    next = {
      ...next,
      nextId: next.nextId + 1,
      players: next.players.map(player => {
        if (player.id !== face.player.id) return player
        const updatedEntries = player.entries.map(entry =>
          entry.instanceId === face.entry.instanceId ? { ...entry, voided: true } : entry
        )
        return evaluate({
          ...player,
          entries: [...updatedEntries, actionCardEntry]
        })
      })
    }
    message = `${actor.name} discarded ${face.entry.card.label} from ${face.player.name}`
  } else if (pending.card.id === 'v-action-swap') {
    const [first, second] = selected
    if (!actor || actor.status !== 'active' || !first || !second || first.player.id === second.player.id) return state
    const actionCardEntry: VEntry = { instanceId: `v-card-${next.nextId}`, card: pending.card, voided: true }
    next = {
      ...next,
      nextId: next.nextId + 1,
      players: next.players.map(player => {
        let p = player
        if (p.id === first.player.id) {
          p = receive({ ...p, entries: p.entries.filter(entry => entry.instanceId !== first.entry.instanceId) }, second.entry)
        } else if (p.id === second.player.id) {
          p = receive({ ...p, entries: p.entries.filter(entry => entry.instanceId !== second.entry.instanceId) }, first.entry)
        }
        if (p.id === pending.sourceId) {
          p = { ...p, entries: [...p.entries, actionCardEntry] }
        }
        return p
      })
    }
    message = `${actor.name} swapped ${first.entry.card.label} (${first.player.name}) with ${second.entry.card.label} (${second.player.name})`
  } else return state
  next = addEvent({ ...next, pending: null, roundFinisherId: actor?.id ?? target?.id ?? state.roundFinisherId }, message)
  return commit(state, normalize(next))
}
