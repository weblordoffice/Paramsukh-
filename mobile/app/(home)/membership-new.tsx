import React, { useState, useEffect, useCallback, useRef } from 'react';
import { ScrollView, Text, TouchableOpacity, View, Alert, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { openPaymentLink, savePendingPaymentLink, clearPendingPaymentLinks } from '../../utils/paymentBrowser';
import Header from '../../components/Header';
import { useMembershipStore } from '../../store/membershipStore';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../utils/apiClient';
import { fetchPublicMembershipPlans, UIMembershipPlan, PENDING_MEMBERSHIP_LINK_KEY } from '../../utils/membershipPlans';
import { useTheme } from '../../hooks/useTheme';

const PENDING_LINK_KEY = PENDING_MEMBERSHIP_LINK_KEY;

interface EligibleCourse {
  _id: string;
  title: string;
  thumbnailUrl?: string;
  icon?: string;
  color?: string;
  duration?: string;
  category?: string;
  totalVideos?: number;
  totalPdfs?: number;
  shortDescription?: string;
}

export default function MembershipScreen() {
  const { colors } = useTheme();
  const { currentSubscription, isLoading, fetchCurrentSubscription } = useMembershipStore();
  const { token } = useAuthStore();

  const [plans, setPlans] = useState<UIMembershipPlan[]>([]);
  const [plansLoading, setPlansLoading] = useState(true);
  const [purchasingPlanId, setPurchasingPlanId] = useState<string | null>(null);
  const purchasingRef = useRef(false);
  const [expandedPlanId, setExpandedPlanId] = useState<string | null>(null);
  const [planCourses, setPlanCourses] = useState<Record<string, EligibleCourse[]>>({});
  const [selectedCourses, setSelectedCourses] = useState<Record<string, string[]>>({});
  const [loadingCourses, setLoadingCourses] = useState<Record<string, boolean>>({});

  const loadPublicPlans = useCallback(async () => {
    setPlansLoading(true);
    const dynamicPlans = await fetchPublicMembershipPlans();
    setPlans(dynamicPlans);
    setPlansLoading(false);
    if (dynamicPlans.length > 0 && !expandedPlanId) {
      setExpandedPlanId(dynamicPlans[0].id);
    }
  }, []);

  useEffect(() => {
    fetchCurrentSubscription();
    loadPublicPlans();
  }, [fetchCurrentSubscription, loadPublicPlans]);

  useEffect(() => {
    if (!currentSubscription || currentSubscription.status === 'active') return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PENDING_LINK_KEY);
        if (!raw || cancelled) return;
        const { paymentLinkId, plan } = JSON.parse(raw);
        if (!paymentLinkId || !plan) return;
        // Re-check in case subscription became active during async gap
        const currentSub = useMembershipStore.getState().currentSubscription;
        if (currentSub?.status === 'active') return;
        const res = await apiClient.post('/payments/membership-link/confirm', { paymentLinkId, plan });
        if (res.data?.success && res.data?.data?.status === 'active') {
          await AsyncStorage.removeItem(PENDING_LINK_KEY);
          await fetchCurrentSubscription();
        }
      } catch { /* ignore */ }
    })();
    return () => { cancelled = true; };
  }, [currentSubscription, fetchCurrentSubscription]);

  const fetchEligibleCourses = async (planSlug: string) => {
    if (planCourses[planSlug]) return;
    setLoadingCourses((prev) => ({ ...prev, [planSlug]: true }));
    try {
      const { data } = await apiClient.get(`/membership-plans/${planSlug}/eligible-courses`);
      if (data.success) {
        setPlanCourses((prev) => ({ ...prev, [planSlug]: data.courses || [] }));
      }
    } catch {
      setPlanCourses((prev) => ({ ...prev, [planSlug]: [] }));
    } finally {
      setLoadingCourses((prev) => ({ ...prev, [planSlug]: false }));
    }
  };

  const togglePlan = (planId: string, planSlug: string) => {
    if (expandedPlanId === planId) {
      setExpandedPlanId(null);
    } else {
      setExpandedPlanId(planId);
      fetchEligibleCourses(planSlug);
    }
  };

  const toggleCourseSelection = (planId: string, courseId: string, maxSelectable: number) => {
    console.log('[toggleCourseSelection] FIRED planId=', planId, 'courseId=', courseId);
    setSelectedCourses((prev) => {
      const current = prev[planId] || [];
      if (current.includes(courseId)) {
        return { ...prev, [planId]: current.filter((id) => id !== courseId) };
      }
      if (current.length >= maxSelectable) {
        Alert.alert('Limit Reached', `You can only select up to ${maxSelectable} courses for this plan.`);
        return prev;
      }
      return { ...prev, [planId]: [...current, courseId] };
    });
  };

  const getSelectedCount = (planId: string) => (selectedCourses[planId] || []).length;

  const getDisplayPrice = (plan: UIMembershipPlan) => `₹${plan.price.toLocaleString('en-IN')}`;

  const getCategoryBadge = (category: string = '') => {
    const configs: Record<string, { color: string; bg: string }> = {
      physical: { color: '#FFF', bg: '#EF4444' },
      mental: { color: '#FFF', bg: '#8B5CF6' },
      financial: { color: '#1A1A1A', bg: '#22C55E' },
      relationship: { color: '#FFF', bg: '#EC4899' },
      spiritual: { color: '#FFF', bg: '#F59E0B' },
      general: { color: '#FFF', bg: '#64748B' },
    };
    return configs[category.toLowerCase()] || { color: '#FFF', bg: '#8B5CF6' };
  };

  const handlePurchase = async (plan: UIMembershipPlan) => {
    if (!token) {
      Alert.alert('Login Required', 'Please sign in to purchase a membership.');
      return;
    }
    if (purchasingRef.current) return;
    purchasingRef.current = true;

    const selected = selectedCourses[plan.id] || [];
    const maxSelectable = plan.courseSelection?.maxSelectableCourses || 0;
    console.log('[handlePurchase] planId=', plan.id, 'selectedCourses=', selectedCourses, 'selected=', selected, 'maxSelectable=', maxSelectable);

    if (maxSelectable > 0 && selected.length === 0) {
      purchasingRef.current = false;
      Alert.alert(
        'Select Courses',
        `You can pick up to ${maxSelectable} courses. Select now or choose after purchase.`,
        [
          { text: 'Choose After Purchase', onPress: () => { purchasingRef.current = true; proceedWithPurchase(plan, selected); } },
          { text: 'Pick Now', style: 'cancel' },
        ]
      );
      return;
    }

    proceedWithPurchase(plan, selected);
  };

  const proceedWithPurchase = async (plan: UIMembershipPlan, selected: string[]) => {
    setPurchasingPlanId(plan.id);

    try {
      const linkRes = await apiClient.post('/payments/membership-link', {
        plan: plan.parentSlug,
        amount: plan.price,
        selectedCourseIds: selected,
      });

      if (!linkRes.data?.success || !linkRes.data?.data?.url) {
        Alert.alert('Error', linkRes.data?.message || 'Failed to create payment link.');
        return;
      }

      const url = linkRes.data.data.url as string;
      const paymentLinkId = linkRes.data.data.paymentLinkId as string | undefined;
      const expiresAt = linkRes.data.data.expiresAt as string | undefined;
      const serverCallbackUrl = linkRes.data.data.callbackUrl as string | undefined;

      if (paymentLinkId) {
        const pending = { paymentLinkId, plan: plan.parentSlug, variantSlug: plan.variantSlug || null };
        await AsyncStorage.setItem(PENDING_LINK_KEY, JSON.stringify(pending));
        await savePendingPaymentLink({
          type: 'membership',
          id: plan.parentSlug,
          paymentLinkId,
          url,
          expiresAt,
          confirmPayload: pending,
        });
      }

      const openResult = await openPaymentLink({
        url,
        useAuthSession: true,
        callbackUrl: serverCallbackUrl || 'paramsukh://payment-done',
        confirm: async () => {
          const res = await apiClient.post('/payments/membership-link/confirm', {
            paymentLinkId,
            plan: plan.parentSlug,
          });
          return { success: !!res.data?.success, data: res.data?.data, message: res.data?.message };
        },
      });

      if (paymentLinkId) {
        if (openResult.success && openResult.result?.data?.status === 'active') {
          await AsyncStorage.removeItem(PENDING_LINK_KEY);
          await clearPendingPaymentLinks('membership', plan.parentSlug, paymentLinkId);
        }
      }

      await fetchCurrentSubscription();
      if (openResult.success && openResult.result?.data?.status === 'active') {
        Alert.alert('Success', `${plan.name} membership is now active with ${selected.length} course(s).`);
        setSelectedCourses((prev) => ({ ...prev, [plan.id]: [] }));
      } else {
        Alert.alert('Payment', 'If you completed payment, your plan will activate shortly. Pull down to refresh.');
      }
    } catch (err: any) {
      Alert.alert('Payment Failed', err?.message || 'Could not complete payment.');
    } finally {
      purchasingRef.current = false;
      setPurchasingPlanId(null);
    }
  };

  const isPlanActive = (planId: string) => {
    const currentSelection = currentSubscription?.selectedPlan || currentSubscription?.plan;
    return currentSelection === planId && currentSubscription?.status === 'active';
  };

  return (
    <View className="flex-1 bg-gray-50">
      <Header />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="p-4">
          {/* Header */}
          <View className="items-center mb-6 py-4">
            <Text className="text-5xl mb-3">🙏</Text>
            <Text className="text-[28px] font-extrabold text-gray-900 mb-2">Namo Jinanam</Text>
            <Text className="text-[15px] text-gray-500 text-center leading-[22px] px-5">
              Pick your courses, then pay — only what you choose gets unlocked
            </Text>

            {isLoading ? (
              <ActivityIndicator size="small" color="#3B82F6" style={{ marginTop: 12 }} />
            ) : currentSubscription?.status === 'active' && (
              <View className="mt-3 bg-green-100 px-4 py-2 rounded-full flex-row items-center gap-2">
                <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                <Text className="text-green-700 font-semibold text-sm">
                  Active: {currentSubscription.selectedPlanLabel || currentSubscription.plan}
                </Text>
              </View>
            )}
          </View>

          {/* Special Features Banner */}
          <View className="bg-purple-100 rounded-2xl p-4 mb-5 border-2 border-purple-300">
            <View className="flex-row items-center gap-2 mb-2">
              <Ionicons name="gift" size={20} color="#8B5CF6" />
              <Text className="text-base font-bold text-purple-900">Membership Benefits</Text>
            </View>
            <Text className="text-sm text-purple-700 leading-5">
              • Group follow-up for all courses{'\n'}
              • Free membership counseling by support team{'\n'}
              • 1-on-1 counseling with Gurudev (₹999/-)
            </Text>
          </View>

          {/* Plan Cards with Course Selection */}
          {plansLoading ? (
            <View className="items-center py-12">
              <ActivityIndicator size="large" color="#8B5CF6" />
              <Text className="text-gray-500 mt-3 text-sm">Loading plans...</Text>
            </View>
          ) : plans.length === 0 && (
            <View className="bg-white rounded-2xl p-4 mb-4 border border-gray-200 flex-row items-center gap-2">
              <Ionicons name="information-circle-outline" size={18} color="#64748B" />
              <Text className="text-sm text-gray-600 flex-1">
                No membership plans are available right now.
              </Text>
            </View>
          )}

          {plans.map((plan) => {
            const isExpanded = expandedPlanId === plan.id;
            const displayPrice = getDisplayPrice(plan);
            const maxSelectable = plan.courseSelection?.maxSelectableCourses || 0;
            const hasCourseSelection = plan.courseSelection?.enabled && maxSelectable > 0;
            const courses = planCourses[plan.slug] || [];
            const selectedCount = getSelectedCount(plan.id);
            const isCoursesLoading = loadingCourses[plan.slug];

            return (
              <View key={plan.id} className="mb-4">
                {/* Plan Header - Touchable for expand/collapse */}
                <TouchableOpacity
                  activeOpacity={0.9}
                  onPress={() => togglePlan(plan.id, plan.slug)}
                  className={`rounded-[20px] p-5 shadow-lg ${isExpanded ? 'rounded-b-none' : ''}`}
                  style={{ backgroundColor: plan.gradient[0] }}
                >
                  <View className="flex-row justify-between items-center mb-4">
                    <View className="flex-row items-center gap-3">
                      <Text className="text-4xl">{plan.emoji}</Text>
                      <View>
                        <Text className="text-[22px] font-extrabold text-gray-900">{plan.name}</Text>
                        <Text className="text-xs text-gray-500 mt-0.5">{plan.tagline}</Text>
                      </View>
                    </View>
                    {isExpanded && (
                      <Ionicons name="chevron-up" size={22} color="colors.textSecondary" />
                    )}
                    {!isExpanded && hasCourseSelection && (
                      <View className="flex-row items-center gap-1">
                        <Text className="text-xs text-gray-500">Pick courses</Text>
                        <Ionicons name="chevron-down" size={22} color="colors.textSecondary" />
                      </View>
                    )}
                  </View>

                  <View className="mb-3">
                    <Text className="text-3xl font-black" style={{ color: plan.color }}>{displayPrice}</Text>
                    {hasCourseSelection && (
                      <Text className="text-sm text-gray-600 mt-1">
                        Select up to {maxSelectable} course{maxSelectable > 1 ? 's' : ''}
                      </Text>
                    )}
                  </View>

                  <View className="gap-2.5 mb-3">
                    {plan.features.slice(0, 4).map((feature, idx) => (
                      <View key={idx} className="flex-row items-center gap-2.5">
                        <View
                          className="w-5 h-5 rounded-full items-center justify-center"
                          style={{ backgroundColor: feature.included ? plan.color : 'colors.border' }}
                        >
                          <Ionicons
                            name={feature.included ? "checkmark" : "close"}
                            size={12} color="colors.surface"
                          />
                        </View>
                        <Text className={`text-sm flex-1 ${!feature.included ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                          {feature.text}
                        </Text>
                      </View>
                    ))}
                  </View>

                  {/* Purchase Button (outside expanded area) */}
                  {!hasCourseSelection ? (
                    <TouchableOpacity
                      className={`flex-row items-center justify-center gap-2 py-4 rounded-xl ${isPlanActive(plan.id) ? 'bg-green-500' : ''}`}
                      style={isPlanActive(plan.id) ? {} : { backgroundColor: plan.color }}
                      onPress={() => isPlanActive(plan.id) ? null : handlePurchase(plan)}
                      disabled={purchasingPlanId !== null || isPlanActive(plan.id)}
                    >
                      {purchasingPlanId === plan.id ? (
                        <ActivityIndicator color="colors.surface" />
                      ) : (
                        <Text className="text-base font-bold text-white">
                          {isPlanActive(plan.id) ? '✓ Active Plan' : 'Purchase Now'}
                        </Text>
                      )}
                    </TouchableOpacity>
                  ) : (
                    <TouchableOpacity
                      className="py-2 items-center"
                      onPress={() => togglePlan(plan.id, plan.slug)}
                    >
                      <Text className="text-sm font-semibold text-gray-600">
                        {isExpanded ? 'Hide courses ▲' : 'Pick your courses ▼'}
                      </Text>
                    </TouchableOpacity>
                  )}
                </TouchableOpacity>

                {/* Expanded Course Selection */}
                {isExpanded && hasCourseSelection && (
                  <View className="bg-white rounded-b-[20px] border-t border-gray-200 p-4 shadow-lg">
                    {/* Selection counter */}
                    <View className="flex-row items-center justify-between mb-3 px-2">
                      <Text className="text-sm font-semibold text-gray-700">
                        {selectedCount === 0
                          ? `Pick up to ${maxSelectable} courses`
                          : `Selected ${selectedCount}/${maxSelectable}`}
                      </Text>
                      {selectedCount > 0 && (
                        <TouchableOpacity onPress={() => setSelectedCourses((prev) => ({ ...prev, [plan.id]: [] }))}>
                          <Text className="text-xs text-red-500 font-medium">Clear</Text>
                        </TouchableOpacity>
                      )}
                    </View>

                    {isCoursesLoading ? (
                      <ActivityIndicator color="#8B5CF6" style={{ padding: 20 }} />
                    ) : courses.length === 0 ? (
                      <Text className="text-sm text-gray-400 text-center py-4">No courses available for this plan</Text>
                    ) : (
                      <View className="gap-3">
                        {courses.map((course) => {
                          const isSelected = (selectedCourses[plan.id] || []).includes(course._id);
                          const badge = getCategoryBadge(course.category);
                          return (
                            <TouchableOpacity
                              key={course._id}
                              onPress={() => toggleCourseSelection(plan.id, course._id, maxSelectable)}
                              activeOpacity={0.7}
                              className={`flex-row items-center p-3 rounded-xl border ${
                                isSelected ? 'border-purple-400 bg-purple-50' : 'border-gray-200 bg-gray-50'
                              }`}
                            >
                              <View
                                className="w-12 h-12 rounded-xl items-center justify-center mr-3"
                                style={{ backgroundColor: course.color || '#8B5CF6' }}
                              >
                                {course.thumbnailUrl ? (
                                  <Image source={{ uri: course.thumbnailUrl }} className="w-12 h-12 rounded-xl" />
                                ) : (
                                  <Ionicons name={(course.icon as any) || 'book-outline'} size={20} color="#FFF" />
                                )}
                              </View>
                              <View className="flex-1">
                                <Text className="text-sm font-semibold text-gray-900" numberOfLines={2}>
                                  {course.title}
                                </Text>
                                <View className="flex-row items-center gap-2 mt-1">
                                  {course.category && (
                                    <View className="px-2 py-0.5 rounded-md" style={{ backgroundColor: badge.bg }}>
                                      <Text className="text-[10px] font-semibold" style={{ color: badge.color }}>
                                        {course.category}
                                      </Text>
                                    </View>
                                  )}
                                  {(course.totalVideos || 0) > 0 && (
                                    <Text className="text-[10px] text-gray-400">
                                      {course.totalVideos} videos
                                    </Text>
                                  )}
                                </View>
                              </View>
                              <View className={`w-6 h-6 rounded-full border-2 items-center justify-center ml-2 ${
                                isSelected ? 'bg-purple-500 border-purple-500' : 'border-gray-300'
                              }`}>
                                {isSelected && <Ionicons name="checkmark" size={14} color="#FFF" />}
                              </View>
                            </TouchableOpacity>
                          );
                        })}
                      </View>
                    )}

                    {/* Purchase Button */}
                    <TouchableOpacity
                      className={`flex-row items-center justify-center gap-2 py-4 rounded-xl mt-4 ${
                        isPlanActive(plan.id) ? 'bg-green-500' : ''
                      } ${selectedCount === 0 ? 'opacity-40' : ''}`}
                      style={isPlanActive(plan.id) ? {} : { backgroundColor: plan.color }}
                      onPress={() => handlePurchase(plan)}
                      disabled={purchasingPlanId !== null || isPlanActive(plan.id) || selectedCount === 0}
                    >
                      {purchasingPlanId === plan.id ? (
                        <ActivityIndicator color="colors.surface" />
                      ) : (
                        <>
                          <Ionicons name="lock-open-outline" size={18} color="#FFF" />
                          <Text className="text-base font-bold text-white">
                            {isPlanActive(plan.id)
                              ? '✓ Active Plan'
                              : selectedCount === 0
                                ? 'Select courses to purchase'
                                : `Purchase (${selectedCount} course${selectedCount > 1 ? 's' : ''}) — ${displayPrice}`}
                          </Text>
                        </>
                      )}
                    </TouchableOpacity>
                  </View>
                )}
              </View>
            );
          })}

          {/* Counseling Info */}
          <View className="bg-white rounded-2xl p-5 mt-3 mb-4">
            <View className="flex-row items-center gap-2 mb-3">
              <Ionicons name="people" size={22} color="#3B82F6" />
              <Text className="text-lg font-bold text-gray-900">One-to-One Counseling</Text>
            </View>
            <View className="gap-2">
              <View className="flex-row items-start gap-2">
                <Text className="text-green-600 font-bold">✓</Text>
                <Text className="text-sm text-gray-700 flex-1">
                  <Text className="font-semibold">Membership Counseling</Text> - Free by support team
                </Text>
              </View>
              <View className="flex-row items-start gap-2">
                <Text className="text-purple-600 font-bold">⭐</Text>
                <Text className="text-sm text-gray-700 flex-1">
                  <Text className="font-semibold">Counseling with Gurudev</Text> - ₹999/-
                </Text>
              </View>
            </View>
          </View>

          <View className="h-10" />
        </View>
      </ScrollView>
    </View>
  );
}
