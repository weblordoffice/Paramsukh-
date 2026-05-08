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
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import axios from 'axios';
import { API_URL } from '../../config/api';
import { useAuthStore } from '../../store/authStore';

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
    repliedBy?: {
      name?: string;
    };
  };
}

export default function HelpSupportScreen() {
  const router = useRouter();
  const [expandedFAQ, setExpandedFAQ] = useState<number | null>(null);
  const [expandedTicketId, setExpandedTicketId] = useState<string | null>(null);
  const [message, setMessage] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [tickets, setTickets] = useState<SupportTicket[]>([]);
  const [isLoadingTickets, setIsLoadingTickets] = useState(false);
  const [closingTicketId, setClosingTicketId] = useState<string | null>(null);

  const faqs = [
    {    
      question: 'How do I reset my password?',
      answer: 'Go to Settings > Account > Change Password. You can reset your password from there.',
    },
    {
      question: 'How can I join a community group?',
      answer: 'Visit the Community tab, browse available groups, and tap the "Follow" button to join.',
    },
    {
      question: 'How do I access my purchased courses?',
      answer: 'All your purchased courses are available in the My Progress section under "Courses Completed".',
    },
    {
      question: 'Can I download content for offline viewing?',
      answer: 'Yes, premium members can download courses and podcasts for offline access. Look for the download icon.',
    },
    {
      question: 'How do I cancel my subscription?',
      answer: 'Go to Settings > Account > Manage Subscription to view and cancel your active subscriptions.',
    },
  ];

  const contactOptions = [
    { title: 'Email', icon: 'mail-outline', action: () => Linking.openURL('mailto:support@paramsukh.com') },
    { title: 'Phone', icon: 'call-outline', action: () => Linking.openURL('tel:+919045504444') },
    { title: 'WhatsApp', icon: 'logo-whatsapp', action: () => Linking.openURL('whatsapp://send?phone=919045504444') },
    { title: 'Help Center', icon: 'help-circle-outline', action: () => Linking.openURL('https://paramsukh.com/help') },
  ];

  const formatDateTime = (value?: string) => {
    if (!value) return '';
    return new Date(value).toLocaleString();
  };

  const getStatusChipClasses = (status: SupportTicket['status']) => {
    switch (status) {
      case 'pending':
        return 'bg-yellow-100 text-yellow-800';
      case 'in_progress':
        return 'bg-blue-100 text-blue-800';
      case 'resolved':
        return 'bg-green-100 text-green-800';
      case 'closed':
        return 'bg-gray-200 text-gray-700';
      default:
        return 'bg-gray-100 text-gray-700';
    }
  };

  const loadMyTickets = useCallback(async () => {
    const token = useAuthStore.getState().token;
    if (!token) {
      setTickets([]);
      return;
    }

    setIsLoadingTickets(true);
    try {
      const response = await axios.get(`${API_URL}/support/messages`, {
        headers: { Authorization: `Bearer ${token}` }
      });

      if (response.data.success) {
        setTickets(Array.isArray(response.data.messages) ? response.data.messages : []);
      }
    } catch (error: any) {
    } finally {
      setIsLoadingTickets(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      loadMyTickets();
    }, [loadMyTickets])
  );

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
        if (response.data.ticket?._id) {
          setExpandedTicketId(response.data.ticket._id);
        }
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to send message';
      Alert.alert('Error', msg);
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
        `${API_URL}/support/message/${ticketId}/close`,
        {},
        { headers: { Authorization: `Bearer ${token}` } }
      );

      if (response.data.success) {
        Alert.alert('Success', response.data.message || 'Ticket closed successfully');
        await loadMyTickets();
      }
    } catch (error: any) {
      const msg = error.response?.data?.message || 'Failed to close ticket';
      Alert.alert('Error', msg);
    } finally {
      setClosingTicketId(null);
    }
  };

  return (
    <SafeAreaView className="flex-1 bg-gray-50">
      {/* Header */}
      <View className="flex-row items-center justify-between px-5 py-4 bg-white border-b border-gray-200">
        <TouchableOpacity className="w-10 h-10 rounded-full bg-gray-100 items-center justify-center" onPress={() => router.push('/(home)/menu')}>
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text className="text-xl font-bold text-gray-900">Help & Support</Text>
        <View className="w-10" />
      </View>

      <ScrollView className="flex-1" contentContainerClassName="p-5">
        {/* Quick Contact */}
        <View className="mb-6">
          <Text className="text-xl font-bold text-gray-900 mb-4">Contact Us</Text>
          <View className="flex-row flex-wrap gap-3">
            {contactOptions.map((option, index) => (
              <TouchableOpacity
                key={index}
                className="flex-1 min-w-[45%] bg-white p-5 rounded-xl items-center shadow-sm"
                onPress={option.action}
              >
                <Ionicons name={option.icon as any} size={28} color="#3B82F6" />
                <Text className="text-sm font-semibold text-gray-900 mt-2">{option.title}</Text>
              </TouchableOpacity>
            ))}
          </View>
        </View>

        {/* FAQs */}
        <View className="mb-6">
          <Text className="text-xl font-bold text-gray-900 mb-4">Frequently Asked Questions</Text>
          {faqs.map((faq, index) => (
            <View key={index} className="bg-white rounded-xl mb-3 overflow-hidden shadow-sm">
              <TouchableOpacity
                className="flex-row items-center justify-between p-4"
                onPress={() => setExpandedFAQ(expandedFAQ === index ? null : index)}
              >
                <Text className="text-[15px] font-semibold text-gray-900 flex-1 mr-3">{faq.question}</Text>
                <Ionicons
                  name={expandedFAQ === index ? 'chevron-up' : 'chevron-down'}
                  size={20}
                  color="#6B7280"
                />
              </TouchableOpacity>
              {expandedFAQ === index && (
                <View className="px-4 pb-4 border-t border-gray-100">
                  <Text className="text-sm text-gray-500 leading-5">{faq.answer}</Text>
                </View>
              )}
            </View>
          ))}
        </View>

        {/* Support History */}
        <View className="mb-6">
          <View className="flex-row items-center justify-between mb-4">
            <Text className="text-xl font-bold text-gray-900">Your Support Requests</Text>
            {isLoadingTickets ? <ActivityIndicator size="small" color="#3B82F6" /> : null}
          </View>

          {tickets.length === 0 && !isLoadingTickets ? (
            <View className="bg-white rounded-xl p-4 shadow-sm">
              <Text className="text-sm text-gray-500">
                You haven&apos;t submitted any support requests yet.
              </Text>
            </View>
          ) : null}

          {tickets.map((ticket) => {
            const isExpanded = expandedTicketId === ticket._id;
            const hasReply = !!ticket.adminReply?.message;

            return (
              <View key={ticket._id} className="bg-white rounded-xl mb-3 overflow-hidden shadow-sm">
                <TouchableOpacity
                  className="p-4"
                  onPress={() => setExpandedTicketId(isExpanded ? null : ticket._id)}
                >
                  <View className="flex-row items-start justify-between gap-3 mb-2">
                    <View className="flex-1">
                      <Text className="text-[15px] font-semibold text-gray-900" numberOfLines={2}>
                        {ticket.message}
                      </Text>
                    </View>
                    <View className={`px-2.5 py-1 rounded-full ${getStatusChipClasses(ticket.status)}`}>
                      <Text className="text-[11px] font-bold uppercase">
                        {ticket.status.replace('_', ' ')}
                      </Text>
                    </View>
                  </View>

                  <View className="flex-row items-center justify-between">
                    <Text className="text-xs text-gray-500">
                      Sent {formatDateTime(ticket.createdAt)}
                    </Text>
                    <View className="flex-row items-center gap-2">
                      {hasReply ? (
                        <View className="flex-row items-center gap-1">
                          <Ionicons name="chatbox-ellipses" size={14} color="#2563EB" />
                          <Text className="text-xs font-semibold text-blue-600">Reply received</Text>
                        </View>
                      ) : (
                        <Text className="text-xs text-gray-400">Awaiting reply</Text>
                      )}
                      <Ionicons
                        name={isExpanded ? 'chevron-up' : 'chevron-down'}
                        size={18}
                        color="#6B7280"
                      />
                    </View>
                  </View>
                </TouchableOpacity>

                {isExpanded ? (
                  <View className="px-4 pb-4 border-t border-gray-100">
                    <View className="mt-3 mb-3">
                      <Text className="text-xs font-semibold text-gray-500 uppercase mb-1">Your message</Text>
                      <Text className="text-sm text-gray-800 leading-5">{ticket.message}</Text>
                    </View>

                    {hasReply ? (
                      <View className="bg-blue-50 border border-blue-100 rounded-lg p-3 mb-3">
                        <Text className="text-xs font-semibold text-blue-700 uppercase mb-1">Support reply</Text>
                        <Text className="text-sm text-gray-900 leading-5">{ticket.adminReply?.message}</Text>
                        <Text className="text-xs text-blue-700 mt-2">
                          {ticket.adminReply?.repliedBy?.name || 'Support Team'} • {formatDateTime(ticket.adminReply?.repliedAt)}
                        </Text>
                      </View>
                    ) : (
                      <View className="bg-gray-50 border border-gray-200 rounded-lg p-3 mb-3">
                        <Text className="text-sm text-gray-500">
                          Our team has not replied yet. You&apos;ll also see a notification in the bell when they do.
                        </Text>
                      </View>
                    )}

                    {ticket.status !== 'closed' && ticket.status !== 'resolved' ? (
                      <TouchableOpacity
                        className={`self-start px-4 py-2 rounded-lg ${closingTicketId === ticket._id ? 'bg-gray-300' : 'bg-gray-900'}`}
                        onPress={() => handleCloseTicket(ticket._id)}
                        disabled={closingTicketId === ticket._id}
                      >
                        <Text className="text-sm font-semibold text-white">
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
        <View className="mb-6">
          <Text className="text-xl font-bold text-gray-900 mb-4">Send us a Message</Text>
          <View className="bg-white rounded-xl p-4 shadow-sm">
            <TextInput
              className="text-[15px] text-gray-900 min-h-[120px] mb-4 p-3 bg-gray-50 rounded-lg border border-gray-200"
              placeholder="Describe your issue or question..."
              multiline
              numberOfLines={6}
              textAlignVertical="top"
              value={message}
              onChangeText={setMessage}
            />
            <TouchableOpacity
              className={`flex-row items-center justify-center py-3 rounded-lg gap-2 ${
                !message || message.length < 10 || isSubmitting ? 'bg-gray-300' : 'bg-blue-500'
              }`}
              onPress={handleSubmit}
              disabled={!message || message.length < 10 || isSubmitting}
            >
              {isSubmitting ? (
                <ActivityIndicator size="small" color="#FFFFFF" />
              ) : (
                <>
                  <Text className="text-base font-semibold text-white">Submit</Text>
                  <Ionicons name="send" size={18} color="#FFFFFF" />
                </>
              )}
            </TouchableOpacity>
          </View>
        </View>

        {/* Additional Resources */}
        <View className="mb-6">
          <Text className="text-xl font-bold text-gray-900 mb-4">Additional Resources</Text>
          <TouchableOpacity className="flex-row items-center bg-white p-4 rounded-xl mb-3 shadow-sm">
            <Ionicons name="book-outline" size={24} color="#3B82F6" />
            <Text className="text-[15px] font-semibold text-gray-900 flex-1 ml-3">User Guide</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center bg-white p-4 rounded-xl mb-3 shadow-sm">
            <Ionicons name="document-text-outline" size={24} color="#3B82F6" />
            <Text className="text-[15px] font-semibold text-gray-900 flex-1 ml-3">Terms of Service</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
          <TouchableOpacity className="flex-row items-center bg-white p-4 rounded-xl mb-3 shadow-sm">
            <Ionicons name="shield-outline" size={24} color="#3B82F6" />
            <Text className="text-[15px] font-semibold text-gray-900 flex-1 ml-3">Privacy Policy</Text>
            <Ionicons name="chevron-forward" size={20} color="#9CA3AF" />
          </TouchableOpacity>
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}
