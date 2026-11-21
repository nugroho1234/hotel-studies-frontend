import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SETS, finishSet, loadQueue, saveSplits, type QueueItem, type SetName } from '../split/api'
import PhraseEditor from '../split/PhraseEditor'
import { isComplete, snapSelection, type Phrase } from '../split/splitting'

type Save = 'saved' | 'saving' | 'error'

export default function SplitScreen() {
  const set = useParams().set as SetName
  const label = SETS.find((s) => s.name === set)?.label
  const [items, setItems] = useState<QueueItem[] | null>(null)
  const [phrases, setPhrases] = useState<Record<number, Phrase[]>>({})
  const [idx, setIdx] = useState(0)
  const [save, setSave] = useState<Save>('saved')
  const [note, setNote] = useState('')
  const [loadErr, setLoadErr] = useState('')
  const [done, setDone] = useState(false)
  const chain = useRef<Promise<void>>(Promise.resolve())
  const pending = useRef(0)

  useEffect(() => {
    if (!label) return
    loadQueue(set).then(
      ({ items, saved }) => {
        setItems(items)
        setPhrases(saved)
        setDone(items.length > 0 && items.every((i) => i.finished))
        const first = items.findIndex((i) => !isComplete(i.body, saved[i.reviewId] ?? []))
        setIdx(first < 0 ? 0 : first)
      },
      (e) => setLoadErr(e?.message?.includes('not open') ? 'This set is not open yet.' : 'Could not load this set. Reload the page to try again.'),
    )
  }, [set, label])

  const item = items?.[idx]
  const cur = useMemo(() => (item ? phrases[item.reviewId] ?? [] : []), [item, phrases])

  const persist = useCallback((reviewId: number, next: Phrase[]) => {
    setPhrases((p) => ({ ...p, [reviewId]: next }))
    setSave('saving')
    pending.current++
    chain.current = chain.current
      .then(() => saveSplits(reviewId, next))
      .then(() => { if (--pending.current === 0) setSave('saved') })
      .catch(() => { pending.current--; setSave('error') })
  }, [])

  if (!label) return <p className="error">Unknown set.</p>
  if (loadErr) return <section className="page"><p role="alert" className="error">{loadErr}</p><Link to="/split">Back to the sets</Link></section>
  if (!items) return <p>Loading…</p>
  if (items.length === 0) return <section className="page"><h1>{label}</h1><p>This set has no reviews.</p></section>
  if (done)
    return (
      <section className="page">
        <h1>{label}: finished</h1>
        <p>You finished this set and your splits are locked. If something needs to change, ask the lead researcher to unlock it.</p>
        <Link to="/split">Back to the sets</Link>
      </section>
    )
  if (!item) return null

  const cps = Array.from(item.body)
  const complete = isComplete(item.body, cur)
  const incomplete = items.map((it, i) => (isComplete(it.body, phrases[it.reviewId] ?? []) ? -1 : i)).filter((i) => i >= 0)
  const last = idx === items.length - 1
  const busy = save !== 'saved'

  const finish = async () => {
    try {
      await finishSet(set)
      setDone(true)
    } catch {
      setNote('Could not finish the set. Check that every review is fully split, then try again.')
    }
  }

  return (
    <section className="split">
      <header className="split-head">
        <h1>{label}</h1>
        <span>Review {idx + 1} of {items.length}</span>
        <progress max={items.length} value={items.length - incomplete.length} aria-label="Reviews fully split" />
        <a href="/codebook" target="_blank" rel="noopener noreferrer">Splitting rules<span className="sr-only"> (opens in a new tab)</span></a>
      </header>

      <p className="instruction">Highlight each phrase with the mouse. Every word must end up in exactly one phrase.</p>

      <PhraseEditor
        body={item.body}
        lang={item.lang}
        phrases={cur}
        onChange={(next) => { setNote(''); persist(item.reviewId, next) }}
        extra={
          <span className={`save ${save}`}>
            {save === 'saving' ? 'Saving…' : save === 'saved' ? 'Saved' : 'Not saved'}
            {save === 'error' && <button className="btn quiet" onClick={() => persist(item.reviewId, cur)}>Try again</button>}
          </span>
        }
      />
      {note && <p className="status"><span className="error">{note}</span></p>}

      <div className="actions">
        <button className="btn" disabled={idx === 0 || busy} onClick={() => { setIdx(idx - 1); setNote('') }}>Back</button>
        <button className="btn" disabled={cur.length === 0} onClick={() => persist(item.reviewId, [])}>Reset</button>
        <button className="btn" disabled={cur.length > 0} onClick={() => { const p = snapSelection(item.body, 0, cps.length); if (p) persist(item.reviewId, [p]) }}>Whole review is one phrase</button>
        <span className="grow" />
        {last ? (
          <button className="btn primary" disabled={busy || incomplete.length > 0} onClick={finish}>Finish set</button>
        ) : (
          <button className="btn primary" disabled={!complete || busy} onClick={() => { setIdx(idx + 1); setNote('') }}>Next</button>
        )}
      </div>
      {last && incomplete.length > 0 && (
        <p className="status">
          {incomplete.length} {incomplete.length === 1 ? 'review is' : 'reviews are'} not fully split.{' '}
          <button className="btn quiet" onClick={() => setIdx(incomplete[0])}>Go to review {incomplete[0] + 1}</button>
        </p>
      )}
      {last && incomplete.length === 0 && <p className="status">Finishing locks all your splits in this set.</p>}
    </section>
  )
}
