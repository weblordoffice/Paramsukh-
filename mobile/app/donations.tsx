import React, { useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useDonationStore } from '@/store/donationStore';

export default function DonationsScreen() {
  const router = useRouter();
  const [showQR, setShowQR] = useState(false);
  const { recordDonation } = useDonationStore();

  const accountDetails = {
    accountName: 'Paramsukh Foundation',
    accountNumber: '1234567890',
    ifscCode: 'SBIN0001234',
    bankName: 'State Bank of India',
    branch: 'Main Branch',
    upiId: 'paramsukh@sbi'
  };

  const handlePay = async () => {
    // Open UPI payment intent
    const upiUrl = `upi://pay?pa=${accountDetails.upiId}&pn=${encodeURIComponent(accountDetails.accountName)}&cu=INR`;

    try {
      const supported = await Linking.canOpenURL(upiUrl);

      if (supported) {
        await Linking.openURL(upiUrl);

        // Ask user if payment was successful (since we can't know for sure with deep linking)
        Alert.alert(
          'Payment Confirmation',
          'Did you complete the payment successfully?',
          [
            { text: 'No', style: 'cancel' },
            {
              text: 'Yes',
              onPress: async () => {
                // Prompt for amount (since we didn't specify it in intent, or just default to 0/unknown)
                // ideally we should have an input field for amount before clicking Pay
                // For now, let's just record it as "User reported donation"

                await recordDonation({
                  amount: 0, // 0 indicates unknown/unverified
                  paymentMethod: 'UPI',
                  message: 'User reported successful UPI payment via app link'
                });
                Alert.alert('Thank You', 'Your donation has been recorded. We will verify and update your history shortly.');
              }
            }
          ]
        );
      } else {
        Alert.alert('Error', 'No UPI app found on your device');
      }
    } catch (err) {
      Alert.alert('Error', 'Failed to open payment app');
    }
  };

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Donations</Text>
        <View style={styles.placeholder} />
      </View>

      <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
        {/* Paramsukh Banner */}
        <View style={styles.banner}>
          <View style={styles.logoContainer}>
            <Ionicons name="heart-circle" size={64} color="#EF4444" />
          </View>
          <Text style={styles.bannerTitle}>Paramsukh Foundation</Text>
          <Text style={styles.bannerSubtitle}>
            Your contribution makes a difference in countless lives
          </Text>
        </View>

        {/* Toggle: Account Details or QR Code */}
        <View style={styles.toggleContainer}>
          <TouchableOpacity
            style={[styles.toggleButton, !showQR && styles.toggleButtonActive]}
            onPress={() => setShowQR(false)}
          >
            <Ionicons
              name="card-outline"
              size={20}
              color={!showQR ? '#FFFFFF' : '#6B7280'}
            />
            <Text style={[styles.toggleText, !showQR && styles.toggleTextActive]}>
              Account Details
            </Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.toggleButton, showQR && styles.toggleButtonActive]}
            onPress={() => setShowQR(true)}
          >
            <Ionicons
              name="qr-code-outline"
              size={20}
              color={showQR ? '#FFFFFF' : '#6B7280'}
            />
            <Text style={[styles.toggleText, showQR && styles.toggleTextActive]}>
              Pay with QR
            </Text>
          </TouchableOpacity>
        </View>

        {/* Content Area */}
        {!showQR ? (
          // Account Details
          <View style={styles.contentCard}>
            <Text style={styles.contentTitle}>Bank Account Details</Text>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Account Name</Text>
              <Text style={styles.detailValue}>{accountDetails.accountName}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Account Number</Text>
              <Text style={styles.detailValue}>{accountDetails.accountNumber}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>IFSC Code</Text>
              <Text style={styles.detailValue}>{accountDetails.ifscCode}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Bank Name</Text>
              <Text style={styles.detailValue}>{accountDetails.bankName}</Text>
            </View>

            <View style={styles.detailRow}>
              <Text style={styles.detailLabel}>Branch</Text>
              <Text style={styles.detailValue}>{accountDetails.branch}</Text>
            </View>

            <View style={[styles.detailRow, styles.upiRow]}>
              <Text style={styles.detailLabel}>UPI ID</Text>
              <Text style={styles.upiValue}>{accountDetails.upiId}</Text>
            </View>
          </View>
        ) : (
          // QR Code
          <View style={styles.contentCard}>
            <Text style={styles.contentTitle}>Scan QR to Pay</Text>

            <View style={styles.qrContainer}>
              <View style={styles.qrPlaceholder}>
                <Ionicons name="qr-code" size={120} color="#9CA3AF" />
              </View>
              <Text style={styles.qrSubtext}>
                Scan with any UPI app to donate
              </Text>
            </View>

            <TouchableOpacity style={styles.payButton} onPress={handlePay}>
              <Ionicons name="wallet-outline" size={20} color="#FFFFFF" />
              <Text style={styles.payButtonText}>Pay Now</Text>
            </TouchableOpacity>
          </View>
        )}

        {/* Thank You Message */}
        <View style={styles.thankYouCard}>
          <Ionicons name="heart" size={24} color="#EF4444" />
          <Text style={styles.thankYouText}>
            Thank you for your generous support!
          </Text>
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  header: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 20,
    paddingTop: 50,
    paddingBottom: 16,
    backgroundColor: '#FFFFFF',
    borderBottomWidth: 1,
    borderBottomColor: '#E5E7EB',
  },
  backButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  placeholder: {
    width: 40,
  },
  scrollContent: {
    padding: 20,
  },
  banner: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    alignItems: 'center',
    marginBottom: 24,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  logoContainer: {
    marginBottom: 16,
  },
  bannerTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 8,
  },
  bannerSubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  toggleContainer: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 4,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  toggleButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    borderRadius: 10,
  },
  toggleButtonActive: {
    backgroundColor: '#3B82F6',
  },
  toggleText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  toggleTextActive: {
    color: '#FFFFFF',
  },
  contentCard: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    padding: 24,
    marginBottom: 20,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.08,
    shadowRadius: 8,
    elevation: 3,
  },
  contentTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 20,
    textAlign: 'center',
  },
  detailRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  detailLabel: {
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  detailValue: {
    fontSize: 14,
    color: '#111827',
    fontWeight: '600',
  },
  upiRow: {
    borderBottomWidth: 0,
    paddingTop: 16,
    marginTop: 8,
    backgroundColor: '#EFF6FF',
    paddingHorizontal: 12,
    borderRadius: 8,
  },
  upiValue: {
    fontSize: 14,
    color: '#3B82F6',
    fontWeight: '700',
  },
  qrContainer: {
    alignItems: 'center',
    marginBottom: 24,
  },
  qrPlaceholder: {
    width: 200,
    height: 200,
    backgroundColor: '#F9FAFB',
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 16,
    borderWidth: 2,
    borderColor: '#E5E7EB',
    borderStyle: 'dashed',
  },
  qrSubtext: {
    fontSize: 13,
    color: '#6B7280',
    textAlign: 'center',
  },
  payButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    backgroundColor: '#3B82F6',
    paddingVertical: 14,
    borderRadius: 12,
  },
  payButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  thankYouCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 12,
    backgroundColor: '#FEF2F2',
    padding: 16,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#FECACA',
  },
  thankYouText: {
    fontSize: 14,
    color: '#991B1B',
    fontWeight: '600',
  },
});
