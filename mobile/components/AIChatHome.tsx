import React, { useMemo, useRef, useState } from 'react';
import {
  Image,
  ScrollView,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';

import { AIConversationSummary } from '../store/aiAssistantStore';

type TopicId = 'popular' | 'courses' | 'events' | 'community' | 'plans';
type IconName = React.ComponentProps<typeof Ionicons>['name'];

type AIChatHomeProps = {
  displayName?: string | null;
  photoURL?: string | null;
  input: string;
  canSend: boolean;
  isSending: boolean;
  compact?: boolean;
  conversations: AIConversationSummary[];
  conversationsLoading: boolean;
  onChangeInput: (value: string) => void;
  onSend: (text?: string) => void;
  onOpenConversation: (conversationId: string) => void;
  onOpenHistory: () => void;
  onOpenMemory: () => void;
  onOpenProfile: () => void;
  onClose?: () => void;
};

const topics: { id: TopicId; label: string; icon: IconName }[] = [
  { id: 'popular', label: 'Popular', icon: 'flame-outline' },
  { id: 'courses', label: 'Courses', icon: 'book-outline' },
  { id: 'events', label: 'Events', icon: 'calendar-outline' },
  { id: 'community', label: 'Community', icon: 'people-outline' },
  { id: 'plans', label: 'Plans', icon: 'card-outline' },
];

const suggestionsByTopic: Record<TopicId, { text: string; icon: IconName }[]> = {
  popular: [
    { text: 'Suggest beginner-friendly courses for my spiritual journey.', icon: 'sparkles-outline' },
    { text: 'Show me all upcoming events, separated into free and paid.', icon: 'calendar-outline' },
    { text: 'Which membership plan gives me the best value?', icon: 'card-outline' },
    { text: "What's happening in my communities today?", icon: 'people-outline' },
  ],
  courses: [
    { text: 'Show me all courses available on ParamSukh.', icon: 'library-outline' },
    { text: 'Which course is best for a complete beginner?', icon: 'school-outline' },
    { text: 'Show my enrolled courses and current progress.', icon: 'analytics-outline' },
    { text: 'Which enrolled course should I finish first?', icon: 'checkmark-done-outline' },
    { text: 'Compare the top two meditation courses for me.', icon: 'git-compare-outline' },
    { text: 'Play my current lesson from my enrolled course.', icon: 'play-circle-outline' },
  ],
  events: [
    { text: 'Show me all upcoming free and paid events.', icon: 'calendar-outline' },
    { text: 'Which upcoming event is best for beginners?', icon: 'ribbon-outline' },
    { text: 'Show only the events I am registered for.', icon: 'ticket-outline' },
    { text: 'Compare the two best upcoming events.', icon: 'git-compare-outline' },
    { text: 'What should I bring to my next registered event?', icon: 'bag-handle-outline' },
    { text: 'Find an online event I can attend this weekend.', icon: 'videocam-outline' },
  ],
  community: [
    { text: 'Show me my community groups.', icon: 'people-circle-outline' },
    { text: 'What are the latest posts in my communities?', icon: 'newspaper-outline' },
    { text: 'Help me write an uplifting community post.', icon: 'create-outline' },
    { text: 'Show the comments on the most recent post.', icon: 'chatbubbles-outline' },
    { text: 'Summarize what my community is discussing today.', icon: 'sparkles-outline' },
  ],
  plans: [
    { text: 'Show me all available membership plans.', icon: 'card-outline' },
    { text: 'Compare the membership plans and benefits.', icon: 'git-compare-outline' },
    { text: 'Which plan is best for accessing more courses?', icon: 'book-outline' },
    { text: 'Show my current membership and its benefits.', icon: 'shield-checkmark-outline' },
    { text: 'Are there any active membership offers?', icon: 'pricetag-outline' },
  ],
};

const firstName = (name?: string | null) => String(name || '').trim().split(/\s+/)[0] || 'there';
const initials = (name?: string | null) =>
  String(name || 'PS')
    .trim()
    .split(/\s+/)
    .slice(0, 2)
    .map((part) => part[0]?.toUpperCase())
    .join('');

const relativeTime = (value: string) => {
  const timestamp = new Date(value).getTime();
  if (!Number.isFinite(timestamp)) return '';
  const minutes = Math.max(0, Math.floor((Date.now() - timestamp) / 60000));
  if (minutes < 1) return 'Now';
  if (minutes < 60) return `${minutes}m`;
  if (minutes < 1440) return `${Math.floor(minutes / 60)}h`;
  if (minutes < 2880) return 'Yesterday';
  return `${Math.floor(minutes / 1440)}d`;
};

export default function AIChatHome({
  displayName,
  photoURL,
  input,
  canSend,
  isSending,
  compact = false,
  conversations,
  conversationsLoading,
  onChangeInput,
  onSend,
  onOpenConversation,
  onOpenHistory,
  onOpenMemory,
  onOpenProfile,
  onClose,
}: AIChatHomeProps) {
  const inputRef = useRef<TextInput>(null);
  const [activeTopic, setActiveTopic] = useState<TopicId>('popular');
  const [showAll, setShowAll] = useState(false);
  const suggestions = suggestionsByTopic[activeTopic];
  const visibleSuggestions = showAll ? suggestions : suggestions.slice(0, compact ? 3 : 4);
  const recent = useMemo(
    () =>
      [...conversations]
        .sort(
          (a, b) =>
            new Date(b.lastMessageAt || b.updatedAt).getTime() -
            new Date(a.lastMessageAt || a.updatedAt).getTime()
        )
        .slice(0, compact ? 2 : 3),
    [compact, conversations]
  );

  return (
    <View style={styles.container}>
      <LinearGradient
        colors={['#FFFDF9', '#FFF8F0', '#F9F1E7']}
        locations={[0, 0.52, 1]}
        style={StyleSheet.absoluteFill}
      />
      <View style={styles.ambientGlow} />
      <ScrollView
        contentContainerStyle={[styles.content, compact && styles.contentCompact]}
        showsVerticalScrollIndicator={false}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.topBar}>
          <View style={styles.brandMark}>
            <Ionicons name="sparkles" size={compact ? 24 : 28} color="#F47A20" />
          </View>
          <View style={styles.topActions}>
            <RoundAction label="Open chat history" icon="time-outline" onPress={onOpenHistory} />
            <RoundAction label="Open AI memory" icon="library-outline" onPress={onOpenMemory} />
            {onClose ? <RoundAction label="Close AI assistant" icon="close" onPress={onClose} /> : null}
            <TouchableOpacity
              accessibilityLabel="Open profile"
              style={styles.avatarButton}
              onPress={onOpenProfile}
            >
              {photoURL ? (
                <Image source={{ uri: photoURL }} style={styles.avatarImage} />
              ) : (
                <Text style={styles.avatarInitials}>{initials(displayName)}</Text>
              )}
              <View style={styles.avatarStatus} />
            </TouchableOpacity>
          </View>
        </View>

        <View style={[styles.heroCopy, compact && styles.heroCopyCompact]}>
          <Text style={[styles.greeting, compact && styles.greetingCompact]}>
            Hello, {firstName(displayName)} <Text style={styles.wave}>👋</Text>
          </Text>
          <Text style={[styles.heroSubtitle, compact && styles.heroSubtitleCompact]}>
            What would you like to explore today?
          </Text>
        </View>

        <View style={[styles.askShell, compact && styles.askShellCompact]}>
          <View style={styles.askInner}>
            <View style={styles.askIcon}>
              <Ionicons name="sparkles" size={23} color="#F47A20" />
            </View>
            <TextInput
              ref={inputRef}
              accessibilityLabel="Ask ParamSukh AI"
              style={[styles.askInput, compact && styles.askInputCompact]}
              placeholder="Ask about courses, events, memberships, podcasts, plans or community..."
              placeholderTextColor="#8F9198"
              value={input}
              onChangeText={onChangeInput}
              onSubmitEditing={() => canSend && onSend()}
              returnKeyType="send"
              blurOnSubmit
              multiline
              editable={!isSending}
            />
            <TouchableOpacity
              accessibilityLabel="Send message"
              style={[styles.sendButton, !canSend && styles.sendButtonDisabled]}
              onPress={() => onSend()}
              disabled={!canSend}
            >
              <Ionicons name="paper-plane" size={20} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </View>

        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.topicRow}
        >
          {topics.map((topic) => {
            const selected = topic.id === activeTopic;
            return (
              <TouchableOpacity
                key={topic.id}
                accessibilityState={{ selected }}
                style={[styles.topicChip, selected && styles.topicChipActive]}
                onPress={() => {
                  setActiveTopic(topic.id);
                  setShowAll(false);
                }}
              >
                <Ionicons name={topic.icon} size={17} color={selected ? '#F26716' : '#252A34'} />
                <Text style={[styles.topicLabel, selected && styles.topicLabelActive]}>
                  {topic.label}
                </Text>
              </TouchableOpacity>
            );
          })}
        </ScrollView>

        <SectionHeader
          title="Smart suggestions"
          action={suggestions.length > (compact ? 3 : 4) ? (showAll ? 'Show less' : 'View all') : undefined}
          onAction={() => setShowAll((current) => !current)}
          sparkle
        />

        <View style={styles.suggestionList}>
          {visibleSuggestions.map((suggestion) => (
            <TouchableOpacity
              key={suggestion.text}
              style={[styles.suggestionCard, compact && styles.suggestionCardCompact]}
              onPress={() => onSend(suggestion.text)}
              disabled={isSending}
            >
              <View style={styles.suggestionIcon}>
                <Ionicons name={suggestion.icon} size={21} color="#F26716" />
              </View>
              <Text style={[styles.suggestionText, compact && styles.suggestionTextCompact]}>
                {suggestion.text}
              </Text>
              <Ionicons name="chevron-forward" size={19} color="#8B8178" />
            </TouchableOpacity>
          ))}
        </View>

        <LinearGradient
          colors={['#FFF2E1', '#FFE2C3', '#FFF8EF']}
          start={{ x: 0, y: 1 }}
          end={{ x: 1, y: 0 }}
          style={[styles.featureCard, compact && styles.featureCardCompact]}
        >
          <View style={styles.featureOrbitOne} />
          <View style={styles.featureOrbitTwo} />
          <Image
            source={require('../assets/images/paramsukh-ai-companion.png')}
            resizeMode="contain"
            style={[styles.robotImage, compact && styles.robotImageCompact]}
          />
          <View style={[styles.featureCopy, compact && styles.featureCopyCompact]}>
            <View style={styles.featureEyebrow}>
              <Ionicons name="sparkles" size={13} color="#E86216" />
              <Text style={styles.featureEyebrowText}>FEATURED AI ASSISTANT</Text>
            </View>
            <Text style={[styles.featureTitle, compact && styles.featureTitleCompact]}>
              Your smart learning partner
            </Text>
            <Text style={[styles.featureDescription, compact && styles.featureDescriptionCompact]}>
              Personal help with courses, memberships, events, communities and more.
            </Text>
            <TouchableOpacity style={styles.featureButton} onPress={() => inputRef.current?.focus()}>
              <Text style={styles.featureButtonText}>Start conversation</Text>
              <Ionicons name="chatbubble-ellipses" size={15} color="#FFFFFF" />
            </TouchableOpacity>
          </View>
        </LinearGradient>

        <SectionHeader
          title="Recent conversations"
          action={conversations.length ? 'View all' : undefined}
          onAction={onOpenHistory}
        />

        {conversationsLoading ? (
          <EmptyRecent text="Loading your conversations..." />
        ) : recent.length ? (
          <View style={styles.recentList}>
            {recent.map((conversation) => (
              <TouchableOpacity
                key={conversation.id}
                style={styles.recentCard}
                onPress={() => onOpenConversation(conversation.id)}
              >
                <View style={styles.recentIcon}>
                  <Ionicons name="chatbubble-outline" size={18} color="#F26716" />
                </View>
                <Text style={styles.recentTitle} numberOfLines={1}>
                  {conversation.title}
                </Text>
                <Text style={styles.recentTime}>
                  {relativeTime(conversation.lastMessageAt || conversation.updatedAt)}
                </Text>
                <Ionicons name="chevron-forward" size={17} color="#9A9188" />
              </TouchableOpacity>
            ))}
          </View>
        ) : (
          <EmptyRecent text="Your conversations will appear here after your first question." icon />
        )}
      </ScrollView>
    </View>
  );
}

