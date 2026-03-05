'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Settings, UserPlus, Edit, Trash2, Mail, Shield, Search } from 'lucide-react';
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

    useEffect(() => {
        if (!isSuperAdmin) {
            router.replace('/dashboard');
            return;
        }
        fetchAdmins();
    }, [isSuperAdmin, router]);

    const fetchAdmins = async () => {
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

            <AdminModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                admin={selectedAdmin}
                onSuccess={fetchAdmins}
            />
        </div>
    );
}
