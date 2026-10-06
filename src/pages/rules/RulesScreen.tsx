import { Fragment } from 'react'
import { AssetCardFan, InfoPage, InfoPlayCallout } from '../mobile/InfoPage'
import { useLibrary } from '../../lib/room-store'
import { vengeanceCard } from '../../game/vengeanceCards'
import { cardThumbnailUrl } from '../../game/cardThumbnailUrl'

function VengeanceRuleCards({ ids }: { ids: string[] }) {
  return <div className="vengeance-rule-cards">{ids.map(id => {
    const card = vengeanceCard(id)
    return card && <figure key={id}><img src={cardThumbnailUrl(card.image ?? '')} alt={`${card.label} card`} /><figcaption>{card.label}</figcaption></figure>
  })}</div>
}

function VengeanceRules() {
  return <InfoPage kind="rules" kicker="WITH A VENGEANCE" title="How to play" accent="" intro="Use the physical Vengeance deck. The app records your cards, moves, and scores.">
    <section className="guide-card"><h2>The round</h2><p>Choose a dealer. Starting to their left, reveal one physical card to each player, resolving Actions and Modifiers. Then each active player chooses Hit or Stay. Stayed hands remain on the table and can change until the round ends. A duplicate Number busts; Flip 7 ends the round for everyone.</p></section>
    <section className="guide-card"><h2>Special Numbers</h2><p><b>The Zero</b> scores zero unless its holder reaches Flip 7, and its holder must continue hitting on their turn. <b>Unlucky 7</b> discards that player’s other Number and Modifier cards when received, then stays as their 7. <b>Lucky 13</b> permits one other 13; both count toward Flip 7, but a third 13 busts.</p><VengeanceRuleCards ids={['v-number-zero', 'v-number-unlucky-7', 'v-number-lucky-13']} /></section>
    <section className="guide-card"><h2>Actions</h2><p>Actions must be played if there is a valid target. You can give one to any player who has not busted, including yourself or someone who stayed. Steal takes a face-up card into the actor’s hand. Swap exchanges two face-up cards between different hands. Discard removes one chosen face-up card. Just One More forces one reveal and then Stay. Flip Four forces up to four reveals, stopping on a bust or Flip 7; resolve its queued Actions and Modifiers afterward in reveal order.</p><VengeanceRuleCards ids={['v-action-steal', 'v-action-swap', 'v-action-discard', 'v-action-just-one-more', 'v-action-flip-four']} /></section>
    <section className="guide-card"><h2>Modifiers and scoring</h2><p>Give a Modifier to any player who has not busted, including someone who stayed. At round end, add Number cards, divide by two and round down if holding ÷2, then subtract −2 through −10. The standard score cannot go below zero. Add 15 for Flip 7. Action cards are discarded after use.</p><VengeanceRuleCards ids={['v-modifier-half', 'v-modifier-minus-2', 'v-modifier-minus-10']} /></section>
    <section className="guide-card"><h2>Companion controls</h2><p>Reveal the real card, then record it in the app. Tap the players and face-up cards affected by an action; review and confirm the physical move. Undo corrects a recording mistake. The app does not shuffle or deal.</p><p><a href="https://theop.games/pages/flip-7-wav-faqs" target="_blank" rel="noreferrer">Official Vengeance FAQs</a></p></section>
    <InfoPlayCallout practice />
  </InfoPage>
}

function RulesCardStrip({ cards, className = '' }: { cards: string[]; className?: string }) {
  return <div className={`guide-card-strip ${className}`}>{cards.map((card) => <img key={card} src={`/cards/${card}.webp`} alt={`${card} card`} />)}</div>
}

function RulesScoreExample({ label, cards, modifier, result, bonus }: { label: string; cards: string[]; modifier?: string; result: string; bonus?: boolean }) {
  return <div className="guide-score-example">
    <span className="guide-score-example-label">{label}</span>
    <div className="guide-score-card-row">
      {cards.map((card, index) => <Fragment key={card}>{index > 0 && <b className="guide-score-plus">+</b>}<img src={`/cards/${card}.webp`} alt={`${card} card`} /></Fragment>)}
      {modifier && <><b className="guide-score-plus">{modifier === 'x2' ? '×' : '+'}</b><img className="guide-score-modifier" src={`/cards/${modifier}.webp`} alt={`${modifier} card`} /></>}
      {bonus && <><b className="guide-score-plus">+</b><span className="guide-score-inline-bonus"><strong>15</strong><small>POINT<br />BONUS!</small></span></>}
      <span className="guide-score-equals">=</span><b className="guide-score-value">{result}</b>
    </div>
  </div>
}