function RoundAction({ label, icon, onPress }: { label: string; icon: IconName; onPress: () => void }) {
  return (
    <TouchableOpacity accessibilityLabel={label} style={styles.roundAction} onPress={onPress}>
      <Ionicons name={icon} size={20} color="#172033" />
    </TouchableOpacity>
  );
}

function SectionHeader({
  title,
  action,
  onAction,
  sparkle = false,
}: {
  title: string;
  action?: string;
  onAction: () => void;
  sparkle?: boolean;
}) {
  return (
    <View style={styles.sectionHeader}>
      <View style={styles.sectionTitleRow}>
        {sparkle ? <Ionicons name="sparkles" size={16} color="#F47A20" /> : null}
        <Text style={styles.sectionTitle}>{title}</Text>
      </View>
      {action ? (
        <TouchableOpacity onPress={onAction}>
          <Text style={styles.sectionAction}>{action}</Text>
        </TouchableOpacity>
      ) : null}
    </View>
  );
}

function EmptyRecent({ text, icon = false }: { text: string; icon?: boolean }) {
  return (
    <View style={styles.emptyRecent}>
      {icon ? <Ionicons name="chatbubbles-outline" size={20} color="#D27B3E" /> : null}
      <Text style={styles.emptyRecentText}>{text}</Text>
    </View>
  );
}

