import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, RefreshControl, ScrollView, StyleSheet, Text, TouchableOpacity, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { useFocusEffect, useRouter } from 'expo-router';
import { Ionicons } from '@expo/vector-icons';
import * as Haptics from 'expo-haptics';
import apiClient from '../../utils/apiClient';
import { useTheme } from '../../hooks/useTheme';

type PurchaseType = 'shop' | 'membership' | 'event' | 'counseling';

type Coupon = {
  _id: string;
  code: string;
  description?: string;
  discountType: 'percentage' | 'flat';
  discountValue: number;
  maxDiscount?: number | null;
  minOrderValue?: number;
  purchaseTypes?: PurchaseType[];
  applicableOn?: 'all' | 'category' | 'product' | 'shop';
  startDate: string;
  endDate: string;
  status: 'active' | 'upcoming' | 'exhausted';
  discountLabel?: string;
  remainingUses?: number;
};

const formatDate = (value: string) => {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '';
  return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
};

const scopeLabel = (coupon: Coupon) => {
  const types: PurchaseType[] = coupon.purchaseTypes?.length ? coupon.purchaseTypes : ['shop'];
  const labels: Record<PurchaseType, string> = {
    shop: 'Shop',
    membership: 'Membership',
    event: 'Events',
    counseling: 'Counseling',
  };
  const base = types.map((type) => labels[type] || type).join(' · ');
  if (!types.includes('shop') || !coupon.applicableOn || coupon.applicableOn === 'all') return base;
  if (coupon.applicableOn === 'category') return `${base} · selected categories`;
  if (coupon.applicableOn === 'product') return `${base} · selected products`;
  return `${base} · selected shops`;
};

const routeForCoupon = (coupon: Coupon) => {
  const types: PurchaseType[] = coupon.purchaseTypes?.length ? coupon.purchaseTypes : ['shop'];
  if (types.includes('shop')) return '/shops';
  if (types.includes('membership')) return '/(home)/membership-new';
  if (types.includes('event')) return '/(home)/events';
  return '/counseling';
};

