import React, { useState, useEffect, useRef, useCallback } from 'react';
import { ScrollView, Text, TouchableOpacity, View, ActivityIndicator, Linking, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter } from 'expo-router';
import { useFocusEffect } from '@react-navigation/native';

import { useCounselingStore, UserBooking } from '../store/counselingStore';
import { useTheme } from '../hooks/useTheme';

const getStatusColor = (status: string) => {
  switch (status?.toLowerCase()) {
    case 'confirmed': return { bg: 'bg-green-100', text: 'text-green-700', label: 'Confirmed' };
    case 'pending': return { bg: 'bg-yellow-100', text: 'text-yellow-700', label: 'Pending' };
    case 'completed': return { bg: 'bg-blue-100', text: 'text-blue-700', label: 'Completed' };
    case 'cancelled': return { bg: 'bg-red-100', text: 'text-red-700', label: 'Cancelled' };
    case 'no_show': return { bg: 'bg-gray-100', text: 'text-gray-700', label: 'No Show' };
    default: return { bg: 'bg-gray-100', text: 'text-gray-700', label: status || 'Unknown' };
  }
};

function BookingCard({ booking, onPress, onJoin }: { booking: UserBooking; onPress: () => void; onJoin?: () => void }) {
  const { colors } = useTheme();
  const statusInfo = getStatusColor(booking.status);
  const isFree = booking.isFree || booking.amount === 0;
  const hasReschedulePending = booking.rescheduleRequest?.status === 'pending';

  return (
    <TouchableOpacity
      activeOpacity={0.8}
      onPress={onPress}
      className="bg-white rounded-2xl p-4 mb-3 shadow-sm border border-gray-100"
    >
      <View className="flex-row items-start justify-between mb-2">
        <View className="flex-1">
          <Text className="text-sm font-bold text-[#2C2420]" numberOfLines={1}>
            {booking.bookingTitle || 'Counseling Session'}
          </Text>
          <Text className="text-xs text-[#8C7B73] mt-0.5">
            with {booking.counselorName || 'Expert Counselor'}
          </Text>
        </View>
        <View className="flex-row items-center gap-1.5">
          {hasReschedulePending && (
            <View className="px-2 py-0.5 rounded-full bg-amber-100">
              <Text className="text-[9px] font-bold text-amber-700">RESCHEDULE</Text>
            </View>
          )}
          <View className={`px-2 py-0.5 rounded-full ${statusInfo.bg}`}>
            <Text className={`text-[9px] font-bold ${statusInfo.text}`}>{statusInfo.label}</Text>
          </View>
        </View>
      </View>

      <View className="flex-row items-center gap-4 mb-2">
        <View className="flex-row items-center gap-1">
          <Ionicons name="calendar-outline" size={12} color="#8C7B73" />
          <Text className="text-xs text-[#8C7B73]">
            {new Date(booking.bookingDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
          </Text>
        </View>
        <View className="flex-row items-center gap-1">
          <Ionicons name="time-outline" size={12} color="#8C7B73" />
          <Text className="text-xs text-[#8C7B73]">{booking.bookingTime}</Text>
        </View>
        <View className={`px-2 py-0.5 rounded-full ${isFree ? 'bg-green-50' : 'bg-orange-50'}`}>
          <Text className={`text-[9px] font-bold ${isFree ? 'text-green-700' : 'text-orange-700'}`}>
            {isFree ? 'FREE' : `₹${booking.amount}`}
          </Text>
        </View>
      </View>

      {booking.meetingLink && booking.status === 'confirmed' && (
        <TouchableOpacity
          onPress={onJoin}
          className="mt-2 flex-row items-center justify-center gap-1.5 py-2 rounded-xl"
          style={{ backgroundColor: '#16A34A' }}
        >
          <Ionicons name="videocam" size={14} color="#fff" />
          <Text className="text-xs font-bold text-white">Join Meeting</Text>
        </TouchableOpacity>
      )}
    </TouchableOpacity>
  );
}

export default function CounselingScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [selectedType, setSelectedType] = useState<string | null>(null);
  const [allBookings, setAllBookings] = useState<UserBooking[]>([]);
  const [isBookingsLoading, setIsBookingsLoading] = useState(false);
  const [refreshing, setRefreshing] = useState(false);

  const { counselingTypes, fetchCounselingTypes, fetchMyBookings, isLoading } = useCounselingStore();

  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    fetchCounselingTypes();
    return () => { isMountedRef.current = false; };
  }, [fetchCounselingTypes]);

  const loadBookings = useCallback(async () => {
    const bookings = await fetchMyBookings();
    if (isMountedRef.current) {
      setAllBookings(bookings);
    }
  }, [fetchMyBookings]);

  useFocusEffect(
    useCallback(() => {
      let isActive = true;
      const load = async () => {
        setIsBookingsLoading(true);
        const bookings = await fetchMyBookings();
        if (!isActive) return;
        setAllBookings(bookings);
        setIsBookingsLoading(false);
      };
      load();
      return () => { isActive = false; };
    }, [fetchMyBookings])
  );

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await Promise.all([fetchCounselingTypes(), fetchMyBookings()]);
    setRefreshing(false);
  }, [fetchCounselingTypes, fetchMyBookings]);

  const now = new Date();
  const todayStart = new Date(now.getFullYear(), now.getMonth(), now.getDate());

  const upcomingBookings = allBookings
    .filter(b => {
      const bookingDate = new Date(b.bookingDate);
      return bookingDate >= todayStart && !['cancelled', 'completed', 'no_show'].includes(b.status);
    })
    .sort((a, b) => new Date(a.bookingDate).getTime() - new Date(b.bookingDate).getTime());

  const pastBookings = allBookings
    .filter(b => {
      const bookingDate = new Date(b.bookingDate);
      return bookingDate < todayStart || ['cancelled', 'completed', 'no_show'].includes(b.status);
    })
    .sort((a, b) => new Date(b.bookingDate).getTime() - new Date(a.bookingDate).getTime());

  const handleContinue = () => {
    if (selectedType) {
      const selected = counselingTypes.find(t => t.id === selectedType);
      router.push({ pathname: '/book-counseling', params: { id: selected?.id } });
    }
  };

  const handleJoin = (meetingLink: string) => {
    Linking.openURL(meetingLink).catch(() => {});
  };

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: colors.background }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 bg-white shadow-sm z-10">
        <TouchableOpacity onPress={() => { if (router.canGoBack()) router.back(); }} className="w-10 h-10 items-center justify-center bg-gray-50 rounded-full">
          <Ionicons name="arrow-back" size={20} color="#2C2420" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-[#2C2420]">Counseling Services</Text>
        <View className="w-10" />
      </View>

      <ScrollView
        className="flex-1"
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F1842D" colors={['#F1842D']} />
        }
      >
        <View className="p-5">

          {/* Hero Section */}
          <View className="bg-white rounded-3xl p-6 mb-6 shadow-sm border border-gray-100 items-center">
            <View className="w-16 h-16 bg-[colors.background] rounded-full items-center justify-center mb-4">
              <Text className="text-3xl">🙏</Text>
            </View>
            <Text className="text-2xl font-extrabold text-[#2C2420] mb-2 text-center">
              Find Your Peace
            </Text>
            <Text className="text-[#5C4A42] text-center leading-5 px-2">
              Connect with our expert counselors and Gurudev for spiritual and mental guidance.
            </Text>
          </View>

          {/* My Bookings Section */}
          <View className="mb-6">
            <Text className="text-lg font-bold text-[#2C2420] mb-4 px-1">My Bookings</Text>

            {isBookingsLoading ? (
              <View className="bg-white rounded-2xl p-5 shadow-sm border border-gray-100 flex-row items-center justify-center gap-2">
                <ActivityIndicator size="small" color="#F1842D" />
                <Text className="text-[#5C4A42] font-medium">Loading your bookings...</Text>
              </View>
            ) : allBookings.length === 0 ? (
              <View className="bg-white rounded-2xl p-6 shadow-sm border border-gray-100 items-center">
                <Ionicons name="calendar-outline" size={32} color="#D1CBC4" />
                <Text className="text-sm text-[#8C7B73] mt-2 text-center">No bookings yet</Text>
                <Text className="text-xs text-[#B5AFA9] mt-1 text-center">Book a session below to get started</Text>
              </View>
            ) : (
              <>
                {/* Upcoming */}
                {upcomingBookings.length > 0 && (
                  <View className="mb-4">
                    <Text className="text-xs font-bold text-[#8C7B73] uppercase tracking-wider mb-3 px-1">Upcoming</Text>
                    {upcomingBookings.map(booking => (
                      <BookingCard
                        key={booking._id}
                        booking={booking}
                        onPress={() => router.push({ pathname: '/counseling-detail', params: { bookingId: booking._id } })}
                        onJoin={() => booking.meetingLink && handleJoin(booking.meetingLink)}
                      />
                    ))}
                  </View>
                )}

                {/* Past */}
                {pastBookings.length > 0 && (
                  <View>
                    <Text className="text-xs font-bold text-[#8C7B73] uppercase tracking-wider mb-3 px-1">Past</Text>
                    {pastBookings.map(booking => (
                      <BookingCard
                        key={booking._id}
                        booking={booking}
                        onPress={() => router.push({ pathname: '/counseling-detail', params: { bookingId: booking._id } })}
                        onJoin={() => booking.meetingLink && handleJoin(booking.meetingLink)}
                      />
                    ))}
                  </View>
                )}
              </>
            )}
          </View>

          {/* Available Services */}
          {isLoading ? (
            <View className="py-10 items-center">
              <ActivityIndicator size="large" color="#F1842D" />
              <Text className="text-gray-500 mt-4 font-medium">Loading services...</Text>
            </View>
          ) : (
            <>
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
                        borderColor: isSelected ? (type.color || '#F1842D') : colors.surfaceSecondary,
                        shadowColor: '#000', shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2
                      }}
                    >
                      <View className="flex-row items-start gap-4">
                        <View className="w-14 h-14 rounded-2xl items-center justify-center" style={{ backgroundColor: type.color || '#F1842D' }}>
                          <Ionicons name={type.icon as any} size={24} color={colors.surface} />
                        </View>
                        <View className="flex-1">
                          <View className="flex-row items-center justify-between mb-1">
                            <Text className="text-base font-bold text-[#2C2420]">{type.title}</Text>
                            {isSelected && (
                              <View className="w-6 h-6 rounded-full items-center justify-center" style={{ backgroundColor: type.color || '#F1842D' }}>
                                <Ionicons name="checkmark" size={14} color={colors.surface} />
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
                                <Text className="text-[10px] font-bold text-orange-700 tracking-wider">₹{type.price}</Text>
                              </View>
                            )}
                          </View>
                          <Text className="text-sm text-[#5C4A42] leading-5 mb-3">{type.description}</Text>
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
                <View className="w-12 h-12 rounded-2xl bg-[colors.background] items-center justify-center">
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
            style={{ backgroundColor: counselingTypes.find(t => t.id === selectedType)?.color || '#F1842D' }}
          >
            <Text className="text-base font-bold text-white">Continue to Booking</Text>
            <Ionicons name="arrow-forward" size={18} color={colors.surface} />
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
