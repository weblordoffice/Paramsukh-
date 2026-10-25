import React, { useMemo, useState } from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Group, PlanGroup } from '@/store/communityStore';
import CreateMentorGroupModal from './CreateMentorGroupModal';
import ManageGroupMembersModal from './ManageGroupMembersModal';

type Props = {
  generalGroup: Group | null;
  planGroups: PlanGroup[];
  mentorGroups: Group[];
  ownedGroups: Group[];
  mentorMemberGroups: Group[];
  isMentor: boolean;
  onOpenGroup: (group: Group) => void;
  onChanged: () => void;
};

export default function CommunityGroupsSection({
  generalGroup,
  planGroups,
  mentorGroups,
  ownedGroups,
  mentorMemberGroups,
  isMentor,
  onOpenGroup,
  onChanged,
}: Props) {
  const { colors } = useTheme();
  const [showCreate, setShowCreate] = useState(false);
  const [manageGroup, setManageGroup] = useState<Group | null>(null);

  const privateGroups = useMemo(() => {
    const byId = new Map<string, Group>();
    [...ownedGroups, ...mentorGroups, ...mentorMemberGroups].forEach((group) => {
      if (group?.groupType === 'mentor' && group._id) byId.set(group._id, group);
    });
    return [...byId.values()];
  }, [ownedGroups, mentorGroups, mentorMemberGroups]);

  const isOwner = (group: Group) => ownedGroups.some((entry) => entry._id === group._id);

  return (
    <>
      <ScrollView
        style={{ flex: 1 }}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.headerRow}>
          <Text style={[styles.heading, { color: colors.text }]}>Your Groups</Text>
          {isMentor ? (
            <TouchableOpacity
              style={[styles.createButton, { backgroundColor: colors.primary }]}
              onPress={() => setShowCreate(true)}
              activeOpacity={0.85}
            >
              <Ionicons name="add" size={16} color="#FFFFFF" />
              <Text style={styles.createButtonText}>Create Group</Text>
            </TouchableOpacity>
          ) : null}
        </View>

        {generalGroup ? (
          <TouchableOpacity
            style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
            onPress={() => onOpenGroup(generalGroup)}
            activeOpacity={0.8}
          >
            <View style={[styles.icon, { backgroundColor: colors.primary + '12' }]}>
              <Ionicons name="globe-outline" size={20} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.text }]}>{generalGroup.name}</Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                {generalGroup.memberCount} members · Public
              </Text>
            </View>
            <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
          </TouchableOpacity>
        ) : null}

        {planGroups.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Plan Communities</Text>
            {planGroups.map((planGroup) => (
              <View key={planGroup._id} style={{ marginBottom: 10 }}>
                <TouchableOpacity
                  style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                  onPress={() => onOpenGroup(planGroup as Group)}
                  activeOpacity={0.8}
                >
                  <View style={[styles.icon, { backgroundColor: colors.primary + '12' }]}>
                    <Ionicons name="shield-outline" size={20} color={colors.primary} />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.name, { color: colors.text }]}>{planGroup.name}</Text>
                    <Text style={[styles.meta, { color: colors.textSecondary }]}>
                      {planGroup.memberCount} members · Combined feed
                    </Text>
                  </View>
                  <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                </TouchableOpacity>

                {planGroup.subgroups.length > 0 ? (
                  <View style={[styles.subgroups, { borderLeftColor: colors.primary + '30' }]}>
                    {planGroup.subgroups.map((subgroup) => (
                      <TouchableOpacity
                        key={subgroup._id}
                        style={[styles.subgroupRow, { borderBottomColor: colors.border }]}
                        onPress={() => onOpenGroup(subgroup)}
                        activeOpacity={0.8}
                      >
                        <Ionicons name="pricetag-outline" size={14} color={colors.textSecondary} />
                        <Text style={[styles.subgroupName, { color: colors.text }]} numberOfLines={1}>
                          {subgroup.category
                            ? subgroup.category.charAt(0).toUpperCase() + subgroup.category.slice(1)
                            : subgroup.name}
                        </Text>
                        <Text style={[styles.meta, { color: colors.textSecondary }]}>
                          {subgroup.memberCount}
                        </Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            ))}
          </View>
        ) : null}

        {privateGroups.length > 0 ? (
          <View style={styles.section}>
            <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>Private Mentor Groups</Text>
            {privateGroups.map((group) => {
              const owner = isOwner(group);
              return (
                <View
                  key={group._id}
                  style={[styles.groupCard, { backgroundColor: colors.surface, borderColor: colors.border }]}
                >
                  <TouchableOpacity
                    style={styles.groupMain}
                    onPress={() => onOpenGroup(group)}
                    activeOpacity={0.8}
                  >
                    <View style={[styles.icon, { backgroundColor: colors.primary + '12' }]}>
                      <Ionicons name="lock-closed-outline" size={20} color={colors.primary} />
                    </View>
                    <View style={{ flex: 1 }}>
                      <View style={styles.nameRow}>
                        <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                          {group.name}
                        </Text>
                        <View style={[styles.badge, { backgroundColor: colors.primary + '15' }]}>
                          <Text style={[styles.badgeText, { color: colors.primary }]}>
                            {owner ? 'Owner' : 'Private'}
                          </Text>
                        </View>
                      </View>
                      <Text style={[styles.meta, { color: colors.textSecondary }]}>
                        {group.memberCount} members
                      </Text>
                    </View>
                  </TouchableOpacity>
                  {owner ? (
                    <TouchableOpacity
                      style={[styles.manageButton, { borderColor: colors.primary + '40' }]}
                      onPress={() => setManageGroup(group)}
                    >
                      <Ionicons name="people-outline" size={15} color={colors.primary} />
                      <Text style={[styles.manageText, { color: colors.primary }]}>Manage</Text>
                    </TouchableOpacity>
                  ) : null}
                </View>
              );
            })}
          </View>
        ) : null}

        {!generalGroup && planGroups.length === 0 && privateGroups.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="people-outline" size={42} color={colors.textSecondary} />
            <Text style={[styles.emptyTitle, { color: colors.text }]}>No groups yet</Text>
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              {isMentor
                ? 'Create a private group or ask an admin to assign you to a community.'
                : 'Groups you join will appear here.'}
            </Text>
          </View>
        ) : null}
      </ScrollView>

      <CreateMentorGroupModal
        visible={showCreate}
        onClose={() => setShowCreate(false)}
        onCreated={(group) => {
          setManageGroup(group);
          onChanged();
        }}
      />

      <ManageGroupMembersModal
        visible={!!manageGroup}
        group={manageGroup}
        onClose={() => setManageGroup(null)}
        onChanged={onChanged}
      />
    </>
  );
}

