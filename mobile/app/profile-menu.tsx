import React, { useEffect, useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';

import { getInitials } from '../utils/userUtils';
import { hasActiveMembership } from '../utils/membership';

export default function ProfileMenuScreen() {
  const router = useRouter();
  const { user: authUser, logout, fetchCurrentUser } = useAuthStore();
  const [user, setUser] = useState(authUser);

  useEffect(() => {
    const loadUser = async () => {
      const result = await fetchCurrentUser();
      if (result.success && result.user) {
        setUser(result.user);
      }
    };
    loadUser();
  }, []);

  const getUserInitial = () => {
    return getInitials(user?.displayName);
  };

  const isPremiumMember = hasActiveMembership(user);

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
      id: 'my-progress',
      title: 'My Progress',
      description: 'View achievements and stats',
      icon: 'trophy-outline',
      color: '#10B981',
      route: '/(home)/my-progress',
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
      color: '#6B7280',
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
        <TouchableOpacity onPress={() => router.back()} className="w-10">
          <Ionicons name="arrow-back" size={24} color="#111827" />
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
                <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
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
