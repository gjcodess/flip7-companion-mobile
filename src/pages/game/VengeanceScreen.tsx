import { RoomSharingButton, SharedRoomDialog } from '../mobile/SharedRoomControls'
import { RestartDialog } from './RestartDialog'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import { useRoomSheetMotion } from '../../lib/use-room-sheet-motion'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUp,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Eye,
  History,
  LogOut,
  Menu,
  Monitor,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  Share2,
  Skull,
  Sparkles,
  Undo2,
  Users,
  X,
} from 'lucide-react'
import type { Card } from '../../game/cards'
import { ForcedDrawStatus } from './ForcedDrawStatus'
import { RoundHistoryDialog } from './RoundHistoryDialog'
import { vengeanceTableEntries, type VTableEntry } from '../../game/tableEntries'
import { vengeanceCards, type VengeanceCard } from '../../game/vengeanceCards'
import {
  vengeancePendingKey,
  vengeancePending,
  vengeanceEligibleActors,
  vengeanceEligibleCards,
  vengeanceInitialState,
  vengeanceReducer,
  vengeanceScore,
  type VAction,
  type VEntry,
  type VPlayer,
  type VState,
  type VVariant,
  type VFlipSevenChoice,
} from '../../game/vengeanceGame'
import { getLibrary, saveVengeanceState, updateLibrary, useLibrary, type PlayerProfile } from '../../lib/room-store'
import { blockSharedHost } from '../../lib/shared-room'
import { useRoomPresence } from '../../lib/shared-room-presence'
import { SeatConnectionBadge, seatConnection } from '../mobile/SeatConnectionBadge'
import { useAppNavigation, useNavigationGuard } from '../../lib/navigation'
import { ConfirmationModal } from '../../components/ConfirmationModal'
import { BrutalWarningModal } from '../../components/BrutalWarningModal'
import { BrutalFlipSevenModal } from './BrutalFlipSevenModal'
import { CardArtwork } from '../../components/CardArtwork'
import { PickerCardArtwork } from '../../components/PickerCardArtwork'
import { PlayerAvatar } from '../../components/PlayerAvatar'
import { defaultPlayerAvatarFor, type PlayerAvatarId } from '../../lib/player-avatars'
import { tvSharingAvailable } from '../../lib/tv-share'
import { TargetScorePicker } from '../mobile/TargetScorePicker'
import { RoomCharacterDialog } from '../mobile/MobileApp'
import { BrutalSkullIcon } from '../../components/BrutalSkullIcon'
import { GameTable } from './GameTable'
import { ResultsShareDialog } from './ResultsShareDialog'
import './VengeanceScreen.css'

const demoColors = ['#e93234', '#193c89', '#da8736', '#257878', '#802e80', '#63439b', '#b33973', '#2e7d32']

function statusClass(player: VPlayer, flipSevenChoice?: VFlipSevenChoice | null) {
  if (player.status === 'flip-seven' && flipSevenChoice?.choice === 'penalize' && flipSevenChoice.finisherId === player.id) {
    return 'stayed'
  }
  return player.status === 'flip-seven' ? 'flip-seven' : player.status
}

function statusBadgeLabel(player: VPlayer, flipSevenChoice?: VFlipSevenChoice | null) {
  if (player.status === 'busted') return 'Busted'
  if (player.status === 'frozen') return 'Frozen'
  if (player.status === 'stayed') return 'Stayed'
  if (player.status === 'flip-seven') {
    return flipSevenChoice?.choice === 'penalize' && flipSevenChoice.finisherId === player.id ? 'Banked' : 'Flip 7!'
  }
  return 'Active'
}

function playerTabSummary(player: VPlayer, variant?: VVariant, flipSevenChoice?: VFlipSevenChoice | null) {
  const score = vengeanceScore(player, variant, flipSevenChoice)
  const numberCount = player.entries.filter((entry) => !entry.voided && entry.card.kind === 'number').length
  if (player.status === 'busted') {
    return variant === 'brutal' && score !== 0 ? `Busted · ${score} pts` : 'Busted'
  }
  if (player.status === 'frozen') return `Frozen · ${score} pts`
  if (player.status === 'stayed') return `Stayed · ${score} pts`
  if (player.status === 'flip-seven') return `Flip 7 · ${score} pts`
  return `${numberCount} cards · ${score} pts`
}

function organizeVengeanceEntries(entries: VEntry[]): VEntry[] {
  return [...entries].sort((a, b) => {
    if (Boolean(a.voided) !== Boolean(b.voided)) {
      return a.voided ? 1 : -1
    }
    if (a.card.kind === 'number' && b.card.kind === 'number') {
      const valA = a.card.value ?? a.card.points ?? 0
      const valB = b.card.value ?? b.card.points ?? 0
      return valA - valB
    }
    if (a.card.kind === 'number') return -1
    if (b.card.kind === 'number') return 1
    if (a.card.kind === 'modifier' && b.card.kind === 'modifier') {
      return (a.card.points ?? 0) - (b.card.points ?? 0)
    }
    if (a.card.kind === 'modifier') return -1
    if (b.card.kind === 'modifier') return 1
    return a.card.label.localeCompare(b.card.label)
  })
}

