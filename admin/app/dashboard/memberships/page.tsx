"use client";

import { useState, useEffect, useMemo } from "react";
import { useRouter } from "next/navigation";
import { 
  Users, Search, Download,
  Crown, TrendingUp, UserCheck, Gift, Ban, CalendarPlus2
} from "lucide-react";
import { apiClient } from "@/lib/api/client";
import toast from "react-hot-toast";
import MembershipModal from "./MembershipModal";

interface User {
  _id: string;
  displayName: string;
  email?: string;
  phone?: string;
  photoURL?: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  trialEndsAt?: string;
  createdAt: string;
  lastLoginAt?: string;
}

interface Stats {
  totalUsers: number;
  activeSubscriptions: number;
  trialUsers: number;
  totalRevenue: number;
  planBreakdown: Record<string, number>;
}

interface PlanInfo {
  _id?: string;
  slug: string;
  title: string;
  status: string;
  displayOrder: number;
  badgeColor?: string;
}

interface MembershipGrant {
  _id: string;
  status: string;
  startDate: string;
  endDate: string;
  createdAt: string;
  metadata?: {
    grantReason?: string;
    grantedBy?: string;
    revokeReason?: string;
  };
  userId?: {
    _id: string;
    displayName?: string;
    email?: string;
    phone?: string;
  };
  planId?: {
    _id: string;
    title?: string;
    slug?: string;
    status?: string;
  };
}

const FREE_PLAN: PlanInfo = {
  slug: 'free',
  title: 'Free',
  status: 'published',
  displayOrder: -1,
};

const normalize = (value: string) => String(value || '').trim().toLowerCase();

const isHexColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value || '');

