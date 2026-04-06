import React, { useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useOrderStore } from '../store/orderStore';

export default function OrderDetailScreen() {
    const { orderId } = useLocalSearchParams();
    const router = useRouter();
    const { currentOrder, fetchOrderDetails, isLoading } = useOrderStore();

    useEffect(() => {
        if (orderId) {
            fetchOrderDetails(orderId as string);
        }
    }, [orderId, fetchOrderDetails]);

    if (isLoading || !currentOrder) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#EAB308" />
            </View>
        );
    }

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Order Details</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Order Summary */}
                <View style={styles.section}>
                    <Text style={styles.orderNumber}>Order #{currentOrder.orderNumber}</Text>
                    <Text style={styles.orderDate}>Placed on {new Date(currentOrder.createdAt).toLocaleDateString()}</Text>
                    <View style={[styles.statusBadge, { alignSelf: 'flex-start', marginTop: 8 }]}>
                        <Text style={styles.statusText}>{currentOrder.status.toUpperCase()}</Text>
                    </View>
                </View>

                {/* Items */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Items</Text>
                    <View style={styles.card}>
                        {currentOrder.items.map((item, index) => (
                            <View key={index} style={styles.itemRow}>
                                <View style={styles.itemImageContainer}>
                                    <Text style={{ fontSize: 24 }}>📦</Text>
                                    {/* Ideally load image from item.product.images[0] if available */}
                                </View>
                                <View style={styles.itemDetails}>
                                    <Text style={styles.itemName}>{item.product?.name || 'Unknown Item'}</Text>
                                    <Text style={styles.itemQty}>Qty: {item.quantity}</Text>
                                    <Text style={styles.itemPrice}>₹{item.price}</Text>
                                </View>
                            </View>
                        ))}
                    </View>
                </View>

                {/* Shipping */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Shipping Details</Text>
                    <View style={styles.card}>
                        <Text style={styles.addressText}>{currentOrder.shippingAddress?.street}</Text>
                        <Text style={styles.addressText}>{currentOrder.shippingAddress?.city}, {currentOrder.shippingAddress?.state}</Text>
                        <Text style={styles.addressText}>{currentOrder.shippingAddress?.country} - {currentOrder.shippingAddress?.zipCode}</Text>
                        <Text style={styles.addressText}>Phone: {currentOrder.shippingAddress?.phone}</Text>
                    </View>
                </View>

                {/* Payment */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Payment Summary</Text>
                    <View style={styles.card}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Subtotal</Text>
                            <Text style={styles.summaryValue}>₹{currentOrder.totalAmount}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Shipping</Text>
                            <Text style={styles.summaryValue}>₹0</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.summaryRow}>
                            <Text style={styles.totalLabel}>Total Paid</Text>
                            <Text style={styles.totalValue}>₹{currentOrder.totalAmount}</Text>
                        </View>
                    </View>
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
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
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
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
    },
    scrollContent: {
        padding: 16,
    },
    section: {
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#374151',
        marginBottom: 8,
    },
    orderNumber: {
        fontSize: 20,
        fontWeight: '700',
        color: '#111827',
    },
    orderDate: {
        fontSize: 14,
        color: '#6B7280',
        marginTop: 4,
    },
    statusBadge: {
        backgroundColor: '#10B981',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    statusText: {
        color: '#FFFFFF',
        fontSize: 12,
        fontWeight: '700',
    },
    card: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    itemRow: {
        flexDirection: 'row',
        marginBottom: 16,
        alignItems: 'center',
    },
    itemImageContainer: {
        width: 60,
        height: 60,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    itemDetails: {
        flex: 1,
    },
    itemName: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    itemQty: {
        fontSize: 13,
        color: '#6B7280',
        marginTop: 2,
    },
    itemPrice: {
        fontSize: 14,
        fontWeight: '700',
        color: '#111827',
        marginTop: 4,
    },
    addressText: {
        fontSize: 14,
        color: '#4B5563',
        marginBottom: 6,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    summaryLabel: {
        fontSize: 14,
        color: '#6B7280',
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    divider: {
        height: 1,
        backgroundColor: '#E5E7EB',
        marginVertical: 12,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#EAB308',
    },
});
