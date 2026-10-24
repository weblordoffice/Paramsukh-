'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X, TicketPercent, Search, Users } from 'lucide-react';

interface Coupon {
    _id: string;
    code: string;
    description: string;
    discountType: 'percentage' | 'flat';
    discountValue: number;
    maxDiscount?: number | null;
    minOrderValue?: number;
    purchaseTypes?: Array<'shop' | 'membership' | 'event' | 'counseling'>;
    applicableOn: 'all' | 'category' | 'product' | 'shop';
    categories?: Array<{ _id: string; name: string }> | string[];
    products?: Array<{ _id: string; name: string }> | string[];
    shops?: Array<{ _id: string; name: string }> | string[];
    membershipPlanIds?: string[];
    eventIds?: string[];
    counselingServiceIds?: string[];
    maxUsageCount?: number | null;
    maxUsagePerUser?: number;
    currentUsageCount?: number;
    userRestriction?: 'all' | 'specific';
    applicableUsers?: Array<{ _id: string; displayName?: string; email?: string; phone?: string }> | string[];
    notifiedUsers?: string[];
    startDate: string;
    endDate: string;
    isActive: boolean;
    stats?: { totalUsed?: number; totalDiscount?: number };
}

interface Option {
    _id: string;
    name: string;
}

interface AdminUser {
    _id: string;
    displayName?: string;
    email?: string;
    phone?: string;
}

type FormState = {
    code: string;
    description: string;
    discountType: 'percentage' | 'flat';
    discountValue: string;
    maxDiscount: string;
    minOrderValue: string;
    purchaseTypes: Array<'shop' | 'membership' | 'event' | 'counseling'>;
    applicableOn: 'all' | 'category' | 'product' | 'shop';
    categories: string[];
    products: string[];
    shops: string[];
    membershipPlanIds: string[];
    eventIds: string[];
    counselingServiceIds: string[];
    maxUsageCount: string;
    maxUsagePerUser: string;
    applicableUsers: string[];
    startDate: string;
    endDate: string;
    isActive: boolean;
};

const emptyForm: FormState = {
    code: '',
    description: '',
    discountType: 'percentage',
    discountValue: '10',
    maxDiscount: '',
    minOrderValue: '',
    purchaseTypes: ['shop'],
    applicableOn: 'all',
    categories: [],
    products: [],
    shops: [],
    membershipPlanIds: [],
    eventIds: [],
    counselingServiceIds: [],
    maxUsageCount: '',
    maxUsagePerUser: '1',
    applicableUsers: [],
    startDate: '',
    endDate: '',
    isActive: true,
};

const toLocalInput = (iso?: string) => {
    if (!iso) return '';
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
};

const idOf = (value: any) => String(typeof value === 'object' ? value?._id : value || '');
const nameOf = (value: any) => String(typeof value === 'object' ? value?.name : value || '');

