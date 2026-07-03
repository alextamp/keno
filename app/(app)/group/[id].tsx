import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import Animated from 'react-native-reanimated';
import { usePressAnimation } from '@/core/hooks/usePressAnimation';
import { AnimatedPressable as ListItemPressable } from '@/components/ui/AnimatedPressable';

const AnimatedPressable = Animated.createAnimatedComponent(Pressable);
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  addDoc, collection, getDocs, limit, onSnapshot, orderBy, query, Timestamp,
} from 'firebase/firestore';
import { db } from '@/lib/firebase';
import { useTheme } from '@/core/theme';
import { DrawFont, FontSize, FontWeight, Spacing, BorderRadius, Shadow } from '@/core/constants/theme';
import { useGroupsStore } from '@/features/groups/presentation/store/groups.store';
import { useAuthStore } from '@/features/auth/presentation/store/auth.store';
import { useEventsStore } from '@/features/events/presentation/store/events.store';
import { groupsRepository } from '@/features/groups/data/repositories/groups.repository.impl';
import { GroupEntity } from '@/features/groups/domain/entities/group.entity';
import { EventCard } from '@/components/ui/EventCard';
import { Button } from '@/components/ui/Button';
import { useTranslation, useLanguageStore } from '@/core/i18n';
import { formatMessageTime } from '@/core/utils/time';
import { containsBlockedContent } from '@/core/utils/contentModeration';
import { universityLabel } from '@/core/constants/universities';

interface UserResult { uid: string; name: string; universityName: string; avatarColor: string; }

async function searchUsers(q: string): Promise<UserResult[]> {
  if (q.trim().length < 2) return [];
  const lower = q.trim().toLowerCase();
  try {
    const snap = await getDocs(query(collection(db, 'users'), orderBy('nameLower'), limit(200)));
    return snap.docs
      .map((d) => ({ uid: d.id, name: d.data().name ?? '', universityName: d.data().universityName ?? '', avatarColor: d.data().avatarColor ?? '#C94D0A' }))
      .filter((u) => u.name.toLowerCase().includes(lower));
  } catch {
    const snap = await getDocs(query(collection(db, 'users'), limit(200)));
    return snap.docs
      .map((d) => ({ uid: d.id, name: d.data().name ?? '', universityName: d.data().universityName ?? '', avatarColor: d.data().avatarColor ?? '#C94D0A' }))
      .filter((u) => u.name.toLowerCase().includes(lower));
  }
}

interface GroupMessage {
  id: string;
  userId: string;
  userName: string;
  text: string;
  timestamp: Date;
}

