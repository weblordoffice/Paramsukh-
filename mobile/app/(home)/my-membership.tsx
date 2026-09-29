import React, { useEffect, useRef, useState, useCallback } from 'react';
import {
    View,
    Text,
    ScrollView,
    TouchableOpacity,
    StyleSheet,
    ActivityIndicator,
    StatusBar,
    Modal,
    FlatList,
    Image,
    Platform,
    Alert,
} from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { openPaymentLink, savePendingPaymentLink, clearPendingPaymentLinks } from '../../utils/paymentBrowser';
import { isRazorpayNativeAvailable, payWithRazorpayNative, buildPrefill } from '../../utils/razorpayNative';
import { useMembershipStore } from '../../store/membershipStore';
import { useAuthStore } from '../../store/authStore';
import apiClient from '../../utils/apiClient';
import { fetchPublicMembershipPlans, fetchEligibleCoursePreviews, UIMembershipPlan, EligibleCoursePreview, PENDING_MEMBERSHIP_LINK_KEY } from '../../utils/membershipPlans';
import { useBottomTabBarHeight } from '../../hooks/useBottomTabBarHeight';
import { useTheme } from '../../hooks/useTheme';

const PENDING_LINK_KEY = PENDING_MEMBERSHIP_LINK_KEY;
const PRE_SELECT_KEY = 'preselected_courses';

// Single accent for the membership surface — carried by the one primary CTA per card.
const ACCENT = '#7C3AED';
const ACCENT_SOFT = '#F5F3FF';