const shadow = {
  shadowColor: '#74472A',
  shadowOffset: { width: 0, height: 8 },
  shadowOpacity: 0.08,
  shadowRadius: 18,
  elevation: 3,
};

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FFF9F2' },
  ambientGlow: {
    position: 'absolute',
    top: 130,
    right: -110,
    width: 280,
    height: 280,
    borderRadius: 140,
    backgroundColor: 'rgba(255, 205, 151, 0.2)',
  },
  content: { paddingHorizontal: 22, paddingTop: 18, paddingBottom: 110 },
  contentCompact: { paddingHorizontal: 16, paddingTop: 8, paddingBottom: 32 },
  topBar: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  brandMark: { width: 42, height: 42, alignItems: 'center', justifyContent: 'center' },
  topActions: { flexDirection: 'row', alignItems: 'center', gap: 9 },
  roundAction: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255,255,255,0.88)',
    borderWidth: 1,
    borderColor: '#F0E8DF',
    ...shadow,
  },
  avatarButton: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FFE0C4',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#FFFFFF',
  },
  avatarImage: { width: '100%', height: '100%', borderRadius: 22 },
  avatarInitials: { fontSize: 14, fontWeight: '800', color: '#8B4A20' },
  avatarStatus: {
    position: 'absolute',
    right: -1,
    bottom: 1,
    width: 11,
    height: 11,
    borderRadius: 6,
    backgroundColor: '#F47A20',
    borderWidth: 2,
    borderColor: '#FFF9F2',
  },
  heroCopy: { marginTop: 28, marginBottom: 22 },
  heroCopyCompact: { marginTop: 18, marginBottom: 16 },
  greeting: {
    fontSize: 30,
    lineHeight: 38,
    fontWeight: '800',
    letterSpacing: -0.8,
    color: '#111827',
  },
  greetingCompact: { fontSize: 25, lineHeight: 32 },
  wave: { fontSize: 27 },
  heroSubtitle: { marginTop: 4, fontSize: 16, color: '#5F636B' },
  heroSubtitleCompact: { fontSize: 14 },
  askShell: {
    borderRadius: 26,
    padding: 5,
    backgroundColor: 'rgba(255,255,255,0.72)',
    borderWidth: 1,
    borderColor: '#FFFFFF',
    shadowColor: '#F1842D',
    shadowOffset: { width: 0, height: 11 },
    shadowOpacity: 0.16,
    shadowRadius: 23,
    elevation: 5,
  },
  askShellCompact: { borderRadius: 22 },
  askInner: {
    minHeight: 76,
    borderRadius: 22,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#F4E8DB',
    paddingLeft: 13,
    paddingRight: 8,
    flexDirection: 'row',
    alignItems: 'center',
  },
  askIcon: { width: 38, alignItems: 'center', justifyContent: 'center' },
  askInput: {
    flex: 1,
    minHeight: 52,
    maxHeight: 90,
    paddingHorizontal: 8,
    paddingVertical: 10,
    fontSize: 15,
    lineHeight: 21,
    color: '#1E293B',
    textAlignVertical: 'center',
  },
  askInputCompact: { fontSize: 13, lineHeight: 18 },
  sendButton: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: '#F47A20',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#D95E0E',
    shadowOffset: { width: 0, height: 6 },
    shadowOpacity: 0.24,
    shadowRadius: 10,
    elevation: 4,
  },
  sendButtonDisabled: { backgroundColor: '#F8B17F', shadowOpacity: 0 },
  topicRow: { gap: 10, paddingTop: 22, paddingBottom: 8, paddingHorizontal: 1 },
  topicChip: {
    minHeight: 42,
    paddingHorizontal: 16,
    borderRadius: 21,
    backgroundColor: 'rgba(255,255,255,0.9)',
    borderWidth: 1,
    borderColor: '#EFE7DF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    ...shadow,
  },
  topicChipActive: {
    backgroundColor: '#FFF8F1',
    borderColor: '#F47A20',
    shadowColor: '#F47A20',
    shadowOpacity: 0.08,
  },
  topicLabel: { fontSize: 14, fontWeight: '600', color: '#252A34' },
  topicLabelActive: { color: '#E85F0D' },
  sectionHeader: {
    marginTop: 23,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  sectionTitleRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sectionTitle: { fontSize: 17, fontWeight: '800', color: '#171A21' },
  sectionAction: { fontSize: 13, fontWeight: '700', color: '#F26716' },
  suggestionList: { gap: 10 },
  suggestionCard: {
    minHeight: 72,
    paddingHorizontal: 13,
    paddingVertical: 10,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: '#F2EAE2',
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow,
  },
  suggestionCardCompact: { minHeight: 64 },
  suggestionIcon: {
    width: 46,
    height: 46,
    borderRadius: 14,
    backgroundColor: '#FFF3E8',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 13,
  },
  suggestionText: {
    flex: 1,
    paddingRight: 8,
    fontSize: 15,
    lineHeight: 21,
    fontWeight: '600',
    color: '#1E2430',
  },
  suggestionTextCompact: { fontSize: 13, lineHeight: 18 },
  featureCard: {
    minHeight: 190,
    marginTop: 22,
    borderRadius: 24,
    borderWidth: 1,
    borderColor: '#FFFFFF',
    overflow: 'hidden',
    justifyContent: 'center',
    ...shadow,
  },
  featureCardCompact: { minHeight: 170 },
  featureOrbitOne: {
    position: 'absolute',
    left: -40,
    bottom: -75,
    width: 230,
    height: 230,
    borderRadius: 115,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.72)',
  },
  featureOrbitTwo: {
    position: 'absolute',
    left: -15,
    bottom: -50,
    width: 180,
    height: 180,
    borderRadius: 90,
    borderWidth: 1,
    borderColor: 'rgba(255,255,255,0.65)',
  },
  robotImage: {
    position: 'absolute',
    left: -14,
    bottom: -18,
    width: '44%',
    height: '112%',
  },
  robotImageCompact: { left: -20, width: '43%' },
  featureCopy: { width: '62%', alignSelf: 'flex-end', paddingVertical: 22, paddingRight: 20 },
  featureCopyCompact: { width: '64%', paddingVertical: 16, paddingRight: 14 },
  featureEyebrow: { flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 },
  featureEyebrowText: {
    fontSize: 10,
    fontWeight: '800',
    letterSpacing: 0.45,
    color: '#E86216',
  },
  featureTitle: { fontSize: 20, lineHeight: 25, fontWeight: '800', color: '#111827' },
  featureTitleCompact: { fontSize: 17, lineHeight: 21 },
  featureDescription: { marginTop: 7, fontSize: 13, lineHeight: 19, color: '#4B5563' },
  featureDescriptionCompact: { fontSize: 11, lineHeight: 16 },
  featureButton: {
    alignSelf: 'flex-start',
    marginTop: 13,
    minHeight: 38,
    borderRadius: 12,
    paddingHorizontal: 14,
    backgroundColor: '#F47A20',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  featureButtonText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
  recentList: { gap: 9 },
  recentCard: {
    minHeight: 58,
    paddingHorizontal: 13,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.94)',
    borderWidth: 1,
    borderColor: '#F2EAE2',
    flexDirection: 'row',
    alignItems: 'center',
    ...shadow,
  },
  recentIcon: {
    width: 33,
    height: 33,
    borderRadius: 11,
    backgroundColor: '#FFF5EC',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  recentTitle: { flex: 1, fontSize: 13, fontWeight: '600', color: '#252A34' },
  recentTime: { marginHorizontal: 9, fontSize: 11, color: '#8B8D93' },
  emptyRecent: {
    minHeight: 62,
    paddingHorizontal: 16,
    borderRadius: 17,
    backgroundColor: 'rgba(255,255,255,0.7)',
    borderWidth: 1,
    borderColor: '#F2EAE2',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  emptyRecentText: { flex: 1, fontSize: 12, lineHeight: 17, color: '#777A81' },
});
