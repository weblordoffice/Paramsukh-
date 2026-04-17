import React, { useState , useEffect } from 'react';
import { ScrollView, Text, TouchableOpacity, View , ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';

import { useCounselingStore } from '../store/counselingStore';

interface ConfirmedBookingSummary {
  _id: string;
  bookingTitle: string;
  counselorName: string;
  bookingDate: string;
  bookingTime: string;
  status: string;
}


export default function CounselingScreen() {
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [confirmedBooking, setConfirmedBooking] = useState<ConfirmedBookingSummary | null>(null);
  const [isBookingLoading, setIsBookingLoading] = useState(false);

  const { counselingTypes, fetchCounselingTypes, fetchMyBookings, isLoading } = useCounselingStore();

  useEffect(() => {
    fetchCounselingTypes();
  }, [fetchCounselingTypes]);

  useEffect(() => {
    const loadConfirmedBooking = async () => {
      setIsBookingLoading(true);
      const bookings = await fetchMyBookings('confirmed');

      if (!bookings.length) {
        setConfirmedBooking(null);
        setIsBookingLoading(false);
        return;
      }

      const now = new Date();
      const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

      const upcoming = bookings
        .filter((b: ConfirmedBookingSummary) => new Date(b.bookingDate) >= todayStart)
        .sort((a: ConfirmedBookingSummary, b: ConfirmedBookingSummary) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime());

      const selected = upcoming[0] || bookings[0];
      setConfirmedBooking(selected as ConfirmedBookingSummary);
      setIsBookingLoading(false);
    };

    loadConfirmedBooking();
  }, [fetchMyBookings]);

  const handleContinue = () => {
    if (selectedType) {
      const selected = counselingTypes.find(t => t.id === selectedType);
      
      // If service uses Calendly, open Calendly link directly
      if (selected?.usesCalendly && selected.calendlyEventUri) {
        WebBrowser.openBrowserAsync(selected.calendlyEventUri, {
          presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
          enableBarCollapsing: true,
          showTitle: true,
        });
        return;
      }
      
      router.push({ pathname: '/book-counseling', params: { id: selected?.id } });
    }
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FDF8F3' }}>
      {/* Premium Header */}
      <View className="flex-row items-center justify-between px-5 py-4 bg-white shadow-sm z-10">
        <TouchableOpacity onPress={() => router.back()} className="w-10 h-10 items-center justify-center bg-gray-50 rounded-full">
          <Ionicons name="arrow-back" size={20} color="#2C2420" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-[#2C2420]">Counseling Services</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-5">
          {/* Hero Section */}
          <View className="bg-white rounded-3xl p-6 mb-8 shadow-sm border border-gray-100 items-center">
             <View className="w-16 h-16 bg-[#FDF8F3] rounded-full items-center justify-center mb-4">
               <Text className="text-3xl">🙏</Text>
             </View>
             <Text className="text-2xl font-extrabold text-[#2C2420] mb-2 text-center">
               Find Your Peace
             </Text>
             <Text className="text-[#5C4A42] text-center leading-5 px-2">
               Connect with our expert counselors and Gurudev for spiritual and mental guidance.
             </Text>
          </View>

          {isBookingLoading ? (
            <View className="bg-white rounded-3xl p-5 mb-6 shadow-sm border border-gray-100 flex-row items-center justify-center gap-2">
              <ActivityIndicator size="small" color="#16A34A" />
              <Text className="text-[#5C4A42] font-medium">Checking your bookings...</Text>
            </View>
          ) : confirmedBooking ? (
            <View className="bg-white rounded-3xl p-5 mb-6 shadow-sm border border-green-100">
              <View className="flex-row items-center justify-between mb-3">
                <Text className="text-sm font-bold text-[#166534]">Your Confirmed Session</Text>
                <View className="px-2.5 py-1 rounded-full bg-green-100">
                  <Text className="text-[10px] font-bold text-green-700 tracking-wider">CONFIRMED</Text>
                </View>
              </View>

              <Text className="text-base font-bold text-[#2C2420] mb-1">
                {confirmedBooking.bookingTitle || 'Counseling Session'}
              </Text>
              <Text className="text-xs text-[#5C4A42] mb-3">with {confirmedBooking.counselorName || 'Expert Counselor'}</Text>

              <View className="flex-row items-center gap-4">
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="calendar-outline" size={14} color="#166534" />
                  <Text className="text-xs text-[#166534] font-semibold">
                    {new Date(confirmedBooking.bookingDate).toLocaleDateString('en-IN')}
                  </Text>
                </View>
                <View className="flex-row items-center gap-1.5">
                  <Ionicons name="time-outline" size={14} color="#166534" />
                  <Text className="text-xs text-[#166534] font-semibold">{confirmedBooking.bookingTime}</Text>
                </View>
              </View>
            </View>
          ) : null}

          {isLoading ? (
            <View className="py-10 items-center">
              <ActivityIndicator size="large" color="#F1842D" />
              <Text className="text-gray-500 mt-4 font-medium">Loading services...</Text>
            </View>
          ) : (
            <>
              {/* Type Cards */}
              <Text className="text-lg font-bold text-[#2C2420] mb-4 px-1">Available Services</Text>
              <View className="gap-4 mb-8">
                {counselingTypes.map((type) => {
                  const isSelected = selectedType === type.id;
                  return (
                    <TouchableOpacity
                      key={type.id}
                      activeOpacity={0.8}
                      onPress={() => setSelectedType(type.id)}
                      className={`rounded-3xl p-5 bg-white shadow-sm border ${
                        isSelected ? 'border-2' : 'border border-gray-100'
                      }`}
                      style={{
                        borderColor: isSelected ? (type.color || '#F1842D') : '#F3F4F6',
                        shadowColor: '#000', shadowOffset: { width:0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
                      }}
                    >
                      <View className="flex-row items-start gap-4">
                        <View
                          className="w-14 h-14 rounded-2xl items-center justify-center"
                          style={{ backgroundColor: type.color || '#F1842D' }}
                        >
                          <Ionicons name={type.icon as any} size={24} color="#FFFFFF" />
                        </View>

                        <View className="flex-1">
                          <View className="flex-row items-center justify-between mb-1">
                            <Text className="text-base font-bold text-[#2C2420]">{type.title}</Text>
                            {isSelected && (
                              <View
                                className="w-6 h-6 rounded-full items-center justify-center"
                                style={{ backgroundColor: type.color || '#F1842D' }}
                              >
                                <Ionicons name="checkmark" size={14} color="#FFFFFF" />
                              </View>
                            )}
                          </View>
                          
                          <View className="flex-row flex-wrap gap-2 mb-2">
                            {type.isFree ? (
                              <View className="bg-green-50 px-2 py-1 rounded border border-green-100">
                                <Text className="text-[10px] font-bold text-green-700 tracking-wider">FREE</Text>
                              </View>
                            ) : (
                              <View className="bg-orange-50 px-2 py-1 rounded border border-orange-100">
                                <Text className="text-[10px] font-bold text-orange-700 tracking-wider">PREMIUM</Text>
                              </View>
                            )}
                            
                            {type.usesCalendly && (
                              <View className="bg-purple-50 px-2 py-1 rounded border border-purple-100">
                                <Text className="text-[10px] font-bold text-purple-700 tracking-wider">SCHEDULE</Text>
                              </View>
                            )}
                          </View>

                          <Text className="text-sm text-[#5C4A42] leading-5 mb-3">
                            {type.description}
                          </Text>

                          <View className="flex-row items-center gap-4">
                            <View className="flex-row items-center gap-1.5">
                              <Ionicons name="time-outline" size={14} color="#8C7B73" />
                              <Text className="text-xs text-[#8C7B73] font-medium">{type.duration}</Text>
                            </View>
                            <View className="flex-row items-center gap-1.5">
                              <Ionicons name="person-outline" size={14} color="#8C7B73" />
                              <Text className="text-xs text-[#8C7B73] font-medium">{type.counselorName || 'Expert'}</Text>
                            </View>
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
          <Text className="text-lg font-bold text-[#2C2420] mb-4 px-1">What to Expect</Text>
          <View className="bg-white rounded-3xl p-6 mb-8 shadow-sm border border-gray-100">
            <View className="gap-6">
              <View className="flex-row items-center gap-4">
                <View className="w-12 h-12 rounded-2xl bg-[#FDF8F3] items-center justify-center">
                  <Ionicons name="shield-checkmark" size={20} color="#F1842D" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-[#2C2420]">Complete Privacy</Text>
                  <Text className="text-xs text-[#5C4A42] mt-1">Confidential & safe environment</Text>
                </View>
              </View>
              <View className="flex-row items-center gap-4">
                <View className="w-12 h-12 rounded-2xl bg-[#EFF6FF] items-center justify-center">
                  <Ionicons name="videocam" size={20} color="#3B82F6" />
                </View>
                <View className="flex-1">
                  <Text className="text-sm font-bold text-[#2C2420]">1-on-1 Video</Text>
                  <Text className="text-xs text-[#5C4A42] mt-1">HD video sessions from anywhere</Text>
                </View>
              </View>
            </View>
          </View>
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
      {selectedType && (
        <View className="bg-white pt-4 pb-8 px-5 rounded-t-3xl shadow-[0_-4px_6px_-1px_rgba(0,0,0,0.1)] border-t border-gray-100">
          <TouchableOpacity
            onPress={handleContinue}
            activeOpacity={0.8}
            className="flex-row items-center justify-center gap-2 py-4 rounded-2xl shadow-sm"
            style={{
              backgroundColor: counselingTypes.find(t => t.id === selectedType)?.color || '#F1842D'
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
