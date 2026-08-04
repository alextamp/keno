import { getTranslations } from '@/core/i18n';

export interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
  /** Set only for validateUniversityEmail's "well-formed .gr email, domain
   *  just isn't on our whitelist" case — lets callers offer the ID-photo
   *  fallback instead of just showing a dead-end error, without them having
   *  to string-match errorMessage. */
  code?: 'unrecognized_domain';
}

// Whitelist of recognised Greek university domains.
// Extend this set as more institutions are onboarded.
const KNOWN_UNIVERSITY_DOMAINS = new Set([
  'aueb.gr',        // Athens University of Economics and Business
  'uoa.gr',         // National and Kapodistrian University of Athens
  'ntua.gr',        // National Technical University of Athens
  'unipi.gr',       // University of Piraeus
  'uth.gr',         // University of Thessaly
  'aua.gr',         // Agricultural University of Athens
  'panteion.gr',    // Panteion University
  'upatras.gr',     // University of Patras
  'auth.gr',        // Aristotle University of Thessaloniki
  'uoc.gr',         // University of Crete
  'tuc.gr',         // Technical University of Crete
  'aegean.gr',      // University of the Aegean
  'ionio.gr',       // Ionian University
  'hua.gr',         // Harokopio University of Athens
  'eap.gr',         // Hellenic Open University
  'uniwa.gr',       // University of West Attica
  'uowm.gr',        // University of Western Macedonia
  'uop.gr',         // University of Peloponnese
  'ihu.edu.gr',     // International Hellenic University
  'aspete.gr',      // School of Pedagogical and Technological Education
  'duth.gr',        // Democritus University of Thrace
  'uoi.gr',         // University of Ioannina
  'uom.gr',         // University of Macedonia
  'asfa.gr',        // Athens School of Fine Arts
  'hmu.gr',         // Hellenic Mediterranean University
  'ihu.gr',         // International Hellenic University (alias of ihu.edu.gr above)
  // Pre-2019-merger ΤΕΙ domains — the 2019 reform folded these institutions
  // into the universities above, but continuing students and alumni can
  // still hold an email on the old domain for years afterward, so these
  // need to keep working alongside the successor institution's domain.
  'teiath.gr',      // ΤΕΙ Αθήνας — now part of Πανεπιστήμιο Δυτικής Αττικής (uniwa.gr)
  'teipir.gr',      // ΤΕΙ Πειραιά — now part of Πανεπιστήμιο Δυτικής Αττικής (uniwa.gr)
  'teithe.gr',      // ΤΕΙ Θεσσαλονίκης — now part of Διεθνές Πανεπιστήμιο Ελλάδος (ihu.gr)
  'teiser.gr',      // ΤΕΙ Σερρών — now part of Διεθνές Πανεπιστήμιο Ελλάδος (ihu.gr)
  'teikav.edu.gr',  // ΤΕΙ Καβάλας — now part of Διεθνές Πανεπιστήμιο Ελλάδος (ihu.gr)
  // Department sub-domains — technically redundant (any subdomain of a
  // listed domain already matches via the endsWith check below, e.g.
  // anything@*.uoa.gr), kept as explicit examples for future readers.
  'di.uoa.gr',
  'ece.upatras.gr',
  'cs.unipi.gr',
  'cs.ntua.gr',
  'cs.aueb.gr',
  'dmst.aueb.gr',
  'inf.uth.gr',
]);

// Accepts any email whose domain ends with .gr
const EMAIL_GR_REGEX = /^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.gr$/i;

export function validateUniversityEmail(email: string): ValidationResult {
  const t = getTranslations();
  const trimmed = email.trim().toLowerCase();

  if (!trimmed) {
    return { isValid: false, errorMessage: t.validEmailRequired };
  }

  if (!EMAIL_GR_REGEX.test(trimmed)) {
    return { isValid: false, errorMessage: t.validEmailInvalid };
  }

  const domain = trimmed.split('@')[1];
  const isRecognised =
    KNOWN_UNIVERSITY_DOMAINS.has(domain) ||
    [...KNOWN_UNIVERSITY_DOMAINS].some((d) => domain.endsWith(`.${d}`));

  if (!isRecognised) {
    return { isValid: false, errorMessage: t.validEmailUnrecognised(domain), code: 'unrecognized_domain' };
  }

  return { isValid: true };
}

// Basic format check for the "sign up with student ID photo" path, which
// doesn't require a recognised university domain.
const EMAIL_FORMAT_REGEX = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

export function validateGenericEmail(email: string): ValidationResult {
  const t = getTranslations();
  const trimmed = email.trim();
  if (!trimmed) return { isValid: false, errorMessage: t.validEmailRequired };
  if (!EMAIL_FORMAT_REGEX.test(trimmed)) return { isValid: false, errorMessage: t.validEmailInvalid };
  return { isValid: true };
}

export function validatePassword(password: string): ValidationResult {
  const t = getTranslations();
  if (!password) return { isValid: false, errorMessage: t.validPasswordRequired };
  if (password.length < 8) {
    return { isValid: false, errorMessage: t.validPasswordMin };
  }
  return { isValid: true };
}

export function validateName(name: string): ValidationResult {
  const t = getTranslations();
  const trimmed = name.trim();
  if (!trimmed) return { isValid: false, errorMessage: t.validNameRequired };
  if (trimmed.length < 2) {
    return { isValid: false, errorMessage: t.validNameMin };
  }
  return { isValid: true };
}

export function validateAge(age: string): ValidationResult {
  const t = getTranslations();
  const trimmed = age.trim();
  if (!trimmed) return { isValid: false, errorMessage: t.validAgeRequired };
  const n = Number(trimmed);
  if (!Number.isInteger(n) || n < 16 || n > 100) {
    return { isValid: false, errorMessage: t.validAgeRange };
  }
  return { isValid: true };
}
