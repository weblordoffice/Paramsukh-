import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Clipboard,
  Share
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuthStore } from '../../store/authStore';

interface ReferredFriend {
  _id: string;
  displayName: string;
  joinedAt: string;
  status: 'joined' | 'completed';
}

export default function ReferralScreen() {
  const router = useRouter();
  const { token } = useAuthStore();
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState('');
  const [referrerRewardText, setReferrerRewardText] = useState('Get 15 days of Premium Gurukul Access!');
  const [refereeRewardText, setRefereeRewardText] = useState('Start your scientific wellness journey!');
  const [referrals, setReferrals] = useState<ReferredFriend[]>([]);
  const isMountedRef = useRef(true);

  const fetchReferralDetails = async () => {
    try {
      const headers = token ? { Authorization: `Bearer ${token}` } : undefined;
      const response = await axios.get(`${API_URL}/user/profile/referrals`, { headers });
      
      if (!isMountedRef.current) return;
      
      if (response.data.success) {
        setReferralCode(response.data.referralCode);
        setReferrerRewardText(response.data.referrerRewardText);
        setRefereeRewardText(response.data.refereeRewardText);
        setReferrals(response.data.referrals || []);
      }
    } catch (error) {
      console.error('❌ Failed to fetch referral details:', error);
    } finally {
      if (isMountedRef.current) setLoading(false);
    }
  };

  useEffect(() => {
    isMountedRef.current = true;
    fetchReferralDetails();
    return () => {
      isMountedRef.current = false;
    };
  }, [token]);

  const handleCopyCode = () => {
    Clipboard.setString(referralCode);
    Alert.alert('Copied!', 'Referral code copied to clipboard');
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join me on ParamSukh wellness Gurukul and learn scientifically to live a balanced life! Use my referral code: ${referralCode} during signup.\n\n${refereeRewardText}`
      });
    } catch (error) {
      console.error('Error sharing referral code:', error);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
        <TouchableOpacity 
          className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center" 
          onPress={() => router.push('/(home)/menu')}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Invite & Earn</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-5">
        {loading ? (
          <View className="flex-1 items-center justify-center py-20">
            <ActivityIndicator size="large" color="#3B82F6" />
          </View>
        ) : (
          <>
            {/* Visual Promo Banner */}
            <View className="bg-gradient-to-br from-indigo-500 to-purple-600 bg-indigo-600 p-6 rounded-2xl shadow-sm mb-6">
              <View className="flex-row items-center justify-between">
                <View className="flex-1 pr-3">
                  <Text className="text-white text-xs font-bold uppercase tracking-wider opacity-90">Referral Reward</Text>
                  <Text className="text-white text-xl font-extrabold mt-1">{referrerRewardText}</Text>
                  <Text className="text-white text-sm mt-2 opacity-85">Plus, unlock the exclusive "Wellness Guide" badge on your profile!</Text>
                </View>
                <Ionicons name="gift" size={56} color="#FFFFFF" style={{ opacity: 0.85 }} />
              </View>
            </View>

            {/* Sharing Code Card */}
            <View className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm items-center mb-6">
              <Text className="text-gray-500 text-sm font-semibold mb-3">YOUR REFERRAL CODE</Text>
              
              <View className="flex-row items-center bg-gray-50 border border-gray-200 rounded-xl px-4 py-3 mb-4 w-full justify-between">
                <Text className="text-xl font-bold text-purple-600 tracking-widest">{referralCode}</Text>
                <TouchableOpacity onPress={handleCopyCode} className="bg-purple-100 px-3 py-1.5 rounded-lg">
                  <Text className="text-xs font-bold text-purple-600">COPY</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity 
                onPress={handleShare}
                className="bg-blue-500 w-full py-4 rounded-xl flex-row items-center justify-center shadow-md"
              >
                <Ionicons name="share-social" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text className="text-white font-bold text-base">Invite Friends</Text>
              </TouchableOpacity>
            </View>

            {/* Instructions Steps */}
            <View className="bg-white p-5 rounded-2xl border border-gray-200 shadow-sm mb-6">
              <Text className="text-lg font-bold text-gray-900 mb-4">How it works</Text>
              
              <View className="gap-5">
                <View className="flex-row items-start">
                  <View className="w-8 h-8 rounded-full bg-purple-100 items-center justify-center mr-3 mt-0.5">
                    <Text className="text-purple-600 font-bold">1</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-gray-800 text-sm">Share your unique code</Text>
                    <Text className="text-gray-500 text-xs mt-1">Send the referral link or code to your friends.</Text>
                  </View>
                </View>

                <View className="flex-row items-start">
                  <View className="w-8 h-8 rounded-full bg-purple-100 items-center justify-center mr-3 mt-0.5">
                    <Text className="text-purple-600 font-bold">2</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-gray-800 text-sm">They join the Gurukul</Text>
                    <Text className="text-gray-500 text-xs mt-1">Ensure they enter your referral code when creating their account.</Text>
                  </View>
                </View>

                <View className="flex-row items-start">
                  <View className="w-8 h-8 rounded-full bg-purple-100 items-center justify-center mr-3 mt-0.5">
                    <Text className="text-purple-600 font-bold">3</Text>
                  </View>
                  <View className="flex-1">
                    <Text className="font-bold text-gray-800 text-sm">Claim your rewards</Text>
                    <Text className="text-gray-500 text-xs mt-1">Get free premium extension days the moment they complete their first Gurukul course!</Text>
                  </View>
                </View>
              </View>
            </View>

            {/* Referred Friends Tracker */}
            <View className="mb-6">
              <Text className="text-lg font-bold text-gray-900 mb-3">Referred Friends ({referrals.length})</Text>
              
              {referrals.length === 0 ? (
                <View className="bg-white p-6 rounded-2xl border border-dashed border-gray-300 items-center justify-center">
                  <Ionicons name="people-outline" size={32} color="#9CA3AF" />
                  <Text className="text-sm text-gray-500 text-center mt-2 font-medium">No friends referred yet. Be the first to invite!</Text>
                </View>
              ) : (
                <View className="gap-3">
                  {referrals.map((friend) => (
                    <View key={friend._id} className="flex-row items-center justify-between bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                      <View className="flex-1 pr-3">
                        <Text className="text-[15px] font-bold text-gray-800 mb-1">{friend.displayName}</Text>
                        <Text className="text-xs text-gray-500">Joined: {new Date(friend.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                      </View>
                      
                      {friend.status === 'completed' ? (
                        <View className="flex-row items-center bg-green-50 border border-green-200 px-3 py-1 rounded-full">
                          <Ionicons name="checkmark-circle" size={14} color="#10B981" style={{ marginRight: 4 }} />
                          <Text className="text-xs font-bold text-green-600">Completed</Text>
                        </View>
                      ) : (
                        <View className="flex-row items-center bg-amber-50 border border-amber-200 px-3 py-1 rounded-full">
                          <Ionicons name="time" size={14} color="#F59E0B" style={{ marginRight: 4 }} />
                          <Text className="text-xs font-bold text-amber-600">Joined</Text>
                        </View>
                      )}
                    </View>
                  ))}
                </View>
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
