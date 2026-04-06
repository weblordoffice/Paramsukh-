'use client';

import { useState, useEffect } from 'react';
import Image from 'next/image';
import { X } from 'lucide-react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';

interface MembershipPlan {
    _id: string;
    title: string;
    slug: string;
    status: string;
    access?: {
        includedCategories: string[];
        inheritedPlanIds?: string[];
    };
}

const DEFAULT_CATEGORIES = ['physical', 'mental', 'financial', 'relationship', 'spiritual', 'general'];

interface Course {
    _id?: string;
    title: string;
    description: string;
    color: string;
    icon: string;
    thumbnailUrl: string;
    bannerUrl: string;
    duration: number;
    category?: string;
    tags: string[];
    status: string;
    includedInPlans?: string[];
}


interface CourseModalProps {
    isOpen: boolean;
    onClose: () => void;
    course?: Course | null;
    onSuccess: () => void;
}

export default function CourseModal({ isOpen, onClose, course, onSuccess }: CourseModalProps) {
    const [formData, setFormData] = useState<any>({ // Temporarily any to avoid strict type mismatch during refactor if needed, or update interface properly
        title: '',
        description: '',
        color: '#000000',
        icon: '',
        thumbnailUrl: '',
        bannerUrl: '',
        duration: '', // Changed to string for input
        category: '', // Added category
        tags: [],
        status: 'draft',
        includedInPlans: []
    });
    const [tagsInput, setTagsInput] = useState('');
    const [loading, setLoading] = useState(false);
    const [membershipPlans, setMembershipPlans] = useState<MembershipPlan[]>([]);
    const [loadingPlans, setLoadingPlans] = useState(true);

    useEffect(() => {
        const fetchPlans = async () => {
            try {
                const response = await apiClient.get('/api/membership-plans');
                if (response.data.success) {
                    setMembershipPlans(response.data.data.filter((p: any) => p.status !== 'archived'));
                }
            } catch (error) {
                console.error('Error fetching plans:', error);
            } finally {
                setLoadingPlans(false);
            }
        };
        if (isOpen) {
            fetchPlans();
        }
    }, [isOpen]);

    useEffect(() => {
        if (course) {
            setFormData({
                ...course,
                category: (course as any).category || '',
                includedInPlans: (course as any).includedInPlans || []
            });
            setTagsInput(course.tags ? course.tags.join(', ') : '');
        } else {
            setFormData({
                title: '',
                description: '',
                color: '#000000',
                icon: '',
                thumbnailUrl: '',
                bannerUrl: '',
                duration: '',
                category: '',
                tags: [],
                status: 'draft',
                includedInPlans: []
            });
            setTagsInput('');
        }
    }, [course]);

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            // Create a payload derived from formData
            // Ensure tags is an array
            const payload = {
                ...formData,
                tags: tagsInput.split(',').map(tag => tag.trim()).filter(tag => tag !== '')
            };

            if (course?._id) {
                // Update existing course
                await apiClient.put(`/api/courses/update/${course._id}`, payload);
                toast.success('Course updated successfully!');
            } else {
                // Create new course
                await apiClient.post('/api/courses/create', payload);
                toast.success('Course created successfully!');
            }
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to save course');
            console.error(error);
        } finally {
            setLoading(false);
        }
    };

    const handleChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>) => {
        const { name, value } = e.target;
        setFormData((prev: Course) => ({
            ...prev,
            [name]: value
        }));
    };

    const handlePlanChange = (plan: string) => {
        setFormData((prev: any) => {
            const currentPlans = prev.includedInPlans || [];
            if (currentPlans.includes(plan)) {
                return { ...prev, includedInPlans: currentPlans.filter((p: string) => p !== plan) };
            } else {
                return { ...prev, includedInPlans: [...currentPlans, plan] };
            }
        });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, fieldName: 'thumbnailUrl' | 'bannerUrl', type: 'thumbnail' | 'banner') => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Create form data
        const formData = new FormData();
        formData.append('image', file);

        const toastId = toast.loading('Uploading image...');

        try {
            // Explicitly unsetting Content-Type (or setting to undefined which axios handles)
            // allows the browser to set the correct multipart/form-data header with boundary.
            const response = await apiClient.post(`/api/upload/course-media?type=${type}`, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                }
            });

            if (response.data.success) {
                setFormData((prev: Course) => ({
                    ...prev,
                    [fieldName]: response.data.data.url
                }));
                toast.success('Image uploaded successfully!', { id: toastId });
            }
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error(error.response?.data?.message || 'Upload failed', { id: toastId });
        }
    };

    // Calculate categories to display based on selected plans and their inheritances
    const selectedPlansData = membershipPlans.filter((p: MembershipPlan) => (formData.includedInPlans || []).includes(p.slug));

    // Resolve inherited plans recursively (now using slugs instead of _ids)
    const getAllInheritedPlans = (planSlugs: string[], allPlans: MembershipPlan[]): MembershipPlan[] => {
        const result = new Set<string>();
        const queue = [...planSlugs];

        while (queue.length > 0) {
            const currentSlug = queue.shift()!;
            if (!result.has(currentSlug)) {
                result.add(currentSlug);
                const plan = allPlans.find((p: MembershipPlan) => p.slug === currentSlug);
                if (plan && plan.access?.inheritedPlanIds) {
                    // inheritedPlanIds are ObjectIds — resolve to slugs
                    plan.access.inheritedPlanIds.forEach((inheritedId: string) => {
                        const inherited = allPlans.find((p: MembershipPlan) => p._id === inheritedId);
                        if (inherited) queue.push(inherited.slug);
                    });
                }
            }
        }

        return Array.from(result)
            .map((slug: string) => allPlans.find((p: MembershipPlan) => p.slug === slug))
            .filter(Boolean) as MembershipPlan[];
    };

    const fullyResolvedPlans = getAllInheritedPlans(formData.includedInPlans || [], membershipPlans);

    let derivedCategories = new Set<string>();
    fullyResolvedPlans.forEach(p => {
        const cats = p.access?.includedCategories || [];
        cats.forEach(c => derivedCategories.add(c.toLowerCase()));
    });
    
    // If plans selected and they specifically restrict categories, only show those. Otherwise, show all.
    const categoriesToDisplay = fullyResolvedPlans.length > 0 && derivedCategories.size > 0 
        ? Array.from(derivedCategories) 
        : DEFAULT_CATEGORIES;

    // Optional: Reset category if selected plans restricted the allowed categories, causing the current choice to be invalid.
    // eslint-disable-next-line react-hooks/exhaustive-deps
    useEffect(() => {
        if (formData.category && selectedPlansData.length > 0 && derivedCategories.size > 0) {
            if (!derivedCategories.has(formData.category.toLowerCase())) {
                setFormData((prev: any) => ({ ...prev, category: '' }));
            }
        }
    // Only re-run when plan selection changes, not on every category/derivedCategories change
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [formData.includedInPlans, membershipPlans]);

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
                {/* Header */}
                <div className="flex items-center justify-between p-6 border-b sticky top-0 bg-white z-10">
                    <h2 className="text-2xl font-bold text-secondary">
                        {course ? 'Edit Course' : 'Create New Course'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-lg transition"
                    >
                        <X className="w-6 h-6 text-accent" />
                    </button>
                </div>

                {/* Form */}
                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    {/* Title */}
                    <div>
                        <label className="block text-sm font-medium text-secondary mb-2">
                            Course Title *
                        </label>
                        <input
                            type="text"
                            name="title"
                            value={formData.title}
                            onChange={handleChange}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-black"
                            placeholder="e.g., Complete Web Development Bootcamp"
                            required
                        />
                    </div>

                    {/* Description */}
                    <div>
                        <label className="block text-sm font-medium text-secondary mb-2">
                            Description *
                        </label>
                        <textarea
                            name="description"
                            value={formData.description}
                            onChange={handleChange}
                            rows={4}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none text-black"
                            placeholder="Describe what students will learn..."
                            required
                        />
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Color */}
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">
                                Color (Hex) *
                            </label>
                            <div className="flex items-center space-x-2">
                                <input
                                    type="color"
                                    name="color"
                                    value={formData.color}
                                    onChange={handleChange}
                                    className="h-12 w-12 border border-gray-300 rounded-lg cursor-pointer"
                                    required
                                />
                                <input
                                    type="text"
                                    name="color"
                                    value={formData.color}
                                    onChange={handleChange}
                                    className="flex-1 px-4 py-3 border border-gray-300 rounded-lg outline-none uppercase text-black"
                                    placeholder="#000000"
                                    pattern="^#[0-9A-Fa-f]{6}$"
                                    required
                                />
                            </div>
                        </div>

                        {/* Icon */}
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">
                                Icon (URL or Name) *
                            </label>
                            <input
                                type="text"
                                name="icon"
                                value={formData.icon}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-black"
                                placeholder="e.g., code, book, or URL"
                                required
                            />
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Duration */}
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">
                                Duration (weeks) *
                            </label>
                            <input
                                type="text"
                                name="duration"
                                value={formData.duration}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-black"
                                placeholder="e.g. 6 weeks"
                                required
                            />
                        </div>

                        {/* Category */}
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">
                                Category *
                            </label>
                            <select
                                name="category"
                                value={formData.category}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none capitalize text-black"
                                required
                            >
                                <option value="">Select Category</option>
                                {categoriesToDisplay.map(cat => (
                                    <option key={cat} value={cat}>{cat.charAt(0).toUpperCase() + cat.slice(1)}</option>
                                ))}
                            </select>
                            {selectedPlansData.length > 0 && derivedCategories.size > 0 && (
                                <p className="text-xs text-primary mt-1">
                                    Options restricted by selected membership plans.
                                </p>
                            )}
                        </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Status */}
                        <div>
                            <label className="block text-sm font-medium text-secondary mb-2">
                                Status *
                            </label>
                            <select
                                name="status"
                                value={formData.status}
                                onChange={handleChange}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-black"
                                required
                            >
                                <option value="draft">Draft</option>
                                <option value="published">Published</option>
                                <option value="archived">Archived</option>
                            </select>
                        </div>
                    </div>

                    {/* Membership Access */}
                    <div>
                        <label className="block text-sm font-medium text-secondary mb-2">
                            Included in Restricted Plans (Auto-Enroll)
                        </label>
                        {loadingPlans ? (
                            <p className="text-sm text-gray-500">Loading plans...</p>
                        ) : membershipPlans.length === 0 ? (
                            <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg text-sm">
                                No plans exist. Please ask the admin to create a membership plan first.
                            </div>
                        ) : (
                            <div className="flex flex-wrap gap-4">
                                {membershipPlans.map((plan) => (
                                    <label key={plan._id} className="flex items-center space-x-2 cursor-pointer">
                                        <input
                                            type="checkbox"
                                            checked={(formData.includedInPlans || []).includes(plan.slug)}
                                            onChange={() => handlePlanChange(plan.slug)}
                                            className="w-5 h-5 rounded border-gray-300 text-primary focus:ring-primary"
                                        />
                                        <span className="capitalize text-black">{plan.title}</span>
                                    </label>
                                ))}
                            </div>
                        )}
                        <p className="text-xs text-gray-500 mt-1">
                            Users on these plans will be automatically enrolled in this course upon purchase.
                        </p>
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="block text-sm font-medium text-secondary mb-2">
                            Tags (comma separated) *
                        </label>
                        <input
                            type="text"
                            value={tagsInput}
                            onChange={(e) => setTagsInput(e.target.value)}
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-black"
                            placeholder="e.g., web, development, coding"
                            required
                        />
                    </div>

                    {/* Thumbnail URL */}
                    <div>
                        <label className="block text-sm font-medium text-secondary mb-2">
                            Thumbnail *
                        </label>
                        <div className="space-y-3">
                            {/* Preview */}
                            {formData.thumbnailUrl && (
                                <div className="relative w-full h-40 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                                    <Image
                                        src={formData.thumbnailUrl}
                                        alt="Thumbnail Preview"
                                        fill
                                        unoptimized
                                        className="object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/400x200?text=Invalid+Image';
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setFormData((prev: Course) => ({ ...prev, thumbnailUrl: '' }))}
                                        className="absolute top-2 right-2 p-1 bg-white/80 rounded-full hover:bg-white text-red-500"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}

                            {/* Upload & Url Input */}
                            <div className="flex gap-3 items-center">
                                <div className="flex-1">
                                    <input
                                        type="url"
                                        name="thumbnailUrl"
                                        value={formData.thumbnailUrl}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm text-black"
                                        placeholder="https://example.com/image.jpg"
                                        required
                                    />
                                </div>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleFileUpload(e, 'thumbnailUrl', 'thumbnail')}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-secondary rounded-lg border border-gray-300 text-sm font-medium transition whitespace-nowrap"
                                    >
                                        Upload Image
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Banner URL */}
                    <div>
                        <label className="block text-sm font-medium text-secondary mb-2">
                            Banner *
                        </label>
                        <div className="space-y-3">
                            {/* Preview */}
                            {formData.bannerUrl && (
                                <div className="relative w-full h-32 bg-gray-100 rounded-lg overflow-hidden border border-gray-200">
                                    <Image
                                        src={formData.bannerUrl}
                                        alt="Banner Preview"
                                        fill
                                        unoptimized
                                        className="object-cover"
                                        onError={(e) => {
                                            (e.target as HTMLImageElement).src = 'https://via.placeholder.com/600x200?text=Invalid+Image';
                                        }}
                                    />
                                    <button
                                        type="button"
                                        onClick={() => setFormData((prev: Course) => ({ ...prev, bannerUrl: '' }))}
                                        className="absolute top-2 right-2 p-1 bg-white/80 rounded-full hover:bg-white text-red-500"
                                    >
                                        <X size={16} />
                                    </button>
                                </div>
                            )}

                            {/* Upload & Url Input */}
                            <div className="flex gap-3 items-center">
                                <div className="flex-1">
                                    <input
                                        type="url"
                                        name="bannerUrl"
                                        value={formData.bannerUrl}
                                        onChange={handleChange}
                                        className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-sm text-black"
                                        placeholder="https://example.com/banner.jpg"
                                        required
                                    />
                                </div>
                                <div className="relative">
                                    <input
                                        type="file"
                                        accept="image/*"
                                        onChange={(e) => handleFileUpload(e, 'bannerUrl', 'banner')}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        disabled={loading}
                                    />
                                    <button
                                        type="button"
                                        className="px-4 py-3 bg-gray-100 hover:bg-gray-200 text-secondary rounded-lg border border-gray-300 text-sm font-medium transition whitespace-nowrap"
                                    >
                                        Upload Image
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>

                    {/* Actions */}
                    <div className="flex items-center justify-end space-x-3 pt-4 border-t">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-3 border border-gray-300 text-secondary rounded-lg hover:bg-gray-50 transition font-medium"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading}
                            className="px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition font-medium disabled:opacity-50 disabled:cursor-not-allowed flex items-center space-x-2"
                        >
                            {loading ? (
                                <>
                                    <div className="w-5 h-5 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                    <span>Saving...</span>
                                </>
                            ) : (
                                <span>{course ? 'Update Course' : 'Create Course'}</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
