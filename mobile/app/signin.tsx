import React, { useState, useRef, useEffect } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useAuthStore } from '../store/authStore';
import { useOAuth } from '@clerk/clerk-expo';
import * as WebBrowser from 'expo-web-browser';
import * as Linking from 'expo-linking';
import * as Haptics from 'expo-haptics';
import DeviceSwapModal from '../components/DeviceSwapModal';

WebBrowser.maybeCompleteAuthSession();

function formatPhone(phone: string) {
  const digits = phone.replace(/\D/g, '');
  const normalized = digits.startsWith('91') && digits.length > 10 ? digits.slice(2) : digits;
  return `+91${normalized.slice(-10)}`;
}

export default function SignInScreen() {
  const router = useRouter();
  const { sendOTP, verifyOTP, isLoading } = useAuthStore();
  const { startOAuthFlow } = useOAuth({ strategy: 'oauth_google' });
  const scrollViewRef = useRef<ScrollView>(null);
  const otpInputRef = useRef<TextInput>(null);

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const resendIntervalRef = useRef<any>(null);
  const [showSwapModal, setShowSwapModal] = useState(false);
  const [activeDevices, setActiveDevices] = useState<any[]>([]);

  useEffect(() => {
    return () => {
      if (resendIntervalRef.current) {
        clearInterval(resendIntervalRef.current);
      }
    };
  }, []);

  const handleGoogleSignIn = async () => {
    try {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      const { createdSessionId, setActive } = await startOAuthFlow({
        redirectUrl: Linking.createURL('/oauth-redirect', { scheme: 'paramsukh' }),
      });

      if (createdSessionId && setActive) {
        await setActive({ session: createdSessionId });
      }
    } catch (err: any) {
      console.error('OAuth error', err);
      Alert.alert('Authentication Error', err.message || 'Failed to authenticate with Google');
    }
  };

  const handleSendOTP = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert('Error', 'Enter valid phone number');
      return;
    }

    const formattedPhone = formatPhone(phone);

    const result = await sendOTP(formattedPhone, 'signin');

    if (result.success) {
      setOtpSent(true);
      Alert.alert('OTP Sent', 'Check your phone for the verification code.');
      startResendTimer();
    } else {
      // Check if user doesn't exist - redirect to signup
      if (result.isNewUser === true) {
        Alert.alert(
          'Account Not Found',
          'This number is not registered. Please sign up first.',
          [
            {
              text: 'Go to Sign Up',
              onPress: () => router.replace('/signup')
            },
            {
              text: 'Cancel',
              style: 'cancel'
            }
          ]
        );
      } else {
        Alert.alert('Error', result.message || 'Failed to send OTP');
      }
    }
  };

  const handleVerifyOTP = async (revokeDeviceId?: string) => {
    if (otp.length !== 6) {
      Alert.alert('Error', 'Enter 6-digit OTP');
      return;
    }

    const formattedPhone = formatPhone(phone);
    const result = await verifyOTP(formattedPhone, otp, undefined, undefined, revokeDeviceId);

    if (result.success) {
      setShowSwapModal(false);
      router.replace('/');
    } else {
      if (result.deviceLimitExceeded) {
        setActiveDevices(result.activeDevices || []);
        setShowSwapModal(true);
      } else {
        Alert.alert('Error', result.message || 'Verification failed');
      }
    }
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
          paddingBottom: 400,
          minHeight: '100%'
        }}
        showsVerticalScrollIndicator={true}
        keyboardShouldPersistTaps="handled"
        nestedScrollEnabled={true}
        scrollEnabled={true}
      >
        <View className="bg-white pt-16 pb-12 px-6 items-center">
          <Image
            source={require('../assets/paramsukh.png')}
            className="w-48 h-48 mb-6"
            resizeMode="contain"
          />
          <Text className="text-3xl font-bold text-gray-900 mb-2">ParamSukh</Text>
          <Text className="text-gray-600 text-base">Sign in to continue</Text>
        </View>

        <View className="px-6 pt-8 pb-8">
          {!otpSent ? (
            <>
              <View className="mb-5">
                <Text className="text-gray-700 font-medium mb-2">Phone Number</Text>
                <View className="flex-row items-center bg-white rounded-xl px-4 py-4 border border-gray-300 shadow-sm">
                  <Text className="text-gray-600 mr-2 text-base font-medium">+91</Text>
                  <TextInput
                    className="flex-1 text-base"
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
                className={`${isLoading ? 'bg-purple-400' : 'bg-purple-600'} rounded-xl py-4 shadow-md`}
                onPress={handleSendOTP}
                disabled={isLoading || phone.length < 10}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-white font-semibold text-base text-center">Send OTP</Text>
                )}
              </TouchableOpacity>

              <View className="mt-4 px-3 py-3 bg-blue-50 border border-blue-200 rounded-lg">
                <Text className="text-blue-700 text-xs text-center">
                  ℹ️ For security, you can request OTP up to 3 times per 10 minutes
                </Text>
              </View>

              {/* Divider */}
              <View className="flex-row items-center my-6">
                <View className="flex-grow h-px bg-gray-300" />
                <Text className="mx-4 text-gray-500 font-semibold text-sm">or</Text>
                <View className="flex-grow h-px bg-gray-300" />
              </View>

              {/* Google OAuth button */}
              <TouchableOpacity
                className="flex-row items-center justify-center bg-white border border-gray-300 rounded-xl py-4 shadow-sm active:bg-gray-50"
                onPress={handleGoogleSignIn}
                disabled={isLoading}
              >
                <Image
                  source={{ uri: 'https://developers.google.com/static/identity/images/g-logo.png' }}
                  className="w-5 h-5 mr-3"
                  resizeMode="contain"
                />
                <Text className="text-gray-700 font-bold text-base">Continue with Google</Text>
              </TouchableOpacity>

              <TouchableOpacity
                className="mt-6"
                onPress={() => router.replace('/signup')}
              >
                <Text className="text-center text-gray-600">
                  Don&apos;t have an account?{' '}
                  <Text className="text-purple-600 font-semibold">Sign Up</Text>
                </Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <View className="mb-5">
                <Text className="text-gray-700 font-medium mb-2">Enter OTP</Text>
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
                <Text className="text-gray-500 text-sm mt-2 text-center">
                  OTP sent to +91{phone}
                </Text>
              </View>

              <TouchableOpacity
                className={`${isLoading || otp.length !== 6 ? 'bg-purple-400' : 'bg-purple-600'} rounded-xl py-4 mb-3 shadow-md`}
                onPress={handleVerifyOTP}
                disabled={isLoading || otp.length !== 6}
              >
                {isLoading ? (
                  <ActivityIndicator color="#FFFFFF" />
                ) : (
                  <Text className="text-white font-semibold text-base text-center">
                    Sign In
                  </Text>
                )}
              </TouchableOpacity>

              <View className="flex-row items-center justify-between mb-5">
                {resendTimer > 0 ? (
                  <Text className="text-gray-500">Resend in {resendTimer}s</Text>
                ) : (
                  <TouchableOpacity onPress={handleSendOTP}>
                    <Text className="text-purple-600 font-medium">Resend OTP</Text>
                  </TouchableOpacity>
                )}
              </View>
            </>
          )}
        </View>
        <Text className="text-gray-500 text-xs text-center px-8 pb-8">
          By continuing, you agree to our{' '}
          <Text
            className="text-purple-600 underline"
            onPress={() => {
              const url = Constants.expoConfig?.extra?.privacyPolicyUrl;
              if (url) Linking.openURL(url);
            }}
          >
            Terms & Privacy Policy
          </Text>
        </Text>
      </ScrollView>

      <DeviceSwapModal
        visible={showSwapModal}
        activeDevices={activeDevices}
        onConfirm={(deviceId) => handleVerifyOTP(deviceId)}
        onClose={() => setShowSwapModal(false)}
        isLoading={isLoading}
      />
    </KeyboardAvoidingView>
  );
}
