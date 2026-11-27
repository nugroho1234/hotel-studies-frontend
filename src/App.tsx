import { Navigate, Outlet, Route, Routes } from 'react-router-dom'
import { useAuth } from './auth/AuthProvider'
import { homeFor, isStaff, type Role } from './auth/roles'
import Adjudication from './pages/Adjudication'
import AppShell from './layout/AppShell'
import EligibilityAdjudication from './pages/EligibilityAdjudication'
import Codebook from './pages/Codebook'
import CoderHome from './pages/CoderHome'
import { ExpertHome } from './pages/Homes'
import StaffHome from './pages/StaffHome'
import SplitScreen from './pages/SplitScreen'
import LabelHome from './pages/LabelHome'
import LabelScreen from './pages/LabelScreen'
import Login from './pages/Login'
import TrainingView from './pages/TrainingView'

function Splash({ children }: { children: string }) {
  return <p className="splash">{children}</p>
}

/** Signed-in users only; optionally only for some roles (others go to their own home). */
function Guard({ allow }: { allow?: (role: Role) => boolean }) {
  const { session, profile, loading, signOut } = useAuth()
  if (loading) return <Splash>Loading…</Splash>
  if (!session) return <Navigate to="/login" replace />
  if (!profile)
    return (
      <div className="splash">
        <p>Your account has no role yet. Ask the lead researcher to set it up.</p>
        <button className="btn" onClick={signOut}>Sign out</button>
      </div>
    )
  if (allow && !allow(profile.role)) return <Navigate to={homeFor(profile.role)} replace />
  return <Outlet />
}

function Landing() {
  const { session, profile, loading } = useAuth()
  if (loading) return <Splash>Loading…</Splash>
  if (!session) return <Navigate to="/login" replace />
  return <Navigate to={profile ? homeFor(profile.role) : '/login'} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<Login />} />
      <Route element={<Guard />}>
        <Route path="/codebook" element={<Codebook />} />
        <Route element={<AppShell />}>
          <Route element={<Guard allow={(r) => r === 'coder'} />}>
            <Route path="/split" element={<CoderHome />} />
            <Route path="/split/:set" element={<SplitScreen />} />
            <Route path="/label" element={<LabelHome />} />
            <Route path="/label/:set" element={<LabelScreen />} />
            <Route path="/practice" element={<LabelScreen practice />} />
          </Route>
          <Route element={<Guard allow={isStaff} />}>
            <Route path="/dashboard" element={<StaffHome />} />
          </Route>
          <Route element={<Guard allow={(r) => r === 'lead'} />}>
            <Route path="/adjudicate" element={<Adjudication />} />
            <Route path="/eligibility" element={<EligibilityAdjudication />} />
            <Route path="/training" element={<TrainingView />} />
          </Route>
          <Route element={<Guard allow={(r) => r === 'expert'} />}>
            <Route path="/expert" element={<ExpertHome />} />
          </Route>
        </Route>
      </Route>
      <Route path="*" element={<Landing />} />
    </Routes>
  )
}
