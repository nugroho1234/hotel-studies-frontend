import { supabase } from '../lib/supabase'

type Set2 = 'dev' | 'test'
export type NotGuestRow = { reviewId: number; flagA: boolean; flagB: boolean; gold: boolean | null; body: string; lang: string }

export async function setNotGuest(reviewId: number, flag: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_not_guest', { p_review: reviewId, p_flag: flag })
  if (error) throw error
}

export async function notGuestAgreement(set: Set2, a: string, b: string): Promise<{ bothYes: number; bothNo: number; disagree: number; agreement: number | null }> {
  const { data, error } = await supabase.rpc('not_guest_agreement', { p_set: set, p_coder_a: a, p_coder_b: b })
  if (error) throw error
  const r = (Array.isArray(data) ? data[0] : data) ?? {}
  return { bothYes: r.both_yes ?? 0, bothNo: r.both_no ?? 0, disagree: r.disagree ?? 0, agreement: r.agreement === null || r.agreement === undefined ? null : Number(r.agreement) }
}

export async function acceptIdenticalNotGuest(set: Set2, a: string, b: string): Promise<number> {
  const { data, error } = await supabase.rpc('accept_identical_not_guest', { p_set: set, p_coder_a: a, p_coder_b: b })
  if (error) throw error
  return data as number
}

export async function saveNotGuestGold(reviewId: number, a: string, b: string, flag: boolean, reason: string): Promise<void> {
  const { error } = await supabase.rpc('save_not_guest_gold', { p_review: reviewId, p_coder_a: a, p_coder_b: b, p_flag: flag, p_reason: reason })
  if (error) throw error
}

/** Reviews of the set that both coders finished, with each coder's tick (no row = not flagged) and the lead's decision. */
// shortcut: each query is capped at 1,000 rows by the API; fine for the dev and test sets, page if they grow.
export async function listNotGuestRows(set: Set2, a: string, b: string): Promise<NotGuestRow[]> {
  const [meta, subs, flags, gold] = await Promise.all([
    supabase.rpc('review_meta'),
    supabase.from('label_submissions').select('review_id,coder').in('coder', [a, b]),
    supabase.from('not_guest_flags').select('review_id,coder,is_flag').in('coder', [a, b]),
    supabase.from('not_guest_gold').select('review_id,is_flag'),
  ])
  for (const r of [meta, subs, flags, gold]) if (r.error) throw r.error
  const done = new Map<number, Set<string>>()
  for (const s of subs.data ?? []) done.set(s.review_id, (done.get(s.review_id) ?? new Set()).add(s.coder))
  const tick = new Map((flags.data ?? []).map((f) => [`${f.review_id}:${f.coder}`, f.is_flag as boolean]))
  const decided = new Map((gold.data ?? []).map((g) => [g.review_id as number, g.is_flag as boolean]))
  return (meta.data ?? [])
    .filter((m: { review_id: number; set_name: string }) => m.set_name === set && done.get(m.review_id)?.size === 2)
    .map((m: { review_id: number; body: string; lang: string }) => ({
      reviewId: m.review_id, body: m.body, lang: m.lang,
      flagA: tick.get(`${m.review_id}:${a}`) ?? false, flagB: tick.get(`${m.review_id}:${b}`) ?? false, gold: decided.get(m.review_id) ?? null,
    }))
}
