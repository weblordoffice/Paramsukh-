import React, { useEffect, useState, useRef } from 'react';
import { ScrollView, Text, TouchableOpacity, View, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import axios from 'axios';
import { API_URL } from '../../config/api';

import { getInitials } from '../../utils/userUtils';
import { hasActiveMembership } from '../../utils/membership';
import { useTheme } from '../../hooks/useTheme';

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
      route: '/edit-profile',
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
      route: '/my-progress',
    },
    {
      id: 'referral',
      title: 'Invite & Earn',
      description: 'Invite friends to earn free premium',
      icon: 'gift-outline',
      color: '#EC4899',
      route: '/referral',
    },
    {
      id: 'settings',
      title: 'Settings',
      description: 'App preferences and notifications',
      icon: 'settings-outline',
      color: '#F59E0B',
      route: '/settings',
    },
    ...(isPremiumMember ? [{
      id: 'downloads',
      title: 'Downloaded Videos',
      description: 'Watch saved premium videos offline',
      icon: 'download-outline',
      color: '#2563EB',
      route: '/downloads',
    }] : []),
    {
      id: 'help-support',
      title: 'Help & Support',
      description: 'Get help and contact us',
      icon: 'help-circle-outline',
      color: '#8B5CF6',
      route: '/help-support',
    },
    {
      id: 'terms-privacy',
      title: 'Terms & Privacy',
      description: 'Legal information',
      icon: 'document-text-outline',
      color: colors.textSecondary,
      route: '/terms-privacy',
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
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.surface }}>
        <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); }} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center' }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text }}>Profile</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-5">
          {/* Profile Header */}
          <View style={{ backgroundColor: colors.surface, borderRadius: 24, padding: 24, marginBottom: 20, alignItems: 'center', shadowColor: colors.border, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
            <View style={{ width: 96, height: 96, borderRadius: 48, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center', borderWidth: 4, borderColor: colors.primary, marginBottom: 12 }}>
              <Text style={{ fontSize: 36, fontWeight: '700', color: colors.primary }}>{getUserInitial()}</Text>
            </View>
            <Text style={{ fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 4 }}>{user?.displayName || 'User'}</Text>
            <Text style={{ fontSize: 14, color: colors.textSecondary }}>Spiritual Seeker</Text>

            <TouchableOpacity
              style={{ marginTop: 16, paddingHorizontal: 24, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}
              onPress={() => router.push('/(home)/edit-profile')}
            >
              <Text style={{ fontSize: 14, fontWeight: '600', color: colors.primary }}>Edit Profile</Text>
            </TouchableOpacity>
          </View>

          {/* Wellness Profile Card */}
          {loadingWellness ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, marginBottom: 20, alignItems: 'center', shadowColor: colors.border, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}>
              <ActivityIndicator size="small" color={colors.primary} />
              <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 8 }}>Loading wellness profile...</Text>
            </View>
          ) : wellness ? (
            <View style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 20, marginBottom: 20, shadowColor: colors.border, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2, borderWidth: 1, borderColor: colors.border }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>My Wellness Profile</Text>
                <View style={{ paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
                  <Text style={{ fontSize: 10, fontWeight: '700', color: colors.primary, letterSpacing: 1 }}>ASSESSED</Text>
                </View>
              </View>

              {/* Personal Info Row */}
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 16 }}>
                {wellness.age ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="person-outline" size={13} color={colors.textSecondary} />
                    <Text style={{ fontSize: 12, color: colors.text }}>{wellness.age} yrs</Text>
                  </View>
                ) : null}
                {wellness.occupation ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="briefcase-outline" size={13} color={colors.textSecondary} />
                    <Text style={{ fontSize: 12, color: colors.text }}>{wellness.occupation}</Text>
                  </View>
                ) : null}
                {wellness.location ? (
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                    <Ionicons name="location-outline" size={13} color={colors.textSecondary} />
                    <Text style={{ fontSize: 12, color: colors.text }}>{wellness.location}</Text>
                  </View>
                ) : null}
              </View>

              {/* Wellness Scales */}
              {(wellness.stressLevel != null || wellness.sleepQuality != null || wellness.energyLevel != null || wellness.moodRating != null) && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>Wellness Scales</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {wellness.stressLevel != null && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>Stress</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>{scaleLabel(wellness.stressLevel, 'Low', 'High')}</Text>
                      </View>
                    )}
                    {wellness.sleepQuality != null && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>Sleep</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#8B5CF6' }}>{scaleLabel(wellness.sleepQuality, 'Poor', 'Great')}</Text>
                      </View>
                    )}
                    {wellness.energyLevel != null && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>Energy</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#10B981' }}>{scaleLabel(wellness.energyLevel, 'Low', 'High')}</Text>
                      </View>
                    )}
                    {wellness.moodRating != null && (
                      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}>
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>Mood</Text>
                        <Text style={{ fontSize: 12, fontWeight: '700', color: '#3B82F6' }}>{scaleLabel(wellness.moodRating, 'Low', 'High')}</Text>
                      </View>
                    )}
                  </View>
                </View>
              )}

              {/* Wellness Goals */}
              {activeGoals.length > 0 && (
                <View>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', letterSpacing: 1, marginBottom: 8 }}>My Focus Areas</Text>
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
                    {activeGoals.map((goal: any, i: number) => (
                      <View
                        key={i}
                        style={{ flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: goal.color + '15', borderWidth: 1, borderColor: goal.color + '30' }}
                      >
                        <Ionicons name={goal.icon as any} size={12} color={goal.color} />
                        <Text style={{ fontSize: 12, fontWeight: '600', color: goal.color }}>{goal.label}</Text>
                      </View>
                    ))}
                  </View>
                </View>
              )}

              {activeGoals.length === 0 && !wellness.stressLevel && !wellness.age && !wellness.occupation && !wellness.location && (
                <View style={{ alignItems: 'center', paddingVertical: 12 }}>
                  <Text style={{ fontSize: 14, color: colors.textSecondary }}>No wellness profile completed yet</Text>
                  <TouchableOpacity
                    style={{ marginTop: 8, paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border }}
                    onPress={() => router.push('/(home)/edit-profile')}
                  >
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.primary }}>Complete Assessment</Text>
                  </TouchableOpacity>
                </View>
              )}
            </View>
          ) : null}

          {/* Menu Items */}
          <View style={{ gap: 12, marginBottom: 20 }}>
            {menuItems.map((item) => (
              <TouchableOpacity
                key={item.id}
                style={{ backgroundColor: colors.surface, borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', gap: 12, shadowColor: colors.border, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 }}
                onPress={() => router.push(item.route as any)}
              >
                <View
                  style={{ width: 48, height: 48, borderRadius: 16, alignItems: 'center', justifyContent: 'center', backgroundColor: item.color + '15' }}
                >
                  <Ionicons name={item.icon as any} size={24} color={item.color} />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 16, fontWeight: '700', color: colors.text }}>{item.title}</Text>
                  <Text style={{ fontSize: 12, color: colors.textSecondary, marginTop: 2 }}>{item.description}</Text>
                </View>
                <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            ))}
          </View>

          {/* Sign Out Button */}
          <TouchableOpacity
            style={{ backgroundColor: colors.danger + '12', borderRadius: 16, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, borderWidth: 2, borderColor: colors.danger + '30' }}
            onPress={handleSignOut}
          >
            <Ionicons name="log-out-outline" size={22} color={colors.danger} />
            <Text style={{ fontSize: 16, fontWeight: '700', color: colors.danger }}>Sign Out</Text>
          </TouchableOpacity>

          <View className="h-10" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
