'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Search, UserPlus, Edit, Trash2, Mail, Phone, Crown, FileText, Loader2, Filter, Tags, Upload, Link2, Eye } from 'lucide-react';
import UserModal from './UserModal';
import AssessmentModal from './AssessmentModal';
import BulkImportModal from './BulkImportModal';
import MembershipPaymentLinkModal from './MembershipPaymentLinkModal';

interface User {
    _id: string;
    displayName: string;
    name?: string; // fallback
    email: string;
    phone: string;
    subscriptionPlan: string;
    membershipType?: string; // fallback
    createdAt: string;
    isActive?: boolean;
    assessmentCompleted?: boolean;
    tags?: string[];
}

export default function UsersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPlan, setSelectedPlan] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [selectedTag, setSelectedTag] = useState('all');

    // User Modal State
    const [isModalOpen, setIsModalOpen] = useState(false); // For User Create/Edit
    const [selectedUser, setSelectedUser] = useState<User | null>(null);
    const [isBulkImportOpen, setIsBulkImportOpen] = useState(false);
    const [paymentLinkUser, setPaymentLinkUser] = useState<User | null>(null);

    // Assessment Modal State
    const [isAssessmentModalOpen, setIsAssessmentModalOpen] = useState(false);
    const [assessmentData, setAssessmentData] = useState<any>(null);
    const [loadingAssessment, setLoadingAssessment] = useState(false);

    useEffect(() => {
        fetchUsers();
    }, []);

    const fetchUsers = async () => {
        try {
            const response = await apiClient.get('/api/user/all');
            const fetchedUsers = response.data.users || response.data || [];
            setUsers(fetchedUsers);
        } catch (error: any) {
            if (error.response?.status !== 404) {
                console.error('Error fetching users:', error);
                if (error.response?.status >= 500) {
                    toast.error('Server error. Please try again later.');
                }
            }
            setUsers([]);
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setSelectedUser(null);
        setIsModalOpen(true);
    };

    const handleEdit = (user: User) => {
        setSelectedUser(user);
        setIsModalOpen(true);
    };

    const handleDelete = async (userId: string) => {
        if (!confirm('Are you sure you want to delete this user? This action cannot be undone.')) {
            return;
        }

        try {
            await apiClient.delete(`/api/user/${userId}`);
            toast.success('User deleted successfully');
            fetchUsers();
        } catch (error: any) {
            console.error('Error deleting user:', error);
            toast.error(error.response?.data?.message || 'Failed to delete user');
        }
    };

    const handleViewAssessment = async (user: User) => {
        setLoadingAssessment(true);
        setSelectedUser(user); // Set context for name display
        try {
            const response = await apiClient.get(`/api/assessment/admin/user/${user._id}`);

            if (response.data.success) {
                setAssessmentData(response.data.data.assessment);
                setIsAssessmentModalOpen(true);
            } else {
                toast.error('Could not load assessment');
            }
        } catch (error: any) {
            // Handle 404 (Not Found) gracefully
            if (error.response?.status === 404) {
                toast('This user has not completed the assessment yet.', {
                    icon: 'ℹ️',
                    style: {
                        borderRadius: '10px',
                        background: '#333',
                        color: '#fff',
                    },
                });
            } else {
                console.error('Error fetching assessment:', error);
                toast.error('Failed to fetch assessment details');
            }
        } finally {
            setLoadingAssessment(false);
        }
    };

    const handleGeneratePaymentLink = (user: User) => {
        setPaymentLinkUser(user);
    };

    const planOptions = Array.from(
        new Set(
            users
                .map((user) => String(user.subscriptionPlan || user.membershipType || 'free').toLowerCase())
                .filter(Boolean)
        )
    ).sort();

    const tagOptions = Array.from(
        new Set(
            users
                .flatMap((user) => Array.isArray(user.tags) ? user.tags : [])
                .map((tag) => String(tag || '').toLowerCase().trim())
                .filter(Boolean)
        )
    ).sort();

    const filteredUsers = users.filter(user => {
        const name = user.displayName || user.name || '';
        const email = user.email || '';
        const phone = user.phone || '';
        const tags = Array.isArray(user.tags) ? user.tags : [];
        const term = searchTerm.toLowerCase();
        const userPlan = String(user.subscriptionPlan || user.membershipType || 'free').toLowerCase();
        const userStatus = user.isActive === false ? 'inactive' : 'active';

        const matchesSearch = !term ||
            name.toLowerCase().includes(term) ||
            email.toLowerCase().includes(term) ||
            phone.includes(term) ||
            tags.some((tag) => tag.toLowerCase().includes(term));

        const matchesPlan = selectedPlan === 'all' || userPlan === selectedPlan;
        const matchesStatus = selectedStatus === 'all' || userStatus === selectedStatus;
        const matchesTag = selectedTag === 'all' || tags.some((tag) => tag.toLowerCase() === selectedTag);

        return matchesSearch && matchesPlan && matchesStatus && matchesTag;
    });

    const getPlanColor = (plan: string) => {
        switch (plan?.toLowerCase()) {
            case 'free': return 'bg-gray-100 text-gray-700';
            case 'bronze': return 'bg-orange-100 text-orange-700';
            case 'silver': return 'bg-slate-200 text-slate-700';
            case 'gold1':
            case 'gold2': return 'bg-yellow-100 text-yellow-700';
            case 'diamond': return 'bg-cyan-100 text-cyan-700';
            default: return 'bg-purple-100 text-purple-700';
        }
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-secondary">Users Management</h1>
                    <p className="text-accent mt-1">Manage all platform users</p>
                </div>
                <div className="flex items-center gap-3">
                    <button
                        onClick={() => setIsBulkImportOpen(true)}
                        className="flex items-center space-x-2 px-5 py-3 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded-lg transition duration-200 font-medium"
                    >
                        <Upload className="w-5 h-5" />
                        <span>Bulk Import</span>
                    </button>

                    <button
                        onClick={handleCreate}
                        className="flex items-center space-x-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition duration-200 font-medium shadow-lg shadow-primary/30"
                    >
                        <UserPlus className="w-5 h-5" />
                        <span>Add User</span>
                    </button>
                </div>
            </div>

            {/* Search Bar */}
            <div className="bg-white rounded-xl p-4 shadow-md">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-accent" />
                    <input
                        type="text"
                        placeholder="Search users by name, email, phone, or tags..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                </div>

                <div className="mt-4 grid grid-cols-1 md:grid-cols-4 gap-3">
                    <div className="relative">
                        <Filter className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
                        <select
                            value={selectedPlan}
                            onChange={(e) => setSelectedPlan(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white text-sm"
                        >
                            <option value="all">All Plans</option>
                            {planOptions.map((plan) => (
                                <option key={plan} value={plan}>{plan.toUpperCase()}</option>
                            ))}
                        </select>
                    </div>

                    <div>
                        <select
                            value={selectedStatus}
                            onChange={(e) => setSelectedStatus(e.target.value)}
                            className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white text-sm"
                        >
                            <option value="all">All Status</option>
                            <option value="active">Active</option>
                            <option value="inactive">Inactive</option>
                        </select>
                    </div>

                    <div className="relative">
                        <Tags className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-accent" />
                        <select
                            value={selectedTag}
                            onChange={(e) => setSelectedTag(e.target.value)}
                            className="w-full pl-9 pr-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none bg-white text-sm"
                        >
                            <option value="all">All Tags</option>
                            {tagOptions.map((tag) => (
                                <option key={tag} value={tag}>{tag}</option>
                            ))}
                        </select>
                    </div>

                    <button
                        type="button"
                        onClick={() => {
                            setSelectedPlan('all');
                            setSelectedStatus('all');
                            setSelectedTag('all');
                            setSearchTerm('');
                        }}
                        className="px-4 py-2.5 border border-gray-300 rounded-lg hover:bg-gray-50 transition text-sm font-medium text-gray-700"
                    >
                        Clear Filters
                    </button>
                </div>
            </div>

            {/* Users Table */}
            <div className="bg-white rounded-xl shadow-md overflow-hidden">
                <div className="overflow-x-auto">
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-accent uppercase tracking-wider">
                                    User Details
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-accent uppercase tracking-wider">
                                    Contact Info
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-accent uppercase tracking-wider">
                                    Membership
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-accent uppercase tracking-wider">
                                    Tags
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-accent uppercase tracking-wider">
                                    Status
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-accent uppercase tracking-wider">
                                    Joined
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-accent uppercase tracking-wider">
                                    Actions
                                </th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredUsers.length === 0 ? (
                                <tr>
                                    <td colSpan={7} className="px-6 py-12 text-center text-accent">
                                        No users found
                                    </td>
                                </tr>
                            ) : (
                                filteredUsers.map((user) => {
                                    const effectivePlan = String(user.subscriptionPlan || user.membershipType || 'free').toLowerCase();

                                    return (
                                    <tr key={user._id} className="hover:bg-gray-50 transition-colors">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="font-medium text-secondary text-base">
                                                {user.displayName || user.name || 'N/A'}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="space-y-1">
                                                <div className="flex items-center space-x-2 text-accent text-sm">
                                                    <Mail className="w-3.5 h-3.5" />
                                                    <span>{user.email || 'N/A'}</span>
                                                </div>
                                                <div className="flex items-center space-x-2 text-accent text-sm">
                                                    <Phone className="w-3.5 h-3.5" />
                                                    <span>{user.phone || 'N/A'}</span>
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-3 py-1 rounded-full text-xs font-semibold flex items-center w-fit gap-1 ${getPlanColor(effectivePlan)}`}>
                                                {effectivePlan !== 'free' && <Crown className="w-3 h-3" />}
                                                {effectivePlan.toUpperCase()}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="flex flex-wrap gap-1.5 max-w-[220px]">
                                                {(user.tags || []).length > 0 ? (
                                                    (user.tags || []).slice(0, 3).map((tag) => (
                                                        <span key={`${user._id}-${tag}`} className="px-2 py-1 rounded bg-blue-50 text-blue-700 text-xs font-medium">
                                                            {tag}
                                                        </span>
                                                    ))
                                                ) : (
                                                    <span className="text-xs text-gray-400">No tags</span>
                                                )}
                                                {(user.tags || []).length > 3 && (
                                                    <span className="text-xs text-gray-500">+{(user.tags || []).length - 3}</span>
                                                )}
                                            </div>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 rounded text-xs font-medium ${user.isActive !== false ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                                                }`}>
                                                {user.isActive !== false ? 'Active' : 'Inactive'}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-accent text-sm">
                                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => router.push(`/dashboard/memberships/${user._id}`)}
                                                    className="p-2 text-sky-600 hover:bg-sky-50 rounded-lg transition"
                                                    title="View Membership Details"
                                                >
                                                    <Eye className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleGeneratePaymentLink(user)}
                                                    className="p-2 text-amber-600 hover:bg-amber-50 rounded-lg transition"
                                                    title="Generate Membership Payment Link"
                                                >
                                                    <Link2 className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleViewAssessment(user)}
                                                    disabled={loadingAssessment}
                                                    className="p-2 text-purple-600 hover:bg-purple-50 rounded-lg transition relative group"
                                                    title="View Assessment"
                                                >
                                                    {loadingAssessment && selectedUser?._id === user._id ? (
                                                        <Loader2 className="w-4 h-4 animate-spin" />
                                                    ) : (
                                                        <FileText className="w-4 h-4" />
                                                    )}
                                                </button>
                                                <button
                                                    onClick={() => handleEdit(user)}
                                                    className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition"
                                                    title="Edit User"
                                                >
                                                    <Edit className="w-4 h-4" />
                                                </button>
                                                <button
                                                    onClick={() => handleDelete(user._id)}
                                                    className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                                    title="Delete User"
                                                >
                                                    <Trash2 className="w-4 h-4" />
                                                </button>
                                            </div>
                                        </td>
                                    </tr>
                                    );
                                })
                            )}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Create/Edit User Modal */}
            <UserModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                user={selectedUser}
                onSuccess={fetchUsers}
            />

            <BulkImportModal
                isOpen={isBulkImportOpen}
                onClose={() => setIsBulkImportOpen(false)}
                onSuccess={fetchUsers}
            />

            {/* View Assessment Modal */}
            <AssessmentModal
                isOpen={isAssessmentModalOpen}
                onClose={() => setIsAssessmentModalOpen(false)}
                assessment={assessmentData}
                userName={selectedUser?.displayName || selectedUser?.name || 'User'}
            />

            <MembershipPaymentLinkModal
                isOpen={Boolean(paymentLinkUser)}
                onClose={() => setPaymentLinkUser(null)}
                user={paymentLinkUser}
            />
        </div>
    );
}