export function RulesScreen() {
  const edition = useLibrary().settings.edition
  if (edition === 'vengeance') return <VengeanceRules />
  return <InfoPage kind="rules" kicker="THE GAME NIGHT FIELD GUIDE" title="How to play" accent="" intro="The cards, the choices, and how to score.">
    <section className="info-art-banner yellow"><div><span className="room-kicker">ONE MORE FLIP?</span><h2>Unique numbers.<br />Bigger rewards.</h2><p>Seven unique numbers earn +15.<br />A duplicate can end your round.</p></div><AssetCardFan cards={['12', '+10', 'x2']} /></section>
    <div className="info-quick-facts"><span><b>200</b> classic target</span><span><b>7</b> unique cards</span><span><b>+15</b> bonus points</span></div>
    <nav className="info-jump-links" aria-label="Jump to a rules section"><a href="#guide-how">The basics</a><a href="#guide-actions">Action cards</a><a href="#guide-scoring">Scoring</a></nav>
      <div className="guide-content">
        <section id="guide-objective" className="guide-card guide-card-wide guide-card-objective">
          <div className="guide-card-heading"><span className="eyebrow">THE OBJECTIVE</span><b className="guide-number">01</b></div>
          <h2>Race to 200 points.</h2>
          <p>Be the first player to score 200 points. Your round score is based on the total value of the number cards in front of you. Keep collecting unique numbers, but if you reveal a duplicate, you bust and score nothing for the round. If you reveal seven unique Number cards, the round ends immediately and you earn an additional 15 points.</p>
          <RulesCardStrip cards={['12', '11', '10', '9', '8', '7', '6', '5', '4', '3', '2', '1', '0']} className="guide-number-strip" />
        </section>

        <section id="guide-how" className="guide-card guide-card-how">
          <div className="guide-card-heading"><span className="eyebrow">HOW TO PLAY</span><b className="guide-number">02</b></div>
          <h2>Flip, choose, repeat.</h2>
          <ol className="guide-step-list">
            <li><div className="guide-step-copy"><b>Set up the table.</b><span>Create a room, add your players, and choose a target. Or open Demo Mode to practice by yourself.</span></div></li>
            <li><div className="guide-step-copy"><b>Deal the round.</b><span>The dealer deals cards one at a time, moving around the table so every player gets a turn.</span></div></li>
            <li><div className="guide-step-copy"><b>Flip and record.</b><span>On your turn, record the physical card you reveal in your table.</span></div></li>
            <li><div className="guide-step-copy"><b>Choose your risk.</b><span>Hit to keep going, or choose <strong>STAY / BANK</strong> to lock in your score once you have at least two Number cards.</span></div></li>
            <li><div className="guide-step-copy"><b>Move together.</b><span>The round ends when everyone is banked, frozen, or busted, or someone flips seven unique numbers.</span></div></li>
          </ol>
          <div className="guide-callout guide-callout-cyan"><b>Before the first deal</b><span>Shuffle your physical deck and choose a dealer. Your room keeps the cards and scores together on this device.</span></div>
        </section>

        <section id="guide-deck" className="guide-card guide-card-deck">
          <div className="guide-card-heading"><span className="eyebrow">THE DECK</span><b className="guide-number">03</b></div>
          <h2>Know what is in play.</h2>
          <p>The special deck has 94 cards: twelve 12s, eleven 11s, and so on down to one 1 and one 0. Action and modifier cards are mixed into the deck, so keep the card count in mind as you press your luck.</p>
          <div className="guide-deck-details"><div><b>Number cards</b><span>Numbers score their face value. The 0 card scores no points and still counts as a unique Number card.</span></div><div><b>Special cards</b><span>There are three each of Second Chance, Freeze, and Flip Three, plus Add and ×2 Modifier cards.</span></div></div>
          <div className="guide-callout"><b>Important</b><span>Number cards score. Action cards and modifiers change the round but do not count toward the seven-card bonus.</span></div>
        </section>

        <section id="guide-modes" className="guide-card guide-card-wide guide-card-modes">
          <div className="guide-card-heading"><span className="eyebrow">CHOOSE YOUR MODE</span><b className="guide-number">04</b></div>
          <h2>Same game, different table setup.</h2>
          <p>Every mode uses the physical Flip 7 deck and the same scoring rules. Choose the setup that fits your group.</p>
          <div className="guide-deck-details">
            <div><b>Demo mode</b><span>Practice on one device by yourself. Nothing is saved online, and the session ends when you leave or refresh.</span></div>
            <div><b>Banker mode</b><span>Use one device for the whole group. The banker records cards and actions locally. Rooms save automatically so unfinished games can be resumed.</span></div>
            <div><b>TV Scoreboard (Cast)</b><span>Broadcast a live spectator scoreboard to any smart TV, laptop, or tablet over local Wi-Fi or phone hotspot. Runs completely offline without using mobile data.</span></div>
          </div>
          <div className="guide-callout"><b>Big-screen game night</b><span>Tap the Cast icon in Banker Mode to show the live scoreboard on your TV. Players can follow real-time scores, active turns, and card tables together from across the room.</span></div>
        </section>

        <section id="guide-modifiers" className="guide-card guide-card-wide guide-card-modifiers">
          <div className="guide-card-heading"><span className="eyebrow">MODIFIER CARDS</span><b className="guide-number">05</b></div>
          <h2>Add more points.</h2>
          <p>Modifier cards are not Number cards and do not count toward Flip 7. You cannot bust on a Modifier card. Add cards score their printed value, while <strong>×2</strong> doubles your Number card total for the round.</p>
          <RulesCardStrip cards={['+2', '+4', '+6', '+8', '+10', 'x2']} className="guide-modifier-strip" />
          <div className="guide-callout"><b>Modifier order</b><span>First add your Number cards. If you have ×2, double that total. Then add any +2 through +10 bonus points. If you only have a Modifier card, you still score its points unless it is ×2.</span></div>
        </section>

        <section id="guide-actions" className="guide-card guide-card-actions">
          <div className="guide-card-heading"><span className="eyebrow">ACTION CARDS</span><b className="guide-number">06</b></div>
          <h2>Change the table.</h2>
          <div className="guide-action-list">
            <div><img src="/cards/SECOND CHANCE.webp" alt="Second Chance card" /><p><b>Second Chance</b> cancels one duplicate. Discard it with the duplicate card and keep the rest of your round.</p></div>
            <div><img src="/cards/FREEZE.webp" alt="Freeze card" /><p><b>Freeze</b> banks a player and locks in all points collected that round.</p></div>
            <div><img src="/cards/FLIP THREE.webp" alt="Flip Three card" /><p><b>Flip Three</b> makes the chosen active player accept three cards one at a time.</p></div>
          </div>
          <div className="guide-callout guide-callout-pale"><b>Active player rule</b><span>Action cards can target any active player, including the person who played the card. If only one player is active, that player must be chosen.</span></div>
        </section>

        <section id="guide-active" className="guide-card guide-card-active">
          <div className="guide-card-heading"><span className="eyebrow">ACTIVE PLAYERS</span><b className="guide-number">07</b></div>
          <h2>Who can receive an action?</h2>
          <p>An active player has not busted and has not chosen to stay. Action cards can be played on any active player, including yourself. If you are the only active player, you must play the action on yourself.</p>
          <div className="guide-callout guide-callout-pink"><b>Remember</b><span>After a player busts or stays, they are no longer active for the round.</span></div>
        </section>

        <section id="guide-scoring" className="guide-card guide-card-wide guide-card-scoring">
          <div className="guide-card-heading"><span className="eyebrow">CALCULATE SCORES</span><b className="guide-number">08</b></div>
          <h2>Build your round score in order.</h2>
          <p className="guide-score-intro">Use the number cards in front of you, then apply modifiers and the Flip 7 bonus in this order.</p>
          <div className="guide-score-steps">
            <div><b>1</b><span>Add the value of your number cards.</span><strong>3 + 11 + 5 + 7 + 10 = 36</strong></div>
            <div><b>2</b><span>If you have ×2, double your Number card total.</span><strong>36 × 2 = 72</strong></div>
            <div><b>3</b><span>Add any additional bonus points.</span><strong>36 + 10 = 46</strong></div>
            <div><b>4</b><span>Seven unique Number cards earn the Flip 7 bonus.</span><strong>+15 bonus</strong></div>
          </div>
          <div className="guide-score-examples">
            <RulesScoreExample label="Number cards" cards={['3', '11', '5', '7', '10']} result="36" />
            <RulesScoreExample label="With ×2" cards={['3', '11', '5', '7', '10']} modifier="x2" result="72" />
            <RulesScoreExample label="With +10" cards={['3', '11', '5', '7', '10']} modifier="+10" result="46" />
            <RulesScoreExample label="Flip 7" cards={['3', '11', '5', '7', '10', '9', '4']} result="64" bonus />
          </div>
        </section>

        <section id="guide-end" className="guide-card guide-card-wide guide-card-end">
          <div className="guide-card-heading"><span className="eyebrow">END OF A ROUND</span><b className="guide-number">09</b></div>
          <h2>Settle the table, then deal again.</h2>
          <div className="guide-end-grid"><div><b>End the round</b><p>The round ends when there are no active players because everyone has banked, frozen, or busted, or when a player flips seven unique number cards and earns the bonus.</p></div><div><b>Start the next round</b><p>Set every card from the round aside; do not shuffle those cards back in. Pass the remaining deck to the left so the next player becomes the dealer. If the deck runs out, shuffle the discarded cards to form a new deck.</p></div><div><b>End the game</b><p>When a round ends with at least one player at 200 points or more, the player with the most points wins.</p></div></div>
        </section>
      </div>

    <InfoPlayCallout practice />
  </InfoPage>
}
