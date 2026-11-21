import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '../auth/AuthProvider'
import { ROLE_LABEL, homeFor, isStaff } from '../auth/roles'

export default function AppShell() {
  const { profile, signOut } = useAuth()
  if (!profile) return null
  const home = homeFor(profile.role)
  const homeLabel = profile.role === 'coder' ? 'Splitting' : profile.role === 'expert' ? 'Questionnaire' : 'Overview'
  return (
    <div className="shell">
      <aside className="sidebar">
        <div className="who">
          <strong>{profile.displayName}</strong>
          <span>{ROLE_LABEL[profile.role]}</span>
        </div>
        <nav aria-label="Main">
          <NavLink to={home} className={({ isActive }) => (isActive ? 'navlink active' : 'navlink')}>{homeLabel}</NavLink>
          {isStaff(profile.role) && (
            <NavLink to="/adjudicate" className={({ isActive }) => (isActive ? 'navlink active' : 'navlink')}>Adjudication</NavLink>
          )}
          {profile.role !== 'expert' && (
            <a className="navlink" href="/codebook" target="_blank" rel="noopener noreferrer">
              Codebook <span className="sr-only">(opens in a new tab)</span>
            </a>
          )}
        </nav>
        <button className="btn quiet" onClick={signOut}>Sign out</button>
      </aside>
      <main className="main">
        <Outlet />
      </main>
    </div>
  )
}
