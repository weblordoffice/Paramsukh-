import React, { useEffect, useMemo, useState, useCallback } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  StyleSheet,
  Image,
  ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useFocusEffect } from 'expo-router';
import Header from '../../components/Header';
import { Course, useCourseStore } from '../../store/courseStore';
import { useMembershipStore } from '../../store/membershipStore';
import { fetchPublicMembershipPlans, UIMembershipPlan } from '../../utils/membershipPlans';

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

const isHexColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value || '');

const getReadableTextColor = (hexColor: string) => {
  const color = hexColor.replace('#', '');
  const r = parseInt(color.substring(0, 2), 16);
  const g = parseInt(color.substring(2, 4), 16);
  const b = parseInt(color.substring(4, 6), 16);
  const brightness = (r * 299 + g * 587 + b * 114) / 1000;
  return brightness > 160 ? '#1A1A1A' : '#FFFFFF';
};

const getPlanBadgeColor = (slug: string, lookup: Record<string, PlanVisual>) => {
  const configured = lookup[normalize(slug)]?.color;
  if (configured && isHexColor(configured)) {
    return configured;
  }
  return DEFAULT_PLAN_COLOR;
};

function getPlanBadges(plans: string[] | undefined, lookup: Record<string, PlanVisual>) {
  if (!plans || plans.length === 0) return [];
  return plans
    .map((slug) => {
      const key = normalize(slug);
      const fromLookup = lookup[key];
      return {
        key,
        label: fromLookup?.label || toTitle(key),
        color: getPlanBadgeColor(key, lookup),
      };
    })
    .filter((plan) => !!plan.key);
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
      <ScrollView showsVerticalScrollIndicator={false}>
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
              <Ionicons name="book-outline" size={72} color="#475569" />
              <Text style={styles.emptyStateTitle}>No Courses Yet</Text>
              <Text style={styles.emptyStateSubtitle}>
                We&apos;re preparing amazing courses for you. Check back soon for new content!
              </Text>
            </View>
          ) : (
            enrichedCourses.map((module) => {
              const catCfg = getCategoryConfig(module.category);
              const planBadges = module.dynamicPlanBadges;
              const locked = !isCourseAccessible(module.includedInPlans, effectivePlans, isActive);

              return (
                <View
                  key={module._id}
                  style={[
                    styles.card,
                    { borderLeftColor: locked ? '#475569' : module.color },
                    locked && styles.cardLocked,
                  ]}
                >
                  {/* Thumbnail */}
                  <View style={styles.imageWrapper}>
                    {module.thumbnailUrl ? (
                      <Image
                        source={{ uri: module.thumbnailUrl }}
                        style={[styles.thumbnail, locked && styles.thumbnailDimmed]}
                        resizeMode="cover"
                      />
                    ) : (
                      <View
                        style={[
                          styles.thumbnailPlaceholder,
                          { backgroundColor: locked ? '#1E293B' : module.color + '33' },
                        ]}
                      >
                        <Ionicons
                          name={locked ? 'lock-closed' : (module.icon as any)}
                          size={40}
                          color={locked ? '#475569' : module.color}
                        />
                      </View>
                    )}

                    {/* Lock overlay on image */}
                    {locked && (
                      <View style={styles.lockOverlay}>
                        <View style={styles.lockBadge}>
                          <Ionicons name="lock-closed" size={18} color="#F8FAFC" />
                        </View>
                      </View>
                    )}

                    {/* Category Badge */}
                    {catCfg && (
                      <View
                        style={[
                          styles.categoryBadge,
                          { backgroundColor: locked ? '#334155' : catCfg.bg },
                        ]}
                      >
                        <Ionicons
                          name={catCfg.icon as any}
                          size={11}
                          color={locked ? '#94A3B8' : catCfg.color}
                        />
                        <Text
                          style={[
                            styles.categoryBadgeText,
                            { color: locked ? '#94A3B8' : catCfg.color },
                          ]}
                        >
                          {catCfg.label}
                        </Text>
                      </View>
                    )}
                  </View>

                  {/* Card Body */}
                  <View style={styles.cardContent}>
                    <View style={styles.headerRow}>
                      <Ionicons
                        name={locked ? 'lock-closed-outline' : (module.icon as any)}
                        size={22}
                        color={locked ? '#475569' : module.color}
                      />
                      <Text style={[styles.title, locked && styles.titleLocked]}>
                        {module.title}
                      </Text>
                    </View>

                    <Text style={[styles.description, locked && styles.descriptionLocked]} numberOfLines={2}>
                      {module.description}
                    </Text>

                    {/* Plan tier badges */}
                    {planBadges.length > 0 && (
                      <View style={styles.planBadgeRow}>
                        {planBadges.map(({ key, label, color }) => {
                          const textColor = getReadableTextColor(color);
                          return (
                          <View
                            key={key}
                            style={[
                              styles.planBadge,
                              locked
                                ? { backgroundColor: '#1E293B', borderColor: '#334155' }
                                : { backgroundColor: `${color}22`, borderColor: color },
                            ]}
                          >
                            <Ionicons
                              name={'pricetag' as any}
                              size={10}
                              color={locked ? '#475569' : textColor}
                            />
                            <Text
                              style={[
                                styles.planBadgeText,
                                { color: locked ? '#475569' : textColor },
                              ]}
                            >
                              {label}
                            </Text>
                          </View>
                        );
                        })}
                      </View>
                    )}

                    <View style={styles.footerRow}>
                      <View style={styles.metaRow}>
                        <Ionicons name="time-outline" size={13} color={locked ? '#475569' : '#94A3B8'} />
                        <Text style={[styles.metaText, locked && styles.metaTextLocked]}>{module.duration}</Text>
                        <Text style={[styles.metaDot, locked && styles.metaTextLocked]}>•</Text>
                        <Ionicons name="play-circle-outline" size={13} color={locked ? '#475569' : '#94A3B8'} />
                        <Text style={[styles.metaText, locked && styles.metaTextLocked]}>
                          {module.totalVideos || 0} videos
                        </Text>
                      </View>

                      <TouchableOpacity
                        style={[
                          styles.viewButton,
                          locked
                            ? styles.viewButtonLocked
                            : { backgroundColor: module.color },
                        ]}
                        onPress={() => handleCardPress(module, locked)}
                        activeOpacity={0.8}
                      >
                        {locked ? (
                          <>
                            <Ionicons name="lock-closed" size={14} color="#94A3B8" />
                            <Text style={styles.viewButtonTextLocked}>Unlock</Text>
                          </>
                        ) : (
                          <>
                            <Text style={styles.viewButtonText}>View</Text>
                            <Ionicons name="chevron-forward" size={16} color="#FFFFFF" />
                          </>
                        )}
                      </TouchableOpacity>
                    </View>
                  </View>
                </View>
              );
            })
          )}
        </View>
      </ScrollView>
    </View>
  );
}