export default function MembershipsPage() {
  const router = useRouter();
  const [users, setUsers] = useState<User[]>([]);
  const [availablePlans, setAvailablePlans] = useState<PlanInfo[]>([FREE_PLAN]);
  const [stats, setStats] = useState<Stats>({
    totalUsers: 0,
    activeSubscriptions: 0,
    trialUsers: 0,
    totalRevenue: 0,
    planBreakdown: {}
  });
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState("");
  const [filterPlan, setFilterPlan] = useState<string>("all");
  const [filterStatus, setFilterStatus] = useState<string>("all");
  const [selectedUser, setSelectedUser] = useState<User | null>(null);
  const [showModal, setShowModal] = useState(false);
  const [adminGrants, setAdminGrants] = useState<MembershipGrant[]>([]);
  const [grantsLoading, setGrantsLoading] = useState(false);
  const [grantSubmitting, setGrantSubmitting] = useState(false);
  const [grantForm, setGrantForm] = useState({
    userId: '',
    planId: '',
    durationDays: 90,
    reason: '',
    replaceActive: true,
  });
  const statuses = ['active', 'inactive', 'trial', 'cancelled'];

  const planLookup = useMemo(() => {
    return availablePlans.reduce<Record<string, PlanInfo>>((acc, plan) => {
      acc[normalize(plan.slug)] = plan;
      return acc;
    }, {});
  }, [availablePlans]);

  useEffect(() => {
    fetchUsers();
    fetchAvailablePlans();
    fetchAdminGrants();
  }, []);

  useEffect(() => {
    if (users.length > 0) {
      calculateStats(users);
    }
  }, [availablePlans]);

  const fetchAvailablePlans = async () => {
    try {
      const response = await apiClient.get('/api/membership-plans');
      const plans = (response.data?.data || [])
        .filter((plan: any) => String(plan?.status || 'draft') !== 'archived')
        .map((plan: any) => ({
          _id: String(plan._id || ''),
          slug: normalize(plan.slug),
          title: String(plan.title || plan.slug || '').trim(),
          status: String(plan.status || 'draft'),
          displayOrder: Number(plan.displayOrder || 0),
          badgeColor: plan?.metadata?.badgeColor,
        }))
        .filter((plan: PlanInfo) => Boolean(plan.slug));

      const dedup = new Map<string, PlanInfo>();
      dedup.set(FREE_PLAN.slug, FREE_PLAN);
      plans.forEach((plan: PlanInfo) => dedup.set(plan.slug, plan));

      setAvailablePlans(Array.from(dedup.values()).sort((a, b) => a.displayOrder - b.displayOrder));
    } catch {
      setAvailablePlans([FREE_PLAN]);
    }
  };

  const fetchUsers = async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/api/user/all");
      if (response.data.success) {
        const usersData = response.data.users || [];
        setUsers(usersData);
        calculateStats(usersData);
      }
    } catch (error: any) {
      console.error("Error fetching users:", error);
      toast.error(error.response?.data?.message || "Failed to fetch users");
    } finally {
      setLoading(false);
    }
  };

  const fetchAdminGrants = async () => {
    try {
      setGrantsLoading(true);
      const response = await apiClient.get('/api/membership-plans/admin/grants');
      if (response.data?.success) {
        setAdminGrants(response.data?.data || []);
      }
    } catch (error: any) {
      console.error('Error fetching admin grants:', error);
      toast.error(error.response?.data?.message || 'Failed to fetch complimentary grants');
    } finally {
      setGrantsLoading(false);
    }
  };

  const handleGrantMembership = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!grantForm.userId) {
      toast.error('Please select a user');
      return;
    }

    if (!grantForm.planId) {
      toast.error('Please select a membership plan');
      return;
    }

    if (!grantForm.durationDays || Number(grantForm.durationDays) <= 0) {
      toast.error('Duration must be greater than 0 days');
      return;
    }

    try {
      setGrantSubmitting(true);
      const response = await apiClient.post('/api/membership-plans/admin/grants', {
        userId: grantForm.userId,
        planId: grantForm.planId,
        durationDays: Number(grantForm.durationDays),
        reason: grantForm.reason || 'Complimentary admin grant',
        replaceActive: grantForm.replaceActive,
      });

      if (response.data?.success) {
        toast.success('Complimentary membership granted');
        setGrantForm((prev) => ({
          ...prev,
          durationDays: 90,
          reason: '',
        }));
        await Promise.all([fetchAdminGrants(), fetchUsers()]);
      }
    } catch (error: any) {
      console.error('Grant membership error:', error);
      toast.error(error.response?.data?.message || 'Failed to grant membership');
    } finally {
      setGrantSubmitting(false);
    }
  };

  const handleRevokeGrant = async (grantId: string) => {
    const reason = window.prompt('Reason for revoking this grant?', 'Revoked by admin');
    if (reason === null) {
      return;
    }

    try {
      await apiClient.patch(`/api/membership-plans/admin/grants/${grantId}/revoke`, {
        reason,
      });
      toast.success('Grant revoked successfully');
      await Promise.all([fetchAdminGrants(), fetchUsers()]);
    } catch (error: any) {
      console.error('Revoke grant error:', error);
      toast.error(error.response?.data?.message || 'Failed to revoke grant');
    }
  };

  const handleExtendGrant = async (grantId: string) => {
    const input = window.prompt('Enter number of days to extend', '30');
    if (!input) {
      return;
    }

    const extendDays = Number(input);
    if (!Number.isFinite(extendDays) || extendDays <= 0) {
      toast.error('Please enter a valid number of days');
      return;
    }

    try {
      await apiClient.patch(`/api/membership-plans/admin/grants/${grantId}/extend`, {
        extendDays,
        reason: 'Extended by admin',
      });
      toast.success('Grant extended successfully');
      await Promise.all([fetchAdminGrants(), fetchUsers()]);
    } catch (error: any) {
      console.error('Extend grant error:', error);
      toast.error(error.response?.data?.message || 'Failed to extend grant');
    }
  };

  const calculateStats = (usersData: User[]) => {
    const stats: Stats = {
      totalUsers: usersData.length,
      activeSubscriptions: usersData.filter(u => u.subscriptionStatus === 'active').length,
      trialUsers: usersData.filter(u => u.subscriptionStatus === 'trial').length,
      totalRevenue: 0,
      planBreakdown: {}
    };

    const dynamicPlanSet = new Set(['free', ...availablePlans.map((plan) => normalize(plan.slug))]);
    usersData.forEach((user) => dynamicPlanSet.add(normalize(user.subscriptionPlan || 'free')));

    Array.from(dynamicPlanSet).forEach((plan) => {
      stats.planBreakdown[plan] = usersData.filter(
        (u) => normalize(u.subscriptionPlan || 'free') === plan
      ).length;
    });

    setStats(stats);
  };

  const filteredUsers = users.filter((user) => {
    const matchesSearch = 
      user.displayName.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.email?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      user.phone?.includes(searchTerm);
    
    const matchesPlan = filterPlan === "all" || normalize(user.subscriptionPlan) === filterPlan;
    const matchesStatus = filterStatus === "all" || user.subscriptionStatus === filterStatus;

    return matchesSearch && matchesPlan && matchesStatus;
  });

  const handleEditMembership = (user: User) => {
    setSelectedUser(user);
    setShowModal(true);
  };

  const handleModalClose = () => {
    setShowModal(false);
    setSelectedUser(null);
    fetchUsers(); // Refresh after changes
  };

  const exportToCSV = () => {
    const headers = ['Name', 'Email', 'Phone', 'Plan', 'Status', 'Start Date', 'End Date', 'Joined'];
    const rows = filteredUsers.map(user => [
      user.displayName,
      user.email || 'N/A',
      user.phone || 'N/A',
      user.subscriptionPlan,
      user.subscriptionStatus,
      user.subscriptionStartDate ? new Date(user.subscriptionStartDate).toLocaleDateString() : 'N/A',
      user.subscriptionEndDate ? new Date(user.subscriptionEndDate).toLocaleDateString() : 'N/A',
      new Date(user.createdAt).toLocaleDateString()
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `memberships-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Exported to CSV');
  };

  const getPlanLabel = (planSlug: string) => {
    const slug = normalize(planSlug || 'free');
    return planLookup[slug]?.title || (slug.charAt(0).toUpperCase() + slug.slice(1));
  };

  const getPlanBadgeStyle = (planSlug: string) => {
    const slug = normalize(planSlug || 'free');
    const badgeColor = planLookup[slug]?.badgeColor;
    if (!badgeColor || !isHexColor(badgeColor)) {
      return undefined;
    }

    return {
      color: badgeColor,
      borderColor: `${badgeColor}66`,
      backgroundColor: `${badgeColor}1A`,
    };
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      active: 'bg-green-100 text-green-700',
      inactive: 'bg-gray-100 text-gray-700',
      trial: 'bg-blue-100 text-blue-700',
      cancelled: 'bg-red-100 text-red-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Crown className="w-8 h-8" />
            Membership Management
          </h1>
          <p className="text-gray-600 mt-1">
            Manage user subscriptions and membership plans
          </p>
        </div>
        <div className="flex gap-3">
          <button
            onClick={exportToCSV}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      </div>

      {/* Stats Cards */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Total Users</p>
              <p className="text-2xl font-bold text-gray-900">{stats.totalUsers}</p>
            </div>
            <Users className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Active Subscriptions</p>
              <p className="text-2xl font-bold text-green-600">{stats.activeSubscriptions}</p>
            </div>
            <UserCheck className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Trial Users</p>
              <p className="text-2xl font-bold text-blue-600">{stats.trialUsers}</p>
            </div>
            <TrendingUp className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-gray-600">Premium Plans</p>
              <p className="text-2xl font-bold text-purple-600">
                {Object.entries(stats.planBreakdown)
                  .filter(([plan]) => plan !== 'free')
                  .reduce((total, [, count]) => total + Number(count || 0), 0)}
              </p>
            </div>
            <Crown className="w-8 h-8 text-purple-500" />
          </div>
        </div>
      </div>

      {/* Complimentary Membership Grant */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-5 space-y-4">
        <div className="flex items-center gap-2">
          <Gift className="w-5 h-5 text-purple-600" />
          <h2 className="text-lg font-semibold text-gray-900">Grant Complimentary Membership</h2>
        </div>

        <form onSubmit={handleGrantMembership} className="grid grid-cols-1 md:grid-cols-5 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-600 mb-1">User</label>
            <select
              value={grantForm.userId}
              onChange={(e) => setGrantForm((prev) => ({ ...prev, userId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black"
              required
            >
              <option value="">Select user</option>
              {users.map((user) => (
                <option key={user._id} value={user._id}>
                  {user.displayName} ({user.phone || user.email || 'No contact'})
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Plan</label>
            <select
              value={grantForm.planId}
              onChange={(e) => setGrantForm((prev) => ({ ...prev, planId: e.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black"
              required
            >
              <option value="">Select plan</option>
              {availablePlans
                .filter((plan) => plan.slug !== 'free' && plan._id)
                .map((plan) => (
                  <option key={plan._id} value={plan._id}>
                    {plan.title}
                  </option>
                ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Duration (days)</label>
            <input
              type="number"
              min={1}
              value={grantForm.durationDays}
              onChange={(e) => setGrantForm((prev) => ({ ...prev, durationDays: Number(e.target.value || 0) }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black"
              required
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Action</label>
            <button
              type="submit"
              disabled={grantSubmitting}
              className="w-full px-4 py-2 bg-purple-600 hover:bg-purple-700 text-white rounded-lg text-sm font-medium disabled:opacity-60"
            >
              {grantSubmitting ? 'Granting...' : 'Grant'}
            </button>
          </div>

          <div className="md:col-span-4">
            <label className="block text-xs font-medium text-gray-600 mb-1">Reason (optional)</label>
            <input
              type="text"
              value={grantForm.reason}
              onChange={(e) => setGrantForm((prev) => ({ ...prev, reason: e.target.value }))}
              placeholder="Reason for complimentary access"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black"
            />
          </div>

          <label className="md:col-span-1 flex items-center gap-2 mt-6 text-sm text-gray-700">
            <input
              type="checkbox"
              checked={grantForm.replaceActive}
              onChange={(e) => setGrantForm((prev) => ({ ...prev, replaceActive: e.target.checked }))}
              className="w-4 h-4"
            />
            Replace active
          </label>
        </form>
      </div>

      {/* Complimentary Grants Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between">
          <h3 className="text-base font-semibold text-gray-900">Complimentary Grants</h3>
          <button
            onClick={fetchAdminGrants}
            className="px-3 py-1.5 border border-gray-300 rounded-lg text-sm text-gray-700 hover:bg-gray-50 flex items-center gap-1"
          >
            <Search className="w-4 h-4" />
            Refresh
          </button>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">User</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Validity</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Reason</th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {grantsLoading ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-gray-500" colSpan={6}>Loading grants...</td>
                </tr>
              ) : adminGrants.length === 0 ? (
                <tr>
                  <td className="px-4 py-6 text-sm text-gray-500" colSpan={6}>No complimentary grants yet.</td>
                </tr>
              ) : (
                adminGrants.map((grant) => (
                  <tr key={grant._id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 text-sm text-gray-800">
                      <div className="font-medium">{grant.userId?.displayName || 'Unknown user'}</div>
                      <div className="text-xs text-gray-500">{grant.userId?.phone || grant.userId?.email || 'No contact'}</div>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-800">{grant.planId?.title || grant.planId?.slug || 'N/A'}</td>
                    <td className="px-4 py-3 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${grant.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-700'}`}>
                        {grant.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700">
                      {new Date(grant.startDate).toLocaleDateString()} to {new Date(grant.endDate).toLocaleDateString()}
                    </td>
                    <td className="px-4 py-3 text-sm text-gray-700 max-w-[260px] truncate" title={grant.metadata?.grantReason || ''}>
                      {grant.metadata?.grantReason || '-'}
                    </td>
                    <td className="px-4 py-3 text-sm">
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => handleExtendGrant(grant._id)}
                          className="px-2 py-1 border border-blue-200 text-blue-700 hover:bg-blue-50 rounded text-xs flex items-center gap-1"
                        >
                          <CalendarPlus2 className="w-3 h-3" /> Extend
                        </button>
                        {grant.status === 'active' && (
                          <button
                            onClick={() => handleRevokeGrant(grant._id)}
                            className="px-2 py-1 border border-red-200 text-red-700 hover:bg-red-50 rounded text-xs flex items-center gap-1"
                          >
                            <Ban className="w-3 h-3" /> Revoke
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-5 h-5" />
            <input
              type="text"
              placeholder="Search by name, email, or phone..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>

          {/* Plan Filter */}
          <select
            value={filterPlan}
            onChange={(e) => setFilterPlan(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Plans</option>
            {availablePlans.map((plan) => (
              <option key={plan.slug} value={plan.slug}>
                {plan.title} ({stats.planBreakdown[plan.slug] || 0})
              </option>
            ))}
          </select>

          {/* Status Filter */}
          <select
            value={filterStatus}
            onChange={(e) => setFilterStatus(e.target.value)}
            className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500"
          >
            <option value="all">All Statuses</option>
            {statuses.map(status => (
              <option key={status} value={status}>
                {status.charAt(0).toUpperCase() + status.slice(1)}
              </option>
            ))}
          </select>
        </div>
      </div>

      {/* Results Count */}
      <div className="text-sm text-gray-600">
        Showing {filteredUsers.length} of {users.length} users
      </div>

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  User
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Contact
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Subscription Period
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Last Login
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Actions
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {filteredUsers.map((user) => (
                <tr key={user._id} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center">
                      {user.photoURL ? (
                        <img
                          src={user.photoURL}
                          alt={user.displayName}
                          className="w-10 h-10 rounded-full object-cover"
                        />
                      ) : (
                        <div className="w-10 h-10 rounded-full bg-gray-200 flex items-center justify-center">
                          <span className="text-gray-600 font-medium">
                            {user.displayName.charAt(0).toUpperCase()}
                          </span>
                        </div>
                      )}
                      <div className="ml-3">
                        <p className="text-sm font-medium text-gray-900">
                          {user.displayName}
                        </p>
                      </div>
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">{user.email || 'N/A'}</div>
                    <div className="text-sm text-gray-500">{user.phone || 'N/A'}</div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span
                      className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full border bg-gray-100 text-gray-700 border-gray-200"
                      style={getPlanBadgeStyle(user.subscriptionPlan)}
                    >
                      {getPlanLabel(user.subscriptionPlan)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(user.subscriptionStatus)}`}>
                      {user.subscriptionStatus.charAt(0).toUpperCase() + user.subscriptionStatus.slice(1)}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.subscriptionStartDate ? (
                      <div>
                        <div>{new Date(user.subscriptionStartDate).toLocaleDateString()}</div>
                        {user.subscriptionEndDate && (
                          <div className="text-xs text-gray-400">
                            to {new Date(user.subscriptionEndDate).toLocaleDateString()}
                          </div>
                        )}
                      </div>
                    ) : user.subscriptionStatus === 'trial' && user.trialEndsAt ? (
                      <div className="text-xs">
                        Trial until {new Date(user.trialEndsAt).toLocaleDateString()}
                      </div>
                    ) : (
                      'N/A'
                    )}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                    {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-medium space-x-2">
                    <button
                      onClick={() => router.push(`/dashboard/memberships/${user._id}`)}
                      className="text-blue-600 hover:text-blue-900"
                    >
                      View
                    </button>
                    <button
                      onClick={() => handleEditMembership(user)}
                      className="text-indigo-600 hover:text-indigo-900"
                    >
                      Edit
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {filteredUsers.length === 0 && (
          <div className="text-center py-12">
            <Users className="mx-auto h-12 w-12 text-gray-400" />
            <h3 className="mt-2 text-sm font-medium text-gray-900">No users found</h3>
            <p className="mt-1 text-sm text-gray-500">
              Try adjusting your search or filters.
            </p>
          </div>
        )}
      </div>

      {/* Membership Modal */}
      {showModal && selectedUser && (
        <MembershipModal
          user={selectedUser}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
