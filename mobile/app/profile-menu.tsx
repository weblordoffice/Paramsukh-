import React, { useEffect, useState, useRef } from 'react';
import { ScrollView, Text, TouchableOpacity, View, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import axios from 'axios';
import { API_URL } from '../config/api';

import { getInitials } from '../utils/userUtils';
import { hasActiveMembership } from '../utils/membership';
import { useTheme } from '../hooks/useTheme';

interface WellnessProfile {
  age?: number;
  occupation?: string;
  location?: string;
  stressLevel?: number;
  sleepQuality?: number;
  energyLevel?: number;
  moodRating?: number;
  physicalActivityLevel?: string;
  physicalIssue?: boolean;
  specialDiseaseIssue?: boolean;
  relationshipIssue?: boolean;
  financialIssue?: boolean;
  mentalHealthIssue?: boolean;
  spiritualGrowth?: boolean;
}

export default function ProfileMenuScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const { user: authUser, logout, fetchCurrentUser } = useAuthStore();
  const [user, setUser] = useState(authUser);
  const [wellness, setWellness] = useState<WellnessProfile | null>(null);
  const [loadingWellness, setLoadingWellness] = useState(true);
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    const loadUser = async () => {
      const result = await fetchCurrentUser();
      if (!isMountedRef.current) return;
      if (result.success && result.user) {
        setUser(result.user);
      }
    };
    loadUser();

    // Fetch wellness profile
    const loadWellness = async () => {
      try {
        const token = await useAuthStore.getState().token;
        const res = await axios.get(`${API_URL}/user/profile`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined,
        });
        if (res.data?.profileDetails) {
          setWellness(res.data.profileDetails as WellnessProfile);
        }
      } catch (err) {
        console.warn('Failed to load wellness profile:', err);
      } finally {
        if (isMountedRef.current) setLoadingWellness(false);
      }
    };
    loadWellness();

    return () => {
      isMountedRef.current = false;
    };
  }, []);

  const getUserInitial = () => {
    return getInitials(user?.displayName);
  };

  const isPremiumMember = hasActiveMembership(user);

  const wellnessGoals = wellness ? [
    wellness.physicalIssue && { label: 'Physical Wellness', icon: 'fitness-outline', color: '#10B981' },
    wellness.specialDiseaseIssue && { label: 'Chronic Illness', icon: 'medical-outline', color: '#EF4444' },
    wellness.relationshipIssue && { label: 'Relationships', icon: 'heart-outline', color: '#EC4899' },
    wellness.financialIssue && { label: 'Financial Freedom', icon: 'cash-outline', color: '#22C55E' },
    wellness.mentalHealthIssue && { label: 'Mental Clarity', icon: 'brain-outline', color: '#6366F1' },
    wellness.spiritualGrowth && { label: 'Spiritual Growth', icon: 'rose-outline', color: '#F59E0B' },
  ].filter(Boolean) : [];

  const scaleLabel = (value?: number, low = 'Low', high = 'High') => {
    if (value == null) return '—';
    if (value <= 3) return `${value}/10 · ${low}`;
    if (value <= 6) return `${value}/10 · Moderate`;
    return `${value}/10 · ${high}`;
  };

  const activeGoals = wellnessGoals.filter(Boolean);

  const menuItems = [
    {
      id: 'edit-profile',
      title: 'Edit Profile',
      description: 'Update your personal information',
      icon: 'person-outline',
      color: '#3B82F6',
      route: '/(home)/edit-profile',
    },
    {
      id: 'my-orders',
      title: 'My Orders',
      description: 'Track your orders and purchases',
      icon: 'receipt-outline',
      color: '#6366F1',
      route: '/orders',
    },
    {
      id: 'my-progress',
      title: 'My Progress',
      description: 'View achievements and stats',
      icon: 'trophy-outline',
      color: '#10B981',
      route: '/(home)/my-progress',
    },
    {
      id: 'referral',
      title: 'Invite & Earn',
      description: 'Invite friends to earn free premium',
      icon: 'gift-outline',
      color: '#EC4899',
      route: '/(home)/referral',
    },
    {
      id: 'settings',
      title: 'Settings',
      description: 'App preferences and notifications',
      icon: 'settings-outline',
      color: '#F59E0B',
      route: '/(home)/settings',
    },
    ...(isPremiumMember ? [{
      id: 'downloads',
      title: 'Downloaded Videos',
      description: 'Watch saved premium videos offline',
      icon: 'download-outline',
      color: '#2563EB',
      route: '/(home)/downloads',
    }] : []),
    {
      id: 'help-support',
      title: 'Help & Support',
      description: 'Get help and contact us',
      icon: 'help-circle-outline',
      color: '#8B5CF6',
      route: '/(home)/help-support',
    },
    {
      id: 'terms-privacy',
      title: 'Terms & Privacy',
      description: 'Legal information',
      icon: 'document-text-outline',
      color: colors.textSecondary,
      route: '/(home)/terms-privacy',
    },
  ];

  const handleSignOut = () => {
    Alert.alert(
      'Sign Out',
      'Are you sure you want to sign out?',
      [
        {
          text: 'Cancel',
          style: 'cancel'
        },
        {
          text: 'Sign Out',
          style: 'destructive',
          onPress: async () => {
            try {
              // Clear local storage and state (this now calls backend internally)
              await logout();

              // Navigate to signin
              router.replace('/signin');
            } catch (error: any) {
              const errorMsg = error.response?.data?.message || 'Failed to sign out from server. Please check your connection and try again.';
              Alert.alert('Sign Out Failed', errorMsg);
            }
          }
        }
      ]
    );
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
        <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); }} className="w-10">
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Profile</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-5">
          {/* Profile Header */}
          <View className="bg-white rounded-3xl p-6 mb-5 items-center shadow-sm">
            <View className="w-24 h-24 rounded-full bg-blue-50 items-center justify-center border-4 border-blue-500 mb-3">
              <Text className="text-4xl font-bold text-blue-500">{getUserInitial()}</Text>
            </View>
            <Text className="text-xl font-bold text-gray-900 mb-1">{user?.displayName || 'User'}</Text>
            <Text className="text-sm text-gray-500">Spiritual Seeker</Text>

            <TouchableOpacity
              className="mt-4 px-6 py-2 rounded-xl bg-blue-50 border border-blue-200"
              onPress={() => router.push('/(home)/edit-profile')}
            >
              <Text className="text-sm font-semibold text-blue-600">Edit Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Wellness Profile Card */}
          {loadingWellness ? (
            <View className="bg-white rounded-2xl p-5 mb-5 items-center shadow-sm">
              <ActivityIndicator size="small" color="#F1842D" />
              <Text className="text-xs text-gray-400 mt-2">Loading wellness profile...</Text>
            </View>
          ) : wellness ? (
            <View className="bg-white rounded-2xl p-5 mb-5 shadow-sm border border-gray-100">
              <View className="flex-row items-center justify-between mb-4">
                <Text className="text-base font-bold text-gray-900">My Wellness Profile</Text>
                <View className="px-2.5 py-1 rounded-full bg-orange-50 border border-orange-100">
                  <Text className="text-[10px] font-bold text-orange-600 tracking-wider">ASSESSED</Text>
                </View>
              </View>

              {/* Personal Info Row */}
              <View className="flex-row flex-wrap gap-x-4 gap-y-2 mb-4">
                {wellness.age ? (
                  <View className="flex-row items-center gap-1.5">
                    <Ionicons name="person-outline" size={13} color="#8C7B73" />
                    <Text className="text-xs text-gray-600">{wellness.age} yrs</Text>
                  </View>
                ) : null}
                {wellness.occupation ? (
                  <View className="flex-row items-center gap-1.5">
                    <Ionicons name="briefcase-outline" size={13} color="#8C7B73" />
                    <Text className="text-xs text-gray-600">{wellness.occupation}</Text>
                  </View>
                ) : null}
                {wellness.location ? (
                  <View className="flex-row items-center gap-1.5">
                    <Ionicons name="location-outline" size={13} color="#8C7B73" />
                    <Text className="text-xs text-gray-600">{wellness.location}</Text>
                  </View>
                ) : null}
              </View>

              {/* Wellness Scales */}
              {(wellness.stressLevel != null || wellness.sleepQuality != null || wellness.energyLevel != null || wellness.moodRating != null) && (
                <View className="mb-4">
                  <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">Wellness Scales</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {wellness.stressLevel != null && (
                      <View className="flex-row items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                        <Text className="text-xs text-gray-500">Stress</Text>
                        <Text className="text-xs font-bold text-orange-600">{scaleLabel(wellness.stressLevel, 'Low', 'High')}</Text>
                      </View>
                    )}
                    {wellness.sleepQuality != null && (
                      <View className="flex-row items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                        <Text className="text-xs text-gray-500">Sleep</Text>
                        <Text className="text-xs font-bold text-indigo-600">{scaleLabel(wellness.sleepQuality, 'Poor', 'Great')}</Text>
                      </View>
                    )}
                    {wellness.energyLevel != null && (
                      <View className="flex-row items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                        <Text className="text-xs text-gray-500">Energy</Text>
                        <Text className="text-xs font-bold text-green-600">{scaleLabel(wellness.energyLevel, 'Low', 'High')}</Text>
                      </View>
                    )}
                    {wellness.moodRating != null && (
                      <View className="flex-row items-center gap-1.5 bg-gray-50 px-3 py-1.5 rounded-xl border border-gray-100">
                        <Text className="text-xs text-gray-500">Mood</Text>
                        <Text className="text-xs font-bold text-blue-600">{scaleLabel(wellness.moodRating, 'Low', 'High')}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Wellness Goals */}
              {activeGoals.length > 0 && (
                <View>
                  <Text className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">My Focus Areas</Text>
                  <View className="flex-row flex-wrap gap-2">
                    {activeGoals.map((goal: any, i: number) => (
                      <View
                        key={i}
                        className="flex-row items-center gap-1.5 px-3 py-1.5 rounded-full"
                        style={{ backgroundColor: goal.color + '15', borderWidth: 1, borderColor: goal.color + '30' }}
                      >
                        <Ionicons name={goal.icon as any} size={12} color={goal.color} />
                        <Text className="text-xs font-semibold" style={{ color: goal.color }}>{goal.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {activeGoals.length === 0 && !wellness.stressLevel && !wellness.age && !wellness.occupation && !wellness.location && (
                <View className="items-center py-3">
                  <Text className="text-sm text-gray-400">No wellness profile completed yet</Text>
                  <TouchableOpacity
                    className="mt-2 px-4 py-2 rounded-xl bg-orange-50 border border-orange-100"
                    onPress={() => router.push('/(home)/edit-profile')}
                  >
                    <Text className="text-xs font-bold text-orange-600">Complete Assessment</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : null}

          {/* Menu Items */}
          <View className="gap-3 mb-5">
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                className="bg-white rounded-2xl p-4 flex-row items-center gap-3 shadow-sm"
                onPress={() => router.push(item.route as any)}
              >
                <View
                  className="w-12 h-12 rounded-xl items-center justify-center"
                  style={{ backgroundColor: item.color + '15' }}
                >
                  <Ionicons name={item.icon as any} size={24} style={{ color: item.color }} />
                </View>
                <View className="flex-1">
                  <Text className="text-base font-bold text-gray-900">{item.title}</Text>
                  <Text className="text-xs text-gray-500 mt-0.5">{item.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Sign Out Button */}
          <TouchableOpacity
            className="bg-red-50 rounded-2xl p-4 flex-row items-center justify-center gap-2 border-2 border-red-200"
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={22} color="#EF4444" />
            <Text className="text-base font-bold text-red-500">Sign Out</Text>
          </TouchableOpacity>

          <View className="h-10" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
