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
