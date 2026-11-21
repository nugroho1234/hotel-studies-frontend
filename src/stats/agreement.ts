import type { Phrase } from '../split/splitting'

// Boundary agreement between two coders (splitting-plan.md section 6). A boundary is the start offset of
// every phrase except the first, i.e. a split point. Exact match only; counts are summed over reviews (micro).
// The Python evaluation (Task 7) must reproduce these numbers.

export type Counts = { tp: number; fp: number; fn: number }

export const boundaries = (ps: Phrase[]): number[] => [...ps].sort((a, b) => a.start - b.start).slice(1).map((p) => p.start)

/** fp = boundaries only coder A has, fn = boundaries only coder B has. */
export function compare(a: Phrase[], b: Phrase[]): Counts {
  const A = new Set(boundaries(a))
  const B = new Set(boundaries(b))
  const tp = [...A].filter((x) => B.has(x)).length
  return { tp, fp: A.size - tp, fn: B.size - tp }
}

export const add = (x: Counts, y: Counts): Counts => ({ tp: x.tp + y.tp, fp: x.fp + y.fp, fn: x.fn + y.fn })

export function score({ tp, fp, fn }: Counts): { precision: number | null; recall: number | null; f1: number | null } {
  return {
    precision: tp + fp ? tp / (tp + fp) : null,
    recall: tp + fn ? tp / (tp + fn) : null,
    f1: tp + fp + fn ? (2 * tp) / (2 * tp + fp + fn) : null,
  }
}
