import React, { useState, useEffect, useCallback } from 'react';
import { ScrollView, Text, TouchableOpacity, View, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import Header from '../../components/Header';
import { useMembershipStore } from '../../store/membershipStore';

import apiClient from '../../utils/apiClient';
import { fetchPublicMembershipPlans, UIMembershipPlan } from '../../utils/membershipPlans';

const PENDING_LINK_KEY = 'pending_membership_payment_link';

export default function MembershipScreen() {

  const { currentSubscription, isLoading, fetchCurrentSubscription, clearError } = useMembershipStore();

  const [selectedPlan, setSelectedPlan] = useState('');
  const [purchasingPlanId, setPurchasingPlanId] = useState<string | null>(null);
  const [plans, setPlans] = useState<UIMembershipPlan[]>([]);

  const loadPublicPlans = useCallback(async () => {
    const dynamicPlans = await fetchPublicMembershipPlans({ includeVariants: true });
    setPlans(dynamicPlans);
    if (dynamicPlans.length > 0) {
      setSelectedPlan(dynamicPlans[0].id);
    }
  }, []);

  useEffect(() => {
    fetchCurrentSubscription();
    loadPublicPlans();
  }, [fetchCurrentSubscription, loadPublicPlans]);

  // If user paid and came back later (or app was closed), confirm any pending payment link
  useEffect(() => {
    if (!currentSubscription || currentSubscription.status === 'active') return;
    let cancelled = false;
    (async () => {
      try {
        const raw = await AsyncStorage.getItem(PENDING_LINK_KEY);
        if (!raw || cancelled) return;
        const { paymentLinkId, plan, variantSlug: pendingVariantSlug } = JSON.parse(raw);
        if (!paymentLinkId || !plan) return;
        const res = await apiClient.post('/payments/membership-link/confirm', {
          paymentLinkId,
          plan,
          variantSlug: pendingVariantSlug || null,
        });
        if (res.data?.success && res.data?.data?.status === 'active') {
          await AsyncStorage.removeItem(PENDING_LINK_KEY);
          await fetchCurrentSubscription();
        }
      } catch {
        // ignore
      }
    })();
    return () => { cancelled = true; };
  }, [currentSubscription, fetchCurrentSubscription]);

  const getDisplayPrice = (plan: UIMembershipPlan) => `₹${plan.price.toLocaleString('en-IN')}`;

  const handlePurchase = async (plan: UIMembershipPlan) => {
    const currentSelection = currentSubscription?.selectedPlan || currentSubscription?.plan;
    if (currentSelection === plan.id && currentSubscription?.status === 'active') {
      Alert.alert('Already Subscribed', `You already have the ${plan.name} plan!`);
      return;
    }

    setPurchasingPlanId(plan.id);
    clearError();

    try {
      // Create Razorpay hosted checkout URL from backend
      const linkRes = await apiClient.post('/payments/membership-link', {
        plan: plan.parentSlug,
        variantSlug: plan.variantSlug || null,
        amount: plan.price
      });

      if (!linkRes.data?.success || !linkRes.data?.data?.url) {
        Alert.alert('Error', linkRes.data?.message || 'Failed to create payment link.');
        setPurchasingPlanId(null);
        return;
      }

      const url = linkRes.data.data.url as string;
      const paymentLinkId = linkRes.data.data.paymentLinkId as string | undefined;

      if (paymentLinkId) {
        await AsyncStorage.setItem(PENDING_LINK_KEY, JSON.stringify({
          paymentLinkId,
          plan: plan.parentSlug,
          variantSlug: plan.variantSlug || null,
        }));
      }

      // Open Razorpay payment page (hosted checkout)
      await WebBrowser.openBrowserAsync(url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        enableBarCollapsing: true,
        showTitle: true,
      });

      let activated = false;
      if (paymentLinkId) {
        const confirmRes = await apiClient.post('/payments/membership-link/confirm', {
          paymentLinkId,
          plan: plan.parentSlug,
          variantSlug: plan.variantSlug || null,
        });
        if (confirmRes.data?.success) {
          await AsyncStorage.removeItem(PENDING_LINK_KEY);
          activated = confirmRes.data?.data?.status === 'active';
        }
      }

      await fetchCurrentSubscription();
      Alert.alert(
        'Payment',
        activated
          ? `${plan.name} membership is now active. You can access your courses.`
          : 'If you completed payment, your plan will activate shortly. Pull down to refresh or reopen this screen.'
      );
    } catch (err: any) {
      console.error('Membership payment error:', err);
      Alert.alert('Payment Failed', err?.description || err?.message || 'Could not complete payment. Please try again.');
    } finally {
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
              Choose your membership tier and unlock your spiritual potential
            </Text>

            {/* Current Subscription Badge */}
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
          <View className="bg-gradient-to-r from-purple-500 to-pink-500 bg-purple-100 rounded-2xl p-4 mb-5 border-2 border-purple-300">
            <View className="flex-row items-center gap-2 mb-2">
              <Ionicons name="gift" size={20} color="#8B5CF6" />
              <Text className="text-base font-bold text-purple-900">Membership Benefits</Text>
            </View>
            <Text className="text-sm text-purple-700 leading-5">
              • Group follow-up for all courses{'\n'}
              • Free membership counseling by support team{'\n'}
              • 1-on-1 counseling with Gurudev (₹999/-){'\n'}
              • 10 bonus points per achievement{'\n'}
              • Rewards & gifts for bonus points
            </Text>
          </View>

          {/* Plan Cards */}
          {plans.length === 0 && (
            <View className="bg-white rounded-2xl p-4 mb-4 border border-gray-200 flex-row items-center gap-2">
              <Ionicons name="information-circle-outline" size={18} color="#64748B" />
              <Text className="text-sm text-gray-600 flex-1">
                No membership plans are available right now. Please check again later.
              </Text>
            </View>
          )}

          {plans.map((plan) => {
            const isSelected = selectedPlan === plan.id;
            const displayPrice = getDisplayPrice(plan);

            return (
              <TouchableOpacity
                key={plan.id}
                activeOpacity={0.9}
                onPress={() => setSelectedPlan(plan.id)}
                className={`rounded-[20px] p-5 mb-4 shadow-lg relative ${isSelected ? 'border-[3px] scale-[1.02]' : ''
                  }`}
                style={{
                  backgroundColor: plan.gradient[0],
                  borderColor: isSelected ? plan.color : undefined,
                }}
              >
                {/* Popular Badge */}
                {plan.popular && (
                  <View
                    className="absolute top-4 right-4 flex-row items-center gap-1 px-2.5 py-1.5 rounded-[20px]"
                    style={{ backgroundColor: plan.color }}
                  >
                    <Ionicons name="star" size={12} color="#FFFFFF" />
                    <Text className="text-white text-[10px] font-extrabold tracking-wider">RECOMMENDED</Text>
                  </View>
                )}

                {/* Plan Header */}
                <View className="flex-row justify-between items-center mb-4">
                  <View className="flex-row items-center gap-3">
                    <Text className="text-4xl">{plan.emoji}</Text>
                    <View>
                      <Text className="text-[22px] font-extrabold text-gray-900">{plan.name}</Text>
                      <Text className="text-xs text-gray-500 mt-0.5">{plan.tagline}</Text>
                    </View>
                  </View>
                  {isSelected && (
                    <View
                      className="w-8 h-8 rounded-full items-center justify-center"
                      style={{ backgroundColor: plan.color }}
                    >
                      <Ionicons name="checkmark" size={18} color="#FFFFFF" />
                    </View>
                  )}
                </View>

                {/* Price */}
                <View className="mb-5">
                  <Text className="text-3xl font-black" style={{ color: plan.color }}>{displayPrice}</Text>
                </View>

                {/* Features */}
                <View className="gap-2.5 mb-5">
                  {plan.features.map((feature, idx) => (
                    <View key={idx} className="flex-row items-center gap-2.5">
                      <View
                        className="w-5 h-5 rounded-full items-center justify-center"
                        style={{ backgroundColor: feature.included ? plan.color : '#E5E7EB' }}
                      >
                        <Ionicons
                          name={feature.included ? "checkmark" : "close"}
                          size={12}
                          color="#FFFFFF"
                        />
                      </View>
                      <Text className={`text-sm flex-1 ${!feature.included ? 'text-gray-400 line-through' : 'text-gray-700'}`}>
                        {feature.text}
                      </Text>
                    </View>
                  ))}
                </View>

                {/* Action Button */}
                <TouchableOpacity
                  className={`flex-row items-center justify-center gap-2 py-4 rounded-xl ${isPlanActive(plan.id) ? 'bg-green-500' : isSelected ? '' : 'bg-white border-2'
                    }`}
                  style={isPlanActive(plan.id) ? {} : isSelected ? { backgroundColor: plan.color } : { borderColor: plan.color }}
                  onPress={() => isPlanActive(plan.id) ? null : handlePurchase(plan)}
                  disabled={purchasingPlanId !== null || isPlanActive(plan.id)}
                >
                  {purchasingPlanId === plan.id ? (
                    <ActivityIndicator color="#FFFFFF" />
                  ) : (
                    <>
                      <Text
                        className="text-base font-bold"
                        style={{ color: isPlanActive(plan.id) ? '#FFFFFF' : isSelected ? '#FFFFFF' : plan.color }}
                      >
                        {isPlanActive(plan.id)
                          ? '✓ Active Plan'
                          : isSelected
                            ? 'Purchase Now'
                            : 'Select Plan'}
                      </Text>
                      {isSelected && !isPlanActive(plan.id) && (
                        <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
                      )}
                    </>
                  )}
                </TouchableOpacity>
              </TouchableOpacity>
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
                <Text className="text-green-600 font-bold">✓</Text>
                <Text className="text-sm text-gray-700 flex-1">
                  <Text className="font-semibold">Physical/Financial/Relationship Wellness</Text> - As required
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

          {/* Benefits Section */}
          <View className="bg-white rounded-2xl p-5 mt-3">
            <Text className="text-lg font-bold text-gray-900 mb-4 text-center">All Memberships Include</Text>
            <View className="flex-row flex-wrap gap-4">
              <View className="w-[47%] items-center gap-2 p-3 bg-gray-50 rounded-xl">
                <Ionicons name="trophy" size={24} color="#F59E0B" />
                <Text className="text-xs font-semibold text-gray-500 text-center">Bonus Points System</Text>
              </View>
              <View className="w-[47%] items-center gap-2 p-3 bg-gray-50 rounded-xl">
                <Ionicons name="gift" size={24} color="#EC4899" />
                <Text className="text-xs font-semibold text-gray-500 text-center">Rewards & Gifts</Text>
              </View>
              <View className="w-[47%] items-center gap-2 p-3 bg-gray-50 rounded-xl">
                <Ionicons name="people" size={24} color="#3B82F6" />
                <Text className="text-xs font-semibold text-gray-500 text-center">Group Follow-up</Text>
              </View>
              <View className="w-[47%] items-center gap-2 p-3 bg-gray-50 rounded-xl">
                <Ionicons name="chatbubbles" size={24} color="#10B981" />
                <Text className="text-xs font-semibold text-gray-500 text-center">Free Counseling</Text>
              </View>
            </View>
          </View>

          <View className="h-10" />
        </View>
      </ScrollView>
    </View>
  );
}
