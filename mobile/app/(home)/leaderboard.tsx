import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import { useTheme } from '../../hooks/useTheme';
import {
  useCommunityStore,
  LeaderboardEntry,
  LeaderboardPeriod,
} from '@/store/communityStore';

type ScopeOption = { id: string | null; name: string };

export default function LeaderboardScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [period, setPeriod] = useState<LeaderboardPeriod>('weekly');
  const [scopeGroupId, setScopeGroupId] = useState<string | null>(null);

  const {
    groups,
    planGroups,
    generalGroup,
    leaderboard,
    leaderboardMe,
    leaderboardLoading,
    fetchMyGroups,
    fetchLeaderboard,
  } = useCommunityStore();

  const scopeOptions = useMemo(() => {
    const options: ScopeOption[] = [{ id: null, name: 'Global' }];
    const seen = new Set<string>();

    if (generalGroup?._id) {
      options.push({ id: generalGroup._id, name: generalGroup.name || 'General' });
      seen.add(generalGroup._id);
    }

    planGroups.forEach((planGroup) => {
      if (planGroup._id && !seen.has(planGroup._id)) {
        options.push({ id: planGroup._id, name: planGroup.name });
        seen.add(planGroup._id);
      }
      planGroup.subgroups?.forEach((subgroup) => {
        if (subgroup._id && !seen.has(subgroup._id)) {
          options.push({
            id: subgroup._id,
            name: subgroup.category
              ? subgroup.category.charAt(0).toUpperCase() + subgroup.category.slice(1)
              : subgroup.name,
          });
          seen.add(subgroup._id);
        }
      });
    });

    groups.forEach((group) => {
      if (group._id && !seen.has(group._id)) {
        options.push({ id: group._id, name: group.name });
        seen.add(group._id);
      }
    });

    return options;
  }, [generalGroup, planGroups, groups]);

  useFocusEffect(
    useCallback(() => {
      if (!generalGroup && groups.length === 0) {
        fetchMyGroups();
      }
      fetchLeaderboard({ period, groupId: scopeGroupId });
    }, [fetchLeaderboard, fetchMyGroups, generalGroup, groups.length, period, scopeGroupId])
  );

  const topThree = leaderboard.slice(0, 3);
  const remaining = leaderboard.slice(3);
  const meInList = leaderboard.some((entry) => entry.isCurrentUser);

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
    headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    content: { padding: 20, paddingBottom: 40 },
    periodTabs: {
      flexDirection: 'row',
      backgroundColor: colors.surfaceSecondary,
      borderRadius: 12,
      padding: 4,
      marginBottom: 16,
    },
    periodTab: {
      flex: 1,
      alignItems: 'center',
      paddingVertical: 10,
      borderRadius: 9,
    },
    periodTabActive: {
      backgroundColor: colors.surface,
      shadowColor: colors.border,
      shadowOffset: { width: 0, height: 1 },
      shadowOpacity: 0.08,
      shadowRadius: 3,
      elevation: 2,
    },
    periodText: { fontSize: 13, fontWeight: '600', color: colors.textSecondary },
    periodTextActive: { color: colors.primary, fontWeight: '700' },
    scopeRow: { gap: 8, paddingBottom: 18 },
    scopeChip: {
      paddingHorizontal: 14,
      paddingVertical: 8,
      borderRadius: 18,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    scopeChipActive: {
      backgroundColor: colors.primary,
      borderColor: colors.primary,
    },
    scopeText: { fontSize: 12, fontWeight: '600', color: colors.textSecondary },
    scopeTextActive: { color: '#FFFFFF' },
    myRankCard: {
      backgroundColor: colors.surface,
      borderRadius: 16,
      borderWidth: 1,
      borderColor: colors.primary + '40',
      padding: 16,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      marginBottom: 20,
    },
    myRankLeft: { flexDirection: 'row', alignItems: 'center', gap: 12 },
    myRankIcon: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.primary + '15',
      alignItems: 'center',
      justifyContent: 'center',
    },
    myRankLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600' },
    myRankValue: { fontSize: 18, fontWeight: '800', color: colors.text },
    myRankPoints: { fontSize: 20, fontWeight: '800', color: colors.primary },
    myRankPointsLabel: { fontSize: 11, color: colors.textSecondary, textAlign: 'right' },
    podiumRow: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      justifyContent: 'center',
      gap: 8,
      marginBottom: 24,
    },
    podiumCard: {
      flex: 1,
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      paddingVertical: 14,
      paddingHorizontal: 8,
    },
    podiumFirst: {
      borderColor: '#D4A017',
      backgroundColor: '#FFF9E6',
      paddingTop: 22,
    },
    podiumAvatar: {
      width: 42,
      height: 42,
      borderRadius: 21,
      backgroundColor: colors.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      marginBottom: 6,
      overflow: 'hidden',
    },
    podiumAvatarFirst: { width: 54, height: 54, borderRadius: 27 },
    podiumName: {
      fontSize: 12,
      fontWeight: '700',
      color: colors.text,
      textAlign: 'center',
    },
    podiumLevel: { fontSize: 10, color: colors.textSecondary, textAlign: 'center', marginTop: 2 },
    podiumPoints: { fontSize: 15, fontWeight: '800', color: colors.primary, marginTop: 6 },
    podiumRank: { fontSize: 11, fontWeight: '700', color: colors.textSecondary, marginBottom: 4 },
    listHeader: {
      fontSize: 13,
      fontWeight: '700',
      color: colors.textSecondary,
      textTransform: 'uppercase',
      letterSpacing: 0.6,
      marginBottom: 10,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      backgroundColor: colors.surface,
      borderRadius: 14,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 12,
      marginBottom: 10,
    },
    rowCurrent: { borderColor: colors.primary, backgroundColor: colors.primary + '08' },
    rankBadge: {
      width: 28,
      alignItems: 'center',
      justifyContent: 'center',
      marginRight: 10,
    },
    rankText: { fontSize: 14, fontWeight: '800', color: colors.textSecondary },
    rowAvatar: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
      overflow: 'hidden',
      marginRight: 12,
    },
    avatarText: { fontSize: 15, fontWeight: '700', color: colors.primary },
    rowInfo: { flex: 1 },
    rowName: { fontSize: 14, fontWeight: '700', color: colors.text },
    rowLevel: { fontSize: 11, color: colors.textSecondary, marginTop: 2 },
    rowPoints: { fontSize: 16, fontWeight: '800', color: colors.primary },
    rowPointsLabel: { fontSize: 10, color: colors.textSecondary, textAlign: 'right' },
    loading: { paddingVertical: 80, alignItems: 'center' },
    empty: { paddingVertical: 60, alignItems: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 12 },
    emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, paddingHorizontal: 20 },
  });

  const getInitials = (name: string) => {
    const words = String(name || '').trim().split(/\s+/).filter(Boolean);
    if (words.length === 0) return 'U';
    if (words.length === 1) return words[0].charAt(0).toUpperCase();
    return (words[0].charAt(0) + words[words.length - 1].charAt(0)).toUpperCase();
  };

  const renderAvatar = (entry: LeaderboardEntry, size: 'podium' | 'podiumFirst' | 'row') => {
    const avatarStyle = size === 'row'
      ? s.rowAvatar
      : [s.podiumAvatar, size === 'podiumFirst' && s.podiumAvatarFirst];
    const textStyle = size === 'row'
      ? s.avatarText
      : [s.avatarText, size === 'podiumFirst' && { fontSize: 19 }];

    return (
      <View style={avatarStyle}>
        {entry.photoURL ? (
          <Image source={{ uri: entry.photoURL }} style={{ width: '100%', height: '100%' }} />
        ) : (
          <Text style={textStyle}>{getInitials(entry.displayName)}</Text>
        )}
      </View>
    );
  };

  const renderPodiumCard = (entry: LeaderboardEntry) => {
    const isFirst = entry.rank === 1;
    return (
      <View key={entry.userId} style={[s.podiumCard, isFirst && s.podiumFirst]}>
        <Text style={s.podiumRank}>#{entry.rank}</Text>
        {renderAvatar(entry, isFirst ? 'podiumFirst' : 'podium')}
        <Text style={s.podiumName} numberOfLines={1}>{entry.displayName}</Text>
        <Text style={s.podiumLevel} numberOfLines={1}>{entry.level}</Text>
        <Text style={s.podiumPoints}>{entry.points}</Text>
      </View>
    );
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity
          style={s.headerBtn}
          onPress={() => { if (router.canGoBack()) router.back(); }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Community Leaderboard</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl
            refreshing={leaderboardLoading}
            onRefresh={() => fetchLeaderboard({ period, groupId: scopeGroupId })}
            tintColor={colors.primary}
          />
        }
      >
        <View style={s.periodTabs}>
          {([
            { key: 'weekly', label: 'Weekly' },
            { key: 'monthly', label: 'Monthly' },
            { key: 'all', label: 'All Time' },
          ] as { key: LeaderboardPeriod; label: string }[]).map((tab) => (
            <TouchableOpacity
              key={tab.key}
              style={[s.periodTab, period === tab.key && s.periodTabActive]}
              onPress={() => setPeriod(tab.key)}
            >
              <Text style={[s.periodText, period === tab.key && s.periodTextActive]}>
                {tab.label}
              </Text>
            </TouchableOpacity>
          ))}
        </View>

        {scopeOptions.length > 1 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={s.scopeRow}>
            {scopeOptions.map((scope) => {
              const active = scopeGroupId === scope.id;
              return (
                <TouchableOpacity
                  key={scope.id || 'global'}
                  style={[s.scopeChip, active && s.scopeChipActive]}
                  onPress={() => setScopeGroupId(scope.id)}
                >
                  <Text style={[s.scopeText, active && s.scopeTextActive]}>{scope.name}</Text>
                </TouchableOpacity>
              );
            })}
          </ScrollView>
        )}

        {leaderboardMe && (
          <View style={s.myRankCard}>
            <View style={s.myRankLeft}>
              <View style={s.myRankIcon}>
                <Ionicons name="ribbon" size={22} color={colors.primary} />
              </View>
              <View>
                <Text style={s.myRankLabel}>Your rank</Text>
                <Text style={s.myRankValue}>
                  {leaderboardMe.rank ? `#${leaderboardMe.rank}` : 'Unranked'}
                </Text>
              </View>
            </View>
            <View>
              <Text style={s.myRankPoints}>{leaderboardMe.points}</Text>
              <Text style={s.myRankPointsLabel}>{leaderboardMe.level}</Text>
            </View>
          </View>
        )}

        {leaderboardLoading && leaderboard.length === 0 ? (
          <View style={s.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : leaderboard.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="trophy-outline" size={48} color={colors.textSecondary} />
            <Text style={s.emptyTitle}>No rankings yet</Text>
            <Text style={s.emptyText}>Participate in discussions and questions to earn community points.</Text>
          </View>
        ) : (
          <>
            {topThree.length > 0 && (
              <View style={s.podiumRow}>
                {topThree.length > 1 ? renderPodiumCard(topThree[1]) : null}
                {renderPodiumCard(topThree[0])}
                {topThree.length > 2 ? renderPodiumCard(topThree[2]) : null}
              </View>
            )}

            {!meInList && leaderboardMe?.rank ? (
              <Text style={s.listHeader}>Your position is outside the top {leaderboard.length}</Text>
            ) : null}

            {remaining.length > 0 && (
              <>
                <Text style={s.listHeader}>Rankings</Text>
                {remaining.map((entry) => (
                  <View key={entry.userId} style={[s.row, entry.isCurrentUser && s.rowCurrent]}>
                    <View style={s.rankBadge}>
                      <Text style={s.rankText}>#{entry.rank}</Text>
                    </View>
                    {renderAvatar(entry, 'row')}
                    <View style={s.rowInfo}>
                      <Text style={s.rowName} numberOfLines={1}>
                        {entry.displayName}{entry.isCurrentUser ? ' (You)' : ''}
                      </Text>
                      <Text style={s.rowLevel} numberOfLines={1}>{entry.level}</Text>
                    </View>
                    <View>
                      <Text style={s.rowPoints}>{entry.points}</Text>
                      <Text style={s.rowPointsLabel}>points</Text>
                    </View>
                  </View>
                ))}
              </>
            )}
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
