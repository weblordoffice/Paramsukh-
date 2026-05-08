import React, { useState , useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter, useLocalSearchParams } from 'expo-router';

import { useProductStore } from '../store/productStore';


export default function ShopDetailScreen() {
  const router = useRouter();
  const params = useLocalSearchParams();
  const [cart, setCart] = useState<string[]>([]);

  // Products fetch logic
  const { currentShop, products, fetchShopDetails, fetchProductsByShop } = useProductStore();

  useEffect(() => {
    if (params.shopId) {
      const id = typeof params.shopId === 'string' ? params.shopId : params.shopId[0];
      fetchShopDetails(id);
      fetchProductsByShop(id);
    }
  }, [params.shopId, fetchShopDetails, fetchProductsByShop]);

  if (!currentShop) {
    return (
      <View style={[styles.container, { justifyContent: 'center', alignItems: 'center' }]}>
        <Text>Loading Shop...</Text>
      </View>
    );
  }


  const handleAddToCart = (productId: string) => {
    if (cart.includes(productId)) {
      setCart(cart.filter(id => id !== productId));
    } else {
      setCart([...cart, productId]);
    }
  };

  const isInCart = (productId: string) => cart.includes(productId);

  return (
    <View style={styles.container}>
      {/* Header */}
      <View style={styles.header}>
        <TouchableOpacity
          style={styles.backButton}
          onPress={() => router.back()}
        >
          <Ionicons name="arrow-back" size={24} color="#111827" />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>Shop Details</Text>
        <TouchableOpacity style={styles.cartButton}>
          <Ionicons name="cart-outline" size={24} color="#111827" />
          {cart.length > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{cart.length}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Shop Info Card */}
        <View style={styles.shopInfoCard}>
          <View style={styles.shopHeader}>
            <View style={styles.shopImageContainer}>
              <Text style={styles.shopEmoji}>{currentShop.image}</Text>
            </View>

            <View style={styles.shopHeaderInfo}>
              <Text style={styles.shopName}>{currentShop.name}</Text>

              <View style={styles.ratingRow}>
                <Ionicons name="star" size={16} color="#FBBF24" />
                <Text style={styles.ratingText}>
                  {currentShop.rating} ({currentShop.totalReviews} reviews)
                </Text>
              </View>

              <View style={styles.locationRow}>
                <Ionicons name="location" size={14} color="#6B7280" />
                <Text style={styles.locationText}>{currentShop.location}</Text>
              </View>
            </View>
          </View>

          <Text style={styles.shopDescription}>{currentShop.description}</Text>

          <View style={styles.shopStats}>
            <View style={styles.statItem}>
              <Ionicons name="time-outline" size={20} color="#3B82F6" />
              <Text style={styles.statText}>Est. {currentShop.established}</Text>
            </View>
            <View style={styles.statItem}>
              <Ionicons name="shield-checkmark" size={20} color="#10B981" />
              <Text style={styles.statText}>Verified Seller</Text>
            </View>
          </View>
        </View>

        {/* Products Section */}
        <View style={styles.productsSection}>
          <View style={styles.sectionHeader}>
            <Text style={styles.sectionTitle}>Products</Text>
            <TouchableOpacity>
              <Text style={styles.filterText}>Filter</Text>
            </TouchableOpacity>
          </View>

          {products.map((product) => (
            <View key={product.id} style={styles.productCard}>
              <View style={styles.productImageContainer}>
                <Text style={styles.productEmoji}>{product.image}</Text>
                {!product.inStock && (
                  <View style={styles.outOfStockBadge}>
                    <Text style={styles.outOfStockText}>Out of Stock</Text>
                  </View>
                )}
              </View>

              <View style={styles.productInfo}>
                <Text style={styles.productName} numberOfLines={2}>
                  {product.name}
                </Text>

                <Text style={styles.productDescription} numberOfLines={1}>
                  {product.description}
                </Text>

                <View style={styles.productMeta}>
                  <View style={styles.productRating}>
                    <Ionicons name="star" size={12} color="#FBBF24" />
                    <Text style={styles.productRatingText}>
                      {product.rating.average || 0} ({product.reviewsCount})
                    </Text>
                  </View>
                </View>

                <View style={styles.productFooter}>
                  <Text style={styles.productPrice}>₹{product.price}</Text>

                  <TouchableOpacity
                    style={[
                      styles.addToCartButton,
                      !product.inStock && styles.addToCartButtonDisabled,
                      isInCart(product.id) && styles.addToCartButtonActive
                    ]}
                    onPress={() => handleAddToCart(product.id)}
                    disabled={!product.inStock}
                  >
                    <Ionicons
                      name={isInCart(product.id) ? "checkmark" : "cart"}
                      size={16}
                      color="#FFFFFF"
                    />
                    <Text style={styles.addToCartText}>
                      {isInCart(product.id) ? 'Added' : 'Add'}
                    </Text>
                  </TouchableOpacity>
                </View>
              </View>
            </View>
          ))}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>

      {/* Floating Checkout Button */}
      {cart.length > 0 && (
        <View style={styles.checkoutContainer}>
          <TouchableOpacity style={styles.checkoutButton}>
            <View style={styles.checkoutInfo}>
              <Text style={styles.checkoutItems}>{cart.length} items</Text>
              <Text style={styles.checkoutPrice}>
                ₹{products
                  .filter(p => cart.includes(p.id))
                  .reduce((sum, p) => sum + p.price, 0)}
              </Text>
            </View>
            <View style={styles.checkoutAction}>
              <Text style={styles.checkoutText}>Checkout</Text>
              <Ionicons name="arrow-forward" size={20} color="#FFFFFF" />
            </View>
          </TouchableOpacity>
        </View>
      )}
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
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
  },
  headerTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    flex: 1,
    textAlign: 'center',
    marginHorizontal: 16,
  },
  cartButton: {
    width: 40,
    height: 40,
    borderRadius: 20,
    backgroundColor: '#F9FAFB',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
  },
  cartBadge: {
    position: 'absolute',
    top: -2,
    right: -2,
    backgroundColor: '#EF4444',
    borderRadius: 10,
    minWidth: 18,
    height: 18,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 4,
  },
  cartBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  shopInfoCard: {
    backgroundColor: '#FFFFFF',
    padding: 20,
    marginBottom: 16,
  },
  shopHeader: {
    flexDirection: 'row',
    marginBottom: 16,
  },
  shopImageContainer: {
    width: 80,
    height: 80,
    borderRadius: 12,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 16,
  },
  shopEmoji: {
    fontSize: 40,
  },
  shopHeaderInfo: {
    flex: 1,
    justifyContent: 'center',
  },
  shopName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 6,
  },
  ratingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  ratingText: {
    fontSize: 14,
    color: '#6B7280',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#6B7280',
  },
  shopDescription: {
    fontSize: 14,
    color: '#6B7280',
    lineHeight: 20,
    marginBottom: 16,
  },
  shopStats: {
    flexDirection: 'row',
    gap: 16,
  },
  statItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  statText: {
    fontSize: 13,
    color: '#6B7280',
    fontWeight: '600',
  },
  productsSection: {
    padding: 16,
  },
  sectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 16,
  },
  sectionTitle: {
    fontSize: 20,
    fontWeight: '700',
    color: '#111827',
  },
  filterText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#3B82F6',
  },
  productCard: {
    flexDirection: 'row',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    padding: 12,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  productImageContainer: {
    width: 90,
    height: 90,
    borderRadius: 8,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 12,
    position: 'relative',
  },
  productEmoji: {
    fontSize: 36,
  },
  outOfStockBadge: {
    position: 'absolute',
    bottom: 4,
    backgroundColor: 'rgba(239, 68, 68, 0.9)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  outOfStockText: {
    fontSize: 9,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  productInfo: {
    flex: 1,
  },
  productName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 4,
  },
  productDescription: {
    fontSize: 12,
    color: '#6B7280',
    marginBottom: 6,
  },
  productMeta: {
    flexDirection: 'row',
    alignItems: 'center',
    marginBottom: 8,
  },
  productRating: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  productRatingText: {
    fontSize: 12,
    color: '#6B7280',
  },
  productFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  productPrice: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
  },
  addToCartButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: '#3B82F6',
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 8,
  },
  addToCartButtonDisabled: {
    backgroundColor: '#9CA3AF',
  },
  addToCartButtonActive: {
    backgroundColor: '#10B981',
  },
  addToCartText: {
    fontSize: 13,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  checkoutContainer: {
    position: 'absolute',
    bottom: 0,
    left: 0,
    right: 0,
    padding: 16,
    backgroundColor: '#FFFFFF',
    borderTopWidth: 1,
    borderTopColor: '#E5E7EB',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: -2 },
    shadowOpacity: 0.1,
    shadowRadius: 8,
    elevation: 5,
  },
  checkoutButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: '#3B82F6',
    paddingVertical: 16,
    paddingHorizontal: 20,
    borderRadius: 12,
  },
  checkoutInfo: {
    flex: 1,
  },
  checkoutItems: {
    fontSize: 12,
    color: '#FFFFFF',
    opacity: 0.9,
    marginBottom: 2,
  },
  checkoutPrice: {
    fontSize: 20,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  checkoutAction: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  checkoutText: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
  },
});
