import { describe, expect, it } from 'vitest'
import { add, boundaries, compare, score } from './agreement'

const P = (...xs: [number, number][]) => xs.map(([start, end]) => ({ start, end }))

describe('boundaries', () => {
  it('is the start of every phrase except the first', () => {
    expect(boundaries(P([16, 26], [0, 15]))).toEqual([16])
    expect(boundaries(P([0, 26]))).toEqual([])
  })
})

describe('compare and score', () => {
  it('identical splits agree perfectly', () => {
    const c = compare(P([0, 15], [16, 26]), P([0, 15], [16, 26]))
    expect(c).toEqual({ tp: 1, fp: 0, fn: 0 })
    expect(score(c).f1).toBe(1)
  })

  it('one coder splits, the other does not', () => {
    const c = compare(P([0, 15], [16, 26]), P([0, 26]))
    expect(c).toEqual({ tp: 0, fp: 1, fn: 0 })
    expect(score(c).f1).toBe(0)
  })

  it('a shifted boundary is both a miss and an extra (exact match only)', () => {
    expect(compare(P([0, 10], [11, 26]), P([0, 15], [16, 26]))).toEqual({ tp: 0, fp: 1, fn: 1 })
  })

  it('micro-averages: counts are summed over reviews, not F1s averaged', () => {
    const r1 = compare(P([0, 5], [6, 9], [10, 20]), P([0, 5], [6, 9], [10, 20])) // tp 2
    const r2 = compare(P([0, 5], [6, 20]), P([0, 20])) // fp 1
    const total = add(r1, r2)
    expect(total).toEqual({ tp: 2, fp: 1, fn: 0 })
    expect(score(total).f1).toBeCloseTo(0.8)
    expect(score(total).precision).toBeCloseTo(2 / 3)
    expect(score(total).recall).toBe(1)
  })

  it('is symmetric in the two coders', () => {
    const a = P([0, 5], [6, 20])
    const b = P([0, 20])
    expect(score(compare(a, b)).f1).toBe(score(compare(b, a)).f1)
  })

  it('has no F1 when neither coder split anything', () => {
    expect(score(compare(P([0, 20]), P([0, 20])))).toEqual({ precision: null, recall: null, f1: null })
  })
})
