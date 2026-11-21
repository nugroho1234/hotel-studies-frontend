import { Fragment, useMemo } from 'react'
import { DIMENSIONS } from '../label/scheme'
import { labelAgreement, type LabelPair } from '../stats/kappa'
import { setLabelOpen, unlockLabels, type StaffData } from '../stats/api'

const LANG: Record<string, string> = { id: 'Indonesian', en: 'English' }
const MIN = 0.7 // registered minimum human-human kappa, per language
const FLAG = 0.6 // a dimension below this is a codebook problem
const fmt = (x: number | null) => (x === null ? '–' : x.toFixed(2))
const SETS = [
  { name: 'dev' as const, label: 'Development' },
  { name: 'test' as const, label: 'Test' },
]

type Act = (fn: () => Promise<unknown>, ask: string) => void

/** Open or close labelling per set, and each coder's labelling progress. */
export function LabellingPanel({ d, isLead, busy, act }: { d: StaffData; isLead: boolean; busy: boolean; act: Act }) {
  const setOf = useMemo(() => new Map(d.meta.map((m) => [m.reviewId, m.set])), [d.meta])
  return (
    <>
      <h2>Labelling</h2>
      <p className="note">
        Coders label the agreed phrases (one label and one sentiment each). A set can open for labelling only after every split in it has been adjudicated.
      </p>
      <ul className="sets">
        {SETS.map((s) => (
          <li key={s.name}>
            <div>
              <strong>{s.label}: labelling {d.labelOpen[s.name] ? 'open' : 'closed'}</strong>
              <span>{d.agreedPhrases.filter((p) => setOf.get(p.reviewId) === s.name).length} agreed phrases</span>
            </div>
            {isLead && (
              <button className="btn" disabled={busy}
                onClick={() => act(() => setLabelOpen(s.name, !d.labelOpen[s.name]),
                  d.labelOpen[s.name] ? `Close labelling of the ${s.label} set?` : `Open labelling of the ${s.label} set for coders?`)}>
                {d.labelOpen[s.name] ? 'Close' : 'Open'}
              </button>
            )}
          </li>
        ))}
      </ul>
      <div className="table-wrap">
        <table className="stats">
          <thead><tr><th>Coder</th>{SETS.map((s) => <th key={s.name}>{s.label} phrases labelled</th>)}</tr></thead>
          <tbody>
            {d.coders.map((c) => (
              <tr key={c.id}>
                <th scope="row">{c.name}</th>
                {SETS.map((s) => {
                  const ph = d.agreedPhrases.filter((p) => setOf.get(p.reviewId) === s.name)
                  const done = ph.filter((p) => d.labels[c.id]?.[p.phraseId]).length
                  const revs = [...new Set(ph.map((p) => p.reviewId))]
                  const finished = revs.length > 0 && revs.every((r) => d.labelFinished[c.id]?.[r])
                  return (
                    <td key={s.name}>
                      {done} of {ph.length}{finished && ' · finished'}
                      {finished && isLead && (
                        <button className="btn quiet" disabled={busy} onClick={() => act(() => unlockLabels(c.id, s.name), `Unlock labelling of the ${s.label} set for ${c.name}? They will be able to edit their labels again.`)}>Unlock</button>
                      )}
                    </td>
                  )
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </>
  )
}

/** Cohen's kappa between two coders' labels, per language (registered minimum .70 in each language; a dimension below .60 is flagged). */
export function KappaPanel({ d }: { d: StaffData }) {
  const info = useMemo(() => new Map(d.meta.map((m) => [m.reviewId, m])), [d.meta])
  const pairs = useMemo(() => d.coders.flatMap((a, i) => d.coders.slice(i + 1).map((b) => ({ a, b }))), [d.coders])
  const langs = useMemo(() => [...new Set(d.meta.map((m) => m.lang))].sort(), [d.meta])

  const units = (a: string, b: string, pick: (set: string, supp: boolean) => boolean, lang: string): LabelPair[] =>
    d.agreedPhrases.flatMap((p) => {
      const m = info.get(p.reviewId)
      const la = d.labels[a]?.[p.phraseId]
      const lb = d.labels[b]?.[p.phraseId]
      if (!m || m.lang !== lang || !pick(m.set, m.isSupp) || !la || !lb || !d.labelFinished[a]?.[p.reviewId] || !d.labelFinished[b]?.[p.reviewId]) return []
      return [{ a: la, b: lb }]
    })

  return (
    <>
      <h2>Label agreement (Cohen's kappa)</h2>
      <p className="note">
        Computed on phrases that both coders have finished labelling, before any discussion. The development set passes only if dimension kappa and sentiment kappa
        are both at least {MIN.toFixed(2)} in both languages. The reliability supplement is reported separately and is not part of the pass or fail.
      </p>
      {pairs.length === 0 && <p>At least two coders are needed.</p>}
      {pairs.map(({ a, b }) => {
        const dev = langs.map((l) => ({ l, r: labelAgreement(units(a.id, b.id, (s, sp) => s === 'dev' && !sp, l), DIMENSIONS.map((x) => x.code)) }))
        const test = langs.map((l) => ({ l, r: labelAgreement(units(a.id, b.id, (s, sp) => s === 'test' && !sp, l), DIMENSIONS.map((x) => x.code)) }))
        const supp = langs.map((l) => ({ l, r: labelAgreement(units(a.id, b.id, (_s, sp) => sp, l), DIMENSIONS.map((x) => x.code)) }))
        const four = dev.flatMap(({ r }) => [r.dimension, r.sentiment])
        const ready = four.length > 0 && four.every((k) => k !== null)
        const met = ready && four.every((k) => (k as number) >= MIN)
        const rows = [
          ...dev.map((x) => ({ label: `Development, ${LANG[x.l] ?? x.l}`, ...x, check: true })),
          ...test.filter((x) => x.r.n > 0).map((x) => ({ label: `Test (benchmark), ${LANG[x.l] ?? x.l}`, ...x, check: false })),
          ...supp.filter((x) => x.r.n > 0).map((x) => ({ label: `Reliability supplement, ${LANG[x.l] ?? x.l}`, ...x, check: false })),
        ]
        return (
          <Fragment key={a.id + b.id}>
            <h3>{a.name} and {b.name}</h3>
            <div className="table-wrap">
              <table className="stats">
                <thead><tr><th>Phrases</th><th>Labelled phrases</th><th>Dimension kappa</th><th>Sentiment kappa</th><th>Minimum {MIN.toFixed(2)}</th></tr></thead>
                <tbody>
                  {rows.map((x) => {
                    const ok = x.r.dimension !== null && x.r.sentiment !== null && x.r.dimension >= MIN && x.r.sentiment >= MIN
                    return (
                      <tr key={x.label}>
                        <th scope="row">{x.label}</th><td>{x.r.n}</td><td><strong>{fmt(x.r.dimension)}</strong></td><td><strong>{fmt(x.r.sentiment)}</strong></td>
                        <td>{x.check ? (x.r.n === 0 ? '–' : ok ? 'Met' : 'Not met') : '–'}</td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
            <p className={met ? 'ok' : 'note'}>
              {!ready ? 'Development: not enough labelled phrases yet to judge the minimum.' : met ? 'Development: the minimum is met in both languages.' :
                'Development: the minimum is not met. The registration requires further coder training, a clarified codebook and a fresh development batch.'}
            </p>
            <h4>Kappa per dimension, development</h4>
            <div className="table-wrap">
              <table className="stats">
                <thead><tr><th>Dimension</th>{dev.map((x) => <th key={x.l}>{LANG[x.l] ?? x.l}</th>)}</tr></thead>
                <tbody>
                  {DIMENSIONS.map((dm) => (
                    <tr key={dm.code}>
                      <th scope="row">{dm.name}</th>
                      {dev.map((x) => {
                        const k = x.r.perDimension[dm.code]
                        return <td key={x.l} className={k !== null && k < FLAG ? 'flag' : ''}>{fmt(k)}{k !== null && k < FLAG && ' · below .60'}</td>
                      })}
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </Fragment>
        )
      })}
      <p className="note">A dimension below {FLAG.toFixed(2)} is treated as a codebook problem to resolve before the codebook is frozen. A dash means there is nothing to compare yet.</p>
    </>
  )
}
