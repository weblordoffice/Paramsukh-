import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';
import * as Haptics from 'expo-haptics';

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.startsWith('91') && digits.length > 10 ? digits.slice(2) : digits;
  return `+91${normalized.slice(-10)}`;
}

export default function VerifyPhoneScreen() {
  const router = useRouter();
  const { sendOTP, verifyOTP, logout, isLoading, user } = useAuthStore();
  const scrollViewRef = useRef<ScrollView>(null);
  const otpInputRef = useRef<TextInput>(null);

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const resendIntervalRef = useRef<any>(null);

  useEffect(() => {
    return () => {
      if (resendIntervalRef.current) {
        clearInterval(resendIntervalRef.current);
      }
    };
  }, []);

  const handleSendOTP = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert('Error', 'Enter valid 10-digit phone number');
      return;
    }

    const formattedPhone = formatPhone(phone);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await sendOTP(formattedPhone, 'signup'); // using default signup purpose to signify verification

    if (result.success) {
      setOtpSent(true);
      Alert.alert('OTP Sent', 'Check your phone for the verification code.');
      startResendTimer();
    } else {
      Alert.alert('Error', result.message || 'Failed to send OTP');
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      Alert.alert('Error', 'Enter 6-digit OTP');
      return;
    }

    const formattedPhone = formatPhone(phone);
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);

    const result = await verifyOTP(formattedPhone, otp);

    if (result.success) {
      Alert.alert('Success', 'Phone number linked successfully!', [
        {
          text: 'Proceed',
          onPress: () => router.replace('/')
        }
      ]);
    } else {
      Alert.alert('Verification Failed', result.message || 'Verification failed');
    }
  };

  const handleLogout = async () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    await logout();
    router.replace('/signin');
  };

  const startResendTimer = () => {
    setResendTimer(60);
    if (resendIntervalRef.current) clearInterval(resendIntervalRef.current);
    resendIntervalRef.current = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(resendIntervalRef.current!);
          resendIntervalRef.current = null;
          return 0;
        }
        return prev - 1;
      });
    }, 1000);
  };

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={{ flex: 1 }}
      className="bg-gray-50"
    >
      <ScrollView
        ref={scrollViewRef}
        style={{ flex: 1 }}
        contentContainerStyle={{
          paddingBottom: 200,
          minHeight: '100%'
        }}
        keyboardShouldPersistTaps="handled"
        showsVerticalScrollIndicator={false}
      >
        <View className="bg-white pt-20 pb-10 px-6 items-center border-b border-gray-100">
          <Image
            source={require('../assets/paramsukh.png')}
            className="w-36 h-36 mb-4"
            resizeMode="contain"
          />
          <Text className="text-2xl font-bold text-gray-900 mb-1">Verify Mobile Number</Text>
          <Text className="text-gray-500 text-sm text-center px-4">
            Hello {user?.displayName || 'there'}! Please link your mobile number to complete your profile registration.
          </Text>
          <Text className="text-gray-400 text-xs text-center px-4 mt-2">
            {user?.authProvider === 'clerk' || user?.authProvider === 'google'
              ? 'Your existing account will be linked to this number. Do not use a number that belongs to someone else.'
              : 'This number will be verified via a one-time code.'}
          </Text>
        </View>

        <View className="px-6 pt-8">
          {!otpSent ? (
            <>
              <View className="mb-6">
                <Text className="text-gray-700 font-semibold mb-2">Phone Number</Text>
                <View className="flex-row items-center bg-white rounded-xl px-4 py-4 border border-gray-300 shadow-sm focus:border-purple-500">
                  <Text className="text-gray-600 mr-2 text-base font-semibold">+91</Text>
                  <TextInput
                    className="flex-1 text-base text-gray-900"
                    placeholder="9876543210"
                    keyboardType="phone-pad"
                    value={phone}
                    onChangeText={setPhone}
                    maxLength={10}
                    placeholderTextColor="#9CA3AF"
                  />
                </View>
              </View>

              <TouchableOpacity
                className={`${isLoading || phone.length < 10 ? 'bg-purple-400' : 'bg-purple-600'} rounded-xl py-4 shadow-md mb-4`}
                onPress={handleSendOTP}
                disabled={isLoading || phone.length < 10}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-white font-semibold text-base text-center">Request OTP Code</Text>
                )}
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View className="mb-6">
                <Text className="text-gray-700 font-semibold mb-2">Enter Verification Code</Text>
                <TextInput
                  ref={otpInputRef}
                  className="bg-white rounded-xl px-4 py-4 border border-gray-300 text-2xl text-center tracking-widest font-bold shadow-sm"
                  placeholder="000000"
                  keyboardType="number-pad"
                  value={otp}
                  onChangeText={(text) => setOtp(text.replace(/[^0-9]/g, ''))}
                  maxLength={6}
                  autoFocus
                  placeholderTextColor="#D1D5DB"
                />
                <Text className="text-gray-500 text-xs mt-2 text-center">
                  6-digit code sent to +91 {phone}
                </Text>
              </View>

              <TouchableOpacity
                className={`${isLoading || otp.length !== 6 ? 'bg-purple-400' : 'bg-purple-600'} rounded-xl py-4 mb-4 shadow-md`}
                onPress={handleVerifyOTP}
                disabled={isLoading || otp.length !== 6}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-white font-semibold text-base text-center">
                    Link Phone Number
                  </Text>
                )}
              </TouchableOpacity>

              <View className="flex-row items-center justify-between mb-6">
                {resendTimer > 0 ? (
                  <Text className="text-gray-500 text-sm">Resend in {resendTimer}s</Text>
                ) : (
                  <TouchableOpacity onPress={handleSendOTP}>
                    <Text className="text-purple-600 font-semibold text-sm">Resend Verification Code</Text>
                  </TouchableOpacity>
                )}
                <TouchableOpacity onPress={() => setOtpSent(false)}>
                  <Text className="text-gray-500 font-semibold text-sm">Change Number</Text>
                </TouchableOpacity>
              </View>
            </>
          )}

          <TouchableOpacity
            className="border border-red-200 bg-red-50 rounded-xl py-3 mt-4"
            onPress={handleLogout}
          >
            <Text className="text-red-600 font-semibold text-center text-sm">Sign Out / Use Another Account</Text>
          </TouchableOpacity>
        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