export default function CouponsPage() {
    const [coupons, setCoupons] = useState<Coupon[]>([]);
    const [categories, setCategories] = useState<Option[]>([]);
    const [products, setProducts] = useState<Option[]>([]);
    const [shops, setShops] = useState<Option[]>([]);
    const [membershipPlans, setMembershipPlans] = useState<Option[]>([]);
    const [events, setEvents] = useState<Option[]>([]);
    const [counselingServices, setCounselingServices] = useState<Option[]>([]);
    const [users, setUsers] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Coupon | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [userSearch, setUserSearch] = useState('');

    const loadCoupons = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/api/admin/coupons');
            setCoupons(response.data.coupons || []);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to load coupons');
            setCoupons([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadCoupons();

        const loadOptions = async () => {
            try {
                const [productsRes, usersRes, plansRes, eventsRes, counselingRes] = await Promise.all([
                    apiClient.get('/api/products', { params: { limit: 200 } }),
                    apiClient.get('/api/user/all').catch(() => ({ data: { users: [] } })),
                    apiClient.get('/api/membership-plans').catch(() => ({ data: { data: [] } })),
                    apiClient.get('/api/events/all', { params: { limit: 200 } }).catch(() => ({ data: { events: [] } })),
                    apiClient.get('/api/counseling/admin/services').catch(() => ({ data: { data: { services: [] } } })),
                ]);
                const productList = productsRes.data?.data?.products || [];
                setProducts(productList.map((product: any) => ({ _id: product._id, name: product.name })));
                const categoryMap = new Map<string, Option>();
                const shopMap = new Map<string, Option>();
                productList.forEach((product: any) => {
                    if (product.category?._id) {
                        categoryMap.set(String(product.category._id), {
                            _id: String(product.category._id),
                            name: product.category.name,
                        });
                    }
                    if (product.shop?._id) {
                        shopMap.set(String(product.shop._id), {
                            _id: String(product.shop._id),
                            name: product.shop.name,
                        });
                    }
                });
                setCategories([...categoryMap.values()]);
                setShops([...shopMap.values()]);
                setUsers(usersRes.data?.users || []);
                setMembershipPlans((plansRes.data?.data || []).map((plan: any) => ({
                    _id: String(plan._id),
                    name: plan.title || plan.slug,
                })));
                setEvents((eventsRes.data?.events || []).map((event: any) => ({
                    _id: String(event._id),
                    name: event.title,
                })));
                setCounselingServices((counselingRes.data?.data?.services || []).map((service: any) => ({
                    _id: String(service._id),
                    name: service.title,
                })));
            } catch {
                // Non-blocking
            }
        };

        loadOptions();
    }, [loadCoupons]);

    const filteredUsers = useMemo(() => {
        const term = userSearch.trim().toLowerCase();
        if (!term) return users.slice(0, 50);
        return users
            .filter((user) =>
                [user.displayName, user.email, user.phone]
                    .filter(Boolean)
                    .some((value) => String(value).toLowerCase().includes(term))
            )
            .slice(0, 50);
    }, [userSearch, users]);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setUserSearch('');
        setShowModal(true);
    };

    const openEdit = (coupon: Coupon) => {
        setEditing(coupon);
        setForm({
            code: coupon.code,
            description: coupon.description || '',
            discountType: coupon.discountType,
            discountValue: String(coupon.discountValue ?? ''),
            maxDiscount: coupon.maxDiscount != null ? String(coupon.maxDiscount) : '',
            minOrderValue: coupon.minOrderValue != null ? String(coupon.minOrderValue) : '',
            purchaseTypes: coupon.purchaseTypes?.length ? coupon.purchaseTypes : ['shop'],
            applicableOn: coupon.applicableOn || 'all',
            categories: (coupon.categories || []).map(idOf),
            products: (coupon.products || []).map(idOf),
            shops: (coupon.shops || []).map(idOf),
            membershipPlanIds: (coupon.membershipPlanIds || []).map(idOf),
            eventIds: (coupon.eventIds || []).map(idOf),
            counselingServiceIds: (coupon.counselingServiceIds || []).map(idOf),
            maxUsageCount: coupon.maxUsageCount != null ? String(coupon.maxUsageCount) : '',
            maxUsagePerUser: coupon.maxUsagePerUser != null ? String(coupon.maxUsagePerUser) : '1',
            applicableUsers: (coupon.applicableUsers || []).map(idOf),
            startDate: toLocalInput(coupon.startDate),
            endDate: toLocalInput(coupon.endDate),
            isActive: coupon.isActive !== false,
        });
        setUserSearch('');
        setShowModal(true);
    };

    const toggleArray = (
        key: 'categories' | 'products' | 'shops' | 'applicableUsers' | 'membershipPlanIds' | 'eventIds' | 'counselingServiceIds',
        id: string
    ) => {
        setForm((prev) => ({
            ...prev,
            [key]: prev[key].includes(id)
                ? prev[key].filter((item) => item !== id)
                : [...prev[key], id],
        }));
    };

    const togglePurchaseType = (type: FormState['purchaseTypes'][number]) => {
        setForm((prev) => {
            const purchaseTypes = prev.purchaseTypes.includes(type)
                ? prev.purchaseTypes.filter((item) => item !== type)
                : [...prev.purchaseTypes, type];
            return {
                ...prev,
                purchaseTypes: purchaseTypes.length > 0 ? purchaseTypes : ['shop'],
            };
        });
    };

    const saveCoupon = async () => {
        if (!form.code.trim()) return toast.error('Coupon code is required');
        if (!form.description.trim()) return toast.error('Description is required');
        if (!form.startDate || !form.endDate) return toast.error('Start and end dates are required');
        if (form.applicableUsers.length === 0) return toast.error('Select at least one user');

        setSaving(true);
        try {
            const payload = {
                code: form.code.trim().toUpperCase(),
                description: form.description.trim(),
                discountType: form.discountType,
                discountValue: Number(form.discountValue) || 0,
                maxDiscount: form.maxDiscount ? Number(form.maxDiscount) : null,
                minOrderValue: form.minOrderValue ? Number(form.minOrderValue) : 0,
                purchaseTypes: form.purchaseTypes,
                applicableOn: form.applicableOn,
                categories: form.purchaseTypes.includes('shop') && form.applicableOn === 'category' ? form.categories : [],
                products: form.purchaseTypes.includes('shop') && form.applicableOn === 'product' ? form.products : [],
                shops: form.purchaseTypes.includes('shop') && form.applicableOn === 'shop' ? form.shops : [],
                membershipPlanIds: form.purchaseTypes.includes('membership') ? form.membershipPlanIds : [],
                eventIds: form.purchaseTypes.includes('event') ? form.eventIds : [],
                counselingServiceIds: form.purchaseTypes.includes('counseling') ? form.counselingServiceIds : [],
                maxUsageCount: form.maxUsageCount ? Number(form.maxUsageCount) : null,
                maxUsagePerUser: Number(form.maxUsagePerUser) || 1,
                applicableUsers: form.applicableUsers,
                startDate: new Date(form.startDate).toISOString(),
                endDate: new Date(form.endDate).toISOString(),
                isActive: form.isActive,
            };

            if (editing) {
                await apiClient.put(`/api/admin/coupons/${editing._id}`, payload);
                toast.success('Coupon updated');
            } else {
                await apiClient.post('/api/admin/coupons', payload);
                toast.success('Coupon created');
            }
            setShowModal(false);
            setEditing(null);
            setForm(emptyForm);
            await loadCoupons();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to save coupon');
        } finally {
            setSaving(false);
        }
    };

    const deleteCoupon = async (coupon: Coupon) => {
        if (!confirm(`Delete coupon ${coupon.code}?`)) return;
        setPendingId(coupon._id);
        try {
            await apiClient.delete(`/api/admin/coupons/${coupon._id}`);
            toast.success('Coupon deleted');
            await loadCoupons();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete coupon');
        } finally {
            setPendingId(null);
        }
    };

    const statusOf = (coupon: Coupon) => {
        const now = Date.now();
        if (!coupon.isActive) return { label: 'Inactive', className: 'bg-gray-100 text-gray-600' };
        if (new Date(coupon.startDate).getTime() > now) return { label: 'Scheduled', className: 'bg-blue-50 text-blue-700' };
        if (new Date(coupon.endDate).getTime() < now) return { label: 'Expired', className: 'bg-red-50 text-red-700' };
        return { label: 'Active', className: 'bg-green-50 text-green-700' };
    };

    const renderOptionList = (
        key: 'categories' | 'products' | 'shops' | 'membershipPlanIds' | 'eventIds' | 'counselingServiceIds',
        options: Option[],
        emptyLabel: string
    ) => (
        <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y">
            {options.length === 0 ? (
                <p className="p-3 text-sm text-accent">{emptyLabel}</p>
            ) : options.map((option) => {
                const checked = form[key].includes(option._id);
                return (
                    <label key={option._id} className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer ${checked ? 'bg-primary/5' : 'hover:bg-gray-50'}`}>
                        <input
                            type="checkbox"
                            checked={checked}
                            onChange={() => toggleArray(key, option._id)}
                            className="w-4 h-4 accent-[#F1842D]"
                        />
                        <span className="text-secondary">{option.name}</span>
                    </label>
                );
            })}
        </div>
    );

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-secondary">Coupons</h1>
                    <p className="text-accent mt-1">Create and send personalized coupons to selected users.</p>
                </div>
                <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition font-medium">
                    <Plus className="w-5 h-5" /> Create Coupon
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            ) : coupons.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center text-accent shadow-md">
                    <TicketPercent className="w-16 h-16 mx-auto mb-4 text-accent/30" />
                    <p>No coupons yet. Create your first coupon code.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {coupons.map((coupon) => {
                        const status = statusOf(coupon);
                        return (
                            <div key={coupon._id} className="bg-white rounded-xl p-5 shadow-md">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h2 className="text-lg font-extrabold text-secondary tracking-wide">{coupon.code}</h2>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${status.className}`}>{status.label}</span>
                                        </div>
                                        <p className="text-sm text-accent mt-1">{coupon.description}</p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={() => openEdit(coupon)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="Edit coupon">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => deleteCoupon(coupon)} disabled={pendingId === coupon._id} className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50" title="Delete coupon">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-accent">
                                    <span className="font-semibold text-primary">
                                        {coupon.discountType === 'percentage' ? `${coupon.discountValue}% off` : `₹${coupon.discountValue} off`}
                                    </span>
                                    <span>Min order ₹{coupon.minOrderValue || 0}</span>
                                    <span>Used {coupon.currentUsageCount || coupon.stats?.totalUsed || 0}{coupon.maxUsageCount ? ` / ${coupon.maxUsageCount}` : ''}</span>
                                    <span>
                                        Assigned to {(coupon.applicableUsers || []).length} user{(coupon.applicableUsers || []).length === 1 ? '' : 's'}
                                        {' · '}notified {(coupon.notifiedUsers || []).length}
                                    </span>
                                    <span className="col-span-2 text-xs">
                                        {new Date(coupon.startDate).toLocaleDateString()} → {new Date(coupon.endDate).toLocaleDateString()}
                                    </span>
                                    <span className="col-span-2 text-xs">
                                        Applies to: {coupon.applicableOn}
                                        {coupon.applicableOn !== 'all' && ` (${(coupon[coupon.applicableOn === 'category' ? 'categories' : coupon.applicableOn === 'product' ? 'products' : 'shops'] || []).length} selected)`}
                                    </span>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {showModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => !saving && setShowModal(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-3xl max-h-[92vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
                        <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl">
                            <h2 className="text-xl font-bold text-secondary">{editing ? 'Edit Coupon' : 'Create Coupon'}</h2>
                            <button onClick={() => !saving && setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg" title="Close">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Coupon code</label>
                                    <input
                                        type="text"
                                        value={form.code}
                                        onChange={(event) => setForm((prev) => ({ ...prev, code: event.target.value.toUpperCase() }))}
                                        placeholder="WELCOME10"
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Description</label>
                                    <input
                                        type="text"
                                        value={form.description}
                                        onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                                        placeholder="10% off on first order"
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Type</label>
                                    <select
                                        value={form.discountType}
                                        onChange={(event) => setForm((prev) => ({ ...prev, discountType: event.target.value as FormState['discountType'] }))}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                                    >
                                        <option value="percentage">Percentage</option>
                                        <option value="flat">Flat</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Value</label>
                                    <input type="number" min={0} value={form.discountValue} onChange={(event) => setForm((prev) => ({ ...prev, discountValue: event.target.value }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Max discount</label>
                                    <input type="number" min={0} value={form.maxDiscount} onChange={(event) => setForm((prev) => ({ ...prev, maxDiscount: event.target.value }))} placeholder="Optional" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Min order</label>
                                    <input type="number" min={0} value={form.minOrderValue} onChange={(event) => setForm((prev) => ({ ...prev, minOrderValue: event.target.value }))} placeholder="0" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Start date</label>
                                    <input type="datetime-local" value={form.startDate} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">End date</label>
                                    <input type="datetime-local" value={form.endDate} onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-secondary mb-2">Applies to</label>
                                <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                                    {[
                                        { id: 'shop', label: 'Shop' },
                                        { id: 'membership', label: 'Membership plans' },
                                        { id: 'event', label: 'Events' },
                                        { id: 'counseling', label: 'Counseling' },
                                    ].map((type) => (
                                        <label key={type.id} className="flex items-center gap-2 rounded-lg border border-gray-200 px-3 py-2 text-sm text-gray-700 cursor-pointer">
                                            <input
                                                type="checkbox"
                                                checked={form.purchaseTypes.includes(type.id as FormState['purchaseTypes'][number])}
                                                onChange={() => togglePurchaseType(type.id as FormState['purchaseTypes'][number])}
                                                className="w-4 h-4 accent-[#F1842D]"
                                            />
                                            {type.label}
                                        </label>
                                    ))}
                                </div>
                            </div>

                            {form.purchaseTypes.includes('shop') && (
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Shop items</label>
                                    <select
                                        value={form.applicableOn}
                                        onChange={(event) => setForm((prev) => ({ ...prev, applicableOn: event.target.value as FormState['applicableOn'] }))}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm"
                                    >
                                        <option value="all">All products</option>
                                        <option value="category">Selected categories</option>
                                        <option value="product">Selected products</option>
                                        <option value="shop">Selected shops</option>
                                    </select>
                                    {form.applicableOn === 'category' && <div className="mt-2">{renderOptionList('categories', categories, 'No categories found.')}</div>}
                                    {form.applicableOn === 'product' && <div className="mt-2">{renderOptionList('products', products, 'No products found.')}</div>}
                                    {form.applicableOn === 'shop' && <div className="mt-2">{renderOptionList('shops', shops, 'No shops found.')}</div>}
                                </div>
                            )}

                            {form.purchaseTypes.includes('membership') && (
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Membership plans</label>
                                    <p className="text-xs text-gray-500 mb-2">Leave empty to apply to all plans.</p>
                                    {renderOptionList('membershipPlanIds', membershipPlans, 'No membership plans found.')}
                                </div>
                            )}

                            {form.purchaseTypes.includes('event') && (
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Events</label>
                                    <p className="text-xs text-gray-500 mb-2">Leave empty to apply to all events.</p>
                                    {renderOptionList('eventIds', events, 'No events found.')}
                                </div>
                            )}

                            {form.purchaseTypes.includes('counseling') && (
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Counseling services</label>
                                    <p className="text-xs text-gray-500 mb-2">Leave empty to apply to all counseling services.</p>
                                    {renderOptionList('counselingServiceIds', counselingServices, 'No counseling services found.')}
                                </div>
                            )}

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Max total uses</label>
                                    <input type="number" min={0} value={form.maxUsageCount} onChange={(event) => setForm((prev) => ({ ...prev, maxUsageCount: event.target.value }))} placeholder="Unlimited" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Max uses per user</label>
                                    <input type="number" min={1} value={form.maxUsagePerUser} onChange={(event) => setForm((prev) => ({ ...prev, maxUsagePerUser: event.target.value }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                                </div>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-secondary mb-2">Assign to users ({form.applicableUsers.length})</label>
                                <p className="text-xs text-gray-500 mb-2">Selected users get a push notification when the coupon becomes active.</p>
                                <div className="relative mb-2">
                                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
                                    <input value={userSearch} onChange={(event) => setUserSearch(event.target.value)} placeholder="Search users..." className="w-full pl-9 pr-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                                </div>
                                <div className="max-h-40 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                                    {filteredUsers.length === 0 ? (
                                        <p className="p-3 text-sm text-accent">No users found.</p>
                                    ) : filteredUsers.map((user) => {
                                        const checked = form.applicableUsers.includes(user._id);
                                        return (
                                            <label key={user._id} className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer ${checked ? 'bg-primary/5' : 'hover:bg-gray-50'}`}>
                                                <input type="checkbox" checked={checked} onChange={() => toggleArray('applicableUsers', user._id)} className="w-4 h-4 accent-[#F1842D]" />
                                                <span className="text-secondary">{user.displayName || 'Unnamed user'}</span>
                                                <span className="text-xs text-accent ml-auto">{user.email || user.phone || ''}</span>
                                            </label>
                                        );
                                    })}
                                </div>
                            </div>

                            <label className="flex items-center gap-2 text-sm font-medium text-secondary">
                                <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))} className="w-4 h-4 accent-[#F1842D]" />
                                Active
                            </label>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button onClick={() => setShowModal(false)} disabled={saving} className="px-4 py-2.5 border border-gray-300 rounded-lg text-secondary font-medium hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                                <button onClick={saveCoupon} disabled={saving} className="px-5 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50">
                                    {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Coupon'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
