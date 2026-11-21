import { supabase } from '../lib/supabase'
import type { Phrase } from '../split/splitting'
import type { SetName } from '../split/api'

export type Meta = { reviewId: number; lang: string; set: SetName; body: string }
export type Coder = { id: string; name: string }
export type StaffData = {
  meta: Meta[]
  coders: Coder[]
  splits: Record<string, Record<number, Phrase[]>> // coder id -> review id -> phrases
  finished: Record<string, Record<number, true>> // coder id -> review id
  open: Record<string, boolean>
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
  const [meta, coders, splits, subs, access] = await Promise.all([
    supabase.rpc('review_meta'),
    supabase.from('profiles').select('user_id,display_name').eq('role', 'coder').order('display_name'),
    all<{ review_id: number; coder: string; start_offset: number; end_offset: number }>((f, t) =>
      supabase.from('human_splits').select('review_id,coder,start_offset,end_offset').order('split_id').range(f, t)),
    all<{ review_id: number; coder: string }>((f, t) =>
      supabase.from('split_submissions').select('review_id,coder').order('review_id').range(f, t)),
    supabase.from('set_access').select('set_name,is_open'),
  ])
  if (meta.error) throw meta.error
  if (coders.error) throw coders.error
  if (access.error) throw access.error
  const s: StaffData['splits'] = {}
  for (const r of splits) ((s[r.coder] ??= {})[r.review_id] ??= []).push({ start: r.start_offset, end: r.end_offset })
  const f: StaffData['finished'] = {}
  for (const r of subs) (f[r.coder] ??= {})[r.review_id] = true
  return {
    meta: (meta.data ?? []).map((r: { review_id: number; lang: string; set_name: SetName; body: string }) => ({
      reviewId: r.review_id, lang: r.lang, set: r.set_name, body: r.body,
    })),
    coders: (coders.data ?? []).map((c) => ({ id: c.user_id, name: c.display_name })),
    splits: s,
    finished: f,
    open: Object.fromEntries((access.data ?? []).map((a) => [a.set_name, a.is_open as boolean])),
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
