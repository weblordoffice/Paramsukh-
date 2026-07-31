'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Brain } from 'lucide-react';
import { useAuthStore } from '@/lib/store/authStore';

export default function AIRecommendationsPage() {
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const isSuperAdmin = user?.role === 'super_admin';

    const [mappings, setMappings] = useState<any>(null);
    const [loading, setLoading] = useState(true);
    const [savingMappings, setSavingMappings] = useState(false);

    const fetchMappings = useCallback(async () => {
        try {
            const response = await apiClient.get('/api/config/recommendation-mappings');
            if (response.data?.success && response.data?.mappings) {
                setMappings(response.data.mappings);
            }
        } catch (error) {
            console.error('Failed to load recommendation mappings:', error);
            toast.error('Failed to load recommendation mappings');
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        if (!isSuperAdmin) {
            router.replace('/dashboard');
            return;
        }
        fetchMappings();
    }, [isSuperAdmin, router, fetchMappings]);

    const handleSaveMappings = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!mappings) return;
        setSavingMappings(true);
        try {
            const response = await apiClient.post('/api/config/recommendation-mappings', {
                mappings
            });
            if (response.data?.success) {
                toast.success('Recommendation mappings saved successfully');
            } else {
                toast.error(response.data?.message || 'Failed to save mappings');
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Failed to save mappings');
        } finally {
            setSavingMappings(false);
        }
    };

    if (!isSuperAdmin) {
        return (
            <div className="flex items-center justify-center h-64">
                <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    if (!mappings) {
        return (
            <div className="flex items-center justify-center h-64">
                <p className="text-accent">No recommendation mappings configured yet.</p>
            </div>
        );
    }

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-secondary flex items-center gap-2">
                        <Brain className="w-8 h-8" />
                        AI Recommendations
                    </h1>
                    <p className="text-accent mt-1">
                        Configure how AI matches courses to wellness concerns. Set categories, priority tags, and fallback explanations for each concern type.
                    </p>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-4 mb-6">
                    <Brain className="w-6 h-6 text-primary" />
                    <h2 className="text-xl font-bold text-secondary">Course Recommendation Mappings</h2>
                </div>
                <form onSubmit={handleSaveMappings} className="space-y-8 max-w-4xl">
                    <div className="space-y-6 divide-y divide-gray-100">
                        {Object.keys(mappings).map((issueKey) => {
                            const issueLabel = issueKey
                                .replace(/Issue$/, '')
                                .replace(/([A-Z])/g, ' $1')
                                .replace(/^./, (str) => str.toUpperCase());
                            return (
                                <div key={issueKey} className="pt-6 first:pt-0 grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="md:col-span-1">
                                        <h3 className="text-sm font-semibold text-secondary">{issueLabel}</h3>
                                        <p className="text-xs text-accent mt-1">
                                            Configure course categories, priority tags, and fallback explanation for this concern.
                                        </p>
                                    </div>
                                    <div className="md:col-span-2 space-y-4">
                                        <div className="grid grid-cols-2 gap-4">
                                            <div>
                                                <label className="block text-xs font-semibold text-accent mb-1">
                                                    Primary Category
                                                </label>
                                                <select
                                                    value={mappings[issueKey]?.category || 'general'}
                                                    onChange={(e) => {
                                                        const val = e.target.value;
                                                        setMappings((prev: any) => ({
                                                            ...prev,
                                                            [issueKey]: {
                                                                ...prev[issueKey],
                                                                category: val,
                                                            },
                                                        }));
                                                    }}
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-black bg-white text-sm"
                                                >
                                                    <option value="physical">Physical Wellness</option>
                                                    <option value="mental">Mental Wellness</option>
                                                    <option value="financial">Financial Abundance</option>
                                                    <option value="relationship">Relationship Harmony</option>
                                                    <option value="spiritual">Spiritual Growth</option>
                                                    <option value="general">General/Lifestyle</option>
                                                </select>
                                            </div>
                                            <div>
                                                <label className="block text-xs font-semibold text-accent mb-1">
                                                    Secondary Categories (comma-separated)
                                                </label>
                                                <input
                                                    type="text"
                                                    value={(mappings[issueKey]?.secondaryCategories || []).join(', ')}
                                                    onChange={(e) => {
                                                        const val = e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean);
                                                        setMappings((prev: any) => ({
                                                            ...prev,
                                                            [issueKey]: {
                                                                ...prev[issueKey],
                                                                secondaryCategories: val,
                                                            },
                                                        }));
                                                    }}
                                                    placeholder="e.g. mental, spiritual"
                                                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-black text-sm"
                                                />
                                            </div>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-accent mb-1">
                                                Priority Tags (comma-separated)
                                            </label>
                                            <input
                                                type="text"
                                                value={(mappings[issueKey]?.priorityTags || []).join(', ')}
                                                onChange={(e) => {
                                                    const val = e.target.value.split(',').map((s: string) => s.trim()).filter(Boolean);
                                                    setMappings((prev: any) => ({
                                                        ...prev,
                                                        [issueKey]: {
                                                            ...prev[issueKey],
                                                            priorityTags: val,
                                                        },
                                                    }));
                                                }}
                                                placeholder="e.g. meditation, stress-relief, mindfulness"
                                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-black text-sm"
                                            />
                                            <p className="text-xs text-accent mt-1">Courses with these tags get higher relevance scores.</p>
                                        </div>
                                        <div>
                                            <label className="block text-xs font-semibold text-accent mb-1">
                                                Fallback Explanation Template
                                            </label>
                                            <textarea
                                                rows={2}
                                                value={mappings[issueKey]?.template || ''}
                                                onChange={(e) => {
                                                    const val = e.target.value;
                                                    setMappings((prev: any) => ({
                                                        ...prev,
                                                        [issueKey]: {
                                                            ...prev[issueKey],
                                                            template: val,
                                                        },
                                                    }));
                                                }}
                                                placeholder="Enter fallback explanation template"
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-black"
                                            />
                                        </div>
                                    </div>
                                </div>
                            );
                        })}
                    </div>
                    <div className="flex justify-end border-t border-gray-100 pt-4">
                        <button
                            type="submit"
                            disabled={savingMappings}
                            className="flex items-center space-x-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition duration-200 font-medium disabled:opacity-50 shadow-md shadow-primary/30"
                        >
                            <span>{savingMappings ? 'Saving Mappings...' : 'Save Mappings'}</span>
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
