import React, { useCallback, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  TextInput,
  Linking,
  Alert,
  ActivityIndicator,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuthStore } from '../../store/authStore';
import { useTheme } from '../../hooks/useTheme';

interface SupportTicket {
  _id: string;
  message: string;
  status: 'pending' | 'in_progress' | 'resolved' | 'closed';
  priority: 'low' | 'medium' | 'high' | 'urgent';
  category: string;
  createdAt: string;
  resolvedAt?: string;
  adminReply?: {
    message?: string;
    repliedAt?: string;
    repliedBy?: { name?: string };
  };
}

const faqs = [
  { question: 'I cannot sign in, what do I do?', answer: 'There is no password to reset — you sign in with a one-time code (OTP) sent to your phone. If you cannot receive the OTP, contact support below.' },
  { question: 'How can I join a community group?', answer: 'Visit the Community tab, browse available groups, and tap the "Follow" button to join.' },
  { question: 'How do I access my purchased courses?', answer: 'All your purchased courses are available in the My Progress section under "Courses Completed".' },
  { question: 'Can I download content for offline viewing?', answer: 'Yes, premium members can download courses and podcasts for offline access. Look for the download icon.' },
  { question: 'How do I cancel my subscription?', answer: 'Open My Membership to view your active plan. To cancel or change your plan, contact support below.' },
];

const contactOptions = [
  { title: 'Email', icon: 'mail-outline', action: () => Linking.openURL('mailto:support@paramsukhonlinegurukul.com').catch(() => {}) },
  { title: 'Phone', icon: 'call-outline', action: () => Linking.openURL('tel:+919045504444').catch(() => {}) },
  { title: 'WhatsApp', icon: 'logo-whatsapp', action: () => Linking.openURL('whatsapp://send?phone=919045504444').catch(() => {}) },
  { title: 'Help Center', icon: 'help-circle-outline', action: () => Linking.openURL('https://paramsukhonlinegurukul.com/help').catch(() => {}) },
];

function getStatusStyle(status: SupportTicket['status'], colors: any) {
  switch (status) {
    case 'pending': return { bg: '#FEF3C7', text: '#D97706', border: '#FDE68A' };
    case 'in_progress': return { bg: colors.primary + '15', text: colors.primary, border: colors.primary + '30' };
    case 'resolved': return { bg: '#D1FAE5', text: '#059669', border: '#A7F3D0' };
    case 'closed': return { bg: colors.surfaceSecondary, text: colors.textSecondary, border: colors.border };
    default: return { bg: colors.surfaceSecondary, text: colors.textSecondary, border: colors.border };
  }
}

