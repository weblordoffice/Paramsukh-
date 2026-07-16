'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Settings, UserPlus, Edit, Trash2, Mail, Shield, Search, Video, Upload, Brain } from 'lucide-react';
import { useAuthStore } from '@/lib/store/authStore';
import AdminModal, { type AdminUser } from './AdminModal';

export default function SettingsPage() {
    const router = useRouter();
    const user = useAuthStore((s) => s.user);
    const isSuperAdmin = user?.role === 'super_admin';

    const [admins, setAdmins] = useState<AdminUser[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedAdmin, setSelectedAdmin] = useState<AdminUser | null>(null);
    const [welcomeVideoUrl, setWelcomeVideoUrl] = useState('');
    const [savingVideo, setSavingVideo] = useState(false);
    const [uploading, setUploading] = useState(false);

    // Mappings Configuration States
    const [mappings, setMappings] = useState<any>(null);
    const [savingMappings, setSavingMappings] = useState(false);

    const handleVideoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        if (!file.type.startsWith('video/')) {
            toast.error('Please select a valid video file (e.g. .mp4)');
            return;
        }

        setUploading(true);
        const toastId = toast.loading('Uploading video file...');

        try {
            const formData = new FormData();
            formData.append('video', file);

            const response = await apiClient.post('/api/upload/video', formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.data?.success && response.data?.data?.url) {
                const uploadedUrl = response.data.data.url;
                setWelcomeVideoUrl(uploadedUrl);
                toast.success('Video uploaded successfully!', { id: toastId });
                
                // Save it immediately to the settings config
                const saveResponse = await apiClient.post('/api/config/welcome-video', {
                    videoUrl: uploadedUrl
                });
                if (saveResponse.data?.success) {
                    toast.success('Welcome video updated to your upload');
                }
            } else {
                toast.error(response.data?.message || 'Failed to upload video', { id: toastId });
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Upload failed', { id: toastId });
        } finally {
            setUploading(false);
        }
    };

    const fetchAdmins = useCallback(async () => {
        try {
            const response = await apiClient.get('/api/admin/users');
            if (response.data.success && Array.isArray(response.data.admins)) {
                setAdmins(response.data.admins);
            } else {
                setAdmins([]);
            }
        } catch (error: unknown) {
            const err = error as { response?: { status: number; data?: { message?: string } } };
            if (err.response?.status === 403) {
                toast.error('You do not have permission to manage admins');
                router.replace('/dashboard');
            } else {
                toast.error(err.response?.data?.message || 'Failed to load admins');
                setAdmins([]);
            }
        } finally {
            setLoading(false);
        }
    }, [router]);

    const fetchWelcomeVideo = useCallback(async () => {
        try {
            const response = await apiClient.get('/api/config/welcome-video');
            if (response.data?.success && response.data?.videoUrl) {
                setWelcomeVideoUrl(response.data.videoUrl);
            }
        } catch (error) {
            console.error('Failed to load welcome video URL:', error);
        }
    }, []);

    const fetchMappings = useCallback(async () => {
        try {
            const response = await apiClient.get('/api/config/recommendation-mappings');
            if (response.data?.success && response.data?.mappings) {
                setMappings(response.data.mappings);
            }
        } catch (error) {
            console.error('Failed to load recommendation mappings:', error);
        }
    }, []);

    useEffect(() => {
        if (!isSuperAdmin) {
            router.replace('/dashboard');
            return;
        }
        fetchAdmins();
        fetchWelcomeVideo();
        fetchMappings();
    }, [isSuperAdmin, router, fetchAdmins, fetchWelcomeVideo, fetchMappings]);

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

    const handleSaveWelcomeVideo = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!welcomeVideoUrl.trim()) {
            toast.error('Please enter a valid video URL');
            return;
        }
        setSavingVideo(true);
        try {
            const response = await apiClient.post('/api/config/welcome-video', {
                videoUrl: welcomeVideoUrl.trim()
            });
            if (response.data?.success) {
                toast.success('Welcome video URL updated successfully');
            } else {
                toast.error(response.data?.message || 'Failed to update welcome video');
            }
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Failed to update welcome video');
        } finally {
            setSavingVideo(false);
        }
    };

    const handleCreate = () => {
        setSelectedAdmin(null);
        setIsModalOpen(true);
    };

    const handleEdit = (admin: AdminUser) => {
        setSelectedAdmin(admin);
        setIsModalOpen(true);
    };

    const handleDelete = async (admin: AdminUser) => {
        if (admin._id === user?._id) {
            toast.error('You cannot delete yourself');
            return;
        }
        if (!confirm(`Remove admin "${admin.name}" (${admin.email})? They will no longer be able to log in.`)) {
            return;
        }
        try {
            await apiClient.delete(`/api/admin/users/${admin._id}`);
            toast.success('Admin removed');
            fetchAdmins();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Failed to remove admin');
        }
    };

    const filteredAdmins = admins.filter((a) => {
        const term = searchTerm.toLowerCase();
        return (
            a.name.toLowerCase().includes(term) ||
            a.email.toLowerCase().includes(term) ||
            (a.role && a.role.toLowerCase().includes(term))
        );
    });

    const permissionLabel = (key: string) => {
        const labels: Record<string, string> = {
            manage_users: 'Users',
            manage_courses: 'Courses',
            manage_events: 'Events',
            manage_community: 'Community',
            manage_shop: 'Shop',
            manage_orders: 'Orders',
            manage_content: 'Content',
            manage_admins: 'Admins',
            view_analytics: 'Analytics',
        };
        return labels[key] || key;
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

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-secondary flex items-center gap-2">
                        <Settings className="w-8 h-8" />
                        Settings
                    </h1>
                    <p className="text-accent mt-1">Manage admins: create accounts and assign what they can do</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center space-x-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition duration-200 font-medium shadow-lg shadow-primary/30"
                >
                    <UserPlus className="w-5 h-5" />
                    <span>Add Admin</span>
                </button>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-md">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-accent" />
                    <input
                        type="text"
                        placeholder="Search by name or email..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-black"
                    />
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-accent uppercase tracking-wider">
                                    Admin
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-accent uppercase tracking-wider">
                                    Role
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-accent uppercase tracking-wider">
                                    Permissions
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-accent uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-accent uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredAdmins.length === 0 ? (
                                <tr>
                                    <td colSpan={5} className="px-6 py-12 text-center text-accent">
                                        No admins found
                                    </td>
                                </tr>
                            ) : (
                                filteredAdmins.map((admin) => (
                                    <tr key={admin._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium text-secondary">{admin.name}</div>
                                            <div className="flex items-center gap-2 text-accent text-sm mt-0.5">
                                                <Mail className="w-3.5 h-3.5" />
                                                <span>{admin.email}</span>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full text-xs font-medium ${admin.role === 'super_admin' ? 'bg-amber-100 text-amber-800' : 'bg-blue-100 text-blue-800'}`}>
                                                <Shield className="w-3.5 h-3.5" />
                                                {admin.role === 'super_admin' ? 'Super Admin' : 'Admin'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            {admin.role === 'super_admin' ? (
                                                <span className="text-xs text-gray-500">All access</span>
                                            ) : admin.permissions?.length ? (
                                                <div className="flex flex-wrap gap-1">
                                                    {(admin.permissions as string[]).map((p) => (
                                                        <span key={p} className="px-2 py-0.5 bg-gray-100 text-gray-700 rounded text-xs">
                                                            {permissionLabel(p)}
                                                        </span>
                                                    ))}
                                                </div>
                                            ) : (
                                                <span className="text-xs text-gray-400">None</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${(admin as AdminUser & { isActive?: boolean }).isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'}`}>
                                                {(admin as AdminUser & { isActive?: boolean }).isActive !== false ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center gap-2">
                                                <button
                                                    onClick={() => handleEdit(admin)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                    title="Edit"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(admin)}
                                                    disabled={admin._id === user?._id}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50 disabled:cursor-not-allowed"
                                                    title="Remove"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                ))
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            <div className="bg-white rounded-xl shadow-md p-6 mt-8">
                <div className="flex items-center gap-2 border-b border-gray-100 pb-4 mb-4">
                    <Video className="w-6 h-6 text-primary" />
                    <h2 className="text-xl font-bold text-secondary">Global App Settings</h2>
                </div>
                <form onSubmit={handleSaveWelcomeVideo} className="space-y-6 max-w-4xl">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        <div>
                            <label className="block text-sm font-semibold text-secondary mb-2">
                                Welcome Intro Video URL
                            </label>
                            <input
                                type="text"
                                placeholder="e.g. https://www.youtube.com/watch?v=dQw4w9WgXcQ or direct link"
                                value={welcomeVideoUrl}
                                onChange={(e) => setWelcomeVideoUrl(e.target.value)}
                                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-black"
                            />
                            <p className="text-xs text-accent mt-2">
                                Enter a YouTube link or a direct video URL path.
                            </p>
                        </div>

                        <div>
                            <label className="block text-sm font-semibold text-secondary mb-2">
                                Or Upload Video File
                            </label>
                            <div className="relative">
                                <input
                                    type="file"
                                    accept="video/*"
                                    id="welcome-video-upload"
                                    onChange={handleVideoUpload}
                                    disabled={uploading || savingVideo}
                                    className="hidden"
                                />
                                <label
                                    htmlFor="welcome-video-upload"
                                    className={`flex items-center justify-center gap-2 w-full px-4 py-3 border-2 border-dashed border-gray-300 hover:border-primary rounded-lg cursor-pointer text-gray-500 hover:text-primary transition duration-200 ${uploading ? 'opacity-50 cursor-not-allowed' : ''}`}
                                >
                                    <Upload className="w-5 h-5" />
                                    <span className="font-medium text-sm">
                                        {uploading ? 'Uploading Video...' : 'Choose MP4 / Video File'}
                                    </span>
                                </label>
                            </div>
                            <p className="text-xs text-accent mt-2">
                                Upload a video from your computer (Max size: 2 GB).
                            </p>
                        </div>
                    </div>

                    <div className="flex items-center justify-between border-t border-gray-100 pt-4">
                        <p className="text-xs text-accent">
                            Note: Directly uploaded files will play in the premium native mobile player. YouTube videos will play in the embedded webview.
                        </p>
                        <button
                            type="submit"
                            disabled={savingVideo || uploading}
                            className="flex items-center space-x-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition duration-200 font-medium disabled:opacity-50 shadow-md shadow-primary/30"
                        >
                            <span>{savingVideo ? 'Saving...' : 'Save Settings'}</span>
                        </button>
                    </div>
                </form>
            </div>

            {mappings && (
                <div className="bg-white rounded-xl shadow-md p-6 mt-8">
                    <div className="flex items-center gap-2 border-b border-gray-100 pb-4 mb-6">
                        <Brain className="w-6 h-6 text-primary" />
                        <h2 className="text-xl font-bold text-secondary">AI Course Recommendation Mappings</h2>
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
            )}

            <AdminModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                admin={selectedAdmin}
                onSuccess={fetchAdmins}
            />
        </div>
    );
}
