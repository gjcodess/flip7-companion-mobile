import { demoDerived, demoInitialState, demoReducer, type DemoAction, type DemoState, type DemoStatus } from './demoGame'
import type { Card } from './cards'
import type { PlayerAvatarId } from '../lib/player-avatars'
import { meetsStayMinimum, type MinimumNumberCardsToStay } from './stayRule'

export const bankerPlayerColors = [
  '#ed4f7e', '#57b8d7', '#97c844', '#f7a235', '#9b7bd8',
  '#e78bba', '#39bca8', '#e9695b', '#efcf45', '#6387e8',
]

export type BankerPlayer = {
  id: string
  name: string
  color: string
  avatar?: PlayerAvatarId
  totalScore: number
  round: DemoState
}

export type BankerRoundResult = {
  round: number
  scores: Record<string, number>
  hands?: Record<string, { name: string; color: string; avatar?: PlayerAvatarId; status: DemoStatus; entries: DemoState['entries'] }>
}

export type BankerPendingAction = { card: Card; sourcePlayerId: string; consumesForcedDraw?: boolean }

export type BankerForcedTurn = {
  targetPlayerId: string
  remaining: number
  resumeAfterPlayerId: string
  actionInstanceId?: string
  deferred?: BankerPendingAction[]
}

export type BankerSnapshot = {
  selectedPlayerId: string | null
  turnPlayerId: string | null
  roundFinisherId: string | null
  forcedTurns: BankerForcedTurn[]
  pendingAction?: BankerPendingAction | null
  players: BankerPlayer[]
}

export type BankerState = {
  phase: 'setup' | 'round' | 'results'
  targetScore: number
  minimumNumberCardsToStay?: MinimumNumberCardsToStay
  roundNumber: number
  /** First seat of this round; retained under its legacy save key. */
  dealerId: string | null
  selectedPlayerId: string | null
  turnPlayerId: string | null
  roundFinisherId: string | null
  forcedTurns: BankerForcedTurn[]
  pendingAction?: BankerPendingAction | null
  players: BankerPlayer[]
  history: BankerRoundResult[]
  winnerIds: string[]
  past: BankerSnapshot[]
  future: BankerSnapshot[]
}

export type BankerAction =
  | { type: 'start'; targetScore: number; names: string[]; minimumNumberCardsToStay?: MinimumNumberCardsToStay }
  | { type: 'select-player'; playerId: string }
  /** Applies an intentional table correction without changing turn order. */
  | { type: 'player'; playerId: string; action: DemoAction }
  /** Records a newly flipped non-action card for the current Banker turn. */
  | { type: 'record-card'; playerId: string; card: Card }
  | { type: 'reveal-action'; sourcePlayerId: string; card: Card }
  /** Resolves an action after choosing a legal active recipient. */
  | { type: 'record-action'; sourcePlayerId: string; targetPlayerId: string; card: Card }
  /** Banks the current turn player and advances normal play. */
  | { type: 'settle-player'; playerId: string }
  | { type: 'undo' }
  | { type: 'redo' }
  | { type: 'move-player'; playerId: string; direction: -1 | 1 }
  | { type: 'advance-round' }
  | { type: 'reset' }
  | { type: 'restart'; scope: 'game' | 'round' }

export const bankerInitialState = (): BankerState => ({
  phase: 'setup', targetScore: 200, roundNumber: 1, dealerId: null,
  selectedPlayerId: null, turnPlayerId: null, roundFinisherId: null, forcedTurns: [],
  players: [], history: [], winnerIds: [],
  past: [], future: [],
})

export function bankerPlayerDerived(player: BankerPlayer) { return demoDerived(player.round) }
export function isBankerTerminal(status: DemoStatus) { return status !== 'active' }
export function allBankerPlayersSettled(state: BankerState) {
  return state.phase === 'round' && state.players.length > 0 && !state.pendingAction && state.forcedTurns.length === 0 && state.players.every((player) => isBankerTerminal(player.round.status))
}

function createPlayers(names: string[]): BankerPlayer[] {
  return names.map((name, index) => ({ id: `banker-player-${index + 1}`, name, color: bankerPlayerColors[index % bankerPlayerColors.length], totalScore: 0, round: { ...demoInitialState(), externalForces: true } }))
}

function nextActivePlayerId(players: BankerPlayer[], afterPlayerId: string | null) {
  if (players.length === 0) return null
  const start = afterPlayerId ? players.findIndex((player) => player.id === afterPlayerId) : -1
  for (let offset = 1; offset <= players.length; offset += 1) {
    const candidate = players[(start + offset + players.length) % players.length]
    if (candidate && !isBankerTerminal(candidate.round.status)) return candidate.id
  }
  return null
}

