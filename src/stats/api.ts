import { supabase } from '../lib/supabase'
import type { Phrase } from '../split/splitting'
import type { SetName } from '../split/api'

export type Meta = { reviewId: number; lang: string; set: SetName; isSupp: boolean; body: string; round: number | null }
export type AgreedPhrase = { phraseId: number; reviewId: number; start: number; end: number; text: string }
export type Lab = { dimension: string; sentiment: string }
export type Coder = { id: string; name: string }
export type StaffData = {
  meta: Meta[]
  coders: Coder[]
  splits: Record<string, Record<number, Phrase[]>> // coder id -> review id -> phrases
  finished: Record<string, Record<number, true>> // coder id -> review id
  open: Record<string, boolean>
  agreedPhrases: AgreedPhrase[]
  labels: Record<string, Record<number, Lab>> // coder id -> phrase id -> label
  labelFinished: Record<string, Record<number, true>> // coder id -> review id
  labelOpen: Record<string, boolean>
  gold: Record<number, Lab & { byCoders: boolean; version: string | null }> // phrase id -> agreed label
}

// The API returns at most 1,000 rows per request, so read in pages.
async function all<T>(page: (from: number, to: number) => PromiseLike<{ data: T[] | null; error: unknown }>): Promise<T[]> {
  const out: T[] = []
  for (let from = 0; ; from += 1000) {
    const { data, error } = await page(from, from + 999)
    if (error) throw error
    out.push(...(data ?? []))
    if ((data?.length ?? 0) < 1000) return out
  }
}

export async function loadStaffData(): Promise<StaffData> {
  const [meta, coders, splits, subs, access, agreed, labs, lsubs, lacc, gold] = await Promise.all([
    supabase.rpc('review_meta'),
    supabase.from('profiles').select('user_id,display_name').eq('role', 'coder').order('display_name'),
    all<{ review_id: number; coder: string; start_offset: number; end_offset: number }>((f, t) =>
      supabase.from('human_splits').select('review_id,coder,start_offset,end_offset').order('split_id').range(f, t)),
    all<{ review_id: number; coder: string }>((f, t) =>
      supabase.from('split_submissions').select('review_id,coder').order('review_id').range(f, t)),
    supabase.from('set_access').select('set_name,is_open'),
    all<{ phrase_id: number; review_id: number; start_offset: number; end_offset: number; phrase_text: string }>((f, t) =>
      supabase.from('agreed_phrases').select('phrase_id,review_id,start_offset,end_offset,phrase_text').order('phrase_id').range(f, t)),
    all<{ phrase_id: number; coder: string; dimension: string; sentiment: string }>((f, t) =>
      supabase.from('human_labels').select('phrase_id,coder,dimension,sentiment').order('phrase_id').range(f, t)),
    all<{ review_id: number; coder: string }>((f, t) => supabase.from('label_submissions').select('review_id,coder').order('review_id').range(f, t)),
    supabase.from('label_access').select('set_name,is_open'),
    all<{ phrase_id: number; dimension: string; sentiment: string; by_coders: boolean; codebook_version: string | null }>((f, t) =>
      supabase.from('gold_labels').select('phrase_id,dimension,sentiment,by_coders,codebook_version').order('phrase_id').range(f, t)),
  ])
  if (meta.error) throw meta.error
  if (coders.error) throw coders.error
  if (access.error) throw access.error
  if (lacc.error) throw lacc.error
  const s: StaffData['splits'] = {}
  for (const r of splits) ((s[r.coder] ??= {})[r.review_id] ??= []).push({ start: r.start_offset, end: r.end_offset })
  const f: StaffData['finished'] = {}
  for (const r of subs) (f[r.coder] ??= {})[r.review_id] = true
  return {
    meta: (meta.data ?? []).map((r: { review_id: number; lang: string; set_name: SetName; is_supp: boolean; body: string; dev_round: number | null }) => ({
      reviewId: r.review_id, lang: r.lang, set: r.set_name, isSupp: r.is_supp, body: r.body, round: r.dev_round,
    })),
    coders: (coders.data ?? []).map((c) => ({ id: c.user_id, name: c.display_name })),
    splits: s,
    finished: f,
    open: Object.fromEntries((access.data ?? []).map((a) => [a.set_name, a.is_open as boolean])),
    agreedPhrases: agreed.map((r) => ({ phraseId: r.phrase_id, reviewId: r.review_id, start: r.start_offset, end: r.end_offset, text: r.phrase_text })),
    labels: labs.reduce<StaffData['labels']>((o, r) => ((o[r.coder] ??= {})[r.phrase_id] = { dimension: r.dimension, sentiment: r.sentiment }, o), {}),
    labelFinished: lsubs.reduce<StaffData['labelFinished']>((o, r) => ((o[r.coder] ??= {})[r.review_id] = true, o), {}),
    labelOpen: Object.fromEntries((lacc.data ?? []).map((a) => [a.set_name, a.is_open as boolean])),
    gold: Object.fromEntries(gold.map((g) => [g.phrase_id, { dimension: g.dimension, sentiment: g.sentiment, byCoders: g.by_coders, version: g.codebook_version }])),
  }
}

