import type { AppLanguage } from '@/core/i18n';

export function getCountdown(dateTime: Date, language: AppLanguage = 'en'): { label: string; urgent: boolean } {
  const now = new Date();
  const diffMs = dateTime.getTime() - now.getTime();
  const el = language === 'el';

  if (diffMs <= 0) return { label: el ? 'τελείωσε' : 'ended', urgent: false };

  const diffMins = Math.floor(diffMs / 60000);
  if (diffMins < 60) return { label: el ? `σε ${diffMins}λ` : `in ${diffMins}m`, urgent: true };

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return { label: el ? `σε ${diffHours}ω` : `in ${diffHours}h`, urgent: diffHours < 3 };

  const diffDays = Math.floor(diffHours / 24);
  if (diffDays === 1) return { label: el ? 'αύριο' : 'tomorrow', urgent: false };
  return { label: el ? `σε ${diffDays}μ` : `in ${diffDays}d`, urgent: false };
}

export function formatMessageTime(timestamp: Date, language: AppLanguage = 'en'): string {
  const now = new Date();
  const diffMs = now.getTime() - timestamp.getTime();
  const diffMins = Math.floor(diffMs / 60000);
  const el = language === 'el';

  if (diffMins < 1) return el ? 'τώρα' : 'now';
  if (diffMins < 60) return el ? `${diffMins}λ πριν` : `${diffMins}m ago`;
  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) return el ? `${diffHours}ω πριν` : `${diffHours}h ago`;
  return el ? 'χθες' : 'yesterday';
}
