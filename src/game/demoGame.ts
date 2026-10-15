import type { Card } from './cards'

export type DemoStatus = 'active' | 'stayed' | 'frozen' | 'busted' | 'flip-seven'

export type DemoEntry = {
  instanceId: string
  card: Card
  voided: boolean
  /** Permanent disposition of a physical card, separate from replayed bust protection. */
  discarded?: boolean
  resolved?: boolean
}

export type DemoSnapshot = {
  entries: DemoEntry[]
  status: DemoStatus
  flipThreeRemaining: number
  nextId: number
  /** Multiplayer forced draws are managed by the table engine. */
  externalForces?: boolean
}

export type DemoState = DemoSnapshot & {
  past: DemoSnapshot[]
  future: DemoSnapshot[]
}

export type DemoAction =
  | { type: 'add'; card: Card }
  | { type: 'consume-flip-three' }
  | { type: 'replace'; index: number; card: Card }
  | { type: 'remove'; index: number }
  | { type: 'reorder'; entries: DemoEntry[] }
  | { type: 'stay' }
  | { type: 'reset' }
  | { type: 'undo' }
  | { type: 'redo' }

export type DemoDerived = {
  score: number
  numberCardCount: number
  flipSevenBonus: number
  secondChanceCount: number
  flipThreeRemaining: number
  canStay: boolean
}

export const demoInitialState = (): DemoState => ({ entries: [], status: 'active', flipThreeRemaining: 0, nextId: 1, past: [], future: [] })

export function activeDemoEntries(entries: DemoEntry[]) {
  return entries.filter((entry) => !entry.voided)
}

const actionOrder: Record<string, number> = { 'action-second-chance': 0, 'action-freeze': 1, 'action-flip-three': 2 }

function entryCategory(entry: DemoEntry) {
  if (entry.voided) return 4
  if (entry.card.kind === 'number') return 0
  if (entry.card.id === 'modifier-x2') return 1
  if (entry.card.kind === 'modifier') return 2
  return 3
}

function entrySequence(entry: DemoEntry) {
  return Number(entry.instanceId.replace('demo-card-', ''))
}

export function organizeDemoEntries(entries: DemoEntry[]) {
  return [...entries].sort((a, b) => {
    const categoryDifference = entryCategory(a) - entryCategory(b)
    if (categoryDifference !== 0) return categoryDifference
    if (a.voided && b.voided) return entrySequence(a) - entrySequence(b)
    if (a.card.kind === 'number' && b.card.kind === 'number') return (a.card.points ?? 0) - (b.card.points ?? 0)
    if (a.card.kind === 'modifier' && b.card.kind === 'modifier') return (a.card.points ?? 0) - (b.card.points ?? 0)
    if (a.card.kind === 'action' && b.card.kind === 'action') return (actionOrder[a.card.id] ?? 99) - (actionOrder[b.card.id] ?? 99)
    return entrySequence(a) - entrySequence(b)
  })
}

export function scoreDemoEntries(entries: DemoEntry[], status: DemoStatus = 'active') {
  if (status === 'busted') return 0
  const cards = activeDemoEntries(entries).map((entry) => entry.card)
  const numbers = cards.filter((card) => card.kind === 'number')
  const numberTotal = numbers.reduce((sum, card) => sum + (card.points ?? 0), 0)
  const modifiers = cards.filter((card) => card.kind === 'modifier' && card.id !== 'modifier-x2').reduce((sum, card) => sum + (card.points ?? 0), 0)
  const multiplier = cards.some((card) => card.id === 'modifier-x2') ? 2 : 1
  const flipSevenBonus = new Set(numbers.map((card) => card.id)).size >= 7 ? 15 : 0
  return numberTotal * multiplier + modifiers + flipSevenBonus
}

