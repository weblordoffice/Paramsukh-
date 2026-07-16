import React, { useState, useEffect, useRef } from 'react';
import {
  View,   
  Text,
  ScrollView,   
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuthStore } from '../../store/authStore';
import CertificateViewerModal from '../../components/CertificateViewerModal';

export default function MyProgressScreen() {
  const router = useRouter();          
  const { token, user: authUser } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [user, setUser] = useState(authUser);
  const [stats, setStats] = useState({
    totalEnrollments: 0,
    completedCourses: 0,
    inProgressCourses: 0,
    eventRegistrations: 0,
    eventsAttended: 0,
    loginCount: 0,
    memberSince: null
  });
  const [certificates, setCertificates] = useState([]);
  const [selectedCert, setSelectedCert] = useState<any>(null);
  const [certModalVisible, setCertModalVisible] = useState(false);
  const isMountedRef = useRef(true);

  const loadData = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const [statsRes, profileRes, certsRes] = await Promise.all([
        axios.get(`${API_URL}/user/stats`, { headers }),
        axios.get(`${API_URL}/user/profile`, { headers }),
        axios.get(`${API_URL}/user/profile/certificates`, { headers })
      ]);

      if (!isMountedRef.current) return;

      if (statsRes.data.success && statsRes.data.stats) {
        setStats(statsRes.data.stats);
      }
      if (profileRes.data.success && profileRes.data.user) {
        setUser(profileRes.data.user);
      }
      if (certsRes.data.success && certsRes.data.certificates) {
        setCertificates(certsRes.data.certificates);
      }
    } catch (error) {
      console.error('❌ Failed to load progress details:', error);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    loadData();
    return () => {
      isMountedRef.current = false;
    };
  }, [token]);

  const displayStats = [      
    { label: 'Courses Enrolled', value: stats.totalEnrollments.toString(), icon: 'book-outline', color: '#8B5CF6' },
    { label: 'Courses Completed', value: stats.completedCourses.toString(), icon: 'checkmark-circle-outline', color: '#3B82F6' },
    { label: 'Events Registered', value: stats.eventRegistrations.toString(), icon: 'calendar-outline', color: '#10B981' },
    { label: 'Events Attended', value: stats.eventsAttended.toString(), icon: 'ticket-outline', color: '#EF4444' },
  ];    

  const isBadgeUnlocked = (badgeId: string) => {
    return user?.unlockedBadges?.some((b: any) => b.badgeId === badgeId) || false;
  };

  const achievements = [
    { id: 'first-step', title: 'First Step', description: 'Enrolled in your first course', icon: '🎯', requirement: 'Enroll in 1 course' },
    { id: 'knowledge-seeker', title: 'Knowledge Seeker', description: 'Completed a course', icon: '📚', requirement: 'Complete 1 course' },
    { id: 'event-enthusiast', title: 'Event Enthusiast', description: 'Registered for an event', icon: '🎪', requirement: 'Register for 1 event' },
    { id: 'dedicated-learner', title: 'Dedicated Learner', description: 'Completed 5 courses', icon: '🏆', requirement: 'Complete 5 courses' },
    { id: 'active-member', title: 'Active Member', description: 'Logged in 10 times', icon: '🔥', requirement: 'Log in 10 times' },
    { id: 'community-pillar', title: 'Community Pillar', description: 'Attended 5 events', icon: '👥', requirement: 'Attend 5 events' },
  ];

  const handleBadgePress = (badge: typeof achievements[0]) => {
    const unlocked = isBadgeUnlocked(badge.id);
    if (unlocked) {
      const match = user.unlockedBadges.find((b: any) => b.badgeId === badge.id);
      const unlockDate = match?.unlockedAt 
        ? new Date(match.unlockedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : 'recently';
      Alert.alert(
        `🏆 ${badge.title} Unlocked!`,
        `${badge.description}\n\nUnlocked: ${unlockDate}`
      );
    } else {
      Alert.alert(
        `🔒 Locked Badge`,
        `How to unlock: ${badge.requirement}`
      );
    }
  };

  const handleViewCert = (cert: any) => {
    setSelectedCert(cert);
    setCertModalVisible(true);
  };

  const completionRate = stats.totalEnrollments > 0 
    ? Math.round((stats.completedCourses / stats.totalEnrollments) * 100)
    : 0;

  const joinDate = stats.memberSince 
    ? new Date(stats.memberSince).toLocaleDateString('en-IN', { month: 'long', year: 'numeric' })
    : 'Recently';

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
        <TouchableOpacity className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center" onPress={() => router.push('/(home)/menu')}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">My Progress</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-5">
        {loading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        ) : (
          <>
            {/* Overview Visual Card */}
            <View className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm flex-row items-center justify-between mb-6">
              <View className="flex-1 pr-4">
                <Text className="text-xs text-gray-400 font-bold uppercase tracking-wider">Gurukul Disciple Since</Text>
                <Text className="text-lg font-bold text-gray-800 mt-1">{joinDate}</Text>
                <Text className="text-sm text-gray-500 mt-1">Logged in {stats.loginCount} times to study</Text>
              </View>
              <View style={styles.circularContainer}>
                <View style={[styles.circularFill, { transform: [{ rotate: `${(completionRate / 100) * 360}deg` }] }]} />
                <View style={styles.circularInner}>
                  <Text className="text-xl font-extrabold text-blue-500">{completionRate}%</Text>
                  <Text className="text-[10px] text-gray-400 font-bold">Done</Text>
                </View>
              </View>
            </View>

            {/* Stats Grid */}
            <View className="flex-row flex-wrap gap-3 mb-6">
              {displayStats.map((stat, index) => (
                <View 
                  key={index} 
                  className="flex-1 min-w-[45%] bg-white p-4 rounded-xl border-l-4 items-center shadow-sm"
                  style={{ borderLeftColor: stat.color }}
                >
                  <Ionicons name={stat.icon as any} size={28} color={stat.color} />
                  <Text className="text-[28px] font-bold text-gray-900 mt-2">{stat.value}</Text>
                  <Text className="text-xs text-gray-500 text-center mt-1">{stat.label}</Text>
                </View>
              ))}
            </View>

            {/* Verifiable Certificates Section */}
            <View className="mb-6">
              <Text className="text-xl font-bold text-gray-900 mb-4">Verifiable Certificates</Text>
              {certificates.length === 0 ? (
                <View className="bg-white p-6 rounded-xl border border-dashed border-gray-300 items-center justify-center">
                  <Ionicons name="ribbon-outline" size={36} color="#9CA3AF" />
                  <Text className="text-sm text-gray-500 text-center mt-2 font-medium">Complete courses to 100% to earn certificates.</Text>
                </View>
              ) : (
                <View className="gap-3">
                  {certificates.map((cert: any) => (
                    <View key={cert._id} className="flex-row items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <View className="flex-1 pr-3">
                        <Text className="text-[15px] font-bold text-gray-900 mb-1">{cert.courseName}</Text>
                        <Text className="text-xs text-gray-500">ID: {cert.certificateId}</Text>
                      </View>
                      <TouchableOpacity 
                        onPress={() => handleViewCert(cert)}
                        className="bg-amber-500 px-4 py-2 rounded-lg flex-row items-center"
                      >
                        <Ionicons name="eye-outline" size={16} color="#FFFFFF" style={{ marginRight: 4 }} />
                        <Text className="text-xs font-bold text-white">View</Text>
                      </TouchableOpacity>
                    </View>
                  ))}
                </View>
              )}
            </View>

            {/* Achievements Section */}
            <View className="mb-6">
              <Text className="text-xl font-bold text-gray-900 mb-4">Achievements</Text>
              <View className="flex-row flex-wrap gap-3">
                {achievements.map((achievement, index) => {
                  const unlocked = isBadgeUnlocked(achievement.id);
                  return (
                    <TouchableOpacity
                      key={index}
                      onPress={() => handleBadgePress(achievement)}
                      activeOpacity={0.7}
                      className={`flex-1 min-w-[45%] bg-white p-4 rounded-xl items-center shadow-sm relative ${
                        !unlocked ? 'opacity-40 bg-gray-100' : ''
                      }`}
                    >
                      <Text className="text-4xl mb-2">{achievement.icon}</Text>
                      <Text className="text-sm font-bold text-gray-900 text-center mb-1">{achievement.title}</Text>
                      <Text className="text-[11px] text-gray-500 text-center">
                        {achievement.description}     
                      </Text>
                      {unlocked && (
                        <View className="absolute top-2 right-2">
                          <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                        </View>
                      )}
                    </TouchableOpacity>
                  );
                })}
              </View>
            </View>
          </>
        )}
      </ScrollView>

      {/* Certificate Modal */}
      <CertificateViewerModal
        visible={certModalVisible}
        onClose={() => setCertModalVisible(false)}
        certificate={selectedCert}
      />
    </SafeAreaView>
  );                       
}

const styles = StyleSheet.create({
  circularContainer: {
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: '#EFF6FF',
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
    overflow: 'hidden'
  },
  circularFill: {
    position: 'absolute',
    top: -4,
    left: -4,
    width: 64,
    height: 64,
    borderRadius: 32,
    borderWidth: 4,
    borderColor: '#3B82F6',
    borderTopColor: 'transparent',
    borderLeftColor: 'transparent'
  },
  circularInner: {
    width: 56,
    height: 56,
    borderRadius: 28,
    backgroundColor: '#FFFFFF',
    justifyContent: 'center',
    alignItems: 'center'
  }
});
