import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Alert, TextInput, Modal } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Calendar } from 'react-native-calendars';
import { useCounselingStore } from '../store/counselingStore';
import { useTheme } from '../hooks/useTheme';
import { formatTime12h } from '../utils/dateTime';
import { openPaymentLink, savePendingPaymentLink, clearPendingPaymentLinks } from '../utils/paymentBrowser';

const dateOnlyToLocal = (value?: string) => {
  if (!value) return null;
  const key = String(value).slice(0, 10);
  const [year, month, day] = key.split('-').map(Number);
  if (!year || !month || !day) return null;
  return new Date(year, month - 1, day);
};

const formatBookingDate = (value?: string, options?: Intl.DateTimeFormatOptions) => {
  const date = dateOnlyToLocal(value);
  if (!date) return '—';
  return date.toLocaleDateString('en-IN', options || { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' });
};

export default function CounselingDetailScreen() {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: colors.background },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: colors.surface, borderBottomWidth: 1, borderBottomColor: colors.surfaceSecondary },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: colors.background, borderRadius: 20 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    scrollContent: { padding: 16, paddingBottom: 40 },
    card: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.surfaceSecondary },
    statusRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
    sessionTitle: { fontSize: 20, fontWeight: '800', color: colors.text, flex: 1, marginRight: 8 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    statusConfirmed: { backgroundColor: '#DCFCE7' },
    statusPending: { backgroundColor: '#FEF3C7' },
    statusText: { fontSize: 10, fontWeight: '700', color: '#166534' },
    counselorText: { fontSize: 14, color: colors.textSecondary, marginBottom: 12 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    infoText: { fontSize: 14, color: colors.text },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginBottom: 12 },
    platformRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    platformText: { fontSize: 16, fontWeight: '700', color: colors.text },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: colors.surfaceSecondary },
    detailLabel: { fontSize: 14, color: colors.textSecondary },
    detailValue: { fontSize: 14, fontWeight: '600', color: colors.text, flexShrink: 1, marginLeft: 12, textAlign: 'right' },
    linkValue: { color: '#2563EB', textDecorationLine: 'underline' },
    joinButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F1842D', borderRadius: 12, paddingVertical: 16, marginTop: 16 },
    joinButtonText: { color: colors.surface, fontSize: 16, fontWeight: '700' },
    hint: { textAlign: 'center', fontSize: 12, color: colors.textSecondary, marginTop: 10 },
    waitingCard: { alignItems: 'center', paddingVertical: 12 },
    waitingTitle: { fontSize: 15, fontWeight: '700', color: colors.text, marginTop: 8 },
    waitingText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 4, lineHeight: 19 },
    notesText: { fontSize: 14, color: colors.text, lineHeight: 20 },
    emptyText: { fontSize: 16, color: colors.textSecondary, marginTop: 12 },
    actionRow: { flexDirection: 'row', gap: 12, marginTop: 16 },
    cancelButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FEE2E2', borderRadius: 12, paddingVertical: 14 },
    cancelButtonText: { color: '#DC2626', fontSize: 14, fontWeight: '700' },
    rescheduleButton: { flex: 1, flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#FEF3C7', borderRadius: 12, paddingVertical: 14 },
    rescheduleButtonText: { color: '#D97706', fontSize: 14, fontWeight: '700' },
    feedbackButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F1842D', borderRadius: 12, paddingVertical: 14, marginTop: 16 },
    feedbackButtonText: { color: colors.surface, fontSize: 14, fontWeight: '700' },
    feedbackCard: { backgroundColor: colors.surface, borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: colors.surfaceSecondary },
    ratingRow: { flexDirection: 'row', justifyContent: 'center', gap: 8, marginVertical: 12 },
    starButton: { padding: 4 },
    feedbackInput: { backgroundColor: colors.background, borderRadius: 12, padding: 12, fontSize: 14, color: colors.text, minHeight: 80, textAlignVertical: 'top', borderWidth: 1, borderColor: colors.surfaceSecondary },
    feedbackInputContainer: { marginBottom: 8 },
    pendingBanner: { backgroundColor: '#FEF9C3', borderRadius: 12, padding: 12, marginBottom: 16, borderWidth: 1, borderColor: '#FDE047' },
    pendingBannerTitle: { fontSize: 14, fontWeight: '700', color: '#713F12', marginBottom: 4 },
    pendingBannerText: { fontSize: 13, color: '#92400E', marginBottom: 6 },
    pendingBannerAdmin: { backgroundColor: '#EDE9FE', borderColor: '#C4B5FD' },
    pendingBannerAdminTitle: { color: '#5B21B6' },
    pendingBannerAdminText: { color: '#6D28D9' },
    modalOverlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center', padding: 20 },
    modalContent: { backgroundColor: colors.surface, borderRadius: 20, padding: 20, width: '100%', maxWidth: 400 },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text, marginBottom: 16, textAlign: 'center' },
    calendarContainer: { borderRadius: 12, overflow: 'hidden', marginBottom: 16 },
    slotChipSelected: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, marginRight: 8, backgroundColor: '#F1842D', borderWidth: 1, borderColor: '#F1842D' },
    slotChipInactive: { paddingHorizontal: 16, paddingVertical: 8, borderRadius: 12, marginRight: 8, backgroundColor: colors.surfaceSecondary, borderWidth: 1, borderColor: colors.border },
    slotChipTextSelected: { fontSize: 14, fontWeight: '600', color: '#fff' },
    slotChipTextInactive: { fontSize: 14, fontWeight: '600', color: colors.text },
    reasonInput: { backgroundColor: colors.background, borderRadius: 12, padding: 12, fontSize: 14, color: colors.text, borderWidth: 1, borderColor: colors.surfaceSecondary, minHeight: 60, textAlignVertical: 'top', marginBottom: 16 },
    approveButton: { backgroundColor: '#16A34A', borderRadius: 12, paddingVertical: 14, alignItems: 'center', marginBottom: 10 },
    approveButtonText: { color: '#fff', fontSize: 16, fontWeight: '700' },
    denyButton: { backgroundColor: '#FEE2E2', borderRadius: 12, paddingVertical: 14, alignItems: 'center' },
    denyButtonText: { color: '#DC2626', fontSize: 16, fontWeight: '700' },
    pendingTag: { backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 6 },
    pendingTagText: { fontSize: 10, fontWeight: '700', color: '#92400E' },
  });
    const router = useRouter();
    const { bookingId } = useLocalSearchParams();
    const { fetchBookingDetails, cancelBooking, rescheduleBooking, requestReschedule, respondToReschedule, submitFeedback, createBookingPaymentLink, confirmBookingPaymentLink, isLoading } = useCounselingStore();

    const [booking, setBooking] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [paying, setPaying] = useState(false);
    const [rescheduleError, setRescheduleError] = useState<string | null>(null);
    const [showFeedback, setShowFeedback] = useState(false);
    const [feedbackRating, setFeedbackRating] = useState(0);
    const [feedbackComment, setFeedbackComment] = useState('');
    const [showRescheduleModal, setShowRescheduleModal] = useState(false);
    const [rescheduleDate, setRescheduleDate] = useState<string | null>(null);
    const [rescheduleTime, setRescheduleTime] = useState<string | null>(null);
    const [rescheduleSlots, setRescheduleSlots] = useState<string[]>([]);
    const [rescheduleReason, setRescheduleReason] = useState('');
    const [fetchingSlots, setFetchingSlots] = useState(false);
    const today = (() => {
        const now = new Date();
        const pad = (value: number) => String(value).padStart(2, '0');
        return `${now.getFullYear()}-${pad(now.getMonth() + 1)}-${pad(now.getDate())}`;
    })();

    const refreshBooking = async () => {
        if (!bookingId) return;
        const data = await fetchBookingDetails(bookingId as string);
        setBooking(data);
    };

    useEffect(() => {
        if (!bookingId) {
            setLoading(false);
            setBooking(null);
            return;
        }
        (async () => {
            setLoading(true);
            const data = await fetchBookingDetails(bookingId as string);
            setBooking(data);
            setLoading(false);
        })();
    }, [bookingId, fetchBookingDetails]);

    useEffect(() => {
        if (!bookingId || !booking) return;
        if (booking.status === 'confirmed' && !booking.meetingLink) {
            const interval = setInterval(async () => {
                const updated = await fetchBookingDetails(bookingId as string);
                if (updated?.meetingLink && updated.meetingLink !== booking.meetingLink) {
                    setBooking(updated);
                }
            }, 30000);
            return () => clearInterval(interval);
        }
    }, [bookingId, booking, fetchBookingDetails]);

    useEffect(() => {
        if (!rescheduleDate || !booking?.counselorType) return;
        (async () => {
            setFetchingSlots(true);
            setRescheduleError(null);
            try {
                const { checkAvailability } = useCounselingStore.getState();
                const slots = await checkAvailability(rescheduleDate, booking.counselorType);
                setRescheduleSlots(slots);
            } catch (error: any) {
                setRescheduleSlots([]);
                setRescheduleError(error?.message || 'Failed to load slots');
            } finally {
                setFetchingSlots(false);
            }
        })();
    }, [rescheduleDate, booking?.counselorType]);

    const openMeeting = () => {
        if (!booking?.meetingLink) return;
        Linking.openURL(booking.meetingLink).catch(() =>
            Alert.alert('Error', 'Could not open the meeting link.')
        );
    };

    const canCancelOrReschedule = () => {
        if (!booking) return false;
        if (['cancelled', 'completed', 'no_show'].includes(booking.status)) return false;
        if (booking.rescheduleRequest?.status === 'pending') return false;
        return true;
    };

    const canReschedule = () => canCancelOrReschedule() && booking?.status !== 'waitlisted';

    const getJoinState = () => {
        if (!booking) return { open: false, message: '' };
        if (!['confirmed', 'completed'].includes(booking.status)) {
            return { open: false, message: 'The meeting link becomes available once your booking is confirmed.' };
        }
        const date = dateOnlyToLocal(booking.bookingDate);
        if (!date) return { open: false, message: '' };
        const [hours, minutes] = String(booking.bookingTime || '00:00').split(':').map(Number);
        const start = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hours || 0, minutes || 0);
        const end = new Date(start.getTime() + (Number(booking.duration) || 60) * 60 * 1000);
        const now = new Date();
        if (now < new Date(start.getTime() - 15 * 60 * 1000)) {
            return { open: false, message: 'The meeting link opens 15 minutes before the session starts.' };
        }
        if (now > new Date(end.getTime() + 30 * 60 * 1000)) {
            return { open: false, message: 'This session has ended.' };
        }
        return { open: true, message: '' };
    };

    const handleRetryPayment = async () => {
        if (!booking || paying) return;
        setPaying(true);
        try {
            const linkResult = await createBookingPaymentLink(booking._id);
            if (!linkResult.success || !linkResult.url || !linkResult.paymentLinkId) {
                Alert.alert('Payment Error', linkResult.message || 'Could not start payment.');
                return;
            }
            await savePendingPaymentLink({
                type: 'counseling',
                id: booking._id,
                paymentLinkId: linkResult.paymentLinkId,
                url: linkResult.url,
                expiresAt: linkResult.expiresAt,
            });

            const openResult = await openPaymentLink({
                url: linkResult.url,
                confirm: () => confirmBookingPaymentLink(linkResult.paymentLinkId!, booking._id),
            });

            if (openResult.success) {
                await clearPendingPaymentLinks('counseling', booking._id, linkResult.paymentLinkId);
                await refreshBooking();
                Alert.alert('Payment Confirmed', 'Your session is confirmed.');
            } else {
                Alert.alert(
                    'Payment Pending',
                    openResult.result?.message || 'We have not received the payment yet. If you paid, your booking will confirm shortly.'
                );
            }
        } finally {
            setPaying(false);
        }
    };

    const handleCancel = () => {
        const isConfirmed = booking.status === 'confirmed';
        Alert.alert(
            'Cancel Booking',
            isConfirmed
                ? 'Cancellations are free up to 24 hours before the session. Later cancellations are not refundable. Cancel this booking?'
                : 'Cancel this booking?',
            [
                { text: 'No, Keep It', style: 'cancel' },
                {
                    text: 'Yes, Cancel',
                    style: 'destructive',
                    onPress: async () => {
                        const result = await cancelBooking(booking._id || bookingId as string, 'User requested cancellation');
                        if (result.success) {
                            const refundNote = result.refundStatus === 'processed'
                                ? ' Your refund has been processed.'
                                : result.refundStatus === 'failed'
                                    ? ' The refund could not be processed automatically; support will follow up.'
                                    : '';
                            Alert.alert('Cancelled', `Your booking has been cancelled.${refundNote}`, [
                                { text: 'OK', onPress: () => router.back() }
                            ]);
                        } else {
                            Alert.alert('Error', result.message || 'Failed to cancel booking');
                        }
                    }
                }
            ]
        );
    };

    const handleReschedule = () => setShowRescheduleModal(true);

    const handleSubmitReschedule = async () => {
        if (!rescheduleDate || !rescheduleTime) {
            Alert.alert('Required', 'Please select a date and time');
            return;
        }
        const result = await requestReschedule(booking._id || bookingId as string, rescheduleDate, rescheduleTime, rescheduleReason);
        if (result.success) {
            setShowRescheduleModal(false);
            setRescheduleDate(null);
            setRescheduleTime(null);
            setRescheduleReason('');
            await refreshBooking();
            Alert.alert('Request Sent', result.message);
        } else {
            Alert.alert('Error', result.message || 'Failed to submit reschedule request');
        }
    };

    const handleApproveReschedule = async () => {
        Alert.alert('Approve Reschedule', 'Accept the new time slot?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Approve',
                onPress: async () => {
                    const result = await respondToReschedule(booking._id || bookingId as string, 'approve');
                    if (result.success) {
                        await refreshBooking();
                        Alert.alert('Approved', 'Your session has been rescheduled.');
                    } else {
                        Alert.alert('Error', result.message);
                    }
                }
            }
        ]);
    };

    const handleDenyReschedule = async () => {
        Alert.alert('Decline Reschedule', 'Keep your original booking time?', [
            { text: 'Cancel', style: 'cancel' },
            {
                text: 'Decline',
                style: 'destructive',
                onPress: async () => {
                    const result = await respondToReschedule(booking._id || bookingId as string, 'deny');
                    if (result.success) {
                        await refreshBooking();
                    } else {
                        Alert.alert('Error', result.message);
                    }
                }
            }
        ]);
    };

    const handleSubmitFeedback = async () => {
        if (feedbackRating === 0) {
            Alert.alert('Rating Required', 'Please select a rating before submitting.');
            return;
        }
        const result = await submitFeedback(booking._id || bookingId as string, {
            rating: feedbackRating,
            comment: feedbackComment
        });
        if (result.success) {
            Alert.alert('Thank You!', 'Your feedback has been submitted.');
            setShowFeedback(false);
            setFeedbackRating(0);
            setFeedbackComment('');
        } else {
            Alert.alert('Error', result.message || 'Failed to submit feedback');
        }
    };

    const platformLabel = (p?: string) => {
        switch (p) {
            case 'zoom': return 'Zoom';
            case 'google_meet': return 'Google Meet';
            case 'phone': return 'Phone Call';
            case 'in_person': return 'In Person';
            default: return 'Video Call';
        }
    };

    const statusBadgeStyle = () => {
        if (booking?.status === 'confirmed' || booking?.status === 'completed') return { backgroundColor: '#DCFCE7' };
        if (booking?.status === 'pending' || booking?.status === 'waitlisted') return { backgroundColor: '#FEF3C7' };
        if (booking?.status === 'cancelled' || booking?.status === 'no_show') return { backgroundColor: '#FEE2E2' };
        return { backgroundColor: colors.surfaceSecondary };
    };

    const statusTextStyle = () => {
        if (booking?.status === 'cancelled' || booking?.status === 'no_show') return { color: '#B91C1C' };
        if (booking?.status === 'pending' || booking?.status === 'waitlisted') return { color: '#92400E' };
        if (booking?.status === 'confirmed' || booking?.status === 'completed') return { color: '#166534' };
        return { color: colors.text };
    };

    const joinState = getJoinState();

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => { if (router.canGoBack()) router.back(); }}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Session Details</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.center}>
                    <ActivityIndicator size="large" color="#F1842D" />
                </View>
            </SafeAreaView>
        );
    }

    if (!booking) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => { if (router.canGoBack()) router.back(); }}>
                        <Ionicons name="arrow-back" size={24} color={colors.text} />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Session Details</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.center}>
                    <Ionicons name="calendar-outline" size={64} color={colors.textSecondary} />
                    <Text style={styles.emptyText}>Booking not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => { if (router.canGoBack()) router.back(); }}>
                    <Ionicons name="arrow-back" size={24} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Session Details</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Session summary */}
                <View style={styles.card}>
                    <View style={styles.statusRow}>
                        <Text style={styles.sessionTitle}>{booking.bookingTitle || 'Counseling Session'}</Text>
                        <View style={[styles.statusBadge, statusBadgeStyle()]}>
                            <Text style={[styles.statusText, statusTextStyle()]}>{String(booking.status || 'pending').toUpperCase()}</Text>
                        </View>
                    </View>
                    <Text style={styles.counselorText}>with {booking.counselorName || 'Expert Counselor'}</Text>

                    <View style={styles.infoRow}>
                        <Ionicons name="calendar-outline" size={16} color={colors.textSecondary} />
                        <Text style={styles.infoText}>
                            {formatBookingDate(booking.bookingDate)}
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="time-outline" size={16} color={colors.textSecondary} />
                        <Text style={styles.infoText}>
                            {formatTime12h(booking.bookingTime)}
                            {booking.duration ? ` · ${booking.duration} min` : ''}
                        </Text>
                    </View>
                    {booking.amount > 0 && (
                        <View style={styles.infoRow}>
                            <Ionicons name="wallet-outline" size={16} color={colors.textSecondary} />
                            <Text style={styles.infoText}>₹{booking.amount} · {booking.paymentStatus || 'paid'}</Text>
                        </View>
                    )}
                </View>

                {booking.status === 'waitlisted' && (
                    <View style={styles.pendingBanner}>
                        <Text style={styles.pendingBannerTitle}>You&apos;re on the waitlist</Text>
                        <Text style={styles.pendingBannerText}>
                            Position #{booking.waitlistRank || 1}. We&apos;ll notify you as soon as a spot opens up.
                        </Text>
                    </View>
                )}

                {booking.status === 'pending' && !booking.isFree && (
                    <View style={styles.pendingBanner}>
                        <Text style={styles.pendingBannerTitle}>Payment pending</Text>
                        <Text style={styles.pendingBannerText}>
                            Your slot is held until payment is completed. Complete payment to confirm your session.
                        </Text>
                        <TouchableOpacity
                            style={[styles.feedbackButton, { marginTop: 8, opacity: paying ? 0.7 : 1 }]}
                            onPress={handleRetryPayment}
                            disabled={paying}
                        >
                            {paying ? <ActivityIndicator size="small" color={colors.surface} /> : <Ionicons name="card-outline" size={18} color={colors.surface} />}
                            <Text style={styles.feedbackButtonText}>{paying ? 'Opening payment...' : 'Complete Payment'}</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* Meeting / Join section */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Join Your Session</Text>

                    {!joinState.open ? (
                        <View style={styles.waitingCard}>
                            <Ionicons name="time-outline" size={32} color="#F59E0B" />
                            <Text style={styles.waitingTitle}>
                                {booking.status === 'cancelled' ? 'Session cancelled' : 'Meeting not available yet'}
                            </Text>
                            <Text style={styles.waitingText}>
                                {booking.status === 'cancelled'
                                    ? 'This booking was cancelled, so the meeting link is no longer available.'
                                    : joinState.message || 'Your counselor will add the video call link before your session.'}
                            </Text>
                        </View>
                    ) : booking.meetingLink ? (
                        <>
                            <View style={styles.platformRow}>
                                <Ionicons name="videocam" size={18} color="#F1842D" />
                                <Text style={styles.platformText}>{platformLabel(booking.meetingPlatform)}</Text>
                            </View>

                            <TouchableOpacity style={styles.detailRow} onPress={openMeeting}>
                                <Text style={styles.detailLabel}>Meeting Link</Text>
                                <Text style={[styles.detailValue, styles.linkValue]} numberOfLines={1}>{booking.meetingLink}</Text>
                            </TouchableOpacity>

                            {booking.meetingId ? (
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Meeting ID</Text>
                                    <Text style={styles.detailValue}>{booking.meetingId}</Text>
                                </View>
                            ) : null}

                            {booking.meetingPassword ? (
                                <View style={styles.detailRow}>
                                    <Text style={styles.detailLabel}>Passcode</Text>
                                    <Text style={styles.detailValue}>{booking.meetingPassword}</Text>
                                </View>
                            ) : null}

                            <TouchableOpacity style={styles.joinButton} onPress={openMeeting}>
                                <Ionicons name="videocam" size={20} color={colors.surface} />
                                <Text style={styles.joinButtonText}>Join Meeting</Text>
                            </TouchableOpacity>

                            <Text style={styles.hint}>Tap to open in Zoom / Google Meet</Text>
                        </>
                    ) : (
                        <View style={styles.waitingCard}>
                            <Ionicons name="time-outline" size={32} color="#F59E0B" />
                            <Text style={styles.waitingTitle}>Meeting link not added yet</Text>
                            <Text style={styles.waitingText}>
                                Your counselor will add the video call link before your session. You&apos;ll be notified when it&apos;s ready.
                            </Text>
                        </View>
                    )}
                </View>

                {booking.userNotes ? (
                    <View style={styles.card}>
                        <Text style={styles.sectionTitle}>Your Notes</Text>
                        <Text style={styles.notesText}>{booking.userNotes}</Text>
                    </View>
                ) : null}

                {/* Feedback Section */}
                {booking.status === 'completed' && !booking.feedbackSubmittedAt ? (
                    <View style={styles.feedbackCard}>
                        <Text style={styles.sectionTitle}>How was your session?</Text>
                        {!showFeedback ? (
                            <TouchableOpacity style={styles.feedbackButton} onPress={() => setShowFeedback(true)}>
                                <Ionicons name="star-outline" size={20} color={colors.surface} />
                                <Text style={styles.feedbackButtonText}>Share Feedback</Text>
                            </TouchableOpacity>
                        ) : (
                            <>
                                <View style={styles.ratingRow}>
                                    {[1, 2, 3, 4, 5].map((star) => (
                                        <TouchableOpacity
                                            key={star}
                                            style={styles.starButton}
                                            onPress={() => setFeedbackRating(star)}
                                        >
                                            <Ionicons
                                                name={star <= feedbackRating ? 'star' : 'star-outline'}
                                                size={32}
                                                color={star <= feedbackRating ? '#F59E0B' : colors.textSecondary}
                                            />
                                        </TouchableOpacity>
                                    ))}
                                </View>
                                <Text style={[styles.infoText, { marginBottom: 8, textAlign: 'center' }]}>
                                    Tap to rate
                                </Text>
                                <View style={styles.feedbackInputContainer}>
                                    <TextInput
                                        style={styles.feedbackInput}
                                        placeholder="Share your experience (optional)"
                                        placeholderTextColor={colors.textSecondary}
                                        value={feedbackComment}
                                        onChangeText={setFeedbackComment}
                                        multiline
                                    />
                                </View>
                                <View style={styles.actionRow}>
                                    <TouchableOpacity
                                        style={[styles.cancelButton, { flex: 1 }]}
                                        onPress={() => {
                                            setShowFeedback(false);
                                            setFeedbackRating(0);
                                            setFeedbackComment('');
                                        }}
                                    >
                                        <Text style={styles.cancelButtonText}>Skip</Text>
                                    </TouchableOpacity>
                                    <TouchableOpacity
                                        style={[styles.rescheduleButton, { flex: 1 }]}
                                        onPress={handleSubmitFeedback}
                                        disabled={isLoading}
                                    >
                                        <Text style={styles.rescheduleButtonText}>Submit</Text>
                                    </TouchableOpacity>
                                </View>
                            </>
                        )}
                    </View>
                ) : null}

                {/* Action Buttons */}
                {canCancelOrReschedule() && (
                    <View style={styles.actionRow}>
                        <TouchableOpacity style={styles.cancelButton} onPress={handleCancel} disabled={isLoading}>
                            <Ionicons name="close-circle-outline" size={18} color="#DC2626" />
                            <Text style={styles.cancelButtonText}>Cancel</Text>
                        </TouchableOpacity>
                        {canReschedule() && (
                            <TouchableOpacity style={styles.rescheduleButton} onPress={handleReschedule} disabled={isLoading}>
                                <Ionicons name="calendar-outline" size={18} color="#D97706" />
                                <Text style={styles.rescheduleButtonText}>Request Reschedule</Text>
                            </TouchableOpacity>
                        )}
                    </View>
                )}

                {/* Pending Reschedule Request — Admin initiated, needs user approval */}
                {booking.rescheduleRequest?.status === 'pending' && booking.rescheduleRequest?.requestedBy === 'admin' && (
                    <View style={[styles.pendingBanner, styles.pendingBannerAdmin]}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 6 }}>
                            <Ionicons name="calendar" size={18} color="#7C3AED" />
                            <Text style={[styles.pendingBannerTitle, styles.pendingBannerAdminTitle]}>Admin proposes new time</Text>
                        </View>
                        <Text style={[styles.pendingBannerText, styles.pendingBannerAdminText]}>
                            New: {formatBookingDate(booking.rescheduleRequest.requestedNewDate, { weekday: 'short', day: 'numeric', month: 'short' })} at {formatTime12h(booking.rescheduleRequest.requestedNewTime)}
                            {booking.rescheduleRequest.reason ? `\nReason: ${booking.rescheduleRequest.reason}` : ''}
                        </Text>
                        <View style={styles.actionRow}>
                            <TouchableOpacity style={styles.denyButton} onPress={handleDenyReschedule}>
                                <Text style={styles.denyButtonText}>Keep Original</Text>
                            </TouchableOpacity>
                            <TouchableOpacity style={styles.approveButton} onPress={handleApproveReschedule}>
                                <Text style={styles.approveButtonText}>Accept New Time</Text>
                            </TouchableOpacity>
                        </View>
                    </View>
                )}

                {/* Pending Reschedule Request — User initiated, awaiting admin */}
                {booking.rescheduleRequest?.status === 'pending' && booking.rescheduleRequest?.requestedBy === 'user' && (
                    <View style={styles.pendingBanner}>
                        <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 4 }}>
                            <Ionicons name="time-outline" size={18} color="#92400E" />
                            <Text style={styles.pendingBannerTitle}>Reschedule Pending</Text>
                            <View style={styles.pendingTag}><Text style={styles.pendingTagText}>Awaiting Admin</Text></View>
                        </View>
                        <Text style={styles.pendingBannerText}>
                            Requested: {formatBookingDate(booking.rescheduleRequest.requestedNewDate, { weekday: 'short', day: 'numeric', month: 'short' })} at {formatTime12h(booking.rescheduleRequest.requestedNewTime)}
                        </Text>
                    </View>
                )}
            </ScrollView>

            {/* Reschedule Request Modal */}
            <Modal visible={showRescheduleModal} transparent animationType="slide" onRequestClose={() => setShowRescheduleModal(false)}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContent}>
                        <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 }}>
                            <Text style={styles.modalTitle}>Request Reschedule</Text>
                            <TouchableOpacity onPress={() => setShowRescheduleModal(false)}>
                                <Ionicons name="close-circle" size={28} color={colors.textSecondary} />
                            </TouchableOpacity>
                        </View>
                        <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 }}>Select New Date</Text>
                        <View style={styles.calendarContainer}>
                            <Calendar
                                current={today}
                                minDate={today}
                                onDayPress={(day: any) => { setRescheduleDate(day.dateString); setRescheduleTime(null); }}
                                markedDates={rescheduleDate ? { [rescheduleDate]: { selected: true, selectedColor: '#F1842D' } } : {}}
                                theme={{
                                    calendarBackground: colors.surface,
                                    textSectionTitleColor: colors.textSecondary,
                                    selectedDayBackgroundColor: '#F1842D',
                                    selectedDayTextColor: '#ffffff',
                                    todayTextColor: '#F1842D',
                                    dayTextColor: colors.text,
                                    textDisabledColor: colors.border,
                                    arrowColor: '#F1842D',
                                    monthTextColor: colors.text,
                                }}
                            />
                        </View>
                        {rescheduleDate && (
                            <>
                                <Text style={{ fontSize: 14, fontWeight: '600', color: colors.text, marginBottom: 8 }}>Select New Time</Text>
                                {fetchingSlots ? (
                                    <ActivityIndicator size="small" color="#F1842D" style={{ marginVertical: 12 }} />
                                ) : rescheduleError ? (
                                    <Text style={{ fontSize: 13, color: '#B91C1C', marginBottom: 12 }}>{rescheduleError}</Text>
                                ) : rescheduleSlots.length === 0 ? (
                                    <Text style={{ fontSize: 13, color: colors.textSecondary, marginBottom: 12 }}>No slots available on this date. Try another day.</Text>
                                ) : (
                                    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginBottom: 12 }}>
                                        {rescheduleSlots.map((time) => (
                                            <TouchableOpacity key={time} style={rescheduleTime === time ? styles.slotChipSelected : styles.slotChipInactive} onPress={() => setRescheduleTime(time)}>
                                                <Text style={rescheduleTime === time ? styles.slotChipTextSelected : styles.slotChipTextInactive}>{formatTime12h(time)}</Text>
                                            </TouchableOpacity>
                                        ))}
                                    </View>
                                )}
                            </>
                        )}
                        <TextInput
                            style={styles.reasonInput}
                            placeholder="Reason (optional)"
                            placeholderTextColor={colors.textSecondary}
                            value={rescheduleReason}
                            onChangeText={setRescheduleReason}
                            multiline
                        />
                        <TouchableOpacity
                            style={[styles.rescheduleButton, { marginTop: 0 }]}
                            onPress={handleSubmitReschedule}
                            disabled={!rescheduleDate || !rescheduleTime || isLoading}
                        >
                            <Text style={styles.rescheduleButtonText}>{isLoading ? 'Submitting...' : 'Submit Request'}</Text>
                        </TouchableOpacity>
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}


