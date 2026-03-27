import React from 'react';
import { View, Text, TouchableOpacity, Platform, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useSegments } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import { getInitials } from '../utils/userUtils';
import * as Haptics from 'expo-haptics';

interface HeaderProps {
  useSafeArea?: boolean;
}

export default function Header({ useSafeArea = false }: HeaderProps) {
  const router = useRouter();
  const segments = useSegments();
  const { user } = useAuthStore();
  
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
              <Ionicons name="notifications-outline" size={24} color="#F8FAFC" />
              <View style={styles.badge}>
                <Text style={styles.badgeText}>3</Text>
              </View>
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
    backgroundColor: 'rgba(15, 23, 42, 0.95)',
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(148, 163, 184, 0.15)',
    paddingHorizontal: 20,
    paddingBottom: 16,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
  },
  content: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    fontSize: 28,
    fontWeight: '700',
    color: '#F8FAFC',
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
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
  },
  badge: {
    position: 'absolute',
    top: 8,
    right: 8,
    backgroundColor: '#EAB308',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
    shadowColor: '#EAB308',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.5,
    shadowRadius: 8,
    elevation: 4,
  },
  badgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#0F172A',
  },
  profileContainer: {
    width: 48,
    height: 48,
    borderRadius: 24,
    backgroundColor: 'rgba(59, 130, 246, 0.2)',
    borderWidth: 2,
    borderColor: '#3B82F6',
    alignItems: 'center',
    justifyContent: 'center',
    shadowColor: '#3B82F6',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  profileInitial: {
    fontSize: 20,
    fontWeight: '700',
    color: '#3B82F6',
  },
});
