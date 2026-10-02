import type { ReactNode } from 'react'
import { ChevronDown } from 'lucide-react'
import { AssetCardFan, InfoPage } from '../mobile/InfoPage'

type LegalKind = 'privacy' | 'terms'

function LegalSection({ id, title, children }: { id: string; title: string; children: ReactNode }) {
  return <section id={id} className="info-legal-section">
    <h2>{title}</h2>
    {children}
  </section>
}

function PrivacyPolicy() {
  return <>
    <LegalSection id="overview" title="Overview">
      <p>This Data Privacy Policy explains how Flip7 Companion handles information when you use the offline companion app. Flip7 Companion helps groups record physical card flips and keep round scores together on one device.</p>
      <p>By using the app, you acknowledge the practices described here. This policy applies to the app and its informational pages.</p>
    </LegalSection>
    <LegalSection id="information" title="Information we collect">
      <p>The app stores the game information you choose to enter locally, including room names, player profiles, recorded cards, actions, round scores, and match results.</p>
      <p>There are no accounts, access codes, networked player profiles, or online game records in this mobile build. Please avoid putting sensitive personal information into player names.</p>
    </LegalSection>
    <LegalSection id="local-modes" title="Demo and Banker Mode">
      <p>Demo Mode and Banker Mode are local-only experiences. Room data is saved on this device and is not sent to any online service. Demo practice remains temporary.</p>
      <p>Demo Mode is for private practice. Banker Mode lets one person operate a shared table from one device. Banker rooms save automatically and can be resumed after closing or refreshing the app. Demo practice ends when you leave.</p>
    </LegalSection>
    <LegalSection id="tv-cast" title="TV Scoreboard & local casting">
      <p>The TV Scoreboard (Cast) feature operates solely across your private local area network (LAN) or phone hotspot using an embedded offline web server hosted directly on your Android device.</p>
      <p>When you start TV sharing, the app creates a direct local HTTP and WebSocket connection to stream the room scoreboard to connected viewing screens (such as a smart TV, tablet, or browser). No game data, spectator connections, device IP addresses, or media feeds are ever transmitted to external cloud servers or third-party analytics providers.</p>
    </LegalSection>
    <LegalSection id="use" title="How we use information">
      <p>The app uses the information you enter only to display the local table, calculate scores, and run the game on your device.</p>
    </LegalSection>
    <LegalSection id="sharing" title="When information is shared">
      <p>Because this mobile build is offline, game information is not transmitted to or shared with online service providers.</p>
    </LegalSection>
    <LegalSection id="retention" title="Storage and retention">
      <p>Rooms and player profiles remain in this device’s local app storage until you remove them. Settings includes backup and completed-room cleanup controls. Removing completed rooms keeps compact lifetime player totals for matches, wins, and best scores, without keeping their detailed card history. Backups include these totals. Clearing app data or uninstalling may remove all saves. The game-data save limit is 10 MB; actual device limits may be lower, and artwork is bundled separately.</p>
      <p>Keeping the app offline reduces network exposure, but no device or software can guarantee absolute security.</p>
    </LegalSection>
    <LegalSection id="choices" title="Your choices">
      <p>You can choose what player names and game information to enter, and you may stop using the app at any time. You can remove saved rooms and player profiles locally or export a backup from Settings. There is no online account or remote room record.</p>
    </LegalSection>
    <LegalSection id="children" title="Children's privacy">
      <p>Flip7 Companion is intended for general audiences and is not directed to children under the age where parental consent is required by local law. If you believe a child provided personal information, please contact the project owner so it can be reviewed.</p>
    </LegalSection>
    <LegalSection id="changes" title="Changes to this policy">
      <p>We may update this policy as the app changes. The revised version will be included with a future app update and shown on this page with an updated date.</p>
    </LegalSection>
  </>
}

