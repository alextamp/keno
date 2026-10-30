import React, { useEffect, useState } from 'react';
import { Alert, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { format } from 'date-fns';
import { ScreenHeader } from '@/components/ui/ScreenHeader';
import { Card } from '@/components/ui/Card';
import { Button } from '@/components/ui/Button';
import { Input } from '@/components/ui/Input';
import { Icon } from '@/components/ui/Icon';
import { VerifiedBadge } from '@/components/ui/VerifiedBadge';
import { LoadingScreen } from '@/components/ui/LoadingScreen';
import { AnimatedPressable } from '@/components/ui/AnimatedPressable';
import { BorderRadius, FontSize, FontWeight, Spacing, TitleFont, UIFont, UIFontLight } from '@/core/constants/theme';
import { isVerifiedUser } from '@/core/constants/gamification';
import { useTheme } from '@/core/theme';
import { getDateLocale, useLanguageStore, useTranslation } from '@/core/i18n';
import { isLeft } from '@/core/utils/either';
import { analytics } from '@/core/utils/analytics';
import { containsBlockedContent } from '@/core/utils/contentModeration';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { UserEntity } from '@/features/auth/domain/entities/user.entity';
import { EventEntity } from '@/features/events/domain/entities/event.entity';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { notificationsRepository } from '@/features/notifications/notifications.repository';
import { NotifType } from '@/features/notifications/notification.entity';
import { Booking, Ride, ridesRepository } from '@/features/rides/rides.repository';

// Leave this many minutes before the event starts — a chip row instead of a
// full time picker, since a ride only ever makes sense shortly before.
const LEAVE_BEFORE_OPTIONS = [30, 60, 90, 120] as const;

function notify(type: NotifType, toUid: string, from: UserEntity, event: EventEntity) {
  notificationsRepository.create({
    toUid, type,
    fromUid: from.id, fromName: from.name, fromAvatarColor: from.avatarColor, fromPhotoUri: from.photoUri,
    eventId: event.id, eventTitle: event.title,
  }).catch(() => {});
}

export default function RidesScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();
  const t = useTranslation();
  const user = useAuthStore((s) => s.user);
  const [event, setEvent] = useState<EventEntity | null>(null);
  const [rides, setRides] = useState<Ride[] | null>(null);
  const [failed, setFailed] = useState(false);
  const [offering, setOffering] = useState(false);

  useEffect(() => {
    if (!id) return;
    eventsRepository.getEvent(id).then((r) => (isLeft(r) ? setFailed(true) : setEvent(r.right)));
    return ridesRepository.subscribeRides(id, setRides);
  }, [id]);

  if (failed) {
    return (
      <View style={[styles.root, { backgroundColor: colors.background, paddingTop: insets.top + 12 }]}>
        <View style={{ paddingHorizontal: Spacing.gutter }}><ScreenHeader title={t.ridesTitle} /></View>
        <Text style={[styles.empty, { color: colors.textHint }]}>{t.authErrGeneric}</Text>
      </View>
    );
  }
  if (!event || !rides || !user) return <LoadingScreen />;

  const attending = event.attendeeIds.includes(user.id);
  const blocked = new Set(user.blockedUserIds ?? []);
  const visible = rides.filter((r) => !blocked.has(r.driverId));
  const myRide = visible.find((r) => r.driverId === user.id);

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      <View style={{ paddingHorizontal: Spacing.gutter, paddingTop: insets.top + 12 }}>
        <ScreenHeader title={t.ridesTitle} />
      </View>
      <ScrollView
        contentContainerStyle={[styles.content, { paddingBottom: insets.bottom + 32 }]}
        keyboardShouldPersistTaps="handled"
      >
        <Text style={[styles.eventTitle, { color: colors.textPrimary }]} numberOfLines={2}>{event.title}</Text>
        <View style={[styles.disclaimer, { backgroundColor: colors.surfaceVariant }]}>
          <Icon name="alert" size={14} color={colors.textHint} />
          <Text style={[styles.disclaimerText, { color: colors.textHint }]}>{t.ridesDisclaimer}</Text>
        </View>

        {!attending ? (
          <Text style={[styles.hint, { color: colors.textHint }]}>{t.ridesJoinFirst}</Text>
        ) : !myRide && !offering ? (
          <Button label={t.ridesOfferBtn} variant="soft" onPress={() => setOffering(true)} fullWidth />
        ) : null}

        {offering && !myRide && (
          <OfferForm event={event} user={user} onDone={() => setOffering(false)} />
        )}

        {visible.length === 0 && !offering ? (
          <View style={styles.emptyWrap}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
              <Icon name="users" size={28} color={colors.primary} />
            </View>
            <Text style={[styles.empty, { color: colors.textHint }]}>{t.ridesEmpty}</Text>
          </View>
        ) : (
          visible.map((ride) => (
            <RideCard key={ride.id} ride={ride} event={event} user={user} canBook={attending} />
          ))
        )}
      </ScrollView>
    </View>
  );
}

