export interface InterestOption {
  key: string;
  tKey: string;
  emoji: string;
}

// Keyword stems (lowercase, deliberately partial — Greek inflects heavily,
// e.g. μπάλα/μπάλας/μπάλες, so a substring match catches more real posts
// than a whole-word match would) used to score how well an event matches a
// picked interest. Only a handful of these interests (Sports/Study/Coffee)
// have a same-named EventCategory to match against directly — everything
// else only ever has a shot at matching if it's searched against the
// event's own title/description text, which is what this key is for (see
// interestScore in FeedTab.tsx). Keeping this as its own curated list
// rather than reusing the translated display labels means a copy tweak to
// "Sports"/"Αθλητισμός" elsewhere can never silently break matching here.
export const INTEREST_MATCH_KEYWORDS: Record<string, string[]> = {
  Sports:  ['sport', 'αθλητ', 'μπάλα', 'ποδόσφαιρ', 'μπάσκετ', 'βόλεϊ', 'τένις'],
  Music:   ['music', 'μουσικ', 'κονσέρτ', 'συναυλ', 'live'],
  Gaming:  ['gam', 'παιχνίδ', 'gaming', 'esports', 'ηλεκτρονικό παιχνίδι'],
  Study:   ['study', 'διάβασμα', 'διαβάζ', 'μελέτ', 'προετοιμασία εξετάσεων'],
  Coffee:  ['coffee', 'καφέ', 'καφές', 'espresso', 'φραπ'],
  Art:     ['art', 'τέχν', 'ζωγραφ', 'έκθεση', 'gallery'],
  Parties: ['party', 'parties', 'πάρτι', 'πάρτυ'],
  Hiking:  ['hik', 'πεζοπορ', 'βουνό', 'trekking', 'ορειβασ'],
  Cinema:  ['cinema', 'movie', 'σινεμά', 'ταινί', 'προβολή'],
  Cooking: ['cook', 'μαγειρ', 'κουζίν', 'συνταγ'],
  Travel:  ['travel', 'ταξίδ', 'εκδρομ', 'trip'],
  Tech:    ['tech', 'τεχνολογ', 'coding', 'προγραμματισμ', 'hackathon', 'startup'],
  Reading: ['read', 'βιβλί', 'ανάγνωσ', 'book club'],
  Dance:   ['danc', 'χορό', 'χορευ', 'χορ'],
  Fitness: ['fitness', 'γυμναστήρ', 'γυμναστικ', 'workout', 'προπόνησ'],
  Chess:   ['chess', 'σκάκι', 'σκακιστ'],
};

export const INTERESTS: InterestOption[] = [
  { key: 'Sports',  tKey: 'interestSports',  emoji: '⚽' },
  { key: 'Music',   tKey: 'interestMusic',   emoji: '🎵' },
  { key: 'Gaming',  tKey: 'interestGaming',  emoji: '🎮' },
  { key: 'Study',   tKey: 'interestStudy',   emoji: '📚' },
  { key: 'Coffee',  tKey: 'interestCoffee',  emoji: '☕' },
  { key: 'Art',     tKey: 'interestArt',     emoji: '🎨' },
  { key: 'Parties', tKey: 'interestParties', emoji: '🎉' },
  { key: 'Hiking',  tKey: 'interestHiking',  emoji: '🏃' },
  { key: 'Cinema',  tKey: 'interestCinema',  emoji: '🎬' },
  { key: 'Cooking', tKey: 'interestCooking', emoji: '🍳' },
  { key: 'Travel',  tKey: 'interestTravel',  emoji: '✈️' },
  { key: 'Tech',    tKey: 'interestTech',    emoji: '💻' },
  { key: 'Reading', tKey: 'interestReading', emoji: '📖' },
  { key: 'Dance',   tKey: 'interestDance',   emoji: '💃' },
  { key: 'Fitness', tKey: 'interestFitness', emoji: '🏋️' },
  { key: 'Chess',   tKey: 'interestChess',   emoji: '♟️' },
];