const styles = StyleSheet.create({
  content: { padding: 20, paddingBottom: 50 },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: 12,
    marginBottom: 16,
  },
  heading: { fontSize: 18, fontWeight: '800' },
  createButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderRadius: 9,
    paddingHorizontal: 11,
    paddingVertical: 8,
  },
  createButtonText: { fontSize: 11, fontWeight: '800', color: '#FFFFFF' },
  section: { marginTop: 20 },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    textTransform: 'uppercase',
    letterSpacing: 0.6,
    marginBottom: 10,
  },
  groupCard: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  groupMain: { flexDirection: 'row', alignItems: 'center', gap: 12, flex: 1 },
  icon: {
    width: 42,
    height: 42,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nameRow: { flexDirection: 'row', alignItems: 'center', gap: 7, flexWrap: 'wrap' },
  name: { flexShrink: 1, fontSize: 14, fontWeight: '700' },
  meta: { fontSize: 11, marginTop: 2 },
  badge: { borderRadius: 7, paddingHorizontal: 6, paddingVertical: 2 },
  badgeText: { fontSize: 9, fontWeight: '800' },
  subgroups: {
    marginLeft: 22,
    marginTop: 4,
    borderLeftWidth: 2,
    paddingLeft: 12,
  },
  subgroupRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    borderBottomWidth: StyleSheet.hairlineWidth,
  },
  subgroupName: { flex: 1, fontSize: 13, fontWeight: '600' },
  manageButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    paddingVertical: 6,
    marginLeft: 8,
  },
  manageText: { fontSize: 10, fontWeight: '800' },
  empty: { alignItems: 'center', paddingTop: 60, paddingHorizontal: 20 },
  emptyTitle: { fontSize: 15, fontWeight: '800', marginTop: 12 },
  emptyText: { fontSize: 12, textAlign: 'center', lineHeight: 18, marginTop: 5 },
});
