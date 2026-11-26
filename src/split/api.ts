import { supabase } from '../lib/supabase'
import { phraseText, type Phrase } from './splitting'

export type SetName = 'training' | 'dev' | 'test'
export const SETS: { name: SetName; label: string; hint: string }[] = [
  { name: 'training', label: 'Training', hint: 'Practice reviews. Stored, never used to evaluate.' },
  { name: 'dev', label: 'Development', hint: 'Used to check the codebook before the test set.' },
  { name: 'test', label: 'Test', hint: 'Coded once, with the frozen codebook.' },
]

export type QueueItem = { reviewId: number; lang: string; body: string; finished: boolean; excluded: string | null }

export async function openSets(): Promise<Record<string, boolean>> {
  const { data, error } = await supabase.from('set_access').select('set_name,is_open')
  if (error) throw error
  return Object.fromEntries((data ?? []).map((r) => [r.set_name, r.is_open as boolean]))
}

/** The coder's queue plus their saved phrases, keyed by review id. */
export async function loadQueue(set: SetName): Promise<{ items: QueueItem[]; saved: Record<number, Phrase[]> }> {
  const q = await supabase.rpc('coder_queue', { p_set: set })
  if (q.error) throw q.error
  const items: QueueItem[] = (q.data ?? []).map((r: { review_id: number; lang: string; body: string; finished: boolean; excluded: string | null }) => ({
    reviewId: r.review_id, lang: r.lang, body: r.body, finished: r.finished, excluded: r.excluded,
  }))
  // shortcut: one request returns at most 1,000 rows (the API default); the largest set is ~100 reviews x a few phrases.
  const s = await supabase.from('human_splits').select('review_id,start_offset,end_offset').order('start_offset')
  if (s.error) throw s.error
  const saved: Record<number, Phrase[]> = {}
  for (const r of s.data ?? []) (saved[r.review_id] ??= []).push({ start: r.start_offset, end: r.end_offset })
  return { items, saved }
}

/** The database checks each phrase's text against the review text at its offsets. */
export async function saveSplits(reviewId: number, phrases: Phrase[], body: string): Promise<void> {
  const { error } = await supabase.rpc('save_splits', { p_review: reviewId, p_phrases: phrases.map((p) => ({ ...p, text: phraseText(body, p) })) })
  if (error) throw error
}

export const REASONS = [
  { code: 'E1_language', label: 'E1: not written in English or Indonesian' },
  { code: 'E2_translation_duplicate', label: 'E2: the same text repeated in several languages' },
  { code: 'E3_not_guest', label: 'E3: the writer was not a guest' },
]

/** Eligibility step: eligible (reason null) or excluded with a reason. The lead adjudicates exclusions. */
export async function setEligibility(reviewId: number, reason: string | null): Promise<void> {
  const { error } = await supabase.rpc('set_eligibility', { p_review: reviewId, p_eligible: reason === null, p_reason: reason })
  if (error) throw error
}

export async function finishSet(set: SetName): Promise<void> {
  const { error } = await supabase.rpc('finish_set', { p_set: set })
  if (error) throw error
}
