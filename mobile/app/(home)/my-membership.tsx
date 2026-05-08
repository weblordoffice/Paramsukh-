import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    StatusBar,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import * as WebBrowser from 'expo-web-browser';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { useMembershipStore } from '../../store/membershipStore';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../utils/apiClient';
import { fetchPublicMembershipPlans, UIMembershipPlan } from '../../utils/membershipPlans';

const PENDING_LINK_KEY = 'pending_membership_payment_link';

/* ─── Component ──────────────────────────────────────────────────────── */
export default function MyMembershipScreen() {
    const router = useRouter();
    const scrollRef = useRef<ScrollView>(null);
    const [plansY, setPlansY] = useState<number>(0);
    const [purchasingPlanId, setPurchasingPlanId] = useState<string | null>(null);

    const { currentSubscription, fetchCurrentSubscription, isLoading } = useMembershipStore();
    const { token } = useAuthStore();

    const [purchases, setPurchases] = useState<
        {
            orderId: string;
            paymentId: string;
            amount: number;
            plan: string;
            planVariant?: string | null;
            status: string;
            date: string;
        }[]
    >([]);
    const [loadingPurchases, setLoadingPurchases] = useState(true);
    const [syncingPayment, setSyncingPayment] = useState(false);
    const [plans, setPlans] = useState<UIMembershipPlan[]>([]);

    const loadPublicPlans = useCallback(async () => {
        const dynamicPlans = await fetchPublicMembershipPlans({ includeVariants: true });
        setPlans(dynamicPlans);
    }, []);

    const loadPurchases = useCallback(async () => {
        try {
            const res = await apiClient.get('/payments/history');
            if (res.data?.success && Array.isArray(res.data?.data?.payments)) {
                setPurchases(res.data.data.payments);
            }
        } catch {
            // silently fail
        } finally {
            setLoadingPurchases(false);
        }
    }, []);

    useEffect(() => {
        if (token) {
            fetchCurrentSubscription();
            loadPurchases();
        } else {
            setLoadingPurchases(false);
        }

        loadPublicPlans();
    }, [token, fetchCurrentSubscription, loadPurchases, loadPublicPlans]);

    // If user paid and came back later, confirm any pending payment link
    useEffect(() => {
        if (!currentSubscription || currentSubscription.status === 'active') return;
        let cancelled = false;
        (async () => {
            try {
                const raw = await AsyncStorage.getItem(PENDING_LINK_KEY);
                if (!raw || cancelled) return;
                const { paymentLinkId, plan, variantSlug: pendingVariantSlug } = JSON.parse(raw);
                if (!paymentLinkId || !plan) return;
                const res = await apiClient.post('/payments/membership-link/confirm', {
                    paymentLinkId,
                    plan,
                    variantSlug: pendingVariantSlug || null,
                });
                if (res.data?.success && res.data?.data?.status === 'active') {
                    await AsyncStorage.removeItem(PENDING_LINK_KEY);
                    await fetchCurrentSubscription();
                    await loadPurchases();
                }
            } catch {
                // ignore
            }
        })();
        return () => { cancelled = true; };
    }, [currentSubscription, fetchCurrentSubscription, loadPurchases]);

    const scrollToPlans = () => {
        if (plansY > 0) {
            scrollRef.current?.scrollTo({ y: plansY, animated: true });
        }
    };

    const syncPayment = async () => {
        setSyncingPayment(true);
        try {
            const raw = await AsyncStorage.getItem(PENDING_LINK_KEY);
            if (raw) {
                const { paymentLinkId, plan, variantSlug: pendingVariantSlug } = JSON.parse(raw);
                if (paymentLinkId && plan) {
                    const res = await apiClient.post('/payments/membership-link/confirm', {
                        paymentLinkId,
                        plan,
                        variantSlug: pendingVariantSlug || null,
                    });
                    if (res.data?.success && res.data?.data?.status === 'active') {
                        await AsyncStorage.removeItem(PENDING_LINK_KEY);
                        await fetchCurrentSubscription();
                        await loadPurchases();
                        setSyncingPayment(false);
                        return;
                    }
                }
            }
            const syncRes = await apiClient.post('/payments/sync-membership');
            if (syncRes.data?.success && syncRes.data?.activated) {
                await fetchCurrentSubscription();
                await loadPurchases();
            }
        } catch {
            // ignore
        } finally {
            setSyncingPayment(false);
        }
    };

    const handlePurchase = async (plan: UIMembershipPlan) => {
        if (!token) {
            return;
        }
        const currentSelection = currentSubscription?.selectedPlan || currentSubscription?.plan;
        if (currentSelection === plan.id && currentSubscription?.status === 'active') {
            return;
        }

        setPurchasingPlanId(plan.id);

        try {
            // Create Razorpay hosted checkout URL from backend
            const linkRes = await apiClient.post('/payments/membership-link', {
                plan: plan.parentSlug,
                variantSlug: plan.variantSlug || null,
                amount: plan.price
            });

            if (!linkRes.data?.success || !linkRes.data?.data?.url) {
                setPurchasingPlanId(null);
                return;
            }

            const url = linkRes.data.data.url as string;
            const paymentLinkId = linkRes.data.data.paymentLinkId as string | undefined;

            if (paymentLinkId) {
                await AsyncStorage.setItem(PENDING_LINK_KEY, JSON.stringify({
                    paymentLinkId,
                    plan: plan.parentSlug,
                    variantSlug: plan.variantSlug || null,
                }));
            }

            await WebBrowser.openBrowserAsync(url, {
                presentationStyle: WebBrowser.WebBrowserPresentationStyle.FULL_SCREEN,
                enableBarCollapsing: true,
                showTitle: true,
            });

            if (paymentLinkId) {
                const confirmRes = await apiClient.post('/payments/membership-link/confirm', {
                    paymentLinkId,
                    plan: plan.parentSlug,
                    variantSlug: plan.variantSlug || null,
                });
                if (confirmRes.data?.success) {
                    await AsyncStorage.removeItem(PENDING_LINK_KEY);
                }
            }

            await fetchCurrentSubscription();
            await loadPurchases();
        } catch {
            // ignore
        } finally {
            setPurchasingPlanId(null);
        }
    };



    const activePlan = (currentSubscription?.selectedPlan || currentSubscription?.plan || '').toLowerCase();
    const isActive = currentSubscription?.status === 'active';
    const hasNoPlan = !activePlan || !isActive;

    /* current plan config */
    const currentPlanCfg = plans.find(p => p.id === activePlan || p.parentSlug === activePlan);

    return (
        <SafeAreaView style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor="#FDF8F3" />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => router.back()}>
                    <Ionicons name="chevron-back" size={22} color="#1F2937" />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Membership</Text>
                <View style={{ width: 38 }} />
            </View>

            <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={styles.scroll}>

                {/* ── Current status hero ── */}
                {isLoading ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="large" color="#8B5CF6" />
                    </View>
                ) : hasNoPlan ? (
                    /* No active plan */
                    <View style={styles.noPlanCard}>
                        {purchases.length > 0 ? (
                            <>
                                <Text style={styles.noPlanEmoji}>⏳</Text>
                                <Text style={styles.noPlanTitle}>Plan Expired</Text>
                                <Text style={styles.noPlanSub}>
                                    Your previous membership has ended. Renew now to regain access to premium courses and features.
                                </Text>
                            </>
                        ) : (
                            <>
                                <Text style={styles.noPlanEmoji}>🔓</Text>
                                <Text style={styles.noPlanTitle}>No Active Plan</Text>
                                <Text style={styles.noPlanSub}>
                                    You&apos;re currently on the free tier. Upgrade below to unlock courses and premium features.
                                </Text>
                            </>
                        )}
                        <TouchableOpacity
                            style={styles.upgradeCta}
                            onPress={scrollToPlans}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="arrow-up-circle" size={18} color="#fff" />
                            <Text style={styles.upgradeCtaText}>View & Buy Plans</Text>
                        </TouchableOpacity>
                        <TouchableOpacity
                            style={[styles.upgradeCta, { marginTop: 10, backgroundColor: 'rgba(148,163,184,0.3)' }]}
                            onPress={syncPayment}
                            disabled={syncingPayment}
                            activeOpacity={0.85}
                        >
                            {syncingPayment ? (
                                <ActivityIndicator size="small" color="#fff" />
                            ) : (
                                <>
                                    <Ionicons name="refresh" size={18} color="#fff" />
                                    <Text style={styles.upgradeCtaText}>I already paid – sync</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : (
                    /* Active plan hero */
                    <View
                        style={[
                            styles.activePlanCard,
                            { borderColor: currentPlanCfg?.color ?? '#8B5CF6' },
                        ]}
                    >
                        <View style={styles.activePlanTop}>
                            <Text style={styles.activePlanEmoji}>{currentPlanCfg?.emoji ?? '✨'}</Text>
                            <View style={styles.activePlanInfo}>
                                <Text style={styles.activePlanLabel}>Current Plan</Text>
                                <Text style={[styles.activePlanName, { color: currentPlanCfg?.color ?? '#8B5CF6' }]}>
                                    {currentPlanCfg?.name ?? (activePlan ? activePlan.charAt(0).toUpperCase() + activePlan.slice(1) : 'Unknown')}
                                </Text>
                                <Text style={styles.activePlanTagline}>{currentPlanCfg?.tagline}</Text>
                            </View>
                            {/* Status badge */}
                            <View
                                style={[
                                    styles.statusBadge,
                                    { 
                                        backgroundColor: isActive ? '#F0FDF4' : '#FFFBEB',
                                        borderColor: isActive ? '#10B981' : '#F59E0B'
                                    },
                                ]}
                            >
                                <View style={[styles.statusDot, { backgroundColor: isActive ? '#10B981' : '#F59E0B' }]} />
                                <Text style={[styles.statusText, { color: isActive ? '#10B981' : '#D97706' }]}>
                                    Active
                                </Text>
                            </View>
                        </View>

                        {/* Included features */}
                        {currentPlanCfg && (
                            <View style={styles.activePlanFeatures}>
                                <Text style={styles.featuresLabel}>What&apos;s included</Text>
                                {currentPlanCfg.features.filter(f => f.included).map((f, i) => (
                                    <View key={i} style={styles.featureRow}>
                                        <Ionicons name="checkmark-circle" size={18} color={currentPlanCfg.color} />
                                        <Text style={styles.featureText}>{f.text}</Text>
                                    </View>
                                ))}
                            </View>
                        )}

                        <TouchableOpacity
                            style={[styles.manageBtn, { backgroundColor: currentPlanCfg?.color ?? '#8B5CF6' }]}
                            onPress={scrollToPlans}
                            activeOpacity={0.85}
                        >
                            <Ionicons name="arrow-up-circle" size={17} color="#fff" />
                            <Text style={styles.manageBtnText}>Upgrade / Manage Plan</Text>
                        </TouchableOpacity>
                    </View>
                )}

                {/* ── All available plans ── */}
                <Text
                    style={styles.sectionTitle}
                    onLayout={(e) => setPlansY(e.nativeEvent.layout.y)}
                >
                    All Plans
                </Text>

                {plans.length === 0 && (
                    <View style={styles.noPlansCard}>
                        <Ionicons name="information-circle-outline" size={18} color="#6B7280" />
                        <Text style={styles.noPlansText}>No membership plans are available right now. Please check again later.</Text>
                    </View>
                )}

                {plans.map(plan => {
                    const planId = plan.id.toLowerCase().trim();
                    const currentPlanId = activePlan ? activePlan.toLowerCase().trim() : '';
                    const isCurrentPlan = currentPlanId === planId && isActive;
                    const isAlreadyPurchased = purchases.some(p => {
                        const purchasePlan = p.plan ? p.plan.toLowerCase().trim() : '';
                        const purchaseVariant = p.planVariant ? p.planVariant.toLowerCase().trim() : '';
                        const purchaseKey = purchaseVariant ? `${purchasePlan}::${purchaseVariant}` : purchasePlan;
                        return purchaseKey === planId && p.status === 'completed';
                    });
                    
                    return (
                        <View
                            key={plan.id}
                            style={[
                                styles.planCard,
                                isCurrentPlan && { borderColor: plan.color, borderWidth: 2 },
                            ]}
                        >
                            {/* Active badge for current plan */}
                            {isCurrentPlan && (
                                <View style={[styles.activeBadge, { backgroundColor: plan.color }]}>
                                    <Ionicons name="checkmark-circle" size={14} color="#fff" />
                                    <Text style={styles.activeBadgeText}>ACTIVE</Text>
                                </View>
                            )}
                            
                            
                            {/* Popular ribbon */}
                            {plan.popular && (
                                <View style={[styles.popularRibbon, { backgroundColor: plan.color }]}>
                                    <Ionicons name="star" size={10} color="#fff" />
                                    <Text style={styles.popularText}>MOST POPULAR</Text>
                                </View>
                            )}

                            {/* Plan header row */}
                            <View style={styles.planHeaderRow}>
                                <Text style={styles.planEmoji}>{plan.emoji}</Text>
                                <View style={styles.planTitleBlock}>
                                    <Text style={[styles.planName, { color: plan.color }]}>{plan.name}</Text>
                                    <Text style={styles.planTagline}>{plan.tagline}</Text>
                                </View>
                                <View style={styles.planPriceBlock}>
                                    <Text style={[styles.planPrice, { color: plan.color }]}>
                                        ₹{plan.price.toLocaleString('en-IN')}
                                    </Text>
                                    {isCurrentPlan && (
                                        <View style={[styles.currentChip, { backgroundColor: plan.color + '22', borderColor: plan.color }]}>
                                            <Ionicons name="checkmark-circle" size={12} color={plan.color} />
                                            <Text style={[styles.currentChipText, { color: plan.color }]}>Current Plan</Text>
                                        </View>
                                    )}
                                </View>
                            </View>

                            {/* Divider */}
                            <View style={styles.planDivider} />

                            {/* Features */}
                            {plan.features.map((f, i) => (
                                <View key={i} style={styles.planFeatureRow}>
                                    <View
                                        style={[
                                            styles.checkCircle,
                                            { backgroundColor: f.included ? plan.color + '22' : 'rgba(148,163,184,0.12)' },
                                        ]}
                                    >
                                        <Ionicons
                                            name={f.included ? 'checkmark' : 'close'}
                                            size={11}
                                            color={f.included ? plan.color : '#475569'}
                                        />
                                    </View>
                                    <Text
                                        style={[
                                            styles.planFeatureText,
                                            !f.included && styles.planFeatureTextMuted,
                                        ]}
                                    >
                                        {f.text}
                                    </Text>
                                </View>
                            ))}

                            {/* Buy button or Active indicator */}
                            {!isCurrentPlan && !isAlreadyPurchased && (
                                <TouchableOpacity
                                    style={[styles.buyBtn, { borderColor: plan.color }]}
                                    onPress={() => handlePurchase(plan)}
                                    activeOpacity={0.8}
                                    disabled={purchasingPlanId !== null}
                                >
                                    {purchasingPlanId === plan.id ? (
                                        <ActivityIndicator color={plan.color} />
                                    ) : (
                                        <Text style={[styles.buyBtnText, { color: plan.color }]}>
                                            Get {plan.name} →
                                        </Text>
                                    )}
                                </TouchableOpacity>
                            )}
                            
                            {/* Show purchased indicator for non-current purchased plans */}
                            {isAlreadyPurchased && !isCurrentPlan && (
                                <View style={[styles.purchasedIndicator, { borderColor: plan.color }]}>
                                    <Ionicons name="shield-checkmark" size={16} color={plan.color} />
                                    <Text style={[styles.purchasedText, { color: plan.color }]}>Previously Purchased</Text>
                                </View>
                            )}
                        </View>
                    );
                })}

                {/* ── Purchase history ── */}
                <Text style={[styles.sectionTitle, { marginTop: 8 }]}>Purchase History</Text>
                <Text style={styles.refundNote}>⚠️  All purchases are non-refundable.</Text>

                {loadingPurchases ? (
                    <View style={styles.loadingBox}>
                        <ActivityIndicator size="small" color="#8B5CF6" />
                    </View>
                ) : purchases.length === 0 ? (
                    <View style={styles.emptyBox}>
                        <Ionicons name="receipt-outline" size={40} color="#334155" />
                        <Text style={styles.emptyTitle}>No purchases yet</Text>
                        <Text style={styles.emptySub}>Membership payments will appear here</Text>
                    </View>
                ) : (
                    <View style={styles.purchaseList}>
                        {purchases.map((p, idx) => {
                            const pc = plans.find(pl => pl.id === p.plan?.toLowerCase());
                            const done = p.status === 'completed';
                            return (
                                <View key={p.paymentId || idx} style={styles.purchaseRow}>
                                    <View style={[styles.purchaseIcon, { backgroundColor: (pc?.color ?? '#8B5CF6') + '22' }]}>
                                        <Text style={{ fontSize: 20 }}>{pc?.emoji ?? '💳'}</Text>
                                    </View>
                                    <View style={styles.purchaseInfo}>
                                        <Text style={styles.purchasePlan}>
                                            {pc?.name ?? (p.plan ? p.plan.charAt(0).toUpperCase() + p.plan.slice(1) : 'Purchase')} Plan
                                        </Text>
                                        <Text style={styles.purchaseDate}>
                                            {p.date ? new Date(p.date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' }) : '—'}
                                        </Text>
                                    </View>
                                    <View style={styles.purchaseRight}>
                                        <Text style={styles.purchaseAmt}>
                                            ₹{typeof p.amount === 'number' ? p.amount.toLocaleString('en-IN') : p.amount}
                                        </Text>
                                        <View style={[styles.purchaseStatusBadge, { 
                                            backgroundColor: done ? '#F0FDF4' : '#F3F4F6',
                                            borderColor: done ? '#10B981' : '#D1D5DB',
                                            borderWidth: 1
                                        }]}>
                                            <Text style={[styles.purchaseStatusText, { color: done ? '#10B981' : '#6B7280' }]}>
                                                {p.status || 'completed'}
                                            </Text>
                                        </View>
                                    </View>
                                </View>
                            );
                        })}
                    </View>
                )}

                <View style={{ height: 60 }} />
            </ScrollView>
        </SafeAreaView>
    );
}

/* ─── Styles ─────────────────────────────────────────────────────────── */
const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: '#FDF8F3' },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937', letterSpacing: 0.3 },
    backBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: '#FFFFFF',
        alignItems: 'center', justifyContent: 'center',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.1,
        shadowRadius: 4,
        elevation: 2,
    },

    scroll: { paddingHorizontal: 16, paddingTop: 4 },
    loadingBox: { paddingVertical: 32, alignItems: 'center' },

    /* ── No Plan card ── */
    noPlanCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    noPlanEmoji: { fontSize: 44, marginBottom: 12 },
    noPlanTitle: { fontSize: 20, fontWeight: '700', color: '#1F2937', marginBottom: 8 },
    noPlanSub: { fontSize: 14, color: '#6B7280', textAlign: 'center', lineHeight: 21, marginBottom: 20 },
    upgradeCta: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, backgroundColor: '#7C3AED',
        paddingVertical: 13, paddingHorizontal: 28, borderRadius: 14,
    },
    upgradeCtaText: { fontSize: 15, fontWeight: '700', color: '#fff' },

    /* ── Active plan card ── */
    activePlanCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 20,
        marginBottom: 24,
        borderWidth: 2,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.08,
        shadowRadius: 12,
        elevation: 4,
    },
    activePlanTop: { flexDirection: 'row', alignItems: 'center', gap: 16, marginBottom: 18 },
    activePlanEmoji: { fontSize: 42 },
    activePlanInfo: { flex: 1 },
    activePlanLabel: { fontSize: 12, color: '#6B7280', fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
    activePlanName: { fontSize: 28, fontWeight: '800', lineHeight: 32, color: '#1F2937' },
    activePlanTagline: { fontSize: 13, color: '#6B7280', marginTop: 3, fontWeight: '500' },
    statusBadge: {
        flexDirection: 'row', alignItems: 'center', gap: 6,
        paddingHorizontal: 12, paddingVertical: 6, borderRadius: 20,
        borderWidth: 1,
    },
    statusDot: { width: 7, height: 7, borderRadius: 4 },
    statusText: { fontSize: 12, fontWeight: '700' },
    activePlanFeatures: { 
        marginBottom: 18,
        paddingVertical: 12,
        borderTopWidth: 1,
        borderTopColor: '#F3F4F6',
    },
    featuresLabel: {
        fontSize: 12, fontWeight: '700', color: '#374151',
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12,
    },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    featureText: { fontSize: 14, color: '#4B5563', flex: 1, fontWeight: '500' },
    manageBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 14, borderRadius: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.15,
        shadowRadius: 6,
        elevation: 3,
    },
    manageBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

    /* ── Section title ── */
    sectionTitle: { fontSize: 19, fontWeight: '700', color: '#1F2937', marginBottom: 14 },
    noPlansCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: '#FFFFFF',
        borderRadius: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        padding: 14,
        marginBottom: 12,
    },
    noPlansText: { fontSize: 14, color: '#6B7280', flex: 1 },

    /* ── Plan cards ── */
    planCard: {
        backgroundColor: '#FFFFFF',
        borderRadius: 20,
        padding: 18,
        marginBottom: 14,
        borderWidth: 1,
        borderColor: '#E5E7EB',
        position: 'relative',
        overflow: 'hidden',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 6,
        elevation: 2,
    },
    popularRibbon: {
        position: 'absolute', top: 14, right: -1,
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 4,
        borderTopLeftRadius: 8, borderBottomLeftRadius: 8,
    },
    popularText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
    activeBadge: {
        position: 'absolute',
        top: 14,
        left: -1,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 10,
        paddingVertical: 4,
        borderTopRightRadius: 8,
        borderBottomRightRadius: 8,
        zIndex: 10,
    },
    activeBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.5 },
    planHeaderRow: {
        flexDirection: 'row', alignItems: 'center', gap: 14, marginBottom: 14,
    },
    planEmoji: { fontSize: 34 },
    planTitleBlock: { flex: 1 },
    planName: { fontSize: 22, fontWeight: '800', color: '#1F2937' },
    planTagline: { fontSize: 12, color: '#6B7280', marginTop: 3, fontWeight: '500' },
    planPriceBlock: { alignItems: 'flex-end' },
    planPrice: { fontSize: 18, fontWeight: '800' },
    currentChip: {
        flexDirection: 'row', alignItems: 'center', gap: 4,
        paddingHorizontal: 10, paddingVertical: 4, borderRadius: 20, borderWidth: 1.5,
        marginTop: 6,
    },
    currentChipText: { fontSize: 11, fontWeight: '700' },
    planDivider: { height: 1, backgroundColor: '#E5E7EB', marginBottom: 14 },
    planFeatureRow: {
        flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 5,
    },
    checkCircle: {
        width: 20, height: 20, borderRadius: 10,
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    planFeatureText: { fontSize: 14, color: '#374151', flex: 1, fontWeight: '500' },
    planFeatureTextMuted: { color: '#9CA3AF', textDecorationLine: 'line-through' },
    buyBtn: {
        marginTop: 14, paddingVertical: 11, borderRadius: 12,
        borderWidth: 1.5, alignItems: 'center',
    },
    buyBtnText: { fontSize: 14, fontWeight: '700' },
    purchasedIndicator: {
        marginTop: 14,
        paddingVertical: 11,
        borderRadius: 12,
        borderWidth: 1.5,
        borderColor: '#10B981',
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    purchasedText: { fontSize: 14, fontWeight: '700' },

    /* ── Purchase history ── */
    refundNote: { fontSize: 13, color: '#F59E0B', marginBottom: 14, fontWeight: '500' },
    emptyBox: { alignItems: 'center', paddingVertical: 32, gap: 10 },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: '#374151' },
    emptySub: { fontSize: 14, color: '#6B7280' },

    purchaseList: { gap: 12 },
    purchaseRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: '#FFFFFF', borderRadius: 16,
        padding: 16, gap: 14,
        borderWidth: 1, borderColor: '#E5E7EB',
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    purchaseIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    purchaseInfo: { flex: 1 },
    purchasePlan: { fontSize: 15, fontWeight: '700', color: '#1F2937' },
    purchaseDate: { fontSize: 13, color: '#6B7280', marginTop: 3 },
    purchaseRight: { alignItems: 'flex-end' },
    purchaseAmt: { fontSize: 16, fontWeight: '700', color: '#1F2937' },
    purchaseStatusBadge: { marginTop: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    purchaseStatusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },
});
