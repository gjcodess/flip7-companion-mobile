import { useEffect, useRef, useState } from 'react'
import { Check, X } from 'lucide-react'
import { bankerPlayerColors } from '../../game/bankerGame'
import { PlayerAvatar } from '../../components/PlayerAvatar'
import { getMyProfile, saveMyProfile } from '../../lib/my-profile'
import { playerAvatars, type PlayerAvatarId } from '../../lib/player-avatars'

export function MyProfileEditor({ onClose }: { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const current = getMyProfile()
  const [name, setName] = useState(current.name)
  const [avatar, setAvatar] = useState<PlayerAvatarId>(current.avatar!)
  const [color, setColor] = useState(current.color)
  const [group, setGroup] = useState<(typeof playerAvatars)[number]['group']>(playerAvatars.find(item => item.id === current.avatar)?.group ?? 'Any style')
  const [error, setError] = useState('')
  useEffect(() => { dialog.current?.showModal() }, [])
  const save = () => {
    try { saveMyProfile({ ...current, name, avatar, color }); onClose() }
    catch (failure) { setError((failure as Error).message) }
  }
  return <dialog ref={dialog} className="room-dialog" onCancel={onClose} onClick={event => { if (event.target === event.currentTarget) onClose() }}>
    <div className="room-dialog-heading"><div><span className="room-kicker">YOUR DEVICE</span><h2>My character</h2></div><button type="button" className="room-icon-button" aria-label="Close character editor" onClick={onClose}><X size={20} /></button></div>
    <p>This character is offered when you join a local room.</p>
    <div className="player-avatar-preview"><PlayerAvatar player={{ ...current, name: name || 'Player', avatar, color }} className="room-avatar" /></div>
    <label className="room-field">YOUR NAME<input value={name} maxLength={24} placeholder="What should we call you?" onChange={event => setName(event.target.value)} onKeyDown={event => { if (event.key === 'Enter') save() }} /></label>
    <fieldset className="room-avatar-picker"><legend>CHOOSE A CHARACTER</legend><div className="room-avatar-tabs" role="group" aria-label="Character styles">{(['Any style', 'Male', 'Female'] as const).map(value => <button type="button" key={value} aria-pressed={group === value} onClick={() => setGroup(value)}>{value}</button>)}</div><div className="room-avatar-options">{playerAvatars.filter(item => item.group === group).map(item => <button type="button" key={item.id} aria-label={item.label} aria-pressed={avatar === item.id} onClick={() => setAvatar(item.id)}><PlayerAvatar player={{ name: item.label, color, avatar: item.id }} />{avatar === item.id && <Check size={13} className="room-avatar-check" />}</button>)}</div></fieldset>
    <fieldset className="room-color-picker"><legend>CHOOSE A COLOR</legend>{bankerPlayerColors.map(value => <button type="button" key={value} aria-label={`Color ${value}`} aria-pressed={color === value} style={{ background: value }} onClick={() => setColor(value)}>{color === value && <Check size={19} />}</button>)}</fieldset>
    {error && <p className="room-error" role="alert">{error}</p>}
    <button type="button" className="room-button local-profile-save" onClick={save}><Check size={17} /> Save my character</button>
  </dialog>
}