function OfferForm({ event, user, onDone }: { event: EventEntity; user: UserEntity; onDone: () => void }) {
  const { colors } = useTheme();
  const t = useTranslation();
  const [area, setArea] = useState('');
  const [meeting, setMeeting] = useState('');
  const [leaveBefore, setLeaveBefore] = useState<number>(60);
  const [seats, setSeats] = useState(3);
  const [cost, setCost] = useState('');
  const [saving, setSaving] = useState(false);

  const costValue = cost.trim() ? Number(cost.replace(',', '.')) : undefined;
  const canSubmit = area.trim().length >= 2 && meeting.trim().length >= 2 &&
    (costValue == null || (Number.isFinite(costValue) && costValue >= 0 && costValue <= 100));

  const submit = async () => {
    if (!canSubmit) return;
    if (containsBlockedContent(area) || containsBlockedContent(meeting)) {
      Alert.alert(t.ridesTitle, t.validContentBlocked);
      return;
    }
    setSaving(true);
    const result = await ridesRepository.offerRide(event.id, {
      driver: { id: user.id, name: user.name, avatarColor: user.avatarColor, photoUri: user.photoUri, checkInCount: user.checkInCount },
      departureArea: area.trim(),
      departureTime: new Date(event.dateTime.getTime() - leaveBefore * 60_000),
      seats,
      costPerPerson: costValue,
      meetingPoint: meeting.trim(),
    });
    setSaving(false);
    if (isLeft(result)) { Alert.alert(t.ridesTitle, t.authErrGeneric); return; }
    analytics.track('ride_offered', { eventId: event.id, seats });
    onDone();
  };

  return (
    <Card padded style={styles.form}>
      <Input label={t.ridesAreaLabel} hint={t.ridesAreaHint} value={area} onChangeText={setArea} maxLength={60} />
      <Input label={t.ridesMeetingLabel} hint={t.ridesMeetingHint} value={meeting} onChangeText={setMeeting} maxLength={120} />

      <Text style={[styles.label, { color: colors.textPrimary }]}>{t.ridesLeaveLabel}</Text>
      <View style={styles.chips}>
        {LEAVE_BEFORE_OPTIONS.map((m) => {
          const on = leaveBefore === m;
          return (
            <AnimatedPressable
              key={m}
              onPress={() => setLeaveBefore(m)}
              style={[styles.chip, { borderColor: on ? colors.primary : colors.border, backgroundColor: on ? colors.accentSoft : colors.surface }]}
            >
              <Text style={[styles.chipText, { color: on ? colors.primary : colors.textPrimary }]}>{t.ridesLeaveBefore(m)}</Text>
            </AnimatedPressable>
          );
        })}
      </View>

      <View style={styles.stepperRow}>
        <Text style={[styles.label, { color: colors.textPrimary }]}>{t.ridesSeatsLabel}</Text>
        <View style={styles.stepper}>
          <AnimatedPressable onPress={() => setSeats((s) => Math.max(1, s - 1))} style={[styles.stepBtn, { borderColor: colors.border }]}>
            <Text style={[styles.stepText, { color: colors.textPrimary }]}>−</Text>
          </AnimatedPressable>
          <Text style={[styles.stepValue, { color: colors.textPrimary }]}>{seats}</Text>
          <AnimatedPressable onPress={() => setSeats((s) => Math.min(6, s + 1))} style={[styles.stepBtn, { borderColor: colors.border }]}>
            <Text style={[styles.stepText, { color: colors.textPrimary }]}>+</Text>
          </AnimatedPressable>
        </View>
      </View>

      <Input
        label={t.ridesCostLabel}
        hint={t.ridesCostHint}
        value={cost}
        onChangeText={setCost}
        keyboardType="decimal-pad"
        maxLength={5}
      />

      <View style={styles.formActions}>
        <Button label={t.settingsBtnCancel} variant="ghost" onPress={onDone} style={styles.flex} />
        <Button label={t.ridesPublish} onPress={submit} loading={saving} disabled={!canSubmit} style={styles.flex} />
      </View>
    </Card>
  );
}

