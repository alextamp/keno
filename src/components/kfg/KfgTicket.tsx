import React from 'react';
import { ViewStyle } from 'react-native';
import { format } from 'date-fns';
import { Ticket } from '@/components/ui/Ticket';
import { AccentScopeProvider } from '@/core/theme';
import { getDateLocale, useLanguageStore, useTranslation } from '@/core/i18n';
import { upper } from '@/components/wrapped/WrappedSlides';
import { formatPoints } from '@/features/kfg/format';
import { KfgTicketData } from '@/features/kfg/tickets';

/** The regular Ticket, in the KfG green, labelled with the mission's cause and the points it paid. */
export function KfgTicket({ ticket, compact, onSurface, style }: {
  ticket: KfgTicketData; compact?: boolean; onSurface?: boolean; style?: ViewStyle;
}) {
  const t = useTranslation();
  const { language } = useLanguageStore();
  const points = ticket.participation.award?.points ?? ticket.mission.points;
  return (
    <AccentScopeProvider value="kfg">
      <Ticket
        topLabel={`KENO FOR GOOD · ${ticket.label === 'firstSolo' ? t.ticketFirstSoloLabel
          : ticket.label === 'welcome' ? t.ticketWelcomeLabel
            : ticket.label === 'squad' ? t.ticketGroupBonusLabel
              : ticket.label === 'plusOne' ? t.ticketPlusOneLabel
                : upper(t.kfgCause(ticket.mission.cause))}`}
        title={ticket.mission.title}
        number={ticket.serial}
        footerLeft={format(ticket.doneAt, 'EEE d MMM · HH:mm', { locale: getDateLocale(language) })}
        footerRightText={ticket.mission.creatorName}
        xpLabel={`+${formatPoints(points, language)}`}
        compact={compact}
        onSurface={onSurface}
        style={style}
      />
    </AccentScopeProvider>
  );
}