/* ─── Styles ─────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#FDF8F3' },
  scrollContent: { padding: 20, paddingTop: 16, paddingBottom: 120 },

  /* ── Empty State ── */
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },

  sectionHeader: { marginBottom: 24, paddingHorizontal: 4 },
  sectionTitle: { fontSize: 24, fontWeight: '700', color: '#1F2937', marginBottom: 6, letterSpacing: 0.3 },
  sectionSubtitle: { fontSize: 15, color: '#6B7280', fontWeight: '500' },

  /* ── Card ── */
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    borderLeftWidth: 4,
    marginBottom: 18,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
    overflow: 'hidden',
  },
  cardLocked: {
    backgroundColor: '#151E2D',
    borderColor: 'rgba(71, 85, 105, 0.3)',
  },

  /* ── Thumbnail ── */
  imageWrapper: { position: 'relative', width: '100%', height: 170 },
  thumbnail: { width: '100%', height: '100%' },
  thumbnailDimmed: { opacity: 0.45 },
  thumbnailPlaceholder: { width: '100%', height: '100%', alignItems: 'center', justifyContent: 'center' },

  /* Lock overlay */
  lockOverlay: {
    position: 'absolute',
    inset: 0,
    top: 0, left: 0, right: 0, bottom: 0,
    backgroundColor: 'rgba(15, 23, 42, 0.55)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  lockBadge: {
    width: 52,
    height: 52,
    borderRadius: 26,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    borderWidth: 1.5,
    borderColor: 'rgba(148,163,184,0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ── Category Badge ── */
  categoryBadge: {
    position: 'absolute',
    top: 10,
    left: 10,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.35,
    shadowRadius: 4,
    elevation: 5,
  },
  categoryBadgeText: { fontSize: 11, fontWeight: '700', letterSpacing: 0.5, textTransform: 'uppercase' },

  /* ── Card Body ── */
  cardContent: { padding: 18 },
  headerRow: { flexDirection: 'row', alignItems: 'center', marginBottom: 10, gap: 12 },
  title: { fontSize: 17, fontWeight: '700', color: '#F8FAFC', flex: 1 },
  titleLocked: { color: '#475569' },
  description: { fontSize: 14, color: '#CBD5E1', lineHeight: 21, marginBottom: 14 },
  descriptionLocked: { color: '#334155' },

  /* Footer row */
  footerRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  metaRow: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  metaText: { fontSize: 12, color: '#94A3B8', fontWeight: '500' },
  metaTextLocked: { color: '#334155' },
  metaDot: { fontSize: 12, color: '#94A3B8', marginHorizontal: 2 },

  /* View button */
  viewButton: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 9,
    paddingHorizontal: 16,
    borderRadius: 12,
    gap: 6,
    shadowColor: '#EAB308',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 10,
    elevation: 6,
  },
  viewButtonLocked: {
    backgroundColor: 'rgba(71,85,105,0.2)',
    borderWidth: 1,
    borderColor: 'rgba(71,85,105,0.4)',
    shadowOpacity: 0,
    elevation: 0,
  },
  viewButtonText: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  viewButtonTextLocked: { fontSize: 14, fontWeight: '700', color: '#94A3B8' },

  /* ── Plan tier badges ── */
  planBadgeRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 6, marginBottom: 14 },
  planBadge: { flexDirection: 'row', alignItems: 'center', gap: 4, paddingHorizontal: 8, paddingVertical: 4, borderRadius: 20, borderWidth: 1 },
  planBadgeText: { fontSize: 10, fontWeight: '700', letterSpacing: 0.4, textTransform: 'uppercase' },
});

