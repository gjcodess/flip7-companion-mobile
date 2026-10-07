import { Fragment } from 'react'
import { AssetCardFan, InfoPage, InfoPlayCallout } from '../mobile/InfoPage'
import { useLibrary } from '../../lib/room-store'

function RulesCardStrip({ cards, className = '', prefix = '' }: { cards: string[]; className?: string; prefix?: string }) {
  return <div className={`guide-card-strip ${className}`}>{cards.map((card) => <img key={card} src={`/cards/${prefix}${card}.webp`} alt={`${card} card`} />)}</div>
}

function RulesScoreStep({
  step,
  description,
  cards,
  modifier,
  half,
  minus,
  result,
  bonus,
  prefix = ''
}: {
  step: number
  description: string
  cards: string[]
  modifier?: string
  half?: boolean
  minus?: string
  result: string
  bonus?: boolean
  prefix?: string
}) {
  return <div className="guide-score-step">
    <b>{step}</b>
    <div className="guide-score-step-body">
      <span>{description}</span>
      <div className="guide-score-card-row">
        {cards.map((card, index) => <Fragment key={card}>{index > 0 && <b className="guide-score-plus">+</b>}<img src={`/cards/${prefix}${card}.webp`} alt={`${card} card`} /></Fragment>)}
        {modifier && <><b className="guide-score-plus">{modifier === 'x2' ? '×' : '+'}</b><img className="guide-score-modifier" src={`/cards/${prefix}${modifier}.webp`} alt={`${modifier} card`} /></>}
        {half && <><b className="guide-score-plus">÷</b><img className="guide-score-modifier" src={`/cards/${prefix}v-modifier-half.webp`} alt="Half card" /></>}
        {minus && <><b className="guide-score-plus">−</b><img className="guide-score-modifier" src={`/cards/${prefix}${minus}.webp`} alt={`${minus} card`} /></>}
        {bonus && <><b className="guide-score-plus">+</b><span className="guide-score-inline-bonus"><strong>15</strong><small>POINT<br />BONUS!</small></span></>}
        <span className="guide-score-equals">=</span><b className="guide-score-value">{result}</b>
      </div>
    </div>
  </div>
}

