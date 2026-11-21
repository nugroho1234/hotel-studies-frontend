import { useEffect, useRef, useState, type ReactNode } from 'react'
import { addPhrase, hasContent, isComplete, phraseText, segmentsOf, snapSelection, uncoveredWords, utf16ToCodePoint, type Phrase } from './splitting'

/** Code-point offset of a DOM selection boundary inside the review element (segments carry data-s). */
function offsetOf(root: HTMLElement, node: Node, off: number, length: number): number | null {
  if (!root.contains(node)) return null
  if (node === root) {
    const child = root.childNodes[off] as HTMLElement | undefined
    return child ? Number(child.dataset.s) : length
  }
  const seg = (node.nodeType === Node.TEXT_NODE ? node.parentElement : (node as HTMLElement))?.closest<HTMLElement>('[data-s]')
  if (!seg || !root.contains(seg)) return null
  const start = Number(seg.dataset.s)
  if (node.nodeType === Node.TEXT_NODE) return start + utf16ToCodePoint(node.textContent ?? '', off)
  return start + (off === 0 ? 0 : Array.from(seg.textContent ?? '').length)
}

const colour = (n: number) => `m${(n % 5) + 1}`

/** Read-only review text with its phrases coloured. */
export function PhraseView({ body, lang, phrases }: { body: string; lang: string; phrases: Phrase[] }) {
  const cps = Array.from(body)
  return (
    <p className="review small" lang={lang === 'id' ? 'id' : 'en'}>
      {segmentsOf(cps.length, phrases).map((g) => (
        <span key={g.start} className={g.n === null ? 'gap' : `phrase ${colour(g.n)}`} data-n={g.n === null ? undefined : g.n + 1}>
          {cps.slice(g.start, g.end).join('')}
        </span>
      ))}
    </p>
  )
}

/** Review text you highlight with the mouse, plus the phrase cards. Shared by the coders' splitting screen and adjudication. */
export default function PhraseEditor({ body, lang, phrases, onChange, extra }: {
  body: string
  lang: string
  phrases: Phrase[]
  onChange: (next: Phrase[]) => void
  extra?: ReactNode
}) {
  const rootRef = useRef<HTMLParagraphElement>(null)
  const [note, setNote] = useState('')
  const latest = useRef({ body, phrases, onChange })
  latest.current = { body, phrases, onChange }

  // Highlight: when the pointer is released with a selection inside the review text, turn it into a phrase.
  useEffect(() => {
    const onUp = () => {
      const { body, phrases, onChange } = latest.current
      const root = rootRef.current
      const sel = window.getSelection()
      if (!root || !sel || sel.isCollapsed || sel.rangeCount === 0) return
      const r = sel.getRangeAt(0)
      const length = Array.from(body).length
      const a = offsetOf(root, r.startContainer, r.startOffset, length)
      const b = offsetOf(root, r.endContainer, r.endOffset, length)
      if (a === null || b === null) return
      sel.removeAllRanges()
      const p = snapSelection(body, a, b)
      if (!p) return setNote('')
      if (!hasContent(body, p) && /[\p{L}\p{N}]/u.test(body))
        return setNote('A phrase needs at least one word. Emoji and punctuation go with the phrase before them (or after, at the start).')
      const next = addPhrase(phrases, p)
      if (!next) return setNote('That overlaps a phrase you already marked. Delete that phrase first.')
      setNote('')
      onChange(next)
    }
    document.addEventListener('pointerup', onUp)
    return () => document.removeEventListener('pointerup', onUp)
  }, [])

  useEffect(() => setNote(''), [body])

  const cps = Array.from(body)
  const complete = isComplete(body, phrases)
  const left = uncoveredWords(body, phrases).length
  return (
    <>
      <p className="review" ref={rootRef} lang={lang === 'id' ? 'id' : 'en'}>
        {segmentsOf(cps.length, phrases).map((g) => (
          <span key={g.start} data-s={g.start} className={g.n === null ? 'gap' : `phrase ${colour(g.n)}`} data-n={g.n === null ? undefined : g.n + 1}>
            {cps.slice(g.start, g.end).join('')}
          </span>
        ))}
      </p>
      <div className="status" role="status" aria-live="polite">
        {note ? <span className="error">{note}</span> : complete ? <span className="ok">Every word is in a phrase.</span> : <span>{left} {left === 1 ? 'word is' : 'words are'} not in a phrase yet.</span>}
        {extra}
      </div>
      <ol className="cards">
        {phrases.map((p, i) => (
          <li key={p.start} className={colour(i)}>
            <span className="num">{i + 1}</span>
            <span className="txt">{phraseText(body, p)}</span>
            <button className="btn quiet" onClick={() => onChange(phrases.filter((_, j) => j !== i))}>Delete<span className="sr-only"> phrase {i + 1}</span></button>
          </li>
        ))}
      </ol>
    </>
  )
}
