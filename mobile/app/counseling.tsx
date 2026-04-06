import React, { useState , useEffect } from 'react';
import { ScrollView, Text, TouchableOpacity, View , ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';

import { useCounselingStore } from '../store/counselingStore';



export default function CounselingScreen() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string | null>(null);

  const { counselingTypes, fetchCounselingTypes, isLoading } = useCounselingStore();

  useEffect(() => {
    fetchCounselingTypes();
  }, [fetchCounselingTypes]);

  const handleContinue = () => {
    if (selectedType) {
      const selected = counselingTypes.find(t => t.id === selectedType);
      router.push({
        pathname: '/book-counseling',
        params: {
          id: selected?.id,
          title: selected?.title,
          description: selected?.description,
          price: selected?.price ? selected.price.toString() : '0',
          counselorName: selected?.counselorName,
          duration: selected?.duration,
          color: selected?.color,
          bgColor: selected?.bgColor,
          isFree: selected?.isFree ? 'true' : 'false',
        }
      });
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()} className="w-10">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Counseling Services</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-5">
          {/* Header Section */}
          <View className="items-center mb-6">
            <Text className="text-4xl mb-3">🙏</Text>
            <Text className="text-2xl font-bold text-gray-900 mb-2 text-center">
              Choose Your Counseling Type
            </Text>
            <Text className="text-sm text-gray-500 text-center leading-5 px-5">
              Select the area where you need professional guidance and support
            </Text>
          </View>

          {isLoading ? (
            <View className="py-10 items-center">
              <ActivityIndicator size="large" color="#3B82F6" />
              <Text className="text-gray-500 mt-4">Loading services...</Text>
            </View>
          ) : (
            <>

              {/* Info Banner */}
              <View className="bg-blue-50 rounded-2xl p-4 mb-5 border border-blue-200">
                <View className="flex-row items-start gap-3">
                  <Ionicons name="information-circle" size={24} color="#3B82F6" />
                  <View className="flex-1">
                    <Text className="text-sm font-semibold text-blue-900 mb-1">
                      Two Counselor Options
                    </Text>
                    <Text className="text-xs text-blue-700 leading-5">
                      • Free counseling by our expert support team{'\n'}
                      • Premium counseling with Gurudev (₹999/-)
                    </Text>
                  </View>
                </View>
              </View>

              {/* Counseling Type Cards */}
              <View className="gap-3 mb-6">
                {counselingTypes.map((type) => {
                  const isSelected = selectedType === type.id;

                  return (
                    <TouchableOpacity
                      key={type.id}
                      activeOpacity={0.7}
                      onPress={() => setSelectedType(type.id)}
                      className={`rounded-2xl p-4 ${isSelected ? 'border-[3px]' : 'border border-gray-200'
                        }`}
                      style={{
                        backgroundColor: type.bgColor,
                        borderColor: isSelected ? type.color : undefined,
                      }}
                    >
                      <View className="flex-row items-start gap-3">
                        <View
                          className="w-14 h-14 rounded-xl items-center justify-center"
                          style={{ backgroundColor: type.color }}
                        >
                          <Ionicons name={type.icon as any} size={26} color="#FFFFFF" />
                        </View>

                        <View className="flex-1">
                          <View className="flex-row items-center justify-between mb-1">
                            <Text className="text-base font-bold text-gray-900">{type.title}</Text>
                            {isSelected && (
                              <View
                                className="w-6 h-6 rounded-full items-center justify-center"
                                style={{ backgroundColor: type.color }}
                              >
                                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                              </View>
                            )}
                          </View>

                          {type.isFree && (
                            <View className="bg-green-100 self-start px-2 py-0.5 rounded-lg mb-2">
                              <Text className="text-[10px] font-bold text-green-700">FREE</Text>
                            </View>
                          )}

                          <Text className="text-xs text-gray-600 leading-5 mb-2">
                            {type.description}
                          </Text>

                          <View className="flex-row items-center gap-1">
                            <Ionicons name="time-outline" size={14} color="#6B7280" />
                            <Text className="text-xs text-gray-500">{type.duration}</Text>
                          </View>
                        </View>
                      </View>
                    </TouchableOpacity>
                  );
                })}
              </View>
            </>
          )}

          {/* Features Section */}
          <View className="bg-white rounded-2xl p-5 mb-5">
            <Text className="text-base font-bold text-gray-900 mb-4">What to Expect</Text>
            <View className="gap-3">
              <View className="flex-row items-start gap-3">
                <View className="w-8 h-8 rounded-full bg-green-100 items-center justify-center">
                  <Ionicons name="person" size={16} color="#10B981" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900">Professional Guidance</Text>
                  <Text className="text-xs text-gray-500 mt-0.5">
                    Expert counselors with years of experience
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start gap-3">
                <View className="w-8 h-8 rounded-full bg-blue-100 items-center justify-center">
                  <Ionicons name="shield-checkmark" size={16} color="#3B82F6" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900">Complete Privacy</Text>
                  <Text className="text-xs text-gray-500 mt-0.5">
                    Confidential sessions in a safe environment
                  </Text>
                </View>
              </View>

              <View className="flex-row items-start gap-3">
                <View className="w-8 h-8 rounded-full bg-purple-100 items-center justify-center">
                  <Ionicons name="time" size={16} color="#8B5CF6" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-semibold text-gray-900">Flexible Scheduling</Text>
                  <Text className="text-xs text-gray-500 mt-0.5">
                    Book at your convenience, cancel anytime
                  </Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
      {selectedType && (
        <View className="bg-white border-t border-gray-200 p-4">
          <TouchableOpacity
            onPress={handleContinue}
            className="flex-row items-center justify-center gap-2 py-4 rounded-xl"
            style={{
              backgroundColor: counselingTypes.find(t => t.id === selectedType)?.color
            }}
          >
            <Text className="text-base font-bold text-white">Continue to Booking</Text>
            <Ionicons name="arrow-forward" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
