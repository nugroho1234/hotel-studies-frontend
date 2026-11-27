import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { resetTraining, trainingOverview, type LabelReview } from '../label/api'
import { DIMENSIONS, SENTIMENTS } from '../label/scheme'
import { segmentsOf } from '../split/splitting'

type Coder = { user_id: string; display_name: string }

/** Lead only: what a coder split and labelled in the training practice, to go through live, and a reset so the set can be practised again. */
export default function TrainingView() {
  const [coders, setCoders] = useState<Coder[]>([])
  const [coder, setCoder] = useState('')
  const [items, setItems] = useState<LabelReview[] | null>(null)
  const [err, setErr] = useState('')

  useEffect(() => {
    supabase.from('profiles').select('user_id,display_name').eq('role', 'coder').order('display_name').then(({ data, error }) => {
      if (error) setErr('Could not load the coders. Reload the page to try again.')
      else { setCoders(data ?? []); if (data?.length) setCoder(data[0].user_id) }
    })
  }, [])

  const load = useCallback(() => {
    if (!coder) return
    setItems(null)
    trainingOverview(coder).then(setItems, () => setErr('Could not load this coder\'s training work.'))
  }, [coder])
  useEffect(() => { load() }, [load])

  const reset = async () => {
    const name = coders.find((c) => c.user_id === coder)?.display_name
    if (!window.confirm(`Delete everything ${name} split and labelled in the training set? They can then practise it again. This cannot be undone.`)) return
    setErr('')
    try { await resetTraining(coder); load() } catch { setErr('The reset did not work. Try again.') }
  }

  return (
    <section className="page">
      <h1>Training practice</h1>
      <p className="note">Practice only: nothing here is adjudicated, counted in any agreement figure or used for the gold standard.</p>
      <p className="row">
        <label>Coder <select value={coder} onChange={(e) => setCoder(e.target.value)}>{coders.map((c) => <option key={c.user_id} value={c.user_id}>{c.display_name}</option>)}</select></label>
        <button className="btn" disabled={!coder || !items?.length} onClick={reset}>Reset this coder's training work</button>
      </p>
      {err && <p role="alert" className="error">{err}</p>}
      {!items ? <p>Loading…</p> : items.length === 0 ? <p>This coder has not split any training review yet.</p> : items.map((rev) => {
        const cps = Array.from(rev.body)
        return (
          <article key={rev.reviewId} className="split">
            <h2>Review {rev.reviewId}</h2>
            <p className="review small" lang={rev.lang === 'id' ? 'id' : 'en'}>
              {segmentsOf(cps.length, rev.phrases).map((g) => (
                <span key={g.start} className={g.n === null ? 'gap' : `phrase m${(g.n % 5) + 1}`} data-n={g.n === null ? undefined : g.n + 1}>{cps.slice(g.start, g.end).join('')}</span>
              ))}
            </p>
            <ol>
              {rev.phrases.map((p) => (
                <li key={p.id}>{p.text} — <strong>{DIMENSIONS.find((d) => d.code === p.dimension)?.name ?? 'not labelled'}</strong>{p.sentiment && `, ${SENTIMENTS.find((s) => s.code === p.sentiment)?.name}`}</li>
              ))}
            </ol>
          </article>
        )
      })}
    </section>
  )
}
