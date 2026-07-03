export interface InterestOption {
  key: string;
  tKey: string;
  emoji: string;
}

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
