import { useCallback, useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { REASONS } from '../split/api'

type Row = { review_id: number; lang: string; body: string; source: 'coders' | 'llm_e3_check'; decisions: { coder: string; eligible: boolean; reason: string | null }[] }
type Choice = 'keep' | 'exclude'
const reasonLabel = (code: string | null) => REASONS.find((r) => r.code === code)?.label ?? code ?? ''

/** The lead decides each review a coder excluded, and checks each review the LLM flagged as not a guest. */
export default function EligibilityAdjudication() {
  const [rows, setRows] = useState<Row[] | null>(null)
  const [names, setNames] = useState<Record<string, string>>({})
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState<number | null>(null)
  const [choice, setChoice] = useState<Record<number, Choice>>({})
  const [reason, setReason] = useState<Record<number, string>>({})
  const [why, setWhy] = useState<Record<number, string>>({})
  const [rule, setRule] = useState<Record<number, boolean>>({})

  const load = useCallback(async () => {
    const [q, p] = await Promise.all([supabase.rpc('eligibility_queue'), supabase.from('profiles').select('user_id,display_name')])
    if (q.error) throw q.error
    setRows(q.data as Row[])
    setNames(Object.fromEntries((p.data ?? []).map((x) => [x.user_id as string, x.display_name as string])))
  }, [])
  useEffect(() => { load().catch((e) => setErr(e?.message?.includes('lead only') ? 'Only the lead researcher can open this page. You are signed in with a different role.' : 'Could not load the eligibility queue. Reload the page to try again.')) }, [load])

  const save = async (r: Row, code: string | null) => {
    setBusy(r.review_id)
    setErr('')
    const { error } = await supabase.rpc('adjudicate_eligibility', {
      p_review: r.review_id, p_eligible: code === null, p_reason: code, p_rationale: why[r.review_id]?.trim() ?? '', p_rule_update: rule[r.review_id] ?? false, p_source: r.source,
    })
    if (error) setErr(`That did not work: ${error.message}`)
    else await load().catch(() => setErr('Saved, but the list could not be reloaded.'))
    setBusy(null)
  }

  if (!rows) return err ? <p role="alert" className="error">{err}</p> : <p>Loading…</p>
  return (
    <section className="elig">
      <h1>Eligibility rulings</h1>
      <p className="note">
        {rows.length === 0 ? 'Nothing is waiting.' : `${rows.length} ${rows.length === 1 ? 'review is' : 'reviews are'} waiting for your ruling.`}{' '}
        A review appears here when a coder excludes it while splitting, or when the LLM flags its writer as not a guest.
      </p>
      {err && <p role="alert" className="error">{err}</p>}
      {rows.length === 0 && <p className="elig-empty">Coders' exclusions and the LLM's not-a-guest flags will show up here as they come in.</p>}

      {rows.map((r) => {
        const id = r.review_id
        const pick = choice[id]
        const code = r.source === 'coders' ? (reason[id] ?? r.decisions.find((d) => !d.eligible)?.reason ?? REASONS[0].code) : 'E3_not_guest'
        const ready = pick !== undefined && (why[id] ?? '').trim() !== ''
        return (
          <article key={id} className="elig-card" aria-labelledby={`e${id}`}>
            <div className="elig-read">
              <header>
                <h2 id={`e${id}`}>Review {id}</h2>
                <span className={r.source === 'coders' ? 'tag coder' : 'tag llm'}>{r.source === 'coders' ? 'Excluded by a coder' : 'LLM: writer was not a guest'}</span>
                <span className="tag lang">{r.lang === 'id' ? 'Indonesian' : r.lang === 'en' ? 'English' : r.lang}</span>
              </header>
              <p className="elig-text" lang={r.lang === 'id' ? 'id' : 'en'}>{r.body}</p>
              {r.decisions.length > 0 && (
                <ul className="elig-who">
                  {r.decisions.map((d) => (
                    <li key={d.coder} className={d.eligible ? 'ok' : 'out'}>
                      <strong>{names[d.coder] ?? 'A coder'}</strong> {d.eligible ? 'marked it eligible' : <>excluded it: {reasonLabel(d.reason)}</>}
                    </li>
                  ))}
                </ul>
              )}
            </div>

            <fieldset className="elig-rule" disabled={busy === id}>
              <legend>Your ruling</legend>
              <div className="elig-tiles">
                <label className={pick === 'keep' ? 'tile on keep' : 'tile keep'}>
                  <input type="radio" name={`c${id}`} checked={pick === 'keep'} onChange={() => setChoice({ ...choice, [id]: 'keep' })} />
                  <b>Keep in the sample</b>
                  <span>The writer was a guest or a day visitor.</span>
                </label>
                <label className={pick === 'exclude' ? 'tile on out' : 'tile out'}>
                  <input type="radio" name={`c${id}`} checked={pick === 'exclude'} onChange={() => setChoice({ ...choice, [id]: 'exclude' })} />
                  <b>Take out of the sample</b>
                  <span>{r.source === 'coders' ? reasonLabel(code) : 'E3: the writer was not a guest'}</span>
                </label>
              </div>

              {pick === 'exclude' && r.source === 'coders' && (
                <label className="elig-field">Reason
                  <select value={code} onChange={(e) => setReason({ ...reason, [id]: e.target.value })}>
                    {REASONS.map((x) => <option key={x.code} value={x.code}>{x.label}</option>)}
                  </select>
                </label>
              )}

              <p className="elig-effect" aria-live="polite">
                {pick === undefined && 'Choose what happens to this review.'}
                {pick === 'keep' && 'The review stays selected. Your ruling is kept on file, so it will not come back to this list.'}
                {pick === 'exclude' && 'The review leaves the sample now. The next run of select-reviews adds the hotel’s next newest eligible review; in a coded set it is removed without a replacement.'}
              </p>

              <label className="elig-field">Why (required)
                <textarea rows={2} value={why[id] ?? ''} onChange={(e) => setWhy({ ...why, [id]: e.target.value })} placeholder="One sentence the paper can cite." />
              </label>
              <label className="check"><input type="checkbox" checked={rule[id] ?? false} onChange={(e) => setRule({ ...rule, [id]: e.target.checked })} /> This ruling changes a codebook rule</label>
              <button className="btn primary" disabled={!ready || busy !== null} onClick={() => save(r, pick === 'keep' ? null : code)}>
                {busy === id ? 'Saving…' : 'Save ruling'}
              </button>
            </fieldset>
          </article>
        )
      })}
    </section>
  )
}
