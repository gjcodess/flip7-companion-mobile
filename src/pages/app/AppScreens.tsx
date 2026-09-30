import { useEffect, useState, type FormEvent } from 'react'
import { Archive, BookOpen, ChevronDown, ChevronRight, CircleHelp, Clock3, FileText, Info, Mail, Pencil, Plus, RotateCcw, Trash2, Users, X } from 'lucide-react'
import { ConfirmationModal } from '../../components/ConfirmationModal'
import { AppBottomNav } from '../../components/AppBottomNav'
import { pickerCards } from '../../game/cards'
import { createLocalId, deleteMatch, deletePlayer, listSavedMatches, listSavedPlayers, saveMatch, savePlayer, type SavedMatch, type SavedPlayer } from '../../lib/local-store'
import { useAppNavigation } from '../../lib/navigation'
import './AppScreens.css'

function AppFrame({ active, title, subtitle, children, home = false }: { active: string; title: string; subtitle?: string; children: React.ReactNode; home?: boolean }) {
  return <div className={`mobile-app-frame${home ? ' home-screen' : ''}`}>
    <header className={`mobile-app-header${home ? ' mobile-app-header-home' : ''}`}>
      <div className="mobile-brand-lockup"><img src="/assets/flip7-title-logo.png" alt="Flip 7 Companion" /></div>
      {home ? <div className="mobile-home-hero"><h1>Game night<br />starts here.</h1><img className="mobile-home-art" src="/assets/mobile-home-hero-art.png" alt="" aria-hidden="true" /></div> : <div className="mobile-page-heading"><h1>{title}</h1>{subtitle && <p>{subtitle}</p>}</div>}
    </header>
    <main className="mobile-app-content">{children}</main>
    <AppBottomNav active={active} />
  </div>
}

function dateLabel(timestamp: number) {
  return new Intl.DateTimeFormat(undefined, { month: 'short', day: 'numeric', year: 'numeric' }).format(new Date(timestamp))
}

function createMatchRecord(): SavedMatch {
  const now = Date.now()
  return { id: createLocalId(), title: 'New match', status: 'draft', targetScore: 200, playerNames: ['', '', ''], state: null, createdAt: now, updatedAt: now }
}

