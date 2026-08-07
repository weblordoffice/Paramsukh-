import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput, ActivityIndicator, Image } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { useDonationStore } from '@/store/donationStore';
import { useAuthStore } from '@/store/authStore';
import { openPaymentLink, savePendingPaymentLink, clearPendingPaymentLinks } from '@/utils/paymentBrowser';
import apiClient from '@/utils/apiClient';

export default function DonationsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { token } = useAuthStore();
  const { donations, fetchMyDonations, isLoading } = useDonationStore();

  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const presetAmounts = [101, 501, 1001, 5001];

  useEffect(() => {
    if (token) fetchMyDonations();
  }, [token, fetchMyDonations]);

  const handleDonate = async () => {
    const numAmount = Number(amount);
    if (!numAmount || numAmount <= 0) {
      Alert.alert('Invalid Amount', 'Please enter a valid donation amount');
      return;
    }
    if (isProcessing) return;
    setIsProcessing(true);

    try {
      const linkRes = await apiClient.post('/donations/payment-link', {
        amount: numAmount,
        message: message.trim() || undefined,
        isAnonymous
      });

      if (!linkRes.data?.success || !linkRes.data?.data?.url) {
        Alert.alert('Error', linkRes.data?.message || 'Could not create payment link');
        setIsProcessing(false);
        return;
      }

      const { url, paymentLinkId, expiresAt } = linkRes.data.data;
      await savePendingPaymentLink({ type: 'donation', paymentLinkId, url, expiresAt });

      const openResult = await openPaymentLink({
        url,
        confirm: async () => {
          const res = await apiClient.post('/donations/confirm-payment', { paymentLinkId });
          return { success: !!res.data?.success, message: res.data?.message, data: res.data?.data };
        },
      });

      if (openResult.success) {
        await clearPendingPaymentLinks('donation', undefined, paymentLinkId);
        Alert.alert('Thank You! 🙏', `Your donation of ₹${numAmount} has been received.`, [
          { text: 'OK', onPress: () => { setAmount(''); setMessage(''); fetchMyDonations(); } }
        ]);
      } else {
        Alert.alert('Payment', openResult.result?.message || 'Payment not completed. You can try again.');
      }
    } catch (err: any) {
      Alert.alert('Error', err?.message || 'Payment failed. Please try again.');
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <View style={[styles.container, { paddingTop: insets.top }]}>
      <View style={styles.header}>
        <TouchableOpacity onPress={() => router.canGoBack() ? router.back() : router.replace('/')} style={styles.backBtn}>
          <Ionicons name="arrow-back" size={24} color="#1F2937" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Donate</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>
        {/* Hero */}
        <View style={styles.hero}>
          <Text style={styles.heroEmoji}>🙏</Text>
          <Text style={styles.heroTitle}>Support Our Mission</Text>
          <Text style={styles.heroSubtitle}>Your contribution helps us spread wellness and spiritual knowledge to everyone.</Text>
        </View>

        {/* Amount Input */}
        <View style={styles.card}>
          <Text style={styles.label}>Donation Amount (₹)</Text>
          <TextInput
            style={styles.amountInput}
            placeholder="Enter amount"
            value={amount}
            onChangeText={setAmount}
            keyboardType="numeric"
            placeholderTextColor="#9CA3AF"
          />
          <View style={styles.presets}>
            {presetAmounts.map(p => (
              <TouchableOpacity key={p} style={[styles.presetBtn, amount === String(p) && styles.presetActive]} onPress={() => setAmount(String(p))}>
                <Text style={[styles.presetText, amount === String(p) && styles.presetTextActive]}>₹{p}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* Message */}
        <View style={styles.card}>
          <Text style={styles.label}>Message (Optional)</Text>
          <TextInput style={styles.msgInput} placeholder="Leave a message..." value={message} onChangeText={setMessage} multiline placeholderTextColor="#9CA3AF" />
        </View>

        {/* Anonymous Toggle */}
        <TouchableOpacity style={styles.anonRow} onPress={() => setIsAnonymous(!isAnonymous)}>
          <Ionicons name={isAnonymous ? 'checkbox' : 'square-outline'} size={22} color="#8B5CF6" />
          <Text style={styles.anonText}>Donate anonymously</Text>
        </TouchableOpacity>

        {/* Donate Button */}
        <TouchableOpacity style={[styles.donateBtn, (!amount || isProcessing) && styles.donateDisabled]} onPress={handleDonate} disabled={!amount || isProcessing}>
          {isProcessing ? <ActivityIndicator color="#FFF" /> : <Text style={styles.donateBtnText}>Donate via Razorpay</Text>}
        </TouchableOpacity>

        {/* Donation History */}
        <View style={styles.historySection}>
          <Text style={styles.historyTitle}>Donation History</Text>
          {isLoading ? (
            <ActivityIndicator color="#8B5CF6" style={{ marginTop: 20 }} />
          ) : donations.length === 0 ? (
            <Text style={styles.emptyText}>No donations yet. Be the first to contribute!</Text>
          ) : (
            donations.slice(0, 10).map(d => (
              <View key={d._id} style={styles.historyCard}>
                <View style={styles.historyRow}>
                  <Ionicons name="heart-circle" size={24} color="#EF4444" />
                  <View style={styles.historyInfo}>
                    <Text style={styles.historyAmount}>₹{d.amount}</Text>
                    <Text style={styles.historyDate}>{new Date(d.createdAt).toLocaleDateString('en-IN')}</Text>
                  </View>
                  <Text style={styles.historyStatus}>{d.status}</Text>
                </View>
              </View>
            ))
          )}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#F9FAFB' },
  header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFF', borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  backBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
  headerTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937' },
  scroll: { padding: 16, paddingBottom: 40 },
  hero: { alignItems: 'center', paddingVertical: 24 },
  heroEmoji: { fontSize: 48, marginBottom: 12 },
  heroTitle: { fontSize: 24, fontWeight: '800', color: '#1F2937', marginBottom: 8 },
  heroSubtitle: { fontSize: 14, color: '#6B7280', textAlign: 'center', paddingHorizontal: 20 },
  card: { backgroundColor: '#FFF', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#E5E7EB' },
  label: { fontSize: 14, fontWeight: '600', color: '#374151', marginBottom: 8 },
  amountInput: { fontSize: 32, fontWeight: '700', color: '#8B5CF6', borderBottomWidth: 2, borderBottomColor: '#E5E7EB', paddingVertical: 8, marginBottom: 12 },
  presets: { flexDirection: 'row', gap: 8, flexWrap: 'wrap' },
  presetBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 20, borderWidth: 1, borderColor: '#D1D5DB', backgroundColor: '#FFF' },
  presetActive: { backgroundColor: '#8B5CF6', borderColor: '#8B5CF6' },
  presetText: { fontSize: 14, fontWeight: '600', color: '#6B7280' },
  presetTextActive: { color: '#FFF' },
  msgInput: { fontSize: 14, color: '#1F2937', borderWidth: 1, borderColor: '#E5E7EB', borderRadius: 12, padding: 12, minHeight: 60, textAlignVertical: 'top' },
  anonRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 20 },
  anonText: { fontSize: 14, color: '#374151' },
  donateBtn: { backgroundColor: '#8B5CF6', borderRadius: 16, paddingVertical: 18, alignItems: 'center', marginBottom: 30, shadowColor: '#8B5CF6', shadowOffset: { width: 0, height: 4 }, shadowOpacity: 0.3, shadowRadius: 8, elevation: 6 },
  donateDisabled: { opacity: 0.6 },
  donateBtnText: { color: '#FFF', fontSize: 18, fontWeight: '700' },
  historySection: { marginTop: 10 },
  historyTitle: { fontSize: 18, fontWeight: '700', color: '#1F2937', marginBottom: 12 },
  emptyText: { fontSize: 14, color: '#9CA3AF', textAlign: 'center', marginTop: 16 },
  historyCard: { backgroundColor: '#FFF', borderRadius: 12, padding: 14, marginBottom: 8, borderWidth: 1, borderColor: '#E5E7EB' },
  historyRow: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  historyInfo: { flex: 1 },
  historyAmount: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
  historyDate: { fontSize: 12, color: '#9CA3AF' },
  historyStatus: { fontSize: 12, fontWeight: '600', color: '#10B981', textTransform: 'capitalize' },
});
