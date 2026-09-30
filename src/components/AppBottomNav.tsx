import { CirclePlus, History, House, Settings, Users } from 'lucide-react'
import { useAppNavigation } from '../lib/navigation'

const items = [
  { path: '/landing', label: 'Home', Icon: House },
  { path: '/players', label: 'Players', Icon: Users },
  { path: '/history', label: 'History', Icon: History },
  { path: '/settings', label: 'Settings', Icon: Settings },
]

export function AppBottomNav({ active }: { active: string }) {
  const navigate = useAppNavigation()
  return <nav className="mobile-bottom-nav" aria-label="Main navigation">
    <div className="mobile-bottom-nav-inner">
      {items.slice(0, 2).map(({ path, label, Icon }) => <button key={path} className={`mobile-nav-item ${active === path ? 'active' : ''}`} aria-current={active === path ? 'page' : undefined} onClick={() => navigate(path)}><Icon size={21} strokeWidth={2.2} /><span>{label}</span></button>)}
      <button className={`mobile-nav-create ${active === '/banker' ? 'active' : ''}`} aria-label="Create a new match" aria-current={active === '/banker' ? 'page' : undefined} onClick={() => navigate('/banker')}><CirclePlus size={34} strokeWidth={2.2} /><span>New</span></button>
      {items.slice(2).map(({ path, label, Icon }) => <button key={path} className={`mobile-nav-item ${active === path ? 'active' : ''}`} aria-current={active === path ? 'page' : undefined} onClick={() => navigate(path)}><Icon size={21} strokeWidth={2.2} /><span>{label}</span></button>)}
    </div>
  </nav>
}