function currentTurnId(state: BankerState) { return state.forcedTurns[0]?.targetPlayerId ?? state.turnPlayerId }

function replacePlayerRound(players: BankerPlayer[], playerId: string, round: DemoState) {
  return players.map((player) => player.id === playerId ? { ...player, round } : player)
}

function bankerSnapshot(state: BankerState): BankerSnapshot {
  return { selectedPlayerId: state.selectedPlayerId, turnPlayerId: state.turnPlayerId, roundFinisherId: state.roundFinisherId, forcedTurns: state.forcedTurns, pendingAction: state.pendingAction, players: state.players }
}

function commitBankerState(previous: BankerState, next: BankerState): BankerState {
  return { ...next, past: [...previous.past, bankerSnapshot(previous)].slice(-30), future: [] }
}

function undoBankerState(state: BankerState): BankerState {
  const previous = state.past[state.past.length - 1]
  if (!previous) return state
  return { ...state, ...previous, past: state.past.slice(0, -1), future: [bankerSnapshot(state), ...state.future] }
}

function redoBankerState(state: BankerState): BankerState {
  const next = state.future[0]
  if (!next) return state
  return { ...state, ...next, past: [...state.past, bankerSnapshot(state)], future: state.future.slice(1) }
}

function forceBankActivePlayers(players: BankerPlayer[], preservePlayerId: string) {
  return players.map((player) => player.id !== preservePlayerId && player.round.status === 'active' ? { ...player, round: { ...player.round, status: 'stayed' as const } } : player)
}

export function bankerEligibleActionTargets(state: BankerState, card: Card): BankerPlayer[] {
  return state.players.filter(player => player.round.status === 'active' &&
    (card.id !== 'action-second-chance' || bankerPlayerDerived(player).secondChanceCount === 0))
}

function addCard(player: BankerPlayer, card: Card, discarded = false): BankerPlayer {
  const round = { ...player.round, externalForces: true }
  if (!discarded) return { ...player, round: demoReducer(round, { type: 'add', card }) }
  return { ...player, round: { ...round, nextId: round.nextId + 1,
    entries: [...round.entries, { instanceId: `demo-card-${round.nextId}`, card, voided: true, discarded: true }] } }
}

function finishForce(players: BankerPlayer[], force: BankerForcedTurn): BankerPlayer[] {
  return players.map(player => {
    if (player.id !== force.targetPlayerId) return player
    const instanceId = force.actionInstanceId ?? [...player.round.entries].reverse().find(entry => entry.card.id === 'action-flip-three' && !entry.voided)?.instanceId
    return { ...player, round: { ...player.round, flipThreeRemaining: 0,
      entries: player.round.entries.map(entry => entry.instanceId === instanceId ? { ...entry, resolved: true, voided: true } : entry) } }
  })
}

function normalizeBanker(state: BankerState): BankerState {
  let next = state
  for (let guard = 0; guard < 100; guard++) {
    const finisher = next.players.find(player => player.round.status === 'flip-seven')
    if (finisher) {
      let players = next.players
      for (const force of next.forcedTurns) players = finishForce(players, force)
      return { ...next, players: forceBankActivePlayers(players, finisher.id), pendingAction: null,
        forcedTurns: [], turnPlayerId: finisher.id, selectedPlayerId: finisher.id, roundFinisherId: finisher.id }
    }
    if (next.pendingAction) {
      if (bankerEligibleActionTargets(next, next.pendingAction.card).length) return next
      const pending = next.pendingAction
      next = { ...next, pendingAction: null,
        players: next.players.map(player => player.id === pending.sourcePlayerId ? addCard(player, pending.card, true) : player) }
      if (pending.consumesForcedDraw && next.forcedTurns[0]) {
        next = { ...next, forcedTurns: [{ ...next.forcedTurns[0], remaining: next.forcedTurns[0].remaining - 1 }, ...next.forcedTurns.slice(1)] }
      }
      continue
    }
    const force = next.forcedTurns[0]
    if (force) {
      const target = next.players.find(player => player.id === force.targetPlayerId)
      if (force.remaining > 0 && target?.round.status === 'active') {
        return { ...next, turnPlayerId: target.id, selectedPlayerId: target.id }
      }
      next = { ...next, players: finishForce(next.players, force) }
      // Only a completed, surviving sequence releases its deferred actions.
      if (force.remaining === 0 && force.deferred?.length) {
        next = { ...next, pendingAction: force.deferred[0],
          forcedTurns: [{ ...force, deferred: force.deferred.slice(1) }, ...next.forcedTurns.slice(1)] }
        continue
      }
      next = { ...next, forcedTurns: next.forcedTurns.slice(1), turnPlayerId: force.resumeAfterPlayerId }
      continue
    }
    const turnPlayerId = nextActivePlayerId(next.players, next.turnPlayerId)
    return { ...next, turnPlayerId, selectedPlayerId: turnPlayerId }
  }
  throw new Error('Classic action chain exceeded its safe limit.')
}

