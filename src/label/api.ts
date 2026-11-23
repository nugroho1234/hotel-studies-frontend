import { supabase } from '../lib/supabase'
import type { Dimension, Sentiment } from './scheme'

export type LabelSet = 'dev' | 'test'
export const LABEL_SETS: { name: LabelSet; label: string }[] = [
  { name: 'dev', label: 'Development' },
  { name: 'test', label: 'Test' },
]
export type LabelPhrase = { id: number; start: number; end: number; text: string; dimension: Dimension | null; sentiment: Sentiment | null }
export type LabelReview = { reviewId: number; lang: string; body: string; finished: boolean; notGuest: boolean; phrases: LabelPhrase[] }

export async function labelOpen(): Promise<Record<string, boolean>> {
  const { data, error } = await supabase.from('label_access').select('set_name,is_open')
  if (error) throw error
  return Object.fromEntries((data ?? []).map((r) => [r.set_name, r.is_open as boolean]))
}

type Row = { review_id: number; lang: string; body: string; phrase_id: number; start_offset: number; end_offset: number; phrase_text: string; dimension: Dimension | null; sentiment: Sentiment | null; finished: boolean; not_guest: boolean | null }

export async function loadLabelQueue(set: LabelSet): Promise<LabelReview[]> {
  const { data, error } = await supabase.rpc('label_queue', { p_set: set })
  if (error) throw error
  const out: LabelReview[] = []
  for (const r of (data ?? []) as Row[]) {
    let rev = out[out.length - 1]
    if (!rev || rev.reviewId !== r.review_id) out.push((rev = { reviewId: r.review_id, lang: r.lang, body: r.body, finished: r.finished, notGuest: r.not_guest ?? false, phrases: [] }))
    rev.phrases.push({ id: r.phrase_id, start: r.start_offset, end: r.end_offset, text: r.phrase_text, dimension: r.dimension, sentiment: r.sentiment })
  }
  return out
}

export async function saveLabel(phraseId: number, dimension: Dimension, sentiment: Sentiment): Promise<void> {
  const { error } = await supabase.rpc('save_label', { p_phrase: phraseId, p_dimension: dimension, p_sentiment: sentiment })
  if (error) throw error
}

export async function finishLabels(set: LabelSet): Promise<void> {
  const { error } = await supabase.rpc('finish_labels', { p_set: set })
  if (error) throw error
}
