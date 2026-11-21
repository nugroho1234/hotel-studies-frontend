import { useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import PhraseEditor, { PhraseView } from '../split/PhraseEditor'
import { isComplete, sameSplit, type Phrase } from '../split/splitting'
import { acceptIdentical, lastDecision, loadAgreed, loadStaffData, saveAdjudication, type StaffData } from '../stats/api'

type SetKey = 'dev' | 'test'
type Filter = 'todo' | 'decided' | 'same'
const SET_LABEL: Record<SetKey, string> = { dev: 'Development', test: 'Test' }

export default function Adjudication() {
  const { profile } = useAuth()
  const isLead = profile?.role === 'lead'
  const [d, setD] = useState<StaffData | null>(null)
  const [agreed, setAgreed] = useState<Record<number, Phrase[]>>({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [set, setSet] = useState<SetKey>('dev')
  const [a, setA] = useState('')
  const [b, setB] = useState('')
  const [filter, setFilter] = useState<Filter>('todo')
  const [sel, setSel] = useState<number | null>(null)
  const [draft, setDraft] = useState<Phrase[]>([])
  const [reason, setReason] = useState('')
  const [last, setLast] = useState<{ reason: string; at: string } | null>(null)

  const load = useCallback(async () => {
    try {
      const [data, ag] = await Promise.all([loadStaffData(), loadAgreed()])
      setD(data)
      setAgreed(ag)
      // Default pair: the first two coders who have finished something.
      setA((x) => x || (data.coders.find((c) => data.finished[c.id]) ?? data.coders[0])?.id || '')
      setB((x) => x || (data.coders.filter((c) => data.finished[c.id])[1] ?? data.coders[1])?.id || '')
    } catch { setErr('Could not load the data. Reload the page to try again.') }
  }, [])
  useEffect(() => { load() }, [load])

  const rows = useMemo(() => {
    if (!d || !a || !b || a === b) return []
    return d.meta.filter((m) => m.set === set && d.finished[a]?.[m.reviewId] && d.finished[b]?.[m.reviewId]).map((m) => {
      const sa = d.splits[a]?.[m.reviewId] ?? []
      const sb = d.splits[b]?.[m.reviewId] ?? []
      return { m, sa, sb, same: sameSplit(sa, sb), decided: agreed[m.reviewId] !== undefined }
    })
  }, [d, a, b, set, agreed])

  const total = d ? d.meta.filter((m) => m.set === set).length : 0
  const todo = rows.filter((r) => !r.same && !r.decided)
  const decided = rows.filter((r) => !r.same && r.decided)
  const same = rows.filter((r) => r.same)
  const sameOpen = same.filter((r) => !r.decided).length
  const shown = filter === 'todo' ? todo : filter === 'decided' ? decided : same
  const cur = rows.find((r) => r.m.reviewId === sel)

  const choose = (id: number | null) => {
    setSel(id)
    setReason('')
    setLast(null)
    const r = rows.find((x) => x.m.reviewId === id)
    setDraft(r ? agreed[r.m.reviewId] ?? r.sa : [])
    if (id !== null) lastDecision(id).then(setLast, () => setLast(null))
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
  const canSave = isLead && cur && isComplete(cur.m.body, draft) && reason.trim() !== ''

  return (
    <section className="adj">
      <h1>Adjudication: splits</h1>
      <p className="note">
        Where the two coders split a review differently, the lead researcher decides the agreed phrases, with a reason. The coders' original splits are never changed.
        Each decision is written to the adjudication log with both versions.{!isLead && ' Only the lead researcher can record decisions.'}
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
        {rows.length} of {total} reviews are finished by both coders: {same.length} identical, {todo.length + decided.length} different ({decided.length} decided, {todo.length} to decide).
      </p>
      {isLead && sameOpen > 0 && (
        <p>
          <button className="btn" disabled={busy || !pairOk} onClick={() => run(() => acceptIdentical(set, a, b))}>Accept {sameOpen} identical {sameOpen === 1 ? 'split' : 'splits'}</button>
        </p>
      )}

      <div className="adj-grid">
        <div>
          <div className="tabs" role="tablist" aria-label="Reviews">
            {([['todo', `To decide (${todo.length})`], ['decided', `Decided (${decided.length})`], ['same', `Identical (${same.length})`]] as [Filter, string][]).map(([k, t]) => (
              <button key={k} role="tab" aria-selected={filter === k} className={filter === k ? 'tab on' : 'tab'} onClick={() => setFilter(k)}>{t}</button>
            ))}
          </div>
          <ul className="rlist">
            {shown.length === 0 && <li className="note">Nothing here.</li>}
            {shown.map((r) => (
              <li key={r.m.reviewId}>
                <button className={r.m.reviewId === sel ? 'item on' : 'item'} onClick={() => choose(r.m.reviewId)}>
                  <span>{Array.from(r.m.body.trim()).slice(0, 48).join('')}…</span>
                  <small>{r.sa.length} vs {r.sb.length} phrases</small>
                </button>
              </li>
            ))}
          </ul>
        </div>

        <div>
          {!cur && <p className="note">Pick a review from the list.</p>}
          {cur && (
            <>
              <h2 className="who2">{d.coders.find((c) => c.id === a)?.name}</h2>
              <PhraseView body={cur.m.body} lang={cur.m.lang} phrases={cur.sa} />
              <h2 className="who2">{d.coders.find((c) => c.id === b)?.name}</h2>
              <PhraseView body={cur.m.body} lang={cur.m.lang} phrases={cur.sb} />
              <h2 className="who2">Agreed phrases{cur.decided ? '' : ' (not saved yet)'}</h2>
              {isLead ? (
                <>
                  <div className="actions">
                    <button className="btn" onClick={() => setDraft(cur.sa)}>Start from {d.coders.find((c) => c.id === a)?.name}</button>
                    <button className="btn" onClick={() => setDraft(cur.sb)}>Start from {d.coders.find((c) => c.id === b)?.name}</button>
                    <button className="btn" disabled={draft.length === 0} onClick={() => setDraft([])}>Clear</button>
                  </div>
                  <PhraseEditor body={cur.m.body} lang={cur.m.lang} phrases={draft} onChange={setDraft} />
                  <label className="reason">Reason for the decision
                    <textarea rows={2} value={reason} onChange={(e) => setReason(e.target.value)} placeholder="For example: codebook rule 3, a new clause starts after the emoji." />
                  </label>
                  {last && <p className="note">Last decision: {last.reason} ({new Date(last.at).toLocaleDateString()})</p>}
                  <button className="btn primary" disabled={!canSave || busy} onClick={() => run(async () => { await saveAdjudication(cur.m.reviewId, a, b, draft, reason); const next = todo.find((r) => r.m.reviewId !== cur.m.reviewId); choose(next?.m.reviewId ?? null) })}>
                    Save decision
                  </button>
                </>
              ) : (
                <>
                  <PhraseView body={cur.m.body} lang={cur.m.lang} phrases={agreed[cur.m.reviewId] ?? []} />
                  {last && <p className="note">Decision: {last.reason} ({new Date(last.at).toLocaleDateString()})</p>}
                </>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  )
}
