import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Linking, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useCounselingStore } from '../store/counselingStore';

export default function CounselingDetailScreen() {
    const router = useRouter();
    const { bookingId } = useLocalSearchParams();
    const { fetchBookingDetails } = useCounselingStore();

    const [booking, setBooking] = useState<any>(null);
    const [loading, setLoading] = useState(true);

    useEffect(() => {
        if (!bookingId) return;
        (async () => {
            setLoading(true);
            const data = await fetchBookingDetails(bookingId as string);
            setBooking(data);
            setLoading(false);
        })();
    }, [bookingId, fetchBookingDetails]);

    const openMeeting = () => {
        if (!booking?.meetingLink) return;
        Linking.openURL(booking.meetingLink).catch(() =>
            Alert.alert('Error', 'Could not open the meeting link.')
        );
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

    if (loading) {
        return (
            <SafeAreaView style={styles.container}>
                <View style={styles.header}>
                    <TouchableOpacity style={styles.backButton} onPress={() => { if (router.canGoBack()) router.back(); }}>
                        <Ionicons name="arrow-back" size={24} color="#111827" />
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
                        <Ionicons name="arrow-back" size={24} color="#111827" />
                    </TouchableOpacity>
                    <Text style={styles.headerTitle}>Session Details</Text>
                    <View style={{ width: 40 }} />
                </View>
                <View style={styles.center}>
                    <Ionicons name="calendar-outline" size={64} color="#9CA3AF" />
                    <Text style={styles.emptyText}>Booking not found</Text>
                </View>
            </SafeAreaView>
        );
    }

    return (
        <SafeAreaView style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => { if (router.canGoBack()) router.back(); }}>
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Session Details</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Session summary */}
                <View style={styles.card}>
                    <View style={styles.statusRow}>
                        <Text style={styles.sessionTitle}>{booking.bookingTitle || 'Counseling Session'}</Text>
                        <View style={[styles.statusBadge, booking.status === 'confirmed' ? styles.statusConfirmed : styles.statusPending]}>
                            <Text style={styles.statusText}>{String(booking.status || 'pending').toUpperCase()}</Text>
                        </View>
                    </View>
                    <Text style={styles.counselorText}>with {booking.counselorName || 'Expert Counselor'}</Text>

                    <View style={styles.infoRow}>
                        <Ionicons name="calendar-outline" size={16} color="#6B7280" />
                        <Text style={styles.infoText}>
                            {new Date(booking.bookingDate).toLocaleDateString('en-IN', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
                        </Text>
                    </View>
                    <View style={styles.infoRow}>
                        <Ionicons name="time-outline" size={16} color="#6B7280" />
                        <Text style={styles.infoText}>{booking.bookingTime}{booking.duration ? ` · ${booking.duration} mins` : ''}</Text>
                    </View>
                    {booking.amount > 0 && (
                        <View style={styles.infoRow}>
                            <Ionicons name="wallet-outline" size={16} color="#6B7280" />
                            <Text style={styles.infoText}>₹{booking.amount} · {booking.paymentStatus || 'paid'}</Text>
                        </View>
                    )}
                </View>

                {/* Meeting / Join section */}
                <View style={styles.card}>
                    <Text style={styles.sectionTitle}>Join Your Session</Text>

                    {booking.meetingLink ? (
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
                                <Ionicons name="videocam" size={20} color="#FFFFFF" />
                                <Text style={styles.joinButtonText}>Join Meeting</Text>
                            </TouchableOpacity>

                            <Text style={styles.hint}>Tap to open in Zoom / Google Meet</Text>
                        </>
                    ) : (
                        <View style={styles.waitingCard}>
                            <Ionicons name="time-outline" size={32} color="#F59E0B" />
                            <Text style={styles.waitingTitle}>Meeting link not added yet</Text>
                            <Text style={styles.waitingText}>
                                Your counselor will add the video call link before your session. You'll be notified when it's ready.
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
            </ScrollView>
        </SafeAreaView>
    );
}

const styles = StyleSheet.create({
    container: { flex: 1, backgroundColor: '#FDF8F3' },
    center: { flex: 1, justifyContent: 'center', alignItems: 'center' },
    header: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingHorizontal: 16, paddingVertical: 12, backgroundColor: '#FFFFFF', borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
    backButton: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center', backgroundColor: '#F9FAFB', borderRadius: 20 },
    headerTitle: { fontSize: 18, fontWeight: '700', color: '#111827' },
    scrollContent: { padding: 16, paddingBottom: 40 },
    card: { backgroundColor: '#FFFFFF', borderRadius: 16, padding: 16, marginBottom: 16, borderWidth: 1, borderColor: '#F3F4F6' },
    statusRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 6 },
    sessionTitle: { fontSize: 20, fontWeight: '800', color: '#111827', flex: 1, marginRight: 8 },
    statusBadge: { paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8 },
    statusConfirmed: { backgroundColor: '#DCFCE7' },
    statusPending: { backgroundColor: '#FEF3C7' },
    statusText: { fontSize: 10, fontWeight: '700', color: '#166534' },
    counselorText: { fontSize: 14, color: '#6B7280', marginBottom: 12 },
    infoRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginTop: 8 },
    infoText: { fontSize: 14, color: '#374151' },
    sectionTitle: { fontSize: 16, fontWeight: '700', color: '#111827', marginBottom: 12 },
    platformRow: { flexDirection: 'row', alignItems: 'center', gap: 8, marginBottom: 12 },
    platformText: { fontSize: 16, fontWeight: '700', color: '#111827' },
    detailRow: { flexDirection: 'row', justifyContent: 'space-between', paddingVertical: 8, borderTopWidth: 1, borderTopColor: '#F3F4F6' },
    detailLabel: { fontSize: 14, color: '#6B7280' },
    detailValue: { fontSize: 14, fontWeight: '600', color: '#111827', flexShrink: 1, marginLeft: 12, textAlign: 'right' },
    linkValue: { color: '#2563EB', textDecorationLine: 'underline' },
    joinButton: { flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8, backgroundColor: '#F1842D', borderRadius: 12, paddingVertical: 16, marginTop: 16 },
    joinButtonText: { color: '#FFFFFF', fontSize: 16, fontWeight: '700' },
    hint: { textAlign: 'center', fontSize: 12, color: '#9CA3AF', marginTop: 10 },
    waitingCard: { alignItems: 'center', paddingVertical: 12 },
    waitingTitle: { fontSize: 15, fontWeight: '700', color: '#111827', marginTop: 8 },
    waitingText: { fontSize: 13, color: '#6B7280', textAlign: 'center', marginTop: 4, lineHeight: 19 },
    notesText: { fontSize: 14, color: '#374151', lineHeight: 20 },
    emptyText: { fontSize: 16, color: '#6B7280', marginTop: 12 },
});
