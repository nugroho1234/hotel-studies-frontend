import { describe, expect, it } from 'vitest'
import {
  addPhrase,
  isComplete,
  phraseText,
  snapSelection,
  uncoveredWords,
  utf16ToCodePoint,
  type Phrase,
} from './splitting'

const ROOM = 'The room is old but clean.'

describe('snapSelection', () => {
  it('matches the owner example: [0,15) and [16,26)', () => {
    expect(snapSelection(ROOM, 0, 15)).toEqual({ start: 0, end: 15 })
    expect(snapSelection(ROOM, 16, 26)).toEqual({ start: 16, end: 26 })
    expect(phraseText(ROOM, { start: 16, end: 26 })).toBe('but clean.')
  })

  it('snaps outward to whole words', () => {
    // "he room is ol" -> "The room is old"
    expect(snapSelection(ROOM, 1, 13)).toEqual({ start: 0, end: 15 })
  })

  it('drops leading and trailing whitespace', () => {
    expect(snapSelection(ROOM, 3, 16)).toEqual({ start: 4, end: 15 })
  })

  it('keeps trailing punctuation with the word before it', () => {
    expect(snapSelection(ROOM, 16, 25)).toEqual({ start: 16, end: 26 })
  })

  it('treats abbreviations like "Mr." as one word', () => {
    const t = 'Mr. Budi was kind.'
    expect(snapSelection(t, 0, 2)).toEqual({ start: 0, end: 3 })
  })

  it('works on Indonesian text', () => {
    const t = 'Kamarnya bersih tapi AC-nya mati.'
    expect(snapSelection(t, 17, 33)).toEqual({ start: 16, end: 33 })
  })

  it('handles double spaces and line breaks', () => {
    const t = 'Good bed.  \n\nBad  wifi.'
    expect(snapSelection(t, 0, 20)).toEqual({ start: 0, end: 23 })
    expect(snapSelection(t, 9, 13)).toBeNull()
    expect(snapSelection(t, 13, 19)).toEqual({ start: 13, end: 23 })
  })

  it('counts code points, not UTF-16 units, around emoji', () => {
    const t = 'Great 😀 stay'
    // code points: G0 r1 e2 a3 t4 ' '5 😀6 ' '7 s8 t9 a10 y11
    expect(snapSelection(t, 6, 7)).toEqual({ start: 6, end: 7 })
    expect(snapSelection(t, 8, 12)).toEqual({ start: 8, end: 12 })
    expect(utf16ToCodePoint(t, 9)).toBe(8)
  })

  it('returns null for a selection with no word, or an empty one', () => {
    expect(snapSelection(ROOM, 15, 16)).toBeNull()
    expect(snapSelection(ROOM, 5, 5)).toBeNull()
  })

  it('accepts a reversed selection', () => {
    expect(snapSelection(ROOM, 15, 0)).toEqual({ start: 0, end: 15 })
  })
})

describe('glued punctuation', () => {
  it('splits "clean.Then" and "clean,then" into phrases', () => {
    const a = 'Room was clean.Then we left.'
    expect(snapSelection(a, 0, 15)).toEqual({ start: 0, end: 15 })
    expect(snapSelection(a, 15, 28)).toEqual({ start: 15, end: 28 })
    const b = 'Room was clean,then we left.'
    expect(snapSelection(b, 0, 15)).toEqual({ start: 0, end: 15 })
    expect(isComplete(b, [{ start: 0, end: 15 }])).toBe(false)
    expect(isComplete(b, [{ start: 0, end: 15 }, { start: 15, end: 28 }])).toBe(true)
  })

  it('keeps decimals, hyphens and abbreviations whole', () => {
    expect(snapSelection('Rated 4.5 stars', 6, 7)).toEqual({ start: 6, end: 9 })
    expect(snapSelection('AC-nya mati', 0, 2)).toEqual({ start: 0, end: 6 })
    expect(snapSelection('e.g.the pool', 0, 1)).toEqual({ start: 0, end: 7 })
  })

  it('cuts after a run like "..."', () => {
    expect(snapSelection('ok...Then go', 0, 2)).toEqual({ start: 0, end: 5 })
  })
})

describe('addPhrase', () => {
  it('keeps phrases ordered and rejects overlap', () => {
    const a = addPhrase([], { start: 16, end: 26 })
    expect(a).toEqual([{ start: 16, end: 26 }])
    const b = addPhrase(a as Phrase[], { start: 0, end: 15 })
    expect(b).toEqual([
      { start: 0, end: 15 },
      { start: 16, end: 26 },
    ])
    expect(addPhrase(b as Phrase[], { start: 10, end: 20 })).toBeNull()
  })
})

describe('coverage', () => {
  it('is complete only when every word is inside a phrase', () => {
    expect(isComplete(ROOM, [])).toBe(false)
    expect(isComplete(ROOM, [{ start: 0, end: 15 }])).toBe(false)
    expect(uncoveredWords(ROOM, [{ start: 0, end: 15 }])).toEqual([{ start: 16, end: 19 }, { start: 20, end: 26 }])
    expect(
      isComplete(ROOM, [
        { start: 0, end: 15 },
        { start: 16, end: 26 },
      ]),
    ).toBe(true)
    expect(isComplete(ROOM, [{ start: 0, end: 26 }])).toBe(true)
  })

  it('treats an empty or blank review as not complete', () => {
    expect(isComplete('   ', [])).toBe(false)
  })
})
