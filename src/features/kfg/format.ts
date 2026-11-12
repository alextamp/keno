import { AppLanguage } from '@/core/i18n';
import { getKfgLevel } from '@/core/constants/kfg';

/** "1.240" in Greek, "1,240" in English — no Intl, which Hermes only partly supports. */
export function formatPoints(n: number, language: AppLanguage): string {
  const sep = language === 'el' ? '.' : ',';
  return Math.round(n).toString().replace(/\B(?=(\d{3})+(?!\d))/g, sep);
}

export function kfgLevelInfo(lifetimePoints: number, language: AppLanguage) {
  const l = getKfgLevel(lifetimePoints);
  return { ...l, label: l.name[language], nextLabel: l.next?.name[language] ?? null };
}
