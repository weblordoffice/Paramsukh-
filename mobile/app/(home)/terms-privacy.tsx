import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';

export default function TermsPrivacyScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>('terms');

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
        <TouchableOpacity className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center" onPress={() => router.push('/(home)/menu')}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Terms & Privacy</Text>
        <View className="w-10" />
      </View>

      {/* Tabs */}
      <View className="flex-row bg-white px-5 pt-2 border-b border-gray-200">
        <TouchableOpacity
          className={`flex-1 py-3 items-center border-b-2 ${
            activeTab === 'terms' ? 'border-blue-500' : 'border-transparent'
          }`}
          onPress={() => setActiveTab('terms')}
        >
          <Text className={`text-[15px] font-semibold ${
            activeTab === 'terms' ? 'text-blue-500' : 'text-gray-500'
          }`}>
            Terms of Service
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          className={`flex-1 py-3 items-center border-b-2 ${
            activeTab === 'privacy' ? 'border-blue-500' : 'border-transparent'
          }`}
          onPress={() => setActiveTab('privacy')}
        >
          <Text className={`text-[15px] font-semibold ${
            activeTab === 'privacy' ? 'text-blue-500' : 'text-gray-500'
          }`}>
            Privacy Policy
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-5">
        {activeTab === 'terms' ? (
          <View>
            <Text className="text-2xl font-bold text-gray-900 mb-2">Terms of Service</Text>
            <Text className="text-[13px] text-gray-500 mb-6">Last updated: November 8, 2025</Text>

            <Text className="text-lg font-bold text-gray-900 mt-6 mb-3">1. Acceptance of Terms</Text>
            <Text className="text-[15px] text-gray-700 leading-6 mb-4">
              By accessing and using ParamSukh, you accept and agree to be bound by the terms and
              provision of this agreement. If you do not agree to these terms, please do not use our
              services.
            </Text>

            <Text className="text-lg font-bold text-gray-900 mt-6 mb-3">2. Use License</Text>
            <Text className="text-[15px] text-gray-700 leading-6 mb-4">
              Permission is granted to temporarily access the materials (information or software) on
              ParamSukh for personal, non-commercial transitory viewing only. This is the grant of a
              license, not a transfer of title.
            </Text>

            <Text className="text-lg font-bold text-gray-900 mt-6 mb-3">3. User Accounts</Text>
            <Text className="text-[15px] text-gray-700 leading-6 mb-4">
              You are responsible for maintaining the confidentiality of your account and password.
              You agree to accept responsibility for all activities that occur under your account.
            </Text>

            <Text className="text-lg font-bold text-gray-900 mt-6 mb-3">4. Content Guidelines</Text>
            <Text className="text-[15px] text-gray-700 leading-6 mb-4">
              Users must not post content that is illegal, offensive, or violates the rights of
              others. We reserve the right to remove any content that violates these guidelines.
            </Text>

            <Text className="text-lg font-bold text-gray-900 mt-6 mb-3">5. Disclaimer</Text>
            <Text className="text-[15px] text-gray-700 leading-6 mb-4">
              The materials on ParamSukh are provided on an &apos;as is&apos; basis. ParamSukh makes no
              warranties, expressed or implied, and hereby disclaims and negates all other warranties.
            </Text>
          </View>
        ) : (
          <View>
            <Text className="text-2xl font-bold text-gray-900 mb-2">Privacy Policy</Text>
            <Text className="text-[13px] text-gray-500 mb-6">Last updated: November 8, 2025</Text>

            <Text className="text-lg font-bold text-gray-900 mt-6 mb-3">1. Information We Collect</Text>
            <Text className="text-[15px] text-gray-700 leading-6 mb-4">
              We collect information you provide directly to us, such as when you create an account,
              participate in interactive features, or communicate with us. This may include your name,
              email address, phone number, and profile information.
            </Text>

            <Text className="text-lg font-bold text-gray-900 mt-6 mb-3">2. How We Use Your Information</Text>
            <Text className="text-[15px] text-gray-700 leading-6 mb-4">
              We use the information we collect to provide, maintain, and improve our services, to
              communicate with you, to monitor and analyze trends and usage, and to personalize your
              experience.
            </Text>

            <Text className="text-lg font-bold text-gray-900 mt-6 mb-3">3. Information Sharing</Text>
            <Text className="text-[15px] text-gray-700 leading-6 mb-4">
              We do not share your personal information with third parties except as described in this
              policy. We may share information with service providers who perform services on our
              behalf.
            </Text>

            <Text className="text-lg font-bold text-gray-900 mt-6 mb-3">4. Data Security</Text>
            <Text className="text-[15px] text-gray-700 leading-6 mb-4">
              We take reasonable measures to help protect information about you from loss, theft,
              misuse, unauthorized access, disclosure, alteration, and destruction.
            </Text>

            <Text className="text-lg font-bold text-gray-900 mt-6 mb-3">5. Your Rights</Text>
            <Text className="text-[15px] text-gray-700 leading-6 mb-4">
              You have the right to access, update, or delete your personal information at any time.
              You can do this through your account settings or by contacting us directly.
            </Text>

            <Text className="text-lg font-bold text-gray-900 mt-6 mb-3">6. Cookies and Tracking</Text>
            <Text className="text-[15px] text-gray-700 leading-6 mb-4">
              We use cookies and similar tracking technologies to track activity on our service and
              hold certain information. You can instruct your browser to refuse all cookies or to
              indicate when a cookie is being sent.
            </Text>
          </View>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
