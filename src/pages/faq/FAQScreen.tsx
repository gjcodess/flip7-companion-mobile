import { useState } from 'react'
import { Search, ChevronDown, CircleHelp } from 'lucide-react'
import { AssetCardFan, InfoPage, InfoPlayCallout } from '../mobile/InfoPage'

const faqGroups = [
  {
    "id": "start",
    "title": "Before the first flip.",
    "label": "Getting started",
    "items": [
      {
        "question": "What is Flip7 Companion?",
        "answer": "It is an offline companion for the physical Flip 7 card game. You use the real deck, while the app keeps the local player tables, cards, and scores together on the device."
      },
      {
        "question": "Do I need the physical Flip 7 deck?",
        "answer": "Yes. The app does not draw cards for you. Players flip from the physical deck and record each card in front of them."
      },
      {
        "question": "How do I start a game?",
        "answer": "Tap the central + button, name your room, add at least two players, and choose a target score. Start immediately or save the room for later."
      },
      {
        "question": "How do players join?",
        "answer": "The banker adds each player's name locally. The group then uses the same device to record cards and actions as the round moves around the table."
      },
      {
        "question": "What is Banker Mode?",
        "answer": "Banker Mode lets one person run the whole table from one device. The banker switches between player tables to record cards and actions, while keeping the player order and scores together locally."
      },
      {
        "question": "Can I resume a game?",
        "answer": "Yes. Rooms save automatically on this device. Open a room from Home to resume its current round or see scores and cards in Round history. Add players before the first card of a new round."
      },
      {
        "question": "What is Demo Mode?",
        "answer": "Demo Mode is a private practice table for trying the card flow and scoring by yourself. It does not save the session online."
      }
    ]
  },
  {
    "id": "rounds",
    "title": "Make the call.",
    "label": "Playing a round",
    "items": [
      {
        "question": "What does Hit do?",
        "answer": "Hit records another card in front of you so you can keep building your round score. A duplicate Number card makes you bust unless a Second Chance card cancels it."
      },
      {
        "question": "What does Stay / Bank do?",
        "answer": "Stay ends your turn for the round and banks the points you have collected. You cannot receive more cards after banking."
      },
      {
        "question": "What happens when I bust?",
        "answer": "Your round score becomes zero and your turn ends automatically. The cards stay visible so the table can see what happened, and the round continues for the other active players."
      },
      {
        "question": "When does the round end?",
        "answer": "The round ends when everyone is banked, frozen, or busted, or when a player reveals seven unique Number cards and earns the Flip 7 bonus."
      }
    ]
  },
  {
    "id": "cards",
    "title": "Know what counts.",
    "label": "Cards & scoring",
    "items": [
      {
        "question": "How is a round scored?",
        "answer": "Add the Number cards, apply ×2 if you have it, add any +2 through +10 Modifier points, then add the +15 Flip 7 bonus if you revealed seven unique Number cards."
      },
      {
        "question": "Do Modifier cards count toward Flip 7?",
        "answer": "No. Modifier cards change the score but do not count as unique Number cards. You cannot bust on a Modifier card."
      },
      {
        "question": "What does Second Chance do?",
        "answer": "It cancels one duplicate Number card. Discard the Second Chance card with the duplicate and keep the rest of your round."
      },
      {
        "question": "What do Freeze and Flip Three do?",
        "answer": "Freeze banks an active player. Flip Three makes an active player accept three cards one at a time."
      }
    ]
  },
  {
    "id": "app",
    "title": "Keep the table moving.",
    "label": "Local app",
    "items": [
      {
        "question": "Who can start the next round?",
        "answer": "The banker can proceed once every player is banked, frozen, or busted. The next round starts after the current scores are settled."
      },
      {
        "question": "Can I fix a recording mistake?",
        "answer": "Yes. Use the card controls, edit or remove the incorrect card, or use Undo while the round is still being recorded."
      },
      {
        "question": "Can I use the app on my phone?",
        "answer": "Yes. Install the mobile app and use Demo Mode or Banker Mode without an internet connection."
      },
      {
        "question": "Does the app need an internet connection?",
        "answer": "No. Demo Mode and Banker Mode run locally, and the app does not send game data online."
      },
      {
        "question": "What happens when someone reaches 200 points?",
        "answer": "The game ends after the round is settled. The player with the most total points wins."
      },
      {
        "question": "How do I cast the scoreboard to a TV?",
        "answer": "In Banker Mode, tap the Cast button in the top header to open the TV Share dialog. Connect your smart TV, tablet, or laptop to the same Wi-Fi network (or your phone's portable hotspot), then scan the QR code or enter the displayed URL into the TV's web browser."
      },
      {
        "question": "Does TV casting require an internet connection or mobile data?",
        "answer": "No. The TV scoreboard runs 100% locally from an offline server inside the app. It does not use the internet or consume mobile data. You can use your home Wi-Fi router or turn on your phone's portable hotspot (even with mobile data turned off) to connect the TV."
      },
      {
        "question": "Does the TV scoreboard update in real time?",
        "answer": "Yes. As the banker records cards, busts, freezes, and settles scores on the phone, the TV display updates instantly with live animations for everyone at the table."
      },
      {
        "question": "How much storage do saved games use?",
        "answer": "Rooms save names, card IDs, and scores with a 10 MB save limit; actual device storage limits may be lower. The artwork is bundled once. Clearing completed rooms removes detailed history but keeps lifetime player matches, wins, and best scores. Unfinished games are never automatically deleted."
      }
    ]
  }
]

