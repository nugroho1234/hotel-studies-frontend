import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { LABEL_SETS, labelOpen } from '../label/api'

export default function LabelHome() {
  const [open, setOpen] = useState<Record<string, boolean> | null>(null)
  const [err, setErr] = useState('')
  useEffect(() => { labelOpen().then(setOpen, () => setErr('Could not load the review sets. Reload the page to try again.')) }, [])
  if (err) return <p role="alert" className="error">{err}</p>
  if (!open) return <p>Loading…</p>
  return (
    <section className="page">
      <h1>Labelling</h1>
      <p>Give each phrase one label and one sentiment. Labelling opens for a set after the splits have been agreed.</p>
      <ul className="sets">
        {LABEL_SETS.map((s) => (
          <li key={s.name}>
            <div><strong>{s.label}</strong></div>
            {open[s.name] ? <Link className="btn" to={`/label/${s.name}`}>Open</Link> : <span className="locked">Not open yet</span>}
          </li>
        ))}
      </ul>
    </section>
  )
}
