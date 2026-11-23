import { useCallback, useEffect, useState } from 'react'
import { acceptIdenticalNotGuest, listNotGuestRows, notGuestAgreement, saveNotGuestGold, type NotGuestRow } from '../label/notGuest'

type Agreement = Awaited<ReturnType<typeof notGuestAgreement>>

/** The lead confirms the "not a guest" flag of each review the two coders ticked differently. */
export default function NotGuestPanel({ set, a, b }: { set: 'dev' | 'test'; a: string; b: string }) {
  const [ag, setAg] = useState<Agreement | null>(null)
  const [rows, setRows] = useState<NotGuestRow[]>([])
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [choice, setChoice] = useState<Record<number, boolean>>({})
  const [reasons, setReasons] = useState<Record<number, string>>({})
  const ok = !!a && !!b && a !== b

  const load = useCallback(async () => {
    if (!ok) { setAg(null); setRows([]); return }
    const [x, y] = await Promise.all([notGuestAgreement(set, a, b), listNotGuestRows(set, a, b)])
    setAg(x)
    setRows(y)
  }, [set, a, b, ok])
  useEffect(() => { load().catch(() => setErr('Could not load the not-a-guest flags. Reload the page to try again.')) }, [load])

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true)
    setErr('')
    try { await fn(); await load() } catch (e) { setErr(`That did not work: ${(e as { message?: string })?.message ?? 'unknown error'}`) }
    setBusy(false)
  }

  const differ = rows.filter((r) => r.flagA !== r.flagB)
  const same = rows.filter((r) => r.flagA === r.flagB && r.gold === null).length

  return (
    <section>
      <h2 className="who2">Reviews where the writer was not a guest</h2>
      <p className="note">Each coder can tick a review as written by someone who did not stay at the hotel. No tick counts as "not flagged".</p>
      {err && <p role="alert" className="error">{err}</p>}
      {ok && ag && (
        <>
          <p>
            Both ticked: {ag.bothYes}. Neither ticked: {ag.bothNo}. Differ: {ag.disagree}.{' '}
            Agreement: {ag.agreement === null ? 'not available yet' : `${Math.round(ag.agreement * 1000) / 10}%`}.
          </p>
          {same > 0 && <p><button className="btn" disabled={busy} onClick={() => run(() => acceptIdenticalNotGuest(set, a, b))}>Accept reviews where both agree</button></p>}
          {differ.length === 0 && <p className="note">No review with different ticks.</p>}
          <ul className="rlist">
            {differ.map((r) => {
              const v = choice[r.reviewId] ?? r.gold
              const why = reasons[r.reviewId] ?? ''
              return (
                <li key={r.reviewId}>
                  <p className="review small" lang={r.lang === 'id' ? 'id' : 'en'}>{r.body}</p>
                  <p>Coder 1: {r.flagA ? 'not a guest' : 'guest'}. Coder 2: {r.flagB ? 'not a guest' : 'guest'}.{r.gold !== null && ` Decided: ${r.gold ? 'not a guest' : 'guest'}.`}</p>
                  <fieldset className="chips">
                    <legend>Was the writer a guest?</legend>
                    <label className={v === false ? 'chip on' : 'chip'}><input type="radio" name={`ng${r.reviewId}`} checked={v === false} onChange={() => setChoice((c) => ({ ...c, [r.reviewId]: false }))} />Yes, a guest</label>
                    <label className={v === true ? 'chip on' : 'chip'}><input type="radio" name={`ng${r.reviewId}`} checked={v === true} onChange={() => setChoice((c) => ({ ...c, [r.reviewId]: true }))} />No, not a guest</label>
                  </fieldset>
                  <label className="reason">Reason for the decision
                    <textarea rows={2} value={why} onChange={(e) => setReasons((c) => ({ ...c, [r.reviewId]: e.target.value }))} />
                  </label>
                  <button className="btn primary" disabled={busy || v === null || why.trim() === ''} onClick={() => run(() => saveNotGuestGold(r.reviewId, a, b, v as boolean, why))}>Save decision</button>
                </li>
              )
            })}
          </ul>
        </>
      )}
    </section>
  )
}
