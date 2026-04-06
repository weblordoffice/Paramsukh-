import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Alert } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useCartStore } from '../store/cartStore';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function CartScreen() {
    const router = useRouter();
    const { cart, fetchCart, updateCartItem, removeFromCart, clearCart, isLoading } = useCartStore();
    const [updatingItemId, setUpdatingItemId] = useState<string | null>(null);
    const insets = useSafeAreaInsets();

    useEffect(() => {
        fetchCart();
    }, [fetchCart]);

    const handleUpdateQuantity = async (itemId: string, newQuantity: number) => {
        if (newQuantity < 1) return;
        setUpdatingItemId(itemId);
        await updateCartItem(itemId, newQuantity);
        setUpdatingItemId(null);
    };

    const handleRemove = async (itemId: string) => {
        Alert.alert(
            "Remove Item",
            "Are you sure you want to remove this item?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Remove", style: "destructive", onPress: () => removeFromCart(itemId) }
            ]
        );
    };

    const handleClearCart = () => {
        Alert.alert(
            "Clear Cart",
            "Are you sure you want to clear your cart?",
            [
                { text: "Cancel", style: "cancel" },
                { text: "Clear", style: "destructive", onPress: () => clearCart() }
            ]
        );
    };

    if (isLoading && !cart) {
        return (
            <View style={[styles.container, styles.center]}>
                <ActivityIndicator size="large" color="#EAB308" />
            </View>
        );
    }

    if (!cart || cart.items.length === 0) {
        return (
            <View style={[styles.container, styles.center]}>
                <Ionicons name="cart-outline" size={64} color="#9CA3AF" />
                <Text style={styles.emptyText}>Your cart is empty</Text>
                <TouchableOpacity style={styles.startShoppingButton} onPress={() => router.push('/shops')}>
                    <Text style={styles.startShoppingText}>Start Shopping</Text>
                </TouchableOpacity>
            </View>
        );
    }

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Cart</Text>
                <TouchableOpacity style={styles.clearButton} onPress={handleClearCart}>
                    <Text style={styles.clearText}>Clear</Text>
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {cart.items.map((item) => (
                    <View key={item._id} style={styles.cartItem}>
                        <View style={styles.itemImageContainer}>
                            {(() => {
                                const img = item.product.images?.[0];
                                // Handle both string URL and object with url property
                                const uri = typeof img === 'string' ? img : (img as any)?.url;

                                return uri ? (
                                    <Image source={{ uri }} style={styles.itemImage} resizeMode="cover" />
                                ) : (
                                    <Text style={{ fontSize: 32 }}>📦</Text>
                                );
                            })()}
                        </View>
                        <View style={styles.itemDetails}>
                            <Text style={styles.itemName} numberOfLines={1}>{item.product.name}</Text>
                            <Text style={styles.itemPrice}>₹{item.price}</Text>

                            <View style={styles.quantityControls}>
                                <TouchableOpacity
                                    style={styles.quantityBtn}
                                    onPress={() => handleUpdateQuantity(item._id, item.quantity - 1)}
                                    disabled={item.quantity <= 1 || updatingItemId === item._id}
                                >
                                    <Ionicons name="remove" size={16} color="#374151" />
                                </TouchableOpacity>

                                <View style={styles.quantityBox}>
                                    {updatingItemId === item._id ? (
                                        <ActivityIndicator size="small" color="#EAB308" />
                                    ) : (
                                        <Text style={styles.quantityText}>{item.quantity}</Text>
                                    )}
                                </View>

                                <TouchableOpacity
                                    style={styles.quantityBtn}
                                    onPress={() => handleUpdateQuantity(item._id, item.quantity + 1)}
                                    disabled={updatingItemId === item._id}
                                >
                                    <Ionicons name="add" size={16} color="#374151" />
                                </TouchableOpacity>

                                <TouchableOpacity
                                    style={styles.removeBtn}
                                    onPress={() => handleRemove(item._id)}
                                >
                                    <Ionicons name="trash-outline" size={18} color="#EF4444" />
                                </TouchableOpacity>
                            </View>
                        </View>
                    </View>
                ))}

                {/* Summary */}
                <View style={styles.summaryCard}>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Subtotal</Text>
                        <Text style={styles.summaryValue}>₹{cart.subtotal}</Text>
                    </View>
                    <View style={styles.summaryRow}>
                        <Text style={styles.summaryLabel}>Discount</Text>
                        <Text style={[styles.summaryValue, { color: '#10B981' }]}>-₹{cart.discount}</Text>
                    </View>
                    {cart.shippingCost > 0 && (
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Shipping</Text>
                            <Text style={styles.summaryValue}>₹{cart.shippingCost}</Text>
                        </View>
                    )}
                    <View style={styles.divider} />
                    <View style={styles.summaryRow}>
                        <Text style={styles.totalLabel}>Total</Text>
                        <Text style={styles.totalValue}>₹{cart.total}</Text>
                    </View>
                </View>
            </ScrollView>

            {/* Checkout Button */}
            <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
                <TouchableOpacity
                    style={styles.checkoutButton}
                    onPress={() => router.push('/checkout')}
                >
                    <Text style={styles.checkoutButtonText}>Proceed to Checkout</Text>
                    <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
                </TouchableOpacity>
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#F9FAFB',
    },
    center: {
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
    clearButton: {
        padding: 8,
    },
    clearText: {
        color: '#EF4444',
        fontWeight: '600',
    },
    scrollContent: {
        padding: 16,
        paddingBottom: 100,
    },
    emptyText: {
        fontSize: 18,
        color: '#6B7280',
        marginTop: 16,
        marginBottom: 24,
    },
    startShoppingButton: {
        backgroundColor: '#EAB308',
        paddingHorizontal: 24,
        paddingVertical: 12,
        borderRadius: 24,
    },
    startShoppingText: {
        color: '#FFFFFF',
        fontWeight: '700',
        fontSize: 16,
    },
    cartItem: {
        flexDirection: 'row',
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 12,
        marginBottom: 16,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 4,
        elevation: 2,
    },
    itemImageContainer: {
        width: 80,
        height: 80,
        borderRadius: 8,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    itemImage: {
        width: '100%',
        height: '100%',
        borderRadius: 8,
    },
    itemDetails: {
        flex: 1,
        justifyContent: 'space-between',
    },
    itemName: {
        fontSize: 15,
        fontWeight: '600',
        color: '#111827',
    },
    itemPrice: {
        fontSize: 15,
        fontWeight: '700',
        color: '#111827',
    },
    quantityControls: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 12,
    },
    quantityBtn: {
        width: 28,
        height: 28,
        borderRadius: 14,
        backgroundColor: '#F3F4F6',
        alignItems: 'center',
        justifyContent: 'center',
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    quantityBox: {
        minWidth: 20,
        alignItems: 'center',
    },
    quantityText: {
        fontSize: 14,
        fontWeight: '600',
        color: '#374151',
    },
    removeBtn: {
        marginLeft: 'auto',
        padding: 4,
    },
    summaryCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
        marginTop: 8,
    },
    summaryRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        marginBottom: 12,
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
    footer: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    checkoutButton: {
        backgroundColor: '#111827',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderRadius: 12,
    },
    checkoutButtonText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});