function VengeanceResults({
  players,
  history,
  targetScore,
  onNewGame,
  onExit,
}: {
  players: VPlayer[]
  history: VState['history']
  targetScore: number
  onNewGame: () => void
  onExit: () => void
}) {
  const ordered = [...players].sort((a, b) => b.totalScore - a.totalScore)
  const winnerScore = ordered[0]?.totalScore ?? 0
  const winners = ordered.filter((p) => p.totalScore === winnerScore)

  return (
    <div className="banker-results">
      <section className="results-hero">
        <span className="eyebrow">VENGEANCE MATCH COMPLETE</span>
        <h1>Match complete!</h1>
        <p>
          {winners.map((p) => p.name).join(' and ')} won with {winnerScore} points. Target: {targetScore}.
        </p>
      </section>
      <section className="results-card">
        <div className="results-heading">
          <div>
            <span className="eyebrow">FINAL SCORES</span>
            <h2>Game results</h2>
          </div>
          <span className="results-heading-icon" aria-hidden="true">
            <ClipboardList size={21} />
          </span>
        </div>
        <div className="results-list">
          {ordered.map((player) => {
            const rank = ordered.findIndex((p) => p.totalScore === player.totalScore) + 1
            return (
              <article
                className={`results-player ${player.totalScore === winnerScore ? 'winner' : ''}`}
                key={player.id}
              >
                <span className="results-rank" aria-label={`Rank ${rank}`}>
                  {rank}
                </span>
                <PlayerAvatar player={player} className="mini-avatar" />
                <div className="results-player-copy">
                  <div className="results-player-name">
                    <b>{player.name}</b>
                  </div>
                  <div className="results-rounds">
                    {history.map((round) => (
                      <span className={`round-score ${(round.scores[player.id] ?? 0) < 0 ? 'score-negative' : ''}`} key={`${player.id}-${round.round}`}>
                        R{round.round}: {round.scores[player.id] ?? 0}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="results-total">
                  <small>Total pts</small>
                  <strong className={player.totalScore < 0 ? 'score-negative' : ''}>{player.totalScore}</strong>
                </div>
              </article>
            )
          })}
        </div>
      </section>
      <section className="results-actions">
        <p>Your final scores and round cards are saved in this room on your device.</p>
        <div className="banker-results-actions">
          <button type="button" className="secondary-action" onClick={onNewGame}>
            <RotateCcw size={16} /> New game
          </button>
          <button type="button" className="primary-wide" onClick={onExit}>
            <ArrowLeft size={16} /> View room
          </button>
        </div>
      </section>
    </div>
  )
}

function VengeanceMenuDialog({
  demo = false,
  onClose,
  onOpenPlayers,
  onOpenRules,
  onOpenHistory,
  onOpenTvShare,
  onRestart,
  onExit,
}: {
  demo?: boolean
  onClose: () => void
  onOpenPlayers: () => void
  onOpenRules: () => void
  onOpenHistory: () => void
  onOpenTvShare: () => void
  onRestart?: () => void
  onExit: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  const sheetMotion = useRoomSheetMotion()
  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  return (
    <motion.dialog
      {...sheetMotion}
      ref={dialog}
      className="room-dialog banker-menu-dialog tv-share-dialog edition-vengeance"
      onCancel={onClose}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose()
      }}
    >
      <div className="room-dialog-heading">
        <div>
          <span className="room-kicker">{demo ? 'PRACTICE SESSION' : 'WITH A VENGEANCE'}</span>
          <h2>{demo ? 'Practice menu' : 'Game menu'}</h2>
        </div>
        <button className="room-icon-button" aria-label="Close menu" onClick={onClose}>
          <X size={20} />
        </button>
      </div>
      <div className="banker-menu-list">
        <button
          type="button"
          className="banker-menu-item"
          onClick={() => {
            onClose()
            onOpenPlayers()
          }}
        >
          <div className="banker-menu-item-icon">
            <Users size={20} />
          </div>
          <div className="banker-menu-item-text">
            <strong>Players</strong>
            <span>View current scores, active cards, and table standings</span>
          </div>
          <ChevronRight size={18} className="banker-menu-item-chevron" />
        </button>
        <button
          type="button"
          className="banker-menu-item"
          onClick={() => {
            onClose()
            onOpenRules()
          }}
        >
          <div className="banker-menu-item-icon">
            <CircleHelp size={20} />
          </div>
          <div className="banker-menu-item-text">
            <strong>Rules & Guide</strong>
            <span>Vengeance special cards, modifiers, and action abilities</span>
          </div>
          <ChevronRight size={18} className="banker-menu-item-chevron" />
        </button>
        {!demo && <button type="button" className="banker-menu-item" onClick={() => { onClose(); onOpenHistory() }}>
          <div className="banker-menu-item-icon"><History size={20} /></div>
          <div className="banker-menu-item-text"><strong>Round history</strong><span>Cards and scores by round</span></div>
          <ChevronRight size={18} className="banker-menu-item-chevron" />
        </button>}
        {onRestart && (
          <button
            type="button"
            className="banker-menu-item"
            onClick={() => {
              onClose()
              onRestart()
            }}
          >
            <div className="banker-menu-item-icon">
              <RotateCcw size={20} />
            </div>
            <div className="banker-menu-item-text">
              <strong>Restart</strong>
              <span>Restart the current round or the whole game</span>
            </div>
            <ChevronRight size={18} className="banker-menu-item-chevron" />
          </button>
        )}
        {!demo && tvSharingAvailable() && (
          <button
            type="button"
            className="banker-menu-item"
            onClick={() => {
              onClose()
              onOpenTvShare()
            }}
          >
            <div className="banker-menu-item-icon">
              <Monitor size={20} />
            </div>
            <div className="banker-menu-item-text">
              <strong>Share & connect</strong>
              <span>Invite players, manage seats, or show scores on TV</span>
            </div>
            <ChevronRight size={18} className="banker-menu-item-chevron" />
          </button>
        )}
        <button
          type="button"
          className="banker-menu-item banker-menu-item-danger"
          onClick={() => {
            onClose()
            onExit()
          }}
        >
          <div className="banker-menu-item-icon">
            <LogOut size={20} />
          </div>
          <div className="banker-menu-item-text">
            <strong>{demo ? 'Exit practice table' : 'Exit game'}</strong>
            <span>{demo ? 'Leave practice session and return to app' : 'Return to room details (game stays saved)'}</span>
          </div>
          <ChevronRight size={18} className="banker-menu-item-chevron" />
        </button>
      </div>
    </motion.dialog>
  )
}

function VengeanceCardPickerPanel({
  submitting,
  onClose,
  onSelect,
}: {
  submitting: boolean
  onClose: () => void
  onSelect: (card: VengeanceCard) => void
}) {
  return (
    <motion.section
      className="card-picker physical-card-picker"
      role="dialog"
      aria-modal="true"
      aria-labelledby="vengeance-card-picker-title"
      initial={{ y: 80 }}
      animate={{ y: 0 }}
      exit={{ y: 80 }}
      transition={{ type: 'spring', damping: 26 }}
      onClick={(event) => event.stopPropagation()}
    >
      <div className="physical-picker-header">
        <div className="picker-heading">
          <div>
            <span>PHYSICAL CARD</span>
            <h2 id="vengeance-card-picker-title">What did you flip?</h2>
          </div>
          <button className="close-button" aria-label="Close card picker" title="Close" onClick={onClose}>
            <X size={19} />
          </button>
        </div>
        <p>Select the card in front of you. The app never draws a card for you.</p>
      </div>
      <div className="physical-picker-scroll">
        <div className="picker-grid">
          {vengeanceCards.map((card) => (
            <button
              key={card.id}
              disabled={submitting}
              onClick={() => onSelect(card)}
              aria-label={`Record ${card.label}`}
            >
              <PickerCardArtwork card={card} />
            </button>
          ))}
        </div>
      </div>
    </motion.section>
  )
}

function DemoSetup({ onStart, onExit }: { onStart: (players: PlayerProfile[], targetScore: number, variant?: VVariant) => void; onExit: () => void }) {
  const library = getLibrary()
  const [targetScore, setTargetScore] = useState(library.settings.vengeanceTargetScore || 200)
  const [variant, setVariant] = useState<VVariant>('standard')
  const [brutalWarningOpen, setBrutalWarningOpen] = useState(false)
  const [players, setPlayers] = useState<PlayerProfile[]>([
    { id: 'demo-0', name: 'Player 1', color: demoColors[0], avatar: defaultPlayerAvatarFor('demo-0', 0) },
    { id: 'demo-1', name: 'Player 2', color: demoColors[1], avatar: defaultPlayerAvatarFor('demo-1', 1) },
    { id: 'demo-2', name: 'Player 3', color: demoColors[2], avatar: defaultPlayerAvatarFor('demo-2', 2) },
  ])
  const [name, setName] = useState('')
  const [editingCharacter, setEditingCharacter] = useState<PlayerProfile | null>(null)

  const addPlayer = () => {
    const trimmed = name.trim()
    if (!trimmed || players.length >= 18) return
    const id = `demo-${Date.now()}-${players.length}`
    const nextPlayer: PlayerProfile = {
      id,
      name: trimmed,
      color: demoColors[players.length % demoColors.length],
      avatar: defaultPlayerAvatarFor(id, players.length),
    }
    setPlayers([...players, nextPlayer])
    setName('')
  }

  const removePlayer = (player: PlayerProfile) => {
    if (players.length <= 2) return
    setPlayers(current => current.filter(p => p.id !== player.id))
  }

  const movePlayer = (index: number, delta: number) => {
    const next = index + delta
    if (next < 0 || next >= players.length) return
    const copy = [...players]
    const [moved] = copy.splice(index, 1)
    copy.splice(next, 0, moved)
    setPlayers(copy)
  }

  const saveCharacter = (player: PlayerProfile, avatar: PlayerAvatarId, color: string) => {
    setPlayers(current => current.map(p => p.id === player.id ? { ...p, avatar, color } : p))
  }

  const canStart = players.length >= 2 && players.every((p) => p.name.trim().length > 0)

  return (
    <div className="room-app-shell edition-vengeance">
      <main className="room-app-main page-room">
        <div className="room-back-row">
          <button className="room-back-link" onClick={onExit}>
            <ArrowLeft size={19} /> Back
          </button>
        </div>
        <div style={{ padding: '0 0 20px' }}>
          <span className="eyebrow" style={{ color: '#e83239', fontWeight: 950, fontSize: '10px' }}>
            PRACTICE SESSION
          </span>
          <h1 style={{ margin: '6px 0 8px', fontSize: '28px', color: '#132d67', fontWeight: 950 }}>Practice table</h1>
          <p style={{ fontSize: '12px', color: '#53607a', lineHeight: 1.5, marginBottom: '18px' }}>
            Set up temporary hands to explore cards, modifiers, and action abilities without affecting saved room history.
          </p>

          {/* Player Roster */}
          <div style={{ marginBottom: '14px' }}>
            <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '8px' }}>
              <label style={{ fontSize: '11px', fontWeight: 900, color: '#132d67' }}>
                Who’s at the table? ({players.length}/18)
              </label>
              <span style={{ fontSize: '10px', color: '#6a7285', fontWeight: 700 }}>Min 2 players</span>
            </div>

            <div className="room-roster">
              {players.map((p, i) => (
                <div key={p.id} className="room-roster-row">
                  <span className="room-seat">{String(i + 1).padStart(2, '0')}</span>
                  <button
                    type="button"
                    className="room-roster-avatar-edit"
                    aria-label={`Edit ${p.name}'s character`}
                    title={`Edit ${p.name}'s character`}
                    onClick={() => setEditingCharacter(p)}
                  >
                    <PlayerAvatar player={p} className="room-avatar small" />
                    <Pencil size={13} />
                  </button>
                  <b>{p.name}</b>
                  <div className="room-roster-controls">
                    <button
                      type="button"
                      aria-label={`Move ${p.name} up`}
                      disabled={i === 0}
                      onClick={() => movePlayer(i, -1)}
                    >
                      <ArrowUp size={14} />
                    </button>
                    <button
                      type="button"
                      aria-label={`Move ${p.name} down`}
                      disabled={i === players.length - 1}
                      onClick={() => movePlayer(i, 1)}
                    >
                      <ArrowDown size={14} />
                    </button>
                    <button
                      type="button"
                      className="room-roster-remove"
                      aria-label={`Remove ${p.name} from practice`}
                      title={`Remove ${p.name} from practice`}
                      disabled={players.length <= 2}
                      onClick={() => removePlayer(p)}
                    >
                      <X size={16} />
                    </button>
                  </div>
                </div>
              ))}
            </div>

            {/* Add Player Input */}
            <div className="room-add-player">
              <input
                aria-label="New player name"
                maxLength={24}
                placeholder="Add a player’s name"
                value={name}
                onChange={e => setName(e.target.value)}
                onKeyDown={e => {
                  if (e.key === 'Enter') {
                    e.preventDefault()
                    addPlayer()
                  }
                }}
              />
              <button
                type="button"
                aria-label="Add named player"
                disabled={!name.trim() || players.length >= 18}
                onClick={() => addPlayer()}
              >
                <Plus size={20} />
              </button>
            </div>
          </div>

          {/* Gameplay Style */}
          <div style={{ marginBottom: '14px' }}>
            <label style={{ fontSize: '11px', fontWeight: 900, color: '#132d67', display: 'block', marginBottom: '8px' }}>
              GAMEPLAY STYLE
            </label>
            <div className="room-variant-options">
              <button
                type="button"
                className={variant === 'standard' ? 'selected' : ''}
                aria-pressed={variant === 'standard'}
                onClick={() => setVariant('standard')}
              >
                <strong>Standard</strong>
                <small>Original Vengeance</small>
              </button>
              <button
                type="button"
                className={`brutal-variant-btn ${variant === 'brutal' ? 'selected' : ''}`}
                aria-pressed={variant === 'brutal'}
                onClick={() => {
                  if (variant !== 'brutal') {
                    setBrutalWarningOpen(true)
                  }
                }}
              >
                <strong>Brutal Mode <BrutalSkullIcon size={15} /></strong>
                <small>Sub-zero & penalties</small>
              </button>
            </div>
          </div>

          {/* Bottom Controls: Target Score + Start Practice */}
          <div className="v-demo-bottom-row">
            <div className="v-demo-target-wrap">
              <TargetScorePicker value={targetScore} onChange={setTargetScore} />
            </div>
            <button
              type="button"
              className="v-demo-start-btn"
              disabled={!canStart}
              onClick={() =>
                onStart(
                  players.map((p, i) => ({
                    id: p.id || `demo-${i}`,
                    name: p.name.trim(),
                    color: p.color || demoColors[i % demoColors.length],
                    avatar: p.avatar,
                  })),
                  targetScore,
                  variant
                )
              }
            >
              Start practice match
            </button>
          </div>

          {editingCharacter && (
            <RoomCharacterDialog
              player={editingCharacter}
              onClose={() => setEditingCharacter(null)}
              onSave={(avatar, color) => saveCharacter(editingCharacter, avatar, color)}
            />
          )}

          {brutalWarningOpen && (
            <BrutalWarningModal
              onCancel={() => setBrutalWarningOpen(false)}
              onConfirm={() => {
                setVariant('brutal')
                setBrutalWarningOpen(false)
              }}
            />
          )}
        </div>
      </main>
    </div>
  )
}

