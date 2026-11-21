import { Fragment, useCallback, useEffect, useMemo, useState } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { SETS, type SetName } from '../split/api'
import { isComplete } from '../split/splitting'
import { add, compare, score, type Counts } from '../stats/agreement'
import { KappaPanel, LabellingPanel } from './StaffLabelling'
import { loadStaffData, setSetOpen, unlockSet, type Meta, type StaffData } from '../stats/api'

const LANG: Record<string, string> = { id: 'Indonesian', en: 'English' }
const fmt = (x: number | null) => (x === null ? '–' : x.toFixed(2))
const MAIN: SetName[] = ['dev', 'test'] // training is practice, kept out of the headline numbers

export default function StaffHome() {
  const { profile } = useAuth()
  const isLead = profile?.role === 'lead'
  const [d, setD] = useState<StaffData | null>(null)
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  const load = useCallback(() => loadStaffData().then(setD, () => setErr('Could not load the data. Reload the page to try again.')), [])
  useEffect(() => { load() }, [load])

  const act = async (fn: () => Promise<unknown>, ask: string) => {
    if (!window.confirm(ask)) return
    setBusy(true)
    setErr('')
    try { await fn(); await load() } catch (e) { setErr(`That did not work: ${(e as { message?: string })?.message ?? 'only the lead researcher can change this'}`) }
    setBusy(false)
  }

  const calc = useMemo(() => {
    if (!d) return null
    const done = (c: string, m: Meta) => isComplete(m.body, d.splits[c]?.[m.reviewId] ?? [])
    const progress = d.coders.map((c) => ({
      coder: c,
      sets: SETS.map((s) => {
        const rs = d.meta.filter((m) => m.set === s.name)
        return { set: s.name, total: rs.length, complete: rs.filter((m) => done(c.id, m)).length, finished: rs.length > 0 && rs.every((m) => d.finished[c.id]?.[m.reviewId]) }
      }),
    }))
    const langs = [...new Set(d.meta.filter((m) => MAIN.includes(m.set)).map((m) => m.lang))].sort()
    const groups: { label: string; pick: (m: Meta) => boolean }[] = [
      { label: 'Development and test together', pick: (m) => MAIN.includes(m.set) },
      ...SETS.map((s) => ({ label: s.name === 'training' ? 'Training (practice)' : s.label, pick: (m: Meta) => m.set === s.name })),
      ...langs.map((l) => ({ label: `${LANG[l] ?? l}, development and test`, pick: (m: Meta) => m.lang === l && MAIN.includes(m.set) })),
    ]
    const pairs = d.coders.flatMap((a, i) => d.coders.slice(i + 1).map((b) => ({ a, b }))).map(({ a, b }) => ({
      a, b,
      rows: groups.map((g) => {
        const both = d.meta.filter((m) => g.pick(m) && done(a.id, m) && done(b.id, m))
        let c: Counts = { tp: 0, fp: 0, fn: 0 }
        let differ = 0
        for (const m of both) {
          const x = compare(d.splits[a.id][m.reviewId], d.splits[b.id][m.reviewId])
          c = add(c, x)
          if (x.fp + x.fn > 0) differ++
        }
        return { label: g.label, n: both.length, c, differ, ...score(c) }
      }),
    }))
    return { progress, pairs }
  }, [d])

  if (err && !d) return <p role="alert" className="error">{err}</p>
  if (!d || !calc) return <p>Loading…</p>

  return (
    <section className="staff">
      <h1>Overview</h1>
      {err && <p role="alert" className="error">{err}</p>}

      <h2>Review sets</h2>
      <p className="note">Coders can only work on a set while it is open.{!isLead && ' Only the lead researcher can open or close sets.'}</p>
      <ul className="sets">
        {SETS.map((s) => (
          <li key={s.name}>
            <div>
              <strong>{s.label}: {d.open[s.name] ? 'open' : 'closed'}</strong>
              <span>{d.meta.filter((m) => m.set === s.name).length} reviews. {s.hint}</span>
            </div>
            {isLead && (
              <button className="btn" disabled={busy}
                onClick={() => act(() => setSetOpen(s.name, !d.open[s.name]),
                  d.open[s.name] ? `Close the ${s.label} set? Coders will not be able to open it.` :
                    s.name === 'test' ? 'Open the Test set? It is coded once, with the frozen codebook. Check that the codebook is final.' : `Open the ${s.label} set for coders?`)}>
                {d.open[s.name] ? 'Close' : 'Open'}
              </button>
            )}
          </li>
        ))}
      </ul>

      <h2>Progress</h2>
      <p className="note">Reviews fully split by each coder (every word in a phrase). "Finished" means the coder locked the set.</p>
      <div className="table-wrap">
        <table className="stats">
          <thead><tr><th>Coder</th>{SETS.map((s) => <th key={s.name}>{s.label}</th>)}</tr></thead>
          <tbody>
            {calc.progress.map((p) => (
              <tr key={p.coder.id}>
                <th scope="row">{p.coder.name}</th>
                {p.sets.map((s) => (
                  <td key={s.set}>
                    {s.complete} of {s.total}{s.finished && ' · finished'}
                    {s.finished && isLead && (
                      <button className="btn quiet" disabled={busy} onClick={() => act(() => unlockSet(p.coder.id, s.set), `Unlock the ${s.set} set for ${p.coder.name}? They will be able to edit their splits again.`)}>Unlock</button>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <h2>Boundary agreement (F1)</h2>
      <p className="note">
        A boundary is the start of every phrase except the first. Two coders agree on a boundary only if it sits at exactly the same character.
        Only reviews that both coders have fully split are counted. Counts are added over reviews before the scores are computed.
      </p>
      {calc.pairs.length === 0 && <p>At least two coders are needed.</p>}
      {calc.pairs.map(({ a, b, rows }) => (
        <Fragment key={a.id + b.id}>
          <h3>{a.name} and {b.name}</h3>
          <div className="table-wrap">
            <table className="stats">
              <thead>
                <tr><th>Reviews</th><th>Reviews counted</th><th>Precision</th><th>Recall</th><th>F1</th><th>Agreed boundaries</th><th>Only {a.name}</th><th>Only {b.name}</th><th>Reviews that differ</th></tr>
              </thead>
              <tbody>
                {rows.map((r) => (
                  <tr key={r.label}>
                    <th scope="row">{r.label}</th><td>{r.n}</td><td>{fmt(r.precision)}</td><td>{fmt(r.recall)}</td><td><strong>{fmt(r.f1)}</strong></td>
                    <td>{r.c.tp}</td><td>{r.c.fp}</td><td>{r.c.fn}</td><td>{r.differ}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </Fragment>
      ))}
      <p className="note">A dash means there were no boundaries to compare yet.</p>

      <LabellingPanel d={d} isLead={isLead} busy={busy} act={act} />
      <KappaPanel d={d} />
    </section>
  )
}
