import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, ActivityIndicator, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as WebBrowser from 'expo-web-browser';
import { useCartStore } from '../store/cartStore';
import { useOrderStore } from '../store/orderStore';
import { useAddressStore } from '../store/addressStore';

export default function CheckoutScreen() {
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const { cart, clearCart } = useCartStore();
    const { createOrder, createOrderPaymentLink, confirmOrderPaymentLink, isLoading: isOrderLoading } = useOrderStore();
    const { addresses, fetchAddresses, addAddress, isLoading: isAddressLoading } = useAddressStore();

    const [paymentMethod, setPaymentMethod] = useState('cod');
    const [selectedAddressId, setSelectedAddressId] = useState<string | null>(null);
    const [isAddingAddress, setIsAddingAddress] = useState(false);

    // New Address Form State
    const [newAddress, setNewAddress] = useState({
        fullName: '',
        phone: '',
        addressLine1: '',
        city: '',
        state: '',
        pincode: '',
        country: 'India',
        type: 'home'
    });

    useEffect(() => {
        fetchAddresses();
    }, [fetchAddresses]);

    useEffect(() => {
        if (addresses.length > 0 && !selectedAddressId) {
            const defaultAddr = addresses.find(a => a.isDefault) || addresses[0];
            setSelectedAddressId(defaultAddr._id);
        } else if (addresses.length === 0) {
            setIsAddingAddress(true);
        }
    }, [addresses, selectedAddressId]);

    const handlePlaceOrder = async () => {
        if (!selectedAddressId) {
            Alert.alert("Error", "Please select a shipping address");
            return;
        }

        const orderData = {
            addressId: selectedAddressId,
            paymentMethod
        };

        // 1. Create Order (get Order ID + Razorpay Order ID)
        const result = await createOrder(orderData);

        if (!result.success) {
            Alert.alert("Order Failed", result.message || "Something went wrong.");
            return;
        }

        // 2. Handle Payment Flow
        if (paymentMethod === 'razorpay' && result.orderId) {
            const orderId = result.orderId;
            const linkResult = await createOrderPaymentLink(orderId);
            if (!linkResult.success || !linkResult.url || !linkResult.paymentLinkId) {
                Alert.alert("Error", linkResult.message || "Could not create payment link.");
                return;
            }
            const { url, paymentLinkId } = linkResult;
            await WebBrowser.openBrowserAsync(url, { presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN });
            const confirmResult = await confirmOrderPaymentLink(orderId, paymentLinkId);
            if (confirmResult.success) {
                Alert.alert("Success", "Payment successful! Order confirmed.", [
                    { text: "OK", onPress: () => { clearCart(); router.replace('/orders'); } }
                ]);
            } else {
                Alert.alert("Payment Verification", confirmResult.message || "Payment may still be processing. Check My Orders.");
            }
        } else if (paymentMethod === 'razorpay') {
            Alert.alert("Error", "Could not create order for online payment.");
        } else {
            // COD or other methods
            Alert.alert("Success", "Order placed successfully!", [
                {
                    text: "OK", onPress: () => {
                        clearCart();
                        router.replace('/orders');
                    }
                }
            ]);
        }
    };

    const handleSaveAddress = async () => {
        if (!newAddress.fullName || !newAddress.phone || !newAddress.addressLine1 || !newAddress.city || !newAddress.state || !newAddress.pincode) {
            Alert.alert("Error", "Please fill all required fields");
            return;
        }

        const addedAddress = await addAddress({
            ...newAddress,
            isDefault: addresses.length === 0
        });
        if (addedAddress) {
            setSelectedAddressId(addedAddress._id);
            setIsAddingAddress(false);
            // Verify fetch to ensure sync
            fetchAddresses();
        }
    };

    if (!cart) return null;

    const selectedAddress = addresses.find(a => a._id === selectedAddressId);

    return (
        <View style={styles.container}>
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>Checkout</Text>
                <View style={{ width: 40 }} />
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>

                {/* Shipping Address Section */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="location-outline" size={20} color="#111827" />
                        <Text style={styles.sectionTitle}>Shipping Address</Text>
                    </View>

                    {isAddingAddress ? (
                        <View style={styles.formCard}>
                            <Text style={styles.formTitle}>Add New Address</Text>

                            <TextInput
                                style={styles.input}
                                placeholder="Full Name"
                                value={newAddress.fullName}
                                onChangeText={t => setNewAddress({ ...newAddress, fullName: t })}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Phone Number"
                                keyboardType="phone-pad"
                                value={newAddress.phone}
                                onChangeText={t => setNewAddress({ ...newAddress, phone: t })}
                            />
                            <TextInput
                                style={styles.input}
                                placeholder="Address Line 1 (House No, Street)"
                                value={newAddress.addressLine1}
                                onChangeText={t => setNewAddress({ ...newAddress, addressLine1: t })}
                            />
                            <View style={styles.row}>
                                <TextInput
                                    style={[styles.input, { flex: 1, marginRight: 8 }]}
                                    placeholder="City"
                                    value={newAddress.city}
                                    onChangeText={t => setNewAddress({ ...newAddress, city: t })}
                                />
                                <TextInput
                                    style={[styles.input, { flex: 1 }]}
                                    placeholder="State"
                                    value={newAddress.state}
                                    onChangeText={t => setNewAddress({ ...newAddress, state: t })}
                                />
                            </View>
                            <View style={styles.row}>
                                <TextInput
                                    style={[styles.input, { flex: 1, marginRight: 8 }]}
                                    placeholder="Pincode"
                                    keyboardType="numeric"
                                    value={newAddress.pincode}
                                    onChangeText={t => setNewAddress({ ...newAddress, pincode: t })}
                                />
                                <TextInput
                                    style={[styles.input, { flex: 1 }]}
                                    placeholder="Country"
                                    value={newAddress.country}
                                    editable={false}
                                />
                            </View>

                            <View style={styles.formActions}>
                                {addresses.length > 0 && (
                                    <TouchableOpacity
                                        style={styles.cancelButton}
                                        onPress={() => setIsAddingAddress(false)}
                                    >
                                        <Text style={styles.cancelButtonText}>Cancel</Text>
                                    </TouchableOpacity>
                                )}
                                <TouchableOpacity
                                    style={styles.saveButton}
                                    onPress={handleSaveAddress}
                                    disabled={isAddressLoading}
                                >
                                    {isAddressLoading ? (
                                        <ActivityIndicator color="#FFFFFF" size="small" />
                                    ) : (
                                        <Text style={styles.saveButtonText}>Save & Use</Text>
                                    )}
                                </TouchableOpacity>
                            </View>
                        </View>
                    ) : (
                        <View style={styles.card}>
                            {selectedAddress ? (
                                <>
                                    <View style={styles.addressHeader}>
                                        <Text style={styles.addressType}>{selectedAddress.type}</Text>
                                        {selectedAddress.isDefault && <Text style={styles.defaultBadge}>Default</Text>}
                                    </View>
                                    <Text style={styles.addressName}>{selectedAddress.fullName}</Text>
                                    <Text style={styles.addressText}>{selectedAddress.addressLine1}</Text>
                                    <Text style={styles.addressText}>{selectedAddress.city}, {selectedAddress.state} {selectedAddress.pincode}</Text>
                                    <Text style={styles.addressText}>{selectedAddress.country}</Text>
                                    <Text style={styles.phoneText}>Phone: {selectedAddress.phone}</Text>

                                    <TouchableOpacity
                                        style={styles.changeButton}
                                        onPress={() => setIsAddingAddress(true)}
                                    >
                                        <Text style={styles.changeText}>Add New Address</Text>
                                    </TouchableOpacity>

                                    {addresses.length > 1 && (
                                        <View style={styles.addressList}>
                                            <Text style={styles.otherAddressLabel}>Or select other:</Text>
                                            {addresses.filter(a => a._id !== selectedAddressId).map(addr => (
                                                <TouchableOpacity
                                                    key={addr._id}
                                                    style={styles.otherAddressItem}
                                                    onPress={() => setSelectedAddressId(addr._id)}
                                                >
                                                    <Ionicons name="location-outline" size={16} color="#6B7280" />
                                                    <Text style={styles.otherAddressText} numberOfLines={1}>
                                                        {addr.fullName}, {addr.city}
                                                    </Text>
                                                </TouchableOpacity>
                                            ))}
                                        </View>
                                    )}
                                </>
                            ) : (
                                <ActivityIndicator color="#EAB308" />
                            )}
                        </View>
                    )}
                </View>

                {/* Payment Method */}
                <View style={styles.section}>
                    <View style={styles.sectionHeader}>
                        <Ionicons name="card-outline" size={20} color="#111827" />
                        <Text style={styles.sectionTitle}>Payment Method</Text>
                    </View>
                    <TouchableOpacity
                        style={[styles.paymentOption, paymentMethod === 'cod' && styles.paymentOptionActive]}
                        onPress={() => setPaymentMethod('cod')}
                    >
                        <View style={styles.radioCircle}>
                            {paymentMethod === 'cod' && <View style={styles.radioDot} />}
                        </View>
                        <Text style={styles.paymentText}>Cash on Delivery</Text>
                    </TouchableOpacity>
                    <TouchableOpacity
                        style={[styles.paymentOption, paymentMethod === 'razorpay' && styles.paymentOptionActive]}
                        onPress={() => setPaymentMethod('razorpay')}
                    >
                        <View style={styles.radioCircle}>
                            {paymentMethod === 'razorpay' && <View style={styles.radioDot} />}
                        </View>
                        <Text style={styles.paymentText}>Online Payment (Razorpay)</Text>
                    </TouchableOpacity>
                </View>

                {/* Order Summary */}
                <View style={styles.section}>
                    <Text style={styles.sectionTitle}>Order Summary</Text>
                    <View style={styles.card}>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Subtotal</Text>
                            <Text style={styles.summaryValue}>₹{cart.subtotal}</Text>
                        </View>
                        <View style={styles.summaryRow}>
                            <Text style={styles.summaryLabel}>Shipping</Text>
                            <Text style={styles.summaryValue}>₹{cart.shippingCost}</Text>
                        </View>
                        <View style={styles.divider} />
                        <View style={styles.summaryRow}>
                            <Text style={styles.totalLabel}>Total Amount</Text>
                            <Text style={styles.totalValue}>₹{cart.total}</Text>
                        </View>
                    </View>
                </View>
            </ScrollView>

            <View style={[styles.footer, { paddingBottom: 16 + insets.bottom }]}>
                <TouchableOpacity
                    style={[styles.placeOrderButton, (isOrderLoading || isAddingAddress) && styles.disabledButton]}
                    onPress={handlePlaceOrder}
                    disabled={isOrderLoading || isAddingAddress}
                >
                    {isOrderLoading ? (
                        <ActivityIndicator color="#FFFFFF" />
                    ) : (
                        <>
                            <Text style={styles.placeOrderText}>Place Order</Text>
                            <Ionicons name="checkmark-circle-outline" size={20} color="#FFFFFF" />
                        </>
                    )}
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
        paddingBottom: 100,
    },
    section: {
        marginBottom: 24,
    },
    sectionHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        marginBottom: 12,
        gap: 8,
    },
    sectionTitle: {
        fontSize: 16,
        fontWeight: '700',
        color: '#374151',
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
    formCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 12,
        padding: 16,
    },
    formTitle: {
        fontSize: 16,
        fontWeight: '700',
        marginBottom: 16,
        color: '#111827',
    },
    input: {
        backgroundColor: '#F9FAFB',
        borderWidth: 1,
        borderColor: '#E5E7EB',
        borderRadius: 8,
        padding: 12,
        fontSize: 14,
        marginBottom: 12,
        color: '#111827',
    },
    row: {
        flexDirection: 'row',
    },
    formActions: {
        flexDirection: 'row',
        justifyContent: 'flex-end',
        gap: 12,
        marginTop: 8,
    },
    cancelButton: {
        paddingVertical: 10,
        paddingHorizontal: 16,
        borderRadius: 8,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    cancelButtonText: {
        color: '#374151',
        fontWeight: '600',
    },
    saveButton: {
        backgroundColor: '#111827',
        paddingVertical: 10,
        paddingHorizontal: 24,
        borderRadius: 8,
    },
    saveButtonText: {
        color: '#FFFFFF',
        fontWeight: '600',
    },
    addressHeader: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        marginBottom: 8,
    },
    addressType: {
        fontSize: 12,
        fontWeight: '700',
        color: '#6B7280',
        backgroundColor: '#F3F4F6',
        paddingHorizontal: 8,
        paddingVertical: 2,
        borderRadius: 4,
    },
    defaultBadge: {
        fontSize: 12,
        color: '#10B981',
        fontWeight: '600',
    },
    addressName: {
        fontSize: 16,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 4,
    },
    addressText: {
        fontSize: 14,
        color: '#4B5563',
        marginBottom: 2,
    },
    phoneText: {
        fontSize: 14,
        color: '#111827',
        marginTop: 6,
        fontWeight: '500',
    },
    changeButton: {
        marginTop: 12,
        alignSelf: 'flex-start',
    },
    changeText: {
        color: '#3B82F6',
        fontWeight: '600',
        fontSize: 14,
    },
    addressList: {
        marginTop: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
        paddingTop: 12,
    },
    otherAddressLabel: {
        fontSize: 13,
        color: '#6B7280',
        marginBottom: 8,
    },
    otherAddressItem: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 8,
        gap: 8,
    },
    otherAddressText: {
        fontSize: 14,
        color: '#374151',
    },
    paymentOption: {
        flexDirection: 'row',
        alignItems: 'center',
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderRadius: 12,
        marginBottom: 12,
        borderWidth: 1,
        borderColor: '#E5E7EB',
    },
    paymentOptionActive: {
        borderColor: '#3B82F6',
        backgroundColor: '#EFF6FF',
    },
    radioCircle: {
        width: 20,
        height: 20,
        borderRadius: 10,
        borderWidth: 2,
        borderColor: '#9CA3AF',
        alignItems: 'center',
        justifyContent: 'center',
        marginRight: 12,
    },
    radioDot: {
        width: 10,
        height: 10,
        borderRadius: 5,
        backgroundColor: '#3B82F6',
    },
    paymentText: {
        fontSize: 15,
        fontWeight: '500',
        color: '#111827',
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
    placeOrderButton: {
        backgroundColor: '#111827',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderRadius: 12,
    },
    disabledButton: {
        opacity: 0.6,
    },
    placeOrderText: {
        color: '#FFFFFF',
        fontSize: 16,
        fontWeight: '700',
    },
});
