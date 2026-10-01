import { useEffect, useRef } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export const targetScorePresets = [
  { value: 100, label: 'QUICK' },
  { value: 200, label: 'CLASSIC' },
  { value: 500, label: 'MARATHON' },
] as const

export function TargetScorePicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const dropdown = useRef<HTMLDetailsElement>(null)
  const options: { value: number; label?: string }[] = targetScorePresets.some(preset => preset.value === value)
    ? [...targetScorePresets]
    : [{ value }, ...targetScorePresets]
  const close = () => { if (dropdown.current) dropdown.current.open = false }
  useEffect(() => {
    const dismiss = (event: PointerEvent) => { if (event.target instanceof Node && !dropdown.current?.contains(event.target)) close() }
    document.addEventListener('pointerdown', dismiss)
    return () => document.removeEventListener('pointerdown', dismiss)
  }, [])
  return <details ref={dropdown} className="room-score-dropdown" onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) close() }} onKeyDown={event => { if (event.key === 'Escape') { event.preventDefault(); close(); dropdown.current?.querySelector('summary')?.focus() } }}>
    <summary className="room-score-trigger" aria-label={`Default target score: ${value} points`}>
      {value} pts <ChevronDown size={16} aria-hidden="true" />
    </summary>
    <div className="room-score-options" role="group" aria-label="Default target score choices">{options.map(({ value: score, label }) => <button type="button" key={score} aria-pressed={score === value} className={score === value ? 'selected' : ''} onClick={() => { onChange(score); close(); dropdown.current?.querySelector('summary')?.focus() }}><span>{score} pts{label && <small>{label}</small>}</span>{score === value && <Check size={16} aria-hidden="true" />}</button>)}</div>
  </details>
}
