import { useEffect, useRef, useState } from 'react'
import { motion } from 'motion/react'
import { ChevronRight, Download, Share2, X } from 'lucide-react'
import { saveGameResults, shareGameResults, type GameResults } from '../../lib/results-sharing'
import { useRoomSheetMotion } from '../../lib/use-room-sheet-motion'

export function ResultsShareDialog({ roomName, players, history, targetScore, edition, variant, onClose }: GameResults & { onClose: () => void }) {
  const dialog = useRef<HTMLDialogElement>(null)
  const sheetMotion = useRoomSheetMotion()
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  useEffect(() => { dialog.current?.showModal() }, [])
  const act = async (action: 'share' | 'save') => {
    setBusy(true)
    setError('')
    setNotice('')
    try {
      const options = { roomName, players, history, targetScore, edition, variant }
      const message = action === 'share' ? await shareGameResults(options) : await saveGameResults(options)
      setNotice(message)
    } catch (failure) {
      if ((failure as Error).name !== 'AbortError') setError((failure as Error).message)
    } finally { setBusy(false) }
  }
  return <motion.dialog {...sheetMotion} ref={dialog} className={`room-dialog banker-menu-dialog results-share-dialog${edition === 'vengeance' ? ' edition-vengeance' : ''}`} onCancel={event => { if (busy) event.preventDefault(); else onClose() }} onClick={event => { if (!busy && event.target === event.currentTarget) onClose() }}>
    <div className="room-dialog-heading"><div><span className="room-kicker">FINAL SCORES</span><h2>Share game results</h2></div><button type="button" className="room-icon-button" aria-label="Close sharing options" disabled={busy} onClick={onClose}><X size={20} /></button></div>
    <p>Keep a picture of your final scoreboard or send it to your crew.</p>
    <div className="banker-menu-list">
      <button type="button" className="banker-menu-item" disabled={busy} onClick={() => void act('share')}><span className="banker-menu-item-icon"><Share2 size={20} /></span><span className="banker-menu-item-text"><strong>Share results</strong><span>Send the score image to another app</span></span><ChevronRight size={18} className="banker-menu-item-chevron" /></button>
      <button type="button" className="banker-menu-item" disabled={busy} onClick={() => void act('save')}><span className="banker-menu-item-icon"><Download size={20} /></span><span className="banker-menu-item-text"><strong>Save image</strong><span>Keep a PNG copy on this device</span></span><ChevronRight size={18} className="banker-menu-item-chevron" /></button>
    </div>
    {busy && <p className="results-share-status" role="status">Preparing your results image…</p>}
    {notice && <p className="results-share-status" role="status">{notice}</p>}
    {error && <p className="room-error" role="alert">{error}</p>}
  </motion.dialog>
}