function VengeanceRules() {
  return <InfoPage kind="rules" kicker="THE GAME NIGHT FIELD GUIDE" title="How to play" accent="With a Vengeance." intro="Attack, defend, score, and push your luck.">
    <section className="info-art-banner yellow">
      <div>
        <span className="room-kicker">NO ONE'S SAFE</span>
        <h2>Steal, swap,<br />and strike back.</h2>
        <p>Target active rivals with actions.<br />Seven unique numbers earn +15.</p>
      </div>
      <AssetCardFan cards={['vengeance/v-action-steal', 'vengeance/v-number-lucky-13', 'vengeance/v-action-flip-four']} />
    </section>

    <div className="info-quick-facts">
      <span><b>200</b> target score</span>
      <span><b>7</b> unique numbers</span>
      <span><b>+15</b> Flip 7 bonus</span>
    </div>

    <nav className="info-jump-links" aria-label="Jump to a rules section">
      <a href="#v-guide-how">The basics</a>
      <a href="#v-guide-numbers">Special cards</a>
      <a href="#v-guide-actions">Action cards</a>
      <a href="#v-guide-scoring">Scoring</a>
    </nav>

    <div className="guide-content">
      <section id="v-guide-objective" className="guide-card guide-card-wide guide-card-objective">
        <div className="guide-card-heading"><span className="eyebrow">THE OBJECTIVE</span><b className="guide-number">01</b></div>
        <h2>Race to 200 points.</h2>
        <p>Be the first player to score 200 points across multiple rounds. Your round score is the total value of your face-up Number cards after applying modifiers. Keep collecting unique numbers, but if you reveal a duplicate number, you bust and score zero for the round. If you assemble seven unique Number cards, the round ends immediately and you earn an extra 15 bonus points!</p>
        <RulesCardStrip
          prefix="vengeance/"
          cards={[
            'v-number-13',
            'v-number-12',
            'v-number-11',
            'v-number-10',
            'v-number-9',
            'v-number-8',
            'v-number-7',
            'v-number-6',
            'v-number-5',
            'v-number-4',
            'v-number-3',
            'v-number-2',
            'v-number-1',
            'v-number-zero',
            'v-number-lucky-13',
            'v-number-unlucky-7'
          ]}
          className="guide-number-strip"
        />
      </section>

      <section id="v-guide-how" className="guide-card guide-card-how">
        <div className="guide-card-heading"><span className="eyebrow">HOW TO PLAY</span><b className="guide-number">02</b></div>
        <h2>Flip, attack, repeat.</h2>
        <ol className="guide-step-list">
          <li>
            <div className="guide-step-copy">
              <b>Set up the table.</b>
              <span>Create a room, add your players, and choose a dealer. Or open Demo Mode to practice the moves on your own.</span>
            </div>
          </li>
          <li>
            <div className="guide-step-copy">
              <b>Deal the opening round.</b>
              <span>The dealer deals one physical card face up to each player to start the round, immediately resolving any Actions or Modifiers.</span>
            </div>
          </li>
          <li>
            <div className="guide-step-copy">
              <b>Hit or stay.</b>
              <span>On your turn, choose <strong>HIT</strong> to reveal another card, or choose <strong>STAY</strong> to protect your current hand from further actions.</span>
            </div>
          </li>
          <li>
            <div className="guide-step-copy">
              <b>Unleash actions and modifiers.</b>
              <span>Whenever an Action or Modifier is revealed, you must give it to an active player who has not stayed, frozen, or busted.</span>
            </div>
          </li>
          <li>
            <div className="guide-step-copy">
              <b>Settle and score.</b>
              <span>The round ends when everyone is stayed or busted, or someone gets Flip 7. Tally scores and pass the physical deck to the left.</span>
            </div>
          </li>
        </ol>
        <div className="guide-callout guide-callout-cyan">
          <b>Physical companion workflow</b>
          <span>Reveal your physical card first, then tap to record it in the app. The app automatically tracks hand totals, active eligibility, and game scores.</span>
        </div>
      </section>

      <section id="v-guide-numbers" className="guide-card guide-card-deck">
        <div className="guide-card-heading"><span className="eyebrow">SPECIAL NUMBERS</span><b className="guide-number">03</b></div>
        <h2>Three cards that bend the rules.</h2>
        <p>The Vengeance deck features unique number cards with game-changing special powers:</p>
        <div className="guide-action-list">
          <div>
            <img src="/cards/vengeance/v-number-zero.webp" alt="The Zero card" />
            <p><b>The Zero</b>Scores 0 points and counts as a unique number toward Flip 7. However, its holder is cursed and must continue hitting on every turn until they bust or achieve Flip 7.</p>
          </div>
          <div>
            <img src="/cards/vengeance/v-number-unlucky-7.webp" alt="Unlucky 7 card" />
            <p><b>Unlucky 7</b>When received, the player must immediately discard all other Number and Modifier cards in their hand! It stays face up as their sole 7 card.</p>
          </div>
          <div>
            <img src="/cards/vengeance/v-number-lucky-13.webp" alt="Lucky 13 card" />
            <p><b>Lucky 13</b>Permits you to hold one additional regular 13 card without busting. Both 13s count toward your 7 unique cards for Flip 7, but a third 13 busts your hand.</p>
          </div>
        </div>
      </section>

      <section id="v-guide-actions" className="guide-card guide-card-actions">
        <div className="guide-card-heading"><span className="eyebrow">ACTION CARDS</span><b className="guide-number">04</b></div>
        <h2>Take control of the table.</h2>
        <div className="guide-action-list">
          <div>
            <img src="/cards/vengeance/v-action-steal.webp" alt="Steal card" />
            <p><b>Steal</b> takes one face-up card from any active opponent's hand and adds it into your own hand.</p>
          </div>
          <div>
            <img src="/cards/vengeance/v-action-swap.webp" alt="Swap card" />
            <p><b>Swap</b> forces two different active players to exchange one face-up card each.</p>
          </div>
          <div>
            <img src="/cards/vengeance/v-action-discard.webp" alt="Discard card" />
            <p><b>Discard</b> removes and discards one chosen face-up card from any active player.</p>
          </div>
          <div>
            <img src="/cards/vengeance/v-action-just-one-more.webp" alt="Just One More card" />
            <p><b>Just One More</b> forces an active target to reveal exactly one more card and then freezes them for the remainder of the round.</p>
          </div>
          <div>
            <img src="/cards/vengeance/v-action-flip-four.webp" alt="Flip Four card" />
            <p><b>Flip Four</b> forces an active target to reveal up to 4 cards one by one (stopping on bust or Flip 7). Any Actions and Modifiers revealed are resolved in order afterward.</p>
          </div>
        </div>
        <div className="guide-callout guide-callout-pale">
          <b>Mandatory play rule</b>
          <span>Actions must be played if there is at least one valid active player. If you are the only active player left, you must play the action on yourself!</span>
        </div>
      </section>

      <section id="v-guide-modifiers" className="guide-card guide-card-wide guide-card-modifiers">
        <div className="guide-card-heading"><span className="eyebrow">MODIFIER CARDS</span><b className="guide-number">05</b></div>
        <h2>Halve totals and deduct points.</h2>
        <p>Modifier cards are given to any active player who has not stayed, frozen, or busted. Modifiers do not count toward the seven unique cards for Flip 7, and you cannot bust on a Modifier card.</p>
        <div className="guide-deck-details">
          <div>
            <b>÷2 Half Modifier</b>
            <span>Halves your entire Number card sum (rounded down) before negative penalties are deducted.</span>
          </div>
          <div>
            <b>Negative Modifiers (−2 to −10)</b>
            <span>Deduct their printed value (−2, −4, −6, −8, or −10) directly from your round total.</span>
          </div>
        </div>
        <RulesCardStrip
          prefix="vengeance/"
          cards={[
            'v-modifier-half',
            'v-modifier-minus-2',
            'v-modifier-minus-4',
            'v-modifier-minus-6',
            'v-modifier-minus-8',
            'v-modifier-minus-10'
          ]}
          className="guide-modifier-strip"
        />
        <div className="guide-callout">
          <b>Score floor</b>
          <span>Negative modifiers can never reduce your round score below zero.</span>
        </div>
      </section>

      <section id="v-guide-active" className="guide-card guide-card-active">
        <div className="guide-card-heading"><span className="eyebrow">ACTIVE PLAYERS</span><b className="guide-number">06</b></div>
        <h2>Who is eligible for an action?</h2>
        <p>An active player has not busted and has not chosen to stay or been frozen. Actions and Modifiers can be played on any active player, including yourself. Once a player stays or busts, they are protected and cannot be targeted by further attacks.</p>
        <div className="guide-callout guide-callout-pink">
          <b>Stayed hands remain visible</b>
          <span>Stayed hands stay face up on the table until the round settles, preserving their points.</span>
        </div>
      </section>

      <section id="v-guide-scoring" className="guide-card guide-card-wide guide-card-scoring">
        <div className="guide-card-heading"><span className="eyebrow">CALCULATE SCORES</span><b className="guide-number">07</b></div>
        <h2>Build your round score in order.</h2>
        <p className="guide-score-intro">At the end of each round, compute your score using this exact order of operations:</p>
        <div className="guide-score-steps">
          <RulesScoreStep
            prefix="vengeance/"
            step={1}
            description="Add the value of your number cards."
            cards={['v-number-4', 'v-number-13', 'v-number-8', 'v-number-11']}
            result="36"
          />
          <RulesScoreStep
            prefix="vengeance/"
            step={2}
            description="If holding ÷2, divide by 2 (rounded down)."
            cards={['v-number-4', 'v-number-13', 'v-number-8', 'v-number-11']}
            half
            result="18"
          />
          <RulesScoreStep
            prefix="vengeance/"
            step={3}
            description="Subtract negative modifiers (min 0)."
            cards={['v-number-4', 'v-number-13', 'v-number-8', 'v-number-11']}
            half
            minus="v-modifier-minus-10"
            result="8"
          />
          <RulesScoreStep
            prefix="vengeance/"
            step={4}
            description="Seven unique numbers earn the Flip 7 bonus."
            cards={['v-number-zero', 'v-number-2', 'v-number-5', 'v-number-7', 'v-number-9', 'v-number-11', 'v-number-13']}
            result="62"
            bonus
          />
        </div>
      </section>

      <section id="v-guide-end" className="guide-card guide-card-wide guide-card-end">
        <div className="guide-card-heading"><span className="eyebrow">END OF A ROUND</span><b className="guide-number">08</b></div>
        <h2>Settle the table, then deal again.</h2>
        <div className="guide-end-grid">
          <div>
            <b>End the round</b>
            <p>The round ends when all players have stayed, frozen, or busted, or when a player reaches Flip 7 with seven unique number cards.</p>
          </div>
          <div>
            <b>Deal the next round</b>
            <p>Set all cards from the round aside into the discard pile. Pass the physical deck to the left to rotate the dealer.</p>
          </div>
          <div>
            <b>Win the match</b>
            <p>When a round concludes and any player has reached 200 points or more, the player with the highest total score wins the game!</p>
          </div>
        </div>
      </section>

      <section id="v-guide-controls" className="guide-card guide-card-wide guide-card-modes">
        <div className="guide-card-heading"><span className="eyebrow">COMPANION CONTROLS</span><b className="guide-number">09</b></div>
        <h2>Seamless table tracking.</h2>
        <p>The companion app records cards, moves, and round totals as you play with your physical Vengeance deck.</p>
        <div className="guide-deck-details">
          <div>
            <b>Tap to record</b>
            <span>Reveal the physical card on the table, then tap the matching card in the app. For actions like Steal or Swap, select the players and cards involved.</span>
          </div>
          <div>
            <b>Instant undo</b>
            <span>Made a wrong tap? Tap the Undo button anytime during the round to safely revert the last card or action recorded.</span>
          </div>
          <div>
            <b>Official rules & FAQs</b>
            <span>Have a specific edge case? View the <a href="https://theop.games/pages/flip-7-wav-faqs" target="_blank" rel="noreferrer">Official Vengeance FAQs</a>.</span>
          </div>
        </div>
      </section>
    </div>

    <InfoPlayCallout practice />
  </InfoPage>
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
            <RulesScoreStep
              step={1}
              description="Add the value of your number cards."
              cards={['3', '11', '5', '7', '10']}
              result="36"
            />
            <RulesScoreStep
              step={2}
              description="If you have ×2, double your Number card total."
              cards={['3', '11', '5', '7', '10']}
              modifier="x2"
              result="72"
            />
            <RulesScoreStep
              step={3}
              description="Add any additional bonus points."
              cards={['3', '11', '5', '7', '10']}
              modifier="+10"
              result="46"
            />
            <RulesScoreStep
              step={4}
              description="Seven unique Number cards earn the Flip 7 bonus."
              cards={['3', '11', '5', '7', '10', '9', '4']}
              result="64"
              bonus
            />
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
