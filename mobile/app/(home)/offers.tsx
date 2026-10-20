import React, { useCallback, useMemo, useState } from 'react';
import {
  View,
  Text,
  ScrollView,
  TouchableOpacity,
  ActivityIndicator,
  Image,
  RefreshControl,
  StyleSheet,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useFocusEffect, useRouter } from 'expo-router';
import apiClient from '../../utils/apiClient';
import { useTheme } from '../../hooks/useTheme';

type Offer = {
  _id: string;
  title: string;
  description?: string;
  bannerImage?: string | null;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  maxDiscount?: number | null;
  minOrderValue?: number;
  applicableOn: 'all' | 'category' | 'product' | 'shop';
  endDate: string;
  priority?: number;
};

export default function OffersScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [offers, setOffers] = useState<Offer[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadOffers = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);

    try {
      const response = await apiClient.get('/offers');
      setOffers(response.data?.offers || []);
    } catch {
      setOffers([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadOffers();
  }, [loadOffers]));

  const s = useMemo(() => StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.surface,
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    headerBtn: {
      width: 40,
      height: 40,
      borderRadius: 20,
      backgroundColor: colors.surfaceSecondary,
      alignItems: 'center',
      justifyContent: 'center',
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text },
    content: { padding: 20, paddingBottom: 40 },
    intro: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 18 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
      marginBottom: 16,
    },
    banner: { width: '100%', height: 150, backgroundColor: colors.surfaceSecondary },
    cardBody: { padding: 16 },
    discountBadge: {
      alignSelf: 'flex-start',
      flexDirection: 'row',
      alignItems: 'center',
      gap: 4,
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingHorizontal: 9,
      paddingVertical: 4,
      marginBottom: 8,
    },
    discountText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
    title: { fontSize: 18, fontWeight: '800', color: colors.text },
    description: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginTop: 5 },
    metaRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 10, flexWrap: 'wrap' },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 11, color: colors.textSecondary },
    shopButton: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      borderRadius: 10,
      paddingVertical: 11,
      marginTop: 14,
    },
    shopButtonText: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
    loading: { paddingVertical: 80, alignItems: 'center' },
    empty: { paddingVertical: 60, alignItems: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 12 },
    emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, paddingHorizontal: 20 },
  }), [colors]);

  const formatOfferDiscount = (offer: Offer) => {
    if (offer.discountType === 'percentage') {
      const cap = offer.maxDiscount ? ` up to ₹${offer.maxDiscount}` : '';
      return `${offer.discountValue}% OFF${cap}`;
    }
    return `₹${offer.discountValue} OFF`;
  };

  const formatDate = (value: string) => {
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return '';
    return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
  };

  const scopeLabel = (offer: Offer) => {
    if (offer.applicableOn === 'category') return 'Selected categories';
    if (offer.applicableOn === 'product') return 'Selected products';
    if (offer.applicableOn === 'shop') return 'Selected shops';
    return 'All products';
  };

  return (
    <SafeAreaView style={s.root}>
      <View style={s.header}>
        <TouchableOpacity style={s.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={s.headerTitle}>Offers & Deals</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={s.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadOffers(true)} tintColor={colors.primary} />
        }
      >
        <Text style={s.intro}>
          Active offers are applied automatically to eligible items in your cart. Coupons can also be applied at cart checkout.
        </Text>

        {loading ? (
          <View style={s.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : offers.length === 0 ? (
          <View style={s.empty}>
            <Ionicons name="pricetags-outline" size={48} color={colors.textSecondary} />
            <Text style={s.emptyTitle}>No active offers</Text>
            <Text style={s.emptyText}>Check back soon for new deals and festive offers.</Text>
          </View>
        ) : (
          offers.map((offer) => (
            <View key={offer._id} style={s.card}>
              {offer.bannerImage ? (
                <Image source={{ uri: offer.bannerImage }} style={s.banner} resizeMode="cover" />
              ) : null}
              <View style={s.cardBody}>
                <View style={s.discountBadge}>
                  <Ionicons name="pricetag" size={12} color="#FFFFFF" />
                  <Text style={s.discountText}>{formatOfferDiscount(offer)}</Text>
                </View>
                <Text style={s.title}>{offer.title}</Text>
                {!!offer.description && <Text style={s.description}>{offer.description}</Text>}

                <View style={s.metaRow}>
                  <View style={s.meta}>
                    <Ionicons name="grid-outline" size={12} color={colors.textSecondary} />
                    <Text style={s.metaText}>{scopeLabel(offer)}</Text>
                  </View>
                  {!!offer.minOrderValue && (
                    <View style={s.meta}>
                      <Ionicons name="wallet-outline" size={12} color={colors.textSecondary} />
                      <Text style={s.metaText}>Min ₹{offer.minOrderValue}</Text>
                    </View>
                  )}
                  <View style={s.meta}>
                    <Ionicons name="time-outline" size={12} color={colors.textSecondary} />
                    <Text style={s.metaText}>Ends {formatDate(offer.endDate)}</Text>
                  </View>
                </View>

                <TouchableOpacity
                  style={s.shopButton}
                  onPress={() => router.push('/shops')}
                  activeOpacity={0.85}
                >
                  <Ionicons name="bag-handle-outline" size={16} color="#FFFFFF" />
                  <Text style={s.shopButtonText}>Shop Now</Text>
                </TouchableOpacity>
              </View>
            </View>
          ))
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
