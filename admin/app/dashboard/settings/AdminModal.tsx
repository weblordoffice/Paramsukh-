'use client';

import { useState, useEffect } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { X, User, Mail, Lock, Shield, CheckSquare } from 'lucide-react';

const PERMISSION_OPTIONS: { value: string; label: string }[] = [
    { value: 'manage_users', label: 'Manage Users' },
    { value: 'manage_courses', label: 'Manage Courses' },
    { value: 'manage_events', label: 'Manage Events' },
    { value: 'manage_community', label: 'Manage Community' },
    { value: 'manage_shop', label: 'Manage Shop' },
    { value: 'manage_orders', label: 'Manage Orders' },
    { value: 'manage_content', label: 'Manage Content (Videos, PDFs)' },
    { value: 'manage_admins', label: 'Manage Admins' },
    { value: 'view_analytics', label: 'View Analytics' },
];

export interface AdminUser {
    _id: string;
    name: string;
    email: string;
    role: 'super_admin' | 'admin';
    permissions: string[];
    isActive?: boolean;
}

interface AdminModalProps {
    isOpen: boolean;
    onClose: () => void;
    admin?: AdminUser | null;
    onSuccess: () => void;
}

export default function AdminModal({ isOpen, onClose, admin, onSuccess }: AdminModalProps) {
    const [formData, setFormData] = useState({
        name: '',
        email: '',
        password: '',
        role: 'admin' as 'super_admin' | 'admin',
        permissions: [] as string[],
        isActive: true,
    });
    const [loading, setLoading] = useState(false);

    useEffect(() => {
        if (admin) {
            setFormData({
                name: admin.name || '',
                email: admin.email || '',
                password: '',
                role: admin.role || 'admin',
                permissions: admin.permissions || [],
                isActive: admin.isActive ?? true,
            });
        } else {
            setFormData({
                name: '',
                email: '',
                password: '',
                role: 'admin',
                permissions: [],
                isActive: true,
            });
        }
    }, [admin, isOpen]);

    if (!isOpen) return null;

    const togglePermission = (perm: string) => {
        setFormData((prev) => ({
            ...prev,
            permissions: prev.permissions.includes(perm)
                ? prev.permissions.filter((p) => p !== perm)
                : [...prev.permissions, perm],
        }));
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);
        try {
            if (admin?._id) {
                await apiClient.put(`/api/admin/users/${admin._id}`, {
                    name: formData.name,
                    email: formData.email,
                    role: formData.role,
                    permissions: formData.permissions,
                    isActive: formData.isActive,
                });
                toast.success('Admin updated successfully');
            } else {
                await apiClient.post('/api/admin/users', {
                    name: formData.name,
                    email: formData.email,
                    ...(formData.password?.trim() ? { password: formData.password } : {}),
                    role: formData.role,
                    permissions: formData.permissions,
                });
                toast.success('Admin added. They can sign in with Google using this email.');
            }
            onSuccess();
            onClose();
        } catch (error: unknown) {
            const err = error as { response?: { data?: { message?: string } } };
            toast.error(err.response?.data?.message || 'Failed to save admin');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50 backdrop-blur-sm">
            <div className="bg-white rounded-2xl w-full max-w-lg shadow-xl overflow-hidden max-h-[90vh] overflow-y-auto">
                <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50 sticky top-0">
                    <h2 className="text-xl font-bold text-gray-800">
                        {admin ? 'Edit Admin' : 'Add Admin'}
                    </h2>
                    <button type="button" onClick={onClose} className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-4">
                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Name</label>
                        <div className="relative">
                            <User className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="text"
                                required
                                value={formData.name}
                                onChange={(e) => setFormData({ ...formData, name: e.target.value })}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-black"
                                placeholder="Admin name"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Email</label>
                        <div className="relative">
                            <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="email"
                                required
                                value={formData.email}
                                onChange={(e) => setFormData({ ...formData, email: e.target.value })}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-black"
                                placeholder="admin@example.com"
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">
                            Password {admin ? '(leave blank to keep current)' : '(optional – leave blank for Google-only sign-in)'}
                        </label>
                        <div className="relative">
                            <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <input
                                type="password"
                                value={formData.password}
                                onChange={(e) => setFormData({ ...formData, password: e.target.value })}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-black"
                                placeholder={admin ? '••••••••' : 'Optional'}
                            />
                        </div>
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Role</label>
                        <div className="relative">
                            <Shield className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                            <select
                                value={formData.role}
                                onChange={(e) => setFormData({ ...formData, role: e.target.value as 'super_admin' | 'admin' })}
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none appearance-none bg-white text-black"
                            >
                                <option value="admin">Admin</option>
                                <option value="super_admin">Super Admin</option>
                            </select>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">Super Admin has full access. Admin uses permissions below.</p>
                    </div>

                    {formData.role === 'admin' && (
                        <div>
                            <label className="flex items-center gap-2 text-sm font-medium text-gray-700 mb-2">
                                <CheckSquare className="w-4 h-4" />
                                Permissions
                            </label>
                            <div className="grid grid-cols-1 gap-2 p-3 bg-gray-50 rounded-lg border max-h-48 overflow-y-auto">
                                {PERMISSION_OPTIONS.map((opt) => (
                                    <label key={opt.value} className="flex items-center gap-2 cursor-pointer text-sm">
                                        <input
                                            type="checkbox"
                                            checked={formData.permissions.includes(opt.value)}
                                            onChange={() => togglePermission(opt.value)}
                                            className="rounded border-gray-300 text-primary focus:ring-primary"
                                        />
                                        <span className="text-gray-700">{opt.label}</span>
                                    </label>
                                ))}
                            </div>
                        </div>
                    )}

                    {admin && (
                        <div className="flex items-center justify-between p-3 bg-gray-50 rounded-lg border">
                            <span className="text-sm font-medium text-gray-700">Account Active</span>
                            <label className="relative inline-flex items-center cursor-pointer">
                                <input
                                    type="checkbox"
                                    checked={formData.isActive}
                                    onChange={(e) => setFormData({ ...formData, isActive: e.target.checked })}
                                    className="sr-only peer"
                                />
                                <div className="w-11 h-6 bg-gray-200 peer-focus:outline-none peer-focus:ring-4 peer-focus:ring-blue-300 rounded-full peer peer-checked:after:translate-x-full peer-checked:after:border-white after:content-[''] after:absolute after:top-[2px] after:left-[2px] after:bg-white after:border after:rounded-full after:h-5 after:w-5 after:transition-all peer-checked:bg-green-500" />
                            </label>
                        </div>
                    )}

                    <div className="flex gap-3 pt-2">
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
                                <span>{admin ? 'Update Admin' : 'Create Admin'}</span>
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
