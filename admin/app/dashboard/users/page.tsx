'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Search, UserPlus, Edit, Trash2, Mail, Phone, Crown, FileText, Loader2, Filter, Tags, Upload, Link2, Eye, Activity, AlertTriangle } from 'lucide-react';
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

interface AttentionUserSummary {
    userId: string;
    displayName: string;
    email?: string | null;
    phone?: string | null;
    plan?: string;
    lastActivityAt?: string | null;
    inactiveDays?: number | null;
    riskStatus: 'active' | 'at_risk' | 'inactive';
    flags: string[];
}

interface AttentionData {
    counts: {
        total: number;
        active: number;
        atRisk: number;
        inactive: number;
        stalled: number;
        overdueGoals: number;
    };
    top: AttentionUserSummary[];
    users: Array<{
        userId: string;
        lastActivityAt?: string | null;
        inactiveDays?: number | null;
        riskStatus: 'active' | 'at_risk' | 'inactive';
        flags: string[];
    }>;
}

const FLAG_LABELS: Record<string, string> = {
    account_inactive: 'Account disabled',
    inactive_30d: 'Inactive 30+ days',
    inactive_14d: 'Inactive 14+ days',
    stalled_courses: 'Stalled courses',
    not_started_courses: 'Not started',
    overdue_goals: 'Overdue goals',
    no_goals: 'No goals',
    no_enrollments: 'No enrollments',
};

export default function UsersPage() {
    const router = useRouter();
    const [users, setUsers] = useState<User[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [selectedPlan, setSelectedPlan] = useState('all');
    const [selectedStatus, setSelectedStatus] = useState('all');
    const [selectedTag, setSelectedTag] = useState('all');
    const [attention, setAttention] = useState<AttentionData | null>(null);

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
        fetchAttention();
    }, []);

    const fetchAttention = async () => {
        try {
            const response = await apiClient.get('/api/user/analytics/admin/attention');
            setAttention(response.data);
        } catch (error) {
            console.error('Error fetching user attention data:', error);
        }
    };

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

    const attentionByUserId = new Map(
        (attention?.users || []).map((item) => [String(item.userId), item])
    );

    const getRiskBadge = (status?: string) => {
        if (!status) return { label: '—', className: 'bg-gray-100 text-gray-500' };
        if (status === 'inactive') return { label: 'Inactive', className: 'bg-red-100 text-red-700' };
        if (status === 'at_risk') return { label: 'At risk', className: 'bg-amber-100 text-amber-700' };
        return { label: 'Active', className: 'bg-green-100 text-green-700' };
    };

    const formatLastActive = (value?: string | null) => {
        if (!value) return 'No activity';
        const date = new Date(value);
        if (Number.isNaN(date.getTime())) return 'No activity';
        return date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    };

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

            {/* Users Needing Attention */}
            {attention && (
                <div className="bg-white rounded-xl p-5 shadow-md">
                    <div className="flex flex-wrap items-center justify-between gap-3 mb-4">
                        <div>
                            <h2 className="text-lg font-bold text-secondary flex items-center gap-2">
                                <AlertTriangle className="w-5 h-5 text-amber-500" />
                                Users Needing Attention
                            </h2>
                            <p className="text-sm text-accent mt-1">Inactive users, stalled learners, and overdue goals.</p>
                        </div>
                        <span className="text-xs text-accent">{attention.counts.total} total users</span>
                    </div>

                    <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-4">
                        <div className="rounded-lg bg-green-50 p-3">
                            <p className="text-xs font-semibold text-green-700 uppercase">Active</p>
                            <p className="text-2xl font-bold text-green-700">{attention.counts.active}</p>
                        </div>
                        <div className="rounded-lg bg-amber-50 p-3">
                            <p className="text-xs font-semibold text-amber-700 uppercase">At risk</p>
                            <p className="text-2xl font-bold text-amber-700">{attention.counts.atRisk}</p>
                        </div>
                        <div className="rounded-lg bg-red-50 p-3">
                            <p className="text-xs font-semibold text-red-700 uppercase">Inactive</p>
                            <p className="text-2xl font-bold text-red-700">{attention.counts.inactive}</p>
                        </div>
                        <div className="rounded-lg bg-sky-50 p-3">
                            <p className="text-xs font-semibold text-sky-700 uppercase">Stalled / Overdue</p>
                            <p className="text-2xl font-bold text-sky-700">{attention.counts.stalled} / {attention.counts.overdueGoals}</p>
                        </div>
                    </div>

                    {attention.top.length > 0 && (
                        <div className="space-y-2">
                            {attention.top.slice(0, 5).map((item) => (
                                <div key={item.userId} className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-secondary">{item.displayName}</p>
                                        <p className="text-xs text-accent truncate">
                                            {item.email || item.phone || 'No contact'} · last active {formatLastActive(item.lastActivityAt)}
                                        </p>
                                        {item.flags.length > 0 && (
                                            <div className="flex flex-wrap gap-1 mt-1">
                                                {item.flags.slice(0, 3).map((flag) => (
                                                    <span key={flag} className="text-[10px] font-semibold px-1.5 py-0.5 rounded bg-amber-50 text-amber-700">
                                                        {FLAG_LABELS[flag] || flag}
                                                    </span>
                                                ))}
                                            </div>
                                        )}
                                    </div>
                                    <button
                                        onClick={() => router.push(`/dashboard/users/${item.userId}`)}
                                        className="flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-primary border border-primary/30 rounded-lg hover:bg-primary/5"
                                    >
                                        <Activity className="w-3.5 h-3.5" />
                                        Track
                                    </button>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            )}

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
                                    Last Active
                                </th>
                                <th className="px-6 py-4 text-left text-xs font-semibold text-accent uppercase tracking-wider">
                                    Risk
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
                                    <td colSpan={9} className="px-6 py-12 text-center text-accent">
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
                                            {formatLastActive(attentionByUserId.get(user._id)?.lastActivityAt)}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {(() => {
                                                const risk = attentionByUserId.get(user._id);
                                                const badge = getRiskBadge(risk?.riskStatus);
                                                return (
                                                    <span className={`px-2 py-1 rounded text-xs font-semibold ${badge.className}`}>
                                                        {badge.label}
                                                    </span>
                                                );
                                            })()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-accent text-sm">
                                            {user.createdAt ? new Date(user.createdAt).toLocaleDateString() : 'N/A'}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center space-x-2">
                                                <button
                                                    onClick={() => router.push(`/dashboard/users/${user._id}`)}
                                                    className="p-2 text-primary hover:bg-primary/10 rounded-lg transition"
                                                    title="Track user progress"
                                                >
                                                    <Activity className="w-4 h-4" />
                                                </button>
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
