import React, { useCallback } from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { useNotificationStore } from '../store/notificationStore';
import { getInitials } from '../utils/userUtils';
import * as Haptics from 'expo-haptics';

interface HeaderProps {
  useSafeArea?: boolean;
}

export default function Header({ useSafeArea = false }: HeaderProps) {
  const router = useRouter();
  const segments = useSegments();
  const { user, token } = useAuthStore();
  const { unreadCount, fetchUnreadCount } = useNotificationStore();
  
  // Get the current tab name from segments
  const currentTab = segments[segments.length - 1];
  
  // Map route names to display names
  const getTabTitle = () => {
    switch (currentTab) {
      case 'courses':
        return 'Courses';
      case 'events':
        return 'Events';
      case 'my-membership':
        return 'Membership';
      case 'menu':
        return 'Home';
      case 'community':
        return 'Community';
      case 'notifications':
        return 'Notifications';
      default:
        return 'Home';
    }
  };

  // Get user's initials
  const getUserInitial = () => {
    return getInitials(user?.displayName);
  };

  const navigateToProfile = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/profile-menu');
  };

  const navigateToNotifications = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/(home)/notifications');
  };

  useFocusEffect(
    useCallback(() => {
      if (!token) return;
      fetchUnreadCount();
    }, [token, fetchUnreadCount])
  );

  const badgeCount = unreadCount > 99 ? '99+' : String(unreadCount);

  return (
    <View style={[styles.container, { paddingTop: Platform.OS === 'ios' ? (useSafeArea ? 10 : 50) : (useSafeArea ? 16 : 40) }]}>
      <View style={styles.content}>
        <View>
          <Text style={styles.title}>{getTabTitle()}</Text>
        </View>
        
        <View style={styles.actions}>
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={navigateToNotifications}
            activeOpacity={0.7}
          >
            <View style={styles.notificationContainer}>
              <Ionicons name="notifications-outline" size={24} color="#2C2420" />
              {unreadCount > 0 && (
                <View style={styles.badge}>
                  <Text style={styles.badgeText}>{badgeCount}</Text>
                </View>
              )}
            </View>
          </TouchableOpacity>
                                   
          <TouchableOpacity 
            style={styles.iconButton}
            onPress={navigateToProfile}
            activeOpacity={0.7}
          >
            <View style={styles.profileContainer}>
              <Text style={styles.profileInitial}>{getUserInitial()}</Text>
            </View>
          </TouchableOpacity>
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    backgroundColor: 'transparent',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(44, 36, 32, 0.06)',
    paddingHorizontal: 20,
    paddingBottom: 16,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '800',
    color: '#2C2420',
    letterSpacing: 0.5,
  },
  actions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  iconButton: {
    padding: 4,
  },
  notificationContainer: {
    position: 'relative',
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(44, 36, 32, 0.05)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(44, 36, 32, 0.1)',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#F1842D',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    shadowColor: '#F1842D',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.3,
    shadowRadius: 6,
    elevation: 3,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  profileContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(241, 132, 45, 0.08)',
    borderWidth: 1,
    borderColor: 'rgba(241, 132, 45, 0.25)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  profileInitial: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F1842D',
  },
});
