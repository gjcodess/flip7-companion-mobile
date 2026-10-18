import { useReducedMotion } from 'motion/react'

/** Match the spring used by the game's Players sheet. */
export function useRoomSheetMotion() {
  const prefersReducedMotion = useReducedMotion()
  const reducedMotion = prefersReducedMotion || document.documentElement.classList.contains('room-reduced-motion')
  return { initial: reducedMotion ? false : { y: 80 }, animate: { y: 0 } }
}
