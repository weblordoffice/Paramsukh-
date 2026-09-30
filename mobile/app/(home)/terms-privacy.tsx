import React, { useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  Linking,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Constants from 'expo-constants';
import { useTheme } from '../../hooks/useTheme';

export default function TermsPrivacyScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<'terms' | 'privacy'>('terms');

  const s = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.surface },
    headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    tabBar: { flexDirection: 'row', backgroundColor: colors.surface, paddingHorizontal: 20, paddingTop: 8, borderBottomWidth: 1, borderBottomColor: colors.border },
    tab: { flex: 1, paddingVertical: 12, alignItems: 'center', borderBottomWidth: 2 },
    tabActive: { borderBottomColor: colors.primary },
    tabInactive: { borderBottomColor: 'transparent' },
    tabText: { fontSize: 15, fontWeight: '600' },
    tabTextActive: { color: colors.primary },
    tabTextInactive: { color: colors.textSecondary },
    scrollContent: { padding: 20 },
    pageTitle: { fontSize: 24, fontWeight: '700', color: colors.text, marginBottom: 8 },
    lastUpdated: { fontSize: 13, color: colors.textSecondary, marginBottom: 24 },
    sectionTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginTop: 24, marginBottom: 12 },
    bodyText: { fontSize: 15, color: colors.text, lineHeight: 24, marginBottom: 16 },
    ctaButton: { marginTop: 32, backgroundColor: colors.primary + '12', borderRadius: 12, padding: 16, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', borderWidth: 1, borderColor: colors.primary + '30' },
    ctaText: { fontSize: 15, fontWeight: '600', color: colors.primary, marginLeft: 8 },
  });

  const content = {
    terms: [
      { title: '1. Acceptance of Terms', body: 'By accessing and using ParamSukh, you accept and agree to be bound by the terms and provision of this agreement. If you do not agree to these terms, please do not use our services.' },
      { title: '2. Use License', body: 'Permission is granted to temporarily access the materials (information or software) on ParamSukh for personal, non-commercial transitory viewing only. This is the grant of a license, not a transfer of title.' },
      { title: '3. User Accounts', body: 'You are responsible for maintaining the confidentiality of your account and password. You agree to accept responsibility for all activities that occur under your account.' },
      { title: '4. Content Guidelines', body: 'Users must not post content that is illegal, offensive, or violates the rights of others. We reserve the right to remove any content that violates these guidelines.' },
      { title: '5. Disclaimer', body: "The materials on ParamSukh are provided on an 'as is' basis. ParamSukh makes no warranties, expressed or implied, and hereby disclaims and negates all other warranties." },
    ],
    privacy: [
      { title: '1. Information We Collect', body: 'We collect information you provide directly to us, such as when you create an account, participate in interactive features, or communicate with us. This may include your name, email address, phone number, and profile information.' },
      { title: '2. How We Use Your Information', body: 'We use the information we collect to provide, maintain, and improve our services, to communicate with you, to monitor and analyze trends and usage, and to personalize your experience.' },
      { title: '3. Information Sharing', body: 'We do not share your personal information with third parties except as described in this policy. We may share information with service providers who perform services on our behalf.' },
      { title: '4. Data Security', body: 'We take reasonable measures to help protect information about you from loss, theft, misuse, unauthorized access, disclosure, alteration, and destruction.' },
      { title: '5. Your Rights', body: 'You have the right to access, update, or delete your personal information at any time. You can do this through your account settings or by contacting us directly.' },
      { title: '6. Cookies and Tracking', body: 'We use cookies and similar tracking technologies to track activity on our service and hold certain information. You can instruct your browser to refuse all cookies or to indicate when a cookie is being sent.' },
    ],
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Terms & Privacy</Text>
        <View style={{ width: 40 }} />
      </View>

      <View style={s.tabBar}>
        <TouchableOpacity
          style={[s.tab, activeTab === 'terms' ? s.tabActive : s.tabInactive]}
          onPress={() => setActiveTab('terms')}
        >
          <Text style={[s.tabText, activeTab === 'terms' ? s.tabTextActive : s.tabTextInactive]}>
            Terms of Service
          </Text>
        </TouchableOpacity>
        <TouchableOpacity
          style={[s.tab, activeTab === 'privacy' ? s.tabActive : s.tabInactive]}
          onPress={() => setActiveTab('privacy')}
        >
          <Text style={[s.tabText, activeTab === 'privacy' ? s.tabTextActive : s.tabTextInactive]}>
            Privacy Policy
          </Text>
        </TouchableOpacity>
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scrollContent}>
        <Text style={s.pageTitle}>{activeTab === 'terms' ? 'Terms of Service' : 'Privacy Policy'}</Text>
        <Text style={s.lastUpdated}>Last updated: November 8, 2025</Text>

        {(activeTab === 'terms' ? content.terms : content.privacy).map((item, i) => (
          <View key={i}>
            <Text style={s.sectionTitle}>{item.title}</Text>
            <Text style={s.bodyText}>{item.body}</Text>
          </View>
        ))}

        <TouchableOpacity
          style={s.ctaButton}
          onPress={() => {
            const url = Constants.expoConfig?.extra?.privacyPolicyUrl;
            if (url) Linking.openURL(url).catch(() => {});
          }}
        >
          <Ionicons name="open-outline" size={18} color={colors.primary} />
          <Text style={s.ctaText}>
            View Full {activeTab === 'terms' ? 'Terms of Service' : 'Privacy Policy'} Online
          </Text>
        </TouchableOpacity>
      </ScrollView>
    </SafeAreaView>
  );
}
