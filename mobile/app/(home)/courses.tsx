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

/**
 * A course is LOCKED if:
 *  - It has at least one plan restriction (includedInPlans is not empty)
 *  - AND the user's current active plan is NOT in that list
 */
function isCourseAccessible(
  includedInPlans: string[] | undefined,
  userPlans: string[] | undefined,
  isActive: boolean,
  planAliases: Record<string, string>,
): boolean {
  // No plan restriction → free/open to all
  if (!includedInPlans || includedInPlans.length === 0) return true;
  // User has no active plan → locked
  if (!userPlans || userPlans.length === 0 || !isActive) return false;
  // Check if user's plan is in the required list
  const normalizedUserPlans = userPlans.map((plan) => canonicalizePlanTag(plan, planAliases));
  const normalizedCoursePlans = includedInPlans.map((plan) => canonicalizePlanTag(plan, planAliases));

  const accessible = normalizedCoursePlans.some((plan) => normalizedUserPlans.includes(plan));

  return accessible;
}

/* ─── Screen ─────────────────────────────────────────────────────────── */
export default function CoursesScreen() {
  const router = useRouter();
  const { courses, fetchCourses, isLoading } = useCourseStore();
  const { currentSubscription, fetchCurrentSubscription } = useMembershipStore();
  const [planLookup, setPlanLookup] = useState<Record<string, PlanVisual>>({});
  const [planAliases, setPlanAliases] = useState<Record<string, string>>({});
  const [refreshing, setRefreshing] = useState(false);
  const [activeTab, setActiveTab] = useState<'free' | 'paid'>('free');
  const bottomTabHeight = useBottomTabBarHeight();
  const [creditsLoading, setCreditsLoading] = useState(true);
  const [membershipCredits, setMembershipCredits] = useState<{
    membershipId: string;
    remaining: number;
    maxSelectable: number;
    enabled: boolean;
  } | null>(null);
  const [eligibleCourseIds, setEligibleCourseIds] = useState<Set<string>>(new Set());
  const [selectedCourseIds, setSelectedCourseIds] = useState<Set<string>>(new Set());

  const fetchMembershipCredits = useCallback(async () => {
    setCreditsLoading(true);
    try {
      const { data } = await apiClient.get('/membership/active');
      if (data?.success && data?.hasActiveMembership && data?.courseSelection?.enabled) {
        setMembershipCredits({
          membershipId: data.membershipId,
          remaining: data.courseSelection.remaining || 0,
          maxSelectable: data.courseSelection.maxSelectable || 0,
          enabled: true,
        });
        const eligibleRes = await apiClient.get(`/membership/${data.membershipId}/eligible-courses`);
        if (eligibleRes.data?.success && eligibleRes.data?.courses) {
          setEligibleCourseIds(new Set(
            eligibleRes.data.courses.map((c: any) => String(c._id))
          ));
        }
        const selRes = await apiClient.get(`/membership/${data.membershipId}/selection-status`);
        if (selRes.data?.success && selRes.data?.selectedCourseIds) {
          setSelectedCourseIds(new Set(
            selRes.data.selectedCourseIds.map((id: any) => String(id))
          ));
        }
      } else {
        setMembershipCredits(null);
        setEligibleCourseIds(new Set());
        setSelectedCourseIds(new Set());
      }
    } catch {
      setMembershipCredits(null);
      setEligibleCourseIds(new Set());
      setSelectedCourseIds(new Set());
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

  const userPlan = currentSubscription?.plan;
  const isActive = currentSubscription?.status === 'active';
  const effectivePlans = useMemo(() => {
    const plans = [
      ...(currentSubscription?.effectivePlans || []),
      ...(userPlan ? [userPlan] : []),
    ]
      .map((plan) => normalize(plan))
      .filter(Boolean);

    return Array.from(new Set(plans));
  }, [currentSubscription?.effectivePlans, userPlan]);

  const handleCardPress = (module: Course, locked: boolean) => {
    if (locked) {
      const courseIdStr = String(module._id);
      const isEligible = membershipCredits?.enabled && eligibleCourseIds.has(courseIdStr);
      const hasCredits = membershipCredits?.enabled && (membershipCredits?.remaining || 0) > 0;

      if (isEligible && hasCredits) {
        Alert.alert(
          'Unlock Course',
          `Would you like to use 1 credit to unlock "${module.title}"?`,
          [
            { text: 'Cancel', style: 'cancel' },
            {
              text: 'Unlock',
              onPress: async () => {
                try {
                  const res = await apiClient.post(`/membership/${membershipCredits!.membershipId}/select-course`, {
                    courseId: courseIdStr,
                  });
                  if (res.data?.success) {
                    setSelectedCourseIds((prev) => new Set(prev).add(courseIdStr));
                    setMembershipCredits((prev) => prev ? {
                      ...prev,
                      remaining: prev.remaining - 1,
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
    return { freeCourses: free, paidCourses: paid };
  }, [enrichedCourses]);

  const displayCourses = activeTab === 'free' ? freeCourses : paidCourses;

  return (
    <View style={styles.container}>
      <Header />
      <ScrollView
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomTabHeight }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EAB308']} />
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

          {/* Free / Paid Tabs */}
          <View style={styles.tabContainer}>
            <TouchableOpacity
              style={[styles.tab, activeTab === 'free' && styles.tabActive]}
              onPress={() => setActiveTab('free')}
              activeOpacity={0.7}
            >
              <Ionicons
                name={activeTab === 'free' ? 'lock-open' : 'lock-open-outline'}
                size={16}
                color={activeTab === 'free' ? '#FFFFFF' : '#6B7280'}
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
                color={activeTab === 'paid' ? '#FFFFFF' : '#6B7280'}
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
                <Ionicons name="checkmark-circle" size={20} color="#065F46" />
                <Text style={styles.creditsBannerDoneText}>
                  All {membershipCredits.maxSelectable} courses selected — <Text style={styles.creditsBannerDoneLink} onPress={() => router.push({
                    pathname: '/(home)/choose-courses',
                    params: {
                      membershipId: membershipCredits.membershipId,
                      maxSelectable: String(membershipCredits.maxSelectable),
                    },
                  })}>Manage selections</Text>
                </Text>
              </View>
            )
          )}

          {isLoading ? (
            <ActivityIndicator size="large" color="#EAB308" style={{ marginTop: 20 }} />
          ) : enrichedCourses.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="book-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No courses available</Text>
              <Text style={styles.emptySubtitle}>Check back soon for new content</Text>
            </View>
          ) : displayCourses.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons
                name={activeTab === 'free' ? 'lock-open-outline' : 'lock-closed-outline'}
                size={64}
                color="#D1D5DB"
              />
              <Text style={styles.emptyTitle}>
                No {activeTab === 'free' ? 'free' : 'paid'} courses
              </Text>
              <Text style={styles.emptySubtitle}>
                {activeTab === 'free'
                  ? 'Check back soon for free content'
                  : 'Explore membership plans to access paid courses'}
              </Text>
            </View>
          ) : (
            displayCourses.map((course) => {
              // Don't render access state until credits have loaded — avoids
              // a flash where all paid courses appear unlocked.
              if (creditsLoading && course.includedInPlans && course.includedInPlans.length > 0) {
                return (
                  <View key={course._id} style={[styles.card, { opacity: 0.5 }]}>
                    <View style={[styles.imageContainer, { justifyContent: 'center', alignItems: 'center' }]}>
                      <ActivityIndicator size="small" color="#EAB308" />
                    </View>
                  </View>
                );
              }

              const accessible = isCourseAccessible(
                course.includedInPlans,
                effectivePlans,
                isActive,
                planAliases
              );
              const isPaidCourse = !!(course.includedInPlans && course.includedInPlans.length > 0);
              const needsCreditSelection = !!(membershipCredits?.enabled && isPaidCourse);
              const isCreditUnlocked = needsCreditSelection
                ? selectedCourseIds.has(String(course._id))
                : true;
              const locked = !accessible || (needsCreditSelection && !isCreditUnlocked);
              const categoryConfig = getCategoryConfig(course.category);

              return (
                <TouchableOpacity
                  key={course._id}
                  style={[
                    styles.card,
                    locked && styles.cardLocked,
                  ]}
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
                        <Ionicons name="book" size={48} color="#FFFFFF" />
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
                      const isAlreadyUnlocked = membershipCredits?.enabled && selectedCourseIds.has(courseIdStr);
                      const isEligible = membershipCredits?.enabled && eligibleCourseIds.has(courseIdStr);
                      const hasCredits = membershipCredits?.enabled && (membershipCredits?.remaining || 0) > 0;

                      if (locked && isEligible && hasCredits) {
                        return (
                          <View style={styles.unlockOverlay}>
                            <Ionicons name="lock-open-outline" size={20} color="#FFFFFF" />
                            <Text style={styles.unlockOverlayText}>Unlock Course</Text>
                          </View>
                        );
                      }

                      if (locked) {
                        return (
                          <View style={styles.lockOverlay}>
                            <Ionicons name="lock-closed" size={32} color="#FFFFFF" />
                          </View>
                        );
                      }

                      if (isAlreadyUnlocked) {
                        return (
                          <View style={styles.enrolledOverlay}>
                            <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
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
                        <Ionicons name="time-outline" size={16} color="#6B7280" />
                        <Text style={styles.statText}>{course.duration}</Text>
                      </View>
                      <View style={styles.statItem}>
                        <Ionicons name="play-circle-outline" size={16} color="#6B7280" />
                        <Text style={styles.statText}>{course.totalVideos || 0} videos</Text>
                      </View>
                    </View>
                  </View>
                </TouchableOpacity>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
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
    color: '#111827',
    marginBottom: 4,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: '#6B7280',
  },
  tabContainer: {
    flexDirection: 'row',
    backgroundColor: '#F3F4F6',
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
    backgroundColor: '#EAB308',
  },
  tabText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  tabTextActive: {
    color: '#FFFFFF',
  },
  creditsBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#F5F3FF',
    borderWidth: 1,
    borderColor: '#DDD6FE',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  creditsBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  creditsBannerText: { fontSize: 14, color: '#4C1D95' },
  creditsBannerBold: { fontWeight: '700' },
  creditsBannerLink: { fontSize: 13, fontWeight: '700', color: '#7C3AED' },
  creditsBannerDone: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    backgroundColor: '#ECFDF5',
    borderWidth: 1,
    borderColor: '#A7F3D0',
    borderRadius: 14,
    padding: 14,
    marginBottom: 20,
  },
  creditsBannerDoneText: { fontSize: 14, color: '#065F46', flex: 1 },
  creditsBannerDoneLink: { fontWeight: '700', color: '#059669', textDecorationLine: 'underline' },
  card: {
    backgroundColor: '#FFFFFF',
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
    color: '#FFFFFF',
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
    color: '#FFFFFF',
    fontSize: 15,
    fontWeight: '700',
  },
  courseInfo: {
    padding: 16,
  },
  courseTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  courseDescription: {
    fontSize: 14,
    color: '#6B7280',
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
    color: '#6B7280',
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 60,
  },
  emptyTitle: {
    fontSize: 18,
    fontWeight: '600',
    color: '#6B7280',
    marginTop: 16,
    marginBottom: 4,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#9CA3AF',
  },
});
