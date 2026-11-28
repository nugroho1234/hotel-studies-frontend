import { supabase } from '../lib/supabase'
import type { Dimension, Flag, Sentiment } from './scheme'

export type LabelSet = 'dev' | 'test'
export const LABEL_SETS: { name: LabelSet; label: string }[] = [
  { name: 'dev', label: 'Development' },
  { name: 'test', label: 'Test' },
]
export type LabelPhrase = { id: number; start: number; end: number; text: string; dimension: Dimension | null; sentiment: Sentiment | null; flags: Flag[] }
export type LabelReview = { reviewId: number; lang: string; body: string; finished: boolean; notGuest: boolean; phrases: LabelPhrase[] }

export async function labelOpen(): Promise<Record<string, boolean>> {
  const { data, error } = await supabase.from('label_access').select('set_name,is_open')
  if (error) throw error
  return Object.fromEntries((data ?? []).map((r) => [r.set_name, r.is_open as boolean]))
}

type Row = { review_id: number; lang: string; body: string; phrase_id: number; start_offset: number; end_offset: number; phrase_text: string; dimension: Dimension | null; sentiment: Sentiment | null; finished: boolean; not_guest: boolean | null; flags: Flag[] | null }

export async function loadLabelQueue(set: LabelSet): Promise<LabelReview[]> {
  const { data, error } = await supabase.rpc('label_queue', { p_set: set })
  if (error) throw error
  const out: LabelReview[] = []
  for (const r of (data ?? []) as Row[]) {
    let rev = out[out.length - 1]
    if (!rev || rev.reviewId !== r.review_id) out.push((rev = { reviewId: r.review_id, lang: r.lang, body: r.body, finished: r.finished, notGuest: r.not_guest ?? false, phrases: [] }))
    rev.phrases.push({ id: r.phrase_id, start: r.start_offset, end: r.end_offset, text: r.phrase_text, dimension: r.dimension, sentiment: r.sentiment, flags: r.flags ?? [] })
  }
  return out
}

export async function saveLabel(phraseId: number, dimension: Dimension, sentiment: Sentiment, flags: Flag[]): Promise<void> {
  const { error } = await supabase.rpc('save_label', { p_phrase: phraseId, p_dimension: dimension, p_sentiment: sentiment, p_flags: flags })
  if (error) throw error
}

export async function finishLabels(set: LabelSet): Promise<void> {
  const { error } = await supabase.rpc('finish_labels', { p_set: set })
  if (error) throw error
}

// Training practice: coders label their own phrases (no adjudication, own table). A phrase is identified by its start offset.
type TRow = { review_id: number; lang: string; body: string; start_offset: number; end_offset: number; phrase_text: string; dimension: Dimension | null; sentiment: Sentiment | null; flags: Flag[] | null }

export function groupTraining(rows: TRow[]): LabelReview[] {
  const out: LabelReview[] = []
  for (const r of rows) {
    let rev = out[out.length - 1]
    if (!rev || rev.reviewId !== r.review_id) out.push((rev = { reviewId: r.review_id, lang: r.lang, body: r.body, finished: false, notGuest: false, phrases: [] }))
    rev.phrases.push({ id: r.start_offset, start: r.start_offset, end: r.end_offset, text: r.phrase_text, dimension: r.dimension, sentiment: r.sentiment, flags: r.flags ?? [] })
  }
  return out
}

export async function loadTrainingQueue(): Promise<LabelReview[]> {
  const { data, error } = await supabase.rpc('training_label_queue')
  if (error) throw error
  return groupTraining((data ?? []) as TRow[])
}

export async function saveTrainingLabel(reviewId: number, start: number, end: number, dimension: Dimension, sentiment: Sentiment, flags: Flag[]): Promise<void> {
  const { error } = await supabase.rpc('save_training_label', { p_review: reviewId, p_start: start, p_end: end, p_dimension: dimension, p_sentiment: sentiment, p_flags: flags })
  if (error) throw error
}

/** Lead: one coder's training work, to discuss live. */
export async function trainingOverview(coder: string): Promise<LabelReview[]> {
  const { data, error } = await supabase.rpc('training_overview', { p_coder: coder })
  if (error) throw error
  return groupTraining((data ?? []) as TRow[])
}

/** Lead: wipe one coder's training splits and labels so the set can be practised again. */
export async function resetTraining(coder: string): Promise<number> {
  const { data, error } = await supabase.rpc('reset_training', { p_coder: coder })
  if (error) throw error
  return data as number
}
