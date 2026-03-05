import React, { useEffect, useState } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, Image, ActivityIndicator, Dimensions, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useProductStore } from '../store/productStore';
import { useCartStore } from '../store/cartStore';

const { width } = Dimensions.get('window');
import { useSafeAreaInsets } from 'react-native-safe-area-context';

export default function ProductDetailScreen() {
    const { productId } = useLocalSearchParams();
    const router = useRouter();
    const { currentProduct, fetchProductById, isLoading } = useProductStore();
    const { addToCart } = useCartStore();
    const insets = useSafeAreaInsets();

    const [activeImageIndex, setActiveImageIndex] = useState(0);

    useEffect(() => {
        if (productId) {
            fetchProductById(productId as string);
        }
    }, [productId]);

    if (isLoading || !currentProduct) {
        return (
            <View style={styles.center}>
                <ActivityIndicator size="large" color="#EAB308" />
            </View>
        );
    }

    const handleAddToCart = async () => {
        await addToCart(currentProduct.id || currentProduct._id);
        router.push('/cart');
    };

    const isAmazon = currentProduct.productType === 'amazon' && currentProduct.externalLink;
    const handleOpenExternalLink = () => {
        if (currentProduct.externalLink) Linking.openURL(currentProduct.externalLink);
    };

    const images = (currentProduct.images && currentProduct.images.length > 0)
        ? currentProduct.images
        : [currentProduct.image].filter(Boolean);
    const imageUrls = images.map((img: any) => (typeof img === 'string' ? img : img?.url));

    return (
        <View style={styles.container}>
            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backButton} onPress={() => router.back()}>
                    <Ionicons name="arrow-back" size={24} color="#111827" />
                </TouchableOpacity>
                <TouchableOpacity style={styles.cartButton} onPress={() => router.push('/cart')}>
                    <Ionicons name="cart-outline" size={24} color="#111827" />
                </TouchableOpacity>
            </View>

            <ScrollView showsVerticalScrollIndicator={false} contentContainerStyle={styles.scrollContent}>
                {/* Image Gallery */}
                <View style={styles.imageGallery}>
                    <ScrollView
                        horizontal
                        pagingEnabled
                        showsHorizontalScrollIndicator={false}
                        onScroll={(e) => {
                            const slide = Math.ceil(e.nativeEvent.contentOffset.x / e.nativeEvent.layoutMeasurement.width);
                            if (slide !== activeImageIndex) setActiveImageIndex(slide);
                        }}
                        scrollEventThrottle={16}
                    >
                        {imageUrls.map((imgUrl: string, index: number) => (
                            <View key={index} style={styles.imageWrapper}>
                                {imgUrl && imgUrl.startsWith('http') ? (
                                    <Image source={{ uri: imgUrl }} style={styles.productImage} resizeMode="contain" />
                                ) : (
                                    <Text style={styles.placeholderEmoji}>📦</Text>
                                )}
                            </View>
                        ))}
                    </ScrollView>

                    {/* Pagination Dots */}
                    {imageUrls.length > 1 && (
                        <View style={styles.pagination}>
                            {imageUrls.map((_: string, index: number) => (
                                <View
                                    key={index}
                                    style={[
                                        styles.paginationDot,
                                        index === activeImageIndex && styles.paginationDotActive
                                    ]}
                                />
                            ))}
                        </View>
                    )}
                </View>

                {/* Product Info */}
                <View style={styles.infoContainer}>
                    <Text style={styles.productName}>{currentProduct.name}</Text>

                    <View style={styles.ratingRow}>
                        <Ionicons name="star" size={16} color="#FBBF24" />
                        <Text style={styles.ratingText}>
                            {currentProduct.rating?.average || 0} ({currentProduct.reviewsCount || 0} reviews)
                        </Text>
                    </View>

                    {!isAmazon && <Text style={styles.price}>₹{currentProduct.price}</Text>}
                    {isAmazon && (
                        <Text style={styles.amazonHint}>Available on Amazon — tap the button below to view</Text>
                    )}

                    <Text style={styles.sectionTitle}>Description</Text>
                    <Text style={styles.description}>{currentProduct.description}</Text>

                    {currentProduct.specifications && currentProduct.specifications.length > 0 && (
                        <>
                            <Text style={styles.sectionTitle}>Specifications</Text>
                            {currentProduct.specifications.map((spec: any, idx: number) => (
                                <View key={idx} style={styles.specRow}>
                                    <Text style={styles.specKey}>{spec.key}</Text>
                                    <Text style={styles.specValue}>{spec.value}</Text>
                                </View>
                            ))}
                        </>
                    )}
                </View>
            </ScrollView>

            {/* Bottom Action Bar */}
            <View style={[styles.bottomBar, { paddingBottom: 16 + insets.bottom }]}>
                {isAmazon ? (
                    <TouchableOpacity style={[styles.addToCartButton, { backgroundColor: '#FF9900' }]} onPress={handleOpenExternalLink}>
                        <Text style={styles.addToCartText}>View on Amazon</Text>
                        <Ionicons name="open-outline" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                ) : (
                    <TouchableOpacity style={styles.addToCartButton} onPress={handleAddToCart}>
                        <Text style={styles.addToCartText}>Add to Cart</Text>
                        <Ionicons name="cart" size={20} color="#FFFFFF" />
                    </TouchableOpacity>
                )}
            </View>
        </View>
    );
}

