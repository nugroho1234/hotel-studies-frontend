import { useCallback, useEffect, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { setNotGuest } from '../label/notGuest'
import { LABEL_SETS, finishLabels, loadLabelQueue, loadTrainingQueue, saveLabel, saveTrainingLabel, type LabelPhrase, type LabelReview, type LabelSet } from '../label/api'
import { DIMENSIONS, SENTIMENTS, type Dimension, type Sentiment } from '../label/scheme'
import { segmentsOf } from '../split/splitting'

type Save = 'saved' | 'saving' | 'error'
const labelled = (p: LabelPhrase) => p.dimension !== null && p.sentiment !== null
const reviewDone = (r: LabelReview) => r.phrases.every(labelled)

/** practice: the training set, labelling the coder's own phrases; nothing is adjudicated or locked and nothing counts. */
export default function LabelScreen({ practice = false }: { practice?: boolean }) {
  const set = useParams().set as LabelSet
  const label = practice ? 'Training practice' : LABEL_SETS.find((s) => s.name === set)?.label
  const [items, setItems] = useState<LabelReview[] | null>(null)
  const [idx, setIdx] = useState(0)
  const [active, setActive] = useState(0)
  const [save, setSave] = useState<Save>('saved')
  const [note, setNote] = useState('')
  const [loadErr, setLoadErr] = useState('')
  const [done, setDone] = useState(false)
  const chain = useRef<Promise<void>>(Promise.resolve())
  const pending = useRef(0)

  useEffect(() => {
    if (!label) return
    (practice ? loadTrainingQueue() : loadLabelQueue(set)).then(
      (rs) => {
        setItems(rs)
        setDone(rs.length > 0 && rs.every((r) => r.finished))
        const first = rs.findIndex((r) => !reviewDone(r))
        setIdx(first < 0 ? 0 : first)
      },
      (e) => setLoadErr(e?.message?.includes('not open') ? (practice ? 'The training set is not open yet.' : 'Labelling of this set is not open yet.') : 'Could not load this set. Reload the page to try again.'),
    )
  }, [set, label, practice])

  const persist = useCallback((rev: LabelReview, p: LabelPhrase, d: Dimension, s: Sentiment) => {
    setSave('saving')
    pending.current++
    chain.current = chain.current
      .then(() => (practice ? saveTrainingLabel(rev.reviewId, p.start, p.end, d, s) : saveLabel(p.id, d, s)))
      .then(() => { if (--pending.current === 0) setSave('saved') })
      .catch(() => { pending.current--; setSave('error') })
  }, [practice])

  const tick = (rev: LabelReview, flag: boolean) => {
    setItems((all) => all && all.map((r) => (r.reviewId === rev.reviewId ? { ...r, notGuest: flag } : r)))
    setSave('saving')
    pending.current++
    chain.current = chain.current
      .then(() => setNotGuest(rev.reviewId, flag))
      .then(() => { if (--pending.current === 0) setSave('saved') })
      .catch(() => {
        pending.current--
        setItems((all) => all && all.map((r) => (r.reviewId === rev.reviewId ? { ...r, notGuest: !flag } : r)))
        if (pending.current === 0) setSave('saved') // the tick is undone, so nothing is unsaved
        setNote('The tick was not saved. Try again.')
      })
  }

  const choose = (rev: LabelReview, p: LabelPhrase, patch: Partial<Pick<LabelPhrase, 'dimension' | 'sentiment'>>) => {
    const next = { ...p, ...patch }
    setItems((all) => all && all.map((r) => (r.reviewId !== rev.reviewId ? r : { ...r, phrases: r.phrases.map((q) => (q.id === p.id ? next : q)) })))
    if (next.dimension && next.sentiment) persist(rev, p, next.dimension, next.sentiment)
  }

  if (!label) return <p className="error">Unknown set.</p>
  if (loadErr) return <section className="page"><p role="alert" className="error">{loadErr}</p><Link to={practice ? '/split' : '/label'}>Back to the sets</Link></section>
  if (!items) return <p>Loading…</p>
  if (items.length === 0) return <section className="page"><h1>{label}</h1><p>{practice ? 'Nothing to label yet. Split a training review completely on the Splitting page first; it then appears here.' : 'This set has no reviews to label.'}</p>{practice && <Link to="/split">Back to splitting</Link>}</section>
  if (done)
    return (
      <section className="page">
        <h1>{label}: finished</h1>
        <p>You finished labelling this set and your labels are locked. If something needs to change, ask the lead researcher to unlock it.</p>
        <Link to="/label">Back to the sets</Link>
      </section>
    )
  const rev = items[idx]
  const cps = Array.from(rev.body)
  const last = idx === items.length - 1
  const todo = items.map((r, i) => (reviewDone(r) ? -1 : i)).filter((i) => i >= 0)
  const busy = save !== 'saved'
  const here = Math.min(active, rev.phrases.length - 1)
  const go = (i: number) => { setIdx(i); setActive(0); setNote('') }

  const finish = async () => {
    try { await finishLabels(set); setDone(true) } catch { setNote('Could not finish the set. Check that every phrase has a label and a sentiment, then try again.') }
  }

  return (
    <section className="split">
      <header className="split-head">
        <h1>{label}: labelling</h1>
        <span>Review {idx + 1} of {items.length}</span>
        <progress max={items.length} value={items.length - todo.length} aria-label="Reviews fully labelled" />
        <a href="/codebook" target="_blank" rel="noopener noreferrer">Codebook<span className="sr-only"> (opens in a new tab)</span></a>
      </header>

      <p className="instruction">Choose one label and one sentiment for each phrase. The phrase you are labelling is highlighted in the review.{practice && ' This is practice: your phrases are labelled directly, nothing is checked or counted, and you can stop at any time.'}</p>

      <p className="review small" lang={rev.lang === 'id' ? 'id' : 'en'}>
        {segmentsOf(cps.length, rev.phrases).map((g) => (
          <span key={g.start} className={g.n === null ? 'gap' : g.n === here ? `phrase m${(g.n % 5) + 1}` : 'phrase faint'} data-n={g.n === null ? undefined : g.n + 1}>
            {cps.slice(g.start, g.end).join('')}
          </span>
        ))}
      </p>

      {!practice && <label className="check"><input type="checkbox" checked={rev.notGuest} onChange={(e) => tick(rev, e.target.checked)} /> This reviewer did not stay at the hotel (delivery, job applicant, supplier, restaurant, spa or day visitor)</label>}

      <div className="status" role="status" aria-live="polite">
        <span className={reviewDone(rev) ? 'ok' : ''}>{reviewDone(rev) ? 'Every phrase is labelled.' : `${rev.phrases.filter((p) => !labelled(p)).length} of ${rev.phrases.length} phrases still need a label and a sentiment.`}</span>
        <span className={`save ${save}`}>{save === 'saving' ? 'Saving…' : save === 'saved' ? 'Saved' : 'Not saved. Choose the label again to retry.'}</span>
      </div>

      <ol className="lcards">
        {rev.phrases.map((p, i) => (
          <li key={p.id} className={`m${(i % 5) + 1}${i === here ? ' on' : ''}`} onFocus={() => setActive(i)} onMouseEnter={() => setActive(i)}>
            <p className="ltxt"><span className="num">{i + 1}</span>{p.text}</p>
            <fieldset>
              <legend>Label</legend>
              {DIMENSIONS.map((d) => (
                <label key={d.code} className={p.dimension === d.code ? 'chip on' : 'chip'}>
                  <input type="radio" name={`d${p.id}`} checked={p.dimension === d.code} onChange={() => choose(rev, p, { dimension: d.code })} />
                  {d.name}
                </label>
              ))}
            </fieldset>
            <fieldset>
              <legend>Sentiment</legend>
              {SENTIMENTS.map((s) => (
                <label key={s.code} className={p.sentiment === s.code ? `chip on ${s.code}` : 'chip'}>
                  <input type="radio" name={`s${p.id}`} checked={p.sentiment === s.code} onChange={() => choose(rev, p, { sentiment: s.code })} />
                  {s.name}
                </label>
              ))}
            </fieldset>
          </li>
        ))}
      </ol>

      {note && <p className="status"><span className="error">{note}</span></p>}
      <div className="actions">
        <button className="btn" disabled={idx === 0 || busy} onClick={() => go(idx - 1)}>Back</button>
        <span className="grow" />
        {last && practice ? (
          <Link className="btn primary" to="/split">Back to splitting</Link>
        ) : last ? (
          <button className="btn primary" disabled={busy || todo.length > 0} onClick={finish}>Finish set</button>
        ) : (
          <button className="btn primary" disabled={!reviewDone(rev) || busy} onClick={() => go(idx + 1)}>Next</button>
        )}
      </div>
      {last && !practice && todo.length > 0 && (
        <p className="status">
          {todo.length} {todo.length === 1 ? 'review is' : 'reviews are'} not fully labelled.{' '}
          <button className="btn quiet" onClick={() => go(todo[0])}>Go to review {todo[0] + 1}</button>
        </p>
      )}
      {last && !practice && todo.length === 0 && <p className="status">Finishing locks all your labels in this set.</p>}
    </section>
  )
}
