// Lightweight client-side profanity / slur filter for user-generated text
// (event titles & descriptions, group names & descriptions, bios, chat messages).
// Not a substitute for server-side moderation, but stops casual abuse and
// gives the user immediate feedback instead of letting it post.

const BLOCKED_TERMS = [
  // English profanity / slurs (common leetspeak variants included)
  'fuck', 'fck', 'fuk', 'shit', 'sh1t', 'bitch', 'b1tch', 'cunt', 'asshole',
  'dick', 'pussy', 'whore', 'slut', 'faggot', 'fag', 'nigger', 'nigga',
  'retard', 'rape', 'rapist', 'molest', 'pedo', 'pedophile', 'kys',
  'kill yourself', 'nazi', 'hitler', 'terrorist',
  // Greek profanity / slurs
  'μαλακας', 'μαλάκας', 'πουτανα', 'πουτάνα', 'γαμω', 'γαμώ', 'γαμησε',
  'γάμησε', 'σκατα', 'σκατά', 'πουστης', 'πούστης', 'καριολα', 'καριόλα',
  'βλακας', 'τσουλα', 'τσούλα', 'καργιολα', 'μουνι', 'μουνί', 'πεος', 'πέος',
];

function normalize(text: string): string {
  return text
    .toLowerCase()
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '') // strip accents so "μαλάκας" matches "μαλακας"
    .replace(/[^a-z0-9α-ωίϊΐόάέύϋΰήώ\s]/gi, ''); // drop punctuation/symbols used to dodge filters
}

const WORD_CHAR = 'a-z0-9α-ωίϊΐόάέύϋΰήώ';

export function containsBlockedContent(text: string): boolean {
  if (!text) return false;
  const normalized = normalize(text);
  return BLOCKED_TERMS.some((term) => {
    const normalizedTerm = normalize(term);
    if (!normalizedTerm) return false;
    const escaped = normalizedTerm.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    // Require word boundaries so blocked terms don't match as a substring of
    // an unrelated, legitimate word (e.g. "rape" inside "therapist").
    const pattern = new RegExp(`(^|[^${WORD_CHAR}])${escaped}([^${WORD_CHAR}]|$)`, 'i');
    return pattern.test(normalized);
  });
}

export interface ModerationResult {
  isAllowed: boolean;
  errorMessage?: string;
}

export function moderateText(text: string, errorMessage: string): ModerationResult {
  if (containsBlockedContent(text)) {
    return { isAllowed: false, errorMessage };
  }
  return { isAllowed: true };
}
