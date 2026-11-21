import { useCallback, useEffect, useMemo, useState } from 'react'
import { DIMENSIONS, SENTIMENTS } from '../label/scheme'
import { segmentsOf } from '../split/splitting'
import { acceptIdenticalLabels, lastLabelDecision, loadStaffData, saveLabelAdjudication, type Lab, type StaffData } from '../stats/api'

type SetKey = 'dev' | 'test'
type Filter = 'todo' | 'decided' | 'same'
const SET_LABEL: Record<SetKey, string> = { dev: 'Development', test: 'Test' }
const dimName = (c: string) => DIMENSIONS.find((d) => d.code === c)?.name ?? c
const sentName = (c: string) => SENTIMENTS.find((s) => s.code === c)?.name ?? c
const show = (l: Lab) => `${dimName(l.dimension)}, ${sentName(l.sentiment).toLowerCase()}`

/** The lead decides the gold label of each phrase the two coders labelled differently. */
export default function LabelAdjudication() {
  const [d, setD] = useState<StaffData | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [set, setSet] = useState<SetKey>('dev')
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [filter, setFilter] = useState<Filter>('todo')
  const [sel, setSel] = useState<number | null>(null)
  const [dim, setDim] = useState('')
  const [sent, setSent] = useState('')
  const [reason, setReason] = useState('')
  const [gap, setGap] = useState(false)
  const [last, setLast] = useState<{ reason: string; gap: boolean; at: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const data = await loadStaffData()
      setD(data)
      const fin = (id: string) => data.labelFinished[id] !== undefined
      setA((x) => x || (data.coders.find((c) => fin(c.id)) ?? data.coders[0])?.id || '')
      setB((x) => x || (data.coders.filter((c) => fin(c.id))[1] ?? data.coders[1])?.id || '')
    } catch { setErr('Could not load the data. Reload the page to try again.') }
  }, [])
  useEffect(() => { load() }, [load])

  const info = useMemo(() => new Map((d?.meta ?? []).map((m) => [m.reviewId, m])), [d])
  const rows = useMemo(() => {
    if (!d || !a || !b || a === b) return []
    return d.agreedPhrases.flatMap((p) => {
      const m = info.get(p.reviewId)
      const la = d.labels[a]?.[p.phraseId]
      const lb = d.labels[b]?.[p.phraseId]
      if (!m || m.set !== set || !la || !lb || !d.labelFinished[a]?.[p.reviewId] || !d.labelFinished[b]?.[p.reviewId]) return []
      return [{ p, m, la, lb, same: la.dimension === lb.dimension && la.sentiment === lb.sentiment, decided: d.gold[p.phraseId] !== undefined }]
    })
  }, [d, a, b, set, info])

  const todo = rows.filter((r) => !r.same && !r.decided)
  const decided = rows.filter((r) => !r.same && r.decided)
  const same = rows.filter((r) => r.same)
  const sameOpen = same.filter((r) => !r.decided).length
  const shown = filter === 'todo' ? todo : filter === 'decided' ? decided : same
  const cur = rows.find((r) => r.p.phraseId === sel)

  const choose = (id: number | null) => {
    setSel(id)
    setReason('')
    setGap(false)
    setLast(null)
    const r = rows.find((x) => x.p.phraseId === id)
    const g = r && d?.gold[r.p.phraseId]
    setDim(g ? g.dimension : '')
    setSent(g ? g.sentiment : '')
    if (id !== null) lastLabelDecision(id).then(setLast, () => setLast(null))
  }

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setErr('')
    try { await fn(); await load() } catch (e) { setErr(`That did not work: ${(e as { message?: string })?.message ?? 'unknown error'}`) }
    setBusy(false)
  }

  if (err && !d) return <p role="alert" className="error">{err}</p>
  if (!d) return <p>Loading…</p>
  const pairOk = a && b && a !== b
  const name = (id: string) => d.coders.find((c) => c.id === id)?.name
  const canSave = cur && dim !== '' && sent !== '' && reason.trim() !== ''
  const segs = cur ? Array.from(cur.m.body) : []

  return (
    <section className="adj">
      <h1>Adjudication: labels</h1>
      <p className="note">
        Where the two coders chose a different label or sentiment for a phrase, you decide the gold label, with a reason. If the codebook does not settle the case, tick the codebook-gap box.
        The coders' original labels are never changed, and each decision is written to the log with both versions and the codebook version.
      </p>

      <div className="pick">
        <label>Set
          <select value={set} onChange={(e) => { setSet(e.target.value as SetKey); choose(null) }}>
            {(['dev', 'test'] as SetKey[]).map((s) => <option key={s} value={s}>{SET_LABEL[s]}</option>)}
          </select>
        </label>
        <label>Coder
          <select value={a} onChange={(e) => { setA(e.target.value); choose(null) }}>{d.coders.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
        <label>Coder
          <select value={b} onChange={(e) => { setB(e.target.value); choose(null) }}>{d.coders.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}</select>
        </label>
      </div>
      {!pairOk && <p className="error">Choose two different coders.</p>}
      {err && <p role="alert" className="error">{err}</p>}

      <p>
        {rows.length} phrases are labelled by both coders: {same.length} identical, {todo.length + decided.length} different ({decided.length} decided, {todo.length} to decide).
      </p>
      {sameOpen > 0 && (
        <p><button className="btn" disabled={busy || !pairOk} onClick={() => run(() => acceptIdenticalLabels(set, a, b))}>Accept {sameOpen} identical {sameOpen === 1 ? 'label' : 'labels'}</button></p>
      )}

      <div className="adj-grid">
        <div>
          <div className="tabs" role="tablist" aria-label="Phrases">
            {([['todo', `To decide (${todo.length})`], ['decided', `Decided (${decided.length})`], ['same', `Identical (${same.length})`]] as [Filter, string][]).map(([k, t]) => (
              <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'tab on' : 'tab'} onClick={() => setFilter(k)}>{t}</button>
            ))}
          </div>
          <ul className="rlist">
            {shown.length === 0 && <li className="note">Nothing here.</li>}
            {shown.map((r) => (
              <li key={r.p.phraseId}>
                <button className={r.p.phraseId === sel ? 'item on' : 'item'} onClick={() => choose(r.p.phraseId)}>
                  <span>{Array.from(r.p.text).slice(0, 48).join('')}…</span>
                  <small>{r.la.dimension} {r.la.sentiment[0].toUpperCase()} vs {r.lb.dimension} {r.lb.sentiment[0].toUpperCase()}</small>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          {!cur && <p className="note">Pick a phrase from the list.</p>}
          {cur && (
            <>
              <p className="review small" lang={cur.m.lang === 'id' ? 'id' : 'en'}>
                {segmentsOf(segs.length, d.agreedPhrases.filter((x) => x.reviewId === cur.p.reviewId)).map((g) => (
                  <span key={g.start} className={g.start === cur.p.start ? 'phrase m1' : g.n === null ? 'gap' : 'phrase faint'}>{segs.slice(g.start, g.end).join('')}</span>
                ))}
              </p>
              <p><strong>{name(a)}:</strong> {show(cur.la)}</p>
              <p><strong>{name(b)}:</strong> {show(cur.lb)}</p>

              <h2 className="who2">Gold label{cur.decided ? '' : ' (not saved yet)'}</h2>
              <div className="actions">
                <button className="btn" onClick={() => { setDim(cur.la.dimension); setSent(cur.la.sentiment) }}>Use {name(a)}'s</button>
                <button className="btn" onClick={() => { setDim(cur.lb.dimension); setSent(cur.lb.sentiment) }}>Use {name(b)}'s</button>
              </div>
              <fieldset className="chips">
                <legend>Label</legend>
                {DIMENSIONS.map((x) => (
                  <label key={x.code} className={dim === x.code ? 'chip on' : 'chip'}>
                    <input type="radio" name="gd" checked={dim === x.code} onChange={() => setDim(x.code)} />{x.name}
                  </label>
                ))}
              </fieldset>
              <fieldset className="chips">
                <legend>Sentiment</legend>
                {SENTIMENTS.map((x) => (
                  <label key={x.code} className={sent === x.code ? 'chip on' : 'chip'}>
                    <input type="radio" name="gs" checked={sent === x.code} onChange={() => setSent(x.code)} />{x.name}
                  </label>
                ))}
              </fieldset>
              <label className="reason">Reason for the decision
                <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: codebook rule for staff attitude, so this is Assurance." />
              </label>
              <label className="check"><input type="checkbox" checked={gap} onChange={(e) => setGap(e.target.checked)} /> The codebook does not settle this case (log as a codebook gap)</label>
              {last && <p className="note">Last decision: {last.reason}{last.gap ? ' (codebook gap)' : ''} ({new Date(last.at).toLocaleDateString()})</p>}
              <button className="btn primary" disabled={!canSave || busy}
                onClick={() => run(async () => {
                  await saveLabelAdjudication(cur.p.phraseId, a, b, dim, sent, reason, gap)
                  choose(todo.find((r) => r.p.phraseId !== cur.p.phraseId)?.p.phraseId ?? null)
                })}>
                Save decision
              </button>
            </>
          )}
        </div>
      </div>
    </section>
  )
}