function makeStyles(colors: any) {
  return StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 20, paddingVertical: 16, backgroundColor: colors.surface },
    headerBtn: { width: 40, height: 40, borderRadius: 20, backgroundColor: colors.surfaceSecondary, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    scrollContent: { padding: 20 },
    sectionTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 16 },
    contactGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginBottom: 24 },
    contactCard: { flex: 1, minWidth: '45%', backgroundColor: colors.surface, padding: 20, borderRadius: 16, alignItems: 'center', shadowColor: colors.border, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    contactTitle: { fontSize: 14, fontWeight: '600', color: colors.text, marginTop: 8 },
    faqCard: { backgroundColor: colors.surface, borderRadius: 16, marginBottom: 12, overflow: 'hidden', shadowColor: colors.border, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    faqRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', padding: 16 },
    faqQuestion: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1, marginRight: 12 },
    faqAnswer: { paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: colors.border },
    faqAnswerText: { fontSize: 14, color: colors.textSecondary, lineHeight: 20 },
    sectionHeaderRow: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: 16 },
    ticketCard: { backgroundColor: colors.surface, borderRadius: 16, marginBottom: 12, overflow: 'hidden', shadowColor: colors.border, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    ticketRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12, marginBottom: 8 },
    ticketMessage: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1 },
    statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 },
    ticketFooter: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
    ticketDate: { fontSize: 12, color: colors.textSecondary },
    replyBadge: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    replyBadgeText: { fontSize: 12, fontWeight: '600', color: colors.primary },
    adminReplyCard: { backgroundColor: colors.primary + '10', borderRadius: 12, padding: 12, marginBottom: 12 },
    adminReplyLabel: { fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 4 },
    adminReplyText: { fontSize: 14, color: colors.text, lineHeight: 20 },
    adminReplyMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 8 },
    pendingReplyCard: { backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, marginBottom: 12, borderWidth: 1, borderColor: colors.border },
    pendingReplyText: { fontSize: 14, color: colors.textSecondary },
    closeBtn: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 8 },
    closeBtnActive: { backgroundColor: colors.text },
    closeBtnDisabled: { backgroundColor: colors.surfaceSecondary },
    closeBtnText: { fontSize: 14, fontWeight: '600', color: colors.surface },
    messageCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 24, shadowColor: colors.border, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    messageInput: { backgroundColor: colors.surfaceSecondary, borderRadius: 12, padding: 12, fontSize: 15, color: colors.text, minHeight: 120, marginBottom: 16, borderWidth: 1, borderColor: colors.border },
    submitBtn: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', paddingVertical: 12, borderRadius: 12, gap: 8 },
    submitBtnActive: { backgroundColor: colors.primary },
    submitBtnDisabled: { backgroundColor: colors.surfaceSecondary },
    submitBtnText: { fontSize: 16, fontWeight: '600', color: colors.surface },
    resourceCard: { flexDirection: 'row', alignItems: 'center', backgroundColor: colors.surface, padding: 16, borderRadius: 16, marginBottom: 12, shadowColor: colors.border, shadowOffset: { width: 0, height: 2 }, shadowOpacity: 0.05, shadowRadius: 8, elevation: 2 },
    resourceText: { fontSize: 15, fontWeight: '600', color: colors.text, flex: 1, marginLeft: 12 },
  });
}