export default function GroupDetailScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const router = useRouter();
  const { colors } = useTheme();
  const insets = useSafeAreaInsets();
  const user = useAuthStore((s) => s.user);
  const events = useEventsStore((s) => s.events);
  const joinGroup = useGroupsStore((s) => s.joinGroup);
  const leaveGroup = useGroupsStore((s) => s.leaveGroup);
  const backAnim = usePressAnimation(0.9);
  const eventsTabAnim = usePressAnimation(0.95);
  const chatTabAnim = usePressAnimation(0.95);
  const inviteToGroup = useGroupsStore((s) => s.inviteToGroup);
  const t = useTranslation();

  const { language } = useLanguageStore();
  const [group, setGroup] = useState<GroupEntity | null>(null);
  const [loading, setLoading] = useState(true);
  const [joining, setJoining] = useState(false);
  const [activeTab, setActiveTab] = useState<'events' | 'chat'>('events');
  const [messages, setMessages] = useState<GroupMessage[]>([]);
  const [chatDraft, setChatDraft] = useState('');
  const [sendingMsg, setSendingMsg] = useState(false);
  const [inviteSearch, setInviteSearch] = useState('');
  const [inviteResults, setInviteResults] = useState<UserResult[]>([]);
  const [invitedUids, setInvitedUids] = useState<Set<string>>(new Set());
  const [inviteSearching, setInviteSearching] = useState(false);
  const scrollRef = useRef<ScrollView>(null);

  useEffect(() => {
    if (!id) return;
    groupsRepository.getGroup(id).then((res) => {
      if (res._tag === 'Right') setGroup(res.right);
      setLoading(false);
    });
    const unsub = groupsRepository.subscribeToGroup(id, setGroup);
    return unsub;
  }, [id]);

  useEffect(() => {
    if (!id) return;
    const q = query(collection(db, 'groups', id, 'messages'), orderBy('timestamp', 'asc'));
    const unsub = onSnapshot(q, (snap) => {
      const msgs: GroupMessage[] = snap.docs.map((d) => {
        const data = d.data();
        return {
          id: d.id,
          userId: data.userId as string,
          userName: data.userName as string,
          text: data.text as string,
          timestamp: (data.timestamp as Timestamp)?.toDate() ?? new Date(),
        };
      });
      setMessages(msgs);
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: false }), 80);
    }, () => {});
    return unsub;
  }, [id]);

  const handleSendMessage = useCallback(async () => {
    if (!id || !user || !chatDraft.trim()) return;
    if (containsBlockedContent(chatDraft)) {
      Alert.alert(t.groupChatTitle, t.validContentBlocked);
      return;
    }
    setSendingMsg(true);
    const text = chatDraft.trim();
    setChatDraft('');
    try {
      await addDoc(collection(db, 'groups', id, 'messages'), {
        userId: user.id,
        userName: user.name,
        text,
        timestamp: Timestamp.now(),
      });
      setTimeout(() => scrollRef.current?.scrollToEnd({ animated: true }), 100);
    } catch {
      setChatDraft(text);
      Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    }
    setSendingMsg(false);
  }, [id, user, chatDraft]);

  const handleInviteSearch = useCallback(async (text: string) => {
    setInviteSearch(text);
    if (text.trim().length < 2) { setInviteResults([]); return; }
    setInviteSearching(true);
    const results = await searchUsers(text);
    setInviteResults(results.filter((u) => u.uid !== user?.id && !group?.memberIds.includes(u.uid)));
    setInviteSearching(false);
  }, [user?.id, group?.memberIds]);

  const handleInvite = useCallback(async (target: UserResult) => {
    if (!user || !group) return;
    const ok = await inviteToGroup(group.id, target.uid, user.id, user.name, group.name);
    if (ok) setInvitedUids((prev) => new Set([...prev, target.uid]));
  }, [user, group, inviteToGroup]);

  if (loading || !group) {
    return (
      <View style={[styles.loader, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.primary} size="large" />
      </View>
    );
  }

  const isMember = user ? group.memberIds.includes(user.id) : false;
  const isCreator = user?.id === group.creatorId;
  const isInvited = user ? group.invitedUserIds.includes(user.id) : false;
  const canJoin = !group.isPrivate || isInvited;
  const groupEvents = events.filter((e) => group.eventIds.includes(e.id));
  const now = new Date();
  const upcomingEvents = groupEvents.filter((e) => e.dateTime >= now);
  const pastEvents = groupEvents.filter((e) => e.dateTime < now);

  const handleJoinLeave = async () => {
    if (!user) return;
    setJoining(true);
    try {
      let ok = true;
      if (isMember && !isCreator) {
        ok = await leaveGroup(group.id, user.id);
      } else if (!isMember) {
        ok = await joinGroup(group.id, user.id);
      }
      if (!ok) Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    } catch {
      Alert.alert(t.createAlertSaveError, t.authErrGeneric);
    } finally {
      setJoining(false);
    }
  };

  return (
    <View style={[styles.root, { backgroundColor: colors.background }]}>
      {/* Back button floats over the banner */}
      <AnimatedPressable
        onPress={() => router.back()}
        onPressIn={backAnim.onPressIn}
        onPressOut={backAnim.onPressOut}
        style={[styles.backBtn, { paddingTop: insets.top + 8 }, backAnim.animatedStyle]}
      >
        <View style={styles.backBubble}>
          <Text style={styles.backText}>←</Text>
        </View>
      </AnimatedPressable>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Banner */}
        <View style={[styles.banner, { backgroundColor: group.coverColor }]}>
          <Text style={styles.bannerEmoji}>{group.emoji}</Text>
          <Text style={styles.bannerName}>{group.name}</Text>
          {group.universityName && (
            <Text style={styles.bannerUni}>🎓 {universityLabel(group.universityName, language)}</Text>
          )}
        </View>

        <View style={[styles.body, { paddingBottom: insets.bottom + 24 }]}>
          {/* Tab switcher */}
          {isMember && (
            <View style={[styles.tabRow, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
              <AnimatedPressable
                onPress={() => setActiveTab('events')}
                onPressIn={eventsTabAnim.onPressIn}
                onPressOut={eventsTabAnim.onPressOut}
                style={[styles.tabBtn, activeTab === 'events' && { backgroundColor: colors.surface, borderColor: colors.borderStrong }, eventsTabAnim.animatedStyle]}
              >
                <Text style={[styles.tabBtnText, { color: activeTab === 'events' ? colors.primary : colors.textSecondary }]}>
                  📅 {t.userUpcoming}
                </Text>
              </AnimatedPressable>
              <AnimatedPressable
                onPress={() => setActiveTab('chat')}
                onPressIn={chatTabAnim.onPressIn}
                onPressOut={chatTabAnim.onPressOut}
                style={[styles.tabBtn, activeTab === 'chat' && { backgroundColor: colors.surface, borderColor: colors.borderStrong }, chatTabAnim.animatedStyle]}
              >
                <Text style={[styles.tabBtnText, { color: activeTab === 'chat' ? colors.primary : colors.textSecondary }]}>
                  💬 {t.groupChatTitle} {messages.length > 0 ? `(${messages.length})` : ''}
                </Text>
              </AnimatedPressable>
            </View>
          )}

          {/* Stats row */}
          <View style={[styles.statsRow, { borderColor: colors.borderStrong }]}>
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.textPrimary }]}>{group.memberIds.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t.groupStatMembers}</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.textPrimary }]}>{group.eventIds.length}</Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>{t.groupStatEvents}</Text>
            </View>
            <View style={[styles.statDivider, { backgroundColor: colors.border }]} />
            <View style={styles.stat}>
              <Text style={[styles.statNum, { color: colors.textPrimary }]}>
                {group.isPrivate ? '🔒' : '🌐'}
              </Text>
              <Text style={[styles.statLabel, { color: colors.textSecondary }]}>
                {group.isPrivate ? t.groupStatPrivate : t.groupStatPublic}
              </Text>
            </View>
          </View>

          {/* Join/Leave button */}
          {user && !isCreator && (
            isMember || canJoin ? (
              <Button
                label={isMember ? t.groupBtnLeave : t.groupBtnJoin}
                onPress={handleJoinLeave}
                loading={joining}
                shape="pill"
                fullWidth
                style={{ backgroundColor: isMember ? colors.surfaceVariant : group.coverColor, borderColor: colors.borderStrong }}
                labelStyle={{ color: isMember ? colors.textPrimary : '#fff' }}
              />
            ) : (
              <View style={[styles.privateMsg, { backgroundColor: colors.surfaceVariant, borderColor: colors.borderStrong }]}>
                <Text style={[styles.privateMsgText, { color: colors.textSecondary }]}>{t.groupPrivateOnly}</Text>
              </View>
            )
          )}

          {/* Description */}
          <View style={[styles.section, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
            <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.userAbout}</Text>
            <Text style={[styles.descText, { color: colors.textSecondary }]}>{group.description}</Text>
          </View>

          {/* Invite section — creator of private group only */}
          {isCreator && group.isPrivate && (
            <View style={[styles.inviteSection, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
              <Text style={[styles.sectionTitle, { color: colors.textPrimary }]}>{t.groupInviteTitle}</Text>
              <View style={[styles.inviteInputRow, { backgroundColor: colors.surfaceVariant, borderColor: colors.border }]}>
                <Text style={styles.inviteInputIcon}>🔍</Text>
                <TextInput
                  style={[styles.inviteInput, { color: colors.textPrimary }]}
                  placeholder={t.groupInviteSearch}
                  placeholderTextColor={colors.textHint}
                  value={inviteSearch}
                  onChangeText={handleInviteSearch}
                />
                {inviteSearching && <ActivityIndicator size="small" color={colors.textHint} />}
              </View>
              {inviteResults.map((u) => {
                const alreadyInvited = invitedUids.has(u.uid) || group.invitedUserIds.includes(u.uid);
                return (
                  <View key={u.uid} style={[styles.inviteRow, { borderColor: colors.border }]}>
                    <View style={[styles.inviteAvatar, { backgroundColor: u.avatarColor }]}>
                      <Text style={styles.inviteAvatarText}>{u.name.charAt(0).toUpperCase()}</Text>
                    </View>
                    <View style={styles.inviteInfo}>
                      <Text style={[styles.inviteName, { color: colors.textPrimary }]} numberOfLines={1}>{u.name}</Text>
                      {u.universityName ? <Text style={[styles.inviteUni, { color: colors.textHint }]} numberOfLines={1}>🎓 {universityLabel(u.universityName, language)}</Text> : null}
                    </View>
                    <ListItemPressable
                      onPress={() => handleInvite(u)}
                      disabled={alreadyInvited}
                      scaleTo={0.9}
                      style={[styles.inviteBtn, { backgroundColor: alreadyInvited ? colors.surfaceVariant : group.coverColor, borderColor: colors.borderStrong }]}
                    >
                      <Text style={[styles.inviteBtnText, { color: alreadyInvited ? colors.textHint : '#fff' }]}>
                        {alreadyInvited ? t.groupInviteSent : t.groupInviteBtn}
                      </Text>
                    </ListItemPressable>
                  </View>
                );
              })}
            </View>
          )}

          {/* Chat view (members only) */}
          {activeTab === 'chat' && isMember && (
            <View style={styles.chatSection}>
              <ScrollView
                ref={scrollRef}
                style={styles.chatMessages}
                showsVerticalScrollIndicator={false}
                contentContainerStyle={{ padding: Spacing.md, gap: Spacing.md }}
              >
                {messages.length === 0 ? (
                  <View style={styles.chatEmpty}>
                    <Text style={styles.chatEmptyEmoji}>💬</Text>
                    <Text style={[styles.chatEmptyText, { color: colors.textHint }]}>{t.groupChatEmpty}</Text>
                  </View>
                ) : (
                  messages.map((msg) => {
                    const isMe = msg.userId === user?.id;
                    return (
                      <View key={msg.id} style={[styles.msgRow, isMe && styles.msgRowMe]}>
                        {!isMe && (
                          <View style={[styles.msgAvatar, { backgroundColor: colors.surfaceVariant }]}>
                            <Text style={styles.msgAvatarText}>{msg.userName.charAt(0).toUpperCase()}</Text>
                          </View>
                        )}
                        <View style={[styles.msgBubble, { backgroundColor: isMe ? group.coverColor : colors.surfaceVariant, borderColor: colors.borderStrong }]}>
                          {!isMe && <Text style={[styles.msgName, { color: colors.textHint }]}>{msg.userName}</Text>}
                          <Text style={[styles.msgText, { color: isMe ? '#fff' : colors.textPrimary }]}>{msg.text}</Text>
                          <Text style={[styles.msgTime, { color: isMe ? 'rgba(255,255,255,0.65)' : colors.textHint }]}>
                            {formatMessageTime(msg.timestamp, language)}
                          </Text>
                        </View>
                      </View>
                    );
                  })
                )}
              </ScrollView>
              <View style={[styles.chatInputRow, { backgroundColor: colors.surface, borderColor: colors.borderStrong }]}>
                <TextInput
                  style={[styles.chatInput, { color: colors.textPrimary }]}
                  value={chatDraft}
                  onChangeText={setChatDraft}
                  placeholder={t.groupChatPlaceholder}
                  placeholderTextColor={colors.textHint}
                  returnKeyType="send"
                  onSubmitEditing={handleSendMessage}
                  multiline={false}
                />
                <Button
                  label="✈️"
                  onPress={handleSendMessage}
                  disabled={!chatDraft.trim() || sendingMsg}
                  shape="circle"
                  size="sm"
                  style={{ backgroundColor: chatDraft.trim() ? group.coverColor : colors.surfaceVariant, borderColor: colors.borderStrong }}
                  labelStyle={{ fontSize: 16 }}
                />
              </View>
            </View>
          )}

          {/* Events view */}
          {activeTab === 'events' && (
            <>
          {/* Upcoming events */}
          {upcomingEvents.length > 0 && (
            <View style={styles.eventsSection}>
              <Text style={[styles.eventsSectionTitle, { color: colors.textPrimary }]}>
                {t.userUpcoming}
              </Text>
              {upcomingEvents.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  onPress={() => router.push(`/(app)/event/${e.id}`)}
                />
              ))}
            </View>
          )}

          {pastEvents.length > 0 && (
            <View style={styles.eventsSection}>
              <Text style={[styles.eventsSectionTitle, { color: colors.textSecondary }]}>
                {t.groupPastEvents}
              </Text>
              {pastEvents.map((e) => (
                <EventCard
                  key={e.id}
                  event={e}
                  onPress={() => router.push(`/(app)/event/${e.id}`)}
                  faded
                />
              ))}
            </View>
          )}

          {groupEvents.length === 0 && (
            <View style={styles.noEvents}>
              <Text style={styles.noEventsEmoji}>📭</Text>
              <Text style={[styles.noEventsText, { color: colors.textSecondary }]}>
                {t.groupNoEvents}
              </Text>
            </View>
          )}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  loader: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  backBtn: { position: 'absolute', top: 0, left: Spacing.lg, zIndex: 10 },
  backBubble: {
    width: 36, height: 36, borderRadius: 18,
    backgroundColor: 'rgba(0,0,0,0.4)',
    alignItems: 'center', justifyContent: 'center',
  },
  backText: { color: '#fff', fontSize: 18, fontWeight: FontWeight.bold },
  banner: { height: 160, alignItems: 'center', justifyContent: 'center', gap: 4 },
  bannerEmoji: { fontSize: 48 },
  bannerName: { color: '#fff', fontSize: FontSize.xxl, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  bannerUni: { color: 'rgba(255,255,255,0.85)', fontSize: FontSize.sm, fontFamily: DrawFont },
  body: { padding: Spacing.lg, gap: Spacing.md },
  statsRow: {
    flexDirection: 'row', alignItems: 'center',
    borderRadius: BorderRadius.xl, borderWidth: 2,
    overflow: 'hidden',
  },
  stat: { flex: 1, alignItems: 'center', paddingVertical: Spacing.md },
  statNum: { fontSize: FontSize.xl, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  statLabel: { fontSize: FontSize.xs },
  statDivider: { width: 1, height: 40 },
  section: {
    borderRadius: BorderRadius.xl, borderWidth: 2, padding: Spacing.md, gap: 6,
    ...Shadow.sm,
  },
  sectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  descText: { fontSize: FontSize.sm, lineHeight: 20 },
  eventsSection: { gap: Spacing.sm },
  eventsSectionTitle: { fontSize: FontSize.md, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
  noEvents: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  noEventsEmoji: { fontSize: 36 },
  noEventsText: { fontSize: FontSize.sm, textAlign: 'center' },
  tabRow: { flexDirection: 'row', borderRadius: BorderRadius.lg, borderWidth: 1.5, overflow: 'hidden' },
  tabBtn: { flex: 1, paddingVertical: 8, alignItems: 'center', borderRadius: BorderRadius.lg, borderWidth: 0 },
  tabBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  chatSection: { gap: Spacing.sm },
  chatMessages: { maxHeight: 360, borderRadius: BorderRadius.lg, borderWidth: 2.5, borderColor: 'transparent' },
  chatEmpty: { alignItems: 'center', paddingVertical: 32, gap: 8 },
  chatEmptyEmoji: { fontSize: 32 },
  chatEmptyText: { fontSize: FontSize.sm, textAlign: 'center' },
  msgRow: { flexDirection: 'row', gap: Spacing.sm, alignItems: 'flex-end' },
  msgRowMe: { flexDirection: 'row-reverse' },
  msgAvatar: { width: 28, height: 28, borderRadius: 14, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  msgAvatarText: { fontSize: 13, fontWeight: FontWeight.bold, color: '#fff' },
  msgBubble: { maxWidth: '75%', borderRadius: 16, borderWidth: 2, padding: Spacing.sm, gap: 2 },
  msgName: { fontSize: 10, fontWeight: FontWeight.bold },
  msgText: { fontSize: FontSize.sm, lineHeight: 18 },
  msgTime: { fontSize: 9, marginTop: 2 },
  chatInputRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, borderRadius: BorderRadius.lg, borderWidth: 2.5, paddingHorizontal: Spacing.md, paddingVertical: Spacing.sm },
  chatInput: { flex: 1, fontSize: FontSize.base, minHeight: 36 },
  privateMsg: { borderRadius: BorderRadius.xl, borderWidth: 2, padding: Spacing.md, alignItems: 'center' },
  privateMsgText: { fontSize: FontSize.sm, fontFamily: DrawFont },
  inviteSection: { borderRadius: BorderRadius.xl, borderWidth: 2, padding: Spacing.md, gap: Spacing.sm, ...Shadow.sm },
  inviteInputRow: { flexDirection: 'row', alignItems: 'center', borderRadius: BorderRadius.full, borderWidth: 1.5, paddingHorizontal: Spacing.md, height: 40, gap: 8 },
  inviteInputIcon: { fontSize: 13 },
  inviteInput: { flex: 1, fontSize: FontSize.sm },
  inviteRow: { flexDirection: 'row', alignItems: 'center', gap: Spacing.sm, paddingVertical: 6, borderBottomWidth: 1 },
  inviteAvatar: { width: 36, height: 36, borderRadius: 18, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
  inviteAvatarText: { color: '#fff', fontSize: 15, fontWeight: FontWeight.bold },
  inviteInfo: { flex: 1, gap: 1 },
  inviteName: { fontSize: FontSize.sm, fontWeight: FontWeight.bold, fontFamily: DrawFont },
  inviteUni: { fontSize: FontSize.xs },
  inviteBtn: { paddingHorizontal: 12, paddingVertical: 6, borderRadius: BorderRadius.full, borderWidth: 2 },
  inviteBtnText: { fontSize: FontSize.xs, fontWeight: FontWeight.extrabold, fontFamily: DrawFont },
});
