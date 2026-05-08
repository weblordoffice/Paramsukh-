import React, { useEffect, useMemo, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, Image, ActivityIndicator, Alert, Linking, TextInput, Animated, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useEventStore } from '../store/eventStore';
import { useAuthStore } from '../store/authStore';

export default function EventDetailScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const params = useLocalSearchParams();
  const eventId = (params.eventId as string) || (params.id as string) || '';
  const openRegister = params.openRegister as string | undefined;

  const {
    currentEvent,
    currentEventMeta,
    fetchEventDetails,
    checkRegistrationStatus,
    registerForEvent,
    createEventPaymentLink,
    confirmEventPaymentByLink,
    cancelEventRegistration,
    isLoading,
    isCheckingRegistration
  } = useEventStore();

  const { user } = useAuthStore();
  const [processing, setProcessing] = useState(false);
  const [showRegisterForm, setShowRegisterForm] = useState(false);
  const [fadeAnim] = useState(new Animated.Value(0));
  
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
  }, [eventId, checkRegistrationStatus, fetchEventDetails]);

  useEffect(() => {
    if (!isLoading && currentEvent) {
      Animated.timing(fadeAnim, {
        toValue: 1,
        duration: 400,
        useNativeDriver: true,
      }).start();
    }
  }, [isLoading, currentEvent]);

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

  const event = currentEvent?._id === eventId ? currentEvent : null;
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
      const date = new Date(event.eventDate);
      return date.toLocaleDateString('en-US', {
        weekday: 'long',
        month: 'long',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
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
        Alert.alert('Registered Successfully', 'You are now registered for this event.');
      }
    } else {
      Alert.alert('Registration Failed', result.message || 'Please try again.');
    }
  };

  const handlePaidEventPayment = async () => {
    if (!eventId || !validateForm()) return;
    setProcessing(true);
    try {
      const linkResult = await createEventPaymentLink(eventId, {
        name: form.name.trim(),
        email: form.email.trim(),
        phone: form.phone.trim()
      });
      if (!linkResult.success || !linkResult.url) {
        Alert.alert('Error', linkResult.message || 'Could not create payment.');
        setProcessing(false);
        return;
      }
      
      const browserResult = await WebBrowser.openBrowserAsync(linkResult.url, {
        presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
      });

      if (linkResult.paymentLinkId) {
        const confirmResult = await confirmEventPaymentByLink(eventId, linkResult.paymentLinkId);
        setProcessing(false);
        setShowRegisterForm(false);
        if (confirmResult.success) {
          Alert.alert(
            'Registration Confirmed',
            'You are registered for this event. You can find your ticket in the events list.',
            [{ text: 'Great!' }]
          );
        } else {
          // If browser closed but payment check failed, it might be because they didn't pay
          // We don't necessarily show an error unless we are sure.
        }
      } else setProcessing(false);
    } catch (err: any) {
      setProcessing(false);
      Alert.alert('Payment failed', err?.message || 'Could not complete payment. Please try again.');
    }
  };

  const handleCancel = async () => {
    if (!eventId) return;
    Alert.alert(
      'Cancel Registration',
      'Are you sure you want to cancel your registration?',
      [
        { text: 'Keep it', style: 'cancel' },
        {
          text: 'Yes, Cancel',
          style: 'destructive',
          onPress: async () => {
            setProcessing(true);
            const ok = await cancelEventRegistration(eventId);
            setProcessing(false);
            if (ok) {
              Alert.alert('Cancelled', 'Your registration has been successfully cancelled.');
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
      <View style={{ flex: 1, backgroundColor: '#FFFFFF', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color={eventColor} />
      </View>
    );
  }

  return (
    <View style={{ flex: 1, backgroundColor: '#FFFFFF' }}>
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: 100 }}
      >
        {/* Banner with Floating Back Button */}
        <View style={{ position: 'relative' }}>
          {event.bannerUrl ? (
            <Image 
              source={{ uri: event.bannerUrl }} 
              style={{ width: '100%', height: 280 }} 
              resizeMode="cover" 
            />
          ) : (
            <View style={{ width: '100%', height: 180, backgroundColor: eventColor }} />
          )}
          
          {/* Back Button */}
          <TouchableOpacity
            style={{
              position: 'absolute',
              top: insets.top + 10,
              left: 20,
              width: 44,
              height: 44,
              borderRadius: 22,
              backgroundColor: 'rgba(0,0,0,0.3)',
              alignItems: 'center',
              justifyContent: 'center',
              zIndex: 10
            }}
            onPress={() => router.back()}
          >
            <Ionicons name="arrow-back" size={24} color="#FFFFFF" />
          </TouchableOpacity>

          {/* Gradient Overlay for Title if no banner */}
          {!event.bannerUrl && (
            <View style={{ position: 'absolute', bottom: 0, left: 0, right: 0, height: 60, backgroundColor: 'rgba(0,0,0,0.1)' }} />
          )}
        </View>

        <Animated.View style={{ padding: 24, opacity: fadeAnim }}>
          {/* Title and Category */}
          <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' }}>
            <View style={{ flex: 1 }}>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 8 }}>
                <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: eventColor + '15' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: eventColor, textTransform: 'uppercase' }}>
                    {event.category}
                  </Text>
                </View>
                <View style={{ width: 8 }} />
                <View style={{ paddingHorizontal: 12, paddingVertical: 4, borderRadius: 20, backgroundColor: '#F3F4F6' }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: '#4B5563', textTransform: 'uppercase' }}>
                    {event.status === 'cancelled' 
                      ? 'Cancelled' 
                      : (event.startTime && new Date() > new Date(event.startTime) ? 'Past' : 'Upcoming')}
                  </Text>
                </View>
              </View>
              <Text style={{ fontSize: 28, fontWeight: '800', color: '#111827', lineHeight: 34 }}>
                {event.title}
              </Text>
            </View>
            <View style={{ width: 56, height: 56, borderRadius: 16, backgroundColor: eventColor + '10', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontSize: 32 }}>{event.emoji || '📅'}</Text>
            </View>
          </View>

          {/* Quick Info Grid */}
          <View style={{ flexDirection: 'row', marginTop: 24, gap: 12 }}>
            <View style={{ flex: 1, backgroundColor: '#F9FAFB', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' }}>
              <Ionicons name="calendar" size={20} color={eventColor} />
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 8, fontWeight: '600' }}>DATE</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F2937', marginTop: 2 }}>
                {formattedDate.split(',')[1]?.trim() || formattedDate}
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#F9FAFB', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' }}>
              <Ionicons name="time" size={20} color={eventColor} />
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 8, fontWeight: '600' }}>TIME</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F2937', marginTop: 2 }}>
                {event.eventTime}
              </Text>
            </View>
          </View>

          <View style={{ flexDirection: 'row', marginTop: 12, gap: 12 }}>
            <View style={{ flex: 1, backgroundColor: '#F9FAFB', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' }}>
              <Ionicons name="location" size={20} color={eventColor} />
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 8, fontWeight: '600' }}>LOCATION</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F2937', marginTop: 2 }} numberOfLines={1}>
                {event.location}
              </Text>
            </View>
            <View style={{ flex: 1, backgroundColor: '#F9FAFB', borderRadius: 20, padding: 16, borderWidth: 1, borderColor: '#F3F4F6' }}>
              <Ionicons name="people" size={20} color={eventColor} />
              <Text style={{ fontSize: 12, color: '#6B7280', marginTop: 8, fontWeight: '600' }}>SPOTS</Text>
              <Text style={{ fontSize: 15, fontWeight: '700', color: '#1F2937', marginTop: 2 }}>
                {spotsLeft !== null ? `${spotsLeft} Left` : 'Unlimited'}
              </Text>
            </View>
          </View>

          {/* Description Section */}
          <View style={{ marginTop: 32 }}>
            <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 12 }}>About the Event</Text>
            <Text style={{ fontSize: 16, color: '#4B5563', lineHeight: 24 }}>
              {event.description || event.shortDescription || 'No detailed description available for this event.'}
            </Text>
          </View>

          {/* Requirements & Info */}
          {(event.requirements?.length > 0 || event.whatToBring?.length > 0 || event.additionalInfo) && (
            <View style={{ marginTop: 32, backgroundColor: '#F9FAFB', borderRadius: 24, padding: 24 }}>
              <Text style={{ fontSize: 18, fontWeight: '800', color: '#111827', marginBottom: 16 }}>Important Information</Text>
              
              {event.requirements?.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 6 }}>Requirements</Text>
                  {event.requirements.map((item: string, idx: number) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <View style={{ width: 6, height: 6, borderRadius: 3, backgroundColor: eventColor, marginRight: 10 }} />
                      <Text style={{ fontSize: 15, color: '#4B5563' }}>{item}</Text>
                    </View>
                  ))}
                </View>
              )}

              {event.whatToBring?.length > 0 && (
                <View style={{ marginBottom: 16 }}>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 6 }}>What to Bring</Text>
                  {event.whatToBring.map((item: string, idx: number) => (
                    <View key={idx} style={{ flexDirection: 'row', alignItems: 'center', marginBottom: 4 }}>
                      <Ionicons name="add-circle" size={14} color={eventColor} style={{ marginRight: 6 }} />
                      <Text style={{ fontSize: 15, color: '#4B5563' }}>{item}</Text>
                    </View>
                  ))}
                </View>
              )}

              {event.additionalInfo && (
                <View>
                  <Text style={{ fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 6 }}>Notes</Text>
                  <Text style={{ fontSize: 15, color: '#4B5563' }}>{event.additionalInfo}</Text>
                </View>
              )}
            </View>
          )}

          {/* Online Link */}
          {(event.locationType === 'online' || event.locationType === 'hybrid') && event.onlineMeetingLink && (
            <TouchableOpacity 
              style={{ 
                marginTop: 32, 
                backgroundColor: '#EFF6FF', 
                borderRadius: 20, 
                padding: 20, 
                flexDirection: 'row', 
                alignItems: 'center',
                borderWidth: 1,
                borderColor: '#DBEAFE'
              }}
              onPress={() => Linking.openURL(event.onlineMeetingLink as string)}
            >
              <View style={{ width: 44, height: 44, borderRadius: 12, backgroundColor: '#3B82F6', alignItems: 'center', justifyContent: 'center', marginRight: 16 }}>
                <Ionicons name="videocam" size={24} color="#FFFFFF" />
              </View>
              <View style={{ flex: 1 }}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#1E40AF' }}>Join Online Meeting</Text>
                <Text style={{ fontSize: 14, color: '#3B82F6' }}>Link is active for registered users</Text>
              </View>
              <Ionicons name="chevron-forward" size={20} color="#3B82F6" />
            </TouchableOpacity>
          )}

          {/* Organizer */}
          {event.organizer && (
            <View style={{ marginTop: 32, borderTopWidth: 1, borderTopColor: '#F3F4F6', paddingTop: 24 }}>
              <Text style={{ fontSize: 14, color: '#6B7280', fontWeight: '600' }}>ORGANIZER</Text>
              <View style={{ flexDirection: 'row', alignItems: 'center', marginTop: 12 }}>
                <View style={{ width: 48, height: 48, borderRadius: 24, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                  <Ionicons name="business" size={24} color="#9CA3AF" />
                </View>
                <View style={{ marginLeft: 12 }}>
                  <Text style={{ fontSize: 17, fontWeight: '700', color: '#1F2937' }}>{event.organizer}</Text>
                  <Text style={{ fontSize: 14, color: '#6B7280' }}>Event Host</Text>
                </View>
              </View>
            </View>
          )}
        </Animated.View>
      </ScrollView>

      {/* Bottom Registration Action Bar */}
      <View 
        style={{ 
          position: 'absolute', 
          bottom: 0, 
          left: 0, 
          right: 0, 
          backgroundColor: '#FFFFFF', 
          paddingHorizontal: 24, 
          paddingTop: 16, 
          paddingBottom: Math.max(insets.bottom, 16),
          borderTopWidth: 1,
          borderTopColor: '#F3F4F6',
          flexDirection: 'row',
          alignItems: 'center',
          justifyContent: 'space-between',
          shadowColor: '#000',
          shadowOffset: { width: 0, height: -4 },
          shadowOpacity: 0.05,
          shadowRadius: 10,
          elevation: 20
        }}
      >
        <View>
          <Text style={{ fontSize: 14, color: '#6B7280', fontWeight: '600' }}>PRICING</Text>
          <Text style={{ fontSize: 24, fontWeight: '800', color: '#111827' }}>
            {event.isPaid ? `Rs. ${priceValue}` : 'Free'}
          </Text>
        </View>

        {isCheckingRegistration ? (
          <View style={{ width: 160, height: 56, borderRadius: 16, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
            <ActivityIndicator size="small" color={eventColor} />
          </View>
        ) : event.hasAttended ? (
          <View style={{ 
            backgroundColor: '#3B82F6', 
            paddingHorizontal: 32, 
            height: 56, 
            borderRadius: 16, 
            alignItems: 'center', 
            justifyContent: 'center',
            flexDirection: 'row'
          }}>
            <Ionicons name="star" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
            <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Attended</Text>
          </View>
        ) : isRegistered ? (
          <TouchableOpacity
            style={{ 
              backgroundColor: '#EF4444', 
              paddingHorizontal: 24, 
              height: 56, 
              borderRadius: 16, 
              alignItems: 'center', 
              justifyContent: 'center',
              flexDirection: 'row'
            }}
            onPress={handleCancel}
            disabled={processing}
          >
            {processing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="close-circle" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>Cancel</Text>
              </>
            )}
          </TouchableOpacity>
        ) : (
          <TouchableOpacity
            style={{ 
              backgroundColor: canRegister ? eventColor : '#9CA3AF', 
              paddingHorizontal: 32, 
              height: 56, 
              borderRadius: 16, 
              alignItems: 'center', 
              justifyContent: 'center',
              shadowColor: eventColor,
              shadowOffset: { width: 0, height: 8 },
              shadowOpacity: 0.3,
              shadowRadius: 12,
              elevation: 8
            }}
            disabled={!canRegister || processing}
            onPress={() => setShowRegisterForm(true)}
          >
            {processing ? (
              <ActivityIndicator color="#FFFFFF" />
            ) : (
              <Text style={{ color: '#FFFFFF', fontSize: 16, fontWeight: '700' }}>
                {canRegister ? 'Register Now' : 'Closed'}
              </Text>
            )}
          </TouchableOpacity>
        )}
      </View>

      {/* Register Form Modal */}
      {showRegisterForm && (
        <View style={{ position: 'absolute', inset: 0, backgroundColor: 'rgba(0,0,0,0.6)', alignItems: 'center', justifyContent: 'center', padding: 20, zIndex: 100 }}>
          <View style={{ backgroundColor: '#FFFFFF', width: '100%', maxWidth: 450, borderRadius: 32, padding: 24, shadowColor: '#000', shadowOffset: { width: 0, height: 20 }, shadowOpacity: 0.2, shadowRadius: 40, elevation: 25 }}>
            <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 24 }}>
              <View>
                <Text style={{ fontSize: 22, fontWeight: '800', color: '#111827' }}>Registration</Text>
                <Text style={{ fontSize: 14, color: '#6B7280', marginTop: 2 }}>Confirm your details</Text>
              </View>
              <TouchableOpacity onPress={() => setShowRegisterForm(false)} style={{ width: 40, height: 40, borderRadius: 20, backgroundColor: '#F3F4F6', alignItems: 'center', justifyContent: 'center' }}>
                <Ionicons name="close" size={20} color="#6B7280" />
              </TouchableOpacity>
            </View>

            <View style={{ gap: 20 }}>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8, marginLeft: 4 }}>Full Name</Text>
                <TextInput
                  value={form.name}
                  onChangeText={(text) => setForm({ ...form, name: text })}
                  placeholder="Enter your name"
                  style={{ width: '100%', height: 56, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 16, paddingHorizontal: 16, fontSize: 16, color: '#111827' }}
                />
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8, marginLeft: 4 }}>Email Address</Text>
                <TextInput
                  value={form.email}
                  onChangeText={(text) => setForm({ ...form, email: text })}
                  placeholder="you@example.com"
                  keyboardType="email-address"
                  autoCapitalize="none"
                  style={{ width: '100%', height: 56, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 16, paddingHorizontal: 16, fontSize: 16, color: '#111827' }}
                />
              </View>
              <View>
                <Text style={{ fontSize: 14, fontWeight: '700', color: '#374151', marginBottom: 8, marginLeft: 4 }}>Phone Number</Text>
                <TextInput
                  value={form.phone}
                  onChangeText={(text) => setForm({ ...form, phone: text })}
                  placeholder="Your mobile number"
                  keyboardType="phone-pad"
                  style={{ width: '100%', height: 56, backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#F3F4F6', borderRadius: 16, paddingHorizontal: 16, fontSize: 16, color: '#111827' }}
                />
              </View>
            </View>

            <View style={{ mt: 24, marginTop: 32 }}>
              {event.isPaid ? (
                <>
                  <View style={{ backgroundColor: '#FFFBEB', padding: 12, borderRadius: 12, marginBottom: 16, flexDirection: 'row', alignItems: 'center' }}>
                    <Ionicons name="information-circle" size={18} color="#D97706" style={{ marginRight: 8 }} />
                    <Text style={{ fontSize: 12, color: '#B45309', fontWeight: '600' }}>
                      Tickets are non-refundable once purchased.
                    </Text>
                  </View>
                  <TouchableOpacity
                    style={{ backgroundColor: eventColor, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowColor: eventColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 10 }}
                    disabled={processing}
                    onPress={handlePaidEventPayment}
                  >
                    <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800' }}>
                      {processing ? 'Processing...' : `Pay Rs. ${priceValue}`}
                    </Text>
                  </TouchableOpacity>
                </>
              ) : (
                <TouchableOpacity
                  style={{ backgroundColor: eventColor, height: 60, borderRadius: 18, alignItems: 'center', justifyContent: 'center', shadowColor: eventColor, shadowOffset: { width: 0, height: 8 }, shadowOpacity: 0.3, shadowRadius: 15, elevation: 10 }}
                  disabled={processing}
                  onPress={() => submitRegistration(false)}
                >
                  <Text style={{ color: '#FFFFFF', fontSize: 18, fontWeight: '800' }}>
                    {processing ? 'Processing...' : 'Confirm Registration'}
                  </Text>
                </TouchableOpacity>
              )}
            </View>
          </View>
        </View>
      )}
    </View>
  );
}
