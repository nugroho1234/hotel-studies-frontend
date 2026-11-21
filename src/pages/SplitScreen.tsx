import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { Link, useParams } from 'react-router-dom'
import { SETS, finishSet, loadQueue, saveSplits, type QueueItem, type SetName } from '../split/api'
import { addPhrase, isComplete, phraseText, snapSelection, uncoveredWords, utf16ToCodePoint, type Phrase } from '../split/splitting'

type Save = 'saved' | 'saving' | 'error'

/** Code-point offset of a DOM selection boundary inside the review element (segments carry data-s). */
function offsetOf(root: HTMLElement, node: Node, off: number, body: string): number | null {
  if (!root.contains(node)) return null
  if (node === root) {
    const child = root.childNodes[off] as HTMLElement | undefined
    return child ? Number(child.dataset.s) : Array.from(body).length
  }
  const seg = (node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement))?.closest<HTMLElement>('[data-s]')
  if (!seg || !root.contains(seg)) return null
  const start = Number(seg.dataset.s)
  if (node.nodeType === Node.TEXT_NODE) return start + utf16ToCodePoint(node.textContent ?? '', off)
  return start + (off === 0 ? 0 : Array.from(seg.textContent ?? '').length)
}

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
  const rootRef = useRef<HTMLParagraphElement>(null)

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

  // Highlight: when the pointer is released with a selection inside the review text, turn it into a phrase.
  useEffect(() => {
    if (!item) return
    const onUp = () => {
      const root = rootRef.current
      const sel = window.getSelection()
      if (!root || !sel || sel.isCollapsed || sel.rangeCount === 0) return
      const r = sel.getRangeAt(0)
      const a = offsetOf(root, r.startContainer, r.startOffset, item.body)
      const b = offsetOf(root, r.endContainer, r.endOffset, item.body)
      if (a === null || b === null) return
      sel.removeAllRanges()
      const p = snapSelection(item.body, a, b)
      if (!p) return setNote('')
      const next = addPhrase(cur, p)
      if (!next) return setNote('That overlaps a phrase you already marked. Delete that phrase first.')
      setNote('')
      persist(item.reviewId, next)
    }
    document.addEventListener('pointerup', onUp)
    return () => document.removeEventListener('pointerup', onUp)
  }, [item, cur, persist])

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
  const segs: { s: number; e: number; n: number | null }[] = []
  let at = 0
  cur.forEach((p, i) => {
    if (p.start > at) segs.push({ s: at, e: p.start, n: null })
    segs.push({ s: p.start, e: p.end, n: i })
    at = p.end
  })
  if (at < cps.length) segs.push({ s: at, e: cps.length, n: null })

  const complete = isComplete(item.body, cur)
  const left = uncoveredWords(item.body, cur).length
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

      <p className="review" ref={rootRef} lang={item.lang === 'id' ? 'id' : 'en'}>
        {segs.map((g) => (
          <span key={g.s} data-s={g.s} className={g.n === null ? 'gap' : `phrase m${(g.n % 5) + 1}`} data-n={g.n === null ? undefined : g.n + 1}>
            {cps.slice(g.s, g.e).join('')}
          </span>
        ))}
      </p>

      <div className="status" role="status" aria-live="polite">
        {note ? <span className="error">{note}</span> : complete ? <span className="ok">Every word is in a phrase.</span> : <span>{left} {left === 1 ? 'word is' : 'words are'} not in a phrase yet.</span>}
        <span className={`save ${save}`}>
          {save === 'saving' ? 'Saving…' : save === 'saved' ? 'Saved' : 'Not saved'}
          {save === 'error' && <button className="btn quiet" onClick={() => persist(item.reviewId, cur)}>Try again</button>}
        </span>
      </div>

      <ol className="cards">
        {cur.map((p, i) => (
          <li key={p.start} className={`m${(i % 5) + 1}`}>
            <span className="num">{i + 1}</span>
            <span className="txt">{phraseText(item.body, p)}</span>
            <button className="btn quiet" onClick={() => persist(item.reviewId, cur.filter((_, j) => j !== i))}>Delete<span className="sr-only"> phrase {i + 1}</span></button>
          </li>
        ))}
      </ol>

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
