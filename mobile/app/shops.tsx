import React, { useState, useEffect } from 'react';
import { View, Text, ScrollView, StyleSheet, TouchableOpacity, TextInput, Image, ActivityIndicator, Alert, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useProductStore } from '../store/productStore';
import { useCartStore } from '../store/cartStore';

const CATEGORIES = [
  { id: 'all', name: 'All', icon: 'apps' },
  { id: 'pooja', name: 'Pooja', icon: 'flame' },
  { id: 'books', name: 'Books', icon: 'book' },
  { id: 'clothing', name: 'Clothing', icon: 'shirt' },
  { id: 'wellness', name: 'Wellness', icon: 'leaf' }
];

export default function ShopsScreen() {
  const router = useRouter();
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategory, setSelectedCategory] = useState('all');

  // Use product store instead of shop store
  const { products, fetchAllProducts, isLoading } = useProductStore();
  const { addToCart, fetchCart, itemCount, cart } = useCartStore();

  useEffect(() => {
    // Debounce search could be added here, currently fetching on every change
    const timeoutId = setTimeout(() => {
      fetchAllProducts({
        search: searchQuery,
        category: selectedCategory !== 'all' ? selectedCategory : undefined
      });
    }, 500);

    return () => clearTimeout(timeoutId);
  }, [searchQuery, selectedCategory]);

  useEffect(() => {
    fetchCart();
  }, []);

  const handleAddToCart = async (productId: string) => {
    const success = await addToCart(productId, 1);
    if (success) {
      // Optional: Toast or feedback
    } else {
      Alert.alert("Error", "Could not add to cart. Please log in.");
    }
  };

  const isInCart = (productId: string) => {
    if (!cart || !cart.items) return false;
    return cart.items.some(item => {
      const pId = typeof item.product === 'string' ? item.product : item.product?._id;
      return pId === productId;
    });
  };

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
        <Text style={styles.headerTitle}>Shop</Text>
        <TouchableOpacity style={styles.cartButton} onPress={() => router.push('/cart')}>
          <Ionicons name="cart-outline" size={24} color="#111827" />
          {itemCount() > 0 && (
            <View style={styles.cartBadge}>
              <Text style={styles.cartBadgeText}>{itemCount()}</Text>
            </View>
          )}
        </TouchableOpacity>
      </View>

      <ScrollView showsVerticalScrollIndicator={false}>
        {/* Search Bar */}
        <View style={styles.searchContainer}>
          <Ionicons name="search" size={20} color="#9CA3AF" style={styles.searchIcon} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search products..."
            value={searchQuery}
            onChangeText={setSearchQuery}
            placeholderTextColor="#9CA3AF"
          />
          {searchQuery.length > 0 && (
            <TouchableOpacity onPress={() => setSearchQuery('')}>
              <Ionicons name="close-circle" size={20} color="#9CA3AF" />
            </TouchableOpacity>
          )}
        </View>

        {/* Categories */}
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          style={styles.categoriesContainer}
          contentContainerStyle={styles.categoriesContent}
        >
          {CATEGORIES.map(category => (
            <TouchableOpacity
              key={category.id}
              style={[
                styles.categoryChip,
                selectedCategory === category.id && styles.categoryChipActive
              ]}
              onPress={() => setSelectedCategory(category.id)}
            >
              <Ionicons
                name={category.icon as any}
                size={18}
                color={selectedCategory === category.id ? '#FFFFFF' : '#6B7280'}
              />
              <Text style={[
                styles.categoryText,
                selectedCategory === category.id && styles.categoryTextActive
              ]}>
                {category.name}
              </Text>
            </TouchableOpacity>
          ))}
        </ScrollView>

        {/* Products Grid */}
        <View style={styles.shopsContainer}>
          <Text style={styles.sectionTitle}>
            {products.length} Product{products.length !== 1 ? 's' : ''} Found
          </Text>

          {isLoading ? (
            <ActivityIndicator size="large" color="#EAB308" style={{ marginTop: 20 }} />
          ) : (
            <View style={styles.grid}>
              {products.map(product => {
                const isAmazon = product.productType === 'amazon' && product.externalLink;
                const handleCardPress = () => {
                  if (isAmazon && product.externalLink) Linking.openURL(product.externalLink!);
                  else router.push({ pathname: '/product-detail', params: { productId: product.id } });
                };
                return (
                <TouchableOpacity
                  key={product.id}
                  style={styles.productCard}
                  onPress={handleCardPress}
                >
                  <View style={styles.imageContainer}>
                    {product.image && product.image.startsWith('http') ? (
                      <Image source={{ uri: product.image }} style={styles.productImage} resizeMode="cover" />
                    ) : (
                      <Text style={styles.productEmoji}>{product.image || '📦'}</Text>
                    )}
                    {isAmazon && (
                      <View style={styles.amazonBadge}>
                        <Text style={styles.amazonBadgeText}>Amazon</Text>
                      </View>
                    )}
                  </View>

                  <View style={styles.productInfo}>
                    <Text style={styles.productName} numberOfLines={2}>
                      {product.name}
                    </Text>

                    <View style={styles.ratingContainer}>
                      <Ionicons name="star" size={12} color="#FBBF24" />
                      <Text style={styles.ratingText}>
                        {product.rating?.average || '0'} ({product.reviewsCount || 0})
                      </Text>
                    </View>

                    {!isAmazon && <Text style={styles.productPrice}>₹{product.price}</Text>}
                    {isAmazon && <Text style={styles.viewOnAmazonText}>View on Amazon</Text>}

                    {isAmazon ? (
                      <TouchableOpacity
                        style={[styles.addButton, styles.amazonButton]}
                        onPress={(e) => { e.stopPropagation(); if (product.externalLink) Linking.openURL(product.externalLink); }}
                      >
                        <Text style={styles.addButtonText}>View on Amazon</Text>
                      </TouchableOpacity>
                    ) : (
                      <TouchableOpacity
                        style={[
                          styles.addButton,
                          isInCart(product.id) && styles.addButtonActive
                        ]}
                        onPress={(e) => { e.stopPropagation(); handleAddToCart(product.id); }}
                      >
                        <Text style={styles.addButtonText}>
                          {isInCart(product.id) ? 'Added' : 'Add to Cart'}
                        </Text>
                      </TouchableOpacity>
                    )}
                  </View>
                </TouchableOpacity>
                );
              })}
            </View>
          )}
        </View>

        <View style={{ height: 40 }} />
      </ScrollView>
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
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    paddingHorizontal: 16,
    paddingVertical: 12,
    margin: 16,
    marginBottom: 12,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.05,
    shadowRadius: 4,
    elevation: 2,
  },
  searchIcon: {
    marginRight: 12,
  },
  searchInput: {
    flex: 1,
    fontSize: 15,
    color: '#111827',
  },
  categoriesContainer: {
    marginBottom: 20,
  },
  categoriesContent: {
    paddingHorizontal: 16,
    gap: 10,
  },
  categoryChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 16,
    paddingVertical: 10,
    borderRadius: 20,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
  },
  categoryChipActive: {
    backgroundColor: '#3B82F6',
    borderColor: '#3B82F6',
  },
  categoryText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#6B7280',
  },
  categoryTextActive: {
    color: '#FFFFFF',
  },
  shopsContainer: {
    paddingHorizontal: 16,
  },
  sectionTitle: {
    fontSize: 18,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 16,
  },
  grid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 16,
  },
  productCard: {
    width: '47%',
    backgroundColor: '#FFFFFF',
    borderRadius: 12,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.06,
    shadowRadius: 6,
    elevation: 2,
    marginBottom: 16,
  },
  imageContainer: {
    width: '100%',
    height: 140,
    backgroundColor: '#F3F4F6',
    alignItems: 'center',
    justifyContent: 'center',
  },
  productImage: {
    width: '100%',
    height: '100%',
  },
  productEmoji: {
    fontSize: 48,
  },
  productInfo: {
    padding: 12,
  },
  productName: {
    fontSize: 15,
    fontWeight: '600',
    color: '#111827',
    marginBottom: 6,
    height: 40,
  },
  ratingContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginBottom: 8,
  },
  ratingText: {
    fontSize: 12,
    color: '#6B7280',
    fontWeight: '500',
  },
  productPrice: {
    fontSize: 16,
    fontWeight: '700',
    color: '#111827',
    marginBottom: 12,
  },
  addButton: {
    backgroundColor: '#F3F4F6',
    paddingVertical: 8,
    borderRadius: 8,
    alignItems: 'center',
  },
  addButtonActive: {
    backgroundColor: '#10B981',
  },
  addButtonText: {
    fontSize: 13,
    fontWeight: '600',
    color: '#374151',
  },
  amazonButton: {
    backgroundColor: '#FF9900',
  },
  amazonBadge: {
    position: 'absolute',
    top: 6,
    left: 6,
    backgroundColor: '#FF9900',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
  },
  amazonBadgeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  viewOnAmazonText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FF9900',
    marginBottom: 12,
  },
});
