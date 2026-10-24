'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Plus, Pencil, Trash2, X, Sparkles, Upload } from 'lucide-react';

interface Offer {
    _id: string;
    title: string;
    description?: string;
    bannerImage?: string | null;
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
    startDate: string;
    endDate: string;
    priority?: number;
    isActive: boolean;
    stats?: { timesApplied?: number; totalDiscount?: number };
}

interface Option {
    _id: string;
    name: string;
}

type FormState = {
    title: string;
    description: string;
    bannerImage: string;
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
    startDate: string;
    endDate: string;
    priority: string;
    isActive: boolean;
};

const emptyForm: FormState = {
    title: '',
    description: '',
    bannerImage: '',
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
    startDate: '',
    endDate: '',
    priority: '0',
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

export default function OffersPage() {
    const [offers, setOffers] = useState<Offer[]>([]);
    const [categories, setCategories] = useState<Option[]>([]);
    const [products, setProducts] = useState<Option[]>([]);
    const [shops, setShops] = useState<Option[]>([]);
    const [membershipPlans, setMembershipPlans] = useState<Option[]>([]);
    const [events, setEvents] = useState<Option[]>([]);
    const [counselingServices, setCounselingServices] = useState<Option[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<Offer | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);

    const loadOffers = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/api/admin/offers');
            setOffers(response.data.offers || []);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to load offers');
            setOffers([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadOffers();

        const loadOptions = async () => {
            try {
                const [productsRes, plansRes, eventsRes, counselingRes] = await Promise.all([
                    apiClient.get('/api/products', { params: { limit: 200 } }),
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
    }, [loadOffers]);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setShowModal(true);
    };

    const openEdit = (offer: Offer) => {
        setEditing(offer);
        setForm({
            title: offer.title,
            description: offer.description || '',
            bannerImage: offer.bannerImage || '',
            discountType: offer.discountType,
            discountValue: String(offer.discountValue ?? ''),
            maxDiscount: offer.maxDiscount != null ? String(offer.maxDiscount) : '',
            minOrderValue: offer.minOrderValue != null ? String(offer.minOrderValue) : '',
            purchaseTypes: offer.purchaseTypes?.length ? offer.purchaseTypes : ['shop'],
            applicableOn: offer.applicableOn || 'all',
            categories: (offer.categories || []).map(idOf),
            products: (offer.products || []).map(idOf),
            shops: (offer.shops || []).map(idOf),
            membershipPlanIds: (offer.membershipPlanIds || []).map(idOf),
            eventIds: (offer.eventIds || []).map(idOf),
            counselingServiceIds: (offer.counselingServiceIds || []).map(idOf),
            startDate: toLocalInput(offer.startDate),
            endDate: toLocalInput(offer.endDate),
            priority: String(offer.priority ?? 0),
            isActive: offer.isActive !== false,
        });
        setShowModal(true);
    };

    const toggleArray = (
        key: 'categories' | 'products' | 'shops' | 'membershipPlanIds' | 'eventIds' | 'counselingServiceIds',
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

    const uploadBanner = async (file: File | null, storage: 'cloudinary' | 'local' = 'cloudinary') => {
        if (!file) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('image', file);
            const storageQuery = storage === 'local' ? '&storage=local' : '';
            const response = await apiClient.post(`/api/upload/image?folder=offers${storageQuery}`, formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const url = response.data?.data?.url;
            if (!url) throw new Error('Upload did not return a URL');
            setForm((prev) => ({ ...prev, bannerImage: url }));
            toast.success(storage === 'local' ? 'Banner saved locally' : 'Banner uploaded');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to upload banner');
        } finally {
            setUploading(false);
        }
    };

    const saveOffer = async () => {
        if (!form.title.trim()) return toast.error('Title is required');
        if (!form.startDate || !form.endDate) return toast.error('Start and end dates are required');

        setSaving(true);
        try {
            const payload = {
                title: form.title.trim(),
                description: form.description.trim(),
                bannerImage: form.bannerImage.trim() || null,
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
                startDate: new Date(form.startDate).toISOString(),
                endDate: new Date(form.endDate).toISOString(),
                priority: Number(form.priority) || 0,
                isActive: form.isActive,
            };

            if (editing) {
                await apiClient.patch(`/api/admin/offers/${editing._id}`, payload);
                toast.success('Offer updated');
            } else {
                await apiClient.post('/api/admin/offers', payload);
                toast.success('Offer created');
            }
            setShowModal(false);
            setEditing(null);
            setForm(emptyForm);
            await loadOffers();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to save offer');
        } finally {
            setSaving(false);
        }
    };

    const deleteOffer = async (offer: Offer) => {
        if (!confirm(`Delete offer "${offer.title}"?`)) return;
        setPendingId(offer._id);
        try {
            await apiClient.delete(`/api/admin/offers/${offer._id}`);
            toast.success('Offer deleted');
            await loadOffers();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete offer');
        } finally {
            setPendingId(null);
        }
    };

    const statusOf = (offer: Offer) => {
        const now = Date.now();
        if (!offer.isActive) return { label: 'Inactive', className: 'bg-gray-100 text-gray-600' };
        if (new Date(offer.startDate).getTime() > now) return { label: 'Scheduled', className: 'bg-blue-50 text-blue-700' };
        if (new Date(offer.endDate).getTime() < now) return { label: 'Expired', className: 'bg-red-50 text-red-700' };
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
                        <input type="checkbox" checked={checked} onChange={() => toggleArray(key, option._id)} className="w-4 h-4 accent-[#F1842D]" />
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
                    <h1 className="text-3xl font-bold text-secondary">Offers</h1>
                    <p className="text-accent mt-1">Automatic promotions applied at cart checkout.</p>
                </div>
                <button onClick={openCreate} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition font-medium">
                    <Plus className="w-5 h-5" /> Create Offer
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            ) : offers.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center text-accent shadow-md">
                    <Sparkles className="w-16 h-16 mx-auto mb-4 text-accent/30" />
                    <p>No offers yet. Create your first automatic offer.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {offers.map((offer) => {
                        const status = statusOf(offer);
                        return (
                            <div key={offer._id} className="bg-white rounded-xl p-5 shadow-md">
                                <div className="flex items-start justify-between gap-3">
                                    <div className="min-w-0">
                                        <div className="flex items-center gap-2 flex-wrap">
                                            <h2 className="text-lg font-bold text-secondary">{offer.title}</h2>
                                            <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${status.className}`}>{status.label}</span>
                                        </div>
                                        <p className="text-sm text-accent mt-1">{offer.description}</p>
                                    </div>
                                    <div className="flex items-center gap-1 shrink-0">
                                        <button onClick={() => openEdit(offer)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="Edit offer">
                                            <Pencil className="w-4 h-4" />
                                        </button>
                                        <button onClick={() => deleteOffer(offer)} disabled={pendingId === offer._id} className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50" title="Delete offer">
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <div className="mt-4 grid grid-cols-2 gap-2 text-sm text-accent">
                                    <span className="font-semibold text-primary">
                                        {offer.discountType === 'percentage' ? `${offer.discountValue}% off` : `₹${offer.discountValue} off`}
                                    </span>
                                    <span>Min order ₹{offer.minOrderValue || 0}</span>
                                    <span className="col-span-2 text-xs">
                                        {new Date(offer.startDate).toLocaleDateString()} → {new Date(offer.endDate).toLocaleDateString()}
                                    </span>
                                    <span className="col-span-2 text-xs">
                                        Applies to: {offer.applicableOn}
                                        {offer.applicableOn !== 'all' && ` (${(offer[offer.applicableOn === 'category' ? 'categories' : offer.applicableOn === 'product' ? 'products' : 'shops'] || []).length} selected)`}
                                    </span>
                                    <span className="col-span-2 text-xs">
                                        Applied {offer.stats?.timesApplied || 0} times · ₹{offer.stats?.totalDiscount || 0} saved
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
                            <h2 className="text-xl font-bold text-secondary">{editing ? 'Edit Offer' : 'Create Offer'}</h2>
                            <button onClick={() => !saving && setShowModal(false)} className="p-2 hover:bg-gray-100 rounded-lg" title="Close">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-secondary mb-2">Title</label>
                                <input type="text" value={form.title} onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))} placeholder="Festive Wellness Sale" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-secondary mb-2">Description</label>
                                <textarea value={form.description} onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))} rows={3} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-secondary mb-2">Banner image</label>
                                <div className="flex flex-wrap items-center gap-3">
                                    <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium cursor-pointer hover:bg-gray-50 ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                                        <Upload className="w-4 h-4" />
                                        {uploading ? 'Uploading...' : 'Upload to cloud'}
                                        <input type="file" accept="image/*" className="hidden" onChange={(event) => uploadBanner(event.target.files?.[0] || null)} />
                                    </label>
                                    <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium cursor-pointer hover:bg-gray-50 ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                                        <Upload className="w-4 h-4" />
                                        {uploading ? 'Uploading...' : 'Upload locally'}
                                        <input type="file" accept="image/*" className="hidden" onChange={(event) => uploadBanner(event.target.files?.[0] || null, 'local')} />
                                    </label>
                                    <input type="text" value={form.bannerImage} onChange={(event) => setForm((prev) => ({ ...prev, bannerImage: event.target.value }))} placeholder="Or paste an image URL" className="flex-1 min-w-[220px] px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Type</label>
                                    <select value={form.discountType} onChange={(event) => setForm((prev) => ({ ...prev, discountType: event.target.value as FormState['discountType'] }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
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

                            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Start date</label>
                                    <input type="datetime-local" value={form.startDate} onChange={(event) => setForm((prev) => ({ ...prev, startDate: event.target.value }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">End date</label>
                                    <input type="datetime-local" value={form.endDate} onChange={(event) => setForm((prev) => ({ ...prev, endDate: event.target.value }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Priority</label>
                                    <input type="number" value={form.priority} onChange={(event) => setForm((prev) => ({ ...prev, priority: event.target.value }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
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
                                    <select value={form.applicableOn} onChange={(event) => setForm((prev) => ({ ...prev, applicableOn: event.target.value as FormState['applicableOn'] }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm">
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

                            <label className="flex items-center gap-2 text-sm font-medium text-secondary">
                                <input type="checkbox" checked={form.isActive} onChange={(event) => setForm((prev) => ({ ...prev, isActive: event.target.checked }))} className="w-4 h-4 accent-[#F1842D]" />
                                Active
                            </label>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button onClick={() => setShowModal(false)} disabled={saving} className="px-4 py-2.5 border border-gray-300 rounded-lg text-secondary font-medium hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                                <button onClick={saveOffer} disabled={saving || uploading} className="px-5 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50">
                                    {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Offer'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
