import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';
import { useOrderStore } from '../store/orderStore';
import { useTheme } from '../hooks/useTheme';

export default function OrderDetailScreen() {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: 'colors.background',
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
        backgroundColor: 'colors.surface',
        borderBottomWidth: 1,
        borderBottomColor: 'colors.border',
    },
    backButton: {
        padding: 8,
    },
    headerTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: 'colors.text',
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
        color: 'colors.text',
        marginBottom: 8,
    },
    orderNumber: {
        fontSize: 20,
        fontWeight: '700',
        color: 'colors.text',
    },
    orderDate: {
        fontSize: 14,
        color: 'colors.textSecondary',
        marginTop: 4,
    },
    statusBadge: {
        backgroundColor: '#10B981',
        paddingHorizontal: 8,
        paddingVertical: 4,
        borderRadius: 4,
    },
    statusText: {
        color: 'colors.surface',
        fontSize: 12,
        fontWeight: '700',
    },
    cancelButton: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        backgroundColor: 'colors.surface',
        borderWidth: 1,
        borderColor: '#FECACA',
        borderRadius: 12,
        paddingVertical: 16,
        marginTop: 8,
    },
    cancelButtonText: {
        color: '#EF4444',
        fontSize: 16,
        fontWeight: '700',
    },
    card: {
        backgroundColor: 'colors.surface',
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
        backgroundColor: 'colors.surfaceSecondary',
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
        color: 'colors.text',
    },
    itemQty: {
        fontSize: 13,
        color: 'colors.textSecondary',
        marginTop: 2,
    },
    itemPrice: {
        fontSize: 14,
        fontWeight: '700',
        color: 'colors.text',
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
        color: 'colors.textSecondary',
    },
    summaryValue: {
        fontSize: 14,
        fontWeight: '600',
        color: 'colors.text',
    },
    divider: {
        height: 1,
        backgroundColor: 'colors.border',
        marginVertical: 12,
    },
    totalLabel: {
        fontSize: 16,
        fontWeight: '700',
        color: 'colors.text',
    },
    totalValue: {
        fontSize: 18,
        fontWeight: '700',
        color: '#EAB308',
    },
});
    const { orderId } = useLocalSearchParams();
    const router = useRouter();
    const { currentOrder, fetchOrderDetails, cancelOrder, isLoading } = useOrderStore();
    const [isCancelling, setIsCancelling] = useState(false);

    useEffect(() => {
        if (orderId) {
            fetchOrderDetails(orderId as string);
        }
    }, [orderId, fetchOrderDetails]);

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed': return '#10B981';
            case 'processing': return '#3B82F6';
            case 'shipped': return '#6366F1';
            case 'delivered': return '#10B981';
            case 'cancelled': return '#EF4444';
            case 'returned': return '#F59E0B';
            default: return '#F59E0B'; // pending
        }
    };

    const handleCancelOrder = () => {
        Alert.alert(
            'Cancel Order',
            'Are you sure you want to cancel this order?',
            [
                { text: 'Keep Order', style: 'cancel' },
                {
                    text: 'Cancel Order',
                    style: 'destructive',
                    onPress: async () => {
                        setIsCancelling(true);
                        const result = await cancelOrder(orderId as string);
                        setIsCancelling(false);
                        if (result.success) {
                            Alert.alert('Order Cancelled', result.message || 'Your order has been cancelled.');
                            fetchOrderDetails(orderId as string);
                        } else {
                            Alert.alert('Error', result.message || 'Could not cancel order.');
                        }
                    }
                }
            ]
        );
    };

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
                <TouchableOpacity style={styles.backButton} onPress={() => { if (router.canGoBack()) router.back(); }}>
                    <Ionicons name="arrow-back" size={24} color="colors.text" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Order Details</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Order Summary */}
                <View style={styles.section}>
                    <Text style={styles.orderNumber}>Order #{currentOrder.orderNumber}</Text>
                    <Text style={styles.orderDate}>Placed on {new Date(currentOrder.createdAt).toLocaleDateString()}</Text>
                    <View style={[styles.statusBadge, { alignSelf: 'flex-start', marginTop: 8, backgroundColor: getStatusColor(currentOrder.status) }]}>
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
                        <Text style={styles.addressText}>{currentOrder.deliveryAddress?.fullName}</Text>
                        <Text style={styles.addressText}>{currentOrder.deliveryAddress?.addressLine1}{currentOrder.deliveryAddress?.addressLine2 ? `, ${currentOrder.deliveryAddress?.addressLine2}` : ''}</Text>
                        <Text style={styles.addressText}>{currentOrder.deliveryAddress?.city}, {currentOrder.deliveryAddress?.state} - {currentOrder.deliveryAddress?.pincode}</Text>
                        <Text style={styles.addressText}>{currentOrder.deliveryAddress?.country}</Text>
                        <Text style={styles.addressText}>Phone: {currentOrder.deliveryAddress?.phone}</Text>
                    </View>
                </View>

                {/* Payment */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Payment Summary</Text>
                    <View style={styles.card}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Subtotal</Text>
                            <Text style={styles.summaryValue}>₹{currentOrder.pricing?.subtotal ?? 0}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Shipping</Text>
                            <Text style={styles.summaryValue}>₹{currentOrder.pricing?.shippingCharge ?? 0}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Discount</Text>
                            <Text style={styles.summaryValue}>-₹{currentOrder.pricing?.discount ?? 0}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.summaryRow}>
                            <Text style={styles.totalLabel}>Total Paid</Text>
                            <Text style={styles.totalValue}>₹{currentOrder.pricing?.total ?? currentOrder.totalAmount}</Text>
                        </View>
                    </View>
                </View>

                {/* Cancel Order (only for pending / confirmed orders) */}
                {['pending', 'confirmed'].includes(currentOrder.status) && (
                    <TouchableOpacity
                        style={styles.cancelButton}
                        onPress={handleCancelOrder}
                        disabled={isCancelling}
                    >
                        {isCancelling ? (
                            <ActivityIndicator size="small" color="#EF4444" />
                        ) : (
                            <>
                                <Ionicons name="close-circle-outline" size={20} color="#EF4444" />
                                <Text style={styles.cancelButtonText}>Cancel Order</Text>
                            </>
                        )}
                    </TouchableOpacity>
                )}
            </ScrollView>
        </View>
    );
}


