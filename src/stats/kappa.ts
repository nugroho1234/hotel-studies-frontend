// Cohen's kappa for two coders labelling the same units (here: agreed phrases). Mirrored later in Python (Task 7).

/** Kappa for pairs [labelA, labelB]. Null when it is undefined (no pairs, or chance agreement is 1). */
export function cohenKappa(pairs: [string, string][]): number | null {
  const n = pairs.length
  if (n === 0) return null
  const a = new Map<string, number>()
  const b = new Map<string, number>()
  let agree = 0
  for (const [x, y] of pairs) {
    a.set(x, (a.get(x) ?? 0) + 1)
    b.set(y, (b.get(y) ?? 0) + 1)
    if (x === y) agree++
  }
  const po = agree / n
  let pe = 0
  for (const [k, v] of a) pe += (v / n) * ((b.get(k) ?? 0) / n)
  return pe === 1 ? null : (po - pe) / (1 - pe)
}

/** One-versus-rest kappa for a single label (used for the per-dimension report). */
export function kappaFor(pairs: [string, string][], label: string): number | null {
  return cohenKappa(pairs.map(([x, y]) => [x === label ? 'yes' : 'no', y === label ? 'yes' : 'no']))
}

export type LabelPair = { a: { dimension: string; sentiment: string }; b: { dimension: string; sentiment: string } }

/** Dimension kappa, sentiment kappa and one-versus-rest kappa per dimension over labelled phrase pairs. */
export function labelAgreement(rows: LabelPair[], dimensions: readonly string[]) {
  const dim = rows.map((r): [string, string] => [r.a.dimension, r.b.dimension])
  return {
    n: rows.length,
    dimension: cohenKappa(dim),
    sentiment: cohenKappa(rows.map((r): [string, string] => [r.a.sentiment, r.b.sentiment])),
    perDimension: Object.fromEntries(dimensions.map((d) => [d, kappaFor(dim, d)])) as Record<string, number | null>,
  }
}
