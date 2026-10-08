import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
  RefreshControl,
  Alert,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import Header from '../../components/Header';
import { Course, useCourseStore } from '../../store/courseStore';
import { useMembershipStore } from '../../store/membershipStore';
import { fetchPublicMembershipPlans, UIMembershipPlan } from '../../utils/membershipPlans';
import { useBottomTabBarHeight } from '../../hooks/useBottomTabBarHeight';
import apiClient from '../../utils/apiClient';
import { useTheme } from '../../hooks/useTheme';

/* ─── Category badge config ──────────────────────────────────────────── */
const CATEGORY_CONFIG: Record<
  string,
  { color: string; bg: string; icon: string; label: string }
> = {
  physical: { color: '#FFFFFF', bg: '#EF4444', icon: 'barbell', label: 'Physical' },
  mental: { color: '#FFFFFF', bg: '#8B5CF6', icon: 'brain', label: 'Mental' },
  financial: { color: '#1A1A1A', bg: '#22C55E', icon: 'cash', label: 'Financial' },
  relationship: { color: '#FFFFFF', bg: '#EC4899', icon: 'heart', label: 'Relationship' },
  spiritual: { color: '#FFFFFF', bg: '#F59E0B', icon: 'sparkles', label: 'Spiritual' },
  general: { color: '#FFFFFF', bg: '#64748B', icon: 'layers', label: 'General' },
};

type PlanVisual = {
  slug: string;
  label: string;
  color: string;
};

const DEFAULT_PLAN_COLOR = '#64748B';

type EnrichedCourse = Course & { dynamicPlanBadges: PlanVisual[] };

type MembershipAccess = {
  membershipId: string;
  planSlug: string | null;
  planTitle: string | null;
  courseSelectionEnabled: boolean;
  maxSelectable: number;
  remaining: number;
  used: number;
  selectedCourseIds: string[];
  eligibleCourseIds: string[];
};

const normalize = (value?: string | null) => String(value || '').trim().toLowerCase();

const canonicalizePlanTag = (value: string, planAliases: Record<string, string>) => {
  const normalized = normalize(value);
  return planAliases[normalized] || normalized;
};

const toTitle = (value: string) => {
  const text = String(value || '').trim();
  if (!text) return 'Plan';
  return text
    .split(/[-_\s]+/g)
    .filter(Boolean)
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(' ');
};

function getPlanBadges(
  includedInPlans: string[] | undefined,
  planLookup: Record<string, PlanVisual>,
  planAliases: Record<string, string>,
): PlanVisual[] {
  if (!includedInPlans || includedInPlans.length === 0) return [];

  return includedInPlans
    .map((plan) => {
      const rawKey = normalize(plan);
      const key = canonicalizePlanTag(plan, planAliases);
      const visual = planLookup[key];
      if (visual) return visual;
      return {
        slug: rawKey,
        label: toTitle(rawKey),
        color: DEFAULT_PLAN_COLOR,
      };
    })
    .filter((plan) => Boolean(plan?.slug));
}

function getCategoryConfig(category?: string) {
  if (!category) return null;
  const key = category.toLowerCase().trim();
  return CATEGORY_CONFIG[key] || { color: '#FFFFFF', bg: '#4F46E5', icon: 'layers', label: category };
}

