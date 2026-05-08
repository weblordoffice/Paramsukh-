import React, { useState, useEffect } from 'react';
import {
  View,   
  Text,
  ScrollView,   
  TouchableOpacity,
  ActivityIndicator,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuthStore } from '../../store/authStore';
       
export default function MyProgressScreen() {
  const router = useRouter();          
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [stats, setStats] = useState({
    totalEnrollments: 0,
    completedCourses: 0,
    inProgressCourses: 0,
    eventRegistrations: 0,
    eventsAttended: 0,
    loginCount: 0
  });

  useEffect(() => {
    const fetchStats = async () => {
      try {
        const response = await axios.get(`${API_URL}/user/stats`, {
          headers: token ? { Authorization: `Bearer ${token}` } : undefined
        });
        if (response.data.success && response.data.stats) {
          setStats(response.data.stats);
        }
      } catch (error) {
      } finally {
        setLoading(false);
      }
    };
    fetchStats();
  }, [token]);

  const displayStats = [      
    { label: 'Courses Enrolled', value: stats.totalEnrollments.toString(), icon: 'book-outline', color: '#8B5CF6' },
    { label: 'Courses Completed', value: stats.completedCourses.toString(), icon: 'checkmark-circle-outline', color: '#3B82F6' },
    { label: 'Events Registered', value: stats.eventRegistrations.toString(), icon: 'calendar-outline', color: '#10B981' },
    { label: 'Events Attended', value: stats.eventsAttended.toString(), icon: 'ticket-outline', color: '#EF4444' },
  ];    

  const achievements = [
    { title: 'First Step', description: 'Enrolled in your first course', icon: '🎯', unlocked: stats.totalEnrollments >= 1 },
    { title: 'Knowledge Seeker', description: 'Completed a course', icon: '📚', unlocked: stats.completedCourses >= 1 },
    { title: 'Event Enthusiast', description: 'Registered for an event', icon: '🎪', unlocked: stats.eventRegistrations >= 1 },
    { title: 'Master Learner', description: 'Completed 5 courses', icon: '🏆', unlocked: stats.completedCourses >= 5 },
    { title: 'Active Member', description: 'Logged in 10 times', icon: '🔥', unlocked: stats.loginCount >= 10 },
    { title: 'Community Pillar', description: 'Attended 5 events', icon: '👥', unlocked: stats.eventsAttended >= 5 },
  ];
    
  const recentActivity = [   
    { title: 'Completed "Meditation Basics"', time: '2 hours ago', icon: 'checkmark-circle', color: '#10B981' },
    { title: 'Joined "Spiritual Growth" group', time: '1 day ago', icon: 'people', color: '#3B82F6' },
    { title: 'Attended "Yoga Workshop"', time: '3 days ago', icon: 'calendar', color: '#F59E0B' },
    { title: 'Unlocked "Dedicated Learner"', time: '5 days ago', icon: 'trophy', color: '#EF4444' },
  ];
                                   
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

            {/* Achievements Section */}
            <View className="mb-6">
              <Text className="text-xl font-bold text-gray-900 mb-4">Achievements</Text>
              <View className="flex-row flex-wrap gap-3">
                {achievements.map((achievement, index) => (
                  <View
                    key={index}
                    className={`flex-1 min-w-[45%] bg-white p-4 rounded-xl items-center shadow-sm relative ${
                      !achievement.unlocked ? 'opacity-50 bg-gray-100' : ''
                    }`}
                  >
                    <Text className="text-4xl mb-2">{achievement.icon}</Text>
                    <Text className="text-sm font-bold text-gray-900 text-center mb-1">{achievement.title}</Text>
                    <Text className="text-[11px] text-gray-500 text-center">
                      {achievement.description}     
                    </Text>
                    {achievement.unlocked && (
                      <View className="absolute top-2 right-2">
                        <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                      </View>
                    )}
                  </View>
                ))}
              </View>
            </View>

            {/* Recent Activity Section */}
            <View className="mb-6">
              <Text className="text-xl font-bold text-gray-900 mb-4">Recent Activity</Text>
              {recentActivity.map((activity, index) => (
                <View key={index} className="flex-row items-center bg-white p-4 rounded-xl mb-3 shadow-sm">
                  <View 
                    className="w-11 h-11 rounded-full items-center justify-center mr-3"
                    style={{ backgroundColor: `${activity.color}20` }}
                  >
                    <Ionicons name={activity.icon as any} size={20} color={activity.color} />
                  </View>
                  <View className="flex-1">
                    <Text className="text-[15px] font-semibold text-gray-900 mb-1">{activity.title}</Text>
                    <Text className="text-[13px] text-gray-500">{activity.time}</Text>
                  </View>
                </View>
              ))}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );                       
}