export async function setSetOpen(set: SetName, open: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_set_open', { p_set: set, p_open: open })
  if (error) throw error
}

export async function unlockSet(coder: string, set: SetName): Promise<void> {
  const { error } = await supabase.rpc('unlock_set', { p_coder: coder, p_set: set })
  if (error) throw error
}

export async function loadAgreed(): Promise<Record<number, Phrase[]>> {
  const rows = await all<{ review_id: number; start_offset: number; end_offset: number }>((f, t) =>
    supabase.from('agreed_phrases').select('review_id,start_offset,end_offset').order('phrase_id').range(f, t))
  const out: Record<number, Phrase[]> = {}
  for (const r of rows) (out[r.review_id] ??= []).push({ start: r.start_offset, end: r.end_offset })
  return out
}

export async function lastDecision(reviewId: number): Promise<{ reason: string; at: string } | null> {
  const { data, error } = await supabase.from('adjudication_log').select('reason,decided_at').eq('review_id', reviewId).order('decided_at', { ascending: false }).limit(1)
  if (error) throw error
  return data?.[0] ? { reason: data[0].reason, at: data[0].decided_at } : null
}

export async function acceptIdentical(set: SetName, a: string, b: string): Promise<number> {
  const { data, error } = await supabase.rpc('accept_identical', { p_set: set, p_coder_a: a, p_coder_b: b })
  if (error) throw error
  return data as number
}

export async function saveAdjudication(review: number, a: string, b: string, final: Phrase[], reason: string, gap: boolean): Promise<void> {
  const { error } = await supabase.rpc('save_adjudication', { p_review: review, p_coder_a: a, p_coder_b: b, p_final: final, p_reason: reason, p_gap: gap })
  if (error) throw error
}

export async function setLabelOpen(set: SetName, open: boolean): Promise<void> {
  const { error } = await supabase.rpc('set_label_open', { p_set: set, p_open: open })
  if (error) throw error
}

export async function unlockLabels(coder: string, set: SetName): Promise<void> {
  const { error } = await supabase.rpc('unlock_labels', { p_coder: coder, p_set: set })
  if (error) throw error
}

export async function acceptIdenticalLabels(set: SetName, a: string, b: string): Promise<number> {
  const { data, error } = await supabase.rpc('accept_identical_labels', { p_set: set, p_coder_a: a, p_coder_b: b })
  if (error) throw error
  return data as number
}

export async function saveLabelAdjudication(phrase: number, a: string, b: string, dimension: string, sentiment: string, reason: string, gap: boolean): Promise<void> {
  const { error } = await supabase.rpc('save_label_adjudication', { p_phrase: phrase, p_coder_a: a, p_coder_b: b, p_dimension: dimension, p_sentiment: sentiment, p_reason: reason, p_gap: gap })
  if (error) throw error
}

export async function lastLabelDecision(phraseId: number): Promise<{ reason: string; gap: boolean; at: string } | null> {
  const { data, error } = await supabase.from('label_adjudication_log').select('reason,codebook_gap,decided_at').eq('phrase_id', phraseId).order('decided_at', { ascending: false }).limit(1)
  if (error) throw error
  return data?.[0] ? { reason: data[0].reason, gap: data[0].codebook_gap, at: data[0].decided_at } : null
}

export type CodebookVersion = { version: string; createdAt: string; note: string; body: string | null }
export type RoundStatus = {
  round: number; roundVersion: string; currentVersion: string; newerCodebook: boolean; reserve: number; codersFinished: number
  rounds: { round: number; version: string; at: string; reason: string }[]
}

export async function codebookList(): Promise<CodebookVersion[]> {
  const { data, error } = await supabase.rpc('codebook_list')
  if (error) throw error
  return (data ?? []).map((r: { version: string; created_at: string; change_log: string; body: string | null }) => ({ version: r.version, createdAt: r.created_at, note: r.change_log, body: r.body }))
}

export async function uploadCodebook(version: string, body: string, note: string): Promise<void> {
  const { error } = await supabase.rpc('upload_codebook', { p_version: version, p_body: body, p_note: note })
  if (error) throw error
}

export async function devRoundStatus(): Promise<RoundStatus> {
  const { data, error } = await supabase.rpc('dev_round_status')
  if (error) throw error
  return data as RoundStatus
}

export async function drawDevRound(reason: string): Promise<number> {
  const { data, error } = await supabase.rpc('draw_dev_round', { p_reason: reason })
  if (error) throw error
  return data as number
}

export async function reconfirmGold(phrase: number, dimension: string, sentiment: string, reason: string): Promise<void> {
  const { error } = await supabase.rpc('reconfirm_gold', { p_phrase: phrase, p_dimension: dimension, p_sentiment: sentiment, p_reason: reason })
  if (error) throw error
}

export async function reconfirmAllGold(reason: string): Promise<number> {
  const { data, error } = await supabase.rpc('reconfirm_all_gold', { p_reason: reason })
  if (error) throw error
  return data as number
}
