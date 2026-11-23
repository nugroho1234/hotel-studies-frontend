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
export type Dimension = (typeof DIMENSIONS)[number]['code']
export type Sentiment = (typeof SENTIMENTS)[number]['code']
