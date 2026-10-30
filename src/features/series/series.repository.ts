import {
  addDoc, collection, deleteDoc, doc, getDoc, getDocs, query, serverTimestamp, Timestamp, updateDoc, where,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { Failure, ServerFailure } from '@/core/errors/failures';
import { Either, isLeft, left, right } from '@/core/utils/either';
import { EventEntity } from '@/features/events/domain/entities/event.entity';
import { CreateEventParams, UpdateEventParams } from '@/features/events/domain/repositories/events.repository';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { dueOccurrenceIndexes, RepeatFrequency, seriesDates } from './series';

const SERIES = 'eventSeries';

// Per-occurrence state that must never be copied into the next occurrence:
// each one has its own date, attendees, chat, check-in and stats.
const NOT_TEMPLATED = [
  'dateTime', 'attendeeIds', 'waitlistIds', 'reactions', 'messages', 'createdAt', 'viewCount', 'rsvpStakes',
  'joinRequests', 'invitedUserIds', 'seriesIndex', 'hostArrivedAt', 'standInHostId', 'standInClaimedAt',
  'feedbackGoodCount', 'feedbackBadCount', 'referredBy', 'endedAt', 'isFlagship',
];

export interface SeriesRule {
  frequency: Exclude<RepeatFrequency, 'once'>;
  weekdays: number[];
  count: number;
}

export const seriesRepository = {
  /** Creates the series and every occurrence already inside the horizon; returns the first one. */
  async createSeries(params: CreateEventParams, rule: SeriesRule): Promise<Either<Failure, EventEntity>> {
    try {
      const dates = seriesDates(params.dateTime, rule.frequency, rule.weekdays, rule.count);
      const seriesRef = await addDoc(collection(db, SERIES), {
        creatorId: params.creatorId,
        frequency: rule.frequency,
        weekdays: rule.weekdays,
        dates: dates.map((d) => Timestamp.fromDate(d)),
        generatedCount: 0,
        active: true,
        template: null,
        createdAt: serverTimestamp(),
      });

      const first = await eventsRepository.createEvent({ ...params, dateTime: dates[0], seriesId: seriesRef.id, seriesIndex: 0 });
      if (isLeft(first)) {
        await deleteDoc(seriesRef).catch(() => {});
        return first;
      }
      const snap = await getDoc(doc(db, 'events', first.right.id));
      const template = Object.fromEntries(
        Object.entries(snap.data() ?? {}).filter(([k]) => !NOT_TEMPLATED.includes(k)),
      );

      let generated = 1;
      for (const i of dueOccurrenceIndexes(dates, 1)) {
        const r = await eventsRepository.createEvent({
          ...params, dateTime: dates[i], seriesId: seriesRef.id, seriesIndex: i, skipRewards: true,
        });
        if (isLeft(r)) break;
        generated = i + 1;
      }
      await updateDoc(seriesRef, { template, generatedCount: generated });
      return right(first.right);
    } catch (e: any) {
      return left(new ServerFailure(e.message ?? 'Failed to create series.'));
    }
  },

  /** No further occurrences get created; existing ones are left alone. */
  async stopSeries(seriesId: string): Promise<void> {
    await updateDoc(doc(db, SERIES, seriesId), { active: false });
  },

  /**
   * "This and following": applies the same edit to every later occurrence
   * that already exists and to the template future ones are built from. A
   * changed date/time is applied as the same shift to each of them.
   */
  async applyToFollowing(edited: EventEntity, original: EventEntity, patch: UpdateEventParams): Promise<void> {
    if (!edited.seriesId || edited.seriesIndex == null) return;
    const shiftMs = patch.dateTime ? patch.dateTime.getTime() - original.dateTime.getTime() : 0;
    const { dateTime: _ignored, ...rest } = patch;

    const seriesRef = doc(db, SERIES, edited.seriesId);
    const seriesSnap = await getDoc(seriesRef);
    if (seriesSnap.exists()) {
      const data = seriesSnap.data();
      const template = { ...(data.template ?? {}) };
      Object.entries(rest).forEach(([k, v]) => { if (v !== undefined) template[k] = v; });
      const dates = (data.dates as Timestamp[]).map((ts, i) =>
        i > edited.seriesIndex! && shiftMs ? Timestamp.fromMillis(ts.toMillis() + shiftMs) : ts);
      await updateDoc(seriesRef, { template, dates });
    }

    const snap = await getDocs(query(collection(db, 'events'), where('seriesId', '==', edited.seriesId)));
    const later = snap.docs.filter((d) => (d.data().seriesIndex ?? 0) > edited.seriesIndex! && d.data().creatorId === edited.creatorId);
    await Promise.all(later.map((d) => {
      const when = (d.data().dateTime as Timestamp).toDate();
      return eventsRepository.updateEvent(d.id, { ...rest, ...(shiftMs ? { dateTime: new Date(when.getTime() + shiftMs) } : {}) });
    }));
  },
};
