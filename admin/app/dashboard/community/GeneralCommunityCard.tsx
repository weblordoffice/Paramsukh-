'use client';

import { useEffect, useState, ChangeEvent } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Globe, Save, Upload, Users } from 'lucide-react';

interface GeneralGroup {
    _id: string;
    name: string;
    description: string;
    coverImage: string | null;
    memberCount: number;
    isActive: boolean;
    isPublic: boolean;
}

export default function GeneralCommunityCard() {
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [memberCount, setMemberCount] = useState(0);
    const [form, setForm] = useState({
        name: '',
        description: '',
        coverImage: '',
        isActive: true,
    });

    const applyGroup = (g: GeneralGroup) => {
        setMemberCount(g.memberCount || 0);
        setForm({
            name: g.name || '',
            description: g.description || '',
            coverImage: g.coverImage || '',
            isActive: g.isActive !== false,
        });
    };

    useEffect(() => {
        (async () => {
            try {
                const res = await apiClient.get('/api/community/admin/groups/general');
                if (res.data?.data) applyGroup(res.data.data);
            } catch (error: any) {
                toast.error(error.response?.data?.message || 'Failed to load the General community');
            } finally {
                setLoading(false);
            }
        })();
    }, []);

    const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const data = new FormData();
        data.append('image', file);

        setUploading(true);
        try {
            const res = await apiClient.post('/api/upload/image?folder=community', data, {
                timeout: 5 * 60 * 1000,
            });
            const url = res.data?.data?.url;
            if (url) {
                setForm((prev) => ({ ...prev, coverImage: url }));
                toast.success('Cover uploaded');
            } else {
                toast.error('Upload failed');
            }
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleSave = async () => {
        if (!form.name.trim()) {
            toast.error('Name is required');
            return;
        }
        setSaving(true);
        try {
            const res = await apiClient.patch('/api/community/admin/groups/general', {
                name: form.name.trim(),
                description: form.description.trim(),
                coverImage: form.coverImage.trim() || null,
                isActive: form.isActive,
            });
            if (res.data?.data) applyGroup(res.data.data);
            toast.success('General community updated');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to update the General community');
        } finally {
            setSaving(false);
        }
    };

    return (
        <div className="bg-white rounded-xl p-6 shadow-md space-y-4">
            <div className="flex items-start justify-between">
                <div className="flex items-center gap-3">
                    <div className="p-2.5 bg-primary/10 rounded-lg">
                        <Globe className="w-6 h-6 text-primary" />
                    </div>
                    <div>
                        <h2 className="text-lg font-bold text-secondary">General Community</h2>
                        <p className="text-sm text-accent">Visible to every user — free and paid.</p>
                    </div>
                </div>
                <div className="flex items-center gap-2 text-sm text-accent">
                    <Users className="w-4 h-4" />
                    <span>{memberCount} members</span>
                </div>
            </div>

            {loading ? (
                <div className="flex justify-center py-6">
                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            ) : (
                <div className="space-y-4">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                            <input
                                value={form.name}
                                onChange={(e) => setForm((p) => ({ ...p, name: e.target.value }))}
                                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                placeholder="General Community"
                            />
                        </div>
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-1">Visibility</label>
                            <label className="flex items-center gap-2 px-3 py-2 border border-gray-300 rounded-lg cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={form.isActive}
                                    onChange={(e) => setForm((p) => ({ ...p, isActive: e.target.checked }))}
                                />
                                <span className="text-sm text-gray-700">
                                    {form.isActive ? 'Active — shown to users' : 'Disabled — hidden from users'}
                                </span>
                            </label>
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
                        <textarea
                            value={form.description}
                            onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))}
                            rows={2}
                            className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            placeholder="A public space for all users."
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Cover image</label>
                        <div className="flex gap-2">
                            <input
                                type="url"
                                value={form.coverImage}
                                onChange={(e) => setForm((p) => ({ ...p, coverImage: e.target.value }))}
                                className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                                placeholder="https://... or upload"
                            />
                            <div className="relative">
                                <input
                                    type="file"
                                    accept="image/*"
                                    onChange={handleUpload}
                                    disabled={uploading}
                                    className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                                />
                                <button
                                    type="button"
                                    disabled={uploading}
                                    className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm text-secondary flex items-center gap-1 whitespace-nowrap"
                                >
                                    <Upload className="w-4 h-4" />
                                    {uploading ? 'Uploading...' : 'Upload'}
                                </button>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end">
                        <button
                            onClick={handleSave}
                            disabled={saving}
                            className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition font-medium disabled:opacity-50"
                        >
                            <Save className="w-4 h-4" />
                            {saving ? 'Saving...' : 'Save'}
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
