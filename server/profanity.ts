import { RegExpMatcher, englishDataset, englishRecommendedTransformers } from "obscenity";

const matcher = new RegExpMatcher({
  ...englishDataset.build(),
  ...englishRecommendedTransformers,
});

/**
 * Returns true if the text contains profanity or sexual language.
 * Used server-side only to reject high-score names.
 */
export function containsProfanity(text: string): boolean {
  return matcher.hasMatch(text);
}
