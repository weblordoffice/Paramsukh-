import React, { useEffect, useMemo, useState } from 'react';
import {
  View,
  Text,
  TextInput,
  TouchableOpacity,
  Modal,
  ScrollView,
  Image,
  ActivityIndicator,
  Alert,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { useCommunityStore, Group } from '@/store/communityStore';

type Props = {
  visible: boolean;
  group: Group | null;
  onClose: () => void;
  onChanged: () => void;
};

type Tab = 'people' | 'communities';

export default function ManageGroupMembersModal({ visible, group, onClose, onChanged }: Props) {
  const { colors } = useTheme();
  const mentorGroups = useCommunityStore((state) => state.mentorGroups);
  const members = useCommunityStore((state) => state.mentorGroupMembers);
  const candidates = useCommunityStore((state) => state.mentorGroupCandidates);
  const fetchMembers = useCommunityStore((state) => state.fetchMentorGroupMembers);
  const fetchCandidates = useCommunityStore((state) => state.fetchMentorGroupCandidates);
  const addMembers = useCommunityStore((state) => state.addMentorGroupMembers);

  const [tab, setTab] = useState<Tab>('people');
  const [query, setQuery] = useState('');
  const [selectedCommunityIds, setSelectedCommunityIds] = useState<string[]>([]);
  const [busy, setBusy] = useState(false);

  const communities = useMemo(
    () => mentorGroups.filter((item) => item.groupType !== 'mentor' && item._id !== group?._id),
    [mentorGroups, group?._id]
  );

  useEffect(() => {
    if (visible && group) {
      setTab('people');
      setQuery('');
      setSelectedCommunityIds([]);
      fetchMembers(group._id);
      fetchCandidates(group._id, '');
    }
  }, [visible, group, fetchMembers, fetchCandidates]);

  const search = async () => {
    if (!group) return;
    await fetchCandidates(group._id, query.trim());
  };

  const addPerson = async (userId: string) => {
    if (!group) return;
    setBusy(true);
    const success = await addMembers(group._id, { userIds: [userId] });
    setBusy(false);
    if (!success) {
      Alert.alert('Unable to add member', 'Please try again.');
      return;
    }
    await fetchCandidates(group._id, query.trim());
    onChanged();
  };

  const toggleCommunity = (groupId: string) => {
    setSelectedCommunityIds((current) => (
      current.includes(groupId)
        ? current.filter((id) => id !== groupId)
        : [...current, groupId]
    ));
  };

  const addCommunities = async () => {
    if (!group || selectedCommunityIds.length === 0) return;
    setBusy(true);
    const success = await addMembers(group._id, { groupIds: selectedCommunityIds });
    setBusy(false);
    if (!success) {
      Alert.alert('Unable to add communities', 'Please try again.');
      return;
    }
    setSelectedCommunityIds([]);
    onChanged();
  };

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <View style={{ flex: 1 }}>
            <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
              {group?.name || 'Manage Group'}
            </Text>
            <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
              {members.length} members
            </Text>
          </View>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <View style={[styles.tabs, { backgroundColor: colors.surfaceSecondary }]}>
          <TouchableOpacity
            style={[styles.tab, tab === 'people' && { backgroundColor: colors.surface }]}
            onPress={() => setTab('people')}
          >
            <Text style={[styles.tabText, { color: tab === 'people' ? colors.primary : colors.textSecondary }]}>
              People
            </Text>
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tab, tab === 'communities' && { backgroundColor: colors.surface }]}
            onPress={() => setTab('communities')}
          >
            <Text style={[styles.tabText, { color: tab === 'communities' ? colors.primary : colors.textSecondary }]}>
              Communities
            </Text>
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content} keyboardShouldPersistTaps="handled">
          {tab === 'people' ? (
            <>
              <View style={styles.searchRow}>
                <TextInput
                  value={query}
                  onChangeText={setQuery}
                  onSubmitEditing={search}
                  placeholder="Search community members"
                  placeholderTextColor={colors.textSecondary}
                  style={[styles.searchInput, { color: colors.text, backgroundColor: colors.surface, borderColor: colors.border }]}
                />
                <TouchableOpacity
                  style={[styles.searchButton, { backgroundColor: colors.primary }]}
                  onPress={search}
                >
                  <Ionicons name="search" size={18} color="#FFFFFF" />
                </TouchableOpacity>
              </View>

              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Add from your communities</Text>
              {candidates.length === 0 ? (
                <Text style={[styles.empty, { color: colors.textSecondary }]}>
                  No matching members. People must belong to one of your communities.
                </Text>
              ) : (
                candidates.map((candidate) => (
                  <View key={candidate._id} style={[styles.personRow, { borderColor: colors.border }]}>
                    <View style={[styles.avatar, { backgroundColor: colors.surfaceSecondary }]}>
                      {candidate.photoURL ? (
                        <Image source={{ uri: candidate.photoURL }} style={styles.avatarImage} />
                      ) : (
                        <Text style={[styles.avatarText, { color: colors.primary }]}>
                          {candidate.displayName?.charAt(0)?.toUpperCase() || 'U'}
                        </Text>
                      )}
                    </View>
                    <Text style={[styles.personName, { color: colors.text }]} numberOfLines={1}>
                      {candidate.displayName}
                    </Text>
                    <TouchableOpacity
                      style={[styles.addButton, { borderColor: colors.primary }]}
                      onPress={() => addPerson(candidate._id)}
                      disabled={busy}
                    >
                      <Ionicons name="add" size={16} color={colors.primary} />
                      <Text style={[styles.addButtonText, { color: colors.primary }]}>Add</Text>
                    </TouchableOpacity>
                  </View>
                ))
              )}
            </>
          ) : (
            <>
              <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                Give every member of a community access
              </Text>
              {communities.length === 0 ? (
                <Text style={[styles.empty, { color: colors.textSecondary }]}>
                  You are not assigned to any other communities.
                </Text>
              ) : (
                communities.map((community) => {
                  const checked = selectedCommunityIds.includes(community._id);
                  return (
                    <TouchableOpacity
                      key={community._id}
                      style={[styles.communityRow, { borderColor: colors.border }]}
                      onPress={() => toggleCommunity(community._id)}
                      activeOpacity={0.8}
                    >
                      <Ionicons
                        name={checked ? 'checkbox' : 'square-outline'}
                        size={21}
                        color={checked ? colors.primary : colors.textSecondary}
                      />
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.communityName, { color: colors.text }]} numberOfLines={1}>
                          {community.name}
                        </Text>
                        <Text style={[styles.communityMeta, { color: colors.textSecondary }]}>
                          {community.memberCount} members
                        </Text>
                      </View>
                    </TouchableOpacity>
                  );
                })
              )}

              <TouchableOpacity
                style={[
                  styles.primaryButton,
                  { backgroundColor: colors.primary, opacity: selectedCommunityIds.length ? 1 : 0.5 },
                ]}
                onPress={addCommunities}
                disabled={busy || selectedCommunityIds.length === 0}
              >
                {busy ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text style={styles.primaryButtonText}>Add Selected Communities</Text>
                )}
              </TouchableOpacity>
            </>
          )}

          <Text style={[styles.sectionTitle, { color: colors.textSecondary, marginTop: 28 }]}>
            Current members
          </Text>
          {members.length === 0 ? (
            <Text style={[styles.empty, { color: colors.textSecondary }]}>
              No members yet. Add people or a community above.
            </Text>
          ) : (
            members.map((member) => (
              <View key={member._id} style={[styles.memberRow, { borderColor: colors.border }]}>
                <View style={[styles.avatar, { backgroundColor: colors.surfaceSecondary }]}>
                  {member.photoURL ? (
                    <Image source={{ uri: member.photoURL }} style={styles.avatarImage} />
                  ) : (
                    <Text style={[styles.avatarText, { color: colors.primary }]}>
                      {member.displayName?.charAt(0)?.toUpperCase() || 'U'}
                    </Text>
                  )}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.personName, { color: colors.text }]} numberOfLines={1}>
                    {member.displayName}
                  </Text>
                  <Text style={[styles.communityMeta, { color: colors.textSecondary }]}>
                    {member.role === 'mentor'
                      ? 'Mentor'
                      : member.isDirect
                        ? 'Added directly'
                        : `Via ${member.sourceGroupName || 'community'}`}
                  </Text>
                </View>
              </View>
            ))
          )}
        </ScrollView>
      </SafeAreaView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  root: { flex: 1 },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingHorizontal: 20,
    paddingVertical: 14,
    borderBottomWidth: 1,
  },
  title: { fontSize: 18, fontWeight: '800' },
  subtitle: { fontSize: 12, marginTop: 2 },
  tabs: {
    flexDirection: 'row',
    margin: 16,
    marginBottom: 4,
    borderRadius: 10,
    padding: 3,
  },
  tab: { flex: 1, alignItems: 'center', paddingVertical: 9, borderRadius: 8 },
  tabText: { fontSize: 12, fontWeight: '800' },
  content: { padding: 20, paddingBottom: 50 },
  searchRow: { flexDirection: 'row', gap: 8, marginBottom: 18 },
  searchInput: {
    flex: 1,
    borderWidth: 1,
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    fontSize: 14,
  },
  searchButton: {
    width: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  empty: { fontSize: 12, lineHeight: 18, marginBottom: 8 },
  personRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    paddingVertical: 11,
  },
  avatar: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  avatarImage: { width: '100%', height: '100%' },
  avatarText: { fontSize: 15, fontWeight: '800' },
  personName: { flex: 1, fontSize: 14, fontWeight: '700' },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 2,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 9,
    paddingVertical: 6,
  },
  addButtonText: { fontSize: 11, fontWeight: '800' },
  communityRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderWidth: 1,
    borderRadius: 12,
    padding: 12,
    marginBottom: 8,
  },
  communityName: { fontSize: 14, fontWeight: '700' },
  communityMeta: { fontSize: 11, marginTop: 2 },
  primaryButton: {
    marginTop: 18,
    borderRadius: 12,
    paddingVertical: 13,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '800' },
  memberRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    borderBottomWidth: 1,
    paddingVertical: 11,
  },
});