export function VengeanceScreen({ roomId, demo = false }: { roomId?: string; demo?: boolean }) {
  const navigate = useAppNavigation()

  useEffect(() => {
    if (getLibrary().settings.edition !== 'vengeance') {
      try {
        updateLibrary((curr) => ({ ...curr, settings: { ...curr.settings, edition: 'vengeance' } }))
      } catch {
        /* silent */
      }
    }
  }, [])

  const library = useLibrary()
  const room = roomId ? library.rooms.find((r) => r.id === roomId && r.edition === 'vengeance') : undefined
  const onlineDevices = useRoomPresence(roomId)
  const [state, setState] = useState<VState | null>(() => room?.vengeanceState ?? null)
  const stateRef = useRef<VState | null>(state)
  const pendingSaveRef = useRef<VState | null>(null)
  const [saveError, setSaveError] = useState('')
  useEffect(() => {
    if (!demo && room?.vengeanceState && !pendingSaveRef.current) { stateRef.current = room.vengeanceState; setState(room.vengeanceState) }
  }, [demo, room?.vengeanceState])
  useEffect(() => { if (roomId) blockSharedHost(roomId, Boolean(saveError)); return () => { if (roomId) blockSharedHost(roomId, false) } }, [roomId, saveError])

  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerSessionRef = useRef(0)
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null)
  const [editingCardInstanceId, setEditingCardInstanceId] = useState<string | null>(null)
  const [organizedPlayers, setOrganizedPlayers] = useState<Record<string, boolean>>({})
  const [showMenu, setShowMenu] = useState(false)
  const [playersOpen, setPlayersOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [roundSummaryOpen, setRoundSummaryOpen] = useState(false)
  const [restartOpen, setRestartOpen] = useState(false)
  const [newGamePromptOpen, setNewGamePromptOpen] = useState(false)
  const [resultsShareOpen, setResultsShareOpen] = useState(false)
  const [tvOpen, setTvOpen] = useState(false)

  const playerTabRefs = useRef<Record<string, HTMLButtonElement | null>>({})

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const openPicker = () => {
    pickerSessionRef.current += 1
    setSelectedCardIndex(null)
    setEditingCardInstanceId(null)
    setPickerOpen(true)
  }

  const exit = useCallback(() => navigate(roomId ? `/room?id=${roomId}` : '/landing', { replace: true }), [navigate, roomId])

  useNavigationGuard(
    demo && state || saveError
      ? {
        title: demo ? 'Leave practice table?' : 'Leave with an unsaved action?',
        message: demo ? 'Temporary hands and scores will be cleared.' : 'Retry saving the last action before leaving.',
        shouldBlock: () => true,
        confirmLabel: 'Leave table',
        edition: 'vengeance',
      }
      : null
  )

  const persist = useCallback(
    (next: VState) => {
      if (demo) {
        stateRef.current = next
        setState(next)
        return
      }
      if (!roomId) return
      try {
        saveVengeanceState(roomId, next)
        blockSharedHost(roomId, false)
        stateRef.current = next
        pendingSaveRef.current = null
        setState(next)
        setSaveError('')
      } catch (error) {
        blockSharedHost(roomId, true)
        pendingSaveRef.current = next
        setSaveError(`${(error as Error).message} Retry before continuing.`)
      }
    },
    [demo, roomId]
  )

  const dispatch = useCallback(
    (action: VAction) => {
      if (!stateRef.current || pendingSaveRef.current) return
      const current = !demo && roomId ? getLibrary().rooms.find(r => r.id === roomId)?.vengeanceState ?? stateRef.current : stateRef.current
      const next = vengeanceReducer(current, action)
      if (next !== current) persist(next)
    },
    [persist]
  )

  const selected = state ? state.players.find((p) => p.id === state.selectedPlayerId) ?? state.players[0] : null
  const forcedTurn = state?.forced[0] ?? null
  const turnPlayerId = forcedTurn?.targetId ?? (state?.phase === 'deal' || state?.phase === 'turn' ? state.turnPlayerId : null)
  const drawing = state ? state.players.find((p) => p.id === turnPlayerId) : null
  const pending = state ? vengeancePending(state) : null
  const pendingKey = state ? vengeancePendingKey(state) : null
  const [readyPendingKey, setReadyPendingKey] = useState<string | null>(null)
  useEffect(() => {
    const timer = window.setTimeout(() => setReadyPendingKey(pendingKey), 300)
    return () => window.clearTimeout(timer)
  }, [pendingKey])
  const pendingReady = pendingKey !== null && readyPendingKey === pendingKey
  const dispatchPending = (action: VAction) => {
    if (!pendingKey || (action.type !== 'cancel-pending' && !pendingReady)) return
    dispatch({ ...action, expectedPendingKey: pendingKey })
  }
  const eligibleActors = state ? vengeanceEligibleActors(state) : []
  const eligibleCards = state ? vengeanceEligibleCards(state) : []

  const needsCards = pending?.card.id === 'v-action-steal' || pending?.card.id === 'v-action-swap' || pending?.card.id === 'v-action-discard'
  const selectedCount = pending?.card.id === 'v-action-swap' ? 2 : 1
  const readyToConfirm = pending && (pending.card.kind === 'modifier' ? Boolean(pending.targetId) : Boolean(pending.actorId && (!needsCards || pending.selectedCards.length === selectedCount)))

  const canRecord = (state?.phase === 'deal' || state?.phase === 'turn') && !pending && Boolean(drawing) && !saveError

  // Auto-scroll non-busted player tab into view
  useEffect(() => {
    if (!turnPlayerId) return
    playerTabRefs.current[turnPlayerId]?.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' })
  }, [turnPlayerId])

  // Open round summary modal automatically upon entering settlement
  useEffect(() => {
    if (state?.phase === 'settlement') setRoundSummaryOpen(true)
    else setRoundSummaryOpen(false)
  }, [state?.phase])

  // Reset player organize states on new round
  useEffect(() => {
    setOrganizedPlayers({})
  }, [state?.roundNumber])

  if (!state) {
    return demo ? (
      <DemoSetup
        onExit={exit}
        onStart={(players, target, variant = 'standard') => {
          const next = vengeanceInitialState(players, target, undefined, variant)
          stateRef.current = next
          setState(next)
        }}
      />
    ) : (
      <div className="room-app-shell">
        <main className="room-app-main">
          <h1>{room ? 'This room is ready to start.' : 'This room is unavailable.'}</h1>
          <button className="room-button" onClick={exit}>
            Back to rooms
          </button>
        </main>
      </div>
    )
  }

  if (state.phase === 'results') {
    return (
      <div className="app-shell banker-shell saved-room-game edition-vengeance">
        <aside className="desktop-marquee left">
          <div>WITH A<br />VENGEANCE</div>
        </aside>
        <main className="game-shell">
          <header className="topbar banker-topbar banker-results-topbar">
            <button type="button" className="banker-results-back" onClick={exit}>
              <ArrowLeft size={18} /> {demo ? 'Exit practice' : 'Back to room'}
            </button>
            <button type="button" className="brand-button banker-results-share" aria-label="Share game results" title="Share game results" onClick={() => setResultsShareOpen(true)}>
              <Share2 size={18} />
            </button>
          </header>
          <VengeanceResults
            players={state.players}
            history={state.history}
            targetScore={state.targetScore}
            onNewGame={() => setNewGamePromptOpen(true)}
            onExit={exit}
          />
          {resultsShareOpen && (
            <ResultsShareDialog
              roomName={room?.name ?? 'Practice Match'}
              players={state.players}
              history={state.history}
              targetScore={state.targetScore}
              edition="vengeance"
              variant={state.variant}
              onClose={() => setResultsShareOpen(false)}
            />
          )}
          {newGamePromptOpen && (
            <ConfirmationModal
              edition="vengeance"
              eyebrow="NEW VENGEANCE GAME"
              title="Start a new game?"
              message={demo ? "Start a fresh practice match with these players." : "Your completed match stays saved in room history."}
              cancelLabel="Keep results"
              confirmLabel="New game"
              onCancel={() => setNewGamePromptOpen(false)}
              onConfirm={() => {
                setNewGamePromptOpen(false)
                const next = vengeanceInitialState(state.players, state.targetScore, undefined, state.variant)
                persist(next)
              }}
            />
          )}
        </main>
        <aside className="desktop-marquee right">
          <div>NO ONE'S<br />SAFE!</div>
        </aside>
      </div>
    )
  }

  const selectCardForTable = (card: VengeanceCard) => {
    const editInstanceId = editingCardInstanceId
    setPickerOpen(false)
    setSelectedCardIndex(null)
    setEditingCardInstanceId(null)
    if (editInstanceId && selected) {
      dispatch({
        type: 'replace-card',
        playerId: selected.id,
        instanceId: editInstanceId,
        cardId: card.id,
      })
    } else {
      dispatch({ type: 'record', cardId: card.id })
    }
  }

  const isCurrentOrganized = Boolean(selected && organizedPlayers[selected.id])

  const toggleOrganize = () => {
    if (!selected) return
    setOrganizedPlayers((prev) => ({
      ...prev,
      [selected.id]: !prev[selected.id],
    }))
  }

  const tableEntries = selected ? vengeanceTableEntries(state, selected.id) : []
  const displayedEntries: VTableEntry[] = selected && isCurrentOrganized
    ? [...organizeVengeanceEntries(selected.entries), ...tableEntries.filter(entry => entry.resolution)]
    : tableEntries

  const tableCards: Card[] = displayedEntries.map((e) => e.card)
  const tableCardIds: string[] = displayedEntries.map((e) => e.instanceId)
  const selectedScore = selected ? vengeanceScore(selected, state.variant, state.flipSevenChoice) : 0
  const isSelectedTurn = selected?.id === turnPlayerId
  const interactionLocked = pickerOpen || Boolean(pending) || roundSummaryOpen || Boolean(saveError)
  const hasZero = Boolean(selected?.entries.some((e) => !e.voided && e.card.id === 'v-number-zero'))
  const canStay =
    state.phase === 'turn' &&
    isSelectedTurn &&
    !forcedTurn &&
    !hasZero &&
    selected?.status === 'active' &&
    !pending

  let stayActionLabel = 'STAY / BANK'
  let stayActionClass = ''

  if (selected?.status === 'busted') {
    stayActionLabel = 'BUST!'
    stayActionClass = 'confirmed bust-state'
  } else if (selected?.status === 'frozen') {
    stayActionLabel = 'FROZEN'
    stayActionClass = 'confirmed frozen-state'
  } else if (selected?.status === 'flip-seven') {
    stayActionLabel = 'FLIP 7!'
    stayActionClass = 'confirmed'
  } else if (selected?.status === 'stayed') {
    stayActionLabel = 'STAYED'
    stayActionClass = 'confirmed'
  }

  return (
    <div className={`app-shell ${demo ? 'demo-shell' : 'banker-shell saved-room-game'} edition-vengeance`}>
      <aside className="desktop-marquee left">
        <div>WITH A<br />VENGEANCE</div>
      </aside>
      <main className="game-shell">
        {demo ? (
          <header className="topbar demo-topbar">
            <button className="brand-button" aria-label="Exit practice table" onClick={exit}>
              <img className="brand-logo" src="/assets/flip7-vengeance-logo.webp" alt="Flip 7 With a Vengeance" />
            </button>
            <button className="account-pill exit-button" onClick={exit}>
              <LogOut size={15} /> Exit
            </button>
          </header>
        ) : (
          <header className="topbar banker-topbar">
            <RoomSharingButton roomId={roomId} onClick={() => setTvOpen(true)} />
            <span className="game-topbar-brand">
              <img src="/assets/flip7-vengeance-logo.webp" alt="Flip 7 With a Vengeance" />
            </span>
            <button
              className="brand-button menu-button"
              aria-label="Open game menu"
              title="Menu"
              onClick={() => setShowMenu(true)}
            >
              <Menu size={20} />
            </button>
          </header>
        )}

        {saveError && (
          <div className="room-game-save-error" role="alert">
            <span>{saveError}</span>
            <button onClick={() => pendingSaveRef.current && persist(pendingSaveRef.current)}>
              Retry save
            </button>
          </div>
        )}

        <section className="match-strip">
          <div>
            <span>ROUND</span>
            <b>{String(state.roundNumber).padStart(2, '0')}</b>
          </div>
          <div className="target">
            <span>{demo ? 'PRACTICE TO' : 'FIRST TO'}</span>
            <b>{state.targetScore}</b>
          </div>
          <div>
            <span>VIEWING</span>
            <b>{selected?.name || '—'}</b>
          </div>
          {state.variant === 'brutal' && (
            <div className="v-match-strip-brutal" aria-label="Brutal Mode">
              <BrutalSkullIcon size={11} />
              <em>BRUTAL MODE</em>
            </div>
          )}
        </section>

        <div className="banker-turn-callout" role="status">
          <span>CURRENT TURN</span>
          <b>{drawing?.name || '—'}</b>
        </div>

        {forcedTurn && forcedTurn.remaining > 0 && <ForcedDrawStatus label={forcedTurn.kind === 'four' ? 'Flip Four' : 'Just One More'} remaining={forcedTurn.remaining} total={forcedTurn.kind === 'four' ? 4 : 1} />}

        <section className="banker-player-strip vengeance-player-strip" aria-label="Player tables">
          {state.players.map((player) => (
            <button
              key={player.id}
              ref={(el) => {
                playerTabRefs.current[player.id] = el
              }}
              className={`banker-player-tab opponent ${player.id === selected?.id ? 'selected' : ''} ${player.id === turnPlayerId ? 'turn' : ''
                } ${statusClass(player)}`}
              aria-current={player.id === turnPlayerId ? 'step' : undefined}
              onClick={() => {
                dispatch({ type: 'select-player', playerId: player.id })
                setSelectedCardIndex(null)
              }}
            >
              <PlayerAvatar player={player} className="mini-avatar" />
              <span className="opponent-copy">
                <b>{player.name}<SeatConnectionBadge status={seatConnection(room, player.id, onlineDevices)} compact /></b>
                <span>{playerTabSummary(player, state.variant, state.flipSevenChoice)}</span>
              </span>
              <strong>
                <small>Total pts:</small> <b className={player.totalScore < 0 ? 'score-negative' : ''}>{player.totalScore}</b>
              </strong>
            </button>
          ))}
        </section>

        <GameTable
          table={tableCards}
          tableCardIds={tableCardIds}
          isVoidedCard={(index) => Boolean(displayedEntries[index]?.voided)}
          cardResolution={(index) => displayedEntries[index]?.resolution}
          score={selectedScore}
          flipSevenBonus={selected?.status === 'flip-seven' ? (state.variant === 'brutal' ? (state.flipSevenChoice?.choice === 'self' ? 15 : 0) : 15) : 0}
          busted={selected?.status === 'busted'}
          frozen={selected?.status === 'frozen'}
          submitting={false}
          interactionLocked={interactionLocked}
          canEditCards={canRecord}
          canAddCards={canRecord && isSelectedTurn}
          canDrawWhileStayed={Boolean(forcedTurn && forcedTurn.remaining > 0 && isSelectedTurn)}
          confirmedAt={selected?.status === 'stayed' ? 'stayed' : selected?.status === 'frozen' ? 'frozen' : null}
          isStaying={selected?.status === 'stayed' || selected?.status === 'frozen'}
          isOrganized={isCurrentOrganized}
          playerName={selected?.name ?? 'Player'}
          isHost={false}
          onOrganize={toggleOrganize}
          onOpenPicker={() => {
            if (!interactionLocked && canRecord) openPicker()
          }}
          onSelectCard={(index) => {
            if (!interactionLocked) setSelectedCardIndex(index)
          }}
        />

        <section className="actions">
          {state.phase === 'settlement' && (
            <button
              className="next-round-button"
              disabled={Boolean(saveError)}
              onClick={() => dispatch({ type: 'advance-round' })}
            >
              <Check size={17} /> Confirm round scores
            </button>
          )}
          <button
            className="secondary-action"
            disabled={!state.past.length || Boolean(saveError)}
            onClick={() => dispatch({ type: 'undo' })}
          >
            <Undo2 size={19} /> Undo
          </button>
          <button
            className={`stay-action ${stayActionClass}`}
            disabled={!canStay || Boolean(saveError)}
            onClick={() => dispatch({ type: 'stay' })}
          >
            {stayActionLabel}
          </button>
          <button
            className="secondary-action redo-action"
            disabled={!state.future.length || Boolean(saveError)}
            onClick={() => dispatch({ type: 'redo' })}
          >
            <Redo2 size={19} /> Redo
          </button>
        </section>
      </main>
      <aside className="desktop-marquee right">
        <div>NO ONE'S<br />SAFE!</div>
      </aside>

      <AnimatePresence>
        {/* Physical Card Picker Dialog */}
        {pickerOpen && (
          <motion.div
            key={`vengeance-picker-${pickerSessionRef.current}`}
            className="picker-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            onClick={() => setPickerOpen(false)}
          >
            <VengeanceCardPickerPanel
              submitting={false}
              onClose={() => {
                setPickerOpen(false)
                setEditingCardInstanceId(null)
              }}
              onSelect={selectCardForTable}
            />
          </motion.div>
        )}

        {/* Card Focus / Action Panel on Card Tap */}
        {selectedCardIndex !== null && displayedEntries[selectedCardIndex] && (
          <motion.div
            key="card-actions-modal"
            className="picker-backdrop card-focus-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            onClick={() => setSelectedCardIndex(null)}
          >
            <motion.section
              className="card-picker card-actions-panel card-focus-panel"
              initial={{ scale: 0.86, y: 40, opacity: 0 }}
              animate={{ scale: 1, y: 0, opacity: 1 }}
              exit={{ scale: 0.9, y: 40, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 330, damping: 25 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="picker-heading">
                <div>
                  <span>{displayedEntries[selectedCardIndex].voided ? 'DISCARDED CARD' : 'MY CARD'}</span>
                  <h2>{displayedEntries[selectedCardIndex].card.label}</h2>
                </div>
                <button
                  className="close-button"
                  aria-label="Close card actions"
                  title="Close"
                  onClick={() => setSelectedCardIndex(null)}
                >
                  <X size={19} />
                </button>
              </div>
              <motion.div
                className="card-focus-art"
                initial={{ scale: 0.45, y: 100, rotate: -8, opacity: 0 }}
                animate={{ scale: 1, y: 0, rotate: 0, opacity: 1 }}
                transition={{ type: 'spring', stiffness: 300, damping: 20, delay: 0.04 }}
              >
                <CardArtwork card={displayedEntries[selectedCardIndex].card} />
              </motion.div>
              <p>
                {displayedEntries[selectedCardIndex].voided
                  ? 'This card was discarded. Edit to correct a misclick or remove it from the table.'
                  : 'Edit this card or remove it while your round is still active.'}
              </p>
              <div className="card-action-buttons">
                <button
                  type="button"
                  className="secondary-action"
                  onClick={() => {
                    const entry = displayedEntries[selectedCardIndex]
                    if (entry) {
                      setEditingCardInstanceId(entry.instanceId)
                      setSelectedCardIndex(null)
                      pickerSessionRef.current += 1
                      setPickerOpen(true)
                    }
                  }}
                >
                  Edit card
                </button>
                <button
                  type="button"
                  className="danger-action"
                  onClick={() => {
                    const entry = displayedEntries[selectedCardIndex]
                    if (entry && selected) {
                      dispatch({
                        type: 'remove-card',
                        playerId: selected.id,
                        instanceId: entry.instanceId,
                      })
                      setSelectedCardIndex(null)
                    }
                  }}
                >
                  Remove card
                </button>
              </div>
            </motion.section>
          </motion.div>
        )}

        {/* Action Card Resolution Dialog */}
        {pending && (
          <motion.div
            key={`action-resolution-${pendingKey}`}
            className="picker-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            onClick={() => dispatchPending({ type: 'cancel-pending' })}
          >
            <motion.section
              className="card-picker physical-card-picker vengeance-action-modal"
              role="dialog"
              aria-modal="true"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              exit={{ y: 50, opacity: 0 }}
              transition={{ type: 'spring', stiffness: 450, damping: 32 }}
              onClick={(e) => e.stopPropagation()}
            >
              {(() => {
                const isSwap = pending.card.id === 'v-action-swap'
                const isSteal = pending.card.id === 'v-action-steal'
                const isDiscard = pending.card.id === 'v-action-discard'
                const isModifier = pending.card.kind === 'modifier'
                const isForced = pending.card.id === 'v-action-just-one-more' || pending.card.id === 'v-action-flip-four'
                const actor = state.players.find((p) => p.id === pending.actorId)
                const target = state.players.find((p) => p.id === pending.targetId)

                const selectedFaces = pending.selectedCards
                  .map((id) => {
                    for (const p of state.players) {
                      const entry = p.entries.find((e) => e.instanceId === id)
                      if (entry) return { player: p, entry }
                    }
                    return null
                  })
                  .filter(Boolean) as { player: VPlayer; entry: VEntry }[]

                let eyebrow = 'ACTION CARD'
                if (isModifier) eyebrow = 'PENALTY MODIFIER'
                else if (isSteal) eyebrow = 'ACTION · STEAL'
                else if (isSwap) eyebrow = 'ACTION · SWAP'
                else if (isDiscard) eyebrow = 'ACTION · DISCARD'
                else if (isForced) eyebrow = `ACTION · ${pending.card.label.toUpperCase()}`

                let title = `Who gets ${pending.card.label}?`
                if (isSteal && pending.actorId) {
                  title = 'Choose a card to steal'
                } else if (isSwap && pending.actorId) {
                  title = 'Choose two cards to swap'
                } else if (isDiscard && pending.actorId) {
                  title = 'Choose a card to discard'
                } else if (isForced && pending.actorId) {
                  title = `${actor?.name} flips ${pending.card.id === 'v-action-flip-four' ? 'four cards' : 'one card'}`
                }

                let subtitle = `Choose which non-busted player table receives this ${pending.card.label} action.`
                if (isModifier) {
                  subtitle = state.variant === 'brutal' ? 'Choose any player, including stayed or busted players.' : 'Choose any non-busted player, including players who stayed.'
                } else if (isForced) {
                  subtitle = pending.actorId
                    ? pending.card.id === 'v-action-just-one-more' ? `${actor?.name} flips once, resolves any effect, then stays unless they bust or reach Flip 7.` : `${actor?.name} flips up to four cards. A player who already stayed remains stayed afterward.`
                    : `Choose which non-busted player table resolves this ${pending.card.label} action.`
                } else if (isSteal) {
                  subtitle = pending.actorId
                    ? `Select 1 card from a non-busted opponent's table to steal into ${actor?.name}'s hand.`
                    : `Choose which non-busted player gets Steal to take a card.`
                } else if (isSwap) {
                  subtitle = pending.actorId
                    ? 'Choose one face-up card from each of two players who have not busted. You may include your own hand and stayed hands.'
                    : `Choose which non-busted player gets Swap to exchange cards.`
                } else if (isDiscard) {
                  subtitle = pending.actorId
                    ? 'Choose any face-up Number or Modifier card to discard, including your own card or one from a player who stayed.'
                    : `Choose which non-busted player gets Discard to remove a card.`
                }

                return (
                  <>
                    <div className="physical-picker-header">
                      <div className="picker-heading">
                        <div>
                          <span>{eyebrow}</span>
                          <h2>{title}</h2>
                        </div>
                        <button
                          className="close-button"
                          aria-label="Cancel action"
                          title="Cancel"
                          onClick={() => dispatchPending({ type: 'cancel-pending' })}
                        >
                          <X size={19} />
                        </button>
                      </div>
                      <p>{subtitle}</p>
                      {state.resolving.length > 0 && <p className="v-queue-context">Resolve {pending.card.label} now · {state.resolving.length} more queued</p>}

                      {/* Swap Stepper Status Tracker inside Header */}
                      {isSwap && (
                        <div className="v-swap-stepper">
                          <div className={`v-swap-slot ${selectedFaces[0] ? 'filled' : 'empty'}`}>
                            <span className="v-swap-slot-label">Card 1</span>
                            <b>{selectedFaces[0] ? `${selectedFaces[0].entry.card.label} (${selectedFaces[0].player.name})` : 'Tap 1st card'}</b>
                          </div>
                          <ArrowRightLeft size={16} className="v-swap-icon" />
                          <div className={`v-swap-slot ${selectedFaces[1] ? 'filled' : 'empty'}`}>
                            <span className="v-swap-slot-label">Card 2</span>
                            <b>{selectedFaces[1] ? `${selectedFaces[1].entry.card.label} (${selectedFaces[1].player.name})` : 'Tap 2nd card'}</b>
                          </div>
                        </div>
                      )}
                    </div>

                    <div className={`physical-picker-scroll v-action-scroll ${needsCards || isModifier ? 'has-floating-btn' : ''}`}>
                      {/* Step 1: Choose Actor (for actions) or Target (for modifiers) */}
                      {((!needsCards && !pending.actorId && !isModifier) || isModifier) && (
                        <div className="target-list banker-target-list v-action-actor-list">
                          {eligibleActors.map((player) => (
                            <button
                              key={player.id}
                              type="button"
                              className={`v-actor-select-btn ${isModifier && pending.targetId === player.id ? 'v-target-selected' : ''}`}
                              disabled={!pendingReady || Boolean(saveError)}
                              aria-pressed={isModifier ? pending.targetId === player.id : undefined}
                              onClick={() =>
                                dispatchPending(isModifier
                                  ? { type: 'choose-target', playerId: player.id, preview: true }
                                  : { type: 'choose-actor', playerId: player.id })
                              }
                            >
                              <PlayerAvatar player={player} className="mini-avatar" />
                              <span className="v-actor-btn-name">
                                <b>{player.name}</b>
                                {player.id === state.turnPlayerId && <span className="v-current-tag">Current Turn</span>}
                                {player.status === 'stayed' && <span className="v-stayed-tag">Stayed</span>}
                                {player.status === 'frozen' && <span className="v-frozen-tag">Frozen</span>}
                                {player.status === 'busted' && <span className="v-busted-tag">Busted (Vulnerable)</span>}
                              </span>
                            </button>
                          ))}
                          {eligibleActors.length === 0 && (
                            <p className="banker-muted">There are no eligible player tables available.</p>
                          )}
                        </div>
                      )}

                      {/* Face-up Cards per Player Table in Fan-Style Stacking */}
                      {needsCards && pending.actorId && (
                        <div className="v-fan-players-list">
                          {state.players
                            .filter((player) => ['active', 'stayed', 'frozen'].includes(player.status))
                            .map((player) => {
                              const isActorHand = player.id === pending.actorId
                              const cannotStealHere = isSteal && isActorHand
                              const numberCardCount = player.entries.filter(
                                (e) => !e.voided && e.card.kind === 'number'
                              ).length
                              const cardRows = Array.from(
                                { length: Math.ceil(player.entries.length / 5) },
                                (_, rowIndex) => player.entries.slice(rowIndex * 5, rowIndex * 5 + 5)
                              )

                              return (
                                <div
                                  key={player.id}
                                  className={`v-fan-player-section ${cannotStealHere ? 'actor-hand' : ''}`}
                                >
                                  <div className="v-player-header">
                                    <div className="v-player-meta">
                                      <PlayerAvatar player={player} className="mini-avatar" />
                                      <h4>{player.name}</h4>
                                    </div>
                                    <div className="v-player-tags">
                                      {cannotStealHere && (
                                        <span className="v-role-badge actor">Recipient Table</span>
                                      )}
                                      {player.status === 'stayed' && (
                                        <span className="v-role-badge stayed">Stayed</span>
                                      )}
                                      {player.status === 'frozen' && (
                                        <span className="v-role-badge frozen">Frozen</span>
                                      )}
                                      <span className="v-role-badge count">
                                        {numberCardCount} card{numberCardCount === 1 ? '' : 's'}
                                      </span>
                                    </div>
                                  </div>

                                  {player.entries.length === 0 ? (
                                    <div className="v-empty-hand">No cards on table</div>
                                  ) : cannotStealHere ? (
                                    <div className="v-actor-hand-note">
                                      Stolen cards will go into this hand (cannot steal from yourself)
                                    </div>
                                  ) : (
                                    <div className="v-card-fan-container">
                                      {cardRows.map((row, rowIndex) => (
                                        <div
                                          key={`fan-row-${rowIndex}`}
                                          className={`v-card-fan-row cards-${row.length}`}
                                        >
                                          {row.map((entry) => {
                                            const isChosen = pending.selectedCards.includes(entry.instanceId)
                                            const chosenIndex = pending.selectedCards.indexOf(entry.instanceId)
                                            const isEligible = eligibleCards.some(
                                              (c) => c.entry.instanceId === entry.instanceId
                                            )
                                            return (
                                              <button
                                                key={entry.instanceId}
                                                type="button"
                                                className={`v-fan-card ${isChosen ? 'chosen' : ''} ${!isEligible ? 'ineligible' : ''}`}
                                                disabled={!isEligible || !pendingReady || Boolean(saveError)}
                                                onClick={() =>
                                                  dispatchPending({ type: 'choose-card', instanceId: entry.instanceId })
                                                }
                                                aria-label={`${entry.card.label} from ${player.name}`}
                                              >
                                                <PickerCardArtwork card={entry.card} />
                                                {isChosen && (
                                                  <span className="v-chosen-badge">
                                                    {isSwap ? `CARD ${chosenIndex + 1}` : isSteal ? 'STEAL' : 'DISCARD'}
                                                  </span>
                                                )}
                                              </button>
                                            )
                                          })}
                                        </div>
                                      ))}
                                    </div>
                                  )}
                                </div>
                              )
                            })}
                        </div>
                      )}
                    </div>

                    {isModifier && (
                      <div className="v-floating-confirm">
                        <button type="button" className="v-confirm-btn modifier" disabled={!readyToConfirm || !pendingReady || Boolean(saveError)} onClick={() => dispatchPending({ type: 'confirm' })}>
                          {target ? `Give ${pending.card.label} to ${target.name}` : 'Choose a player'}
                        </button>
                      </div>
                    )}

                    {/* Floating Confirmation Buttons for Steal, Swap, Discard */}
                    {isSteal && pending.actorId && selectedFaces[0] && (
                      <div className="v-floating-confirm">
                        <button
                          type="button"
                          className="v-confirm-btn steal"
                          disabled={!pendingReady || Boolean(saveError)}
                          onClick={() => dispatchPending({ type: 'confirm' })}
                        >
                          Confirm Steal
                        </button>
                      </div>
                    )}

                    {isSwap && pending.actorId && selectedFaces.length === 2 && (
                      <div className="v-floating-confirm">
                        <button
                          type="button"
                          className="v-confirm-btn swap"
                          disabled={!pendingReady || Boolean(saveError)}
                          onClick={() => dispatchPending({ type: 'confirm' })}
                        >
                          Confirm Swap
                        </button>
                      </div>
                    )}

                    {isDiscard && pending.actorId && selectedFaces[0] && (
                      <div className="v-floating-confirm">
                        <button
                          type="button"
                          className="v-confirm-btn discard"
                          disabled={!pendingReady || Boolean(saveError)}
                          onClick={() => dispatchPending({ type: 'confirm' })}
                        >
                          Confirm Discard
                        </button>
                      </div>
                    )}
                  </>
                )
              })()}
            </motion.section>
          </motion.div>
        )}

        {/* Brutal Flip 7 Choice Dialog */}
        {state.pendingFlipSeven && (
          <BrutalFlipSevenModal
            finisher={state.players.find((p) => p.id === state.pendingFlipSeven?.finisherId) ?? state.players[0]}
            players={state.players}
            onResolveSelf={() => dispatch({ type: 'resolve-flip-seven', choice: 'self' })}
            onResolvePenalize={(targetId) => dispatch({ type: 'resolve-flip-seven', choice: 'penalize', targetPlayerId: targetId })}
          />
        )}

        {/* Round Summary Settlement Dialog */}
        {roundSummaryOpen && !state.pendingFlipSeven && (
          <motion.div
            key="round-summary-backdrop"
            className="picker-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
          >
            <motion.section
              className="card-picker banker-summary"
              initial={{ y: 50, opacity: 0 }}
              animate={{ y: 0, opacity: 1 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="picker-heading">
                <div>
                  <span>ROUND {String(state.roundNumber).padStart(2, '0')} COMPLETE</span>
                  <h2>Everyone is settled.</h2>
                </div>
                <button
                  className="close-button"
                  aria-label="Close round summary"
                  onClick={() => setRoundSummaryOpen(false)}
                >
                  <X size={19} />
                </button>
              </div>
              <div className="banker-round-summary-list">
                {state.players.map((player) => {
                  const score = vengeanceScore(player, state.variant, state.flipSevenChoice)
                  return (
                    <div className={`banker-summary-player ${statusClass(player, state.flipSevenChoice)}`} key={player.id}>
                      <PlayerAvatar player={player} className="mini-avatar" />
                      <div className="banker-summary-player-copy">
                        <b>{player.name}</b>
                        <span className={`banker-status-pill ${statusClass(player, state.flipSevenChoice)}`}>
                          {statusBadgeLabel(player, state.flipSevenChoice)}
                        </span>
                        {state.flipSevenChoice?.choice === 'self' && player.id === state.flipSevenChoice.finisherId && (
                          <span className="v-flipseven-summary-badge bonus">+15 FLIP 7</span>
                        )}
                        {state.flipSevenChoice?.choice === 'penalize' && player.id === state.flipSevenChoice.targetId && (
                          <span className="v-flipseven-summary-badge penalty">-15 FLIP 7 PENALTY</span>
                        )}
                      </div>
                      <div className="banker-summary-score">
                        <small>ROUND</small>
                        <strong className={score < 0 ? 'score-negative' : ''}>{score}</strong>
                      </div>
                    </div>
                  )
                })}
              </div>
              <p>Confirm these scores to finish the match or start the next round.</p>
              <div className="banker-results-actions">
                <button
                  className="primary-wide"
                  disabled={Boolean(saveError) || Boolean(state.pendingFlipSeven)}
                  onClick={() => {
                    setRoundSummaryOpen(false)
                    dispatch({ type: 'advance-round' })
                  }}
                >
                  <Check size={16} /> Confirm scores
                </button>
              </div>
            </motion.section>
          </motion.div>
        )}

        {/* Players Overview Dialog */}
        {playersOpen && (
          <motion.div
            key="players-dialog-backdrop"
            className="picker-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            onClick={() => setPlayersOpen(false)}
          >
            <motion.section
              className="card-picker info-panel"
              initial={{ y: 80 }}
              animate={{ y: 0 }}
              exit={{ y: 80 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="info-panel-header">
                <div className="picker-heading">
                  <div>
                    <span>AT THIS TABLE</span>
                    <h2>Players</h2>
                  </div>
                  <div className="panel-heading-actions">
                    <b className="panel-count">{state.players.length} players</b>
                    <button
                      className="close-button"
                      aria-label="Close players"
                      title="Close"
                      onClick={() => setPlayersOpen(false)}
                    >
                      <X size={19} />
                    </button>
                  </div>
                </div>
              </div>
              <div className="info-panel-scroll">
                <div className="info-list">
                  {state.players.map((player) => {
                    const score = vengeanceScore(player, state.variant, state.flipSevenChoice)
                    return (
                      <div
                        className={`info-player ${player.id === turnPlayerId ? 'current-player' : ''}`}
                        key={player.id}
                      >
                        <PlayerAvatar player={player} className="mini-avatar" />
                        <div>
                          <b>
                            {player.name}
                            {player.id === turnPlayerId ? ' (current)' : ''}
                          </b>
                          <small>{playerTabSummary(player, state.variant, state.flipSevenChoice)}</small>
                          <SeatConnectionBadge status={seatConnection(room, player.id, onlineDevices)} />
                        </div>
                        <span className="info-player-scores">
                          <span>
                            <small>ROUND</small>
                            <strong className={score < 0 ? 'score-negative' : ''}>{score}</strong>
                          </span>
                          <span>
                            <small>TOTAL</small>
                            <strong className={player.totalScore < 0 ? 'score-negative' : ''}>{player.totalScore}</strong>
                          </span>
                        </span>
                      </div>
                    )
                  })}
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}

        {/* Rules & Guide Dialog */}
        {rulesOpen && (
          <motion.div
            key="rules-dialog-backdrop"
            className="picker-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            onClick={() => setRulesOpen(false)}
          >
            <motion.section
              className="card-picker info-panel"
              initial={{ y: 50 }}
              animate={{ y: 0 }}
              onClick={(e) => e.stopPropagation()}
            >
              <div className="info-panel-header">
                <div className="picker-heading">
                  <div>
                    <span>VENGEANCE RULES</span>
                    <h2>How it works</h2>
                  </div>
                  <button
                    className="close-button"
                    aria-label="Close rules"
                    onClick={() => setRulesOpen(false)}
                  >
                    <X size={19} />
                  </button>
                </div>
              </div>
              <div className="info-panel-scroll">
                <div className="rules-copy">
                  <section>
                    <h3>Initial Deal & Turns</h3>
                    <p>
                      Each player receives one face-up card in table order. The starting seat moves one position each round. Then players take turns hitting or staying until everyone busts or banks.
                    </p>
                  </section>
                  <section>
                    <h3>The Zero</h3>
                    <p>
                      Holding The Zero resets the round score to 0 and forbids staying until you draw 7 unique numbers or swap/discard it!
                    </p>
                  </section>
                  <section>
                    <h3>Unlucky 7 & Lucky 13</h3>
                    <p>
                      Unlucky 7 discards all previous numbers and modifiers from your hand. Lucky 13 allows holding up to two 13s before busting.
                    </p>
                  </section>
                  <section>
                    <h3>Action & Modifier Cards</h3>
                    <p>
                      {state.variant === 'brutal'
                        ? 'Modifiers (÷2, −2, −4, −6, −8, −10) can target any player, even busted ones. Action cards (Steal, Swap, Discard, Just One More, Flip Four) let you attack or force flips!'
                        : 'Modifiers (÷2, −2, −4, −6, −8, −10) apply penalties to any non-busted player. Action cards (Steal, Swap, Discard, Just One More, Flip Four) let you attack or force flips!'}
                    </p>
                  </section>
                  {state.variant === 'brutal' && (
                    <>
                      <section>
                        <h3>Brutal: Sub-Zero Scoring</h3>
                        <p>
                          Round scores and match totals have no floor and can drop below 0 (e.g. −8 PTS).
                        </p>
                      </section>
                      <section>
                        <h3>Brutal: Attack Busted Players</h3>
                        <p>
                          You may give Modifier cards to any player, even if they have busted. ÷2 has no effect on a busted player and is discarded.
                        </p>
                      </section>
                      <section>
                        <h3>Brutal: Flip 7 Choice</h3>
                        <p>
                          When you reach Flip 7, either take +15 points yourself or subtract 15 points from another player.
                        </p>
                      </section>
                    </>
                  )}
                </div>
              </div>
            </motion.section>
          </motion.div>
        )}
      </AnimatePresence>

      {showMenu && (
        <VengeanceMenuDialog
          demo={demo}
          onClose={() => setShowMenu(false)}
          onOpenPlayers={() => setPlayersOpen(true)}
          onOpenRules={() => setRulesOpen(true)}
          onOpenHistory={() => setHistoryOpen(true)}
          onOpenTvShare={() => setTvOpen(true)}
          onRestart={() => setRestartOpen(true)}
          onExit={exit}
        />
      )}
      {historyOpen && room && <RoundHistoryDialog room={room} history={state.history} onClose={() => setHistoryOpen(false)} />}

      {restartOpen && <RestartDialog edition="vengeance" disabled={Boolean(saveError)} onClose={() => setRestartOpen(false)} onRestart={scope => {
        dispatch({ type: 'restart', scope }); setRestartOpen(false); setRoundSummaryOpen(false);
        setOrganizedPlayers({}); setSelectedCardIndex(null); setEditingCardInstanceId(null);
      }} />}
      {tvOpen && roomId && <SharedRoomDialog roomId={roomId} onClose={() => setTvOpen(false)} />}
    </div>
  )
}
