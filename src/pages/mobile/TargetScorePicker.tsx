import { useEffect, useRef } from 'react'
import { Check, ChevronDown } from 'lucide-react'

export function TargetScorePicker({ value, onChange }: { value: number; onChange: (value: number) => void }) {
  const dropdown = useRef<HTMLDetailsElement>(null)
  const options = [100, 200, 300].includes(value) ? [100, 200, 300] : [value, 100, 200, 300]
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
    <div className="room-score-options" role="group" aria-label="Default target score choices">{options.map(score => <button type="button" key={score} aria-pressed={score === value} className={score === value ? 'selected' : ''} onClick={() => { onChange(score); close(); dropdown.current?.querySelector('summary')?.focus() }}><span>{score} pts</span>{score === value && <Check size={16} aria-hidden="true" />}</button>)}</div>
  </details>
}
