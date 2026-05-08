import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, Text, ScrollView, TouchableOpacity, ActivityIndicator, Modal, StyleSheet, Image, RefreshControl, Animated, Platform, Dimensions } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import Header from '../../components/Header';
import { useEventStore } from '../../store/eventStore';
import { useBottomTabBarHeight } from '../../hooks/useBottomTabBarHeight';

const { width } = Dimensions.get('window');

type EventTab = 'upcoming' | 'past';

export default function EventsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const [activeTab, setActiveTab] = useState<EventTab>('upcoming');
  const { events, fetchEvents, isLoading } = useEventStore();
  const [ticketModal, setTicketModal] = useState<{ visible: boolean; event: any }>({
    visible: false,
    event: null
  });
  const [refreshing, setRefreshing] = useState(false);
  const bottomTabHeight = useBottomTabBarHeight();
  const scrollY = useRef(new Animated.Value(0)).current;

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
      const date = new Date(dateString);
      return date.toLocaleDateString('en-US', {
        month: 'short',
        day: 'numeric',
        year: 'numeric'
      });
    } catch {
      return dateString;
    }
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

  const renderEventCard = (event: any, index: number) => {
    const isPast = activeTab === 'past';
    const isRegistered = !!event.isRegistered;
    const hasAttended = !!event.hasAttended;
    const cardColor = event.color || '#8B5CF6';

    const handlePress = () => {
      if (isPast) {
        if (event.hasRecording || event.imageCount > 0) {
          router.push({
            pathname: '/event-media',
            params: {
              eventId: event._id,
              eventTitle: event.title,
              eventColor: cardColor,
              eventEmoji: event.emoji,
              initialTab: event.hasRecording ? 'videos' : 'photos'
            }
          });
        } else {
          viewEventDetails(event._id);
        }
      } else {
        if (isRegistered) {
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
        activeOpacity={0.9}
        onPress={handlePress}
      >
        <View style={styles.cardInner}>
          {/* Thumbnail / Image Section */}
          <View style={styles.cardImageContainer}>
            {event.thumbnailUrl || event.bannerUrl ? (
              <Image
                source={{ uri: event.thumbnailUrl || event.bannerUrl }}
                style={styles.cardImage}
                resizeMode="cover"
              />
            ) : (
              <View style={[styles.cardPlaceholder, { backgroundColor: cardColor + '20' }]}>
                <Text style={styles.cardEmoji}>{event.emoji || '📅'}</Text>
              </View>
            )}
            
            {/* Status Overlays */}
            <View style={styles.cardOverlayTop}>
              <View style={[styles.categoryBadge, { backgroundColor: 'rgba(255,255,255,0.9)' }]}>
                <Text style={[styles.categoryText, { color: cardColor }]}>{event.category}</Text>
              </View>
              {isRegistered && (
                <View style={[styles.registeredBadge, hasAttended && { backgroundColor: '#3B82F6' }]}>
                  <Ionicons name={hasAttended ? "star" : "checkmark-circle"} size={14} color="#FFFFFF" />
                  <Text style={styles.registeredBadgeText}>{hasAttended ? 'Attended' : 'Registered'}</Text>
                </View>
              )}
            </View>

            {event.isPaid && !isRegistered && (
              <View style={styles.priceTag}>
                <Text style={styles.priceText}>₹{event.price}</Text>
              </View>
            )}
          </View>

          {/* Content Section */}
          <View style={styles.cardBody}>
            <Text style={styles.cardTitle} numberOfLines={1}>{event.title}</Text>
            
            <View style={styles.cardMetaRow}>
              <View style={styles.cardMetaItem}>
                <Ionicons name="calendar-outline" size={14} color="#6B7280" />
                <Text style={styles.cardMetaText}>{formatDate(event.eventDate)}</Text>
              </View>
              <View style={styles.cardMetaDot} />
              <View style={styles.cardMetaItem}>
                <Ionicons name="time-outline" size={14} color="#6B7280" />
                <Text style={styles.cardMetaText}>{event.eventTime}</Text>
              </View>
            </View>

            <View style={[styles.cardMetaRow, { marginTop: 4 }]}>
              <View style={styles.cardMetaItem}>
                <Ionicons name="location-outline" size={14} color="#6B7280" />
                <Text style={styles.cardMetaText} numberOfLines={1}>{event.location}</Text>
              </View>
            </View>

            {/* Footer */}
            <View style={styles.cardFooter}>
              <View style={styles.attendeesContainer}>
                <View style={styles.attendeeAvatars}>
                  {[1, 2, 3].map((i) => (
                    <View key={i} style={[styles.avatarCircle, { marginLeft: i === 1 ? 0 : -8, backgroundColor: '#F3F4F6', zIndex: 4-i }]}>
                       <Ionicons name="person" size={10} color="#9CA3AF" />
                    </View>
                  ))}
                </View>
                <Text style={styles.attendeeCount}>
                  {event.currentAttendees} {isPast ? 'attended' : 'attending'}
                </Text>
              </View>

              <TouchableOpacity 
                style={[styles.cardActionBtn, { backgroundColor: isRegistered ? (hasAttended ? '#3B82F6' : '#10B981') : cardColor }]}
                onPress={(e) => {
                  e.stopPropagation();
                  handlePress();
                }}
              >
                <Text style={styles.cardActionBtnText}>
                  {isRegistered ? (hasAttended ? 'View Pass' : 'View Ticket') : isPast ? 'Details' : 'Register'}
                </Text>
                <Ionicons 
                  name={isRegistered ? "qr-code" : isPast ? "chevron-forward" : "arrow-forward"} 
                  size={14} 
                  color="#FFFFFF" 
                />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </TouchableOpacity>
    );
  };

  return (
    <View style={styles.container}>
      <Header />
      
      {/* Sticky Tab Bar */}
      <View style={styles.tabContainer}>
        <View style={styles.tabBar}>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'upcoming' && styles.tabItemActive]}
            onPress={() => setActiveTab('upcoming')}
          >
            <Text style={[styles.tabText, activeTab === 'upcoming' && styles.tabTextActive]}>Upcoming</Text>
            {activeTab === 'upcoming' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
          <TouchableOpacity
            style={[styles.tabItem, activeTab === 'past' && styles.tabItemActive]}
            onPress={() => setActiveTab('past')}
          >
            <Text style={[styles.tabText, activeTab === 'past' && styles.tabTextActive]}>Past Events</Text>
            {activeTab === 'past' && <View style={styles.tabIndicator} />}
          </TouchableOpacity>
        </View>
      </View>

      <ScrollView 
        showsVerticalScrollIndicator={false}
        contentContainerStyle={{ 
          paddingBottom: bottomTabHeight + 20,
          paddingHorizontal: 20,
          paddingTop: 10
        }}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor="#F1842D" />
        }
      >
        {isLoading && !refreshing ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#F1842D" />
            <Text style={styles.loadingText}>Fetching events...</Text>
          </View>
        ) : events.length === 0 ? (
          <View style={styles.emptyContainer}>
            <View style={styles.emptyIconContainer}>
              <Ionicons name="calendar-outline" size={64} color="#D1D5DB" />
            </View>
            <Text style={styles.emptyTitle}>No Events Found</Text>
            <Text style={styles.emptySubtitle}>
              {activeTab === 'upcoming' 
                ? "We don't have any upcoming events scheduled right now."
                : "No past events to display at the moment."}
            </Text>
            {activeTab === 'upcoming' && (
              <TouchableOpacity style={styles.emptyAction} onPress={onRefresh}>
                <Text style={styles.emptyActionText}>Refresh to check again</Text>
              </TouchableOpacity>
            )}
          </View>
        ) : (
          events.map((event, index) => renderEventCard(event, index))
        )}
        
        {/* Bottom Spacing */}
        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Ticket Modal */}
      <Modal
        visible={ticketModal.visible}
        transparent
        animationType="fade"
        onRequestClose={() => setTicketModal({ visible: false, event: null })}
      >
        <View style={styles.modalOverlay}>
          <TouchableOpacity 
            style={styles.modalDismiss} 
            activeOpacity={1} 
            onPress={() => setTicketModal({ visible: false, event: null })}
          />
          <View style={styles.ticketCard}>
             <View style={[styles.ticketTop, { backgroundColor: ticketModal.event?.color || '#F1842D' }]}>
                <View style={styles.ticketHeader}>
                   <View>
                      <Text style={styles.ticketBrand}>EVENT PASS</Text>
                      <Text style={styles.ticketEventTitle} numberOfLines={1}>{ticketModal.event?.title}</Text>
                   </View>
                   <View style={styles.ticketIconContainer}>
                      <Text style={styles.ticketEmoji}>{ticketModal.event?.emoji || '🎟️'}</Text>
                   </View>
                </View>
             </View>

             <View style={styles.ticketBody}>
                <View style={styles.ticketGrid}>
                   <View style={styles.ticketGridItem}>
                      <Text style={styles.ticketLabel}>DATE</Text>
                      <Text style={styles.ticketValue}>{formatDate(ticketModal.event?.eventDate)}</Text>
                   </View>
                   <View style={styles.ticketGridItem}>
                      <Text style={styles.ticketLabel}>TIME</Text>
                      <Text style={styles.ticketValue}>{ticketModal.event?.eventTime}</Text>
                   </View>
                </View>

                <View style={[styles.ticketGrid, { marginTop: 16 }]}>
                   <View style={styles.ticketGridItem}>
                      <Text style={styles.ticketLabel}>LOCATION</Text>
                      <Text style={styles.ticketValue} numberOfLines={1}>{ticketModal.event?.location}</Text>
                   </View>
                   <View style={styles.ticketGridItem}>
                      <Text style={styles.ticketLabel}>STATUS</Text>
                      <View style={styles.statusBadge}>
                         <View style={[styles.statusDot, ticketModal.event?.hasAttended && { backgroundColor: '#3B82F6' }]} />
                         <Text style={[styles.statusText, ticketModal.event?.hasAttended && { color: '#3B82F6' }]}>
                            {ticketModal.event?.hasAttended ? 'ATTENDED' : 'CONFIRMED'}
                         </Text>
                      </View>
                   </View>
                </View>

                <View style={styles.ticketSeparator}>
                   <View style={styles.separatorDotLeft} />
                   <View style={styles.separatorLine} />
                   <View style={styles.separatorDotRight} />
                </View>

                <View style={styles.qrSection}>
                   <View style={styles.qrPlaceholder}>
                      <Ionicons name="qr-code" size={140} color="#111827" />
                   </View>
                   <Text style={styles.qrCodeText}>EVT-{ticketModal.event?._id?.slice(-8).toUpperCase()}</Text>
                </View>
             </View>

             <TouchableOpacity 
              style={[styles.ticketCloseBtn, { backgroundColor: ticketModal.event?.color || '#F1842D' }]}
              onPress={() => setTicketModal({ visible: false, event: null })}
             >
                <Text style={styles.ticketCloseBtnText}>Close Pass</Text>
             </TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#F9FAFB',
  },
  tabContainer: {
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 20,
    paddingTop: 10,
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
  },
  tabBar: {
    flexDirection: 'row',
    gap: 20,
  },
  tabItem: {
    paddingVertical: 12,
    position: 'relative',
  },
  tabItemActive: {
  },
  tabText: {
    fontSize: 15,
    fontWeight: '600',
    color: '#9CA3AF',
  },
  tabTextActive: {
    color: '#111827',
  },
  tabIndicator: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    height: 3,
    backgroundColor: '#F1842D',
    borderRadius: 3,
  },
  loadingContainer: {
    paddingVertical: 100,
    alignItems: 'center',
  },
  loadingText: {
    marginTop: 12,
    fontSize: 14,
    color: '#6B7280',
    fontWeight: '500',
  },
  emptyContainer: {
    paddingVertical: 80,
    alignItems: 'center',
    paddingHorizontal: 40,
  },
  emptyIconContainer: {
    width: 120,
    height: 120,
    borderRadius: 60,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  emptyTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#374151',
    marginBottom: 8,
  },
  emptySubtitle: {
    fontSize: 14,
    color: '#6B7280',
    textAlign: 'center',
    lineHeight: 20,
  },
  emptyAction: {
    marginTop: 24,
    paddingHorizontal: 20,
    paddingVertical: 10,
    borderRadius: 12,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  emptyActionText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F1842D',
  },
  card: {
    marginBottom: 20,
    backgroundColor: '#FFFFFF',
    borderRadius: 24,
    overflow: 'hidden',
    ...Platform.select({
      ios: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
      },
      android: {
        elevation: 4,
      },
    }),
  },
  cardInner: {
  },
  cardImageContainer: {
    width: '100%',
    height: 160,
    backgroundColor: '#F3F4F6',
    position: 'relative',
  },
  cardImage: {
    width: '100%',
    height: '100%',
  },
  cardPlaceholder: {
    width: '100%',
    height: '100%',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardEmoji: {
    fontSize: 48,
  },
  cardOverlayTop: {
    position: 'absolute',
    top: 12,
    left: 12,
    right: 12,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  categoryBadge: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
  },
  categoryText: {
    fontSize: 11,
    fontWeight: '700',
    textTransform: 'uppercase',
  },
  registeredBadge: {
    backgroundColor: '#10B981',
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 12,
    gap: 4,
  },
  registeredBadgeText: {
    color: '#FFFFFF',
    fontSize: 11,
    fontWeight: '700',
  },
  priceTag: {
    position: 'absolute',
    bottom: 12,
    right: 12,
    backgroundColor: 'rgba(0,0,0,0.6)',
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: 10,
  },
  priceText: {
    color: '#FFFFFF',
    fontSize: 14,
    fontWeight: '700',
  },
  cardBody: {
    padding: 16,
  },
  cardTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: '#111827',
    marginBottom: 8,
  },
  cardMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 4,
  },
  cardMetaItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  cardMetaText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '500',
  },
  cardMetaDot: {
    width: 3,
    height: 3,
    borderRadius: 1.5,
    backgroundColor: '#D1D5DB',
  },
  cardFooter: {
    marginTop: 16,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingTop: 16,
    borderTopWidth: 1,
    borderTopColor: '#F3F4F6',
  },
  attendeesContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  attendeeAvatars: {
    flexDirection: 'row',
    alignItems: 'center',
  },
  avatarCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
  attendeeCount: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '600',
  },
  cardActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 12,
  },
  cardActionBtnText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.7)',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  modalDismiss: {
    position: 'absolute',
    inset: 0,
  },
  ticketCard: {
    width: '100%',
    backgroundColor: '#FFFFFF',
    borderRadius: 32,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 20 },
    shadowOpacity: 0.3,
    shadowRadius: 30,
    elevation: 20,
  },
  ticketTop: {
    padding: 24,
    paddingBottom: 32,
  },
  ticketHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  ticketBrand: {
    color: 'rgba(255,255,255,0.7)',
    fontSize: 12,
    fontWeight: '800',
    letterSpacing: 2,
    marginBottom: 4,
  },
  ticketEventTitle: {
    color: '#FFFFFF',
    fontSize: 24,
    fontWeight: '800',
    width: width * 0.5,
  },
  ticketIconContainer: {
    width: 56,
    height: 56,
    borderRadius: 18,
    backgroundColor: 'rgba(255,255,255,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketEmoji: {
    fontSize: 32,
  },
  ticketBody: {
    padding: 24,
    backgroundColor: '#FFFFFF',
    marginTop: -16,
    borderTopLeftRadius: 32,
    borderTopRightRadius: 32,
  },
  ticketGrid: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  ticketGridItem: {
    flex: 1,
  },
  ticketLabel: {
    fontSize: 10,
    fontWeight: '700',
    color: '#9CA3AF',
    letterSpacing: 1,
    marginBottom: 4,
  },
  ticketValue: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
  },
  statusBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statusDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#10B981',
  },
  statusText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#10B981',
  },
  ticketSeparator: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 24,
    position: 'relative',
  },
  separatorLine: {
    flex: 1,
    height: 1,
    borderStyle: 'dashed',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 1,
  },
  separatorDotLeft: {
    position: 'absolute',
    left: -32,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  separatorDotRight: {
    position: 'absolute',
    right: -32,
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: 'rgba(0,0,0,0.7)',
  },
  qrSection: {
    alignItems: 'center',
    paddingVertical: 10,
  },
  qrPlaceholder: {
    width: 160,
    height: 160,
    backgroundColor: '#F9FAFB',
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#F3F4F6',
  },
  qrCodeText: {
    marginTop: 12,
    fontSize: 12,
    fontWeight: '600',
    color: '#9CA3AF',
    fontFamily: Platform.OS === 'ios' ? 'Menlo' : 'monospace',
    letterSpacing: 1,
  },
  ticketCloseBtn: {
    margin: 24,
    marginTop: 0,
    height: 56,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
  },
  ticketCloseBtnText: {
    color: '#FFFFFF',
    fontSize: 16,
    fontWeight: '700',
  }
});
