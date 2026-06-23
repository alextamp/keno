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
  const trimmed = email.trim().toLowerCase();

  if (!trimmed) {
    return { isValid: false, errorMessage: 'Email is required.' };
  }

  if (!EMAIL_GR_REGEX.test(trimmed)) {
    return {
      isValid: false,
      errorMessage: 'Please use your university email address (must end in .gr).',
    };
  }

  const domain = trimmed.split('@')[1];
  const isRecognised =
    KNOWN_UNIVERSITY_DOMAINS.has(domain) ||
    [...KNOWN_UNIVERSITY_DOMAINS].some((d) => domain.endsWith(`.${d}`));

  if (!isRecognised) {
    return {
      isValid: false,
      errorMessage: `"@${domain}" is not a recognised university domain. Contact support if your university is missing.`,
    };
  }

  return { isValid: true };
}

export function validatePassword(password: string): ValidationResult {
  if (!password) return { isValid: false, errorMessage: 'Password is required.' };
  if (password.length < 8) {
    return { isValid: false, errorMessage: 'Password must be at least 8 characters.' };
  }
  return { isValid: true };
}

export function validateName(name: string): ValidationResult {
  const trimmed = name.trim();
  if (!trimmed) return { isValid: false, errorMessage: 'Name is required.' };
  if (trimmed.length < 2) {
    return { isValid: false, errorMessage: 'Name must be at least 2 characters.' };
  }
  return { isValid: true };
}
