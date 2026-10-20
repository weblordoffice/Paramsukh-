import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  Modal,
  TextInput,
  KeyboardAvoidingView,
  Platform,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useLocalSearchParams, useRouter } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import { useCommunityStore, Post } from '@/store/communityStore';

export default function MentorProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const params = useLocalSearchParams<{ userId?: string | string[] }>();
  const userId = Array.isArray(params.userId) ? params.userId[0] : params.userId;

  const {
    mentorDetail,
    mentorLoading,
    mentorError,
    fetchMentorDetail,
    createPost,
  } = useCommunityStore();

  const [showAsk, setShowAsk] = useState(false);
  const [selectedGroupId, setSelectedGroupId] = useState('');
  const [questionTitle, setQuestionTitle] = useState('');
  const [questionDetails, setQuestionDetails] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useFocusEffect(
    useCallback(() => {
      if (userId) fetchMentorDetail(userId);
    }, [fetchMentorDetail, userId])
  );

  const mentor = mentorDetail?.mentor || null;
  const groups = useMemo(() => mentor?.groups || [], [mentor]);

  useEffect(() => {
    if (groups.length > 0 && !selectedGroupId) {
      setSelectedGroupId(groups[0]._id);
    }
  }, [groups, selectedGroupId]);

  const openAsk = () => {
    if (!mentor) return;
    if (groups.length === 0) {
      Alert.alert('Unavailable', 'This mentor is not assigned to a group you can access.');
      return;
    }
    setSelectedGroupId(groups[0]._id);
    setShowAsk(true);
  };

  const submitQuestion = async () => {
    if (!mentor) return;
    if (questionTitle.trim().length < 5) {
      Alert.alert('Title Required', 'Please add a question title of at least 5 characters.');
      return;
    }
    if (!questionDetails.trim()) {
      Alert.alert('Details Required', 'Please describe your question.');
      return;
    }
    if (!selectedGroupId) {
      Alert.alert('Group Required', 'Please select a group.');
      return;
    }

    setSubmitting(true);
    const success = await createPost(
      selectedGroupId,
      questionDetails.trim(),
      undefined,
      [],
      {
        postType: 'question',
        title: questionTitle.trim(),
        assignedMentorId: mentor._id,
      }
    );
    setSubmitting(false);

    if (success) {
      setShowAsk(false);
      setQuestionTitle('');
      setQuestionDetails('');
      Alert.alert('Question Sent', 'Your question has been shared with the mentor.', [
        { text: 'OK', onPress: () => router.push('/(home)/community') },
      ]);
    } else {
      Alert.alert('Error', 'Failed to send your question. Please try again.');
    }
  };

  const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    content: { padding: 20, paddingBottom: 40 },
    loading: { paddingVertical: 80, alignItems: 'center' },
    errorBox: { paddingVertical: 60, alignItems: 'center' },
    errorText: { fontSize: 14, color: colors.textSecondary, marginTop: 10, textAlign: 'center' },
    profileCard: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 20,
      alignItems: 'center',
      marginBottom: 20,
    },
    avatar: {
      width: 84,
      height: 84,
      borderRadius: 42,
      backgroundColor: colors.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginBottom: 12,
    },
    avatarText: { fontSize: 30, fontWeight: '800', color: colors.primary },
    name: { fontSize: 20, fontWeight: '800', color: colors.text, textAlign: 'center' },
    headline: { fontSize: 13, color: colors.textSecondary, marginTop: 4, textAlign: 'center' },
    verifiedRow: { flexDirection: 'row', alignItems: 'center', gap: 4, marginTop: 8 },
    verifiedText: { fontSize: 11, fontWeight: '700', color: '#F1842D' },
    askButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 8,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      paddingHorizontal: 24,
      marginTop: 16,
      width: '100%',
    },
    askButtonText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
    statsRow: { flexDirection: 'row', gap: 10, marginBottom: 20 },
    statCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      paddingVertical: 14,
      alignItems: 'center',
    },
    statValue: { fontSize: 20, fontWeight: '800', color: colors.primary },
    statLabel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    section: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 16,
      marginBottom: 16,
    },
    sectionTitle: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 10,
    },
    bio: { fontSize: 14, color: colors.text, lineHeight: 21 },
    chips: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    chip: {
      backgroundColor: colors.surfaceSecondary,
      paddingHorizontal: 10,
      paddingVertical: 5,
      borderRadius: 12,
    },
    chipText: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    groupRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 8 },
    groupName: { fontSize: 13, color: colors.text, flex: 1 },
    activityCard: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
      paddingVertical: 10,
    },
    activityTitle: { fontSize: 13, fontWeight: '700', color: colors.text },
    activityBody: { fontSize: 12, color: colors.textSecondary, marginTop: 3, lineHeight: 17 },
    activityMeta: { fontSize: 10, color: colors.textSecondary, marginTop: 4 },
    emptyActivity: { fontSize: 12, color: colors.textSecondary },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'flex-end' },
    modalSheet: {
      backgroundColor: colors.surface,
      borderTopLeftRadius: 20,
      borderTopRightRadius: 20,
      padding: 20,
      paddingBottom: 34,
      maxHeight: '90%',
    },
    modalHeader: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 16,
    },
    modalTitle: { fontSize: 18, fontWeight: '800', color: colors.text },
    label: {
      fontSize: 11,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.5,
      marginBottom: 6,
      marginTop: 12,
    },
    input: {
      borderWidth: 1,
      borderColor: colors.border,
      borderRadius: 12,
      paddingHorizontal: 14,
      paddingVertical: 12,
      fontSize: 14,
      color: colors.text,
      backgroundColor: colors.surfaceSecondary,
    },
    textArea: { minHeight: 110, textAlignVertical: 'top' },
    groupPicker: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
    groupOption: {
      paddingHorizontal: 12,
      paddingVertical: 7,
      borderRadius: 14,
      backgroundColor: colors.surfaceSecondary,
      borderWidth: 1,
      borderColor: 'transparent',
    },
    groupOptionActive: { borderColor: colors.primary, backgroundColor: colors.primary + '12' },
    groupOptionText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    groupOptionTextActive: { color: colors.primary },
    submitButton: {
      marginTop: 20,
      backgroundColor: colors.primary,
      borderRadius: 12,
      paddingVertical: 14,
      alignItems: 'center',
    },
    submitDisabled: { opacity: 0.6 },
    submitText: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  });

  const getInitials = (name: string) => {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'M';
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  const renderActivity = (post: Post) => (
    <View key={post._id} style={s.activityCard}>
      <Text style={s.activityTitle} numberOfLines={2}>
        {post.title || post.content}
      </Text>
      {!!post.title && (
        <Text style={s.activityBody} numberOfLines={2}>{post.content}</Text>
      )}
      <Text style={s.activityMeta}>
        {post.commentCount} {post.postType === 'question' ? 'answers' : 'comments'} · {new Date(post.createdAt).toLocaleDateString()}
      </Text>
    </View>
  );

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity
          style={s.headerBtn}
          onPress={() => { if (router.canGoBack()) router.back(); else router.push('/(home)/mentor-corner' as any); }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Mentor Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView contentContainerStyle={s.content} showsVerticalScrollIndicator={false}>
        {mentorLoading && !mentor ? (
          <View style={s.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : !mentor ? (
          <View style={s.errorBox}>
            <Ionicons name="alert-circle-outline" size={40} color={colors.textSecondary} />
            <Text style={s.errorText}>{mentorError || 'Mentor not found.'}</Text>
          </View>
        ) : (
          <>
            <View style={s.profileCard}>
              <View style={s.avatar}>
                {mentor.photoURL ? (
                  <Image source={{ uri: mentor.photoURL }} style={{ width: '100%', height: '100%' }} />
                ) : (
                  <Text style={s.avatarText}>{getInitials(mentor.displayName)}</Text>
                )}
              </View>
              <Text style={s.name}>{mentor.displayName}</Text>
              {!!mentor.headline && <Text style={s.headline}>{mentor.headline}</Text>}
              {mentor.isVerified && (
                <View style={s.verifiedRow}>
                  <Ionicons name="checkmark-circle" size={14} color="#F1842D" />
                  <Text style={s.verifiedText}>Verified Mentor</Text>
                </View>
              )}
              <TouchableOpacity style={s.askButton} onPress={openAsk} activeOpacity={0.85}>
                <Ionicons name="chatbubble-ellipses" size={18} color="#FFFFFF" />
                <Text style={s.askButtonText}>Ask a Question</Text>
              </TouchableOpacity>
            </View>

            <View style={s.statsRow}>
              <View style={s.statCard}>
                <Text style={s.statValue}>{mentorDetail?.stats.questionsAssigned || 0}</Text>
                <Text style={s.statLabel}>Questions assigned</Text>
              </View>
              <View style={s.statCard}>
                <Text style={s.statValue}>{mentorDetail?.stats.answersGiven || 0}</Text>
                <Text style={s.statLabel}>Answers given</Text>
              </View>
            </View>

            {!!mentor.bio && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>About</Text>
                <Text style={s.bio}>{mentor.bio}</Text>
              </View>
            )}

            {(mentor.expertise || []).length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Expertise</Text>
                <View style={s.chips}>
                  {(mentor.expertise || []).map((item) => (
                    <View key={item} style={s.chip}>
                      <Text style={s.chipText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {(mentor.languages || []).length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Languages</Text>
                <View style={s.chips}>
                  {(mentor.languages || []).map((item) => (
                    <View key={item} style={s.chip}>
                      <Text style={s.chipText}>{item}</Text>
                    </View>
                  ))}
                </View>
              </View>
            )}

            {groups.length > 0 && (
              <View style={s.section}>
                <Text style={s.sectionTitle}>Mentors in</Text>
                {groups.map((group) => (
                  <View key={group._id} style={s.groupRow}>
                    <Ionicons name="people-outline" size={15} color={colors.textSecondary} />
                    <Text style={s.groupName} numberOfLines={1}>{group.name}</Text>
                  </View>
                ))}
              </View>
            )}

            <View style={s.section}>
              <Text style={s.sectionTitle}>Recent Questions</Text>
              {(mentorDetail?.recentQuestions || []).length === 0 ? (
                <Text style={s.emptyActivity}>No questions assigned yet.</Text>
              ) : (
                (mentorDetail?.recentQuestions || []).map(renderActivity)
              )}
            </View>

            <View style={s.section}>
              <Text style={s.sectionTitle}>Recent Activity</Text>
              {(mentorDetail?.recentPosts || []).length === 0 ? (
                <Text style={s.emptyActivity}>No community posts yet.</Text>
              ) : (
                (mentorDetail?.recentPosts || []).map(renderActivity)
              )}
            </View>
          </>
        )}
      </ScrollView>

      <Modal
        visible={showAsk}
        animationType="slide"
        transparent
        onRequestClose={() => setShowAsk(false)}
      >
        <KeyboardAvoidingView
          style={s.modalOverlay}
          behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        >
          <TouchableOpacity style={{ flex: 1 }} activeOpacity={1} onPress={() => setShowAsk(false)} />
          <View style={s.modalSheet}>
            <View style={s.modalHeader}>
              <Text style={s.modalTitle}>Ask {mentor?.displayName || 'Mentor'}</Text>
              <TouchableOpacity onPress={() => setShowAsk(false)} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
                <Ionicons name="close" size={24} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            <ScrollView keyboardShouldPersistTaps="handled" showsVerticalScrollIndicator={false}>
              <Text style={s.label}>Group</Text>
              <View style={s.groupPicker}>
                {groups.map((group) => {
                  const active = selectedGroupId === group._id;
                  return (
                    <TouchableOpacity
                      key={group._id}
                      style={[s.groupOption, active && s.groupOptionActive]}
                      onPress={() => setSelectedGroupId(group._id)}
                    >
                      <Text style={[s.groupOptionText, active && s.groupOptionTextActive]}>
                        {group.name}
                      </Text>
                    </TouchableOpacity>
                  );
                })}
              </View>

              <Text style={s.label}>Question title</Text>
              <TextInput
                style={s.input}
                placeholder="What do you need guidance on?"
                placeholderTextColor={colors.textSecondary}
                value={questionTitle}
                onChangeText={setQuestionTitle}
                maxLength={200}
              />

              <Text style={s.label}>Details</Text>
              <TextInput
                style={[s.input, s.textArea]}
                placeholder="Share the context so the mentor can help..."
                placeholderTextColor={colors.textSecondary}
                value={questionDetails}
                onChangeText={setQuestionDetails}
                multiline
                maxLength={5000}
              />

              <TouchableOpacity
                style={[s.submitButton, submitting && s.submitDisabled]}
                onPress={submitQuestion}
                disabled={submitting}
              >
                {submitting ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={s.submitText}>Send Question</Text>
                )}
              </TouchableOpacity>
            </ScrollView>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </SafeAreaView>
  );
}
