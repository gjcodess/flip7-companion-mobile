import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { AnimatePresence, motion } from 'motion/react'
import {
  ArrowDown,
  ArrowLeft,
  ArrowRightLeft,
  ArrowUp,
  Cast,
  Check,
  ChevronDown,
  ChevronRight,
  CircleHelp,
  ClipboardList,
  Eye,
  LogOut,
  Menu,
  Monitor,
  Pencil,
  Plus,
  Redo2,
  RotateCcw,
  Share2,
  Sparkles,
  Undo2,
  Users,
  X,
} from 'lucide-react'
import type { Card } from '../../game/cards'
import { vengeanceCards, type VengeanceCard } from '../../game/vengeanceCards'
import {
  vengeanceEligibleActors,
  vengeanceEligibleCards,
  vengeanceInitialState,
  vengeanceReducer,
  vengeanceScore,
  type VAction,
  type VEntry,
  type VPlayer,
  type VState,
} from '../../game/vengeanceGame'
import { getLibrary, saveVengeanceState, updateLibrary, type PlayerProfile } from '../../lib/room-store'
import { useAppNavigation, useNavigationGuard } from '../../lib/navigation'
import { ConfirmationModal } from '../../components/ConfirmationModal'
import { CardArtwork } from '../../components/CardArtwork'
import { PickerCardArtwork } from '../../components/PickerCardArtwork'
import { PlayerAvatar } from '../../components/PlayerAvatar'
import { defaultPlayerAvatarFor, type PlayerAvatarId } from '../../lib/player-avatars'
import { TvShareDialog } from '../mobile/TvShareDialog'
import { tvSharingAvailable, useTvSession } from '../../lib/tv-share'
import { TargetScorePicker } from '../mobile/TargetScorePicker'
import { RoomCharacterDialog } from '../mobile/MobileApp'
import { GameTable } from './GameTable'
import './VengeanceScreen.css'

const demoColors = ['#e93234', '#193c89', '#da8736', '#257878', '#802e80', '#63439b', '#b33973', '#2e7d32']

function statusClass(player: VPlayer) {
  return player.status === 'flip-seven' ? 'flip-seven' : player.status
}

function statusBadgeLabel(player: VPlayer) {
  if (player.status === 'busted') return 'Busted'
  if (player.status === 'frozen') return 'Frozen'
  if (player.status === 'stayed') return 'Stayed'
  if (player.status === 'flip-seven') return 'Flip 7!'
  return 'Active'
}