export function deriveDemoState(entries: DemoEntry[], externalForces = false): Pick<DemoSnapshot, 'entries' | 'status' | 'flipThreeRemaining'> {
  const nextEntries = entries.map(entry => ({ ...entry, voided: Boolean(entry.discarded) }))
  const ordered = [...nextEntries].sort((a, b) => entrySequence(a) - entrySequence(b))
  const seenNumbers = new Set<string>()
  let secondChance: DemoEntry | undefined
  let force: { entry: DemoEntry; remaining: number; deferred: DemoEntry[] } | undefined
  let queued: DemoEntry[] = []
  let status: DemoStatus = 'active'

  const resolveQueued = () => {
    while (!force && queued.length) {
      const entry = queued.shift()!
      if (status !== 'active') { entry.voided = true; continue }
      if (entry.card.id === 'action-freeze') {
        entry.voided = true
        status = 'frozen'
      } else {
        force = { entry, remaining: 3, deferred: [] }
      }
    }
  }

  for (const entry of ordered) {
    if (entry.discarded) continue
    if (status !== 'active') break
    const currentForce = force
    const { card } = entry
    if (card.id === 'action-second-chance') {
      if (secondChance) entry.voided = true
      else secondChance = entry
    } else if (card.id === 'action-freeze' || card.id === 'action-flip-three') {
      if (externalForces && card.id === 'action-flip-three') {
        entry.voided = Boolean(entry.resolved)
      } else if (currentForce) {
        currentForce.deferred.push(entry)
      } else {
        queued.push(entry)
        resolveQueued()
      }
    } else if (card.kind === 'number') {
      if (seenNumbers.has(card.id)) {
        if (secondChance) {
          secondChance.voided = true
          secondChance = undefined
          entry.voided = true
        } else status = 'busted'
      } else {
        seenNumbers.add(card.id)
        if (seenNumbers.size >= 7) status = 'flip-seven'
      }
    }
    if (currentForce) {
      currentForce.remaining -= 1
      if (status !== 'active' || currentForce.remaining === 0) {
        currentForce.entry.voided = true
        force = undefined
        if (status === 'active') queued = [...currentForce.deferred, ...queued]
        else currentForce.deferred.forEach(card => { card.voided = true })
        resolveQueued()
      }
    }
    if (status !== 'active') {
      queued.forEach(card => { card.voided = true })
      queued = []
    }
  }
  return { entries: nextEntries, status, flipThreeRemaining: force?.remaining ?? 0 }
}

export function demoDerived(state: DemoState): DemoDerived {
  const entries = activeDemoEntries(state.entries)
  const numbers = entries.filter((entry) => entry.card.kind === 'number')
  const secondChanceCount = entries.filter((entry) => entry.card.id === 'action-second-chance').length
  const flipSevenBonus = new Set(numbers.map((entry) => entry.card.id)).size >= 7 ? 15 : 0
  return { score: scoreDemoEntries(state.entries, state.status), numberCardCount: numbers.length, flipSevenBonus, secondChanceCount, flipThreeRemaining: state.flipThreeRemaining, canStay: state.status === 'active' && state.flipThreeRemaining === 0 && entries.length > 0 }
}

function snapshot(state: DemoState): DemoSnapshot {
  return { entries: state.entries, status: state.status, flipThreeRemaining: state.flipThreeRemaining, nextId: state.nextId, externalForces: state.externalForces }
}

function commit(state: DemoState, next: DemoSnapshot): DemoState {
  return { ...next, past: [...state.past, snapshot(state)].slice(-30), future: [] }
}

function rebuild(entries: DemoEntry[], nextId: number, externalForces?: boolean) {
  const derived = deriveDemoState(entries, externalForces)
  return { ...derived, nextId, externalForces }
}

export function demoReducer(state: DemoState, action: DemoAction): DemoState {
  if (action.type === 'reset') return demoInitialState()
  if (action.type === 'consume-flip-three') {
    if (state.status !== 'active' || state.flipThreeRemaining <= 0) return state
    return commit(state, { ...snapshot(state), flipThreeRemaining: state.flipThreeRemaining - 1 })
  }
  if (action.type === 'undo') {
    const previous = state.past[state.past.length - 1]
    return previous ? { ...previous, past: state.past.slice(0, -1), future: [snapshot(state), ...state.future] } : state
  }
  if (action.type === 'redo') {
    const next = state.future[0]
    return next ? { ...next, past: [...state.past, snapshot(state)], future: state.future.slice(1) } : state
  }
  if (action.type === 'stay') {
    if (!demoDerived(state).canStay) return state
    return commit(state, { ...snapshot(state), status: 'stayed' })
  }
  if (action.type === 'remove') {
    if (state.status !== 'active' && state.status !== 'busted') return state
    if (!state.entries[action.index]) return state
    return commit(state, rebuild(state.entries.filter((_, index) => index !== action.index), state.nextId, state.externalForces))
  }
  if (action.type === 'replace') {
    if (state.status !== 'active' && state.status !== 'busted') return state
    if (!state.entries[action.index]) return state
    const entries = state.entries.map((entry, index) => index === action.index ? { ...entry, card: action.card, voided: false, discarded: undefined, resolved: undefined } : entry)
    return commit(state, rebuild(entries, state.nextId, state.externalForces))
  }
  if (action.type === 'reorder') {
    if (state.status !== 'active') return state
    return commit(state, { ...snapshot(state), entries: action.entries })
  }
  if (state.status !== 'active') return state
  const entry: DemoEntry = { instanceId: `demo-card-${state.nextId}`, card: action.card, voided: false }
  return commit(state, rebuild([...state.entries, entry], state.nextId + 1, state.externalForces))
}
