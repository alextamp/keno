import React, { useEffect, useState } from 'react';
import {
  Alert, Image, Modal, Pressable, ScrollView, StyleSheet, Text, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { format } from 'date-fns';
import { useTheme } from '@/core/theme';
import { BorderRadius, FontSize, FontWeight, Shadow, Spacing } from '@/core/constants/theme';
import {
  EventEntity, EVENT_CATEGORY_COLORS, EVENT_CATEGORY_LABELS,
  GenderFilter, isAttending, isEventFull, spotsLeft,
} from '@/features/events/domain/entities/event.entity';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { eventsRepository } from '@/features/events/data/repositories/events.repository.impl';
import { MOCK_USER_REGISTRY } from '@/mock/data';
import { isLeft } from '@/core/utils/either';
import { Button } from '@/components/ui/Button';
import { LoadingScreen } from '@/components/ui/LoadingScreen';

const GENDER_LABELS: Record<GenderFilter, string> = { any: 'Any', male: 'Male only', female: 'Female only' };

function Avatar({ uid, size = 44 }: { uid: string; size?: number }) {
  const reg = MOCK_USER_REGISTRY[uid];
  const name = reg?.name ?? 'User';
  const initial = name.charAt(0).toUpperCase();
  const bg = reg?.avatarColor ?? '#999';
  if (reg?.photoUri) {
    return <Image source={{ uri: reg.photoUri }} style={[styles.avatarImg, { width: size, height: size, borderRadius: size / 2 }]} />;
  }
  return (
    <View style={[styles.avatarCircle, { width: size, height: size, borderRadius: size / 2, backgroundColor: bg }]}>
      <Text style={[styles.avatarInitial, { fontSize: size * 0.4 }]}>{initial}</Text>
    </View>
  );
}

type ParticipantProfile = { uid: string; name: string; avatarColor: string; university: string; photoUri?: string };

export default function EventDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const { user } = useAuthStore();
  const { upsertEvent, removeEvent } = useEventsStore();

  const [event, setEvent] = useState<EventEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState(false);
  const [profileModal, setProfileModal] = useState<ParticipantProfile | null>(null);

  useEffect(() => { if (id) loadEvent(); }, [id]);

  const loadEvent = async () => {
    setLoading(true);
    const result = await eventsRepository.getEvent(id);
    if (isLeft(result)) Alert.alert('Error', result.left.message, [{ onPress: () => router.back() }]);
    else setEvent(result.right);
    setLoading(false);
  };

  const handleJoinLeave = async () => {
    if (!event || !user) return;
    const attending = isAttending(event, user.id);
    setActionLoading(true);
    const result = attending
      ? await eventsRepository.leaveEvent(event.id, user.id)
      : await eventsRepository.joinEvent(event.id, user.id);
    if (isLeft(result)) Alert.alert('Error', result.left.message);
    else {
      const updated: EventEntity = {
        ...event,
        attendeeIds: attending
          ? event.attendeeIds.filter((uid) => uid !== user.id)
          : [...event.attendeeIds, user.id],
      };
      setEvent(updated);
      upsertEvent(updated);
    }
    setActionLoading(false);
  };

  const handleDelete = () => {
    if (!event || !user) return;
    Alert.alert('Delete event', 'This will permanently delete the event for all attendees.', [
      { text: 'Cancel', style: 'cancel' },
      {
        text: 'Delete', style: 'destructive',
        onPress: async () => {
          const result = await eventsRepository.deleteEvent(event.id, user.id);
          if (isLeft(result)) Alert.alert('Error', result.left.message);
          else { removeEvent(event.id); router.back(); }
        },
      },
    ]);
  };

  if (loading) return <LoadingScreen />;
  if (!event) return null;

  const attending = user ? isAttending(event, user.id) : false;
  const full = isEventFull(event);
  const spots = spotsLeft(event);
  const isCreator = user?.id === event.creatorId;
  const categoryColor = EVENT_CATEGORY_COLORS[event.category];
  const bg = colors.background;
  const surf = colors.surface;
  const bord = colors.border;

  const hasFilters = (event.genderFilter && event.genderFilter !== 'any') || event.minAge || event.maxAge || (event.allowedUniversities?.length ?? 0) > 0;

  return (
    <View style={[styles.container, { backgroundColor: bg }]}>
      {/* Hero */}
      {event.imageUri ? (
        <View style={styles.heroImage}>
          <Image source={{ uri: event.imageUri }} style={StyleSheet.absoluteFill} resizeMode="cover" />
          <View style={styles.heroBottomScrim} />
          <View style={styles.heroBtns}>
            <Pressable onPress={() => router.back()} style={styles.backBtn}>
              <Text style={styles.backIcon}>←</Text>
            </Pressable>
            <Text style={styles.categoryLabelWhite}>{EVENT_CATEGORY_LABELS[event.category]}</Text>
            {isCreator && (
              <Pressable onPress={handleDelete} style={styles.deleteBtn}>
                <Text style={styles.deleteBtnText}>Delete</Text>
              </Pressable>
            )}
          </View>
        </View>
      ) : (
        <View style={[styles.topBanner, { backgroundColor: categoryColor }]}>
          <Pressable onPress={() => router.back()} style={styles.backBtn}>
            <Text style={styles.backIcon}>←</Text>
          </Pressable>
          <Text style={styles.categoryLabelWhite}>{EVENT_CATEGORY_LABELS[event.category]}</Text>
          {isCreator && (
            <Pressable onPress={handleDelete} style={styles.deleteBtn}>
              <Text style={styles.deleteBtnText}>Delete</Text>
            </Pressable>
          )}
        </View>
      )}

      <ScrollView contentContainerStyle={[styles.content, { paddingBottom: isCreator ? 40 : 120 }]} showsVerticalScrollIndicator={false}>
        <Text style={[styles.title, { color: colors.textPrimary }]}>{event.title}</Text>

        {/* Meta card */}
        <View style={[styles.metaCard, { backgroundColor: surf, borderColor: bord }]}>
          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>📅</Text>
            <View style={styles.metaBody}>
              <Text style={[styles.metaLabel, { color: colors.textHint }]}>Date & Time</Text>
              <Text style={[styles.metaValue, { color: colors.textPrimary }]}>{format(event.dateTime, 'EEEE, d MMMM yyyy')}</Text>
              <Text style={[styles.metaValue, { color: colors.textPrimary }]}>{format(event.dateTime, 'HH:mm')}</Text>
            </View>
          </View>

          <View style={[styles.metaDivider, { backgroundColor: bord }]} />

          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>📍</Text>
            <View style={styles.metaBody}>
              <Text style={[styles.metaLabel, { color: colors.textHint }]}>Location</Text>
              <Text style={[styles.metaValue, { color: colors.textPrimary }]}>{event.location}</Text>
            </View>
          </View>

          <View style={[styles.metaDivider, { backgroundColor: bord }]} />

          <View style={styles.metaRow}>
            <Text style={styles.metaIcon}>👥</Text>
            <View style={styles.metaBody}>
              <Text style={[styles.metaLabel, { color: colors.textHint }]}>Attendees</Text>
              <Text style={[styles.metaValue, { color: full && !attending ? colors.error : colors.textPrimary }]}>
                {full && !attending ? 'Event is full' : `${spots} spot${spots === 1 ? '' : 's'} left`}
              </Text>
              <Text style={[styles.metaSubValue, { color: colors.textSecondary }]}>{event.attendeeIds.length} / {event.maxAttendees} going</Text>
            </View>
          </View>
        </View>

        {/* Description */}
        {!!event.description && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>About</Text>
            <Text style={[styles.description, { color: colors.textSecondary }]}>{event.description}</Text>
          </View>
        )}

        {/* Participants */}
        <View style={styles.section}>
          <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Who's going</Text>
          <View style={styles.participantsGrid}>
            {event.attendeeIds.map((uid) => {
              const reg = MOCK_USER_REGISTRY[uid];
              const name = reg?.name ?? uid;
              const uni = reg?.university ?? '';
              const isMe = uid === user?.id;
              return (
                <Pressable
                  key={uid}
                  onPress={() => reg && setProfileModal({ uid, name, avatarColor: reg.avatarColor, university: reg.university, photoUri: reg.photoUri })}
                  style={({ pressed }) => [styles.participantCard, { backgroundColor: surf, borderColor: bord, opacity: pressed ? 0.75 : 1 }]}
                >
                  <View style={styles.participantTop}>
                    <Avatar uid={uid} size={40} />
                    {isMe && (
                      <View style={[styles.meBadge, { backgroundColor: colors.primary }]}>
                        <Text style={styles.meBadgeText}>You</Text>
                      </View>
                    )}
                  </View>
                  <Text style={[styles.participantName, { color: colors.textPrimary }]} numberOfLines={1}>{name}</Text>
                  <Text style={[styles.participantUni, { color: colors.textHint }]}>{uni}</Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Filters */}
        {hasFilters && (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>Restrictions</Text>
            <View style={[styles.filtersCard, { backgroundColor: surf, borderColor: bord }]}>
              {event.genderFilter && event.genderFilter !== 'any' && (
                <View style={styles.filterRow}>
                  <Text style={styles.filterIcon}>⚤</Text>
                  <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{GENDER_LABELS[event.genderFilter]}</Text>
                </View>
              )}
              {(event.minAge || event.maxAge) && (
                <View style={styles.filterRow}>
                  <Text style={styles.filterIcon}>🎂</Text>
                  <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>
                    Age {event.minAge ?? 18}–{event.maxAge ?? '∞'}
                  </Text>
                </View>
              )}
              {event.allowedUniversities && event.allowedUniversities.length > 0 && (
                <View style={styles.filterRow}>
                  <Text style={styles.filterIcon}>🎓</Text>
                  <Text style={[styles.filterLabel, { color: colors.textSecondary }]}>{event.allowedUniversities.join(', ')}</Text>
                </View>
              )}
            </View>
          </View>
        )}
      </ScrollView>

      {!isCreator && (
        <View style={[styles.cta, { backgroundColor: bg, borderTopColor: bord }]}>
          <Button
            label={attending ? 'Leave event' : full ? 'Event is full' : 'Join event'}
            onPress={handleJoinLeave}
            variant={attending ? 'outline' : 'primary'}
            loading={actionLoading}
            disabled={!attending && full}
            fullWidth
          />
        </View>
      )}

      {/* Participant profile modal */}
      <Modal visible={!!profileModal} transparent animationType="slide" onRequestClose={() => setProfileModal(null)}>
        <Pressable style={styles.modalBackdrop} onPress={() => setProfileModal(null)}>
          <Pressable style={[styles.modalSheet, { backgroundColor: surf }]} onPress={() => {}}>
            {profileModal && (
              <>
                <View style={[styles.modalHandle, { backgroundColor: colors.border }]} />
                <View style={styles.modalAvatarRow}>
                  {profileModal.photoUri ? (
                    <Image source={{ uri: profileModal.photoUri }} style={styles.modalAvatar} />
                  ) : (
                    <View style={[styles.modalAvatar, { backgroundColor: profileModal.avatarColor, alignItems: 'center', justifyContent: 'center' }]}>
                      <Text style={styles.modalAvatarInitial}>{profileModal.name.charAt(0).toUpperCase()}</Text>
                    </View>
                  )}
                  {profileModal.uid === user?.id && (
                    <View style={[styles.meBadgeLg, { backgroundColor: colors.primary }]}>
                      <Text style={styles.meBadgeLgText}>You</Text>
                    </View>
                  )}
                </View>
                <Text style={[styles.modalName, { color: colors.textPrimary }]}>{profileModal.name}</Text>
                <View style={[styles.modalUniBadge, { backgroundColor: colors.surfaceVariant }]}>
                  <Text style={[styles.modalUniText, { color: colors.textSecondary }]}>🎓 {profileModal.university}</Text>
                </View>
                <Pressable onPress={() => setProfileModal(null)} style={[styles.modalCloseBtn, { backgroundColor: colors.surfaceVariant }]}>
                  <Text style={[styles.modalCloseBtnText, { color: colors.textSecondary }]}>Close</Text>
                </Pressable>
              </>
            )}
          </Pressable>
        </Pressable>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  heroImage: { height: 220, position: 'relative' },
  heroOverlay: {},
  heroBottomScrim: { position: 'absolute', bottom: 0, left: 0, right: 0, height: 80, backgroundColor: 'rgba(0,0,0,0.38)' },
  heroBtns: { position: 'absolute', bottom: 0, left: 0, right: 0, paddingHorizontal: Spacing.lg, paddingBottom: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  topBanner: { paddingTop: 56, paddingBottom: Spacing.lg, paddingHorizontal: Spacing.lg, flexDirection: 'row', alignItems: 'center', gap: Spacing.md },
  backBtn: { width: 36, height: 36, borderRadius: 18, backgroundColor: 'rgba(255,255,255,0.25)', alignItems: 'center', justifyContent: 'center' },
  backIcon: { color: '#fff', fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  categoryLabelWhite: { flex: 1, color: '#fff', fontSize: FontSize.base, fontWeight: FontWeight.semibold },
  deleteBtn: { paddingHorizontal: Spacing.sm, paddingVertical: 4, borderRadius: BorderRadius.sm, backgroundColor: 'rgba(255,255,255,0.2)' },
  deleteBtnText: { color: '#fff', fontSize: FontSize.sm, fontWeight: FontWeight.semibold },
  content: { padding: Spacing.lg, gap: Spacing.lg },
  title: { fontSize: 26, fontWeight: FontWeight.extrabold, letterSpacing: -0.5, lineHeight: 32 },
  metaCard: { borderRadius: BorderRadius.lg, borderWidth: 1, paddingHorizontal: Spacing.md, ...Shadow.sm },
  metaRow: { flexDirection: 'row', gap: Spacing.md, paddingVertical: Spacing.md, alignItems: 'flex-start' },
  metaDivider: { height: 1 },
  metaIcon: { fontSize: 20, marginTop: 2 },
  metaBody: { flex: 1, gap: 2 },
  metaLabel: { fontSize: FontSize.xs, fontWeight: FontWeight.medium, textTransform: 'uppercase', letterSpacing: 0.5 },
  metaValue: { fontSize: FontSize.md, fontWeight: FontWeight.semibold },
  metaSubValue: { fontSize: FontSize.sm },
  section: { gap: Spacing.sm },
  sectionTitle: { fontSize: FontSize.lg, fontWeight: FontWeight.bold },
  description: { fontSize: FontSize.md, lineHeight: 22 },
  participantsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: Spacing.sm },
  participantCard: { width: '30%', borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.sm, alignItems: 'center', gap: 4 },
  participantTop: { position: 'relative' },
  meBadge: { position: 'absolute', bottom: -4, right: -8, borderRadius: 6, paddingHorizontal: 4, paddingVertical: 1 },
  meBadgeText: { color: '#fff', fontSize: 9, fontWeight: FontWeight.bold },
  participantName: { fontSize: FontSize.xs, fontWeight: FontWeight.semibold, textAlign: 'center' },
  participantUni: { fontSize: 10, textAlign: 'center' },
  filtersCard: { borderRadius: BorderRadius.md, borderWidth: 1, padding: Spacing.md, gap: Spacing.sm },
  filterRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm },
  filterIcon: { fontSize: 16 },
  filterLabel: { fontSize: FontSize.sm },
  avatarCircle: { alignItems: 'center', justifyContent: 'center' },
  avatarInitial: { color: '#fff', fontWeight: FontWeight.bold },
  avatarImg: {},
  cta: { position: 'absolute', bottom: 0, left: 0, right: 0, padding: Spacing.lg, paddingBottom: Spacing.xl, borderTopWidth: 1 },
  modalBackdrop: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'flex-end' },
  modalSheet: { borderTopLeftRadius: 24, borderTopRightRadius: 24, padding: Spacing.xl, paddingBottom: 48, alignItems: 'center', gap: Spacing.md },
  modalHandle: { width: 40, height: 4, borderRadius: 2, marginBottom: Spacing.sm },
  modalAvatarRow: { position: 'relative' },
  modalAvatar: { width: 88, height: 88, borderRadius: 44 },
  modalAvatarInitial: { color: '#fff', fontSize: 34, fontWeight: FontWeight.bold },
  meBadgeLg: { position: 'absolute', bottom: 0, right: -4, borderRadius: 8, paddingHorizontal: 8, paddingVertical: 3 },
  meBadgeLgText: { color: '#fff', fontSize: FontSize.xs, fontWeight: FontWeight.bold },
  modalName: { fontSize: FontSize.xxl, fontWeight: FontWeight.bold, letterSpacing: -0.3 },
  modalUniBadge: { borderRadius: BorderRadius.full, paddingHorizontal: Spacing.md, paddingVertical: 6 },
  modalUniText: { fontSize: FontSize.sm, fontWeight: FontWeight.medium },
  modalCloseBtn: { marginTop: Spacing.sm, paddingHorizontal: Spacing.xl, paddingVertical: 12, borderRadius: BorderRadius.full },
  modalCloseBtnText: { fontSize: FontSize.sm, fontWeight: FontWeight.bold },
});