function revealAction(state: BankerState, sourcePlayerId: string, card: Card): BankerState {
  const force = state.forcedTurns[0]
  if (force && force.remaining > 0 && card.id !== 'action-second-chance') {
    return normalizeBanker({ ...state, forcedTurns: [{ ...force, remaining: force.remaining - 1,
      deferred: [...(force.deferred ?? []), { card, sourcePlayerId }] }, ...state.forcedTurns.slice(1)] })
  }
  return normalizeBanker({ ...state, pendingAction: { card, sourcePlayerId, consumesForcedDraw: Boolean(force && force.remaining > 0) } })
}

export function bankerReducer(state: BankerState, action: BankerAction): BankerState {
  if (action.type === 'restart') {
    if (!state.players.length || (action.scope === 'round' && state.phase !== 'round')) return state
    const wholeGame = action.scope === 'game'
    const starterId = wholeGame ? state.players[0].id : state.dealerId ?? state.players[0].id
    return { ...state, phase: 'round', roundNumber: wholeGame ? 1 : state.roundNumber,
      dealerId: starterId, selectedPlayerId: starterId, turnPlayerId: starterId,
      roundFinisherId: null, forcedTurns: [], pendingAction: null,
      players: state.players.map(player => ({ ...player, totalScore: wholeGame ? 0 : player.totalScore, round: { ...demoInitialState(), externalForces: true } })),
      history: wholeGame ? [] : state.history, winnerIds: [], past: [], future: [] }
  }
  if (action.type === 'reset') return bankerInitialState()
  if (action.type === 'undo') return undoBankerState(state)
  if (action.type === 'redo') return redoBankerState(state)

  if (action.type === 'start') {
    const players = createPlayers(action.names)
    const firstPlayerId = players[0]?.id ?? null
    return { phase: 'round', targetScore: action.targetScore, minimumNumberCardsToStay: action.minimumNumberCardsToStay, roundNumber: 1, dealerId: firstPlayerId, selectedPlayerId: firstPlayerId, turnPlayerId: firstPlayerId, roundFinisherId: null, forcedTurns: [], players, history: [], winnerIds: [], past: [], future: [] }
  }

  if (action.type === 'select-player') {
    return state.players.some((player) => player.id === action.playerId) ? { ...state, selectedPlayerId: action.playerId } : state
  }

  if (action.type === 'move-player') {
    if (state.players.length < 2) return state
    const index = state.players.findIndex((player) => player.id === action.playerId)
    const nextIndex = index + action.direction
    if (index < 0 || nextIndex < 0 || nextIndex >= state.players.length) return state
    const players = [...state.players]; [players[index], players[nextIndex]] = [players[nextIndex], players[index]]
    return { ...state, players }
  }

  if (action.type === 'player') {
    if (state.phase !== 'round') return state
    if (action.action.type === 'undo') return undoBankerState(state)
    if (action.action.type === 'redo') return redoBankerState(state)
    const player = state.players.find(candidate => candidate.id === action.playerId)
    if (!player) return state
    if (action.action.type === 'stay' && !meetsStayMinimum(bankerPlayerDerived(player).numberCardCount, state.minimumNumberCardsToStay)) return state
    const currentRound = player.round.externalForces ? player.round : { ...player.round, externalForces: true }
    const nextRound = demoReducer(currentRound, action.action)
    if (nextRound === currentRound) return state
    const players = replacePlayerRound(state.players, player.id, nextRound)
    if (!state.forcedTurns.length && !state.pendingAction) return commitBankerState(state, { ...state, players })
    const next = normalizeBanker({ ...state, players })
    return commitBankerState(state, { ...next, selectedPlayerId: next.turnPlayerId === state.turnPlayerId ? state.selectedPlayerId : next.selectedPlayerId })
  }

  if (action.type === 'record-card' || action.type === 'reveal-action') {
    const sourceId = action.type === 'record-card' ? action.playerId : action.sourcePlayerId
    if (state.phase !== 'round' || state.pendingAction || currentTurnId(state) !== sourceId) return state
    const player = state.players.find(candidate => candidate.id === sourceId)
    if (!player || player.round.status !== 'active') return state
    if (action.type === 'reveal-action') {
      if (action.card.kind !== 'action') return state
      return commitBankerState(state, revealAction(state, sourceId, action.card))
    }
    if (action.card.kind === 'action') return state
    const players = state.players.map(p => p.id === player.id ? addCard(p, action.card) : p)
    const busted = players.find(p => p.id === player.id)?.round.status === 'busted'
    const forcedTurns = state.forcedTurns.length ? [{ ...state.forcedTurns[0], remaining: state.forcedTurns[0].remaining - 1, deferred: busted ? [] : state.forcedTurns[0].deferred }, ...state.forcedTurns.slice(1)] : []
    return commitBankerState(state, normalizeBanker({ ...state, players, forcedTurns, roundFinisherId: player.id }))
  }

  if (action.type === 'record-action') {
    if (state.phase !== 'round' || action.card.kind !== 'action') return state
    const pending = state.pendingAction
    if (pending ? pending.sourcePlayerId !== action.sourcePlayerId || pending.card.id !== action.card.id
      : currentTurnId(state) !== action.sourcePlayerId) return state
    if (!pending && state.forcedTurns[0]?.remaining > 0 && action.card.id !== 'action-second-chance') {
      return commitBankerState(state, revealAction(state, action.sourcePlayerId, action.card))
    }
    const source = state.players.find(player => player.id === action.sourcePlayerId)
    const target = bankerEligibleActionTargets(state, action.card).find(player => player.id === action.targetPlayerId)
    if (!source || !target) return state
    const targetPlayer = addCard(target, action.card)
    let forcedTurns = state.forcedTurns
    const consumesForcedDraw = pending ? pending.consumesForcedDraw : Boolean(forcedTurns[0]?.remaining > 0)
    if (consumesForcedDraw && forcedTurns[0]) {
      forcedTurns = [{ ...forcedTurns[0], remaining: forcedTurns[0].remaining - 1 }, ...forcedTurns.slice(1)]
    }
    if (action.card.id === 'action-flip-three') {
      forcedTurns = [{ targetPlayerId: target.id, remaining: 3,
        resumeAfterPlayerId: forcedTurns[0]?.resumeAfterPlayerId ?? action.sourcePlayerId,
        actionInstanceId: `demo-card-${target.round.nextId}`, deferred: [] }, ...forcedTurns]
    }
    const players = state.players.map(player => player.id === target.id ? targetPlayer : player)
    return commitBankerState(state, normalizeBanker({ ...state, players, forcedTurns, pendingAction: null, roundFinisherId: target.id }))
  }

  if (action.type === 'settle-player') {
    if (state.phase !== 'round' || currentTurnId(state) !== action.playerId || state.forcedTurns.length > 0 || state.pendingAction) return state
    const player = state.players.find((candidate) => candidate.id === action.playerId)
    if (!player || player.round.status !== 'active') return state
    if (!meetsStayMinimum(bankerPlayerDerived(player).numberCardCount, state.minimumNumberCardsToStay)) return state
    const nextRound = demoReducer(player.round, { type: 'stay' })
    if (nextRound === player.round) return state
    const players = replacePlayerRound(state.players, player.id, nextRound)
    const nextPlayerId = nextActivePlayerId(players, player.id)
    return commitBankerState(state, { ...state, players, turnPlayerId: nextPlayerId, selectedPlayerId: nextPlayerId, roundFinisherId: player.id })
  }

  if (action.type === 'advance-round') {
    if (!allBankerPlayersSettled(state)) return state
    const scores = Object.fromEntries(state.players.map((player) => [player.id, bankerPlayerDerived(player).score]))
    const players = state.players.map((player) => ({ ...player, totalScore: player.totalScore + (scores[player.id] ?? 0) }))
    const hands = Object.fromEntries(state.players.map((player) => [player.id, { name: player.name, color: player.color, avatar: player.avatar, status: player.round.status, entries: player.round.entries }]))
    const history = [...state.history, { round: state.roundNumber, scores, hands }]
    const reachedTarget = players.some((player) => player.totalScore >= state.targetScore)
    const highestScore = Math.max(...players.map(player => player.totalScore))
    const leaders = players.filter(player => player.totalScore === highestScore)
    if (reachedTarget && leaders.length === 1) {
      return { ...state, phase: 'results', players, history, winnerIds: players.filter((player) => player.totalScore === highestScore).map((player) => player.id), forcedTurns: [], past: [], future: [] }
    }
    const starterId = players[(Math.max(0, players.findIndex(player => player.id === state.dealerId)) + 1) % players.length]?.id ?? null
    const nextPlayers = players.map((player) => ({ ...player, round: { ...demoInitialState(), externalForces: true } }))
    return { ...state, players: nextPlayers, history, roundNumber: state.roundNumber + 1, dealerId: starterId, turnPlayerId: starterId, roundFinisherId: null, forcedTurns: [], pendingAction: null, selectedPlayerId: starterId, past: [], future: [] }
  }

  return state
}
