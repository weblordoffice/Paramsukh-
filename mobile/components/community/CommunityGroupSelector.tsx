import React from 'react';
import {
  View,
  Text,
  TouchableOpacity,
  Modal,
  ScrollView,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '../../hooks/useTheme';
import { Group } from '@/store/communityStore';

type Props = {
  visible: boolean;
  groups: Group[];
  activeGroup: Group | null;
  onSelect: (group: Group | null) => void;
  onClose: () => void;
};

const iconForGroup = (group: Group): keyof typeof Ionicons.glyphMap => {
  if (group.groupType === 'mentor') return 'lock-closed-outline';
  if (group.planSlug === 'general' || group.isPublic) return 'globe-outline';
  if (group.groupType === 'category') return 'pricetag-outline';
  return 'people-outline';
};

export default function CommunityGroupSelector({
  visible,
  groups,
  activeGroup,
  onSelect,
  onClose,
}: Props) {
  const { colors } = useTheme();

  const uniqueGroups = groups.reduce<Group[]>((acc, group) => {
    if (group?._id && !acc.some((entry) => entry._id === group._id)) acc.push(group);
    return acc;
  }, []);

  return (
    <Modal visible={visible} animationType="slide" onRequestClose={onClose}>
      <SafeAreaView style={[styles.root, { backgroundColor: colors.background }]}>
        <View style={[styles.header, { borderBottomColor: colors.border }]}>
          <Text style={[styles.title, { color: colors.text }]}>Choose Community</Text>
          <TouchableOpacity onPress={onClose} accessibilityLabel="Close">
            <Ionicons name="close" size={26} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>

        <ScrollView contentContainerStyle={styles.content}>
          <TouchableOpacity
            style={[
              styles.row,
              !activeGroup && { backgroundColor: colors.primary + '12', borderColor: colors.primary + '35' },
              { borderColor: colors.border },
            ]}
            onPress={() => {
              onSelect(null);
              onClose();
            }}
            activeOpacity={0.8}
          >
            <View style={[styles.icon, { backgroundColor: colors.surfaceSecondary }]}>
              <Ionicons name="grid-outline" size={18} color={colors.primary} />
            </View>
            <View style={{ flex: 1 }}>
              <Text style={[styles.name, { color: colors.text }]}>All Communities</Text>
              <Text style={[styles.meta, { color: colors.textSecondary }]}>
                Posts from every community you belong to
              </Text>
            </View>
            {!activeGroup ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
          </TouchableOpacity>

          {uniqueGroups.map((group) => {
            const active = activeGroup?._id === group._id;
            return (
              <TouchableOpacity
                key={group._id}
                style={[
                  styles.row,
                  active && { backgroundColor: colors.primary + '12', borderColor: colors.primary + '35' },
                  { borderColor: colors.border },
                ]}
                onPress={() => {
                  onSelect(group);
                  onClose();
                }}
                activeOpacity={0.8}
              >
                <View style={[styles.icon, { backgroundColor: colors.surfaceSecondary }]}>
                  <Ionicons name={iconForGroup(group)} size={18} color={colors.primary} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.name, { color: colors.text }]} numberOfLines={1}>
                    {group.name}
                  </Text>
                  <Text style={[styles.meta, { color: colors.textSecondary }]}>
                    {group.memberCount || 0} members
                    {group.groupType === 'mentor' ? ' · Private' : ''}
                  </Text>
                </View>
                {active ? <Ionicons name="checkmark-circle" size={20} color={colors.primary} /> : null}
              </TouchableOpacity>
            );
          })}
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
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingVertical: 16,
    borderBottomWidth: 1,
  },
  title: { fontSize: 19, fontWeight: '800' },
  content: { padding: 20, paddingBottom: 40 },
  row: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    borderWidth: 1,
    borderRadius: 14,
    padding: 14,
    marginBottom: 10,
  },
  icon: {
    width: 40,
    height: 40,
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
  },
  name: { fontSize: 14, fontWeight: '700' },
  meta: { fontSize: 11, marginTop: 2 },
});
