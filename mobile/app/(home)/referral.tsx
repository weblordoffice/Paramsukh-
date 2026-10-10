import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Alert,
  Clipboard,
  Share,
  StyleSheet
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import apiClient from '../../utils/apiClient';
import { useTheme } from '../../hooks/useTheme';

interface ReferredFriend {
  _id: string;
  displayName: string;
  joinedAt: string;
  status: 'joined' | 'completed';
}

export default function ReferralScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [loading, setLoading] = useState(true);
  const [referralCode, setReferralCode] = useState('');
  const [referrals, setReferrals] = useState<ReferredFriend[]>([]);
  const [points, setPoints] = useState(0);
  const [totalEarned, setTotalEarned] = useState(0);
  const [pointValue, setPointValue] = useState(1);

  useEffect(() => {
    loadReferralData();
  }, []);

  const loadReferralData = async () => {
    try {
      const res = await apiClient.get('/user/profile/referrals');
      const d = res.data || {};
      if (d.referralCode) setReferralCode(d.referralCode);
      if (Array.isArray(d.referrals)) setReferrals(d.referrals);
      setPoints(d.points || 0);
      setTotalEarned(d.totalPointsEarned || 0);
      setPointValue(d.pointValue || 1);
    } catch (err) {
      console.warn('Failed to load referral data:', err);
    } finally {
      setLoading(false);
    }
  };

  const handleCopyCode = () => {
    Clipboard.setString(referralCode);
    Alert.alert('Copied!', 'Referral code copied to clipboard');
  };

  const handleShare = async () => {
    try {
      await Share.share({
        message: `Join me on ParamSukh wellness Gurukul and learn scientifically to live a balanced life! Use my referral code: ${referralCode} during signup.`
      });
    } catch (error) {
      console.error('Error sharing referral code:', error);
    }
  };

  const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.surface },
    headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    scrollContent: { padding: 20 },
    promoBanner: { backgroundColor: colors.primary, borderRadius: 16, padding: 24 },
    promoInner: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    promoTextContainer: { flex: 1, paddingRight: 12 },
    promoLabel: { fontSize: 12, fontWeight: '700', color: '#FFFFFF', opacity: 0.9, letterSpacing: 1, textTransform: 'uppercase' },
    promoReward: { fontSize: 20, fontWeight: '800', color: '#FFFFFF', marginTop: 4 },
    promoSub: { fontSize: 14, color: '#FFFFFF', opacity: 0.85, marginTop: 8 },
    shareCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, alignItems: 'center', marginBottom: 24, borderWidth: 1, borderColor: colors.border },
    shareLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, letterSpacing: 1, marginBottom: 12 },
    codeBox: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surfaceSecondary, borderRadius: 12, paddingHorizontal: 16, paddingVertical: 12, marginBottom: 16, width: '100%', justifyContent: 'space-between', borderWidth: 1, borderColor: colors.border },
    codeText: { fontSize: 20, fontWeight: '700', color: colors.primary, letterSpacing: 2 },
    copyBtn: { backgroundColor: colors.primary + '20', paddingHorizontal: 12, paddingVertical: 6, borderRadius: 8 },
    copyBtnText: { fontSize: 12, fontWeight: '700', color: colors.primary },
    shareBtn: { backgroundColor: colors.primary, width: '100%', paddingVertical: 16, borderRadius: 12, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', shadowColor: colors.primary, shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 4 },
    shareBtnText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    howCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 20, marginBottom: 24, borderWidth: 1, borderColor: colors.border },
    howTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16 },
    stepRow: { flexDirection: 'row', alignItems: 'flex-start', marginBottom: 20 },
    stepNum: { width: 32, height: 32, borderRadius: 16, backgroundColor: colors.primary + '15', alignItems: 'center', justifyContent: 'center', marginRight: 12 },
    stepNumText: { fontSize: 14, fontWeight: '700', color: colors.primary },
    stepContent: { flex: 1 },
    stepTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 2 },
    stepDesc: { fontSize: 12, color: colors.textSecondary, lineHeight: 18 },
    referredTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 12 },
    emptyState: { backgroundColor: colors.surface, borderRadius: 16, padding: 24, alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.border, marginBottom: 24 },
    emptyText: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', marginTop: 8 },
    friendCard: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', backgroundColor: colors.surface, padding: 16, borderRadius: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    friendInfo: { flex: 1, paddingRight: 12 },
    friendName: { fontSize: 15, fontWeight: '600', color: colors.text, marginBottom: 2 },
    friendJoined: { fontSize: 12, color: colors.textSecondary },
    statusCompleted: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: '#10B98115', borderWidth: 1, borderColor: '#10B98130' },
    statusJoined: { flexDirection: 'row', alignItems: 'center', paddingHorizontal: 12, paddingVertical: 4, borderRadius: 12, backgroundColor: '#F59E0B15', borderWidth: 1, borderColor: '#F59E0B30' },
    statusTextCompleted: { fontSize: 12, fontWeight: '700', color: '#10B981' },
    statusTextJoined: { fontSize: 12, fontWeight: '700', color: '#F59E0B' },
    loadingContainer: { flex: 1, alignItems: 'center', justifyContent: 'center', paddingVertical: 80 },
  });

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => { if (router.canGoBack()) router.back(); }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Invite & Earn</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scrollContent}>
        {loading ? (
          <View style={s.loadingContainer}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : (
          <>
            <View style={s.promoBanner}>
              <View style={s.promoInner}>
                <View style={s.promoTextContainer}>
                  <Text style={s.promoLabel}>Your Referral Points</Text>
                  <Text style={s.promoReward}>{points} pts</Text>
                  <Text style={s.promoSub}>Worth ₹{points * pointValue} · {totalEarned} earned in total</Text>
                </View>
                <Ionicons name="gift" size={56} color="#FFFFFF" style={{ opacity: 0.85 }} />
              </View>
            </View>

            <View style={s.shareCard}>
              <Text style={s.shareLabel}>YOUR REFERRAL CODE</Text>

              <View style={s.codeBox}>
                <Text style={s.codeText}>{referralCode}</Text>
                <TouchableOpacity onPress={handleCopyCode} style={s.copyBtn}>
                  <Text style={s.copyBtnText}>COPY</Text>
                </TouchableOpacity>
              </View>

              <TouchableOpacity onPress={handleShare} style={s.shareBtn}>
                <Ionicons name="share-social" size={20} color="#FFFFFF" style={{ marginRight: 8 }} />
                <Text style={s.shareBtnText}>Invite Friends</Text>
              </TouchableOpacity>
            </View>

            <View style={s.howCard}>
              <Text style={s.howTitle}>How it works</Text>

              <View>
                <View style={s.stepRow}>
                  <View style={s.stepNum}>
                    <Text style={s.stepNumText}>1</Text>
                  </View>
                  <View style={s.stepContent}>
                    <Text style={s.stepTitle}>Share your unique code</Text>
                    <Text style={s.stepDesc}>Send the referral link or code to your friends.</Text>
                  </View>
                </View>

                <View style={s.stepRow}>
                  <View style={s.stepNum}>
                    <Text style={s.stepNumText}>2</Text>
                  </View>
                  <View style={s.stepContent}>
                    <Text style={s.stepTitle}>They join the Gurukul</Text>
                    <Text style={s.stepDesc}>Ensure they enter your referral code when creating their account.</Text>
                  </View>
                </View>

                <View style={s.stepRow}>
                  <View style={s.stepNum}>
                    <Text style={s.stepNumText}>3</Text>
                  </View>
                  <View style={s.stepContent}>
                    <Text style={s.stepTitle}>Claim your rewards</Text>
                    <Text style={s.stepDesc}>Earn referral points when they sign up — and more when they complete a course!</Text>
                  </View>
                </View>
              </View>
            </View>

            <View style={{ marginBottom: 24 }}>
              <Text style={s.referredTitle}>Referred Friends ({referrals.length})</Text>

              {referrals.length === 0 ? (
                <View style={s.emptyState}>
                  <Ionicons name="people-outline" size={32} color={colors.textSecondary} />
                  <Text style={s.emptyText}>No friends referred yet. Be the first to invite!</Text>
                </View>
              ) : (
                referrals.map((friend) => (
                  <View key={friend._id} style={s.friendCard}>
                    <View style={s.friendInfo}>
                      <Text style={s.friendName}>{friend.displayName}</Text>
                      <Text style={s.friendJoined}>Joined: {new Date(friend.joinedAt).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}</Text>
                    </View>

                    {friend.status === 'completed' ? (
                      <View style={s.statusCompleted}>
                        <Ionicons name="checkmark-circle" size={14} color="#10B981" style={{ marginRight: 4 }} />
                        <Text style={s.statusTextCompleted}>Completed</Text>
                      </View>
                    ) : (
                      <View style={s.statusJoined}>
                        <Ionicons name="time" size={14} color="#F59E0B" style={{ marginRight: 4 }} />
                        <Text style={s.statusTextJoined}>Joined</Text>
                      </View>
                    )}
                  </View>
                ))
              )}
            </View>
          </>
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
