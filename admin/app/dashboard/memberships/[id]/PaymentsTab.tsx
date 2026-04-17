"use client";

import { useState, useEffect, useCallback } from "react";
import { CreditCard, CheckCircle, XCircle, Clock, Download, Link2, Copy, Loader2 } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import toast from "react-hot-toast";

interface Payment {
  orderId: string;
  paymentId: string;
  amount: number;
  plan: string;
  status: string;
  date: string;
}

interface UserInfo {
  displayName: string;
  email?: string;
  phone?: string;
  subscriptionPlan?: string;
}

interface PlanOption {
  slug: string;
  title: string;
  amount: number;
  currency: string;
}

interface AdminPaymentLink {
  paymentLinkId: string;
  shortUrl: string;
  planSlug: string;
  amount: number;
  currency: string;
  status: string;
  createdAt: string;
  paidAt?: string;
  expiresAt: string;
}

interface PaymentsTabProps {
  userId: string;
  userInfo: UserInfo;
}

export default function PaymentsTab({ userId, userInfo }: PaymentsTabProps) {
  const showAdminLinkTools = false;
  const [payments, setPayments] = useState<Payment[]>([]);
  const [loading, setLoading] = useState(true);
  const [planOptions, setPlanOptions] = useState<PlanOption[]>([]);
  const [selectedPlan, setSelectedPlan] = useState<string>(String(userInfo.subscriptionPlan || "free").toLowerCase());
  const [customAmount, setCustomAmount] = useState<string>("");
  const [creatingLink, setCreatingLink] = useState(false);
  const [latestLink, setLatestLink] = useState<{ url: string; paymentLinkId: string } | null>(null);
  const [adminLinks, setAdminLinks] = useState<AdminPaymentLink[]>([]);
  const [linksLoading, setLinksLoading] = useState(false);
  const [stats, setStats] = useState({
    totalPayments: 0,
    totalRevenue: 0,
    successfulPayments: 0,
    failedPayments: 0
  });

  const calculateStats = (paymentsData: Payment[]) => {
    const successful = paymentsData.filter(p => p.status === 'completed');
    const totalRevenue = successful.reduce((sum, p) => sum + p.amount, 0);

    setStats({
      totalPayments: paymentsData.length,
      totalRevenue,
      successfulPayments: successful.length,
      failedPayments: paymentsData.filter(p => p.status === 'failed').length
    });
  };

  const fetchPayments = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/user/${userId}/payments`);
      if (response.data.success) {
        const paymentsData = response.data.payments || [];
        setPayments(paymentsData);
        calculateStats(paymentsData);
      }
    } catch (error: any) {
      console.error("Error fetching payments:", error);
      toast.error(error.response?.data?.message || "Failed to fetch payments");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  const fetchPlanOptions = useCallback(async () => {
    try {
      const response = await apiClient.get('/api/membership-plans');
      const plans = Array.isArray(response.data?.data) ? response.data.data : [];

      const options = plans
        .filter((plan: any) => String(plan?.status || '').toLowerCase() === 'published')
        .map((plan: any) => ({
          slug: String(plan?.slug || '').toLowerCase().trim(),
          title: String(plan?.title || plan?.slug || '').trim(),
          amount: Number(plan?.pricing?.oneTime?.amount || 0),
          currency: String(plan?.pricing?.oneTime?.currency || 'INR'),
        }))
        .filter((plan: PlanOption) => Boolean(plan.slug));

      setPlanOptions(options);

      const normalizedCurrentPlan = String(userInfo.subscriptionPlan || '').toLowerCase().trim();
      if (normalizedCurrentPlan && options.some((plan: PlanOption) => plan.slug === normalizedCurrentPlan)) {
        setSelectedPlan(normalizedCurrentPlan);
        return;
      }

      if (options.length > 0) {
        setSelectedPlan(options[0].slug);
      }
    } catch (error) {
      console.error('Error fetching membership plans:', error);
    }
  }, [userInfo.subscriptionPlan]);

  const fetchAdminLinks = useCallback(async () => {
    try {
      setLinksLoading(true);
      const response = await apiClient.get('/api/payments/admin/membership-links', {
        params: {
          userId,
          limit: 10,
        },
      });

      const links = Array.isArray(response.data?.data?.links) ? response.data.data.links : [];
      setAdminLinks(links);
    } catch (error) {
      console.error('Error fetching admin payment links:', error);
      setAdminLinks([]);
    } finally {
      setLinksLoading(false);
    }
  }, [userId]);

  const handleGenerateLink = async () => {
    if (!selectedPlan) {
      toast.error('Select a membership plan first');
      return;
    }

    const parsedAmount = customAmount ? Number(customAmount) : null;
    if (parsedAmount !== null && (!Number.isFinite(parsedAmount) || parsedAmount <= 0)) {
      toast.error('Custom amount must be a positive number');
      return;
    }

    try {
      setCreatingLink(true);
      const payload: Record<string, unknown> = {
        targetUserId: userId,
        plan: selectedPlan,
      };

      if (parsedAmount !== null) {
        payload.amount = parsedAmount;
      }

      const response = await apiClient.post('/api/payments/admin/membership-link', payload);

      if (!response.data?.success || !response.data?.data?.url) {
        toast.error(response.data?.message || 'Could not create payment link');
        return;
      }

      setLatestLink({
        url: response.data.data.url,
        paymentLinkId: response.data.data.paymentLinkId,
      });
      toast.success('Payment link generated');
      fetchAdminLinks();
    } catch (error: any) {
      console.error('Error generating membership payment link:', error);
      toast.error(error.response?.data?.message || 'Failed to generate payment link');
    } finally {
      setCreatingLink(false);
    }
  };

  const handleCopyLink = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Payment link copied');
    } catch {
      toast.error('Unable to copy link');
    }
  };

  useEffect(() => {
    fetchPayments();
    if (showAdminLinkTools) {
      fetchPlanOptions();
      fetchAdminLinks();
    }
  }, [userId, fetchPayments, fetchPlanOptions, fetchAdminLinks, showAdminLinkTools]);

  const getStatusIcon = (status: string) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case 'failed':
        return <XCircle className="w-5 h-5 text-red-500" />;
      case 'pending':
        return <Clock className="w-5 h-5 text-yellow-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getStatusColor = (status: string) => {
    const colors: Record<string, string> = {
      completed: 'bg-green-100 text-green-700',
      paid: 'bg-green-100 text-green-700',
      created: 'bg-yellow-100 text-yellow-700',
      failed: 'bg-red-100 text-red-700',
      expired: 'bg-red-100 text-red-700',
      cancelled: 'bg-gray-100 text-gray-700',
      pending: 'bg-yellow-100 text-yellow-700',
      refunded: 'bg-gray-100 text-gray-700'
    };
    return colors[status] || 'bg-gray-100 text-gray-700';
  };

  const exportPayments = () => {
    const headers = ['Date', 'Order ID', 'Payment ID', 'Plan', 'Amount', 'Status'];
    const rows = payments.map(payment => [
      new Date(payment.date).toLocaleString(),
      payment.orderId,
      payment.paymentId,
      payment.plan,
      `₹${payment.amount}`,
      payment.status
    ]);

    const csv = [headers, ...rows].map(row => row.join(',')).join('\n');
    const blob = new Blob([csv], { type: 'text/csv' });
    const url = window.URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `payments-${userId}-${new Date().toISOString().split('T')[0]}.csv`;
    a.click();
    window.URL.revokeObjectURL(url);
    toast.success('Exported payments to CSV');
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-gray-900"></div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {showAdminLinkTools && (
      <>
      {/* Generate Link */}
      <div className="bg-white border border-gray-200 rounded-lg p-4 space-y-4">
        <div className="flex items-center justify-between">
          <div>
            <h3 className="text-sm font-semibold text-gray-900">Generate Membership Payment Link</h3>
            <p className="text-xs text-gray-500 mt-1">
              Create and share a hosted payment link for {userInfo.displayName}.
            </p>
          </div>
          <Link2 className="w-5 h-5 text-blue-600" />
        </div>

        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="md:col-span-2">
            <label className="block text-xs font-medium text-gray-700 mb-1">Plan</label>
            <select
              value={selectedPlan}
              onChange={(event) => setSelectedPlan(event.target.value)}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            >
              {planOptions.map((plan) => (
                <option key={plan.slug} value={plan.slug}>
                  {plan.title} • {plan.currency} {plan.amount.toLocaleString()}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-700 mb-1">Custom Amount (optional)</label>
            <input
              value={customAmount}
              onChange={(event) => setCustomAmount(event.target.value)}
              placeholder="Auto from plan"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm"
            />
          </div>
        </div>

        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleGenerateLink}
            disabled={creatingLink || planOptions.length === 0}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2 text-sm"
          >
            {creatingLink ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
            {creatingLink ? 'Generating...' : 'Generate Link'}
          </button>

          {latestLink?.url && (
            <button
              type="button"
              onClick={() => handleCopyLink(latestLink.url)}
              className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2 text-sm"
            >
              <Copy className="w-4 h-4" />
              Copy Latest Link
            </button>
          )}
        </div>

        {latestLink?.url && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-3">
            <p className="text-xs text-gray-600 mb-1">Latest generated link</p>
            <p className="text-xs text-gray-800 break-all">{latestLink.url}</p>
            <p className="text-[11px] text-gray-500 mt-1">Payment Link ID: {latestLink.paymentLinkId}</p>
          </div>
        )}
      </div>

      {/* Recent Admin Links */}
      <div className="bg-white border border-gray-200 rounded-lg overflow-hidden">
        <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between">
          <h3 className="text-sm font-semibold text-gray-900">Recent Generated Links</h3>
          {linksLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
        </div>

        {adminLinks.length === 0 ? (
          <div className="p-4 text-sm text-gray-500">No generated links yet for this user.</div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Created</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Plan</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Amount</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Status</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">Link</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-200">
                {adminLinks.map((link) => (
                  <tr key={link.paymentLinkId} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {new Date(link.createdAt).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-700 uppercase">{link.planSlug}</td>
                    <td className="px-4 py-2 text-sm text-gray-700">
                      {link.currency} {Number(link.amount || 0).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <span className={`px-2 py-1 rounded text-xs font-semibold ${getStatusColor(link.status)}`}>
                        {String(link.status || '').toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <button
                        onClick={() => handleCopyLink(link.shortUrl)}
                        className="text-blue-600 hover:text-blue-700 flex items-center gap-1"
                      >
                        <Copy className="w-3 h-3" />
                        Copy
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
      </>
      )}

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        <div className="bg-blue-50 p-4 rounded-lg border border-blue-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-blue-600">Total Payments</p>
              <p className="text-2xl font-bold text-blue-900">{stats.totalPayments}</p>
            </div>
            <CreditCard className="w-8 h-8 text-blue-500" />
          </div>
        </div>

        <div className="bg-green-50 p-4 rounded-lg border border-green-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-green-600">Total Revenue</p>
              <p className="text-2xl font-bold text-green-900">₹{stats.totalRevenue}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-green-500" />
          </div>
        </div>

        <div className="bg-emerald-50 p-4 rounded-lg border border-emerald-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-emerald-600">Successful</p>
              <p className="text-2xl font-bold text-emerald-900">{stats.successfulPayments}</p>
            </div>
            <CheckCircle className="w-8 h-8 text-emerald-500" />
          </div>
        </div>

        <div className="bg-red-50 p-4 rounded-lg border border-red-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-red-600">Failed</p>
              <p className="text-2xl font-bold text-red-900">{stats.failedPayments}</p>
            </div>
            <XCircle className="w-8 h-8 text-red-500" />
          </div>
        </div>
      </div>

      {/* Export Button */}
      {payments.length > 0 && (
        <div className="flex justify-end">
          <button
            onClick={exportPayments}
            className="px-4 py-2 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <Download className="w-4 h-4" />
            Export CSV
          </button>
        </div>
      )}

      {/* Payments List */}
      {payments.length === 0 ? (
        <div className="text-center py-12 bg-gray-50 rounded-lg border border-gray-200">
          <CreditCard className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">No payments found</h3>
          <p className="mt-1 text-sm text-gray-500">
            This user hasn&apos;t made any payments yet.
          </p>
        </div>
      ) : (
        <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Date & Time
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Transaction IDs
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Plan
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Amount
                </th>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase">
                  Status
                </th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {payments.map((payment, index) => (
                <tr key={index} className="hover:bg-gray-50">
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="text-sm text-gray-900">
                      {new Date(payment.date).toLocaleDateString()}
                    </div>
                    <div className="text-sm text-gray-500">
                      {new Date(payment.date).toLocaleTimeString()}
                    </div>
                  </td>
                  <td className="px-6 py-4">
                    <div className="text-sm text-gray-900 font-mono">
                      Order: {payment.orderId}
                    </div>
                    <div className="text-sm text-gray-500 font-mono">
                      Payment: {payment.paymentId}
                    </div>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <span className="px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full bg-blue-100 text-blue-700">
                      {payment.plan.toUpperCase()}
                    </span>
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap text-sm font-semibold text-gray-900">
                    ₹{payment.amount.toLocaleString()}
                  </td>
                  <td className="px-6 py-4 whitespace-nowrap">
                    <div className="flex items-center gap-2">
                      {getStatusIcon(payment.status)}
                      <span className={`px-3 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(payment.status)}`}>
                        {payment.status.charAt(0).toUpperCase() + payment.status.slice(1)}
                      </span>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
