import { describe, expect, it } from 'vitest'
import { cohenKappa, kappaFor } from './kappa'

const rep = (x: string, y: string, n: number): [string, string][] => Array.from({ length: n }, () => [x, y])

describe('cohenKappa', () => {
  it('textbook example: 20 yes/yes, 5 yes/no, 10 no/yes, 15 no/no gives 0.4', () => {
    const p = [...rep('y', 'y', 20), ...rep('y', 'n', 5), ...rep('n', 'y', 10), ...rep('n', 'n', 15)]
    expect(cohenKappa(p)).toBeCloseTo(0.4, 10)
  })
  it('is 1 for perfect agreement over several labels', () => {
    expect(cohenKappa([...rep('a', 'a', 3), ...rep('b', 'b', 2), ...rep('c', 'c', 1)])).toBe(1)
  })
  it('is 0 when agreement equals chance and negative below it', () => {
    expect(cohenKappa([...rep('y', 'y', 1), ...rep('y', 'n', 1), ...rep('n', 'y', 1), ...rep('n', 'n', 1)])).toBe(0)
    expect(cohenKappa([...rep('y', 'n', 2), ...rep('n', 'y', 2)])).toBe(-1)
  })
  it('is undefined with no pairs or when both always use one label', () => {
    expect(cohenKappa([])).toBeNull()
    expect(cohenKappa(rep('a', 'a', 4))).toBeNull()
  })
  it('one-versus-rest kappa per label', () => {
    const p = [...rep('TAN', 'TAN', 6), ...rep('REL', 'TAN', 2), ...rep('REL', 'REL', 2)]
    expect(kappaFor(p, 'TAN')).toBeCloseTo(0.24 / 0.44, 10) // po .8, pe .56
    expect(kappaFor(p, 'EMP')).toBeNull()
  })
})
