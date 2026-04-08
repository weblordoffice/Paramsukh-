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
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import Header from '../../components/Header';
import { Course, useCourseStore } from '../../store/courseStore';
import { useMembershipStore } from '../../store/membershipStore';
import { fetchPublicMembershipPlans, UIMembershipPlan } from '../../utils/membershipPlans';
import { useBottomTabBarHeight } from '../../hooks/useBottomTabBarHeight';

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
): PlanVisual[] {
  if (!includedInPlans || includedInPlans.length === 0) return [];

  return includedInPlans
    .map((plan) => {
      const key = normalize(plan);
      const visual = planLookup[key];
      if (visual) return visual;
      return {
        slug: key,
        label: toTitle(key),
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
): boolean {
  // No plan restriction → free/open to all
  if (!includedInPlans || includedInPlans.length === 0) return true;
  // User has no active plan → locked
  if (!userPlans || userPlans.length === 0 || !isActive) return false;
  // Check if user's plan is in the required list
  const normalizedUserPlans = userPlans.map((plan) => normalize(plan));
  const normalizedCoursePlans = includedInPlans.map((plan) => normalize(plan));
  
  const accessible = normalizedCoursePlans.some((plan) => normalizedUserPlans.includes(plan));
  
  // Debug logging
  if (__DEV__) {
    console.log('🔓 Course Access Check:', {
      coursePlans: includedInPlans,
      userPlans,
      isActive,
      normalizedUserPlans,
      normalizedCoursePlans,
      accessible
    });
  }
  
  return accessible;
}

/* ─── Screen ─────────────────────────────────────────────────────────── */
export default function CoursesScreen() {
  const router = useRouter();
  const { courses, fetchCourses, isLoading } = useCourseStore();
  const { currentSubscription, fetchCurrentSubscription } = useMembershipStore();
  const [planLookup, setPlanLookup] = useState<Record<string, PlanVisual>>({});
  const [refreshing, setRefreshing] = useState(false);
  const bottomTabHeight = useBottomTabBarHeight();

  const loadPlanMetadata = useCallback(async () => {
    const plans = await fetchPublicMembershipPlans();
    const lookup = plans.reduce<Record<string, PlanVisual>>((acc, plan: UIMembershipPlan) => {
      const slug = normalize(plan.id);
      if (!slug) return acc;

      acc[slug] = {
        slug,
        label: plan.name || toTitle(slug),
        color: plan.color || DEFAULT_PLAN_COLOR,
      };
      return acc;
    }, {});

    setPlanLookup(lookup);
  }, []);

  useEffect(() => {
    fetchCourses();
    fetchCurrentSubscription();
    loadPlanMetadata();
  }, [fetchCourses, fetchCurrentSubscription, loadPlanMetadata]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([
      fetchCourses(),
      fetchCurrentSubscription(),
      loadPlanMetadata(),
    ]);
    setRefreshing(false);
  }, [fetchCourses, fetchCurrentSubscription, loadPlanMetadata]);

  // Refresh subscription when screen comes into focus (e.g., after purchase)
  useFocusEffect(
    useCallback(() => {
      fetchCurrentSubscription();
      // Debug: Log subscription status
      if (__DEV__) {
        console.log('📊 Courses screen focused - fetching latest subscription');
      }
    }, [fetchCurrentSubscription])
  );

  const userPlan = currentSubscription?.plan;
  const isActive = currentSubscription?.status === 'active' || currentSubscription?.status === 'trial';
  const effectivePlans = currentSubscription?.effectivePlans || (userPlan ? [userPlan] : []);

  // Debug: Log subscription and plan info
  if (__DEV__) {
    console.log('📋 Current Subscription:', {
      plan: userPlan,
      status: currentSubscription?.status,
      isActive,
      effectivePlans
    });
  }

  const handleCardPress = (module: Course, locked: boolean) => {
    if (locked) {
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
      dynamicPlanBadges: getPlanBadges(course.includedInPlans, planLookup),
    })),
    [courses, planLookup]
  );

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

          {isLoading ? (
            <ActivityIndicator size="large" color="#EAB308" style={{ marginTop: 20 }} />
          ) : enrichedCourses.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons name="book-outline" size={64} color="#D1D5DB" />
              <Text style={styles.emptyTitle}>No courses available</Text>
              <Text style={styles.emptySubtitle}>Check back soon for new content</Text>
            </View>
          ) : (
            enrichedCourses.map((course) => {
              const accessible = isCourseAccessible(
                course.includedInPlans,
                effectivePlans,
                isActive
              );
              const locked = !accessible;
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

                    {/* Lock Overlay */}
                    {locked && (
                      <View style={styles.lockOverlay}>
                        <Ionicons name="lock-closed" size={32} color="#FFFFFF" />
                      </View>
                    )}
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