function useMatches() {
  const [matches, setMatches] = useState<SavedMatch[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const refresh = async () => {
    setLoading(true)
    try { setMatches(await listSavedMatches()); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not read saved matches.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])
  return { matches, loading, error, refresh }
}

export function HomeScreen() {
  const navigate = useAppNavigation()
  const { matches, loading, error, refresh } = useMatches()
  const [deleteTarget, setDeleteTarget] = useState<SavedMatch | null>(null)
  const [busy, setBusy] = useState(false)
  const activeMatches = matches.filter((match) => match.status !== 'completed')
  const createMatch = async () => {
    setBusy(true)
    const match = createMatchRecord()
    try { await saveMatch(match); navigate(`/banker?matchId=${encodeURIComponent(match.id)}`) }
    catch (cause) { window.alert(cause instanceof Error ? cause.message : 'Could not create a match.') }
    finally { setBusy(false) }
  }
  const confirmDelete = async () => {
    if (!deleteTarget) return
    await deleteMatch(deleteTarget.id)
    setDeleteTarget(null)
    await refresh()
  }
  return <AppFrame active="/landing" title="Your matches" subtitle="Pick up where your table left off." home>
    <div className="mobile-section-heading"><div className="mobile-home-section-label"><span className="eyebrow">YOUR MATCHES</span></div><button className="mobile-primary-button mobile-home-new" disabled={busy} onClick={() => void createMatch()}><Plus size={17} /> New game</button></div>
    {error && <div className="mobile-error" role="alert">{error}</div>}
    {loading ? <div className="mobile-loading">Loading your matches…</div> : activeMatches.length === 0 ? <section className="mobile-empty-state"><div className="mobile-empty-icon"><Archive size={30} /></div><h3>No active matches yet</h3><p>Create a room for your table. Drafts and games in progress stay saved on this device.</p><button className="mobile-primary-button" disabled={busy} onClick={() => void createMatch()}><Plus size={18} /> Create a match</button></section> : <div className="mobile-match-list">
      {activeMatches.map((match) => {
        const players = match.state?.players.length ?? match.playerNames.filter(Boolean).length
        const round = match.state?.roundNumber
        const inProgress = match.status === 'in-progress'
        return <article className={`mobile-match-card${inProgress ? ' in-progress' : ''}`} key={match.id}>
          <img className="mobile-match-art" src="/assets/mobile-home-hero-art.png" alt="" />
          <div className="mobile-match-copy"><div className="mobile-match-title-line"><h3>{match.title || 'Untitled match'}</h3><button className="mobile-icon-button danger" aria-label={`Delete ${match.title}`} onClick={() => setDeleteTarget(match)}><Trash2 size={15} /></button></div><span className={`mobile-status ${inProgress ? 'playing' : ''}`}>{inProgress ? 'In progress' : 'Draft'}</span><p>{round ? `Round ${round} · ` : ''}{players} {players === 1 ? 'player' : 'players'}</p><small><Clock3 size={12} /> {dateLabel(match.updatedAt)}</small></div>
          <div className="mobile-match-aside"><div className="mobile-target-label">Target<strong>{match.targetScore}</strong></div><button className="mobile-open-button" onClick={() => navigate(`/banker?matchId=${encodeURIComponent(match.id)}`)}>{inProgress ? 'Resume' : 'Edit'}<ChevronRight size={16} /></button></div>
        </article>
      })}
    </div>}
    {deleteTarget && <ConfirmationModal eyebrow="DELETE MATCH" title="Remove this match?" message="This permanently deletes the saved match and its round history from this device." cancelLabel="Keep match" confirmLabel="Delete match" onCancel={() => setDeleteTarget(null)} onConfirm={() => void confirmDelete()} />}
  </AppFrame>
}

export function PlayersScreen() {
  const [players, setPlayers] = useState<SavedPlayer[]>([])
  const [name, setName] = useState('')
  const [editingId, setEditingId] = useState<string | null>(null)
  const [editingName, setEditingName] = useState('')
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(true)
  const refresh = async () => {
    setLoading(true)
    try { setPlayers(await listSavedPlayers()); setError('') }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not load the player list.') }
    finally { setLoading(false) }
  }
  useEffect(() => { void refresh() }, [])
  const addPlayer = async (event: FormEvent) => {
    event.preventDefault()
    const cleanName = name.trim()
    if (!cleanName) return
    if (players.some((player) => player.name.toLowerCase() === cleanName.toLowerCase())) return setError('That player is already saved.')
    try { await savePlayer({ id: createLocalId(), name: cleanName, createdAt: Date.now() }); setName(''); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not save this player.') }
  }
  const saveEditedPlayer = async (player: SavedPlayer) => {
    const cleanName = editingName.trim()
    if (!cleanName) return setError('Player name cannot be empty.')
    if (players.some((other) => other.id !== player.id && other.name.toLowerCase() === cleanName.toLowerCase())) return setError('That player is already saved.')
    try { await savePlayer({ ...player, name: cleanName }); setEditingId(null); setError(''); await refresh() }
    catch (cause) { setError(cause instanceof Error ? cause.message : 'Could not update this player.') }
  }
  return <AppFrame active="/players" title="Players" subtitle="Keep your regular table close at hand.">
    <div className="mobile-section-heading"><div><span className="eyebrow">PLAYER LIBRARY</span><h2>Saved players</h2></div><span className="mobile-count-pill">{players.length}</span></div>
    <form className="mobile-add-player" onSubmit={(event) => void addPlayer(event)}><input value={name} onChange={(event) => setName(event.target.value)} placeholder="Player name" maxLength={24} aria-label="Player name" /><button className="mobile-primary-button" type="submit" disabled={!name.trim()}><Plus size={17} /> Add</button></form>
    <p className="mobile-helper">Saved player names are stored locally and can be reused when setting up a match. Editing or removing one does not change past matches.</p>
    {error && <div className="mobile-error" role="alert">{error}</div>}
    {loading ? <div className="mobile-loading">Loading players…</div> : players.length === 0 ? <section className="mobile-empty-state compact"><div className="mobile-empty-icon"><Users size={26} /></div><h3>Your player list is empty</h3><p>Add players here to make new match setup quicker.</p></section> : <div className="mobile-player-list">{players.map((player, index) => <div className="mobile-player-row" key={player.id}><span className={`mobile-player-avatar avatar-${index % 6}`}>{player.name[0]?.toUpperCase()}</span>{editingId === player.id ? <input autoFocus value={editingName} maxLength={24} aria-label={`Rename ${player.name}`} onChange={(event) => setEditingName(event.target.value)} onKeyDown={(event) => { if (event.key === 'Enter') void saveEditedPlayer(player); if (event.key === 'Escape') setEditingId(null) }} /> : <b>{player.name}</b>}<div className="mobile-player-actions">{editingId === player.id ? <><button className="mobile-icon-button" aria-label="Save name" onClick={() => void saveEditedPlayer(player)}>✓</button><button className="mobile-icon-button" aria-label="Cancel rename" onClick={() => setEditingId(null)}><X size={16} /></button></> : <><button className="mobile-icon-button" aria-label={`Rename ${player.name}`} onClick={() => { setEditingId(player.id); setEditingName(player.name) }}><Pencil size={16} /></button><button className="mobile-icon-button danger" aria-label={`Remove ${player.name}`} onClick={async () => { await deletePlayer(player.id); await refresh() }}><Trash2 size={16} /></button></>}</div></div>)}</div>}
  </AppFrame>
}

function roundStatus(status?: string) {
  if (!status) return ''
  return status === 'flip-seven' ? 'Flip 7!' : status === 'stayed' ? 'Banked' : status[0].toUpperCase() + status.slice(1)
}

export function HistoryScreen() {
  const { matches, loading, error } = useMatches()
  const [expanded, setExpanded] = useState<string | null>(null)
  const completed = matches.filter((match) => match.status === 'completed' && match.state)
  return <AppFrame active="/history" title="Match history" subtitle="Scores and cards from every completed round.">
    <div className="mobile-section-heading"><div><span className="eyebrow">COMPLETED TABLES</span><h2>Past matches</h2></div><span className="mobile-count-pill">{completed.length}</span></div>
    {error && <div className="mobile-error" role="alert">{error}</div>}
    {loading ? <div className="mobile-loading">Loading match history…</div> : completed.length === 0 ? <section className="mobile-empty-state"><div className="mobile-empty-icon"><Archive size={30} /></div><h3>No completed matches</h3><p>When a game reaches its target, the final scores and each round's cards will appear here.</p></section> : <div className="mobile-history-list">{completed.map((match) => {
      const state = match.state!
      const winnerScore = Math.max(...state.players.map((player) => player.totalScore))
      return <article className="mobile-history-card" key={match.id}>
        <button className="mobile-history-summary" onClick={() => setExpanded(expanded === match.id ? null : match.id)} aria-expanded={expanded === match.id}><span className="mobile-history-badge"><Archive size={19} /></span><span className="mobile-history-copy"><b>{match.title}</b><small>{dateLabel(match.completedAt ?? match.updatedAt)} · {state.history.length} {state.history.length === 1 ? 'round' : 'rounds'} · First to {match.targetScore}</small><span>{state.players.filter((player) => player.totalScore === winnerScore).map((player) => player.name).join(' & ')} won · {winnerScore} pts</span></span>{expanded === match.id ? <ChevronDown size={20} /> : <ChevronRight size={20} />}</button>
        {expanded === match.id && <div className="mobile-history-detail">{state.history.map((round) => <section className="mobile-round-history" key={round.round}><div className="mobile-round-heading"><b>Round {round.round}</b><span>Score this round</span></div>{state.players.map((player) => {
          const record = round.players?.[player.id]
          const cards = record?.cards ?? []
          return <div className="mobile-round-player" key={player.id}><div className="mobile-round-player-heading"><span className="mobile-player-avatar" style={{ background: player.color }}>{player.name[0]}</span><b>{player.name}</b><span className="mobile-round-score">{round.scores[player.id] ?? 0} pts</span><small>{roundStatus(record?.status)}</small></div><div className="mobile-history-cards">{cards.length ? cards.map((card, index) => {
            const detail = pickerCards.find((candidate) => candidate.id === card.id)
            return <span className={`mobile-history-card-chip ${card.voided ? 'voided' : ''}`} key={`${card.id}-${index}`} title={card.voided ? `${detail?.label ?? card.id} (voided)` : detail?.label ?? card.id}>{detail?.image && <img src={detail.image} alt="" loading="lazy" />}{detail?.label ?? card.id}</span>
          }) : <span className="mobile-no-cards">No cards recorded</span>}</div></div>
        })}</section>)}</div>}
      </article>
    })}</div>}
  </AppFrame>
}