function playerTabSummary(player: VPlayer) {
  const score = vengeanceScore(player)
  const numberCount = player.entries.filter((entry) => !entry.voided && entry.card.kind === 'number').length
  if (player.status === 'busted') return 'Busted'
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
  roomName,
  players,
  history,
  targetScore,
  onNewGame,
  onExit,
}: {
  roomName: string
  players: VPlayer[]
  history: VState['history']
  targetScore: number
  onNewGame: () => void
  onExit: () => void
}) {
  const ordered = [...players].sort((a, b) => b.totalScore - a.totalScore)
  const winnerScore = ordered[0]?.totalScore ?? 0
  const winners = ordered.filter((p) => p.totalScore === winnerScore)
  const [shareNotice, setShareNotice] = useState('')

  const share = async () => {
    const text = `Flip 7: With a Vengeance · ${roomName}\n${ordered
      .map((p, i) => `${i + 1}. ${p.name} — ${p.totalScore} pts`)
      .join('\n')}`
    try {
      if (navigator.share) {
        await navigator.share({ title: 'Vengeance Results', text })
      } else {
        await navigator.clipboard.writeText(text)
        setShareNotice('Results copied to clipboard.')
      }
    } catch (e) {
      if ((e as Error).name !== 'AbortError') setShareNotice('Sharing is unavailable on this device.')
    }
  }

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
                      <span className="round-score" key={`${player.id}-${round.round}`}>
                        R{round.round}: {round.scores[player.id] ?? 0}
                      </span>
                    ))}
                  </div>
                </div>
                <div className="results-total">
                  <small>Total pts</small>
                  <strong>{player.totalScore}</strong>
                </div>
              </article>
            )
          })}
        </div>
      </section>
      <section className="results-actions">
        <p>Your final scores and round cards are saved in this room on your device.</p>
        {shareNotice && <p className="results-share-status" role="status">{shareNotice}</p>}
        <div className="banker-results-actions">
          <button className="secondary-action" onClick={() => void share()}>
            <Share2 size={16} /> Share results
          </button>
          <button className="primary-wide" onClick={onExit}>
            <ArrowLeft size={16} /> View room
          </button>
        </div>
        <div style={{ marginTop: '8px' }}>
          <button className="secondary-action" style={{ width: '100%' }} onClick={onNewGame}>
            <RotateCcw size={16} /> Start new game
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
  onOpenTvShare,
  onRestart,
  onExit,
}: {
  demo?: boolean
  onClose: () => void
  onOpenPlayers: () => void
  onOpenRules: () => void
  onOpenTvShare: () => void
  onRestart?: () => void
  onExit: () => void
}) {
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => {
    dialog.current?.showModal()
  }, [])

  return (
    <dialog
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
      <p>{demo ? 'Manage tables, view game rules, restart, or exit this practice session.' : 'Manage tables, view game rules, cast to TV, or exit this session.'}</p>
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
            <strong>Players & Hands</strong>
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
        {demo && onRestart && (
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
              <strong>Restart practice table</strong>
              <span>Reset scores and reconfigure players</span>
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
              <strong>TV Scoreboard</strong>
              <span>Cast live scores to a TV or web browser</span>
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
    </dialog>
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

function DemoSetup({ onStart, onExit }: { onStart: (players: PlayerProfile[], targetScore: number) => void; onExit: () => void }) {
  const library = getLibrary()
  const [targetScore, setTargetScore] = useState(library.settings.vengeanceTargetScore || 200)
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
                  targetScore
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

  const room = roomId ? getLibrary().rooms.find((r) => r.id === roomId && r.edition === 'vengeance') : undefined
  const [state, setState] = useState<VState | null>(() => room?.vengeanceState ?? null)
  const stateRef = useRef<VState | null>(state)
  const pendingSaveRef = useRef<VState | null>(null)
  const [saveError, setSaveError] = useState('')

  const [pickerOpen, setPickerOpen] = useState(false)
  const pickerSessionRef = useRef(0)
  const [selectedCardIndex, setSelectedCardIndex] = useState<number | null>(null)
  const [organizedPlayers, setOrganizedPlayers] = useState<Record<string, boolean>>({})
  const [showMenu, setShowMenu] = useState(false)
  const [playersOpen, setPlayersOpen] = useState(false)
  const [rulesOpen, setRulesOpen] = useState(false)
  const [roundSummaryOpen, setRoundSummaryOpen] = useState(false)
  const [newGamePromptOpen, setNewGamePromptOpen] = useState(false)
  const [tvOpen, setTvOpen] = useState(false)

  const playerTabRefs = useRef<Record<string, HTMLButtonElement | null>>({})
  const tvSession = useTvSession()
  const isSharing = tvSession?.roomId === roomId

  useEffect(() => {
    stateRef.current = state
  }, [state])

  const openPicker = () => {
    pickerSessionRef.current += 1
    setSelectedCardIndex(null)
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
        stateRef.current = next
        pendingSaveRef.current = null
        setState(next)
        setSaveError('')
      } catch (error) {
        pendingSaveRef.current = next
        setSaveError(`${(error as Error).message} Retry before continuing.`)
      }
    },
    [demo, roomId]
  )

  const dispatch = useCallback(
    (action: VAction) => {
      if (!stateRef.current || pendingSaveRef.current) return
      const next = vengeanceReducer(stateRef.current, action)
      if (next !== stateRef.current) persist(next)
    },
    [persist]
  )

  const selected = state ? state.players.find((p) => p.id === state.selectedPlayerId) ?? state.players[0] : null
  const forcedTurn = state?.forced[0] ?? null
  const turnPlayerId = forcedTurn?.targetId ?? (state?.phase === 'deal' || state?.phase === 'turn' ? state.turnPlayerId : null)
  const drawing = state ? state.players.find((p) => p.id === turnPlayerId) : null
  const pending = state?.pending ?? null
  const eligibleActors = state ? vengeanceEligibleActors(state) : []
  const eligibleCards = state ? vengeanceEligibleCards(state) : []

  const needsCards = pending?.card.id === 'v-action-steal' || pending?.card.id === 'v-action-swap' || pending?.card.id === 'v-action-discard'
  const selectedCount = pending?.card.id === 'v-action-swap' ? 2 : 1
  const readyToConfirm = pending && (pending.card.kind === 'modifier' ? Boolean(pending.targetId) : Boolean(pending.actorId && (!needsCards || pending.selectedCards.length === selectedCount)))

  const canRecord = (state?.phase === 'deal' || state?.phase === 'turn') && !pending && Boolean(drawing) && !saveError

  // Auto-scroll active player tab into view
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
        onStart={(players, target) => {
          const next = vengeanceInitialState(players, target)
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
          </header>
          <VengeanceResults
            roomName={room?.name ?? 'Practice Match'}
            players={state.players}
            history={state.history}
            targetScore={state.targetScore}
            onNewGame={() => setNewGamePromptOpen(true)}
            onExit={exit}
          />
          {newGamePromptOpen && (
            <ConfirmationModal
              eyebrow="NEW VENGEANCE GAME"
              title="Start a new game?"
              message={demo ? "Start a fresh practice match with these players." : "Your completed match stays saved in room history."}
              cancelLabel="Keep results"
              confirmLabel="New game"
              onCancel={() => setNewGamePromptOpen(false)}
              onConfirm={() => {
                setNewGamePromptOpen(false)
                const next = vengeanceInitialState(state.players, state.targetScore)
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
    setPickerOpen(false)
    setSelectedCardIndex(null)
    dispatch({ type: 'record', cardId: card.id })
  }

  const isCurrentOrganized = Boolean(selected && organizedPlayers[selected.id])

  const toggleOrganize = () => {
    if (!selected) return
    setOrganizedPlayers((prev) => ({
      ...prev,
      [selected.id]: !prev[selected.id],
    }))
  }

  const displayedEntries = selected
    ? isCurrentOrganized
      ? organizeVengeanceEntries(selected.entries)
      : selected.entries
    : []

  const tableCards: Card[] = displayedEntries.map((e) => e.card)
  const tableCardIds: string[] = displayedEntries.map((e) => e.instanceId)
  const selectedScore = selected ? vengeanceScore(selected) : 0
  const isSelectedTurn = selected?.id === turnPlayerId
  const interactionLocked = pickerOpen || Boolean(pending) || roundSummaryOpen || Boolean(saveError)
  const numberCount = selected?.entries.filter((e) => !e.voided && e.card.kind === 'number').length ?? 0
  const hasZero = Boolean(selected?.entries.some((e) => !e.voided && e.card.id === 'v-number-zero'))
  const canStay =
    state.phase === 'turn' &&
    isSelectedTurn &&
    !forcedTurn &&
    !hasZero &&
    selected?.status === 'active' &&
    numberCount >= 2

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
            <button
              className={`brand-button cast-button ${isSharing ? 'is-sharing' : ''}`}
              aria-label="TV scoreboard"
              title="TV scoreboard"
              onClick={() => setTvOpen(true)}
            >
              <Cast size={20} />
              {isSharing && <span className="cast-live-dot" />}
            </button>
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
        </section>

        <div className="banker-turn-callout" role="status">
          <span>CURRENT TURN</span>
          <b>{drawing?.name || '—'}</b>
        </div>

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
                <b>{player.name}</b>
                <span>{playerTabSummary(player)}</span>
              </span>
              <strong>
                <small>Total pts:</small> <b>{player.totalScore}</b>
              </strong>
            </button>
          ))}
        </section>

        <GameTable
          table={tableCards}
          tableCardIds={tableCardIds}
          isVoidedCard={(index) => Boolean(displayedEntries[index]?.voided)}
          score={selectedScore}
          flipSevenBonus={selected?.status === 'flip-seven' ? 15 : 0}
          busted={selected?.status === 'busted'}
          frozen={selected?.status === 'frozen'}
          submitting={false}
          interactionLocked={interactionLocked}
          canEditCards={canRecord}
          canAddCards={canRecord && isSelectedTurn}
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
              onClose={() => setPickerOpen(false)}
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
                  <span>{displayedEntries[selectedCardIndex].voided ? 'DISCARDED CARD' : 'FACE-UP CARD'}</span>
                  <h2>{displayedEntries[selectedCardIndex].card.label}</h2>
                </div>
                <button
                  className="close-button"
                  aria-label="Close card focus"
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
                  ? `This card was discarded.`
                  : displayedEntries[selectedCardIndex].card.kind === 'number'
                    ? `Counts toward ${selected?.name}'s round total.`
                    : displayedEntries[selectedCardIndex].card.kind === 'modifier'
                      ? `Modifier penalty applied to ${selected?.name}'s round total.`
                      : `Action ability card.`}
              </p>
              <button
                className="secondary-action"
                style={{ width: '100%', minHeight: '44px' }}
                onClick={() => setSelectedCardIndex(null)}
              >
                Done
              </button>
            </motion.section>
          </motion.div>
        )}

        {/* Action Card Resolution Dialog */}
        {pending && (
          <motion.div
            key="action-resolution-backdrop"
            className="picker-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0, pointerEvents: 'none' }}
            onClick={() => dispatch({ type: 'cancel-pending' })}
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
                  title = `Steal a card into ${actor?.name}'s hand`
                } else if (isSwap && pending.actorId) {
                  title = `Swap 2 cards between tables`
                } else if (isDiscard && pending.actorId) {
                  title = `Discard a card from table`
                } else if (isForced && pending.actorId) {
                  title = `${actor?.name} flips ${pending.card.id === 'v-action-flip-four' ? 'four cards' : 'one card'}`
                }

                let subtitle = `Choose which active player table receives this ${pending.card.label} action.`
                if (isModifier) {
                  subtitle = `Choose which active player table receives this ${pending.card.label} modifier.`
                } else if (isForced) {
                  subtitle = pending.actorId
                    ? `${actor?.name} must flip cards, then immediately freeze unless they bust or reach Flip 7.`
                    : `Choose which active player table resolves this ${pending.card.label} action.`
                } else if (isSteal) {
                  subtitle = pending.actorId
                    ? `Select 1 card from an active opponent's table to steal into ${actor?.name}'s hand.`
                    : `Choose which active player gets Steal to take a card.`
                } else if (isSwap) {
                  subtitle = pending.actorId
                    ? 'Select 1 card from each of 2 different active players to swap between them.'
                    : `Choose which active player gets Swap to exchange cards.`
                } else if (isDiscard) {
                  subtitle = pending.actorId
                    ? 'Select 1 card from any active player table to discard from the round.'
                    : `Choose which active player gets Discard to remove a card.`
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
                          onClick={() => dispatch({ type: 'cancel-pending' })}
                        >
                          <X size={19} />
                        </button>
                      </div>
                      <p>{subtitle}</p>

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

                    <div className={`physical-picker-scroll v-action-scroll ${needsCards ? 'has-floating-btn' : ''}`}>
                      {/* Step 1: Choose Actor (for actions) or Target (for modifiers) */}
                      {((!pending.actorId && !isModifier) || (isModifier && !pending.targetId)) && (
                        <div className="target-list banker-target-list v-action-actor-list">
                          {eligibleActors.map((player) => (
                            <button
                              key={player.id}
                              type="button"
                              className="v-actor-select-btn"
                              onClick={() =>
                                dispatch({
                                  type: isModifier ? 'choose-target' : 'choose-actor',
                                  playerId: player.id,
                                })
                              }
                            >
                              <PlayerAvatar player={player} className="mini-avatar" />
                              <span className="v-actor-btn-name">
                                <b>{player.name}</b>
                                {player.id === state.turnPlayerId && <span className="v-current-tag">Current Turn</span>}
                                {player.status === 'stayed' && <span className="v-stayed-tag">Stayed</span>}
                                {player.status === 'frozen' && <span className="v-frozen-tag">Frozen</span>}
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
                            .filter((player) => player.status === 'active')
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
                                                disabled={!isEligible}
                                                onClick={() =>
                                                  dispatch({ type: 'choose-card', instanceId: entry.instanceId })
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

                    {/* Floating Confirmation Buttons for Steal, Swap, Discard */}
                    {isSteal && pending.actorId && selectedFaces[0] && (
                      <div className="v-floating-confirm">
                        <button
                          type="button"
                          className="v-confirm-btn steal"
                          onClick={() => dispatch({ type: 'confirm' })}
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
                          onClick={() => dispatch({ type: 'confirm' })}
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
                          onClick={() => dispatch({ type: 'confirm' })}
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

        {/* Round Summary Settlement Dialog */}
        {roundSummaryOpen && (
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
                {state.players.map((player) => (
                  <div className={`banker-summary-player ${statusClass(player)}`} key={player.id}>
                    <PlayerAvatar player={player} className="mini-avatar" />
                    <div className="banker-summary-player-copy">
                      <b>{player.name}</b>
                      <span className={`banker-status-pill ${statusClass(player)}`}>
                        {statusBadgeLabel(player)}
                      </span>
                    </div>
                    <div className="banker-summary-score">
                      <small>ROUND</small>
                      <strong>{vengeanceScore(player)}</strong>
                    </div>
                  </div>
                ))}
              </div>
              <p>Confirm these scores to finish the match or start the next round.</p>
              <div className="banker-results-actions">
                <button className="secondary-action" onClick={() => setNewGamePromptOpen(true)}>
                  <RotateCcw size={16} /> New game
                </button>
                <button
                  className="primary-wide"
                  disabled={Boolean(saveError)}
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
                    const score = vengeanceScore(player)
                    return (
                      <div
                        className={`info-player ${player.id === selected?.id ? 'current-player' : ''}`}
                        key={player.id}
                      >
                        <PlayerAvatar player={player} className="mini-avatar" />
                        <div>
                          <b>
                            {player.name}
                            {player.id === selected?.id ? ' (current)' : ''}
                          </b>
                          <small>{playerTabSummary(player)}</small>
                        </div>
                        <span className="info-player-scores">
                          <span>
                            <small>ROUND</small>
                            <strong>{score}</strong>
                          </span>
                          <span>
                            <small>TOTAL</small>
                            <strong>{player.totalScore}</strong>
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
                      Every player receives 1 face-up card clockwise starting after the dealer. Then players take turns hitting or staying until everyone busts or banks.
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
                      Modifiers (÷2, −2, −4, −6, −8, −10) apply penalties to any non-busted player. Action cards (Steal, Swap, Discard, Just One More, Flip Four) let you attack or force flips!
                    </p>
                  </section>
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
          onOpenTvShare={() => setTvOpen(true)}
          onRestart={demo ? () => setState(null) : undefined}
          onExit={exit}
        />
      )}

      {tvOpen && roomId && <TvShareDialog roomId={roomId} onClose={() => setTvOpen(false)} />}
    </div>
  )
}