/* ─── Component ──────────────────────────────────────────────────────── */
export default function MyMembershipScreen() {
  const { colors } = useTheme();
  const styles = StyleSheet.create({
    root: { flex: 1, backgroundColor: colors.background },

    header: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'space-between',
        paddingHorizontal: 16,
        paddingVertical: 14,
    },
    headerTitle: { fontSize: 20, fontWeight: '700', color: colors.text, letterSpacing: 0.3 },
    backBtn: {
        width: 38, height: 38, borderRadius: 19,
        backgroundColor: colors.surface,
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
        backgroundColor: colors.surface,
        borderRadius: 20,
        padding: 24,
        alignItems: 'center',
        marginBottom: 24,
        borderWidth: 1,
        borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.05,
        shadowRadius: 8,
        elevation: 3,
    },
    noPlanEmoji: { fontSize: 44, marginBottom: 12 },
    noPlanTitle: { fontSize: 20, fontWeight: '700', color: colors.text, marginBottom: 8 },
    noPlanSub: { fontSize: 14, color: colors.textSecondary, textAlign: 'center', lineHeight: 21, marginBottom: 20 },
    upgradeCta: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, backgroundColor: '#7C3AED',
        paddingVertical: 14, paddingHorizontal: 28, borderRadius: 14,
        shadowColor: '#7C3AED',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.3,
        shadowRadius: 8,
        elevation: 4,
        width: '100%',
    },
    upgradeCtaSecondary: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8,
        paddingVertical: 12, paddingHorizontal: 28, borderRadius: 14,
        borderWidth: 1.5, borderColor: colors.border,
        backgroundColor: colors.background,
        width: '100%',
    },
    upgradeCtaSecondaryText: { fontSize: 14, fontWeight: '600', color: colors.textSecondary },
    upgradeCtaText: { fontSize: 15, fontWeight: '700', color: '#fff' },

    /* ── Active plan card ── */
    activePlanCard: {
        backgroundColor: colors.surface,
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
    activePlanLabel: { fontSize: 12, color: colors.textSecondary, fontWeight: '600', textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 3 },
    activePlanName: { fontSize: 28, fontWeight: '800', lineHeight: 32, color: colors.text },
    activePlanTagline: { fontSize: 13, color: colors.textSecondary, marginTop: 3, fontWeight: '500' },
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
        borderTopColor: colors.surfaceSecondary,
    },
    featuresLabel: {
        fontSize: 12, fontWeight: '700', color: colors.text,
        textTransform: 'uppercase', letterSpacing: 0.5, marginBottom: 12,
    },
    featureRow: { flexDirection: 'row', alignItems: 'center', gap: 10, paddingVertical: 6 },
    featureText: { fontSize: 14, color: '#4B5563', flex: 1, fontWeight: '500' },
    manageBtn: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, paddingVertical: 14, borderRadius: 14,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 3 },
        shadowOpacity: 0.18,
        shadowRadius: 8,
        elevation: 4,
    },
    manageBtnText: { fontSize: 15, fontWeight: '700', color: '#fff' },

    courseSelectBtn: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 8,
        paddingVertical: 13,
        paddingHorizontal: 16,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: '#8B5CF6',
        backgroundColor: '#F5F3FF',
        marginTop: 12,
    },
    courseSelectBtnText: { fontSize: 14, fontWeight: '600', color: '#8B5CF6' },
    courseSelectDone: {
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
        paddingVertical: 10,
        marginTop: 8,
    },
    courseSelectDoneText: { fontSize: 13, color: '#22C55E', fontWeight: '500' },

    /* ── Section title ── */
    sectionTitle: { fontSize: 19, fontWeight: '700', color: colors.text, marginBottom: 14 },
    noPlansCard: {
        flexDirection: 'row',
        alignItems: 'center',
        gap: 10,
        backgroundColor: colors.surface,
        borderRadius: 14,
        borderWidth: 1,
        borderColor: colors.border,
        padding: 14,
        marginBottom: 12,
    },
    noPlansText: { fontSize: 14, color: colors.textSecondary, flex: 1 },

    /* ── Plan cards ── */
    planCard: {
        backgroundColor: colors.surface,
        borderRadius: 18,
        padding: 18,
        marginBottom: 14,
        borderWidth: 1.5,
        borderColor: colors.border,
        overflow: 'hidden',
    },
    planCardCurrent: { borderColor: ACCENT },
    activeBadge: {
        position: 'absolute',
        top: 0,
        left: 0,
        flexDirection: 'row',
        alignItems: 'center',
        gap: 4,
        paddingHorizontal: 12,
        paddingVertical: 5,
        borderBottomRightRadius: 12,
        backgroundColor: ACCENT,
    },
    activeBadgeText: { fontSize: 10, fontWeight: '800', color: '#fff', letterSpacing: 0.6 },
    planHeaderRow: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 12, marginBottom: 2,
    },
    planEmoji: { fontSize: 30 },
    planTitleBlock: { flex: 1, paddingRight: 6 },
    planName: { fontSize: 20, fontWeight: '800', color: colors.text, letterSpacing: 0.1 },
    planTagline: { fontSize: 12.5, color: colors.textSecondary, marginTop: 4, lineHeight: 17, fontWeight: '500' },
    planPriceBlock: { alignItems: 'flex-end' },
    planPrice: { fontSize: 24, fontWeight: '900', color: colors.text, letterSpacing: -0.3 },
    planPriceCaption: { fontSize: 11, color: colors.textSecondary, fontWeight: '600', marginTop: 2 },
    planDivider: { height: 1, backgroundColor: colors.border, marginTop: 14, marginBottom: 12 },
    planFeatureRow: {
        flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 5,
    },
    checkCircle: {
        width: 18, height: 18, borderRadius: 9, marginTop: 1,
        alignItems: 'center', justifyContent: 'center', flexShrink: 0,
    },
    planFeatureText: { fontSize: 13.5, color: colors.text, flex: 1, fontWeight: '500', lineHeight: 19 },
    planFeatureTextMuted: { color: colors.textSecondary, textDecorationLine: 'line-through', fontWeight: '400' },
    featureMore: { fontSize: 12.5, color: colors.textSecondary, fontWeight: '500', marginTop: 6, marginLeft: 28 },

    /* ── Card CTA ── */
    primaryCta: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 8, height: 52, borderRadius: 14, marginTop: 16, backgroundColor: ACCENT,
    },
    primaryCtaText: { fontSize: 16, fontWeight: '800', color: '#fff', letterSpacing: 0.2 },
    ctaLinksRow: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        flexWrap: 'wrap', gap: 4, marginTop: 4, marginBottom: -6,
    },
    ctaLink: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, minHeight: 44, paddingHorizontal: 10,
    },
    ctaLinkText: { fontSize: 13, color: colors.textSecondary, fontWeight: '600' },

    /* ── Value line + preview videos ── */
    valueRow: {
        flexDirection: 'row', alignItems: 'center', gap: 8,
        backgroundColor: ACCENT_SOFT, borderRadius: 12,
        paddingHorizontal: 12, paddingVertical: 10, marginBottom: 14,
    },
    valueText: { fontSize: 13.5, fontWeight: '700', color: ACCENT, flex: 1 },
    previewStrip: { marginBottom: 14, marginHorizontal: -2 },
    previewStripContent: { gap: 10, paddingHorizontal: 2 },
    previewVideoCard: { width: 132 },
    previewVideoThumb: { width: 132, height: 78, borderRadius: 12, backgroundColor: '#111827' },
    previewVideoThumbFallback: { alignItems: 'center', justifyContent: 'center', backgroundColor: ACCENT },
    previewPlayBadge: {
        position: 'absolute', top: 27, left: 54,
        width: 24, height: 24, borderRadius: 12,
        backgroundColor: 'rgba(0,0,0,0.55)',
        alignItems: 'center', justifyContent: 'center',
    },
    previewVideoTitle: { fontSize: 12, fontWeight: '600', color: colors.text, marginTop: 6, lineHeight: 16 },
    previewRowMain: { flex: 1, flexDirection: 'row', alignItems: 'center', gap: 10 },
    previewRowView: { paddingHorizontal: 4 },

    planStateNote: {
        flexDirection: 'row', alignItems: 'center', justifyContent: 'center',
        gap: 6, height: 52, marginTop: 16, borderRadius: 14,
        backgroundColor: colors.surfaceSecondary,
    },
    planStateNoteText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },

    purchasedIndicator: {
        marginTop: 16,
        height: 52,
        borderRadius: 14,
        borderWidth: 1.5,
        borderColor: colors.border,
        flexDirection: 'row',
        alignItems: 'center',
        justifyContent: 'center',
        gap: 6,
    },
    purchasedText: { fontSize: 14, fontWeight: '700', color: colors.textSecondary },

    /* ── Purchase history ── */
    refundNote: { fontSize: 13, color: '#F59E0B', marginBottom: 14, fontWeight: '500' },
    emptyBox: { alignItems: 'center', paddingVertical: 32, gap: 10 },
    emptyTitle: { fontSize: 17, fontWeight: '700', color: colors.text },
    emptySub: { fontSize: 14, color: colors.textSecondary },

    purchaseList: { gap: 12 },
    purchaseRow: {
        flexDirection: 'row', alignItems: 'center',
        backgroundColor: colors.surface, borderRadius: 16,
        padding: 16, gap: 14,
        borderWidth: 1, borderColor: colors.border,
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 2 },
        shadowOpacity: 0.04,
        shadowRadius: 4,
        elevation: 2,
    },
    purchaseIcon: { width: 46, height: 46, borderRadius: 12, alignItems: 'center', justifyContent: 'center', flexShrink: 0 },
    purchaseInfo: { flex: 1 },
    purchasePlan: { fontSize: 15, fontWeight: '700', color: colors.text },
    purchaseDate: { fontSize: 13, color: colors.textSecondary, marginTop: 3 },
    purchaseRight: { alignItems: 'flex-end' },
    purchaseAmt: { fontSize: 16, fontWeight: '700', color: colors.text },
    purchaseStatusBadge: { marginTop: 5, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
    purchaseStatusText: { fontSize: 11, fontWeight: '700', textTransform: 'capitalize' },

    // Modal
    modalOverlay: {
        flex: 1,
        backgroundColor: 'rgba(0,0,0,0.5)',
        justifyContent: 'flex-end',
    },
    modalContainer: {
        backgroundColor: colors.surface,
        borderTopLeftRadius: 24,
        borderTopRightRadius: 24,
        padding: 20,
        maxHeight: '80%',
    },
    modalHeader: {
        flexDirection: 'row',
        justifyContent: 'space-between',
        alignItems: 'center',
        marginBottom: 4,
    },
    modalTitle: { fontSize: 18, fontWeight: '700', color: colors.text },
    modalSub: { fontSize: 13, color: colors.textSecondary, marginTop: 4, marginBottom: 12 },
    modalCloseBtn: { padding: 4 },
    modalEmpty: { textAlign: 'center', fontSize: 14, color: colors.textSecondary, marginTop: 20 },
    modalDoneBtn: {
        backgroundColor: '#8B5CF6',
        borderRadius: 12,
        paddingVertical: 14,
        alignItems: 'center',
        marginTop: 12,
    },
    modalDoneBtnText: { color: '#FFF', fontWeight: '700', fontSize: 15 },
    previewCourseRow: {
        flexDirection: 'row',
        alignItems: 'center',
        paddingVertical: 10,
        paddingHorizontal: 4,
        borderBottomWidth: 1,
        borderBottomColor: colors.surfaceSecondary,
        gap: 10,
    },
    previewThumb: {
        width: 40,
        height: 40,
        borderRadius: 10,
        alignItems: 'center',
        justifyContent: 'center',
    },
    previewCourseTitle: { fontSize: 14, fontWeight: '600', color: colors.text },
    previewCourseMeta: { fontSize: 12, color: colors.textSecondary, marginTop: 2 },
    previewRowSelected: { backgroundColor: '#F0FDF4' },
    previewRowDisabled: { opacity: 0.4 },
});
    const router = useRouter();
    const insets = useSafeAreaInsets();
    const bottomTabHeight = useBottomTabBarHeight();
    const scrollRef = useRef<ScrollView>(null);
    const [plansY, setPlansY] = useState<number>(0);
    const [purchasingPlanId, setPurchasingPlanId] = useState<string | null>(null);
    const [activeMembership, setActiveMembership] = useState<{
        membershipId: string;
        courseSelection: { enabled: boolean; maxSelectable: number; remaining: number; used: number };
    } | null>(null);

    const { currentSubscription, fetchCurrentSubscription, isLoading, createMembershipOrder, verifyMembershipPayment } = useMembershipStore();
    const { token } = useAuthStore();

    const [purchases, setPurchases] = useState<
        {
            orderId: string;
            paymentId: string;
            amount: number;
            plan: string;
            status: string;
            date: string;
        }[]
    >([]);
    const [loadingPurchases, setLoadingPurchases] = useState(true);
    const [syncingPayment, setSyncingPayment] = useState(false);
    const [plans, setPlans] = useState<UIMembershipPlan[]>([]);
    const [plansLoading, setPlansLoading] = useState(true);

    // Included-courses sheet (entitlement plans have no picker)
    const [coursesSheetPlan, setCoursesSheetPlan] = useState<UIMembershipPlan | null>(null);
    const [coursesSheetList, setCoursesSheetList] = useState<EligibleCoursePreview[]>([]);
    const [coursesSheetLoading, setCoursesSheetLoading] = useState(false);

    // Pre-selection state (#7)
    const [preSelectingPlanId, setPreSelectingPlanId] = useState<string | null>(null);
    const [preSelectedCourseIds, setPreSelectedCourseIds] = useState<string[]>([]);
    const [preSelectCourses, setPreSelectCourses] = useState<EligibleCoursePreview[]>([]);
    const [preSelectLoading, setPreSelectLoading] = useState(false);
    const [showPreSelectModal, setShowPreSelectModal] = useState(false);

    const openCoursesSheet = async (plan: UIMembershipPlan) => {
        setCoursesSheetPlan(plan);
        setCoursesSheetLoading(true);
        setCoursesSheetList([]);
        try {
            const courses = await fetchEligibleCoursePreviews(plan.parentSlug);
            setCoursesSheetList(courses);
        } catch {}
        setCoursesSheetLoading(false);
    };

    const closeCoursesSheet = () => {
        setCoursesSheetPlan(null);
        setCoursesSheetList([]);
    };

    const openCoursePreview = (courseId: string, title: string, color?: string, duration?: string) => {
        router.push({
            pathname: '/course-detail',
            params: { id: courseId, title: title || '', color: color || '#8B5CF6', duration: duration || '', preview: '1' },
        });
    };

    const openPreSelect = async (plan: UIMembershipPlan) => {
        if (!plan.courseSelection?.enabled) return;
        setPreSelectingPlanId(plan.id);
        setPreSelectedCourseIds([]);
        setPreSelectCourses([]);
        setPreSelectLoading(true);
        setShowPreSelectModal(true);
        try {
            const courses = await fetchEligibleCoursePreviews(plan.parentSlug);
            setPreSelectCourses(courses);
        } catch {}
        setPreSelectLoading(false);
    };

    const togglePreSelectCourse = (courseId: string) => {
        setPreSelectedCourseIds((prev) => {
            if (prev.includes(courseId)) {
                return prev.filter((id) => id !== courseId);
            }
            const plan = plans.find((p) => p.id === preSelectingPlanId);
            const max = plan?.courseSelection?.maxSelectableCourses || 3;
            if (prev.length >= max) return prev;
            return [...prev, courseId];
        });
    };

    const confirmPreSelect = async () => {
        if (!preSelectingPlanId) return;
        const plan = plans.find((p) => p.id === preSelectingPlanId);
        if (!plan) return;

        setShowPreSelectModal(false);

        await AsyncStorage.setItem(PRE_SELECT_KEY, JSON.stringify({
            planSlug: plan.parentSlug,
            courseIds: preSelectedCourseIds,
        }));

        await handlePurchase(plan);
    };

    const loadPublicPlans = useCallback(async () => {
        setPlansLoading(true);
        const dynamicPlans = await fetchPublicMembershipPlans();
        setPlans(dynamicPlans);
        setPlansLoading(false);
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
            fetchActiveMembershipInfo();
        } else {
            setLoadingPurchases(false);
        }

        loadPublicPlans();
    }, [token, fetchCurrentSubscription, loadPurchases, loadPublicPlans]);

    const fetchActiveMembershipInfo = async () => {
        try {
            const { data } = await apiClient.get('/membership/active');
            if (data.success && data.hasActiveMembership) {
                setActiveMembership({
                    membershipId: data.membershipId,
                    courseSelection: data.courseSelection,
                });
                return data.courseSelection;
            }
        } catch {
            // silently fail
        }
        return null;
    };

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

    const readPreSelectedCourseIds = async (planSlug: string): Promise<string[]> => {
        try {
            const raw = await AsyncStorage.getItem(PRE_SELECT_KEY);
            if (!raw) return [];
            const parsed = JSON.parse(raw);
            if (parsed?.planSlug === planSlug && Array.isArray(parsed.courseIds)) {
                return parsed.courseIds.filter(Boolean).map((id: any) => String(id));
            }
        } catch {}
        return [];
    };

    const handlePurchase = async (plan: UIMembershipPlan) => {
        if (!token || purchasingPlanId) {
            return;
        }
        const currentSelection = currentSubscription?.selectedPlan || currentSubscription?.plan;
        if (currentSelection === plan.id && currentSubscription?.status === 'active') {
            return;
        }

        setPurchasingPlanId(plan.id);

        try {
            const callbackUrl = 'paramsukh://payment-done';
            const selectedCourseIds = await readPreSelectedCourseIds(plan.parentSlug);

            // Preferred: native Razorpay SDK checkout (no WebView/browser)
            if (isRazorpayNativeAvailable()) {
                const orderRes = await createMembershipOrder(plan.parentSlug, selectedCourseIds);
                if (orderRes.success && orderRes.orderId && orderRes.keyId) {
                    const payResult = await payWithRazorpayNative(
                        {
                            keyId: orderRes.keyId,
                            orderId: orderRes.orderId,
                            amount: orderRes.amount!,
                            currency: orderRes.currency || 'INR',
                        },
                        {
                            description: `${plan.name} Membership`,
                            prefill: buildPrefill(useAuthStore.getState().user),
                            notes: { type: 'membership', plan: plan.parentSlug },
                        }
                    );

                    if (payResult.status === 'success') {
                        const verify = await verifyMembershipPayment({
                            razorpay_order_id: payResult.orderId,
                            razorpay_payment_id: payResult.paymentId,
                            razorpay_signature: payResult.signature,
                            plan: plan.parentSlug,
                            selectedCourseIds,
                        });
                        if (verify.success) {
                            await AsyncStorage.removeItem(PENDING_LINK_KEY);
                            await AsyncStorage.removeItem(PRE_SELECT_KEY);
                        }
                        await fetchCurrentSubscription();
                        await loadPurchases();
                        const courseSelection = await fetchActiveMembershipInfo();
                        if (verify.success) {
                            if (plan.courseSelection?.enabled && courseSelection?.remaining && courseSelection.remaining > 0) {
                                router.push({
                                    pathname: '/(home)/choose-courses',
                                    params: {
                                        membershipId: activeMembership?.membershipId || '',
                                        maxSelectable: String(courseSelection.maxSelectable),
                                    },
                                });
                            } else {
                                Alert.alert('Success', `${plan.name} membership is now active.`);
                            }
                        } else {
                            Alert.alert('Payment Verification', verify.message || 'Payment received but verification failed. Please try syncing payment.');
                        }
                        return;
                    }
                    if (payResult.status === 'cancelled') {
                        Alert.alert('Payment Cancelled', 'Your membership was not activated. You can try again.');
                        return;
                    }
                    // Native checkout errored — fall through to the browser-based payment-link flow below
                }
            }

            const linkRes = await apiClient.post('/payments/membership-link', {
                plan: plan.parentSlug,
                variantSlug: plan.variantSlug || null,
                amount: plan.price,
                callbackUrl,
                selectedCourseIds,
            });

            if (!linkRes.data?.success || !linkRes.data?.data?.url) {
                console.warn('[Membership] Payment link creation failed', linkRes.data);
                Alert.alert('Error', linkRes.data?.message || 'Could not create payment link. Please try again.');
                return;
            }

            const url = linkRes.data.data.url as string;
            const paymentLinkId = linkRes.data.data.paymentLinkId as string | undefined;
            const expiresAt = linkRes.data.data.expiresAt as string | undefined;
            const pendingPayload = {
                paymentLinkId,
                plan: plan.parentSlug,
                variantSlug: plan.variantSlug || null,
            };

            if (paymentLinkId) {
                await AsyncStorage.setItem(PENDING_LINK_KEY, JSON.stringify(pendingPayload));
                await savePendingPaymentLink({
                    type: 'membership',
                    id: plan.parentSlug,
                    paymentLinkId,
                    url,
                    expiresAt,
                    confirmPayload: pendingPayload,
                });
            }

            const openResult = await openPaymentLink({
                url,
                useAuthSession: true,
                callbackUrl,
                confirm: async () => {
                    const res = await apiClient.post('/payments/membership-link/confirm', pendingPayload);
                    return {
                        success: !!res.data?.success && (res.data?.data?.status === 'active' || res.data?.data?.status === 'paid'),
                        data: res.data?.data,
                        message: res.data?.message,
                    };
                },
            });

            if (openResult.success) {
                await AsyncStorage.removeItem(PENDING_LINK_KEY);
                await AsyncStorage.removeItem(PRE_SELECT_KEY);
                await clearPendingPaymentLinks('membership', plan.parentSlug, paymentLinkId);
            }

            await fetchCurrentSubscription();
            await loadPurchases();
            const courseSelection = await fetchActiveMembershipInfo();

            if (openResult.success) {
                if (plan.courseSelection?.enabled && courseSelection?.remaining && courseSelection.remaining > 0) {
                    router.push({
                        pathname: '/(home)/choose-courses',
                        params: {
                            membershipId: activeMembership?.membershipId || '',
                            maxSelectable: String(courseSelection.maxSelectable),
                        },
                    });
                }
            }
        } catch (err: any) {
            console.warn('[Membership] Purchase error:', err?.message || err);
            Alert.alert('Payment Failed', err?.message || 'Could not complete payment. Please try again.');
        } finally {
            setPurchasingPlanId(null);
        }
    };



    const activePlan = (currentSubscription?.selectedPlan || currentSubscription?.plan || '').toLowerCase();
    const isActive = currentSubscription?.status === 'active';
    const hasNoPlan = !activePlan || !isActive;

    // A user can hold multiple active plans. Treat every effective plan as owned so a
    // previously held plan never shows as buyable again.
    const ownedPlanSlugs = new Set(
        (currentSubscription?.effectivePlans || [])
            .map((slug) => String(slug || '').toLowerCase().trim())
            .filter(Boolean)
    );
    if (activePlan) ownedPlanSlugs.add(activePlan);

    /* current plan config */
    const currentPlanCfg = plans.find(p => p.id === activePlan || p.parentSlug === activePlan);

    /* every plan the user currently holds */
    const activePlanConfigs = plans.filter(
        (p) => ownedPlanSlugs.has(p.id) || ownedPlanSlugs.has(p.parentSlug)
    );

    return (
        <SafeAreaView style={styles.root}>
            <StatusBar barStyle="dark-content" backgroundColor={colors.background} />

            {/* Header */}
            <View style={styles.header}>
                <TouchableOpacity style={styles.backBtn} onPress={() => { if (router.canGoBack()) router.back(); }}>
                    <Ionicons name="chevron-back" size={22} color={colors.text} />
                </TouchableOpacity>
                <Text style={styles.headerTitle}>My Membership</Text>
                <View style={{ width: 38 }} />
            </View>

            <ScrollView ref={scrollRef} showsVerticalScrollIndicator={false} contentContainerStyle={[styles.scroll, { paddingBottom: bottomTabHeight }]}>

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
                            style={[styles.upgradeCtaSecondary, { marginTop: 12 }]}
                            onPress={syncPayment}
                            disabled={syncingPayment}
                            activeOpacity={0.85}
                        >
                            {syncingPayment ? (
                                <ActivityIndicator size="small" color={colors.textSecondary} />
                            ) : (
                                <>
                                    <Ionicons name="refresh" size={18} color={colors.textSecondary} />
                                    <Text style={styles.upgradeCtaSecondaryText}>I already paid – sync</Text>
                                </>
                            )}
                        </TouchableOpacity>
                    </View>
                ) : activePlanConfigs.length > 0 ? (
                    /* Active plans hero — every plan the user holds */
                    <>
                        {activePlanConfigs.map((cfg) => {
                            const isPrimary = cfg.id === currentPlanCfg?.id;
                            const includedFeatures = cfg.features.filter(f => f.included);

                            return (
                                <View key={cfg.id} style={[styles.activePlanCard, { borderColor: ACCENT, marginBottom: 16 }]}>
                                    <View style={styles.activePlanTop}>
                                        <Text style={styles.activePlanEmoji}>{cfg.emoji ?? '✨'}</Text>
                                        <View style={styles.activePlanInfo}>
                                            <Text style={styles.activePlanLabel}>{isPrimary ? 'Current Plan' : 'Active Plan'}</Text>
                                            <Text style={[styles.activePlanName, { color: ACCENT }]}>{cfg.name}</Text>
                                            <Text style={styles.activePlanTagline}>{cfg.tagline}</Text>
                                        </View>
                                        <View style={[styles.statusBadge, { backgroundColor: '#F0FDF4', borderColor: '#10B981' }]}>
                                            <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                                            <Text style={[styles.statusText, { color: '#10B981' }]}>Active</Text>
                                        </View>
                                    </View>

                                    {includedFeatures.length > 0 && (
                                        <View style={styles.activePlanFeatures}>
                                            <Text style={styles.featuresLabel}>What&apos;s included</Text>
                                            {includedFeatures.map((f, i) => (
                                                <View key={i} style={styles.featureRow}>
                                                    <Ionicons name="checkmark-circle" size={18} color={ACCENT} />
                                                    <Text style={styles.featureText}>{f.text}</Text>
                                                </View>
                                            ))}
                                        </View>
                                    )}

                                    {isPrimary && (
                                        <TouchableOpacity
                                            style={[styles.manageBtn, { backgroundColor: ACCENT }]}
                                            onPress={scrollToPlans}
                                            activeOpacity={0.85}
                                        >
                                            <Ionicons name="arrow-up-circle" size={17} color="#fff" />
                                            <Text style={styles.manageBtnText}>Upgrade / Manage Plan</Text>
                                        </TouchableOpacity>
                                    )}

                                    {isPrimary && activeMembership?.courseSelection?.enabled && activeMembership.courseSelection.remaining > 0 && (
                                        <TouchableOpacity
                                            style={styles.courseSelectBtn}
                                            onPress={() => router.push({
                                                pathname: '/(home)/choose-courses',
                                                params: {
                                                    membershipId: activeMembership.membershipId,
                                                    maxSelectable: String(activeMembership.courseSelection.maxSelectable),
                                                },
                                            })}
                                            activeOpacity={0.85}
                                        >
                                            <Ionicons name="book-outline" size={17} color="#8B5CF6" />
                                            <Text style={styles.courseSelectBtnText}>
                                                Choose Your Courses ({activeMembership.courseSelection.remaining} credits left)
                                            </Text>
                                        </TouchableOpacity>
                                    )}

                                    {isPrimary && activeMembership?.courseSelection?.enabled && activeMembership.courseSelection.remaining === 0 && (
                                        <View style={styles.courseSelectDone}>
                                            <Ionicons name="checkmark-circle" size={18} color="#22C55E" />
                                            <Text style={styles.courseSelectDoneText}>
                                                All {activeMembership.courseSelection.used} courses selected
                                            </Text>
                                        </View>
                                    )}
                                </View>
                            );
                        })}
                    </>
                ) : (
                    /* Fallback: active, but plan metadata not loaded yet */
                    <View style={[styles.activePlanCard, { borderColor: ACCENT }]}>
                        <View style={styles.activePlanTop}>
                            <Text style={styles.activePlanEmoji}>✨</Text>
                            <View style={styles.activePlanInfo}>
                                <Text style={styles.activePlanLabel}>Current Plan</Text>
                                <Text style={[styles.activePlanName, { color: ACCENT }]}>
                                    {activePlan ? activePlan.charAt(0).toUpperCase() + activePlan.slice(1) : 'Active'}
                                </Text>
                            </View>
                            <View style={[styles.statusBadge, { backgroundColor: '#F0FDF4', borderColor: '#10B981' }]}>
                                <View style={[styles.statusDot, { backgroundColor: '#10B981' }]} />
                                <Text style={[styles.statusText, { color: '#10B981' }]}>Active</Text>
                            </View>
                        </View>
                        <TouchableOpacity
                            style={[styles.manageBtn, { backgroundColor: ACCENT }]}
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

                {plansLoading ? (
                    <View style={styles.noPlansCard}>
                        <ActivityIndicator size="small" color="#8B5CF6" />
                        <Text style={styles.noPlansText}>Loading plans...</Text>
                    </View>
                ) : plans.length === 0 && (
                    <View style={styles.noPlansCard}>
                        <Ionicons name="information-circle-outline" size={18} color={colors.textSecondary} />
                        <Text style={styles.noPlansText}>No membership plans are available right now. Please check again later.</Text>
                    </View>
                )}

                {plans.map(plan => {
                    const planId = plan.id.toLowerCase().trim();
                    const currentPlanId = activePlan ? activePlan.toLowerCase().trim() : '';
                    const isCurrentPlan = currentPlanId === planId && isActive;
                    const isOwnedPlan = ownedPlanSlugs.has(planId) || ownedPlanSlugs.has(plan.parentSlug);
                    const isAlreadyPurchased = isOwnedPlan || purchases.some(p => {
                        const purchasePlan = p.plan ? p.plan.toLowerCase().trim() : '';
                        return (purchasePlan === planId || purchasePlan === plan.parentSlug || purchasePlan === plan.rawId) && p.status === 'completed';
                    });
                    const isSelectionPlan = !!plan.courseSelection?.enabled;
                    const maxSelectable = plan.courseSelection?.maxSelectableCourses || 0;
                    const isBusy = purchasingPlanId !== null;
                    const visibleFeatures = plan.features.slice(0, 4);
                    const hiddenFeatureCount = plan.features.length - visibleFeatures.length;
                    const courseCount = plan.courseCount || 0;
                    const valueText = isSelectionPlan
                        ? `Choose any ${maxSelectable} of ${courseCount} course${courseCount === 1 ? '' : 's'}`
                        : `${courseCount} course${courseCount === 1 ? '' : 's'} included`;

                    return (
                        <View
                            key={plan.id}
                            style={[styles.planCard, isOwnedPlan && styles.planCardCurrent]}
                        >
                            {/* Active ribbon */}
                            {isOwnedPlan && (
                                <View style={styles.activeBadge}>
                                    <Ionicons name="checkmark-circle" size={13} color="#fff" />
                                    <Text style={styles.activeBadgeText}>{isCurrentPlan ? 'CURRENT PLAN' : 'ACTIVE PLAN'}</Text>
                                </View>
                            )}

                            {/* Plan header: name + price */}
                            <View style={[styles.planHeaderRow, isOwnedPlan && { marginTop: 16 }]}>
                                <Text style={styles.planEmoji}>{plan.emoji}</Text>
                                <View style={styles.planTitleBlock}>
                                    <Text style={styles.planName}>{plan.name}</Text>
                                    {!!plan.tagline && <Text style={styles.planTagline}>{plan.tagline}</Text>}
                                </View>
                                <View style={styles.planPriceBlock}>
                                    <Text style={styles.planPrice}>₹{plan.price.toLocaleString('en-IN')}</Text>
                                    <Text style={styles.planPriceCaption}>one-time</Text>
                                </View>
                            </View>

                            <View style={styles.planDivider} />

                            {/* What you get */}
                            <View style={styles.valueRow}>
                                <Ionicons name={isSelectionPlan ? 'albums-outline' : 'library-outline'} size={16} color={ACCENT} />
                                <Text style={styles.valueText}>{valueText}</Text>
                            </View>

                            {/* Free preview videos */}
                            {plan.previewVideos && plan.previewVideos.length > 0 && (
                                <ScrollView
                                    horizontal
                                    showsHorizontalScrollIndicator={false}
                                    style={styles.previewStrip}
                                    contentContainerStyle={styles.previewStripContent}
                                >
                                    {plan.previewVideos.map((video, idx) => (
                                        <TouchableOpacity
                                            key={`${plan.id}-preview-${idx}`}
                                            style={styles.previewVideoCard}
                                            activeOpacity={0.85}
                                            onPress={() => router.push({
                                                pathname: '/video-player',
                                                params: {
                                                    videoUrl: video.videoUrl,
                                                    videoTitle: video.title || 'Preview',
                                                    videoDuration: video.duration || '',
                                                },
                                            })}
                                        >
                                            {video.thumbnailUrl ? (
                                                <Image source={{ uri: video.thumbnailUrl }} style={styles.previewVideoThumb} />
                                            ) : (
                                                <View style={[styles.previewVideoThumb, styles.previewVideoThumbFallback]}>
                                                    <Ionicons name="play-circle" size={26} color="#fff" />
                                                </View>
                                            )}
                                            <View style={styles.previewPlayBadge}>
                                                <Ionicons name="play" size={11} color="#fff" />
                                            </View>
                                            <Text style={styles.previewVideoTitle} numberOfLines={2}>
                                                {video.title || 'Preview'}
                                            </Text>
                                        </TouchableOpacity>
                                    ))}
                                </ScrollView>
                            )}

                            {/* Features */}
                            {visibleFeatures.map((f, i) => (
                                <View key={i} style={styles.planFeatureRow}>
                                    <View
                                        style={[
                                            styles.checkCircle,
                                            { backgroundColor: f.included ? ACCENT_SOFT : colors.surfaceSecondary },
                                        ]}
                                    >
                                        <Ionicons
                                            name={f.included ? 'checkmark' : 'close'}
                                            size={11}
                                            color={f.included ? ACCENT : colors.textSecondary}
                                        />
                                    </View>
                                    <Text style={[styles.planFeatureText, !f.included && styles.planFeatureTextMuted]}>
                                        {f.text}
                                    </Text>
                                </View>
                            ))}
                            {hiddenFeatureCount > 0 && (
                                <Text style={styles.featureMore}>+{hiddenFeatureCount} more</Text>
                            )}

                            {/* One primary action per card */}
                            {isOwnedPlan ? (
                                <View style={styles.planStateNote}>
                                    <Ionicons name="checkmark-circle" size={16} color={ACCENT} />
                                    <Text style={styles.planStateNoteText}>{isCurrentPlan ? 'Your current plan' : 'Active plan'}</Text>
                                </View>
                            ) : isAlreadyPurchased ? (
                                <View style={styles.purchasedIndicator}>
                                    <Ionicons name="shield-checkmark" size={16} color={colors.textSecondary} />
                                    <Text style={styles.purchasedText}>Previously purchased</Text>
                                </View>
                            ) : (
                                <>
                                    <TouchableOpacity
                                        style={[styles.primaryCta, isBusy && { opacity: 0.6 }]}
                                        onPress={() => (isSelectionPlan ? openPreSelect(plan) : handlePurchase(plan))}
                                        activeOpacity={0.9}
                                        disabled={isBusy}
                                        accessibilityRole="button"
                                        accessibilityLabel={
                                            isSelectionPlan
                                                ? `Choose courses and pay for ${plan.name}`
                                                : `Buy ${plan.name} membership`
                                        }
                                    >
                                        {purchasingPlanId === plan.id ? (
                                            <ActivityIndicator color="#fff" />
                                        ) : (
                                            <>
                                                <Ionicons
                                                    name={isSelectionPlan ? 'albums-outline' : 'sparkles-outline'}
                                                    size={18}
                                                    color="#fff"
                                                />
                                                <Text style={styles.primaryCtaText}>
                                                    {isSelectionPlan ? 'Choose courses & pay' : `Buy ${plan.name}`}
                                                </Text>
                                            </>
                                        )}
                                    </TouchableOpacity>

                                    <View style={styles.ctaLinksRow}>
                                        {isSelectionPlan ? (
                                            <TouchableOpacity
                                                style={styles.ctaLink}
                                                onPress={() => handlePurchase(plan)}
                                                activeOpacity={0.7}
                                                disabled={isBusy}
                                            >
                                                <Text style={styles.ctaLinkText}>Pay first, choose later</Text>
                                            </TouchableOpacity>
                                        ) : (
                                            <TouchableOpacity
                                                style={styles.ctaLink}
                                                onPress={() => openCoursesSheet(plan)}
                                                activeOpacity={0.7}
                                                disabled={isBusy}
                                            >
                                                <Ionicons name="eye-outline" size={14} color={colors.textSecondary} />
                                                <Text style={styles.ctaLinkText}>See included courses</Text>
                                            </TouchableOpacity>
                                        )}
                                    </View>
                                </>
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
                                            backgroundColor: done ? '#F0FDF4' : colors.surfaceSecondary,
                                            borderColor: done ? '#10B981' : colors.border,
                                            borderWidth: 1
                                        }]}>
                                            <Text style={[styles.purchaseStatusText, { color: done ? '#10B981' : colors.textSecondary }]}>
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

            {/* Included Courses sheet (entitlement plans) */}
            <Modal visible={!!coursesSheetPlan} animationType="slide" transparent onRequestClose={closeCoursesSheet}>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>Included Courses — {coursesSheetPlan?.name}</Text>
                            <TouchableOpacity onPress={closeCoursesSheet} style={styles.modalCloseBtn}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSub}>Tap a course to see what&apos;s inside</Text>
                        {coursesSheetLoading ? (
                            <ActivityIndicator size="large" color="#8B5CF6" style={{ marginTop: 20 }} />
                        ) : coursesSheetList.length === 0 ? (
                            <Text style={styles.modalEmpty}>No courses found for this plan.</Text>
                        ) : (
                            <FlatList
                                data={coursesSheetList}
                                keyExtractor={(item) => item._id}
                                renderItem={({ item }) => (
                                    <TouchableOpacity
                                        style={styles.previewCourseRow}
                                        onPress={() => {
                                            closeCoursesSheet();
                                            openCoursePreview(item._id, item.title, item.color, item.duration);
                                        }}
                                        activeOpacity={0.7}
                                    >
                                        <View style={[styles.previewThumb, { backgroundColor: item.color || '#8B5CF6' }]}>
                                            <Ionicons name="book-outline" size={18} color="#FFF" />
                                        </View>
                                        <View style={{ flex: 1 }}>
                                            <Text style={styles.previewCourseTitle} numberOfLines={1}>{item.title}</Text>
                                            <Text style={styles.previewCourseMeta}>
                                                {item.category ? `${item.category} · ` : ''}{item.duration || ''}
                                            </Text>
                                        </View>
                                        <Ionicons name="chevron-forward" size={18} color={colors.textSecondary} />
                                    </TouchableOpacity>
                                )}
                                style={{ maxHeight: 400 }}
                            />
                        )}
                        <TouchableOpacity style={styles.modalDoneBtn} onPress={closeCoursesSheet}>
                            <Text style={styles.modalDoneBtnText}>Got it</Text>
                        </TouchableOpacity>
                        <View style={{ height: insets.bottom }} />
                    </View>
                </View>
            </Modal>

            {/* #7: Pre-Select Courses Modal */}
            <Modal visible={showPreSelectModal} animationType="slide" transparent>
                <View style={styles.modalOverlay}>
                    <View style={styles.modalContainer}>
                        <View style={styles.modalHeader}>
                            <Text style={styles.modalTitle}>
                                Pick Your Courses — {plans.find(p => p.id === preSelectingPlanId)?.name ?? 'Plan'}
                            </Text>
                            <TouchableOpacity onPress={() => { setShowPreSelectModal(false); setPreSelectingPlanId(null); setPreSelectedCourseIds([]); }} style={styles.modalCloseBtn}>
                                <Ionicons name="close" size={24} color={colors.text} />
                            </TouchableOpacity>
                        </View>
                        <Text style={styles.modalSub}>
                            Choose {plans.find(p => p.id === preSelectingPlanId)?.courseSelection?.maxSelectableCourses || 3} courses — selected: {preSelectedCourseIds.length}
                        </Text>
                        {preSelectLoading ? (
                            <ActivityIndicator size="large" color="#8B5CF6" style={{ marginTop: 20 }} />
                        ) : preSelectCourses.length === 0 ? (
                            <Text style={styles.modalEmpty}>No eligible courses found.</Text>
                        ) : (
                            <FlatList
                                data={preSelectCourses}
                                keyExtractor={(item) => item._id}
                                renderItem={({ item }) => {
                                    const isSelected = preSelectedCourseIds.includes(item._id);
                                    const plan = plans.find(p => p.id === preSelectingPlanId);
                                    const maxReached = preSelectedCourseIds.length >= (plan?.courseSelection?.maxSelectableCourses || 3);
                                    const disabled = !isSelected && maxReached;
                                    return (
                                        <View style={[styles.previewCourseRow, isSelected && styles.previewRowSelected, disabled && styles.previewRowDisabled]}>
                                            <TouchableOpacity
                                                style={styles.previewRowMain}
                                                onPress={() => togglePreSelectCourse(item._id)}
                                                disabled={disabled}
                                                activeOpacity={0.7}
                                            >
                                                <View style={[styles.previewThumb, { backgroundColor: item.color || '#8B5CF6' }]}>
                                                    <Ionicons name="book-outline" size={18} color="#FFF" />
                                                </View>
                                                <View style={{ flex: 1 }}>
                                                    <Text style={styles.previewCourseTitle} numberOfLines={1}>{item.title}</Text>
                                                    <Text style={styles.previewCourseMeta}>
                                                        {item.category ? `${item.category} · ` : ''}{item.duration || ''}
                                                    </Text>
                                                </View>
                                            </TouchableOpacity>
                                            <TouchableOpacity
                                                style={styles.previewRowView}
                                                onPress={() => openCoursePreview(item._id, item.title, item.color, item.duration)}
                                                hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}
                                                activeOpacity={0.7}
                                            >
                                                <Ionicons name="information-circle-outline" size={22} color={colors.textSecondary} />
                                            </TouchableOpacity>
                                            {isSelected ? (
                                                <Ionicons name="checkmark-circle" size={24} color="#22C55E" />
                                            ) : disabled ? (
                                                <Ionicons name="lock-closed" size={20} color={colors.textSecondary} />
                                            ) : (
                                                <Ionicons name="add-circle-outline" size={24} color="#8B5CF6" />
                                            )}
                                        </View>
                                    );
                                }}
                                style={{ maxHeight: 400 }}
                            />
                        )}
                        <TouchableOpacity
                            style={[styles.modalDoneBtn, preSelectedCourseIds.length === 0 && { opacity: 0.5 }]}
                            onPress={confirmPreSelect}
                            disabled={preSelectedCourseIds.length === 0}
                        >
                            <Text style={styles.modalDoneBtnText}>
                                {preSelectedCourseIds.length > 0
                                    ? `Continue to Payment (${preSelectedCourseIds.length} selected)`
                                    : 'Select at least 1 course'}
                            </Text>
                        </TouchableOpacity>
                        <View style={{ height: insets.bottom }} />
                    </View>
                </View>
            </Modal>
        </SafeAreaView>
    );
}

/* ─── Styles ─────────────────────────────────────────────────────────── */

