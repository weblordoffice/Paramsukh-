import React, { useState, useRef } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, ActivityIndicator, KeyboardAvoidingView, Platform, ScrollView, Image } from 'react-native';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../store/authStore';

export default function SignInScreen() {
  const router = useRouter();
  const { sendOTP, verifyOTP, isLoading } = useAuthStore();
  const scrollViewRef = useRef<ScrollView>(null);
  const otpInputRef = useRef<TextInput>(null);

  const [phone, setPhone] = useState('');
  const [otp, setOtp] = useState('');
  const [otpSent, setOtpSent] = useState(false);
  const [resendTimer, setResendTimer] = useState(0);
  const [generatedOTP, setGeneratedOTP] = useState<string | null>(null);

  const handleSendOTP = async () => {
    if (!phone || phone.length < 10) {
      Alert.alert('Error', 'Enter valid phone number');
      return;
    }

    const formattedPhone = phone.startsWith('+91') ? phone : `+91${phone}`;

    const result = await sendOTP(formattedPhone);

    if (result.success) {
      // Check if user is new - redirect to signup
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
        return;
      }

      setOtpSent(true);
      if (result.otp) {
        setGeneratedOTP(result.otp);
      }
      startResendTimer();
      Alert.alert('Success', result.message || 'OTP sent to your phone number');
    } else {
      Alert.alert('Error', result.message || 'Failed to send OTP');
    }
  };

  const handleVerifyOTP = async () => {
    if (otp.length !== 6) {
      Alert.alert('Error', 'Enter 6-digit OTP');
      return;
    }

    const formattedPhone = phone.startsWith('+91') ? phone : `+91${phone}`;

    // For signin, we don't need name and email
    const result = await verifyOTP(formattedPhone, otp);

    if (result.success) {
      // Existing user - let index.tsx check assessment status
      router.replace('/');
    } else {
      Alert.alert('Error', result.message || 'Verification failed');
    }
  };

  const startResendTimer = () => {
    setResendTimer(60);
    const interval = setInterval(() => {
      setResendTimer((prev) => {
        if (prev <= 1) {
          clearInterval(interval);
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

              <TouchableOpacity
                className="mt-6"
                onPress={() => router.replace('/signup')}
              >
                <Text className="text-center text-gray-600">
                  Don't have an account?{' '}
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
                <TouchableOpacity onPress={() => {
                  setOtpSent(false);
                  setOtp('');
                  setGeneratedOTP(null);
                }}>
                  <Text className="text-purple-600 font-medium">← Change Number</Text>
                </TouchableOpacity>

                {generatedOTP ? (
                  <View style={{ marginVertical: 10, padding: 10, backgroundColor: '#DCFCE7', borderRadius: 8 }}>
                    <Text style={{ color: '#166534', textAlign: 'center' }}>
                      Your OTP: <Text style={{ fontWeight: 'bold' }}>{generatedOTP}</Text>
                    </Text>
                  </View>
                ) : null}

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
          By continuing, you agree to our Terms & Privacy Policy
        </Text>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}