function TermsConditions() {
  return <>
    <LegalSection id="acceptance" title="Acceptance of these terms">
      <p>These Terms &amp; Conditions govern your use of Flip7 Companion. By opening the app or using its features, you agree to follow these terms and the game Rules.</p>
      <p>If you do not agree, do not use the app.</p>
    </LegalSection>
    <LegalSection id="service" title="The companion service">
      <p>Flip7 Companion is an offline digital companion for the physical Flip 7 card game. It provides local player tables, card recording, round states, and score tracking. It does not replace the physical deck or decide how players physically draw cards.</p>
      <p>The banker or group is responsible for setting up the local table and moving it between rounds when the round conditions are met.</p>
    </LegalSection>
    <LegalSection id="local-modes" title="Demo and Banker Mode">
      <p>Demo Mode is a private practice experience. Banker Mode is a one-device setup where a banker switches between player tables and records the group's physical cards and actions locally.</p>
      <p>Banker rooms are saved locally and can be resumed. Demo practice is temporary. Keep backups of records you want to preserve; device storage can be cleared or lost. Both modes require the physical deck.</p>
    </LegalSection>
    <LegalSection id="tv-cast" title="TV Scoreboard & spectator display">
      <p>The TV Scoreboard (Cast) feature provides a local display interface designed to broadcast round scores and player statuses to external screens on your local network or phone hotspot.</p>
      <p>You are responsible for managing your local Wi-Fi or hotspot environment and ensuring display devices are authorized by you to connect. The companion app does not guarantee compatibility with all smart TV browsers or network configurations, and operates independently without third-party network dependencies.</p>
    </LegalSection>
    <LegalSection id="independent" title="Independent companion notice">
      <p>Flip7 Companion is an independent, unofficial companion app created for people who want to play the physical card game with friends. It is not affiliated with, endorsed by, sponsored by, or associated with the creator, publisher, or other rights holders of Flip 7.</p>
      <p>Flip 7 and related game materials belong to their respective owners. This app records the cards that players physically reveal; it does not provide or replace the physical game.</p>
    </LegalSection>
    <LegalSection id="accounts" title="Local session access">
      <p>Anyone with access to the device can see saved rooms, player profiles, and match history and can operate the local table. Keep the device available only to the players who are meant to use the table.</p>
      <p>The app does not create accounts, room codes, or online player access.</p>
    </LegalSection>
    <LegalSection id="fair-play" title="Fair play and acceptable use">
      <p>Use the app to support a friendly, honest game. You must not:</p>
      <ul><li>interfere with another player's local game data;</li><li>attempt to bypass device or app protections;</li><li>submit unlawful, harmful, abusive, or deceptive content; or</li><li>manipulate recorded results in a way that misleads the group.</li></ul>
    </LegalSection>
    <LegalSection id="content" title="Your game data">
      <p>You keep responsibility for the player names and game information you enter. Flip7 Companion displays that information locally to provide the table and game features to your group.</p>
      <p>Do not enter information you do not have the right to share.</p>
    </LegalSection>
    <LegalSection id="availability" title="Availability and changes">
      <p>The app may be updated or unavailable from time to time for improvements or circumstances outside our control. Features may change as the app develops.</p>
      <p>We may remove or change app features when necessary to protect users or the integrity of the game.</p>
    </LegalSection>
    <LegalSection id="responsibility" title="Your responsibility for gameplay">
      <p>The app records what players and hosts submit. The group is responsible for resolving physical card disputes, checking recorded cards, and agreeing on the final result. Use the Rules page as the reference for how Flip 7 is played and scored.</p>
    </LegalSection>
    <LegalSection id="updates" title="Updates to these terms">
      <p>We may revise these terms when the app, rules presentation, or legal requirements change. The current version will be posted on this page with an updated date. Continuing to use the service after an update means you accept the revised terms.</p>
    </LegalSection>
  </>
}

export function LegalScreen({ kind }: { kind: LegalKind }) {
  const isPrivacy = kind === 'privacy'
  const sections = isPrivacy
    ? [['overview', 'Overview'], ['information', 'Information we collect'], ['local-modes', 'Demo and Banker Mode'], ['tv-cast', 'TV Scoreboard & casting'], ['use', 'How we use information'], ['sharing', 'When information is shared'], ['retention', 'Storage and retention'], ['choices', 'Your choices'], ['children', "Children's privacy"], ['changes', 'Changes']]
    : [['acceptance', 'Acceptance of these terms'], ['service', 'The companion service'], ['local-modes', 'Demo and Banker Mode'], ['tv-cast', 'TV Scoreboard & display'], ['independent', 'Independent companion'], ['accounts', 'Local session access'], ['fair-play', 'Fair play'], ['content', 'Your game data'], ['availability', 'Availability'], ['responsibility', 'Gameplay responsibility'], ['updates', 'Updates']]
  return <InfoPage kind={kind} kicker="APP INFORMATION" title={isPrivacy ? 'Privacy & local data' : 'Terms & conditions'} accent="" intro={isPrivacy ? 'How your saved game information is handled.' : 'The ground rules for using this companion.'}>
    <section className={`info-art-banner ${isPrivacy ? 'cyan' : 'yellow'}`}><div><h2>{isPrivacy ? 'Kept close to home.' : 'Made for your table.'}</h2><p>{isPrivacy ? 'No accounts. No online game records. Your rooms stay on this device.' : 'An independent companion. Your physical deck runs the game.'}</p></div><AssetCardFan cards={isPrivacy ? ['Back', 'SECOND CHANCE', '0'] : ['Back', '12', '+6']} /></section>
    <div className="info-document-meta"><span>Updated October 2026</span><span>{isPrivacy ? 'Data Privacy Policy' : 'Terms & Conditions'}</span></div>
    <details className="info-contents"><summary><span>ON THIS PAGE</span><b>{sections.length} sections</b><ChevronDown className="info-contents-chevron" size={18} aria-hidden="true" /></summary><nav aria-label={isPrivacy ? 'Privacy policy sections' : 'Terms sections'}>{sections.map(([id, title], i) => <a key={id} href={`#${id}`}><span>{String(i + 1).padStart(2, '0')}</span>{title}</a>)}</nav></details>
    <article className="info-legal-document" aria-label={isPrivacy ? 'Data Privacy Policy' : 'Terms & Conditions'}>{isPrivacy ? <PrivacyPolicy /> : <TermsConditions />}</article>
    <div className="info-related-links"><a href="/faq">Questions & answers</a><a href={isPrivacy ? '/terms' : '/privacy'}>{isPrivacy ? 'Read the terms' : 'Privacy & local data'}</a></div>
  </InfoPage>
}
