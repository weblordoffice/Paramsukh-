import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, TextInput, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCounselingStore } from '../store/counselingStore';
import { useAuthStore } from '../store/authStore';

export default function BookCounselingScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const { id, title, description, price, counselorName, duration, color, bgColor, isFree } = params;

  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const { checkAvailability, bookSession, createBookingPaymentLink, confirmBookingPaymentLink, isLoading } = useCounselingStore();
  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [processing, setProcessing] = useState(false);

  // No hardcoded counselors anymore


  // Helper: Generate next 7 days
  const dates = Array.from({ length: 7 }, (_, i) => {
    const date = new Date();
    date.setDate(date.getDate() + i);
    return {
      id: date.toISOString().split('T')[0],
      day: date.toLocaleDateString('en-US', { weekday: 'short' }),
      date: date.getDate(),
      month: date.toLocaleDateString('en-US', { month: 'short' }),
    };
  });

  // Effect: Fetch availability when date changes
  React.useEffect(() => {
    const fetchSlots = async () => {
      if (selectedDate && id) {
        setAvailableSlots([]); // Clear previous slots
        // We pass the service ID as 'counselorType' for availability check
        const slots = await checkAvailability(selectedDate, id as string);
        setAvailableSlots(slots);
      }
    };
    fetchSlots();
  }, [selectedDate, id]);


  const handleBooking = async () => {
    if (!selectedDate || !selectedTime) {
      Alert.alert('Incomplete Selection', 'Please select date and time slot');
      return;
    }

    const dateObj = dates.find(d => d.id === selectedDate);
    const numericPrice = Number(price) || 0;
    const free = isFree === 'true';

    try {
      setProcessing(true);

      // Step 1: Create booking (pending for paid, confirmed for free)
      const result = await bookSession({
        counselorType: id,
        counselorName: counselorName || 'Expert Counselor',
        bookingType: id,
        bookingTitle: title,
        bookingDate: selectedDate,
        bookingTime: selectedTime,
        userNotes: notes,
        amount: free ? 0 : numericPrice
      });

      if (!result.success) {
        Alert.alert('Booking Failed', result.message || 'Please try again.');
        setProcessing(false);
        return;
      }

      // Free service: booking is already confirmed
      if (free) {
        Alert.alert(
          'Booking Confirmed! 🎉',
          `Your session with ${counselorName || 'Counselor'} on ${dateObj?.day}, ${dateObj?.date} ${dateObj?.month} at ${selectedTime} has been booked.`,
          [{ text: 'Done', onPress: () => router.push('/(home)/menu') }]
        );
        setProcessing(false);
        return;
      }

      // Paid: create payment link and open in browser (payment captured on confirm)
      const bookingId = result.bookingId;
      if (!bookingId) {
        Alert.alert('Error', 'Could not create booking. Please try again.');
        setProcessing(false);
        return;
      }

      const linkResult = await createBookingPaymentLink(bookingId);
      if (!linkResult.success || !linkResult.url) {
        Alert.alert('Payment Error', linkResult.message || 'Could not start payment.');
        setProcessing(false);
        return;
      }

      await WebBrowser.openBrowserAsync(linkResult.url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        enableBarCollapsing: true,
        showTitle: true,
      });

      if (linkResult.paymentLinkId) {
        const confirmResult = await confirmBookingPaymentLink(linkResult.paymentLinkId, bookingId);
        if (confirmResult.success) {
          Alert.alert(
            'Booking Confirmed! 🎉',
            `Your session with ${counselorName || 'Counselor'} on ${dateObj?.day}, ${dateObj?.date} ${dateObj?.month} at ${selectedTime} has been booked. Payment received.`,
            [{ text: 'Done', onPress: () => router.push('/(home)/menu') }]
          );
        } else {
          Alert.alert('Payment', confirmResult.message || 'If you paid, your booking will be confirmed shortly. Otherwise please try again.');
        }
      }
      setProcessing(false);
    } catch (e: any) {
      setProcessing(false);
      Alert.alert('Error', e?.message || 'An unexpected error occurred.');
    }
  };

  const showPayment = isFree !== 'true';
  const displayColor = (color as string) || '#3B82F6';
  const displayBgColor = (bgColor as string) || '#EFF6FF';

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
        <TouchableOpacity onPress={() => router.back()} className="w-10">
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-lg font-bold text-gray-900">Book Session</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" showsVerticalScrollIndicator={false}>
        <View className="p-5">
          {/* Service Info */}
          <View
            className="rounded-2xl p-5 mb-6 border"
            style={{
              backgroundColor: displayBgColor,
              borderColor: displayColor
            }}
          >
            <View className="flex-row justify-between items-start mb-2">
              <View className="flex-1">
                <Text className="text-xl font-bold text-gray-900 mb-1">{title}</Text>
                <Text className="text-sm text-gray-600 font-medium mb-1">{counselorName}</Text>
              </View>
              <View className="bg-white px-3 py-1 rounded-full">
                <Text className="font-bold" style={{ color: displayColor }}>
                  {isFree === 'true' ? 'FREE' : `₹${price}`}
                </Text>
              </View>
            </View>

            <Text className="text-sm text-gray-500 mb-3 leading-5">{description}</Text>

            <View className="flex-row items-center gap-4">
              <View className="flex-row items-center gap-1">
                <Ionicons name="time-outline" size={14} color="#6B7280" />
                <Text className="text-xs text-gray-500">{duration || '60 mins'}</Text>
              </View>
              <View className="flex-row items-center gap-1">
                <Ionicons name="videocam-outline" size={14} color="#6B7280" />
                <Text className="text-xs text-gray-500">Video Session</Text>
              </View>
            </View>
          </View>

          {/* Select Date */}
          <View className="mb-5">
            <Text className="text-base font-bold text-gray-900 mb-3">Select Date</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} className="gap-2">
              {dates.map((date) => {
                const isSelected = selectedDate === date.id;

                return (
                  <TouchableOpacity
                    key={date.id}
                    onPress={() => setSelectedDate(date.id)}
                    className={`w-20 p-3 rounded-xl items-center mr-2 ${isSelected ? 'border-2' : 'border border-gray-200'
                      }`}
                    style={{
                      backgroundColor: isSelected ? displayBgColor : '#FFFFFF',
                      borderColor: isSelected ? displayColor : undefined,
                    }}
                  >
                    <Text className="text-xs text-gray-500 mb-1">{date.day}</Text>
                    <Text className="text-2xl font-bold text-gray-900 mb-1">{date.date}</Text>
                    <Text className="text-xs text-gray-500">{date.month}</Text>
                  </TouchableOpacity>
                );
              })}
            </ScrollView>
          </View>

          {/* Select Time */}
          {selectedDate && (
            <View className="mb-5">
              <Text className="text-base font-bold text-gray-900 mb-3">Select Time</Text>
              {availableSlots.length === 0 ? (
                <Text className="text-gray-500 italic">No available slots for this date.</Text>
              ) : (
                <View className="flex-row flex-wrap gap-2">
                  {availableSlots.map((time) => {
                    const isSelected = selectedTime === time;
                    return (
                      <TouchableOpacity
                        key={time}
                        onPress={() => setSelectedTime(time)}
                        className={`px-4 py-3 rounded-xl ${isSelected ? 'border-2' : 'border border-gray-200'
                          }`}
                        style={{
                          backgroundColor: isSelected ? displayBgColor : '#FFFFFF',
                          borderColor: isSelected ? displayColor : undefined,
                        }}
                      >
                        <Text
                          className="text-sm font-semibold"
                          style={{ color: isSelected ? displayColor : '#6B7280' }}
                        >
                          {time}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              )}
            </View>
          )}

          {/* Additional Notes */}
          {selectedTime && (
            <View className="mb-5">
              <Text className="text-base font-bold text-gray-900 mb-3">
                Additional Notes (Optional)
              </Text>
              <TextInput
                className="bg-white border border-gray-200 rounded-xl p-4 text-sm text-gray-900"
                placeholder="Share any specific concerns or topics you'd like to discuss..."
                placeholderTextColor="#9CA3AF"
                multiline
                numberOfLines={4}
                textAlignVertical="top"
                value={notes}
                onChangeText={setNotes}
              />
            </View>
          )}

          {/* Payment Summary */}
          {selectedTime && showPayment && (
            <View className="bg-gray-50 rounded-2xl p-4 mb-5 border border-gray-200">
              <Text className="text-base font-bold text-gray-900 mb-3">Payment Summary</Text>
              <View className="flex-row justify-between items-center mb-2">
                <Text className="text-sm text-gray-600">Session Fee</Text>
                <Text className="text-sm font-semibold text-gray-900">₹{price}</Text>
              </View>
              <View className="border-t border-gray-200 pt-2 mt-2">
                <View className="flex-row justify-between items-center">
                  <Text className="text-base font-bold text-gray-900">Total</Text>
                  <Text className="text-xl font-bold text-gray-900">₹{price}</Text>
                </View>
              </View>
            </View>
          )}
        </View>
      </ScrollView>

      {/* Fixed Bottom Button */}
      {selectedDate && selectedTime && (
        <View className="bg-white border-t border-gray-200 p-4">
          <TouchableOpacity
            onPress={handleBooking}
            disabled={isLoading || processing}
            className="flex-row items-center justify-center gap-2 py-4 rounded-xl disabled:opacity-70"
            style={{ backgroundColor: displayColor }}
          >
            <Ionicons name="calendar" size={20} color="#FFFFFF" />
            <Text className="text-base font-bold text-white">
              {processing || isLoading
                ? (showPayment ? 'Opening payment...' : 'Booking...')
                : showPayment
                  ? 'Proceed to Payment'
                  : 'Confirm Booking'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
