// Labels coders choose from (codebook: one dimension and one sentiment per phrase, sentiment for every phrase incl. None).
export const DIMENSIONS = [
  { code: 'TAN', name: 'Tangibles' },
  { code: 'REL', name: 'Reliability' },
  { code: 'RES', name: 'Responsiveness' },
  { code: 'ASR', name: 'Assurance' },
  { code: 'EMP', name: 'Empathy' },
  { code: 'VAL', name: 'Value' },
  { code: 'LOC', name: 'Location' },
  { code: 'FNB', name: 'Food and beverage' },
  { code: 'GEN', name: 'General service' },
  { code: 'UNC', name: 'Unclear' },
  { code: 'NON', name: 'None' },
] as const
export const SENTIMENTS = [
  { code: 'positive', name: 'Positive' },
  { code: 'negative', name: 'Negative' },
  { code: 'neutral', name: 'Neutral' },
] as const
// Codebook v0.2 flags, zero or more per phrase. 'Unclear referent' is left out on purpose (removed in v0.3, overlaps UNC).
export const FLAGS = [
  { code: 'wrong_split', name: 'Wrong split' },
  { code: 'cannot_split', name: 'Cannot split' },
  { code: 'sarcasm', name: 'Sarcasm' },
  { code: 'mixed_language', name: 'Mixed language' },
  { code: 'name_sign_off', name: 'Name sign-off' },
  { code: 'day_visitor', name: 'Day visitor' },
] as const
export type Flag = (typeof FLAGS)[number]['code']
export type Dimension = (typeof DIMENSIONS)[number]['code']
export type Sentiment = (typeof SENTIMENTS)[number]['code']
