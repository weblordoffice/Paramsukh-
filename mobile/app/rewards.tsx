import React, { useState, useEffect } from 'react';
import { ScrollView, Text, TouchableOpacity, View, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useRewardStore } from '@/store/rewardStore';

export default function RewardsScreen() {
  const router = useRouter();
  const [selectedTab, setSelectedTab] = useState<'rewards' | 'history'>('rewards');

  const {
    totalPoints,
    currentLevel,
    history,
    rewards,
    redeemedRewards,
    isLoading,
    fetchRewardsStatus,
    fetchRewardsCatalog,
    redeemReward
  } = useRewardStore();

  useEffect(() => {
    fetchRewardsStatus();
    fetchRewardsCatalog();
  }, []);

  const handleRedeem = async (rewardId: string) => {
    Alert.alert(
      'Confirm Redemption',
      'Are you sure you want to redeem this reward?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Redeem',
          onPress: async () => {
            const result = await redeemReward(rewardId);
            if (result.success) {
              Alert.alert('Success', result.message);
            } else {
              Alert.alert('Error', result.message);
            }
          }
        }
      ]
    );
  };

  const nextLevelPoints = 500; // Example threshold, could come from backend config
  const progressPercentage = Math.min((totalPoints / nextLevelPoints) * 100, 100);

  // Filter rewards
  const availableRewards = rewards.filter(r => r.isAvailable && !redeemedRewards.includes(r._id));
  const lockedRewards = rewards.filter(r => !r.isAvailable);

  if (isLoading && rewards.length === 0) {
    return (
      <View className="flex-1 justify-center items-center bg-gray-50">
        <ActivityIndicator size="large" color="#F1842D" />
      </View>
    );
  }

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()} className="w-10">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Bonus Points</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-5">
          {/* Points Summary Card */}
          <View className="bg-gradient-to-br from-purple-600 to-pink-600 bg-purple-500 rounded-3xl p-6 mb-5 shadow-lg">
            <View className="flex-row items-center justify-between mb-4">
              <View>
                <Text className="text-white/80 text-sm mb-1">Your Balance</Text>
                <Text className="text-5xl font-black text-white">{totalPoints}</Text>
                <Text className="text-white/90 text-base font-semibold mt-1">Bonus Points</Text>
              </View>
              <View className="items-center bg-white/20 rounded-2xl p-4">
                <Text className="text-6xl">🏆</Text>
              </View>
            </View>

            <View className="bg-white/20 rounded-xl p-3">
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-white/90 text-sm font-semibold">{currentLevel}</Text>
                <Text className="text-white text-xs">{totalPoints}/{nextLevelPoints}</Text>
              </View>
              <View className="bg-white/30 rounded-full h-2 overflow-hidden">
                <View
                  className="bg-white h-full rounded-full"
                  style={{ width: `${progressPercentage}%` }}
                />
              </View>
              <Text className="text-white/70 text-xs mt-2">
                {Math.max(0, nextLevelPoints - totalPoints)} points to next level
              </Text>
            </View>
          </View>

          {/* How to Earn Points */}
          <View className="bg-blue-50 rounded-2xl p-4 mb-5 border border-blue-200">
            <View className="flex-row items-center gap-2 mb-3">
              <Ionicons name="information-circle" size={20} color="#3B82F6" />
              <Text className="text-sm font-bold text-blue-900">How to Earn Points</Text>
            </View>
            <View className="gap-2">
              <View className="flex-row items-center gap-2">
                <Text className="text-green-600 font-bold">+10</Text>
                <Text className="text-xs text-blue-700 flex-1">Complete a course or lesson</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-green-600 font-bold">+10</Text>
                <Text className="text-xs text-blue-700 flex-1">Attend an event</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-green-600 font-bold">+15</Text>
                <Text className="text-xs text-blue-700 flex-1">Maintain a 7-day learning streak</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-green-600 font-bold">+20</Text>
                <Text className="text-xs text-blue-700 flex-1">Refer a friend who joins</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Text className="text-green-600 font-bold">+25</Text>
                <Text className="text-xs text-blue-700 flex-1">Write a course review</Text>
              </View>
            </View>
          </View>

          {/* Tabs */}
          <View className="flex-row bg-white rounded-xl p-1 mb-5 shadow-sm">
            <TouchableOpacity
              className={`flex-1 py-3 px-4 rounded-lg items-center ${selectedTab === 'rewards' ? 'bg-purple-500' : ''
                }`}
              onPress={() => setSelectedTab('rewards')}
            >
              <Text className={`text-sm font-semibold ${selectedTab === 'rewards' ? 'text-white' : 'text-gray-500'
                }`}>
                Rewards
              </Text>
            </TouchableOpacity>
            <TouchableOpacity
              className={`flex-1 py-3 px-4 rounded-lg items-center ${selectedTab === 'history' ? 'bg-purple-500' : ''
                }`}
              onPress={() => setSelectedTab('history')}
            >
              <Text className={`text-sm font-semibold ${selectedTab === 'history' ? 'text-white' : 'text-gray-500'
                }`}>
                History
              </Text>
            </TouchableOpacity>
          </View>

          {/* Rewards Tab */}
          {selectedTab === 'rewards' && (
            <View>
              {/* Available Rewards */}
              {availableRewards.length > 0 ? (
                <View className="mb-5">
                  <Text className="text-base font-bold text-gray-900 mb-3">Available Rewards</Text>
                  <View className="gap-3">
                    {availableRewards.map((reward) => (
                      <View
                        key={reward._id}
                        className="rounded-2xl p-4 border-2"
                        style={{
                          backgroundColor: reward.bgColor || '#FEF3C7',
                          borderColor: reward.color || '#F59E0B',
                        }}
                      >
                        <View className="flex-row items-start gap-3">
                          <Text className="text-4xl">{reward.emoji}</Text>
                          <View className="flex-1">
                            <View className="flex-row items-start justify-between mb-1">
                              <View className="flex-1">
                                <Text className="text-base font-bold text-gray-900">{reward.title}</Text>
                                <View className="bg-gray-100 self-start px-2 py-0.5 rounded-lg mt-1 mb-2">
                                  <Text className="text-[10px] font-bold text-gray-600">{reward.category}</Text>
                                </View>
                              </View>
                            </View>
                            <Text className="text-xs text-gray-600 mb-3">{reward.description}</Text>
                            <View className="flex-row items-center justify-between">
                              <View className="flex-row items-center gap-1">
                                <Ionicons name="star" size={16} style={{ color: reward.color || '#F59E0B' }} />
                                <Text className="text-sm font-bold" style={{ color: reward.color || '#F59E0B' }}>
                                  {reward.pointsCost} Points
                                </Text>
                              </View>
                              <TouchableOpacity
                                className="px-4 py-2 rounded-lg"
                                style={{ backgroundColor: reward.color || '#F59E0B' }}
                                onPress={() => handleRedeem(reward._id)}
                              >
                                <Text className="text-xs font-bold text-white">Redeem</Text>
                              </TouchableOpacity>
                            </View>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}

              {/* Locked Rewards */}
              {lockedRewards.length > 0 ? (
                <View>
                  <Text className="text-base font-bold text-gray-900 mb-3">Locked / Unavailable</Text>
                  <View className="gap-3">
                    {lockedRewards.map((reward) => (
                      <View
                        key={reward._id}
                        className="rounded-2xl p-4 border border-gray-200 bg-gray-50 opacity-60"
                      >
                        <View className="flex-row items-start gap-3">
                          <Text className="text-4xl opacity-50">{reward.emoji}</Text>
                          <View className="flex-1">
                            <View className="flex-row items-center gap-2 mb-1">
                              <Text className="text-base font-bold text-gray-600">{reward.title}</Text>
                              <Ionicons name="lock-closed" size={14} color="#9CA3AF" />
                            </View>
                            <View className="bg-gray-200 self-start px-2 py-0.5 rounded-lg mt-1 mb-2">
                              <Text className="text-[10px] font-bold text-gray-500">{reward.category}</Text>
                            </View>
                            <Text className="text-xs text-gray-500 mb-3">{reward.description}</Text>
                            <View className="flex-row items-center gap-1">
                              <Ionicons name="star" size={16} color="#9CA3AF" />
                              <Text className="text-sm font-bold text-gray-500">
                                {reward.pointsCost} Points
                              </Text>
                              <Text className="text-xs text-gray-400 ml-1">
                                ({Math.max(0, reward.pointsCost - totalPoints)} more needed)
                              </Text>
                            </View>
                          </View>
                        </View>
                      </View>
                    ))}
                  </View>
                </View>
              ) : null}
            </View>
          )}

          {/* History Tab */}
          {selectedTab === 'history' && (
            <View>
              <Text className="text-base font-bold text-gray-900 mb-3">Recent Activity</Text>
              <View className="gap-3">
                {history.length === 0 ? (
                  <Text className="text-gray-500 text-center py-4">No point activity yet</Text>
                ) : (
                  history.map((item) => (
                    <View
                      key={item._id}
                      className="bg-white rounded-2xl p-4 border border-gray-200 flex-row items-center gap-3"
                    >
                      <View
                        className="w-12 h-12 rounded-full items-center justify-center"
                        style={{ backgroundColor: (item.type === 'earn' ? '#10B981' : '#EF4444') + '20' }}
                      >
                        <Ionicons
                          name={item.type === 'earn' ? "trophy" : "gift"}
                          size={20}
                          style={{ color: item.type === 'earn' ? '#10B981' : '#EF4444' }}
                        />
                      </View>
                      <View className="flex-1">
                        <Text className="text-sm font-semibold text-gray-900 mb-0.5">{item.activity}</Text>
                        <Text className="text-xs text-gray-500">{new Date(item.createdAt).toLocaleDateString()}</Text>
                      </View>
                      <View className="items-end">
                        <Text className={`text-lg font-black ${item.type === 'earn' ? 'text-green-600' : 'text-red-500'}`}>
                          {item.type === 'earn' ? '+' : ''}{item.points}
                        </Text>
                        <Text className="text-[10px] text-gray-500">points</Text>
                      </View>
                    </View>
                  ))
                )}
              </View>
            </View>
          )}

          <View className="h-10" />
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
