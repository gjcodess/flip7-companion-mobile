import { useEffect, useRef, useState, type KeyboardEvent, type PointerEvent } from 'react'
import type { Edition } from '../../lib/room-store'

type Dock = { side: 'left' | 'right'; bottom: number }
type Gesture = { pointerId: number; startX: number; startY: number; offsetX: number; offsetY: number; moved: boolean }

const STORAGE_KEY = 'flip7-edition-fab-dock'
const DEFAULT_DOCK: Dock = { side: 'right', bottom: 96 }

function badgeSize() { return window.innerWidth <= 360 ? 70 : 80 }
function dockLeft(side: Dock['side']) {
  const width = window.innerWidth
  const inset = width >= 600 ? Math.max(14, width / 2 - 320) : width <= 360 ? 14 : Math.max(16, width / 2 - 246)
  return side === 'left' ? inset : width - inset - badgeSize()
}
function clampBottom(bottom: number) {
  const max = Math.max(96, window.innerHeight - badgeSize() - 84)
  return Math.min(max, Math.max(96, bottom))
}

function readDock(): Dock {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) ?? 'null') as Partial<Dock> | null
    if (saved && (saved.side === 'left' || saved.side === 'right') && typeof saved.bottom === 'number' && Number.isFinite(saved.bottom)) {
      return { side: saved.side, bottom: clampBottom(saved.bottom) }
    }
  } catch { /* Use the default position when local storage is unavailable. */ }
  return DEFAULT_DOCK
}

function saveDock(dock: Dock) {
  try { localStorage.setItem(STORAGE_KEY, JSON.stringify(dock)) }
  catch { /* The switch remains movable for this session. */ }
}

export function EditionFab({ target, onSwitch }: { target: Edition; onSwitch: () => void }) {
  const [dock, setDock] = useState<Dock>(readDock)
  const [dragLeft, setDragLeft] = useState<number | null>(null)
  const dockRef = useRef(dock)
  const dragLeftRef = useRef<number | null>(null)
  const gesture = useRef<Gesture | null>(null)
  const suppressClick = useRef(false)
  const targetName = target === 'classic' ? 'Classic Flip 7' : 'Flip 7 With a Vengeance'

  const updateDock = (next: Dock) => { dockRef.current = next; setDock(next) }

  useEffect(() => {
    const fitToScreen = () => updateDock({ ...dockRef.current, bottom: clampBottom(dockRef.current.bottom) })
    window.addEventListener('resize', fitToScreen)
    return () => window.removeEventListener('resize', fitToScreen)
  }, [])

  const onPointerDown = (event: PointerEvent<HTMLButtonElement>) => {
    if (!event.isPrimary || event.button !== 0) return
    suppressClick.current = false
    const rect = event.currentTarget.getBoundingClientRect()
    gesture.current = { pointerId: event.pointerId, startX: event.clientX, startY: event.clientY, offsetX: event.clientX - rect.left, offsetY: event.clientY - rect.top, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }
  const onPointerMove = (event: PointerEvent<HTMLButtonElement>) => {
    const active = gesture.current
    if (!active || active.pointerId !== event.pointerId) return
    if (!active.moved && Math.hypot(event.clientX - active.startX, event.clientY - active.startY) < 7) return
    active.moved = true
    const left = Math.min(dockLeft('right'), Math.max(dockLeft('left'), event.clientX - active.offsetX))
    dragLeftRef.current = left
    setDragLeft(left)
    updateDock({ ...dockRef.current, bottom: clampBottom(window.innerHeight - event.clientY + active.offsetY - badgeSize()) })
  }
  const finishDrag = (event: PointerEvent<HTMLButtonElement>) => {
    const active = gesture.current
    if (!active || active.pointerId !== event.pointerId) return
    gesture.current = null
    if (active.moved) {
      const side = (dragLeftRef.current ?? dockLeft(dockRef.current.side)) + badgeSize() / 2 < window.innerWidth / 2 ? 'left' : 'right'
      const next: Dock = { ...dockRef.current, side }
      suppressClick.current = true
      updateDock(next)
      setDragLeft(null)
      dragLeftRef.current = null
      saveDock(next)
    }
  }
  const onKeyDown = (event: KeyboardEvent<HTMLButtonElement>) => {
    if (!event.altKey || !['ArrowLeft', 'ArrowRight', 'ArrowUp', 'ArrowDown'].includes(event.key)) return
    event.preventDefault()
    const next = {
      side: event.key === 'ArrowLeft' ? 'left' : event.key === 'ArrowRight' ? 'right' : dockRef.current.side,
      bottom: clampBottom(dockRef.current.bottom + (event.key === 'ArrowUp' ? 40 : event.key === 'ArrowDown' ? -40 : 0)),
    } as Dock
    updateDock(next)
    saveDock(next)
  }

  return <button
    type="button"
    className={`edition-fab${dragLeft !== null ? ' is-dragging' : ''}`}
    style={{ left: `${dragLeft ?? dockLeft(dock.side)}px`, bottom: `calc(${dock.bottom}px + env(safe-area-inset-bottom, 0px))` }}
    aria-label={`Switch to ${targetName}`}
    aria-description="Drag through the screen, then release to dock at the nearest side. Alt plus arrow keys also move the button."
    title={`Switch to ${targetName} · drag to move`}
    onClick={() => { if (suppressClick.current) { suppressClick.current = false; return } onSwitch() }}
    onPointerDown={onPointerDown}
    onPointerMove={onPointerMove}
    onPointerUp={finishDrag}
    onPointerCancel={finishDrag}
    onKeyDown={onKeyDown}
  >
    <img src={target === 'classic' ? '/assets/flip7-classic-game-badge.webp' : '/assets/flip7-vengeance-game-badge.webp'} alt="" aria-hidden="true" draggable={false} />
  </button>
}
