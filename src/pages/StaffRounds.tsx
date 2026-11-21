import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { devRoundStatus, drawDevRound, type RoundStatus } from '../stats/api'

type Act = (fn: () => Promise<unknown>, ask: string) => void

/** Development rounds: which round is running, and the lead's button for a fresh one (after a newer codebook is uploaded). */
export function RoundsPanel({ isLead, busy, act, kappaFailed, version }: { isLead: boolean; busy: boolean; act: Act; kappaFailed: boolean; version: number }) {
  const [st, setSt] = useState<RoundStatus | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { devRoundStatus().then(setSt, () => setErr('Could not load the development rounds.')) }, [version])
  if (err) return <p role="alert" className="error">{err}</p>
  if (!st) return null
  const ready = st.newerCodebook && st.codersFinished >= 2 && st.reserve > 0
  const reason = () => {
    const r = window.prompt('Why is a fresh development set needed? For example: "kappa .62 in Indonesian"')
    return r?.trim() ?? ''
  }
  return (
    <>
      <h2>Development rounds</h2>
      <p className="note">
        If human kappa is below .70 in either language, the registration asks for a fresh development set from reviews never used before, after further training and a clarified codebook.
        Earlier rounds stay in the data; coders only see the current round.
      </p>
      <ul className="sets">
        {st.rounds.map((r) => (
          <li key={r.round}>
            <div>
              <strong>Round {r.round}{r.round === st.round ? ' (current)' : ''}: codebook v{r.version}</strong>
              <span>{new Date(r.at).toLocaleDateString()}. {r.reason}</span>
            </div>
          </li>
        ))}
      </ul>
      {kappaFailed && !st.newerCodebook && (
        <p className="note">The kappa minimum is not met. Waiting for a codebook newer than v{st.roundVersion}{isLead ? <> (<Link to="/codebook">upload it on the codebook page</Link>).</> : '.'}</p>
      )}
      {st.newerCodebook && <p className="note">Codebook v{st.currentVersion} is uploaded. {st.codersFinished} of 2 coders have finished labelling round {st.round}. {st.reserve > 0 ? 'A fresh set is ready.' : 'No fresh set is prepared yet: run plan-dev-rounds.'}</p>}
      {isLead && (
        <p>
          <button className="btn" disabled={busy || !ready}
            onClick={() => { const r = reason(); if (r) act(() => drawDevRound(r).then(() => devRoundStatus().then(setSt)), `Draw fresh development set (round ${st.round + 1}) with ${st.reserve} reviews and open it for splitting? The current round will close for coders.`) }}>
            Draw fresh dev set
          </button>
        </p>
      )}
    </>
  )
}
