import type { Room } from '../../lib/room-store'

export type SeatConnection = 'connected' | 'away' | 'pending' | null

export function seatConnection(room: Room | undefined, playerId: string, onlineDevices: ReadonlySet<string>): SeatConnection {
  const grants = Object.entries(room?.sharedHost?.grants ?? {})
  const approved = grants.find(([, grant]) => grant.status === 'approved' && grant.playerId === playerId)
  if (approved) return onlineDevices.has(approved[0]) ? 'connected' : 'away'
  return grants.some(([, grant]) => grant.status === 'pending' && grant.requestedSeat === playerId) ? 'pending' : null
}

export function SeatConnectionBadge({ status, compact = false }: { status: SeatConnection; compact?: boolean }) {
  if (!status) return null
  const label = status === 'connected' ? 'Connected' : status === 'away' ? 'Not connected' : 'Awaiting approval'
  return <span className={`seat-connection-badge ${status} ${compact ? 'compact' : ''}`} title={label} aria-label={label}><i aria-hidden="true" />{compact ? status === 'connected' ? 'LIVE' : status === 'away' ? 'AWAY' : 'ASK' : label}</span>
}