const styles = StyleSheet.create({
    container: {
        flex: 1,
        backgroundColor: '#FFFFFF',
    },
    center: {
        flex: 1,
        justifyContent: 'center',
        alignItems: 'center',
    },
    header: {
        position: 'absolute',
        top: 50,
        left: 0,
        right: 0,
        zIndex: 10,
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingHorizontal: 20,
    },
    backButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    cartButton: {
        width: 40,
        height: 40,
        borderRadius: 20,
        backgroundColor: 'rgba(255,255,255,0.9)',
        alignItems: 'center',
        justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 3,
    },
    scrollContent: {
        paddingBottom: 100,
    },
    imageGallery: {
        height: 350,
        backgroundColor: '#F3F4F6',
        position: 'relative',
    },
    imageWrapper: {
        width: width,
        height: 350,
        alignItems: 'center',
        justifyContent: 'center',
    },
    productImage: {
        width: '100%',
        height: '100%',
    },
    placeholderEmoji: {
        fontSize: 80,
    },
    pagination: {
        position: 'absolute',
        bottom: 16,
        left: 0,
        right: 0,
        flexDirection: 'row',
        justifyContent: 'center',
        gap: 8,
    },
    paginationDot: {
        width: 8,
        height: 8,
        borderRadius: 4,
        backgroundColor: 'rgba(0,0,0,0.2)',
    },
    paginationDotActive: {
        backgroundColor: '#111827',
    },
    infoContainer: {
        padding: 20,
    },
    productName: {
        fontSize: 24,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 8,
    },
    ratingRow: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 6,
        marginBottom: 16,
    },
    ratingText: {
        fontSize: 14,
        fontWeight: '500',
        color: '#6B7280',
    },
    price: {
        fontSize: 28,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 24,
    },
    amazonHint: {
        fontSize: 14,
        color: '#6B7280',
        marginBottom: 24,
    },
    sectionTitle: {
        fontSize: 18,
        fontWeight: '700',
        color: '#111827',
        marginBottom: 12,
        marginTop: 12,
    },
    description: {
        fontSize: 15,
        lineHeight: 24,
        color: '#4B5563',
        marginBottom: 16,
    },
    specRow: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        paddingVertical: 12,
        borderBottomWidth: 1,
        borderBottomColor: '#E5E7EB',
    },
    specKey: {
        fontSize: 14,
        color: '#6B7280',
    },
    specValue: {
        fontSize: 14,
        fontWeight: '600',
        color: '#111827',
    },
    bottomBar: {
        position: 'absolute',
        bottom: 0,
        left: 0,
        right: 0,
        backgroundColor: '#FFFFFF',
        padding: 16,
        borderTopWidth: 1,
        borderTopColor: '#E5E7EB',
    },
    addToCartButton: {
        backgroundColor: '#111827',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 16,
        borderRadius: 12,
    },
    addToCartText: {
        fontSize: 16,
        fontWeight: '700',
        color: '#FFFFFF',
    },
});
