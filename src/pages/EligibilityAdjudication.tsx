import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { REASONS } from '../split/api'

type Row = { review_id: number; lang: string; body: string; source: 'coders' | 'llm_e3_check'; decisions: { coder: string; eligible: boolean; reason: string | null }[] }

/** The lead decides each review a coder excluded, and checks each review the LLM flagged as not a guest. */
export default function EligibilityAdjudication() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const [reason, setReason] = useState<Record<number, string>>({})
  const [why, setWhy] = useState<Record<number, string>>({})
  const [rule, setRule] = useState<Record<number, boolean>>({})

  const load = useCallback(async () => {
    const { data, error } = await supabase.rpc('eligibility_queue')
    if (error) throw error
    setRows(data as Row[])
  }, [])
  useEffect(() => { load().catch(() => setErr('Could not load the eligibility queue. Reload the page to try again.')) }, [load])

  const decide = async (r: Row, code: string | null) => {
    setBusy(true)
    setErr('')
    const { error } = await supabase.rpc('adjudicate_eligibility', {
      p_review: r.review_id, p_eligible: code === null, p_reason: code, p_rationale: why[r.review_id] ?? '', p_rule_update: rule[r.review_id] ?? false, p_source: r.source,
    })
    if (error) setErr(`That did not work: ${error.message}`)
    else await load().catch(() => setErr('Saved, but the list could not be reloaded.'))
    setBusy(false)
  }

  if (!rows) return err ? <p role="alert" className="error">{err}</p> : <p>Loading…</p>
  return (
    <section className="page">
      <h1>Eligibility</h1>
      <p className="note">Reviews a coder excluded, and reviews the LLM flagged as not a guest (manual check). Excluding takes the review out of the sample; select-reviews then replaces it with the hotel's next newest eligible review (reviews in a coded set are removed, not replaced). A rationale is required.</p>
      {err && <p role="alert" className="error">{err}</p>}
      {rows.length === 0 && <p>Nothing to decide.</p>}
      {rows.map((r) => (
        <article key={r.review_id} className="elig-row">
          <h2>Review {r.review_id} <small>({r.lang}; {r.source === 'coders' ? 'excluded by a coder' : 'flagged by the LLM: not a guest'})</small></h2>
          <p className="ltxt">{r.body}</p>
          {r.decisions.length > 0 && <ul>{r.decisions.map((d) => <li key={d.coder}>Coder {d.coder.slice(0, 4)}: {d.eligible ? 'eligible' : `excluded (${d.reason})`}</li>)}</ul>}
          <label>Rationale <input value={why[r.review_id] ?? ''} onChange={(e) => setWhy({ ...why, [r.review_id]: e.target.value })} /></label>
          <label><input type="checkbox" checked={rule[r.review_id] ?? false} onChange={(e) => setRule({ ...rule, [r.review_id]: e.target.checked })} /> creates a rule update</label>
          <div className="actions">
            <button className="btn" disabled={busy} onClick={() => decide(r, null)}>Keep: eligible</button>
            {r.source === 'coders' && (
              <select aria-label="Reason" value={reason[r.review_id] ?? r.decisions.find((d) => !d.eligible)?.reason ?? REASONS[0].code} onChange={(e) => setReason({ ...reason, [r.review_id]: e.target.value })}>
                {REASONS.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}
              </select>
            )}
            <button className="btn primary" disabled={busy} onClick={() => decide(r, r.source === 'coders' ? (reason[r.review_id] ?? r.decisions.find((d) => !d.eligible)?.reason ?? REASONS[0].code) : 'E3_not_guest')}>Exclude</button>
          </div>
        </article>
      ))}
    </section>
  )
}
