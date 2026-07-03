import { getTranslations } from '@/core/i18n';

export interface ValidationResult {
  isValid: boolean;
  errorMessage?: string;
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
  // Department sub-domains
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
    return { isValid: false, errorMessage: t.validEmailUnrecognised(domain) };
  }

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
