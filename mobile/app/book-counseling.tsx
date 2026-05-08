import React, { useState } from 'react';
import { ScrollView, Text, TouchableOpacity, View, TextInput, Alert, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useRouter, useLocalSearchParams } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useCounselingStore } from '../store/counselingStore';
import { Calendar } from 'react-native-calendars';

export default function BookCounselingScreen() {
  const router = useRouter();
  const { id } = useLocalSearchParams();
  const { counselingTypes, checkAvailability, bookSession, createBookingPaymentLink, confirmBookingPaymentLink, isLoading } = useCounselingStore();
  
  // Safely extract from store instead of URL params
  const service = counselingTypes.find(t => t.id === id) || counselingTypes[0]; // fallback
  const title = service?.title || 'Counseling Session';
  const description = service?.description || '';
  const price = service?.price || 0;
  const counselorName = service?.counselorName || 'Expert Counselor';
  const duration = service?.duration || '60 mins';
  const color = service?.color || '#F1842D';
  const bgColor = service?.bgColor || '#FDF8F3';
  const isFree = service?.isFree ? 'true' : 'false';
  const usesCalendly = service?.usesCalendly ? 'true' : 'false';
  const calendlyUri = service?.calendlyEventUri || '';

  // Set today as initial date
  const today = new Date().toISOString().split('T')[0];
  const [selectedDate, setSelectedDate] = useState<string>(today);
  const [selectedTime, setSelectedTime] = useState<string | null>(null);
  const [notes, setNotes] = useState('');

  const [availableSlots, setAvailableSlots] = useState<string[]>([]);
  const [fetchingSlots, setFetchingSlots] = useState(false);
  const [processing, setProcessing] = useState(false);

  // Redirect to Calendly if service uses it
  React.useEffect(() => {
    if (usesCalendly === 'true' && calendlyUri) {
      WebBrowser.openBrowserAsync(calendlyUri as string, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
        enableBarCollapsing: true,
        showTitle: true,
      });
      // Go back after opening Calendly
      setTimeout(() => {
        router.back();
      }, 1000);
    }
  }, []);

  // Effect: Fetch availability when date changes
  React.useEffect(() => {
    const fetchSlots = async () => {
      if (selectedDate && id) {
        setFetchingSlots(true);
        setAvailableSlots([]); // Clear previous slots
        setSelectedTime(null); // Reset time when date changes
        try {
          // We pass the service _id as 'counselorType' for real availability API
          const slots = await checkAvailability(selectedDate, id as string);
          setAvailableSlots(slots);
        } catch (error) {
        } finally {
          setFetchingSlots(false);
        }
      }
    };
    fetchSlots();
  }, [selectedDate, id, title, checkAvailability]);


  const handleBooking = async () => {
    if (!selectedDate || !selectedTime) {
      Alert.alert('Incomplete Selection', 'Please select date and time slot');
      return;
    }

    const formattedDateString = new Date(selectedDate).toLocaleDateString('en-IN', {
      weekday: 'short',
      day: 'numeric',
      month: 'short'
    });
    const numericPrice = Number(price) || 0;
    const free = isFree === 'true';

    try {
      setProcessing(true);

      // Step 1: Create booking (pending for paid, confirmed for free)
      const result = await bookSession({
        counselorType: title, // Use service title as type
        counselorName: counselorName || 'Expert Counselor',
        bookingType: title,
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
          `Your session with ${counselorName || 'Counselor'} on ${formattedDateString} at ${selectedTime} has been booked.`,
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
            `Your session with ${counselorName || 'Counselor'} on ${formattedDateString} at ${selectedTime} has been booked. Payment received.`,
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

  // If this is a Calendly service, show a loading state while redirecting
  if (usesCalendly === 'true') {
    return (
      <SafeAreaView style={{ flex: 1, backgroundColor: '#F9FAFB' }}>
        <View style={{ flex: 1, alignItems: 'center', justifyContent: 'center' }}>
          <ActivityIndicator size="large" color={displayColor} />
          <Text style={{ color: '#6B7280', marginTop: 16 }}>Opening Calendly...</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={{ flex: 1, backgroundColor: '#FDF8F3' }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' }}>
        <TouchableOpacity onPress={() => router.back()} style={{ width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', borderRadius: 20 }}>
          <Ionicons name="arrow-back" size={20} color="#2C2420" />
        </TouchableOpacity>
        <Text style={{ fontSize: 18, fontWeight: '700', color: '#2C2420' }}>Book Session</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={{ padding: 20, paddingBottom: 36 }} showsVerticalScrollIndicator={false}>
        <View style={{ borderRadius: 24, padding: 20, marginBottom: 20, backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F3F4F6' }}>
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 10 }}>
            <View style={{ flex: 1, paddingRight: 12 }}>
              <Text style={{ fontSize: 22, fontWeight: '800', color: '#2C2420', marginBottom: 4 }}>{title}</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#F1842D' }}>{counselorName}</Text>
            </View>
            <View style={{ paddingHorizontal: 12, paddingVertical: 6, borderRadius: 12, backgroundColor: displayColor + '15' }}>
              <Text style={{ fontWeight: '700', fontSize: 12, color: displayColor }}>
                {isFree === 'true' ? 'FREE' : `₹${price}`}
              </Text>
            </View>
          </View>

          <Text style={{ fontSize: 14, color: '#5C4A42', marginBottom: 14, lineHeight: 20 }}>{description}</Text>

          <View style={{ flexDirection: 'row', alignItems: 'center', columnGap: 16, borderTopWidth: 1, borderTopColor: '#F9FAFB', paddingTop: 12 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="time-outline" size={16} color="#8C7B73" />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#8C7B73', marginLeft: 6 }}>{duration || '60 mins'}</Text>
            </View>
            <View style={{ flexDirection: 'row', alignItems: 'center' }}>
              <Ionicons name="videocam-outline" size={16} color="#8C7B73" />
              <Text style={{ fontSize: 12, fontWeight: '600', color: '#8C7B73', marginLeft: 6 }}>Video Call</Text>
            </View>
          </View>
        </View>

        <View style={{ marginBottom: 20 }}>
          <Text style={{ fontSize: 16, fontWeight: '700', color: '#2C2420', marginBottom: 10 }}>Select Date</Text>
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, overflow: 'hidden', borderWidth: 1, borderColor: '#F3F4F6', padding: 8 }}>
            <Calendar
              current={today}
              minDate={today}
              onDayPress={(day: any) => setSelectedDate(day.dateString)}
              markedDates={{
                [selectedDate]: { selected: true, selectedColor: displayColor }
              }}
              theme={{
                calendarBackground: '#ffffff',
                textSectionTitleColor: '#8C7B73',
                selectedDayBackgroundColor: displayColor,
                selectedDayTextColor: '#ffffff',
                todayTextColor: displayColor,
                dayTextColor: '#2C2420',
                textDisabledColor: '#E5E7EB',
                dotColor: displayColor,
                selectedDotColor: '#ffffff',
                arrowColor: displayColor,
                monthTextColor: '#2C2420',
                indicatorColor: displayColor,
                textDayFontWeight: '600',
                textMonthFontWeight: 'bold',
                textDayHeaderFontWeight: '600',
                textDayFontSize: 15,
                textMonthFontSize: 16,
                textDayHeaderFontSize: 13,
              }}
            />
          </View>
        </View>

        {selectedDate && (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#2C2420', marginBottom: 10 }}>Select Time</Text>
            {fetchingSlots ? (
              <View style={{ backgroundColor: '#FFFFFF', padding: 16, borderRadius: 24, borderWidth: 1, borderColor: '#F3F4F6', flexDirection: 'row', justifyContent: 'center', alignItems: 'center' }}>
                <ActivityIndicator size="small" color={displayColor} />
                <Text style={{ color: '#8C7B73', fontWeight: '500', marginLeft: 10 }}>Finding available slots...</Text>
              </View>
            ) : availableSlots.length === 0 ? (
              <View style={{ backgroundColor: '#FFF7ED', padding: 16, borderRadius: 24, borderWidth: 1, borderColor: '#FED7AA', flexDirection: 'row', alignItems: 'center' }}>
                <Ionicons name="information-circle" size={24} color="#F97316" />
                <Text style={{ color: '#9A3412', fontSize: 13, fontWeight: '500', flex: 1, marginLeft: 10 }}>No slots available for this date. Try another day.</Text>
              </View>
            ) : (
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 10 }}>
                {availableSlots.map((time) => {
                  const isSelected = selectedTime === time;
                  return (
                    <TouchableOpacity
                      key={time}
                      onPress={() => setSelectedTime(time)}
                      activeOpacity={0.7}
                      style={{
                        paddingHorizontal: 16,
                        paddingVertical: 10,
                        borderRadius: 16,
                        backgroundColor: isSelected ? displayColor + '10' : '#FFFFFF',
                        borderWidth: isSelected ? 2 : 1,
                        borderColor: isSelected ? displayColor : '#F3F4F6'
                      }}
                    >
                      <Text style={{ fontSize: 14, fontWeight: '700', color: isSelected ? displayColor : '#5C4A42' }}>{time}</Text>
                    </TouchableOpacity>
                  );
                })}
              </View>
            )}
          </View>
        )}

        {selectedTime && (
          <View style={{ marginBottom: 20 }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#2C2420', marginBottom: 10 }}>Additional Notes (Optional)</Text>
            <TextInput
              style={{ backgroundColor: '#FFFFFF', borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 24, padding: 16, minHeight: 96, color: '#2C2420' }}
              placeholder="Share any specific concerns or topics you'd like to discuss before the session..."
              placeholderTextColor="#9CA3AF"
              multiline
              numberOfLines={4}
              textAlignVertical="top"
              value={notes}
              onChangeText={setNotes}
            />
          </View>
        )}

        {selectedTime && showPayment && (
          <View style={{ backgroundColor: '#FFFFFF', borderRadius: 24, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' }}>
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#2C2420', marginBottom: 12 }}>Payment Summary</Text>
            <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
              <Text style={{ fontSize: 14, fontWeight: '500', color: '#5C4A42' }}>Session Fee</Text>
              <Text style={{ fontSize: 14, fontWeight: '600', color: '#2C2420' }}>₹{price}</Text>
            </View>
            <View style={{ borderTopWidth: 1, borderTopColor: '#E5E7EB', marginTop: 8, paddingTop: 12, flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
              <Text style={{ fontSize: 16, fontWeight: '700', color: '#2C2420' }}>Total Amount</Text>
              <Text style={{ fontSize: 20, fontWeight: '800', color: '#F1842D' }}>₹{price}</Text>
            </View>
          </View>
        )}
      </ScrollView>

      {selectedDate && selectedTime && (
        <View style={{ backgroundColor: '#FFFFFF', paddingTop: 12, paddingBottom: 24, paddingHorizontal: 20, borderTopWidth: 1, borderTopColor: '#F3F4F6' }}>
          <TouchableOpacity
            onPress={handleBooking}
            disabled={isLoading || processing}
            activeOpacity={0.8}
            style={{
              flexDirection: 'row',
              alignItems: 'center',
              justifyContent: 'center',
              paddingVertical: 14,
              borderRadius: 16,
              backgroundColor: displayColor,
              opacity: isLoading || processing ? 0.7 : 1
            }}
          >
            {processing || isLoading ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <Ionicons name="calendar" size={20} color="#FFFFFF" />
            )}
            <Text style={{ fontSize: 16, fontWeight: '700', color: '#FFFFFF', marginLeft: 8 }}>
              {processing || isLoading
                ? (showPayment ? 'Opening secure payment...' : 'Confirming booking...')
                : showPayment
                  ? `Pay ₹${price} & Book`
                  : 'Confirm Free Booking'}
            </Text>
          </TouchableOpacity>
        </View>
      )}
    </SafeAreaView>
  );
}
