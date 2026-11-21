## Marking phrases

A phrase is a continuous stretch of the original review that contains one evaluated aspect and one judgement. In Stage 1, mark the phrases by highlighting the review text.

1. Highlight the original text. Do not edit, retype, shorten or correct the text, including spelling errors.
2. Cover the whole review. Every word belongs to exactly one phrase. Phrases follow each other in order, without overlaps or gaps.
3. Split only between words, never inside a word.
4. Connecting and contrast words start the following phrase: *and, but, although, however, while, yet; dan, tapi, namun, meskipun, walaupun, sedangkan, cuma, hanya saja.*
5. Punctuation stays with the word before it. A full stop, exclamation mark or question mark belongs to the last phrase of its sentence.
6. Do not restore missing subjects. The full review is visible during labelling, so "and quick to respond" is understood as referring to the staff.

## Where to split

Split at a point only if at least one of the following applies.

- **S1. End of a sentence.** A sentence ends with a full stop, exclamation mark, question mark, ellipsis or line break. Full stops in abbreviations (Mr., No.) do not end a sentence.
- **S2. A contrast word.** Split before the contrast words listed in rule 4.
- **S3. The aspect changes.** Split where the text moves to an aspect that takes a different label, even if the subject stays the same. This includes:
  - a list of different aspects ("Kamar bersih, sarapan enak, lokasi strategis");
  - one evaluation shared by different aspects ("The service | and food are excellent");
  - a problem followed by the hotel's response ("We had an issue with the key card, | but they fixed it within minutes");
  - narrative followed by an evaluation in the same sentence.
- **S4. The judgement changes.** Split where the sentiment changes within the same aspect ("The room is old | but clean.").

## When not to split

Within a sentence, if none of S2 to S4 applies, do not split. In particular:

- Several words about the same aspect with the same judgement stay together: "warm and friendly", "friendly and polite", "clean and comfortable".
- Several items under the same label with the same judgement stay together: "The bed and pillows were very comfortable."
- Explanations and details of the same judgement stay together: "The bed was comfortable because the mattress was new."
- A place or time that is not itself evaluated stays with its phrase: "Breakfast at the rooftop restaurant was delicious" is one phrase. Code what the guest evaluates, not where it happened.

If a phrase still mixes praise and criticism, or two aspects, it has not been split far enough. Flag it as a wrong split in Stage 2.

## Emojis

- Emojis are part of the text. Do not delete them.
- An emoji stays with the phrase before it, like punctuation. An emoji at the very start of a review stays with the phrase after it. An emoji is never a phrase on its own.
- An emoji counts as a sentence end when a new clause follows it, even with no space or full stop. "…life 🥰thank you" is split as "…life 🥰 | thank you". An emoji inside a clause ("The pool 😍 was amazing") does not end the sentence.
- In labelling, an emoji can inform the sentiment of its phrase, especially for sarcasm: "Great service 🙄" is negative.

## Examples

A vertical bar marks a split. Labels and sentiments are assigned in Stage 2 and are shown here for reference.

| Review text | Phrases | Rule | Codes |
|---|---|---|---|
| The staff is warm and friendly. | The staff is warm and friendly. | No split | ASS positive |
| Friendly and polite staff. | Friendly and polite staff. | No split | ASS positive |
| The bed and pillows were very comfortable. | The bed and pillows were very comfortable. | No split | TAN positive |
| Breakfast at the rooftop restaurant was delicious. | Breakfast at the rooftop restaurant was delicious. | No split | FNB positive |
| The room was clean but the AC was noisy. | The room was clean \| but the AC was noisy. | S2, S4 | TAN positive, TAN negative |
| The room is old but clean. | The room is old \| but clean. | S2, S4 | TAN negative, TAN positive |
| Stafnya ramah tapi lambat. | Stafnya ramah \| tapi lambat. | S2, S3 | ASS positive, RES negative |
| Friendly and helpful staff. | Friendly \| and helpful staff. | S3 | ASS positive, RES positive |
| The staff is friendly and quick to respond to my complaints. | The staff is friendly \| and quick to respond to my complaints. | S3 | ASS positive, RES positive |
| Staff were friendly, helpful and professional. | Staff were friendly, \| helpful \| and professional. | S3 | ASS positive, RES positive, ASS positive |
| Kamar bersih, sarapan enak, lokasi strategis. | Kamar bersih, \| sarapan enak, \| lokasi strategis. | S3 | TAN positive, FNB positive, LOC positive |
| The service and food are excellent. | The service \| and food are excellent. | S3 | GEN positive, FNB positive |
| We had an issue with the key card, but they fixed it within minutes. | We had an issue with the key card, \| but they fixed it within minutes. | S2, S3 | TAN negative, RES positive |
| We stayed three nights for a wedding and the room was spacious. | We stayed three nights for a wedding \| and the room was spacious. | S3 | NON neutral, TAN positive |
| Breakfast was delicious. Highly recommended! | Breakfast was delicious. \| Highly recommended! | S1 | FNB positive, NON positive |