export default function MyCouponsScreen() {
  const { colors } = useTheme();
  const router = useRouter();
  const [coupons, setCoupons] = useState<Coupon[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);

  const loadCoupons = useCallback(async (isRefresh = false) => {
    if (isRefresh) setRefreshing(true);
    else setLoading(true);
    try {
      const response = await apiClient.get('/coupons/mine');
      setCoupons(response.data?.coupons || []);
    } catch {
      setCoupons([]);
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useFocusEffect(useCallback(() => {
    loadCoupons();
  }, [loadCoupons]));

  const styles = useMemo(() => StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      paddingHorizontal: 20,
      paddingVertical: 16,
      backgroundColor: colors.surface,
    },
    headerBtn: { width: 40, height: 40, alignItems: 'center', justifyContent: 'center' },
    headerTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    content: { padding: 20, paddingBottom: 40, gap: 14 },
    intro: { fontSize: 13, color: colors.textSecondary, lineHeight: 19, marginBottom: 4 },
    card: {
      backgroundColor: colors.surface,
      borderRadius: 18,
      borderWidth: 1,
      borderColor: colors.border,
      padding: 18,
    },
    topRow: { flexDirection: 'row', alignItems: 'flex-start', justifyContent: 'space-between', gap: 12 },
    code: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: 1 },
    badge: { paddingHorizontal: 8, paddingVertical: 3, borderRadius: 8 },
    badgeText: { fontSize: 9, fontWeight: '800', letterSpacing: 0.5 },
    discount: { fontSize: 15, fontWeight: '700', color: colors.primary, marginTop: 8 },
    description: { fontSize: 13, color: colors.textSecondary, marginTop: 4, lineHeight: 18 },
    metaRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 12, marginTop: 12 },
    meta: { flexDirection: 'row', alignItems: 'center', gap: 4 },
    metaText: { fontSize: 11, color: colors.textSecondary },
    dashed: {
      marginTop: 14,
      paddingTop: 14,
      borderTopWidth: 1,
      borderStyle: 'dashed',
      borderTopColor: colors.border,
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: 12,
    },
    expiry: { fontSize: 11, color: colors.textSecondary, flex: 1 },
    useButton: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: 6,
      backgroundColor: colors.primary,
      paddingHorizontal: 14,
      paddingVertical: 9,
      borderRadius: 10,
    },
    useButtonText: { fontSize: 12, fontWeight: '800', color: '#FFFFFF' },
    disabledButton: { backgroundColor: colors.border },
    loading: { paddingVertical: 80, alignItems: 'center' },
    empty: { paddingVertical: 60, alignItems: 'center' },
    emptyTitle: { fontSize: 16, fontWeight: '700', color: colors.text, marginTop: 12 },
    emptyText: { fontSize: 13, color: colors.textSecondary, textAlign: 'center', marginTop: 6, paddingHorizontal: 20 },
  }), [colors]);

  return (
    <SafeAreaView style={styles.root}>
      <View style={styles.header}>
        <TouchableOpacity style={styles.headerBtn} onPress={() => router.back()}>
          <Ionicons name="arrow-back" size={24} color={colors.text} />
        </TouchableOpacity>
        <Text style={styles.headerTitle}>My Coupons</Text>
        <View style={{ width: 40 }} />
      </View>

      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
        refreshControl={
          <RefreshControl refreshing={refreshing} onRefresh={() => loadCoupons(true)} tintColor={colors.primary} />
        }
      >
        <Text style={styles.intro}>
          These coupons were sent to you by ParamSukh. Apply the code at checkout before it expires.
        </Text>

        {loading ? (
          <View style={styles.loading}>
            <ActivityIndicator size="large" color={colors.primary} />
          </View>
        ) : coupons.length === 0 ? (
          <View style={styles.empty}>
            <Ionicons name="ticket-outline" size={48} color={colors.textSecondary} />
            <Text style={styles.emptyTitle}>No coupons yet</Text>
            <Text style={styles.emptyText}>When a coupon is created for you, it will appear here.</Text>
          </View>
        ) : (
          coupons.map((coupon) => {
            const isActive = coupon.status === 'active';
            const badgeColor = isActive ? '#16A34A' : coupon.status === 'upcoming' ? '#2563EB' : '#6B7280';
            return (
              <View key={coupon._id} style={styles.card}>
                <View style={styles.topRow}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.code}>{coupon.code}</Text>
                    <Text style={styles.discount}>{coupon.discountLabel || (
                      coupon.discountType === 'percentage'
                        ? `${coupon.discountValue}% off`
                        : `₹${coupon.discountValue} off`
                    )}</Text>
                  </View>
                  <View style={[styles.badge, { backgroundColor: `${badgeColor}1F` }]}>
                    <Text style={[styles.badgeText, { color: badgeColor }]}>
                      {isActive ? 'ACTIVE' : coupon.status === 'upcoming' ? 'UPCOMING' : 'USED'}
                    </Text>
                  </View>
                </View>

                {!!coupon.description && <Text style={styles.description}>{coupon.description}</Text>}

                <View style={styles.metaRow}>
                  <View style={styles.meta}>
                    <Ionicons name="grid-outline" size={12} color={colors.textSecondary} />
                    <Text style={styles.metaText}>{scopeLabel(coupon)}</Text>
                  </View>
                  {!!coupon.minOrderValue && (
                    <View style={styles.meta}>
                      <Ionicons name="wallet-outline" size={12} color={colors.textSecondary} />
                      <Text style={styles.metaText}>Min ₹{coupon.minOrderValue}</Text>
                    </View>
                  )}
                  {typeof coupon.remainingUses === 'number' && (
                    <View style={styles.meta}>
                      <Ionicons name="repeat-outline" size={12} color={colors.textSecondary} />
                      <Text style={styles.metaText}>{coupon.remainingUses} use{coupon.remainingUses === 1 ? '' : 's'} left</Text>
                    </View>
                  )}
                </View>

                <View style={styles.dashed}>
                  <Text style={styles.expiry}>Valid till {formatDate(coupon.endDate)}</Text>
                  <TouchableOpacity
                    style={[styles.useButton, !isActive && styles.disabledButton]}
                    disabled={!isActive}
                    onPress={() => {
                      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                      router.push(routeForCoupon(coupon) as any);
                    }}
                  >
                    <Ionicons name="pricetag" size={12} color="#FFFFFF" />
                    <Text style={styles.useButtonText}>Use now</Text>
                  </TouchableOpacity>
                </View>
              </View>
            );
          })
        )}
      </ScrollView>
    </SafeAreaView>
  );
}
