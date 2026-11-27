import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { SETS, openSets } from '../split/api'

export default function CoderHome() {
  const [open, setOpen] = useState<Record<string, boolean> | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => {
    openSets().then(setOpen, () => setErr('Could not load the review sets. Reload the page to try again.'))
  }, [])
  if (err) return <p role="alert" className="error">{err}</p>
  if (!open) return <p>Loading…</p>
  return (
    <section className="page">
      <h1>Splitting</h1>
      <p>
        Split each review into phrases by highlighting them. Read the <a href="/codebook" target="_blank" rel="noopener noreferrer">splitting rules</a> first.
      </p>
      <ul className="sets">
        {SETS.map((s) => (
          <li key={s.name}>
            <div>
              <strong>{s.label}</strong>
              <span>{s.hint}</span>
            </div>
            {open[s.name] ? <span className="row"><Link className="btn" to={`/split/${s.name}`}>Open</Link>{s.name === 'training' && <Link className="btn" to="/practice">Practise labelling</Link>}</span> : <span className="locked">Not open yet</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
