import { AppLanguage } from '@/core/i18n';

interface UniversityEntry {
  el: string;
  en: string;
}

export const UNIVERSITIES: UniversityEntry[] = [
  { el: 'ΕΚΠΑ', en: 'NKUA' },
  { el: 'ΕΜΠ', en: 'NTUA' },
  { el: 'ΟΠΑ', en: 'AUEB' },
  { el: 'Πάντειο', en: 'Panteion' },
  { el: 'Χαροκόπειο', en: 'Harokopio' },
  { el: 'Γεωπονικό', en: 'Agricultural Univ. of Athens' },
  { el: 'ΑΣΚΤ', en: 'Athens School of Fine Arts' },
  { el: 'Παν. Πειραιώς', en: 'Univ. of Piraeus' },
  { el: 'ΠΑΔΑ', en: 'Univ. of West Attica' },
  { el: 'ΑΠΘ', en: 'AUTH' },
  { el: 'Παν. Μακεδονίας', en: 'Univ. of Macedonia' },
  { el: 'ΔΙ.ΠΑ.Ε', en: 'International Hellenic Univ.' },
  { el: 'Παν. Πατρών', en: 'Univ. of Patras' },
  { el: 'Παν. Κρήτης', en: 'Univ. of Crete' },
  { el: 'Πολυτεχνείο Κρήτης', en: 'Technical Univ. of Crete' },
  { el: 'ΕΛΜΕΠΑ', en: 'Hellenic Mediterranean Univ.' },
  { el: 'Παν. Αιγαίου', en: 'Univ. of the Aegean' },
  { el: 'Παν. Ιωαννίνων', en: 'Univ. of Ioannina' },
  { el: 'ΔΠΘ', en: 'Democritus Univ. of Thrace' },
  { el: 'Παν. Θεσσαλίας', en: 'Univ. of Thessaly' },
  { el: 'Ιόνιο', en: 'Ionian Univ.' },
  { el: 'Παν. Πελοποννήσου', en: 'Univ. of the Peloponnese' },
  { el: 'Παν. Δυτ. Μακεδονίας', en: 'Univ. of Western Macedonia' },
  { el: 'ΕΑΠ', en: 'Hellenic Open Univ.' },
];

// Greek abbreviation is the stable identifier stored on user/event records —
// only the displayed label changes with language.
export const GREEK_UNIVERSITIES = UNIVERSITIES.map((u) => u.el);

export function universityLabel(el: string, language: AppLanguage): string {
  if (language === 'el') return el;
  return UNIVERSITIES.find((u) => u.el === el)?.en ?? el;
}

// True for one of the 24 curated universities above — false for anything
// typed in via the progressive signup flow's "Άλλο / Other" option, which
// stores whatever the person actually typed (not a placeholder) so it's
// still a real, meaningful value everywhere universityName is used
// elsewhere in the app (leaderboards, event restrictions, etc.).
export function isKnownUniversity(name: string): boolean {
  return UNIVERSITIES.some((u) => u.el === name);
}

// Primary academic email domain per university, keyed by the same Greek
// abbreviation used as the stable identifier above — mirrors the whitelist
// in core/utils/validators.ts's KNOWN_UNIVERSITY_DOMAINS. Used by the
// progressive signup flow to tell someone which email they'll need before
// they reach the account step, and to flag a picked-university/typed-email
// mismatch instead of silently accepting it.
export const UNIVERSITY_DOMAINS: Record<string, string> = {
  'ΕΚΠΑ': 'uoa.gr',
  'ΕΜΠ': 'ntua.gr',
  'ΟΠΑ': 'aueb.gr',
  'Πάντειο': 'panteion.gr',
  'Χαροκόπειο': 'hua.gr',
  'Γεωπονικό': 'aua.gr',
  'ΑΣΚΤ': 'asfa.gr',
  'Παν. Πειραιώς': 'unipi.gr',
  'ΠΑΔΑ': 'uniwa.gr',
  'ΑΠΘ': 'auth.gr',
  'Παν. Μακεδονίας': 'uom.gr',
  'ΔΙ.ΠΑ.Ε': 'ihu.gr',
  'Παν. Πατρών': 'upatras.gr',
  'Παν. Κρήτης': 'uoc.gr',
  'Πολυτεχνείο Κρήτης': 'tuc.gr',
  'ΕΛΜΕΠΑ': 'hmu.gr',
  'Παν. Αιγαίου': 'aegean.gr',
  'Παν. Ιωαννίνων': 'uoi.gr',
  'ΔΠΘ': 'duth.gr',
  'Παν. Θεσσαλίας': 'uth.gr',
  'Ιόνιο': 'ionio.gr',
  'Παν. Πελοποννήσου': 'uop.gr',
  'Παν. Δυτ. Μακεδονίας': 'uowm.gr',
  'ΕΑΠ': 'eap.gr',
};
