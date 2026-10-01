import { useState } from 'react'
import { Check, Copy } from 'lucide-react'
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
    <section className="info-contact-panel"><h2>Email the project owner</h2><a href={`mailto:${email}`}>{email}</a><button type="button" onClick={() => void copyEmail()}>{copied ? <Check size={18} /> : <Copy size={18} />}{copied ? 'Email copied' : 'Copy email address'}</button><p role="status">{error || (copied ? 'Ready to paste into your email app.' : 'Sending an email needs an email app and an internet connection.')}</p></section>
    <div className="info-related-links"><a href="/faq">Browse FAQs</a><a href="/rules">Read the rules</a></div>
  </InfoPage>
}
