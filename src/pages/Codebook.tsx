import { Children, isValidElement, type ReactNode } from 'react'
import Markdown from 'react-markdown'
import remarkGfm from 'remark-gfm'
import source from '../content/codebook-splitting.md?raw'

const VERSION = 'Codebook v0.2, draft'
const UPDATED = '21 November 2026'

const slug = (s: string) => s.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '')

function textOf(node: ReactNode): string {
  return Children.toArray(node)
    .map((c) => (typeof c === 'string' ? c : isValidElement<{ children?: ReactNode }>(c) ? textOf(c.props.children) : ''))
    .join('')
}

const headings = [...source.matchAll(/^## (.+)$/gm)].map((m) => m[1])

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

export default function Codebook() {
  return (
    <div className="codebook">
      <nav className="toc" aria-label="On this page">
        <strong>How reviews are split into phrases</strong>
        {headings.map((h) => (
          <a key={h} href={`#${slug(h)}`}>{h}</a>
        ))}
      </nav>
      <article className="prose">
        <h1>How reviews are split into phrases</h1>
        <p className="meta">{VERSION}. Only the splitting rules so far. Updated {UPDATED}.</p>
        <Markdown
          remarkPlugins={[remarkGfm]}
          components={{
            h2: ({ children }) => <h2 id={slug(textOf(children))}>{children}</h2>,
            td: Cell,
            table: ({ children }) => <div className="table-wrap"><table>{children}</table></div>,
          }}
        >
          {source}
        </Markdown>
      </article>
    </div>
  )
}