export function FAQScreen() {
  const [query, setQuery] = useState('')
  const [category, setCategory] = useState('all')
  const normalized = query.trim().toLowerCase()
  const visible = faqGroups.filter(group => category === 'all' || category === group.id).map(group => ({ ...group, items: group.items.filter(item => !normalized || `${item.question} ${item.answer}`.toLowerCase().includes(normalized)) })).filter(group => group.items.length > 0)
  const count = visible.reduce((sum, group) => sum + group.items.length, 0)
  return <InfoPage kind="faq" kicker="A LITTLE HELP FOR GAME NIGHT" title="Questions & answers" accent="" intro="Find a quick answer and get back to the table.">
    <section className="info-art-banner cyan"><div><h2>We’ve got<br />your back.</h2></div><AssetCardFan cards={['5', 'SECOND CHANCE', 'FREEZE']} /></section>
    <label className="room-search info-faq-search"><Search size={18} /><input aria-label="Search questions and answers" type="search" placeholder="Search cards, rooms, scoring…" value={query} onChange={event => setQuery(event.target.value)} /></label>
    <div className="info-category-chips" role="group" aria-label="Question categories"><button type="button" aria-pressed={category === 'all'} onClick={() => setCategory('all')}>All questions</button>{faqGroups.map(group => <button type="button" key={group.id} aria-pressed={category === group.id} onClick={() => setCategory(group.id)}>{group.label}</button>)}</div>
    <p className="info-result-count" role="status">{count} {count === 1 ? 'answer' : 'answers'}{normalized ? ` for “${query.trim()}”` : ''}</p>
    <div className="info-faq-groups">{visible.map(group => <section key={group.id} className={`info-faq-group group-${group.id}`}><div className="info-section-top"><span className="room-kicker">{group.label}</span><b>{String(faqGroups.findIndex(g => g.id === group.id) + 1).padStart(2, '0')}</b></div><h2>{group.title}</h2>{group.items.map(item => <details className="info-faq-item" key={item.question}><summary><span>{item.question}</span><ChevronDown size={17} /></summary><p>{item.answer}</p></details>)}</section>)}</div>
    {!count && <section className="room-empty"><div className="room-empty-icon"><CircleHelp size={28} /></div><h2>No answers found yet.</h2><p>Try “Freeze”, “scores”, or “room”, or choose a different category.</p><button className="room-button secondary" onClick={() => { setQuery(''); setCategory('all') }}>Show all questions</button></section>}
    <div className="info-related-links"><a href="/rules">Read the full game rules</a><a href="/privacy">Privacy & local data</a></div>
    <InfoPlayCallout />
  </InfoPage>
}
