import { useState } from 'react'
import { ArrowUpRight, Check, Copy, Mail } from 'lucide-react'
import { AssetCardFan, InfoPage } from '../mobile/InfoPage'

export function ContactScreen() {
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState('')
  const email = 'glennjoshuacorpus1@gmail.com'
  const copyEmail = async () => {
    try {
      if (navigator.clipboard?.writeText) await navigator.clipboard.writeText(email)
      else {
        const input = document.createElement('textarea')
        input.value = email
        input.style.position = 'fixed'
        input.style.opacity = '0'
        document.body.append(input)
        input.select()
        const success = document.execCommand('copy')
        input.remove()
        if (!success) throw new Error('Clipboard unavailable')
      }
      setCopied(true)
      setError('')
    } catch {
      setError('Could not copy. Select the email address to copy it manually.')
    }
  }
  return <InfoPage kind="contact" kicker="A LITTLE HELP FOR GAME NIGHT" title="Contact & feedback" accent="" intro="Got a question or spotted something we can improve?">
    <section className="info-art-banner cyan"><div><h2>Need a hand?</h2><p>We’d like to hear from you.</p></div><AssetCardFan cards={['3', 'SECOND CHANCE', '+4']} /></section>
    <section className="info-contact-panel">
      <div className="info-contact-heading"><span className="info-contact-icon"><Mail size={21} /></span><div><span className="info-contact-kicker">GET IN TOUCH</span><h2>Email the project owner</h2></div></div>
      <a className="info-contact-address" href={`mailto:${email}`} aria-label={`Email ${email}`}><span><small>EMAIL ADDRESS</small><strong>{email}</strong></span><ArrowUpRight size={19} aria-hidden="true" /></a>
      <button type="button" onClick={() => void copyEmail()}>{copied ? <Check size={18} /> : <Copy size={18} />}{copied ? 'Email copied' : 'Copy email address'}</button>
      {error && <p className="info-contact-note" role="status">{error}</p>}
    </section>
    <div className="info-related-links"><a href="/faq">Browse FAQs</a><a href="/rules">Read the rules</a></div>
  </InfoPage>
}
