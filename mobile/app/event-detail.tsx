import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, Linking, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import RazorpayCheckout from 'react-native-razorpay';
import Header from '../components/Header';
import { useEventStore } from '../store/eventStore';
import { useAuthStore } from '../store/authStore';
import { RAZORPAY_KEY_ID } from '../config/api';

export default function EventDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const eventId = (params.eventId as string) || (params.id as string) || '';
  const openRegister = params.openRegister as string | undefined;

  const {
    currentEvent,
    currentEventMeta,
    fetchEventDetails,
    checkRegistrationStatus,
    registerForEvent,
    createEventOrder,
    confirmEventPayment,
    cancelEventRegistration,
    isLoading
  } = useEventStore();

  const { user } = useAuthStore();
  const [processing, setProcessing] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [form, setForm] = useState({
    name: '',
    email: '',
    phone: ''
  });

  useEffect(() => {
    if (eventId) {
      fetchEventDetails(eventId);
      checkRegistrationStatus(eventId);
    }
  }, [eventId]);

  useEffect(() => {
    if (openRegister === '1') {
      setShowRegisterForm(true);
    }
  }, [openRegister]);

  useEffect(() => {
    if (user) {
      setForm({
        name: user.displayName || '',
        email: user.email || '',
        phone: user.phone || ''
      });
    }
  }, [user]);

  const event = currentEvent;
  const eventColor = event?.color || '#8B5CF6';

  const priceValue = currentEventMeta?.currentPrice ?? event?.price ?? 0;
  const isFull = currentEventMeta?.isFull ?? (event?.maxAttendees != null ? event.currentAttendees >= event.maxAttendees : false);
  const spotsLeft = currentEventMeta?.spotsLeft ?? (event?.maxAttendees != null ? event.maxAttendees - event.currentAttendees : null);
  const registrationClosed = event?.registrationDeadline ? new Date(event.registrationDeadline) < new Date() : false;
  const canRegister = currentEventMeta?.canRegister ?? (!isFull && !registrationClosed && event?.status !== 'cancelled' && event?.status !== 'past');
  const isRegistered = !!event?.isRegistered;

  const formattedDate = useMemo(() => {
    if (!event?.eventDate) return '';
    try {
      return new Date(event.eventDate).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch (e) {
      return event.eventDate;
    }
  }, [event?.eventDate]);

  const validateForm = () => {
    if (!form.name.trim()) {
      Alert.alert('Missing Info', 'Please enter your name.');
      return false;
    }
    if (!form.email.trim()) {
      Alert.alert('Missing Info', 'Please enter your email.');
      return false;
    }
    if (!form.phone.trim()) {
      Alert.alert('Missing Info', 'Please enter your phone number.');
      return false;
    }
    return true;
  };

  const submitRegistration = async (simulatePayment: boolean) => {
    if (!eventId) return;
    if (!validateForm()) return;

    setProcessing(true);
    const result = await registerForEvent(eventId, {
      name: form.name.trim(),
      email: form.email.trim(),
      phone: form.phone.trim(),
      simulatePayment,
      paymentId: simulatePayment ? `sim_${Date.now()}` : undefined
    });
    setProcessing(false);

    if (result.success) {
      setShowRegisterForm(false);
      if (result.paymentRequired) {
        Alert.alert(
          'Registration Created',
          `Please complete payment of Rs. ${result.paymentAmount ?? priceValue}.`
        );
      } else {
        Alert.alert('Registered', 'You are registered for this event.');
      }
    } else {
      Alert.alert('Registration Failed', result.message || 'Please try again.');
    }
  };

  const handlePaidEventPayment = async () => {
    if (!eventId || !validateForm()) return;
    setProcessing(true);
    try {
      const orderResult = await createEventOrder(eventId, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim()
      });
      if (!orderResult.success || !orderResult.data?.razorpay) {
        Alert.alert('Error', orderResult.message || 'Could not create order.');
        setProcessing(false);
        return;
      }
      const { orderId, amount, currency, keyId } = orderResult.data.razorpay;
      const options = {
        description: `Event: ${event?.title || 'Event'}`,
        currency: currency || 'INR',
        key: keyId || RAZORPAY_KEY_ID,
        amount,
        name: 'ParamSukh',
        order_id: orderId,
        prefill: {
          email: form.email.trim() || user?.email || '',
          contact: (form.phone.trim() || user?.phone || '').replace('+91', '').trim() || '9999999999',
          name: form.name.trim() || user?.displayName || 'ParamSukh User'
        },
        theme: { color: eventColor || '#F1842D' }
      };
      const data = await RazorpayCheckout.open(options);
      const confirmResult = await confirmEventPayment(eventId, {
        razorpay_payment_id: data.razorpay_payment_id,
        razorpay_order_id: data.razorpay_order_id,
        razorpay_signature: data.razorpay_signature
      });
      setProcessing(false);
      setShowRegisterForm(false);
      if (confirmResult.success) {
        await checkRegistrationStatus(eventId);
        Alert.alert(
          'Registered',
          'You are registered for this event. This purchase is non-refundable.',
          [{ text: 'OK' }]
        );
      } else {
        Alert.alert('Payment failed', confirmResult.message || 'Could not confirm payment.');
      }
    } catch (err: any) {
      setProcessing(false);
      if (err?.code === 2 || err?.description === 'User cancelled the payment flow') {
        return;
      }
      Alert.alert('Payment failed', err?.message || 'Could not complete payment. Please try again.');
    }
  };

  const handleCancel = async () => {
    if (!eventId) return;
    Alert.alert(
      'Cancel Registration',
      'Are you sure you want to cancel your registration?',
      [
        { text: 'No' },
        {
          text: 'Yes',
          onPress: async () => {
            setProcessing(true);
            const ok = await cancelEventRegistration(eventId);
            setProcessing(false);
            if (ok) {
              Alert.alert('Cancelled', 'Your registration has been cancelled.');
            } else {
              Alert.alert('Failed', 'Unable to cancel registration. Please try again.');
            }
          }
        }
      ]
    );
  };

  if (isLoading || !event) {
    return (
      <View className="flex-1 bg-gray-50">
        <Header />
        <View className="flex-1 items-center justify-center">
          <ActivityIndicator size="large" color={eventColor} />
        </View>
      </View>
    );
  }

  return (
    <View className="flex-1 bg-gray-50">
      <Header />
      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Banner */}
        {event.bannerUrl ? (
          <Image source={{ uri: event.bannerUrl }} className="w-full h-48" resizeMode="cover" />
        ) : (
          <View className="w-full h-36" style={{ backgroundColor: eventColor }} />
        )}

        {/* Header */}
        <View className="px-4 -mt-6">
          <View className="bg-white rounded-2xl p-4 shadow-sm">
            <View className="flex-row items-center gap-3">
              <View className="w-12 h-12 rounded-xl items-center justify-center" style={{ backgroundColor: eventColor + '20' }}>
                <Text className="text-2xl">{event.emoji || '📅'}</Text>
              </View>
              <View className="flex-1">
                <Text className="text-xl font-bold text-gray-900">{event.title}</Text>
                <Text className="text-xs text-gray-400 font-medium">{event.category}</Text>
              </View>
              <View className="px-2.5 py-1 rounded-full" style={{ backgroundColor: eventColor + '20' }}>
                <Text className="text-xs font-semibold" style={{ color: eventColor }}>{event.status || 'upcoming'}</Text>
              </View>
            </View>

            <View className="mt-3 gap-2">
              <View className="flex-row items-center gap-2">
                <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                <Text className="text-sm text-gray-600">{formattedDate}</Text>
                <Text className="text-sm text-gray-400">-</Text>
                <Ionicons name="time-outline" size={16} color="#6B7280" />
                <Text className="text-sm text-gray-600">{event.eventTime}</Text>
              </View>
              <View className="flex-row items-center gap-2">
                <Ionicons name="location-outline" size={16} color="#6B7280" />
                <Text className="text-sm text-gray-600">{event.location}</Text>
              </View>
            </View>
          </View>
        </View>

        {/* Info Cards */}
        <View className="px-4 mt-4">
          <View className="flex-row" style={{ gap: 12 }}>
            <View className="flex-1 bg-white rounded-xl p-3 border border-gray-100">
              <Text className="text-xs text-gray-400">Price</Text>
              <Text className="text-lg font-bold text-gray-900">
                {event.isPaid ? `Rs. ${priceValue}` : 'Free'}
              </Text>
            </View>
            <View className="flex-1 bg-white rounded-xl p-3 border border-gray-100">
              <Text className="text-xs text-gray-400">Attendees</Text>
              <Text className="text-lg font-bold text-gray-900">
                {event.currentAttendees}
                {event.maxAttendees ? ` / ${event.maxAttendees}` : ''}
              </Text>
              {spotsLeft !== null && (
                <Text className="text-xs text-gray-500">{spotsLeft} spots left</Text>
              )}
            </View>
          </View>
        </View>

        {/* Description */}
        <View className="px-4 mt-4">
          <View className="bg-white rounded-xl p-4 border border-gray-100">
            <Text className="text-base font-semibold text-gray-900 mb-2">About</Text>
            <Text className="text-sm text-gray-600">
              {event.description || event.shortDescription || 'No description provided.'}
            </Text>
          </View>
        </View>

        {/* Additional Info */}
        {(event.requirements?.length || event.whatToBring?.length || event.additionalInfo) && (
          <View className="px-4 mt-4">
            <View className="bg-white rounded-xl p-4 border border-gray-100">
              <Text className="text-base font-semibold text-gray-900 mb-2">Additional Info</Text>
              {event.requirements?.length ? (
                <Text className="text-sm text-gray-600 mb-2">
                  Requirements: {event.requirements.join(', ')}
                </Text>
              ) : null}
              {event.whatToBring?.length ? (
                <Text className="text-sm text-gray-600 mb-2">
                  What to bring: {event.whatToBring.join(', ')}
                </Text>
              ) : null}
              {event.additionalInfo ? (
                <Text className="text-sm text-gray-600">{event.additionalInfo}</Text>
              ) : null}
            </View>
          </View>
        )}

        {/* Online Meeting Link */}
        {(event.locationType === 'online' || event.locationType === 'hybrid') && event.onlineMeetingLink ? (
          <View className="px-4 mt-4">
            <TouchableOpacity
              className="bg-white rounded-xl p-4 border border-gray-100 flex-row items-center justify-between"
              onPress={() => Linking.openURL(event.onlineMeetingLink as string)}
            >
              <View className="flex-row items-center gap-2">
                <Ionicons name="videocam-outline" size={18} color={eventColor} />
                <Text className="text-sm font-semibold text-gray-900">Join Online Meeting</Text>
              </View>
              <Ionicons name="open-outline" size={18} color="#6B7280" />
            </TouchableOpacity>
          </View>
        ) : null}

        {/* Media Links */}
        {(event.hasRecording || event.imageCount > 0) && (
          <View className="px-4 mt-4">
            <View className="bg-white rounded-xl p-4 border border-gray-100">
              <Text className="text-base font-semibold text-gray-900 mb-3">Event Media</Text>
              <View className="flex-row" style={{ gap: 10 }}>
                {event.hasRecording && (
                  <TouchableOpacity
                    className="flex-1 flex-row items-center justify-center gap-2 py-2 rounded-lg"
                    style={{ backgroundColor: eventColor + '15' }}
                    onPress={() =>
                      router.push({
                        pathname: '/event-videos',
                        params: {
                          eventId: event._id,
                          eventTitle: event.title,
                          eventColor: event.color,
                          eventEmoji: event.emoji
                        }
                      })
                    }
                  >
                    <Ionicons name="play-circle" size={18} color={eventColor} />
                    <Text className="text-sm font-semibold" style={{ color: eventColor }}>Videos</Text>
                  </TouchableOpacity>
                )}
                {event.imageCount > 0 && (
                  <TouchableOpacity
                    className="flex-1 flex-row items-center justify-center gap-2 py-2 rounded-lg"
                    style={{ backgroundColor: eventColor + '15' }}
                    onPress={() =>
                      router.push({
                        pathname: '/event-photos',
                        params: {
                          eventId: event._id,
                          eventTitle: event.title,
                          eventColor: event.color,
                          eventEmoji: event.emoji,
                          imageCount: event.imageCount.toString()
                        }
                      })
                    }
                  >
                    <Ionicons name="images" size={18} color={eventColor} />
                    <Text className="text-sm font-semibold" style={{ color: eventColor }}>Photos</Text>
                  </TouchableOpacity>
                )}
              </View>
            </View>
          </View>
        )}

        {/* Registration */}
        <View className="px-4 mt-4 mb-6">
          <View className="bg-white rounded-2xl p-4 border border-gray-100">
            <Text className="text-base font-semibold text-gray-900 mb-2">Registration</Text>
            {isRegistered ? (
              <View className="flex-row items-center gap-2 mb-3">
                <Ionicons name="checkmark-circle" size={18} color="#10B981" />
                <Text className="text-sm text-gray-700">You are registered for this event.</Text>
              </View>
            ) : (
              <Text className="text-sm text-gray-600 mb-3">
                {canRegister ? 'Reserve your spot now.' : 'Registration is not available for this event.'}
              </Text>
            )}

            {isRegistered ? (
              <TouchableOpacity
                className="w-full py-3 rounded-lg items-center"
                style={{ backgroundColor: '#EF4444' }}
                disabled={processing}
                onPress={handleCancel}
              >
                <Text className="text-white font-semibold">
                  {processing ? 'Cancelling...' : 'Cancel Registration'}
                </Text>
              </TouchableOpacity>
            ) : (
              <TouchableOpacity
                className="w-full py-3 rounded-lg items-center"
                style={{ backgroundColor: canRegister ? eventColor : '#9CA3AF' }}
                disabled={!canRegister || processing}
                onPress={() => setShowRegisterForm(true)}
              >
                <Text className="text-white font-semibold">
                  {processing
                    ? 'Registering...'
                    : canRegister
                      ? event.isPaid
                        ? `Register - Rs. ${priceValue}`
                        : 'Register for Free'
                      : 'Registration Closed'}
                </Text>
              </TouchableOpacity>
            )}
          </View>
        </View>

      </ScrollView>

      {/* Register Modal */}
      {showRegisterForm && (
        <View className="absolute inset-0 bg-black/50 items-center justify-center p-4">
          <View className="bg-white w-full max-w-lg rounded-2xl p-4">
            <View className="flex-row items-center justify-between mb-3">
              <Text className="text-lg font-semibold text-gray-900">Register for Event</Text>
              <TouchableOpacity onPress={() => setShowRegisterForm(false)}>
                <Ionicons name="close" size={22} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View className="gap-3">
              <View>
                <Text className="text-xs text-gray-500 mb-1">Full Name</Text>
                <TextInput
                  value={form.name}
                  onChangeText={(text) => setForm({ ...form, name: text })}
                  placeholder="Your name"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
              </View>
              <View>
                <Text className="text-xs text-gray-500 mb-1">Email</Text>
                <TextInput
                  value={form.email}
                  onChangeText={(text) => setForm({ ...form, email: text })}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
              </View>
              <View>
                <Text className="text-xs text-gray-500 mb-1">Phone</Text>
                <TextInput
                  value={form.phone}
                  onChangeText={(text) => setForm({ ...form, phone: text })}
                  placeholder="Phone number"
                  keyboardType="phone-pad"
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg"
                />
              </View>
            </View>

            <View className="mt-4">
              {event.isPaid ? (
                <>
                  <Text className="text-xs text-amber-600 text-center mb-2">
                    This purchase is non-refundable.
                  </Text>
                  <TouchableOpacity
                    className="w-full py-3 rounded-lg items-center"
                    style={{ backgroundColor: eventColor }}
                    disabled={processing}
                    onPress={handlePaidEventPayment}
                  >
                    <Text className="text-white font-semibold">
                      {processing ? 'Processing...' : `Pay Rs. ${priceValue} with Razorpay`}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  className="w-full py-3 rounded-lg items-center"
                  style={{ backgroundColor: eventColor }}
                  disabled={processing}
                  onPress={() => submitRegistration(false)}
                >
                  <Text className="text-white font-semibold">
                    {processing ? 'Registering...' : 'Register'}
                  </Text>
                </TouchableOpacity>
              )}

              {!event.isPaid && (
                <Text className="text-xs text-gray-500 text-center mt-2">
                  Free event. No payment required.
                </Text>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
