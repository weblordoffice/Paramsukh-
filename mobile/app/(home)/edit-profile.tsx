import React, { useState, useEffect } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Alert,
  ActivityIndicator,
  Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useAuthStore } from '../../store/authStore';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useTheme } from '../../hooks/useTheme';

export default function EditProfileScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const themedInputStyle = {
    backgroundColor: colors.surfaceSecondary,
    borderColor: colors.border,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    fontSize: 16,
    color: colors.text,
  };
  const themedOtpInputStyle = {
    ...themedInputStyle,
    width: 44,
    height: 52,
    paddingHorizontal: 0,
    paddingVertical: 0,
    textAlign: 'center' as const,
    fontSize: 20,
    fontWeight: '700' as const,
  };
  const themedCardStyle = { backgroundColor: colors.surface, borderColor: colors.border };
  const { user, fetchCurrentUser } = useAuthStore();
  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);
  const [formData, setFormData] = useState({
    displayName: '',
    age: '',
    occupation: '',
    location: '',
    physicalIssue: false,
    specialDiseaseIssue: false,
    relationshipIssue: false,
    financialIssue: false,
    mentalHealthIssue: false,
    spiritualGrowth: false,
  });

  // Contact modal state
  const [contactModal, setContactModal] = useState<{
    visible: boolean;
    field: 'email' | 'phone';
    value: string;
    step: 'input' | 'otp';
    loading: boolean;
    otpDigits: string[];
    error: string;
  }>({
    visible: false,
    field: 'email',
    value: '',
    step: 'input',
    loading: false,
    otpDigits: ['', '', '', '', '', ''],
    error: '',
  });

  const otpInputRefs: any[] = [];

  useEffect(() => {
    fetchUserProfile();
  }, []);

  const computeAge = (dob: string | Date | undefined): string => {
    if (!dob) return '';
    const d = new Date(dob);
    if (isNaN(d.getTime())) return '';
    const ageNum = Math.floor((Date.now() - d.getTime()) / (365.25 * 24 * 3600 * 1000));
    return ageNum > 0 && ageNum <= 120 ? ageNum.toString() : '';
  };

  const fetchUserProfile = async () => {
    try {
      const token = await useAuthStore.getState().token;
      const response = await axios.get(`${API_URL}/user/profile`, {
        headers: token ? { Authorization: `Bearer ${token}` } : undefined,
      });
      if (response.data.success) {
        const userData = response.data.user;
        const details = response.data.profileDetails || {};
        setFormData({
          displayName: userData.displayName || '',
          age: details.age ? details.age.toString() : computeAge(details.birthDate || userData.birthDate),
          occupation: details.occupation || '',
          location: details.location || '',
          physicalIssue: !!details.physicalIssue,
          specialDiseaseIssue: !!details.specialDiseaseIssue,
          relationshipIssue: !!details.relationshipIssue,
          financialIssue: !!details.financialIssue,
          mentalHealthIssue: !!details.mentalHealthIssue,
          spiritualGrowth: !!details.spiritualGrowth,
        });
      }
    } catch (error) {
      console.error('Failed to fetch profile details:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!formData.displayName.trim()) {
      Alert.alert('Error', 'Please enter your name');
      return;
    }

    setIsSaving(true);
    try {
      const token = await useAuthStore.getState().token;
      const response = await axios.put(
        `${API_URL}/user/profile`,
        {
          displayName: formData.displayName.trim(),
          age: formData.age ? parseInt(formData.age, 10) : undefined,
          occupation: formData.occupation.trim() || undefined,
          location: formData.location.trim() || undefined,
          physicalIssue: formData.physicalIssue,
          specialDiseaseIssue: formData.specialDiseaseIssue,
          relationshipIssue: formData.relationshipIssue,
          financialIssue: formData.financialIssue,
          mentalHealthIssue: formData.mentalHealthIssue,
          spiritualGrowth: formData.spiritualGrowth,
        },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );

      if (response.data.success) {
        await fetchCurrentUser();
        Alert.alert('Success', 'Profile updated successfully', [
          { text: 'OK', onPress: () => { if (router.canGoBack()) router.back(); } },
        ]);
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to update profile';
      Alert.alert('Error', msg);
    } finally {
      setIsSaving(false);
    }
  };

  const openContactModal = (field: 'email' | 'phone', currentValue: string) => {
    setContactModal({
      visible: true,
      field,
      value: currentValue,
      step: 'input',
      loading: false,
      otpDigits: ['', '', '', '', '', ''],
      error: '',
    });
  };

  const closeContactModal = () => {
    setContactModal((prev) => ({ ...prev, visible: false }));
  };

  const sendContactOtp = async () => {
    const { field, value } = contactModal;
    const trimmed = value.trim();

    if (!trimmed) {
      setContactModal((prev) => ({ ...prev, error: `Please enter your ${field}` }));
      return;
    }

    if (field === 'phone') {
      const digits = trimmed.replace(/\D/g, '');
      if (digits.length !== 10) {
        setContactModal((prev) => ({ ...prev, error: 'Phone must be 10 digits' }));
        return;
      }
    }

    if (field === 'email') {
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
      if (!emailRegex.test(trimmed)) {
        setContactModal((prev) => ({ ...prev, error: 'Please enter a valid email' }));
        return;
      }
    }

    setContactModal((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const token = await useAuthStore.getState().token;
      const response = await axios.post(
        `${API_URL}/user/profile/request-contact-change`,
        { field, value: trimmed },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );

      if (response.data.success) {
        setContactModal((prev) => ({ ...prev, step: 'otp', loading: false, error: '' }));
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to send OTP';
      setContactModal((prev) => ({ ...prev, loading: false, error: msg }));
    }
  };

  const verifyContactOtp = async () => {
    const { field, value, otpDigits } = contactModal;
    const otp = otpDigits.join('').trim();

    if (otp.length !== 6) {
      setContactModal((prev) => ({ ...prev, error: 'Please enter the 6-digit OTP' }));
      return;
    }

    setContactModal((prev) => ({ ...prev, loading: true, error: '' }));
    try {
      const token = await useAuthStore.getState().token;
      const response = await axios.post(
        `${API_URL}/user/profile/verify-contact-change`,
        { field, value: value.trim(), otp },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );

      if (response.data.success) {
        await fetchCurrentUser();
        Alert.alert(
          'Updated!',
          `${field === 'email' ? 'Email' : 'Phone'} updated successfully.`,
          [{ text: 'OK', onPress: closeContactModal }]
        );
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to verify OTP';
      setContactModal((prev) => ({ ...prev, loading: false, error: msg }));
    }
  };

  const onOtpDigitChange = (index: number, text: string) => {
    const digit = text.replace(/\D/g, '').slice(-1);
    const newDigits = [...contactModal.otpDigits];
    newDigits[index] = digit;
    setContactModal((prev) => ({ ...prev, otpDigits: newDigits }));

    if (digit && index < 5 && otpInputRefs[index + 1]) {
      otpInputRefs[index + 1].focus();
    }
    if (!digit && index > 0 && otpInputRefs[index - 1]) {
      otpInputRefs[index - 1].focus();
    }
  };

  const onOtpKeyPress = (index: number, e: any) => {
    if (e.nativeEvent.key === 'Backspace' && !contactModal.otpDigits[index] && index > 0) {
      otpInputRefs[index - 1]?.focus();
    }
  };

  const toggleFocus = (key: keyof typeof formData) => {
    setFormData((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const focusAreas = [
    { key: 'physicalIssue', label: 'Physical Wellness', icon: 'fitness-outline' },
    { key: 'specialDiseaseIssue', label: 'Chronic Illness Recovery', icon: 'medical-outline' },
    { key: 'relationshipIssue', label: 'Healthy Relationships', icon: 'heart-outline' },
    { key: 'financialIssue', label: 'Financial Freedom', icon: 'cash-outline' },
    { key: 'mentalHealthIssue', label: 'Mental Clarity & Peace', icon: 'brain-outline' },
    { key: 'spiritualGrowth', label: 'Spiritual Growth', icon: 'rose-outline' },
  ];

  const currentEmail = (user as any)?.email || '';
  const currentPhone = (user as any)?.phone || '';
  const displayPhone = currentPhone
    ? `${currentPhone.replace(/^\+91/, '').replace(/(\d{5})(\d{5})/, '$1-$2-')}`
    : '';

  return (
    <SafeAreaView className="flex-1" style={{ backgroundColor: colors.background }}>
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 border-b" style={{ backgroundColor: colors.surface, borderBottomColor: colors.border }}>
        <TouchableOpacity
          className="w-10 h-10 rounded-full items-center justify-center"
          style={{ backgroundColor: colors.surfaceSecondary }}
          onPress={() => { if (router.canGoBack()) router.back(); else router.push('/(home)/menu'); }}
        >
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text className="text-xl font-bold" style={{ color: colors.text }}>Edit Profile</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-5">
        {isLoading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            {/* Profile Image */}
            <View className="items-center mb-8">
              <View className="relative mb-3">
                <View className="w-[100px] h-[100px] rounded-full items-center justify-center" style={{ backgroundColor: colors.surfaceSecondary }}>
                  <Ionicons name="person" size={50} color={colors.primary} />
                </View>
              </View>
              <Text className="text-lg font-bold" style={{ color: colors.text }}>
                {formData.displayName || 'Gurukul Learner'}
              </Text>
            </View>

            {/* Contact Info Section */}
            <View className="rounded-2xl border p-4 mb-6 gap-3" style={themedCardStyle}>
              <Text className="text-base font-bold mb-1" style={{ color: colors.text }}>Contact Information</Text>

              {/* Email */}
              <View className="flex-row items-center justify-between py-2 border-b" style={{ borderBottomColor: colors.border }}>
                <View className="flex-1">
                  <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>Email</Text>
                  <Text className="text-sm mt-0.5" style={{ color: colors.text }}>
                    {currentEmail || 'Not set'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => openContactModal('email', currentEmail)}
                  className="px-3 py-1.5 rounded-lg"
                  style={{ backgroundColor: colors.primary + '15', borderWidth: 1, borderColor: colors.primary + '40' }}
                >
                  <Text className="text-xs font-bold" style={{ color: colors.primary }}>Change</Text>
                </TouchableOpacity>
              </View>

              {/* Phone */}
              <View className="flex-row items-center justify-between py-2">
                <View className="flex-1">
                  <Text className="text-xs font-medium" style={{ color: colors.textSecondary }}>Phone</Text>
                  <Text className="text-sm mt-0.5" style={{ color: colors.text }}>
                    {currentPhone ? `+91 ${displayPhone}` : 'Not set'}
                  </Text>
                </View>
                <TouchableOpacity
                  onPress={() => openContactModal('phone', currentPhone.replace(/^\+91/, '').replace(/\D/g, ''))}
                  className="px-3 py-1.5 rounded-lg"
                  style={{ backgroundColor: colors.primary + '15', borderWidth: 1, borderColor: colors.primary + '40' }}
                >
                  <Text className="text-xs font-bold" style={{ color: colors.primary }}>Change</Text>
                </TouchableOpacity>
              </View>
            </View>

            {/* Form Fields */}
            <View className="gap-5">
              <View className="gap-2">
                <Text className="text-sm font-semibold" style={{ color: colors.text }}>Display Name</Text>
                <TextInput
                  style={themedInputStyle}
                  value={formData.displayName}
                  onChangeText={(text) => setFormData({ ...formData, displayName: text })}
                  placeholder="Enter your name"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View className="gap-2">
                <Text className="text-sm font-semibold" style={{ color: colors.text }}>Age</Text>
                <TextInput
                  style={themedInputStyle}
                  value={formData.age}
                  keyboardType="numeric"
                  onChangeText={(text) => setFormData({ ...formData, age: text.replace(/[^0-9]/g, '') })}
                  placeholder="Enter your age"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View className="gap-2">
                <Text className="text-sm font-semibold" style={{ color: colors.text }}>Occupation</Text>
                <TextInput
                  style={themedInputStyle}
                  value={formData.occupation}
                  onChangeText={(text) => setFormData({ ...formData, occupation: text })}
                  placeholder="e.g. Professional, Entrepreneur"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              <View className="gap-2">
                <Text className="text-sm font-semibold" style={{ color: colors.text }}>Location</Text>
                <TextInput
                  style={themedInputStyle}
                  value={formData.location}
                  onChangeText={(text) => setFormData({ ...formData, location: text })}
                  placeholder="e.g. New Delhi, India"
                  placeholderTextColor={colors.textSecondary}
                />
              </View>

              {/* Wellness Goals / Focus Areas */}
              <View className="gap-3 mt-2">
                <Text className="text-base font-bold" style={{ color: colors.text }}>Your Wellness Focus Areas</Text>
                <Text className="text-xs -mt-1" style={{ color: colors.textSecondary }}>
                  Select focus areas to align your Gurukul experience
                </Text>

                <View className="flex-row flex-wrap gap-2 mt-1">
                  {focusAreas.map((area) => {
                    const isActive = formData[area.key as keyof typeof formData] as boolean;
                    return (
                      <TouchableOpacity
                        key={area.key}
                        onPress={() => toggleFocus(area.key as any)}
                        className="flex-row items-center px-4 py-3 rounded-full border shadow-sm"
                        style={{
                          backgroundColor: isActive ? colors.primary : colors.surfaceSecondary,
                          borderColor: isActive ? colors.primary : colors.border,
                        }}
                      >
                        <Ionicons
                          name={area.icon as any}
                          size={16}
                          color={isActive ? colors.surface : colors.textSecondary}
                          style={{ marginRight: 6 }}
                        />
                        <Text
                          className="text-sm font-semibold"
                          style={{ color: isActive ? colors.surface : colors.text }}
                        >
                          {area.label}
                        </Text>
                      </TouchableOpacity>
                    );
                  })}
                </View>
              </View>
            </View>

            {/* Save Button */}
            <TouchableOpacity
              className="py-4 rounded-xl items-center mt-10 shadow-md"
              style={{ backgroundColor: colors.primary }}
              onPress={handleSave}
              disabled={isSaving}
            >
              {isSaving ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <Text className="text-base font-bold text-white">Save Profile Details</Text>
              )}
            </TouchableOpacity>
          </>
        )}
      </ScrollView>

      {/* Contact Change OTP Modal */}
      <Modal
        visible={contactModal.visible}
        transparent
        animationType="fade"
        onRequestClose={closeContactModal}
      >
        <View className="flex-1 bg-black/50 justify-center items-center p-5">
          <View className="rounded-2xl w-full max-w-sm p-6" style={themedCardStyle}>
            {/* Modal Header */}
            <View className="flex-row items-center justify-between mb-5">
              <Text className="text-lg font-bold" style={{ color: colors.text }}>
                {contactModal.step === 'input' ? (
                  <>Change {contactModal.field === 'email' ? 'Email' : 'Phone'}</>
                ) : (
                  <>Enter OTP</>
                )}
              </Text>
              <TouchableOpacity onPress={closeContactModal} className="w-8 h-8 items-center justify-center">
                <Ionicons name="close" size={20} color={colors.textSecondary} />
              </TouchableOpacity>
            </View>

            {contactModal.step === 'input' ? (
              <>
                <Text className="text-sm mb-3" style={{ color: colors.textSecondary }}>
                  Enter your new{' '}
                  {contactModal.field === 'email' ? 'email address' : 'phone number'}
                  . A verification OTP will be sent.
                </Text>
                <TextInput
                  style={[themedInputStyle, { marginBottom: 4 }]}
                  value={contactModal.value}
                  onChangeText={(text) =>
                    setContactModal((prev) => ({
                      ...prev,
                      value:
                        prev.field === 'phone'
                          ? text.replace(/\D/g, '').slice(0, 10)
                          : text,
                      error: '',
                    }))
                  }
                  placeholder={
                    contactModal.field === 'email' ? 'email@example.com' : '10-digit number'
                  }
                  placeholderTextColor={colors.textSecondary}
                  keyboardType={contactModal.field === 'phone' ? 'phone-pad' : 'email-address'}
                  autoCapitalize="none"
                  autoCorrect={false}
                />
                {contactModal.error ? (
                  <Text className="text-red-500 text-xs mb-3">{contactModal.error}</Text>
                ) : (
                  <View className="h-5 mb-3" />
                )}
                <TouchableOpacity
                  onPress={sendContactOtp}
                  disabled={contactModal.loading}
                  className="py-3 rounded-xl items-center"
                  style={{ backgroundColor: colors.primary }}
                >
                  {contactModal.loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-base font-bold text-white">Send OTP</Text>
                  )}
                </TouchableOpacity>
              </>
            ) : (
              <>
                <Text className="text-sm mb-4 text-center" style={{ color: colors.textSecondary }}>
                  Enter the 6-digit OTP sent to{' '}
                  <Text className="font-semibold" style={{ color: colors.text }}>
                    {contactModal.field === 'email'
                      ? contactModal.value
                      : `+91 ${contactModal.value}`}
                  </Text>
                </Text>

                {/* OTP Inputs */}
                <View className="flex-row justify-center gap-2 mb-1">
                  {contactModal.otpDigits.map((digit, index) => (
                    <TextInput
                      key={index}
                      ref={(el: any) => { otpInputRefs[index] = el; }}
                      style={themedOtpInputStyle}
                      value={digit}
                      onChangeText={(text) => onOtpDigitChange(index, text)}
                      onKeyPress={(e) => onOtpKeyPress(index, e)}
                      keyboardType="number-pad"
                      maxLength={1}
                      contextMenuHidden
                      selectTextOnFocus
                    />
                  ))}
                </View>

                {contactModal.error ? (
                  <Text className="text-red-500 text-xs text-center mb-3">{contactModal.error}</Text>
                ) : (
                  <View className="h-5 mb-3" />
                )}

                <TouchableOpacity
                  onPress={verifyContactOtp}
                  disabled={contactModal.loading}
                  className="py-3 rounded-xl items-center mb-3"
                  style={{ backgroundColor: colors.primary }}
                >
                  {contactModal.loading ? (
                    <ActivityIndicator size="small" color="#fff" />
                  ) : (
                    <Text className="text-base font-bold text-white">Verify &amp; Update</Text>
                  )}
                </TouchableOpacity>

                <TouchableOpacity
                  onPress={() =>
                    setContactModal((prev) => ({ ...prev, step: 'input', error: '', otpDigits: ['', '', '', '', '', ''] }))
                  }
                  className="py-2 items-center"
                >
                  <Text className="text-sm font-medium" style={{ color: colors.primary }}>Change {contactModal.field === 'email' ? 'email' : 'number'}</Text>
                </TouchableOpacity>
              </>
            )}
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}