const settingLinks = [
  { title: 'Game Rules', description: 'Card meanings, scoring, and round rules.', path: '/rules', Icon: BookOpen },
  { title: 'FAQs', description: 'Answers to common questions.', path: '/faq', Icon: CircleHelp },
  { title: 'Data Privacy Policy', description: 'How this app handles your information.', path: '/privacy', Icon: FileText },
  { title: 'Terms & Conditions', description: 'Terms for using Flip 7 Companion.', path: '/terms', Icon: FileText },
  { title: 'Contact', description: 'Get in touch with the app team.', path: '/contact', Icon: Mail },
]

export function SettingsScreen() {
  const navigate = useAppNavigation()
  const [howOpen, setHowOpen] = useState(false)
  const [storage, setStorage] = useState<{ usage: number; quota: number } | null>(null)
  useEffect(() => { void (async () => { try { const estimate = await navigator.storage?.estimate(); if (estimate) setStorage({ usage: estimate.usage ?? 0, quota: estimate.quota ?? 0 }) } catch { /* Storage estimate is optional. */ } })() }, [])
  const formatBytes = (value: number) => value < 1024 * 1024 ? `${Math.round(value / 1024)} KB` : `${(value / (1024 * 1024)).toFixed(1)} MB`
  return <AppFrame active="/settings" title="Settings" subtitle="Help, rules, and app information.">
    <div className="mobile-section-heading setting-section-heading"><span className="eyebrow">APP & HELP</span></div>
    <div className="mobile-settings-list">
      <section className={`mobile-setting-group ${howOpen ? 'open' : ''}`}><button className="mobile-setting-row" onClick={() => setHowOpen((open) => !open)} aria-expanded={howOpen}><span className="mobile-setting-icon"><Info size={19} /></span><span><b>How it works</b><small>A quick guide to managing a table offline.</small></span>{howOpen ? <ChevronDown size={19} /> : <ChevronRight size={19} />}</button>{howOpen && <div className="mobile-how-content"><ol><li>Create a match from the center <b>New</b> button.</li><li>Add at least three players and choose a target score. Drafts stay editable before play starts.</li><li>Start the game and record the physical cards as you play. Progress saves on this device.</li><li>Leave whenever you need; return to Home to resume. Finished matches move to History.</li></ol><p>Matches and player names stay in this app's local storage. No account or connection is needed to play.</p></div>}</section>
      {settingLinks.map(({ title, description, path, Icon }) => <button className="mobile-setting-row" key={path} onClick={() => navigate(path)}><span className="mobile-setting-icon"><Icon size={19} /></span><span><b>{title}</b><small>{description}</small></span><ChevronRight size={19} /></button>)}
    </div>
    <section className="mobile-about-card"><div className="mobile-setting-icon"><Info size={19} /></div><div><span className="eyebrow">ABOUT APP</span><h3>Flip 7 Companion Mobile</h3><p>Offline companion for tracking your Flip 7 table.</p><div className="mobile-about-meta"><span>Version <b>1.0</b></span><span>Estimated app storage <b>{storage ? formatBytes(storage.usage) : 'On this device'}</b></span></div><small>Your rooms, scores, and player list are saved locally on this device. Clearing app data will remove them.</small></div></section>
  </AppFrame>
}
