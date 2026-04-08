import React, { useState, useEffect, useCallback } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, StyleSheet, Image, RefreshControl } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import Header from '../../components/Header';
import { useEventStore } from '../../store/eventStore';
import { useBottomTabBarHeight } from '../../hooks/useBottomTabBarHeight';

type EventTab = 'upcoming' | 'past';

export default function EventsScreen() {
  const router = useRouter();
  const [activeTab, setActiveTab] = useState<EventTab>('past');
  const { events, fetchEvents, isLoading } = useEventStore();
  const [ticketModal, setTicketModal] = useState<{ visible: boolean; event: any }>({
    visible: false,
    event: null
  });
  const [refreshing, setRefreshing] = useState(false);
  const bottomTabHeight = useBottomTabBarHeight();

  useEffect(() => {
    fetchEvents(activeTab);
  }, [activeTab, fetchEvents]);

  const onRefresh = useCallback(async () => {
    setRefreshing(true);
    await fetchEvents(activeTab);
    setRefreshing(false);
  }, [activeTab, fetchEvents]);

  const formatDate = (dateString: string) => {
    try {
      return new Date(dateString).toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
  };

  const openRegisterForm = (eventId: string) => {
    router.push({
      pathname: '/event-detail',
      params: {
        eventId,
        openRegister: '1'
      }
    });
  };

  const showTicket = (event: any) => {
    setTicketModal({ visible: true, event });
  };

  const viewEventDetails = (eventId: string) => {
    router.push({
      pathname: '/event-detail',
      params: { eventId }
    });
  };

  return (
    <View style={styles.container}>
      <Header />
      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ paddingBottom: bottomTabHeight }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} colors={['#EAB308']} />
        }
      >
        <View style={styles.content}>
          {/* Tab Switcher */}
          <View style={styles.tabSwitcher}>
            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'upcoming' && styles.tabButtonActive]}
              onPress={() => setActiveTab('upcoming')}
            >
              <Ionicons
                name="calendar"
                size={18}
                color={activeTab === 'upcoming' ? '#EAB308' : '#94A3B8'}
              />
              <Text style={[styles.tabButtonText, activeTab === 'upcoming' && styles.tabButtonTextActive]}>
                Upcoming
              </Text>
            </TouchableOpacity>

            <TouchableOpacity
              style={[styles.tabButton, activeTab === 'past' && styles.tabButtonActive]}
              onPress={() => setActiveTab('past')}
            >
              <Ionicons
                name="time"
                size={18}
                color={activeTab === 'past' ? '#EAB308' : '#94A3B8'}
              />
              <Text style={[styles.tabButtonText, activeTab === 'past' && styles.tabButtonTextActive]}>
                Past Events
              </Text>
            </TouchableOpacity>
          </View>

          {/* Section Header */}
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>
              {activeTab === 'upcoming' ? 'Upcoming' : 'Past'} Events
            </Text>
            <Text style={styles.sectionSubtitle}>
              {activeTab === 'upcoming' ? 'Join our upcoming gatherings' : 'Past events and memories'}
            </Text>
          </View>

          {/* Events List */}
          {isLoading ? (
            <ActivityIndicator size="large" color="#EAB308" style={{ marginTop: 20 }} />
          ) : events.length === 0 ? (
            <View style={styles.emptyState}>
              <Ionicons 
                name={activeTab === 'upcoming' ? 'calendar-outline' : 'time-outline'} 
                size={72} 
                color="#475569" 
              />
              <Text style={styles.emptyStateTitle}>
                {activeTab === 'upcoming' ? 'No Upcoming Events' : 'No Past Events'}
              </Text>
              <Text style={styles.emptyStateSubtitle}>
                {activeTab === 'upcoming' 
                  ? 'We\'re planning exciting events for you. Stay tuned for updates!'
                  : 'No past events to show yet. Join our upcoming events to create memories!'}
              </Text>
            </View>
          ) : (
            events.map((event) => {
              const handleCardPress = () => {
                // For past events, navigate based on available content
                if (activeTab === 'past') {
                  if (event.hasRecording) {
                    router.push({
                      pathname: '/event-videos',
                      params: {
                        eventId: event._id,
                        eventTitle: event.title,
                        eventColor: event.color,
                        eventEmoji: event.emoji,
                      }
                    });
                  } else if (event.imageCount > 0) {
                    router.push({
                      pathname: '/event-photos',
                      params: {
                        eventId: event._id,
                        eventTitle: event.title,
                        eventColor: event.color,
                        eventEmoji: event.emoji,
                        imageCount: event.imageCount.toString(),
                      }
                    });
                  }
                }
                // For upcoming events, show ticket if registered, else navigate to details
                if (activeTab === 'upcoming') {
                  if (event.isRegistered) {
                    showTicket(event);
                  } else {
                    viewEventDetails(event._id);
                  }
                }
              };

              return (
                <TouchableOpacity
                  key={event._id}
                  style={styles.card}
                  activeOpacity={0.7}
                  onPress={handleCardPress}
                >
                  <View style={styles.cardContent}>
                    {/* Header Row */}
                    <View style={styles.headerRow}>
                      <View style={[styles.emojiContainer, { backgroundColor: event.color + '15', overflow: 'hidden' }]}>
                        {event.thumbnailUrl ? (
                          <Image
                            source={{ uri: event.thumbnailUrl }}
                            style={styles.thumbnail}
                            resizeMode="cover"
                          />
                        ) : (
                          <Text style={styles.emoji}>{event.emoji}</Text>
                        )}
                      </View>
                      <View style={styles.headerText}>
                        <Text style={styles.title}>{event.title}</Text>
                        <Text style={styles.category}>{event.category}</Text>
                      </View>
                      <View style={[styles.colorBar, { backgroundColor: event.color }]} />
                    </View>

                    {/* Event Details */}
                    <View style={styles.details}>
                      <View style={styles.detailRow}>
                        <Ionicons name="calendar-outline" size={15} color="#94A3B8" />
                        <Text style={styles.detailText}>{formatDate(event.eventDate)}</Text>
                        <Text style={styles.detailDot}>•</Text>
                        <Ionicons name="time-outline" size={15} color="#94A3B8" />
                        <Text style={styles.detailText}>{event.eventTime}</Text>
                      </View>

                      <View style={styles.detailRow}>
                        <Ionicons name="location-outline" size={15} color="#94A3B8" />
                        <Text style={styles.detailText}>{event.location}</Text>
                      </View>
                    </View>

                    {/* Footer - Different for upcoming vs past */}
                    {activeTab === 'upcoming' ? (
                      <View style={styles.footer}>
                        <View style={styles.attending}>
                          <Ionicons name="people-outline" size={15} color="#94A3B8" />
                          <Text style={styles.attendingText}>{event.currentAttendees} attending</Text>
                        </View>
                        <View style={styles.footerActions}>
                          {event.notificationEnabled && (
                            <TouchableOpacity style={styles.notificationBtn}>
                              <Ionicons
                                name="notifications"
                                size={18}
                                color={event.color}
                              />
                            </TouchableOpacity>
                          )}
                          <TouchableOpacity
                            style={[styles.registerButton, {
                              backgroundColor: event.isRegistered ? '#10B981' : event.color,
                              opacity: event.isRegistered ? 0.9 : 1
                            }]}
                            disabled={event.isRegistered}
                            onPress={(e) => {
                              e.stopPropagation();
                              if (!event.isRegistered) {
                                openRegisterForm(event._id);
                              }
                            }}
                          >
                            {event.isRegistered && (
                              <Ionicons name="lock-closed" size={14} color="#FFFFFF" />
                            )}
                            <Text style={styles.registerButtonText}>
                              {event.isRegistered
                                ? 'Registered'
                                : event.isPaid
                                  ? `Register ₹${event.price}`
                                  : 'Register'}
                            </Text>
                            {!event.isRegistered && (
                              <Ionicons name="arrow-forward" size={14} color="#FFFFFF" />
                            )}
                          </TouchableOpacity>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.footer}>
                        <View style={styles.attending}>
                          <Ionicons name="people" size={15} color="#94A3B8" />
                          <Text style={styles.attendingText}>{event.currentAttendees} attended</Text>
                        </View>
                        <View style={styles.pastActions}>
                          {event.hasRecording && (
                            <TouchableOpacity
                              style={styles.actionBtn}
                              onPress={(e) => {
                                e.stopPropagation();
                                router.push({
                                  pathname: '/event-videos',
                                  params: {
                                    eventId: event._id,
                                    eventTitle: event.title,
                                    eventColor: event.color,
                                    eventEmoji: event.emoji,
                                  }
                                });
                              }}
                            >
                              <Ionicons name="play-circle" size={18} color={event.color} />
                              <Text style={[styles.actionBtnText, { color: event.color }]}>Watch</Text>
                            </TouchableOpacity>
                          )}
                          {event.imageCount > 0 && (
                            <TouchableOpacity
                              style={styles.actionBtn}
                              onPress={(e) => {
                                e.stopPropagation();
                                router.push({
                                  pathname: '/event-photos',
                                  params: {
                                    eventId: event._id,
                                    eventTitle: event.title,
                                    eventColor: event.color,
                                    eventEmoji: event.emoji,
                                    imageCount: event.imageCount.toString(),
                                  }
                                });
                              }}
                            >
                              <Ionicons name="images" size={18} color={event.color} />
                              <Text style={[styles.actionBtnText, { color: event.color }]}>
                                {event.imageCount} Photos
                              </Text>
                            </TouchableOpacity>
                          )}
                        </View>
                      </View>
                    )}
                  </View>
                </TouchableOpacity>
              );
            })
          )}

          {/* Bottom spacing */}
          <View style={{ height: 120 }} />
        </View>
      </ScrollView>

      {/* Ticket Modal */}
      <Modal
        visible={ticketModal.visible}
        transparent
        animationType="slide"
        onRequestClose={() => setTicketModal({ visible: false, event: null })}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            {/* Ticket Header */}
            <View style={[styles.ticketHeader, { backgroundColor: ticketModal.event?.color || '#EAB308' }]}>
              <View style={styles.ticketHeaderTop}>
                <View style={styles.ticketHeaderRow}>
                  <Ionicons name="checkmark-circle" size={24} color="#FFFFFF" />
                  <Text style={styles.ticketHeaderTitle}>Registration Confirmed</Text>
                </View>
                <TouchableOpacity onPress={() => setTicketModal({ visible: false, event: null })}>
                  <Ionicons name="close" size={24} color="#FFFFFF" />
                </TouchableOpacity>
              </View>
              <Text style={styles.ticketHeaderSubtitle}>
                {ticketModal.event?.title}
              </Text>
            </View>

            {/* Ticket Body */}
            <View style={styles.ticketBody}>
              {/* Event Details */}
              <View style={styles.ticketDetails}>
                <View style={styles.ticketDetailRow}>
                  <View style={[styles.ticketDetailIcon, { backgroundColor: (ticketModal.event?.color || '#F1842D') + '15' }]}>
                    <Ionicons name="calendar-outline" size={20} color={ticketModal.event?.color || '#EAB308'} />
                  </View>
                  <View style={styles.ticketDetailContent}>
                    <Text style={styles.ticketDetailLabel}>Date & Time</Text>
                    <Text style={styles.ticketDetailValue}>
                      {formatDate(ticketModal.event?.eventDate)}
                    </Text>
                    <Text style={styles.ticketDetailSubtext}>
                      {ticketModal.event?.eventTime}
                    </Text>
                  </View>
                </View>

                <View style={styles.ticketDetailRow}>
                  <View style={[styles.ticketDetailIcon, { backgroundColor: (ticketModal.event?.color || '#F1842D') + '15' }]}>
                    <Ionicons name="location-outline" size={20} color={ticketModal.event?.color || '#EAB308'} />
                  </View>
                  <View style={styles.ticketDetailContent}>
                    <Text style={styles.ticketDetailLabel}>Location</Text>
                    <Text style={styles.ticketDetailValue}>
                      {ticketModal.event?.location}
                    </Text>
                  </View>
                </View>

                <View style={styles.ticketDetailRow}>
                  <View style={[styles.ticketDetailIcon, { backgroundColor: (ticketModal.event?.color || '#F1842D') + '15' }]}>
                    <Ionicons name="pricetag-outline" size={20} color={ticketModal.event?.color || '#EAB308'} />
                  </View>
                  <View style={styles.ticketDetailContent}>
                    <Text style={styles.ticketDetailLabel}>Price</Text>
                    <Text style={styles.ticketDetailValue}>
                      {ticketModal.event?.isPaid ? `Rs. ${ticketModal.event?.price}` : 'Free'}
                    </Text>
                  </View>
                </View>
              </View>

              {/* Divider with ticket holes */}
              <View style={styles.ticketDivider}>
                <View style={styles.ticketDividerLine} />
                <View style={styles.ticketDividerHole} />
                <View style={styles.ticketDividerLine} />
              </View>

              {/* Ticket Info */}
              <View style={styles.ticketInfo}>
                <View style={styles.ticketInfoRow}>                    <Ionicons name="qr-code-outline" size={16} color="#94A3B8" />
                  <Text style={styles.ticketInfoLabel}>Registration ID</Text>
                </View>
                <Text style={styles.ticketInfoValue}>
                  EVT-{ticketModal.event?._id?.slice(-8).toUpperCase()}
                </Text>
              </View>

              {/* Status Badge */}
              <View style={styles.ticketStatus}>
                <View style={styles.ticketStatusDot} />
                <Text style={styles.ticketStatusText}>Confirmed Registration</Text>
              </View>

              {/* View Details Button */}
              <TouchableOpacity
                style={[styles.ticketViewButton, { backgroundColor: ticketModal.event?.color || '#F1842D' }]}
                onPress={() => {
                  setTicketModal({ visible: false, event: null });
                  viewEventDetails(ticketModal.event?._id);
                }}
              >
                <Text style={styles.ticketViewButtonText}>View Event Details</Text>
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#FDF8F3',
  },
  content: {
    padding: 20,
    paddingTop: 16,
    paddingBottom: 120,
  },
  emptyState: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 80,
    paddingHorizontal: 32,
  },
  emptyStateTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#1F2937',
    marginTop: 20,
    marginBottom: 8,
    textAlign: 'center',
  },
  emptyStateSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 22,
  },
  sectionHeader: {
    marginBottom: 24,
    paddingHorizontal: 4,
  },
  sectionTitle: {
    fontSize: 24,
    fontWeight: '700',
    color: '#1F2937',
    marginBottom: 6,
    letterSpacing: 0.3,
  },
  sectionSubtitle: {
    fontSize: 15,
    color: '#6B7280',
    fontWeight: '500',
  },
  tabSwitcher: {
    flexDirection: 'row',
    backgroundColor: '#1E293B',
    borderRadius: 20,
    padding: 6,
    marginBottom: 24,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 4,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
  },
  tabButton: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 14,
  },
  tabButtonActive: {
    backgroundColor: 'rgba(234, 179, 8, 0.15)',
  },
  tabButtonText: {
    fontSize: 14,
    fontWeight: '500',
    color: '#94A3B8',
  },
  tabButtonTextActive: {
    fontWeight: '600',
    color: '#EAB308',
  },
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 20,
    marginBottom: 18,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
    borderLeftWidth: 4,
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 12,
    elevation: 6,
  },
  cardContent: {
    padding: 20,
  },
  headerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 14,
    gap: 14,
  },
  emojiContainer: {
    width: 52,
    height: 52,
    borderRadius: 14,
    alignItems: 'center',
    justifyContent: 'center',
  },
  emoji: {
    fontSize: 28,
  },
  thumbnail: {
    width: '100%',
    height: '100%',
  },
  headerText: {
    flex: 1,
  },
  title: {
    fontSize: 18,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 4,
  },
  category: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  colorBar: {
    width: 4,
    height: 40,
    borderRadius: 2,
  },
  details: {
    gap: 10,
    marginBottom: 14,
  },
  detailRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  detailText: {
    fontSize: 14,
    color: '#E2E8F0',
    fontWeight: '500',
  },
  detailDot: {
    fontSize: 14,
    color: '#94A3B8',
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingTop: 14,
    borderTopWidth: 1,
    borderTopColor: 'rgba(148, 163, 184, 0.15)',
  },
  attending: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  attendingText: {
    fontSize: 13,
    color: '#94A3B8',
    fontWeight: '500',
  },
  footerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  notificationBtn: {
    width: 38,
    height: 38,
    borderRadius: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
  },
  registerButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 12,
    shadowColor: '#EAB308',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  registerButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  pastActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(15, 23, 42, 0.6)',
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
  },
  actionBtnText: {
    fontSize: 13,
    fontWeight: '600',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  modalContent: {
    backgroundColor: '#1E293B',
    width: '100%',
    maxWidth: 380,
    borderRadius: 28,
    overflow: 'hidden',
    shadowColor: '#0F172A',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.5,
    shadowRadius: 24,
    elevation: 12,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
  },
  ticketHeader: {
    padding: 24,
  },
  ticketHeaderTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 12,
  },
  ticketHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  ticketHeaderTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  ticketHeaderSubtitle: {
    fontSize: 15,
    color: 'rgba(255, 255, 255, 0.85)',
    fontWeight: '500',
  },
  ticketBody: {
    padding: 24,
  },
  ticketDetails: {
    gap: 16,
  },
  ticketDetailRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  ticketDetailIcon: {
    width: 44,
    height: 44,
    borderRadius: 22,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketDetailContent: {
    flex: 1,
  },
  ticketDetailLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
    marginBottom: 4,
  },
  ticketDetailValue: {
    fontSize: 17,
    fontWeight: '700',
    color: '#F8FAFC',
    marginBottom: 2,
  },
  ticketDetailSubtext: {
    fontSize: 14,
    color: '#E2E8F0',
    fontWeight: '500',
  },
  ticketDivider: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 20,
  },
  ticketDividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(148, 163, 184, 0.2)',
  },
  ticketDividerHole: {
    width: 12,
    height: 12,
    borderRadius: 6,
    backgroundColor: '#0F172A',
    marginHorizontal: 8,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.2)',
  },
  ticketInfo: {
    backgroundColor: 'rgba(15, 23, 42, 0.8)',
    borderRadius: 14,
    padding: 16,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(148, 163, 184, 0.15)',
  },
  ticketInfoRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  ticketInfoLabel: {
    fontSize: 12,
    color: '#94A3B8',
    fontWeight: '600',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  ticketInfoValue: {
    fontSize: 14,
    fontWeight: '700',
    color: '#E2E8F0',
    fontFamily: 'monospace',
  },
  ticketStatus: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 16,
  },
  ticketStatusDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#3B82F6',
  },
  ticketStatusText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  ticketViewButton: {
    marginTop: 16,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
    shadowColor: '#EAB308',
    shadowOffset: { width: 0, height: 0 },
    shadowOpacity: 0.4,
    shadowRadius: 12,
    elevation: 6,
  },
  ticketViewButtonText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
