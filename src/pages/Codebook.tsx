import { Children, isValidElement, useEffect, useMemo, useState, type ReactNode } from 'react'
import { useAuth } from '../auth/AuthProvider'
import { codebookList, uploadCodebook, type CodebookVersion } from '../stats/api'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import source from '../content/codebook-splitting.md?raw'

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((c) => (typeof c === 'string' ? c : isValidElement<{ children?: ReactNode }>(c) ? textOf(c.props.children) : ''))
    .join('')
}

const headingsOf = (md: string) => [...md.matchAll(/^## (.+)$/gm)].map((m) => m[1])

/** A table cell with " | " is a split example: show each phrase as its own highlighted mark. */
function Cell({ children }: { children?: ReactNode }) {
  const text = textOf(children)
  if (!text.includes(' | ')) return <td>{children}</td>
  return (
    <td>
      {text.split(' | ').map((p, i) => (
        <span key={i}>
          {i > 0 && ' '}
          <mark className={`m${(i % 5) + 1}`}>{p}</mark>
        </span>
      ))}
    </td>
  )
}

/** Lead only: a new version is a markdown file that replaces the whole page. */
function Upload({ onDone }: { onDone: () => void }) {
  const [version, setVersion] = useState('')
  const [note, setNote] = useState('')
  const [body, setBody] = useState('')
  const [file, setFile] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)
  const submit = async () => {
    if (!window.confirm(`Publish codebook v${version.trim()}? It replaces the page for everyone, and later decisions are logged under this version.`)) return
    setBusy(true); setErr('')
    try { await uploadCodebook(version, body, note); setVersion(''); setNote(''); setBody(''); setFile(''); onDone() }
    catch (e) { setErr(`That did not work: ${(e as { message?: string })?.message ?? 'unknown error'}`) }
    setBusy(false)
  }
  return (
    <details className="upload">
      <summary>Upload a new codebook version</summary>
      <label>Version label<input value={version} onChange={(e) => setVersion(e.target.value)} placeholder="0.3" /></label>
      <label>Markdown file<input type="file" accept=".md,text/markdown,text/plain" onChange={async (e) => { const f = e.target.files?.[0]; if (f) { setBody(await f.text()); setFile(f.name) } }} /></label>
      {file && <p className="note">{file}: {body.length.toLocaleString()} characters.</p>}
      <label>What changed<textarea rows={2} value={note} onChange={(e) => setNote(e.target.value)} placeholder="For example: clarified Assurance versus Empathy" /></label>
      {err && <p role="alert" className="error">{err}</p>}
      <button className="btn primary" disabled={busy || !version.trim() || !body.trim()} onClick={submit}>Publish version</button>
    </details>
  )
}

export default function Codebook() {
  const { profile } = useAuth()
  const [list, setList] = useState<CodebookVersion[]>([])
  const [pick, setPick] = useState('')
  const load = () => codebookList().then(setList, () => setList([]))
  useEffect(() => { load() }, [])
  const cur = list.find((v) => v.version === pick) ?? list[0]
  const bundled = !cur || cur.body === null
  const body = bundled ? source : cur.body!
  const headings = useMemo(() => headingsOf(body), [body])
  const meta = cur ? `Codebook v${cur.version}${list[0] === cur ? '' : ' (an earlier version)'}. Published ${new Date(cur.createdAt).toLocaleDateString()}.` : ''
  return (
    <div className="codebook">
      <nav className="toc" aria-label="On this page">
        <strong>{bundled ? 'How reviews are split into phrases' : 'On this page'}</strong>
        {headings.map((h) => (
          <a key={h} href={`#${slug(h)}`}>{h}</a>
        ))}
        {list.length > 1 && (
          <label className="versions">Version
            <select value={cur?.version ?? ''} onChange={(e) => setPick(e.target.value)}>
              {list.map((v) => <option key={v.version} value={v.version}>{v.version}{v === list[0] ? ' (current)' : ''}</option>)}
            </select>
          </label>
        )}
      </nav>
      <article className="prose">
        {bundled && <h1>How reviews are split into phrases</h1>}
        <p className="meta">{meta}{bundled && ' Only the splitting rules so far.'}</p>
        {profile?.role === 'lead' && <Upload onDone={() => { setPick(''); load() }} />}
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ children }) => <h2 id={slug(textOf(children))}>{children}</h2>,
            td: Cell,
            table: ({ children }) => <div className="table-wrap"><table>{children}</table></div>,
          }}
        >
          {body}
        </Markdown>
      </article>
    </div>
  )
}