/* ─── Screen ─────────────────────────────────────────────────────────── */
export default function CoursesScreen() {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: colors.background,
  },
  scrollContent: {
    padding: 16,
  },
  sectionHeader: {
    marginBottom: 20,
  },
  sectionTitle: {
    fontSize: 28,
    fontWeight: '800',
    color: colors.text,
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: colors.textSecondary,
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: colors.surfaceSecondary,
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
  },
  tab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 10,
    gap: 6,
  },
  tabActive: {
    backgroundColor: colors.primary,
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: colors.textSecondary,
  },
  tabTextActive: {
    color: colors.surface,
  },
  planSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 12,
  },
  planSectionDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
  planSectionTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: colors.text,
    flexShrink: 1,
  },
  planSectionCountPill: {
    minWidth: 22,
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 10,
    backgroundColor: colors.surfaceSecondary,
    alignItems: 'center',
    justifyContent: 'center',
  },
  planSectionCount: {
    fontSize: 12,
    fontWeight: '700',
    color: colors.textSecondary,
  },
  creditsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
    gap: 10,
  },
  creditsBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
    flexShrink: 1,
  },
  creditsBannerText: { fontSize: 14, color: colors.text, flex: 1, flexShrink: 1 },
  creditsBannerBold: { fontWeight: '700' },
  creditsBannerLink: { fontSize: 13, fontWeight: '700', color: colors.primary, flexShrink: 0 },
  creditsBannerDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: colors.surfaceSecondary,
    borderWidth: 1,
    borderColor: colors.border,
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  creditsBannerDoneText: { fontSize: 14, color: colors.text, flex: 1 },
  card: {
    backgroundColor: colors.surface,
    borderRadius: 16,
    marginBottom: 16,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 3,
  },
  cardLocked: {
    opacity: 0.7,
  },
  imageContainer: {
    position: 'relative',
    height: 180,
  },
  courseImage: {
    width: '100%',
    height: '100%',
  },
  imagePlaceholder: {
    width: '100%',
    height: '100%',
    justifyContent: 'center',
    alignItems: 'center',
  },
  categoryBadge: {
    position: 'absolute',
    top: 12,
    left: 12,
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    gap: 4,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '600',
  },
  lockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(0, 0, 0, 0.6)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  unlockOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(139, 92, 246, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  unlockOverlayText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '700',
  },
  enrolledOverlay: {
    ...StyleSheet.absoluteFillObject,
    backgroundColor: 'rgba(34, 197, 94, 0.85)',
    justifyContent: 'center',
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  enrolledOverlayText: {
    color: colors.surface,
    fontSize: 15,
    fontWeight: '700',
  },
  courseInfo: {
    padding: 16,
  },
  courseTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: colors.text,
    marginBottom: 6,
  },
  courseDescription: {
    fontSize: 14,
    color: colors.textSecondary,
    lineHeight: 20,
    marginBottom: 12,
  },
  badgeContainer: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginBottom: 12,
  },
  planBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  planBadgeText: {
    fontSize: 11,
    fontWeight: '600',
  },
  statsRow: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  statText: {
    fontSize: 13,
    color: colors.textSecondary,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: colors.textSecondary,
    marginTop: 16,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: colors.textSecondary,
  },
});
  const router = useRouter();
  const { courses, fetchCourses, isLoading } = useCourseStore();
  const { fetchCurrentSubscription } = useMembershipStore();
  const [planLookup, setPlanLookup] = useState<Record<string, PlanVisual>>({});
  const [planAliases, setPlanAliases] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'all' | 'free' | 'paid'>('all');
  const bottomTabHeight = useBottomTabBarHeight();
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [membershipCredits, setMembershipCredits] = useState<{
    membershipId: string;
    remaining: number;
    maxSelectable: number;
    enabled: boolean;
  } | null>(null);
  const [memberships, setMemberships] = useState<MembershipAccess[]>([]);
  const [entitlementPlanSlugs, setEntitlementPlanSlugs] = useState<Set<string>>(new Set());
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());

  const fetchMembershipCredits = useCallback(async () => {
    setCreditsLoading(true);
    try {
      const { data } = await apiClient.get('/membership/active');
      if (data?.success && data?.hasActiveMembership) {
        const list: MembershipAccess[] = Array.isArray(data.memberships) ? data.memberships : [];
        setMemberships(list);

        setSelectedCourseIds(
          new Set((data.selectedCourseIds || []).map((id: any) => String(id))),
        );
        setEntitlementPlanSlugs(
          new Set((data.entitlementPlanSlugs || []).map((slug: string) => normalize(slug))),
        );

        // Banner reflects the first credit-selection membership, preferring one with credits left.
        const primary = list.find((m) => m.courseSelectionEnabled && (m.remaining || 0) > 0)
          || list.find((m) => m.courseSelectionEnabled)
          || null;
        setMembershipCredits(primary ? {
          membershipId: primary.membershipId,
          remaining: primary.remaining || 0,
          maxSelectable: primary.maxSelectable || 0,
          enabled: true,
        } : null);
      } else {
        setMemberships([]);
        setMembershipCredits(null);
        setSelectedCourseIds(new Set());
        setEntitlementPlanSlugs(new Set());
      }
    } catch {
      setMemberships([]);
      setMembershipCredits(null);
      setSelectedCourseIds(new Set());
      setEntitlementPlanSlugs(new Set());
    } finally {
      setCreditsLoading(false);
    }
  }, []);

  const loadPlanMetadata = useCallback(async () => {
    const plans = await fetchPublicMembershipPlans();
    const lookup = plans.reduce<Record<string, PlanVisual>>((acc, plan: UIMembershipPlan) => {
      const slug = normalize(plan.slug || plan.id);
      if (!slug) return acc;

      acc[slug] = {
        slug,
        label: plan.name || toTitle(slug),
        color: plan.color || DEFAULT_PLAN_COLOR,
      };
      return acc;
    }, {});

    const aliases = plans.reduce<Record<string, string>>((acc, plan: UIMembershipPlan) => {
      const slug = normalize(plan.slug || plan.id);
      if (!slug) return acc;

      acc[slug] = slug;

      const normalizedName = normalize(plan.name);
      if (normalizedName) {
        acc[normalizedName] = slug;
      }

      const normalizedRawId = normalize(plan.rawId);
      if (normalizedRawId) {
        acc[normalizedRawId] = slug;
      }

      return acc;
    }, {});

    setPlanLookup(lookup);
    setPlanAliases(aliases);
  }, []);

  useEffect(() => {
    fetchCourses();
    loadPlanMetadata();
    fetchMembershipCredits();
  }, [fetchCourses, loadPlanMetadata, fetchMembershipCredits]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    try {
      await Promise.all([
        fetchCourses(),
        fetchCurrentSubscription(),
        loadPlanMetadata(),
        fetchMembershipCredits(),
      ]);
    } finally {
      setRefreshing(false);
    }
  }, [fetchCourses, fetchCurrentSubscription, loadPlanMetadata, fetchMembershipCredits]);

  // Refresh subscription + membership credits when screen comes into focus
  // (e.g., after purchase, course selection, or membership change)
  useFocusEffect(
    useCallback(() => {
      fetchCurrentSubscription();
      fetchMembershipCredits();
    }, [fetchCurrentSubscription, fetchMembershipCredits])
  );

  // Find any active credit-selection membership that can unlock this course.
  const findUnlockMembershipForCourse = useCallback(
    (courseId: string) => memberships.find((m) =>
      m.courseSelectionEnabled
      && (m.remaining || 0) > 0
      && (m.eligibleCourseIds || []).some((id) => String(id) === courseId),
    ) || null,
    [memberships],
  );

  const handleCardPress = (module: Course, locked: boolean) => {
    if (locked) {
      const courseIdStr = String(module._id);
      // Any active credit-selection membership that still has credits and includes
      // this course can unlock it — not just the newest membership.
      const unlockMembership = findUnlockMembershipForCourse(courseIdStr);

      if (unlockMembership) {
        Alert.alert(
          'Unlock Course',
          `Would you like to use 1 credit to unlock "${module.title}"?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Unlock',
              onPress: async () => {
                try {
                  const res = await apiClient.post(`/membership/${unlockMembership.membershipId}/select-course`, {
                    courseId: courseIdStr,
                  });
                  if (res.data?.success) {
                    setSelectedCourseIds((prev) => new Set(prev).add(courseIdStr));
                    setMemberships((prev) => prev.map((m) => m.membershipId === unlockMembership.membershipId
                      ? {
                        ...m,
                        remaining: Math.max(0, (m.remaining || 0) - 1),
                        selectedCourseIds: [...(m.selectedCourseIds || []), courseIdStr],
                      }
                      : m));
                    setMembershipCredits((prev) => prev ? {
                      ...prev,
                      remaining: Math.max(0, prev.remaining - 1),
                    } : null);
                    Alert.alert('Success', `"${module.title}" is now unlocked!`);
                  } else if (res.data?.reason === 'already_enrolled') {
                    setSelectedCourseIds((prev) => new Set(prev).add(courseIdStr));
                  }
                } catch (err: any) {
                  if (err?.response?.data?.reason === 'already_enrolled') {
                    setSelectedCourseIds((prev) => new Set(prev).add(courseIdStr));
                  } else {
                    Alert.alert('Error', err.response?.data?.message || 'Failed to select course');
                  }
                }
              }
            }
          ]
        );
        return;
      }

      // Redirect to membership purchase screen
      router.push('/(home)/my-membership');
      return;
    }
    router.push({
      pathname: '/course-detail',
      params: {
        id: module._id,
        title: module.title,
        color: module.color,
        duration: module.duration,
        videos: module.totalVideos || 0,
      },
    });
  };

  const enrichedCourses = useMemo(
    () => courses.map((course) => ({
      ...course,
      dynamicPlanBadges: getPlanBadges(course.includedInPlans, planLookup, planAliases),
    })),
    [courses, planLookup, planAliases]
  );

  // Whether a course is already accessible (free, entitlement-covered, or unlocked
  // with credits). Used to float purchased/unlocked courses to the top of each section.
  const isCourseAccessible = useCallback(
    (course: EnrichedCourse) => {
      const includedPlans = course.includedInPlans || [];
      if (includedPlans.length === 0) return true;
      const isEntitlementCovered = includedPlans.some((tag) =>
        entitlementPlanSlugs.has(canonicalizePlanTag(tag, planAliases)),
      );
      return isEntitlementCovered || selectedCourseIds.has(String(course._id));
    },
    [entitlementPlanSlugs, selectedCourseIds, planAliases],
  );

  const { freeCourses, paidCourses } = useMemo(() => {
    const free: typeof enrichedCourses = [];
    const paid: typeof enrichedCourses = [];
    enrichedCourses.forEach((course) => {
      if (!course.includedInPlans || course.includedInPlans.length === 0) {
        free.push(course);
      } else {
        paid.push(course);
      }
    });
    // Purchased/unlocked courses first, locked courses last (stable order otherwise).
    const accessibleFirst = (list: typeof enrichedCourses) =>
      [...list].sort(
        (a, b) => Number(isCourseAccessible(b)) - Number(isCourseAccessible(a)),
      );
    return { freeCourses: accessibleFirst(free), paidCourses: accessibleFirst(paid) };
  }, [enrichedCourses, isCourseAccessible]);

  // Group paid courses into sections — one per membership plan, plus an "Other" catch-all.
  // A course tagged with several plans is shown only ONCE, assigned to a plan the user
  // has access to (else the highest tier that includes it).
  const paidSections = useMemo(() => {
    const planOrder = Object.keys(planLookup);
    const ownedSlugs = new Set<string>([
      ...entitlementPlanSlugs,
      ...memberships.map((m) => normalize(m.planSlug)),
    ]);

    const assignment = new Map<string, string>();
    paidCourses.forEach((course) => {
      const candidates = (course.includedInPlans || [])
        .map((tag) => canonicalizePlanTag(tag, planAliases))
        .filter((slug) => Boolean(planLookup[slug]));

      if (candidates.length === 0) {
        assignment.set(String(course._id), '__other__');
        return;
      }

      const ownedCandidates = candidates.filter((slug) => ownedSlugs.has(slug));
      const pool = ownedCandidates.length > 0 ? ownedCandidates : candidates;
      const chosen = pool.reduce((best, slug) =>
        planOrder.indexOf(slug) > planOrder.indexOf(best) ? slug : best,
      );
      assignment.set(String(course._id), chosen);
    });

    const sections: { key: string; title: string; color: string; courses: EnrichedCourse[] }[] = [];

    planOrder.forEach((slug) => {
      const coursesForPlan = paidCourses.filter(
        (course) => assignment.get(String(course._id)) === slug,
      );
      if (coursesForPlan.length > 0) {
        const visual = planLookup[slug];
        sections.push({
          key: slug,
          title: visual.label,
          color: visual.color,
          courses: coursesForPlan,
        });
      }
    });

    const otherCourses = paidCourses.filter(
      (course) => assignment.get(String(course._id)) === '__other__',
    );
    if (otherCourses.length > 0) {
      sections.push({
        key: '__other__',
        title: 'Other Plans',
        color: DEFAULT_PLAN_COLOR,
        courses: otherCourses,
      });
    }

    return sections;
  }, [paidCourses, planLookup, planAliases, entitlementPlanSlugs, memberships]);

  const renderSectionHeader = (label: string, count: number, color?: string) => (
    <View style={styles.planSectionHeader}>
      <View style={[styles.planSectionDot, { backgroundColor: color || colors.textSecondary }]} />
      <Text style={styles.planSectionTitle} numberOfLines={1}>{label}</Text>
      <View style={styles.planSectionCountPill}>
        <Text style={styles.planSectionCount}>{count}</Text>
      </View>
    </View>
  );

  const renderCourseCard = (course: EnrichedCourse) => {
    // Don't render access state until credits have loaded — avoids
    // a flash where all paid courses appear unlocked.
    if (creditsLoading && course.includedInPlans && course.includedInPlans.length > 0) {
      return (
        <View key={course._id} style={[styles.card, { opacity: 0.5 }]}>
          <View style={[styles.imageContainer, { justifyContent: 'center', alignItems: 'center' }]}>
            <ActivityIndicator size="small" color={colors.primary} />
          </View>
        </View>
      );
    }

    const includedPlans = course.includedInPlans || [];
    const isPaidCourse = includedPlans.length > 0;
    // A course is unlocked when it is free, directly granted by an entitlement
    // (non-selection) plan the user holds, or unlocked with credits in ANY of the
    // user's active memberships. Previously this used only the newest membership,
    // which locked courses from earlier plans.
    const isEntitlementCovered = includedPlans.some((tag) =>
      entitlementPlanSlugs.has(canonicalizePlanTag(tag, planAliases)),
    );
    const isCreditUnlocked = selectedCourseIds.has(String(course._id));
    const accessible = !isPaidCourse || isEntitlementCovered || isCreditUnlocked;
    const locked = !accessible;
    const categoryConfig = getCategoryConfig(course.category);

    return (
      <TouchableOpacity
        key={course._id}
        style={[styles.card, locked && styles.cardLocked]}
        onPress={() => handleCardPress(course, locked)}
        activeOpacity={0.7}
      >
        {/* Course Image */}
        <View style={styles.imageContainer}>
          {course.thumbnailUrl ? (
            <Image
              source={{ uri: course.thumbnailUrl }}
              style={styles.courseImage}
              resizeMode="cover"
            />
          ) : (
            <View style={[styles.imagePlaceholder, { backgroundColor: course.color || '#4F46E5' }]}>
              <Ionicons name="book" size={48} color={colors.surface} />
            </View>
          )}

          {/* Category Badge */}
          {categoryConfig && (
            <View style={[styles.categoryBadge, { backgroundColor: categoryConfig.bg }]}>
              <Ionicons name={categoryConfig.icon as any} size={12} color={categoryConfig.color} />
              <Text style={[styles.categoryText, { color: categoryConfig.color }]}>
                {categoryConfig.label}
              </Text>
            </View>
          )}

          {/* Lock / Unlock Overlay */}
          {(() => {
            const courseIdStr = String(course._id);
            const isAlreadyUnlocked = selectedCourseIds.has(courseIdStr);
            const canUnlock = !!findUnlockMembershipForCourse(courseIdStr);

            if (locked && canUnlock) {
              return (
                <View style={styles.unlockOverlay}>
                  <Ionicons name="lock-open-outline" size={20} color={colors.surface} />
                  <Text style={styles.unlockOverlayText}>Unlock Course</Text>
                </View>
              );
            }

            if (locked) {
              return (
                <View style={styles.lockOverlay}>
                  <Ionicons name="lock-closed" size={32} color={colors.surface} />
                </View>
              );
            }

            if (isAlreadyUnlocked) {
              return (
                <View style={styles.enrolledOverlay}>
                  <Ionicons name="checkmark-circle" size={24} color={colors.surface} />
                  <Text style={styles.enrolledOverlayText}>Enrolled</Text>
                </View>
              );
            }

            return null;
          })()}
        </View>

        {/* Course Info */}
        <View style={styles.courseInfo}>
          <Text style={styles.courseTitle} numberOfLines={2}>
            {course.title}
          </Text>
          <Text style={styles.courseDescription} numberOfLines={2}>
            {course.description}
          </Text>

          {/* Plan Badges */}
          {course.dynamicPlanBadges && course.dynamicPlanBadges.length > 0 && (
            <View style={styles.badgeContainer}>
              {course.dynamicPlanBadges.map((plan) => (
                <View
                  key={plan.slug}
                  style={[styles.planBadge, { backgroundColor: `${plan.color}20` }]}
                >
                  <Text style={[styles.planBadgeText, { color: plan.color }]}>
                    {plan.label}
                  </Text>
                </View>
              ))}
            </View>
          )}

          {/* Course Stats */}
          <View style={styles.statsRow}>
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.statText}>{course.duration}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="play-circle-outline" size={16} color={colors.textSecondary} />
              <Text style={styles.statText}>{course.totalVideos || 0} videos</Text>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomTabHeight }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={[colors.primary]} tintColor={colors.primary} />
        }
      >
        <View style={styles.scrollContent}>
          {/* Section Header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Courses</Text>
            <Text style={styles.sectionSubtitle}>
              Foundational courses to get you started
            </Text>
          </View>

          {/* All / Free / Paid Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'all' && styles.tabActive]}
              onPress={() => setActiveTab('all')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === 'all' ? 'apps' : 'apps-outline'}
                size={16}
                color={activeTab === 'all' ? colors.surface : colors.textSecondary}
              />
              <Text style={[styles.tabText, activeTab === 'all' && styles.tabTextActive]}>
                All
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'free' && styles.tabActive]}
              onPress={() => setActiveTab('free')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === 'free' ? 'lock-open' : 'lock-open-outline'}
                size={16}
                color={activeTab === 'free' ? colors.surface : colors.textSecondary}
              />
              <Text style={[styles.tabText, activeTab === 'free' && styles.tabTextActive]}>
                Free
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'paid' && styles.tabActive]}
              onPress={() => setActiveTab('paid')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === 'paid' ? 'lock-closed' : 'lock-closed-outline'}
                size={16}
                color={activeTab === 'paid' ? colors.surface : colors.textSecondary}
              />
              <Text style={[styles.tabText, activeTab === 'paid' && styles.tabTextActive]}>
                Paid
              </Text>
            </TouchableOpacity>
          </View>

          {/* #2: Credits banner */}
          {membershipCredits && membershipCredits.enabled && (
            membershipCredits.remaining > 0 ? (
              <TouchableOpacity
                style={styles.creditsBanner}
                onPress={() => router.push({
                  pathname: '/(home)/choose-courses',
                  params: {
                    membershipId: membershipCredits.membershipId,
                    maxSelectable: String(membershipCredits.maxSelectable),
                  },
                })}
                activeOpacity={0.85}
              >
                <View style={styles.creditsBannerLeft}>
                  <Ionicons name="gift-outline" size={20} color="#8B5CF6" />
                  <Text style={styles.creditsBannerText}>
                    You have <Text style={styles.creditsBannerBold}>{membershipCredits.remaining} course credits</Text> remaining
                  </Text>
                </View>
                <Text style={styles.creditsBannerLink}>Pick Courses →</Text>
              </TouchableOpacity>
            ) : (
              <View style={styles.creditsBannerDone}>
                <Ionicons name="checkmark-circle" size={20} color={colors.success} />
                <Text style={styles.creditsBannerDoneText}>
                  All {membershipCredits.maxSelectable} courses selected
                </Text>
              </View>
            )
          )}

          {isLoading ? (
            <ActivityIndicator size="large" color={colors.primary} style={{ marginTop: 20 }} />
          ) : enrichedCourses.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="book-outline" size={64} color={colors.border} />
              <Text style={styles.emptyTitle}>No courses available</Text>
              <Text style={styles.emptySubtitle}>Check back soon for new content</Text>
            </View>
          ) : activeTab === 'free' ? (
            freeCourses.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="lock-open-outline" size={64} color={colors.border} />
                <Text style={styles.emptyTitle}>No free courses</Text>
                <Text style={styles.emptySubtitle}>Check back soon for free content</Text>
              </View>
            ) : (
              <>
                {renderSectionHeader('Free Courses', freeCourses.length, '#22C55E')}
                {freeCourses.map(renderCourseCard)}
              </>
            )
          ) : activeTab === 'paid' ? (
            paidSections.length === 0 ? (
              <View style={styles.emptyState}>
                <Ionicons name="lock-closed-outline" size={64} color={colors.border} />
                <Text style={styles.emptyTitle}>No paid courses</Text>
                <Text style={styles.emptySubtitle}>Explore membership plans to access paid courses</Text>
              </View>
            ) : (
              <>
                {paidSections.map((section) => (
                  <View key={section.key}>
                    {renderSectionHeader(section.title, section.courses.length, section.color)}
                    {section.courses.map(renderCourseCard)}
                  </View>
                ))}
              </>
            )
          ) : (
            <>
              {freeCourses.length > 0 && (
                <View>
                  {renderSectionHeader('Free Courses', freeCourses.length, '#22C55E')}
                  {freeCourses.map(renderCourseCard)}
                </View>
              )}
              {paidSections.map((section) => (
                <View key={section.key}>
                  {renderSectionHeader(section.title, section.courses.length, section.color)}
                  {section.courses.map(renderCourseCard)}
                </View>
              ))}
            </>
          )}
        </View>
      </ScrollView>
    </View>
  );
}


