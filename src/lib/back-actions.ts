import { useEffect, useRef } from 'react'

type BackAction = { priority: number; order: number; run: () => void }

const actions = new Set<BackAction>()
let nextOrder = 0

export function useBackAction(active: boolean, run: () => void, priority = 50) {
  const runRef = useRef(run)
  runRef.current = run

  useEffect(() => {
    if (!active) return
    const action: BackAction = { priority, order: ++nextOrder, run: () => runRef.current() }
    actions.add(action)
    return () => { actions.delete(action) }
  }, [active, priority])
}

export function runBackAction() {
  const action = [...actions].sort((a, b) => b.priority - a.priority || b.order - a.order)[0]
  if (!action) return false
  action.run()
  return true
}