export default function HelpSupportScreen() {
  const { colors } = useTheme();
  const s = makeStyles(colors);
  const router = useRouter();
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [ticketsError, setTicketsError] = useState(false);
  const [closingTicketId, setClosingTicketId] = useState<string | null>(null);

  const formatDateTime = (value?: string) => !value ? '' : new Date(value).toLocaleString(undefined, { hour12: true });

  const loadMyTickets = useCallback(async () => {
    const token = useAuthStore.getState().token;
    if (!token) { setTickets([]); return; }
    setIsLoadingTickets(true);
    setTicketsError(false);
    try {
      const response = await axios.get(`${API_URL}/support/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });
      if (response.data.success) {
        setTickets(Array.isArray(response.data.messages) ? response.data.messages : []);
      }
    } catch (error: any) {
      setTicketsError(true);
      console.warn('Failed to load support requests:', error?.message || error);
    } finally {
      setIsLoadingTickets(false);
    }
  }, []);

  useFocusEffect(useCallback(() => { loadMyTickets(); }, [loadMyTickets]));

  const handleSubmit = async () => {
    if (!message.trim() || message.trim().length < 10) {
      Alert.alert('Error', 'Please enter a message (at least 10 characters)');
      return;
    }
    setIsSubmitting(true);
    try {
      const token = await useAuthStore.getState().token;
      const response = await axios.post(
        `${API_URL}/support/message`,
        { message: message.trim() },
        { headers: token ? { Authorization: `Bearer ${token}` } : undefined }
      );
      if (response.data.success) {
        Alert.alert('Success', response.data.message);
        setMessage('');
        await loadMyTickets();
        if (response.data.ticket?._id) setExpandedTicketId(response.data.ticket._id);
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to send message');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleCloseTicket = async (ticketId: string) => {
    const token = useAuthStore.getState().token;
    if (!token) return;
    setClosingTicketId(ticketId);
    try {
      const response = await axios.post(
        `${API_URL}/support/message/${ticketId}/close`, {},
        { headers: { Authorization: `Bearer ${token}` } }
      );
      if (response.data.success) {
        Alert.alert('Success', response.data.message || 'Ticket closed successfully');
        await loadMyTickets();
      }
    } catch (error: any) {
      Alert.alert('Error', error.response?.data?.message || 'Failed to close ticket');
    } finally {
      setClosingTicketId(null);
    }
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => { if (router.canGoBack()) router.back(); }}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Help & Support</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView style={{ flex: 1 }} contentContainerStyle={s.scrollContent}>
        {/* Contact Us */}
        <View style={{ marginBottom: 24 }}>
          <Text style={s.sectionTitle}>Contact Us</Text>
          <View style={s.contactGrid}>
            {contactOptions.map((option, index) => (
              <TouchableOpacity key={index} style={s.contactCard} onPress={option.action}>
                <Ionicons name={option.icon as any} size={28} color={colors.primary} />
                <Text style={s.contactTitle}>{option.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* FAQs */}
        <View style={{ marginBottom: 24 }}>
          <Text style={s.sectionTitle}>Frequently Asked Questions</Text>
          {faqs.map((faq, index) => (
            <View key={index} style={s.faqCard}>
              <TouchableOpacity style={s.faqRow} onPress={() => setExpandedFAQ(expandedFAQ === index ? null : index)}>
                <Text style={s.faqQuestion}>{faq.question}</Text>
                <Ionicons name={expandedFAQ === index ? 'chevron-up' : 'chevron-down'} size={20} color={colors.textSecondary} />
              </TouchableOpacity>
              {expandedFAQ === index && (
                <View style={s.faqAnswer}>
                  <Text style={s.faqAnswerText}>{faq.answer}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Support History */}
        <View style={{ marginBottom: 24 }}>
          <View style={s.sectionHeaderRow}>
            <Text style={s.sectionTitle}>Your Support Requests</Text>
            {isLoadingTickets ? <ActivityIndicator size="small" color={colors.primary} /> : null}
          </View>

          {ticketsError && !isLoadingTickets ? (
            <View style={s.messageCard}>
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                Couldn&apos;t load your support requests. Please check your connection and try again.
              </Text>
            </View>
          ) : tickets.length === 0 && !isLoadingTickets ? (
            <View style={s.messageCard}>
              <Text style={{ fontSize: 14, color: colors.textSecondary }}>
                You haven&apos;t submitted any support requests yet.
              </Text>
            </View>
          ) : null}

          {tickets.map((ticket) => {
            const isExpanded = expandedTicketId === ticket._id;
            const hasReply = !!ticket.adminReply?.message;
            const statusStyle = getStatusStyle(ticket.status, colors);

            return (
              <View key={ticket._id} style={s.ticketCard}>
                <TouchableOpacity style={{ padding: 16 }} onPress={() => setExpandedTicketId(isExpanded ? null : ticket._id)}>
                  <View style={s.ticketRow}>
                    <Text style={s.ticketMessage} numberOfLines={2}>{ticket.message}</Text>
                    <View style={[s.statusChip, { backgroundColor: statusStyle.bg, borderWidth: 1, borderColor: statusStyle.border }]}>
                      <Text style={{ fontSize: 11, fontWeight: '700', color: statusStyle.text, textTransform: 'uppercase' }}>
                        {ticket.status.replace('_', ' ')}
                      </Text>
                    </View>
                  </View>
                  <View style={s.ticketFooter}>
                    <Text style={s.ticketDate}>Sent {formatDateTime(ticket.createdAt)}</Text>
                    <View style={s.replyBadge}>
                      {hasReply ? (
                        <>
                          <Ionicons name="chatbox-ellipses" size={14} color={colors.primary} />
                          <Text style={s.replyBadgeText}>Reply received</Text>
                        </>
                      ) : (
                        <Text style={{ fontSize: 12, color: colors.textSecondary }}>Awaiting reply</Text>
                      )}
                      <Ionicons name={isExpanded ? 'chevron-up' : 'chevron-down'} size={18} color={colors.textSecondary} />
                    </View>
                  </View>
                </TouchableOpacity>

                {isExpanded ? (
                  <View style={{ paddingHorizontal: 16, paddingBottom: 16, borderTopWidth: 1, borderTopColor: colors.border }}>
                    <View style={{ marginTop: 12, marginBottom: 12 }}>
                      <Text style={{ fontSize: 12, fontWeight: '600', color: colors.textSecondary, textTransform: 'uppercase', marginBottom: 4 }}>Your message</Text>
                      <Text style={{ fontSize: 14, color: colors.text, lineHeight: 20 }}>{ticket.message}</Text>
                    </View>

                    {hasReply ? (
                      <View style={s.adminReplyCard}>
                        <Text style={s.adminReplyLabel}>Support reply</Text>
                        <Text style={s.adminReplyText}>{ticket.adminReply?.message}</Text>
                        <Text style={s.adminReplyMeta}>
                          {ticket.adminReply?.repliedBy?.name || 'Support Team'} • {formatDateTime(ticket.adminReply?.repliedAt)}
                        </Text>
                      </View>
                    ) : (
                      <View style={s.pendingReplyCard}>
                        <Text style={s.pendingReplyText}>
                          Our team has not replied yet. You&apos;ll also see a notification in the bell when they do.
                        </Text>
                      </View>
                    )}

                    {ticket.status !== 'closed' && ticket.status !== 'resolved' ? (
                      <TouchableOpacity
                        style={[s.closeBtn, closingTicketId === ticket._id ? s.closeBtnDisabled : s.closeBtnActive]}
                        onPress={() => handleCloseTicket(ticket._id)}
                        disabled={closingTicketId === ticket._id}
                      >
                        <Text style={s.closeBtnText}>
                          {closingTicketId === ticket._id ? 'Closing...' : 'Close Ticket'}
                        </Text>
                      </TouchableOpacity>
                    ) : null}
                  </View>
                ) : null}
              </View>
            );
          })}
        </View>

        {/* Send Message */}
        <View style={{ marginBottom: 24 }}>
          <Text style={s.sectionTitle}>Send us a Message</Text>
          <View style={s.messageCard}>
            <TextInput
              style={s.messageInput}
              placeholder="Describe your issue or question..."
              placeholderTextColor={colors.textSecondary}
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              value={message}
              onChangeText={setMessage}
            />
            <TouchableOpacity
              style={[s.submitBtn, !message || message.length < 10 || isSubmitting ? s.submitBtnDisabled : s.submitBtnActive]}
              onPress={handleSubmit}
              disabled={!message || message.length < 10 || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color={colors.surface} />
              ) : (
                <>
                  <Text style={s.submitBtnText}>Submit</Text>
                  <Ionicons name="send" size={18} color={colors.surface} />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Additional Resources */}
        <View style={{ marginBottom: 24 }}>
          <Text style={s.sectionTitle}>Additional Resources</Text>
          <TouchableOpacity style={s.resourceCard}>
            <Ionicons name="book-outline" size={24} color={colors.primary} />
            <Text style={s.resourceText}>User Guide</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={s.resourceCard} onPress={() => router.push('/terms-privacy')}>
            <Ionicons name="document-text-outline" size={24} color={colors.primary} />
            <Text style={s.resourceText}>Terms of Service</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
          <TouchableOpacity style={s.resourceCard} onPress={() => router.push('/terms-privacy')}>
            <Ionicons name="shield-outline" size={24} color={colors.primary} />
            <Text style={s.resourceText}>Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={20} color={colors.textSecondary} />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
