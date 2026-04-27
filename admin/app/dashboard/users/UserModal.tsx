'use client';

import { useState, useEffect } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { X, User as UserIcon, Mail, Phone, Crown, Tags } from 'lucide-react';

interface User {
    _id?: string;
    displayName?: string;
    name?: string; // Fallback
    email?: string;
    phone?: string;
    subscriptionPlan?: string;
    subscriptionPlanVariant?: string | null;
    subscriptionStatus?: string;
    isActive?: boolean;
    tags?: string[];
}

interface PlanOption {
    value: string;
    label: string;
}

interface UserModalProps {
    isOpen: boolean;
    onClose: () => void;
    user?: User | null;
    onSuccess: () => void;
}

export default function UserModal({ isOpen, onClose, user, onSuccess }: UserModalProps) {
    const [formData, setFormData] = useState({
        displayName: '',
        email: '',
        phone: '',
        subscriptionPlan: 'free',
        tags: '',
        isActive: true
    });
    const [loading, setLoading] = useState(false);
    const [loadingPlans, setLoadingPlans] = useState(false);
    const [planOptions, setPlanOptions] = useState<PlanOption[]>([
        { value: 'free', label: 'Free' },
    ]);

    const toPlanLabel = (slug: string) => {
        const text = String(slug || '').trim();
        if (!text) return 'Plan';
        return text
            .split(/[-_\s]+/g)
            .filter(Boolean)
            .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
            .join(' ');
    };

    const toSelectionValue = (plan?: string, variant?: string | null) => {
        const parent = String(plan || 'free').toLowerCase().trim();
        const child = String(variant || '').toLowerCase().trim();
        return child ? `${parent}::${child}` : parent;
    };

    useEffect(() => {
        if (user) {
            setFormData({
                displayName: user.displayName || user.name || '',
                email: user.email || '',
                phone: user.phone || '',
                subscriptionPlan: toSelectionValue(user.subscriptionPlan, user.subscriptionPlanVariant),
                tags: Array.isArray(user.tags) ? user.tags.join(', ') : '',
                isActive: user.isActive ?? true
            });
        } else {
            setFormData({
                displayName: '',
                email: '',
                phone: '',
                subscriptionPlan: 'free',
                tags: '',
                isActive: true
            });
        }
    }, [user, isOpen]);

    useEffect(() => {
        if (!isOpen) return;

        let mounted = true;

        const loadPlans = async () => {
            setLoadingPlans(true);
            try {
                const response = await apiClient.get('/api/membership-plans');
                const plans = Array.isArray(response.data?.data) ? response.data.data : [];

                const mapped = plans
                    .filter((plan: any) => plan?.status === 'published')
                    .flatMap((plan: any) => {
                        const slug = String(plan?.slug || '').toLowerCase().trim();
                        if (!slug) return [];

                        const baseOption: PlanOption = {
                            value: slug,
                            label: String(plan?.title || '').trim() || toPlanLabel(slug),
                        };

                        const variantOptions: PlanOption[] = !!plan?.planVariantsEnabled && Array.isArray(plan?.planVariants)
                            ? plan.planVariants
                                .filter((variant: any) => variant && variant.isActive !== false)
                                .map((variant: any) => {
                                    const variantSlug = String(variant?.slug || '').toLowerCase().trim();
                                    if (!variantSlug) return null;
                                    return {
                                        value: `${slug}::${variantSlug}`,
                                        label: `${baseOption.label} - ${String(variant?.title || toPlanLabel(variantSlug)).trim()}`,
                                    } as PlanOption;
                                })
                                .filter(Boolean) as PlanOption[]
                            : [];

                        return [baseOption, ...variantOptions];
                    })
                    .filter(Boolean) as PlanOption[];

                const deduped = Array.from(
                    new Map(mapped.map((plan) => [plan.value, plan])).values()
                );

                const options = [
                    { value: 'free', label: 'Free' },
                    ...deduped.filter((plan) => plan.value !== 'free'),
                ];

                if (!mounted) return;

                setPlanOptions(options);
                setFormData((prev) => {
                    const selected = String(prev.subscriptionPlan || 'free').toLowerCase().trim();
                    if (options.some((plan) => plan.value === selected)) {
                        return prev;
                    }
                    return { ...prev, subscriptionPlan: 'free' };
                });
            } catch (error) {
                if (mounted) {
                    setPlanOptions([{ value: 'free', label: 'Free' }]);
                    toast.error('Could not load membership plans. Using Free plan only.');
                }
            } finally {
                if (mounted) {
                    setLoadingPlans(false);
                }
            }
        };

        loadPlans();

        return () => {
            mounted = false;
        };
    }, [isOpen]);

    if (!isOpen) return null;

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = {
                ...formData,
                tags: formData.tags
                    .split(',')
                    .map((tag) => tag.trim().toLowerCase())
                    .filter(Boolean)
            };

            if (user?._id) {
                // Update
                await apiClient.patch(`/api/user/${user._id}`, payload);
                toast.success('User updated successfully');
            } else {
                // Create
                await apiClient.post('/api/user/create', payload);
                toast.success('User created successfully');
            }
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error saving user:', error);
            toast.error(error.response?.data?.message || 'Failed to save user');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 overflow-y-auto bg-black/50 backdrop-blur-sm">
            <div className="min-h-full flex items-start sm:items-center justify-center p-4 sm:p-6">
                <div className="bg-white rounded-2xl w-full max-w-md shadow-xl animate-in fade-in zoom-in duration-200 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] flex flex-col overflow-hidden">

                    {/* Header */}
                    <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50 shrink-0">
                        <h2 className="text-xl font-bold text-gray-800">
                            {user ? 'Edit User' : 'Add New User'}
                        </h2>
                        <button
                            onClick={onClose}
                            className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
                        >
                            <X className="w-5 h-5" />
                        </button>
                    </div>

                    {/* Body */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-4 overflow-y-auto">

                    {/* Name */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Full Name</label>
                        <div className="relative">
                            <UserIcon className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                required
                                value={formData.displayName}
                                onChange={(e) => setFormData({ ...formData, displayName: e.target.value })}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-black"
                                placeholder="John Doe"
                            />
                        </div>
                    </div>

                    {/* Phone */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Phone Number</label>
                        <div className="relative">
                            <Phone className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="tel"
                                required
                                value={formData.phone}
                                onChange={(e) => setFormData({ ...formData, phone: e.target.value })}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-black"
                                placeholder="+91 9876543210"
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Unique identifier for login</p>
                    </div>

                    {/* Email */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email Address</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="email"
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-black"
                                placeholder="john@example.com"
                            />
                        </div>
                    </div>

                    {/* Membership Plan */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Membership Plan</label>
                        <div className="relative">
                            <Crown className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <select
                                value={formData.subscriptionPlan}
                                onChange={(e) => setFormData({ ...formData, subscriptionPlan: e.target.value })}
                                disabled={loadingPlans}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition appearance-none bg-white text-black"
                            >
                                {planOptions.map((plan) => (
                                    <option key={plan.value} value={plan.value}>
                                        {plan.label}
                                    </option>
                                ))}
                            </select>
                        </div>
                        {loadingPlans && (
                            <p className="text-xs text-gray-500 mt-1">Loading membership plans...</p>
                        )}
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                        <div className="relative">
                            <Tags className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                value={formData.tags}
                                onChange={(e) => setFormData({ ...formData, tags: e.target.value })}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none transition text-black"
                                placeholder="vip, school-a, pending-docs"
                            />
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Add comma-separated tags for quick search and filtering.</p>
                    </div>

                    {/* Active Status Toggle (Only for Edit) */}
                    {user && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                            <span className="text-sm font-medium text-gray-700">Account Active</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border-gray-300 after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500"></div>
                            </label>
                        </div>
                    )}

                        {/* Buttons */}
                        <div className="flex gap-3 pt-2 sticky bottom-0 bg-white">
                        <button
                            type="button"
                            onClick={onClose}
                            className="flex-1 py-2.5 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 font-medium transition"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="flex-1 py-2.5 bg-primary hover:bg-primary-dark text-white rounded-lg font-medium transition shadow-lg shadow-primary/30 disabled:opacity-70 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-4 h-4 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <span>{user ? 'Update User' : 'Create User'}</span>
                            )}
                        </button>
                        </div>
                    </form>
                </div>
            </div>
        </div>
    );
}