function RideCard({ ride, event, user, canBook }: { ride: Ride; event: EventEntity; user: UserEntity; canBook: boolean }) {
  const { colors } = useTheme();
  const t = useTranslation();
  const router = useRouter();
  const { language } = useLanguageStore();
  const isMine = ride.driverId === user.id;
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [myBooking, setMyBooking] = useState<Booking | null>(null);
  const [meetingPoint, setMeetingPoint] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const confirmed = myBooking?.status === 'confirmed' && ride.confirmedIds.includes(user.id);
  const seatsLeft = Math.max(0, ride.seats - ride.confirmedIds.length);

  useEffect(() => {
    if (isMine) return ridesRepository.subscribeBookings(event.id, ride.id, setBookings);
    return ridesRepository.subscribeMyBooking(event.id, ride.id, user.id, setMyBooking);
  }, [isMine, event.id, ride.id, user.id]);

  useEffect(() => {
    if (isMine || confirmed) ridesRepository.getMeetingPoint(event.id, ride.id).then(setMeetingPoint);
  }, [isMine, confirmed, event.id, ride.id]);
  const showMeeting = !!meetingPoint && (isMine || confirmed);

  const run = async (fn: () => Promise<unknown>) => {
    setBusy(true);
    await fn();
    setBusy(false);
  };

  const request = () => run(async () => {
    const r = await ridesRepository.requestSeat(event.id, ride.id, { id: user.id, name: user.name, avatarColor: user.avatarColor, photoUri: user.photoUri });
    if (isLeft(r)) { Alert.alert(t.ridesTitle, t.authErrGeneric); return; }
    analytics.track('ride_seat_requested', { eventId: event.id });
    notify('ride_request', ride.driverId, user, event);
  });

  const cancelSeat = () => run(async () => {
    const wasConfirmed = confirmed;
    const r = await ridesRepository.cancelSeat(event.id, ride.id, user.id, wasConfirmed);
    if (isLeft(r)) { Alert.alert(t.ridesTitle, t.authErrGeneric); return; }
    if (wasConfirmed) notify('ride_cancelled', ride.driverId, user, event);
  });

  const confirm = (b: Booking) => run(async () => {
    const r = await ridesRepository.confirmSeat(event.id, ride.id, b.uid);
    if (isLeft(r)) { Alert.alert(t.ridesTitle, t.ridesFull); return; }
    analytics.track('ride_seat_confirmed', { eventId: event.id });
    notify('ride_confirmed', b.uid, user, event);
  });

  const decline = (b: Booking) => run(async () => {
    const r = await ridesRepository.declineSeat(event.id, ride.id, b.uid, b.status === 'confirmed');
    if (isLeft(r)) { Alert.alert(t.ridesTitle, t.authErrGeneric); return; }
    notify('ride_declined', b.uid, user, event);
  });

  const cancelRide = () => {
    Alert.alert(t.ridesCancelRideBtn, t.ridesCancelRideConfirm, [
      { text: t.settingsBtnCancel, style: 'cancel' },
      {
        text: t.ridesCancelRideBtn, style: 'destructive',
        onPress: () => run(async () => {
          const r = await ridesRepository.cancelRide(event.id, ride.id);
          if (isLeft(r)) { Alert.alert(t.ridesTitle, t.authErrGeneric); return; }
          bookings.filter((b) => b.status !== 'declined').forEach((b) => notify('ride_cancelled', b.uid, user, event));
        }),
      },
    ]);
  };

  const timeLabel = format(ride.departureTime, 'HH:mm', { locale: getDateLocale(language) });
  const pending = bookings.filter((b) => b.status === 'pending');
  const accepted = bookings.filter((b) => b.status === 'confirmed');

  return (
    <Card padded style={styles.rideCard}>
      <AnimatedPressable
        style={styles.driverRow}
        onPress={() => !isMine && router.push(`/(app)/user/${ride.driverId}` as any)}
      >
        <View style={[styles.avatar, { backgroundColor: ride.driverAvatarColor }]}>
          <Text style={styles.avatarText}>{ride.driverName.charAt(0).toUpperCase()}</Text>
        </View>
        <View style={styles.flex}>
          <Text style={[styles.driverName, { color: colors.textPrimary }]}>
            {isMine ? t.ridesYourRide : ride.driverName}
          </Text>
          {isVerifiedUser(ride.driverCheckInCount) && <VerifiedBadge />}
        </View>
        <Text style={[styles.seats, { color: seatsLeft ? colors.primary : colors.textHint }]}>
          {seatsLeft ? t.ridesSeatsLeft(seatsLeft) : t.ridesFull}
        </Text>
      </AnimatedPressable>

      <View style={styles.metaRow}>
        <Icon name="pin" size={14} color={colors.textHint} />
        <Text style={[styles.meta, { color: colors.textSecondary }]}>{ride.departureArea}</Text>
      </View>
      <View style={styles.metaRow}>
        <Icon name="clock" size={14} color={colors.textHint} />
        <Text style={[styles.meta, { color: colors.textSecondary }]}>{t.ridesLeavesAt(timeLabel)}</Text>
      </View>
      <View style={styles.metaRow}>
        <Icon name="ticket" size={14} color={colors.textHint} />
        <Text style={[styles.meta, { color: colors.textSecondary }]}>
          {ride.costPerPerson ? t.ridesCost(ride.costPerPerson) : t.ridesFree}
        </Text>
      </View>

      {showMeeting && (
        <View style={[styles.meeting, { backgroundColor: colors.accentSoft }]}>
          <Text style={[styles.meetingLabel, { color: colors.primary }]}>{t.ridesMeetingLabel}</Text>
          <Text style={[styles.meetingText, { color: colors.textPrimary }]}>{meetingPoint}</Text>
        </View>
      )}

      {isMine ? (
        <View style={styles.bookings}>
          <Text style={[styles.label, { color: colors.textPrimary }]}>{t.ridesRequestsLabel}</Text>
          {pending.length + accepted.length === 0 && (
            <Text style={[styles.hint, { color: colors.textHint }]}>{t.ridesNoRequests}</Text>
          )}
          {[...pending, ...accepted].map((b) => (
            <View key={b.uid} style={styles.bookingRow}>
              <AnimatedPressable style={styles.flex} onPress={() => router.push(`/(app)/user/${b.uid}` as any)}>
                <Text style={[styles.bookingName, { color: colors.textPrimary }]}>{b.name}</Text>
                {b.status === 'confirmed' && (
                  <Text style={[styles.hint, { color: colors.primary }]}>{t.ridesConfirmedLabel}</Text>
                )}
              </AnimatedPressable>
              {b.status === 'confirmed' ? (
                <>
                  <Button label={t.ridesMessage} size="sm" variant="soft" onPress={() => router.push(`/(app)/dm/${b.uid}` as any)} />
                  <Button label={t.ridesDecline} size="sm" variant="ghost" onPress={() => decline(b)} disabled={busy} />
                </>
              ) : (
                <>
                  <Button label={t.ridesDecline} size="sm" variant="ghost" onPress={() => decline(b)} disabled={busy} />
                  <Button label={t.ridesConfirm} size="sm" onPress={() => confirm(b)} disabled={busy || seatsLeft === 0} />
                </>
              )}
            </View>
          ))}
          <Button label={t.ridesCancelRideBtn} variant="ghost" onPress={cancelRide} disabled={busy} fullWidth />
        </View>
      ) : canBook ? (
        <View style={styles.actions}>
          {!myBooking ? (
            <Button label={t.ridesRequestBtn} onPress={request} loading={busy} disabled={seatsLeft === 0} fullWidth />
          ) : myBooking.status === 'declined' ? (
            <Text style={[styles.hint, { color: colors.textHint }]}>{t.ridesDeclinedLabel}</Text>
          ) : (
            <>
              <Text style={[styles.hint, { color: confirmed ? colors.primary : colors.textHint }]}>
                {confirmed ? t.ridesConfirmedLabel : t.ridesPendingLabel}
              </Text>
              <View style={styles.formActions}>
                {confirmed && (
                  <Button label={t.ridesMessage} variant="soft" onPress={() => router.push(`/(app)/dm/${ride.driverId}` as any)} style={styles.flex} />
                )}
                <Button label={t.ridesCancelSeatBtn} variant="ghost" onPress={cancelSeat} loading={busy} style={styles.flex} />
              </View>
            </>
          )}
        </View>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  flex: { flex: 1 },
  content: { padding: Spacing.gutter, gap: Spacing.md },
  eventTitle: { fontFamily: TitleFont, fontSize: FontSize.xl, fontWeight: FontWeight.bold },
  disclaimer: { flexDirection: 'row', gap: 8, padding: Spacing.md, borderRadius: BorderRadius.md },
  disclaimerText: { flex: 1, fontFamily: UIFontLight, fontSize: FontSize.xs, lineHeight: 16 },
  hint: { fontFamily: UIFontLight, fontSize: FontSize.sm },
  label: { fontFamily: UIFont, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  form: { gap: Spacing.md },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  chip: { borderWidth: 1, borderRadius: BorderRadius.full, paddingHorizontal: 12, paddingVertical: 7 },
  chipText: { fontFamily: UIFont, fontSize: FontSize.sm },
  stepperRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  stepper: { flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  stepBtn: { width: 34, height: 34, borderRadius: 17, borderWidth: 1, alignItems: 'center', justifyContent: 'center' },
  stepText: { fontFamily: UIFont, fontSize: FontSize.lg },
  stepValue: { fontFamily: TitleFont, fontSize: FontSize.xl, fontWeight: FontWeight.bold, minWidth: 20, textAlign: 'center' },
  formActions: { flexDirection: 'row', gap: Spacing.sm },
  rideCard: { gap: 8 },
  driverRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, marginBottom: 4 },
  avatar: { width: 38, height: 38, borderRadius: 19, alignItems: 'center', justifyContent: 'center' },
  avatarText: { color: '#FFFFFF', fontFamily: UIFont, fontWeight: FontWeight.bold, fontSize: FontSize.lg },
  driverName: { fontFamily: UIFont, fontSize: FontSize.base, fontWeight: FontWeight.semibold, marginBottom: 3 },
  seats: { fontFamily: UIFont, fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  meta: { fontFamily: UIFontLight, fontSize: FontSize.sm },
  meeting: { borderRadius: BorderRadius.md, padding: Spacing.md, marginTop: 4, gap: 2 },
  meetingLabel: { fontFamily: UIFont, fontSize: FontSize.xs, fontWeight: FontWeight.semibold },
  meetingText: { fontFamily: UIFont, fontSize: FontSize.base },
  bookings: { marginTop: Spacing.sm, gap: Spacing.sm },
  bookingRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  bookingName: { fontFamily: UIFont, fontSize: FontSize.base },
  actions: { marginTop: Spacing.sm, gap: Spacing.sm },
  emptyWrap: { alignItems: 'center', paddingVertical: Spacing.xl, gap: Spacing.md },
  emptyIcon: { width: 64, height: 64, borderRadius: 32, alignItems: 'center', justifyContent: 'center' },
  empty: { fontFamily: UIFontLight, fontSize: FontSize.base, textAlign: 'center', lineHeight: 21, paddingHorizontal: Spacing.lg },
});
