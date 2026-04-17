'use client';

import { useEffect, useMemo, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { X, Link2, Copy, Loader2, User, Mail, Phone } from 'lucide-react';

interface UserInfo {
  _id: string;
  displayName?: string;
  name?: string;
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
}

interface MembershipPaymentLinkModalProps {
  isOpen: boolean;
  onClose: () => void;
  user: UserInfo | null;
}

const normalize = (value: string) => String(value || '').trim().toLowerCase();

export default function MembershipPaymentLinkModal({ isOpen, onClose, user }: MembershipPaymentLinkModalProps) {
  const [plans, setPlans] = useState<PlanOption[]>([]);
  const [plansLoading, setPlansLoading] = useState(false);
  const [linksLoading, setLinksLoading] = useState(false);
  const [creating, setCreating] = useState(false);
  const [selectedPlan, setSelectedPlan] = useState('');
  const [customAmount, setCustomAmount] = useState('');
  const [latestLink, setLatestLink] = useState<{ url: string; paymentLinkId: string } | null>(null);
  const [recentLinks, setRecentLinks] = useState<AdminPaymentLink[]>([]);

  const userName = useMemo(() => {
    return user?.displayName || user?.name || 'User';
  }, [user]);

  const resetState = () => {
    setPlans([]);
    setPlansLoading(false);
    setLinksLoading(false);
    setCreating(false);
    setSelectedPlan('');
    setCustomAmount('');
    setLatestLink(null);
    setRecentLinks([]);
  };

  const handleClose = () => {
    resetState();
    onClose();
  };

  const fetchPlans = async () => {
    setPlansLoading(true);
    try {
      const response = await apiClient.get('/api/membership-plans');
      const responsePlans = Array.isArray(response.data?.data) ? response.data.data : [];

      const options = responsePlans
        .filter((plan: any) => normalize(plan?.status) === 'published')
        .map((plan: any) => ({
          slug: normalize(plan?.slug),
          title: String(plan?.title || plan?.slug || '').trim(),
          amount: Number(plan?.pricing?.oneTime?.amount || 0),
          currency: String(plan?.pricing?.oneTime?.currency || 'INR').trim(),
        }))
        .filter((plan: PlanOption) => Boolean(plan.slug) && plan.slug !== 'free');

      setPlans(options);

      const normalizedUserPlan = normalize(String(user?.subscriptionPlan || ''));
      if (normalizedUserPlan && options.some((plan: PlanOption) => plan.slug === normalizedUserPlan)) {
        setSelectedPlan(normalizedUserPlan);
      } else if (options.length > 0) {
        setSelectedPlan(options[0].slug);
      }
    } catch (error: any) {
      console.error('Error fetching plans:', error);
      toast.error(error.response?.data?.message || 'Failed to load membership plans');
      setPlans([]);
    } finally {
      setPlansLoading(false);
    }
  };

  const fetchRecentLinks = async () => {
    if (!user?._id) {
      return;
    }

    setLinksLoading(true);
    try {
      const response = await apiClient.get('/api/payments/admin/membership-links', {
        params: {
          userId: user._id,
          limit: 8,
        },
      });

      const links = Array.isArray(response.data?.data?.links) ? response.data.data.links : [];
      setRecentLinks(links);
    } catch (error) {
      console.error('Error fetching recent payment links:', error);
      setRecentLinks([]);
    } finally {
      setLinksLoading(false);
    }
  };

  const handleGenerate = async () => {
    if (!user?._id) {
      toast.error('Invalid user selection');
      return;
    }

    if (!selectedPlan) {
      toast.error('Please select a plan');
      return;
    }

    const parsedCustomAmount = customAmount.trim() ? Number(customAmount) : null;
    if (parsedCustomAmount !== null && (!Number.isFinite(parsedCustomAmount) || parsedCustomAmount <= 0)) {
      toast.error('Custom amount must be a positive number');
      return;
    }

    setCreating(true);
    try {
      const payload: Record<string, unknown> = {
        targetUserId: user._id,
        plan: selectedPlan,
      };

      if (parsedCustomAmount !== null) {
        payload.amount = parsedCustomAmount;
      }

      const response = await apiClient.post('/api/payments/admin/membership-link', payload);

      if (!response.data?.success || !response.data?.data?.url) {
        toast.error(response.data?.message || 'Failed to create payment link');
        return;
      }

      setLatestLink({
        url: response.data.data.url,
        paymentLinkId: response.data.data.paymentLinkId,
      });
      toast.success('Membership payment link generated');
      fetchRecentLinks();
    } catch (error: any) {
      console.error('Error generating payment link:', error);
      toast.error(error.response?.data?.message || 'Failed to generate payment link');
    } finally {
      setCreating(false);
    }
  };

  const handleCopyLink = async (value: string) => {
    try {
      await navigator.clipboard.writeText(value);
      toast.success('Link copied');
    } catch {
      toast.error('Unable to copy link');
    }
  };

  useEffect(() => {
    if (!isOpen || !user?._id) {
      return;
    }

    fetchPlans();
    fetchRecentLinks();
  }, [isOpen, user?._id]);

  if (!isOpen || !user) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-sm overflow-y-auto">
      <div className="min-h-full flex items-start sm:items-center justify-center p-4 sm:p-6">
        <div className="bg-white rounded-2xl w-full max-w-3xl shadow-xl animate-in fade-in zoom-in duration-200 max-h-[calc(100vh-2rem)] sm:max-h-[calc(100vh-3rem)] flex flex-col overflow-hidden">
          <div className="px-6 py-4 border-b flex items-center justify-between bg-gray-50 shrink-0">
            <div>
              <h2 className="text-xl font-bold text-gray-800">Generate Membership Payment Link</h2>
              <p className="text-sm text-gray-500 mt-0.5">Create and share payment link from Users tab</p>
            </div>
            <button
              onClick={handleClose}
              className="p-2 hover:bg-gray-200 rounded-full transition-colors text-gray-500"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          <div className="p-6 space-y-5 overflow-y-auto">
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <div className="grid grid-cols-1 md:grid-cols-3 gap-3 text-sm">
                <div className="flex items-center gap-2 text-gray-800">
                  <User className="w-4 h-4 text-gray-500" />
                  <span>{userName}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-800">
                  <Mail className="w-4 h-4 text-gray-500" />
                  <span>{user.email || 'No email'}</span>
                </div>
                <div className="flex items-center gap-2 text-gray-800">
                  <Phone className="w-4 h-4 text-gray-500" />
                  <span>{user.phone || 'No phone'}</span>
                </div>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
              <div className="md:col-span-2">
                <label className="block text-xs font-medium text-gray-700 mb-1">Plan</label>
                <select
                  value={selectedPlan}
                  onChange={(event) => setSelectedPlan(event.target.value)}
                  disabled={plansLoading || plans.length === 0}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black disabled:bg-gray-100"
                >
                  {plans.length === 0 ? (
                    <option value="">No paid plans available</option>
                  ) : (
                    plans.map((plan) => (
                      <option key={plan.slug} value={plan.slug}>
                        {plan.title} • {plan.currency} {plan.amount.toLocaleString('en-IN')}
                      </option>
                    ))
                  )}
                </select>
              </div>

              <div>
                <label className="block text-xs font-medium text-gray-700 mb-1">Custom Amount</label>
                <input
                  type="number"
                  min={1}
                  value={customAmount}
                  onChange={(event) => setCustomAmount(event.target.value)}
                  placeholder="Use plan amount"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm text-black"
                />
              </div>
            </div>

            <div className="flex items-center gap-3">
              <button
                type="button"
                onClick={handleGenerate}
                disabled={creating || plansLoading || plans.length === 0}
                className="px-4 py-2 bg-amber-600 hover:bg-amber-700 text-white rounded-lg text-sm font-medium disabled:opacity-60 flex items-center gap-2"
              >
                {creating ? <Loader2 className="w-4 h-4 animate-spin" /> : <Link2 className="w-4 h-4" />}
                {creating ? 'Generating...' : 'Generate Link'}
              </button>

              {latestLink?.url && (
                <button
                  type="button"
                  onClick={() => handleCopyLink(latestLink.url)}
                  className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 text-sm font-medium flex items-center gap-2"
                >
                  <Copy className="w-4 h-4" />
                  Copy Latest Link
                </button>
              )}
            </div>

            {latestLink?.url && (
              <div className="bg-amber-50 border border-amber-200 rounded-lg p-3">
                <p className="text-xs text-amber-700 mb-1">Latest generated link</p>
                <p className="text-xs text-amber-900 break-all">{latestLink.url}</p>
                <p className="text-[11px] text-amber-700 mt-1">Payment Link ID: {latestLink.paymentLinkId}</p>
              </div>
            )}

            <div className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="px-4 py-3 border-b border-gray-200 flex items-center justify-between bg-gray-50">
                <h3 className="text-sm font-semibold text-gray-900">Recent Generated Links</h3>
                {linksLoading && <Loader2 className="w-4 h-4 animate-spin text-gray-500" />}
              </div>

              {recentLinks.length === 0 ? (
                <div className="p-4 text-sm text-gray-500">No payment links generated for this user yet.</div>
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
                      {recentLinks.map((link) => (
                        <tr key={link.paymentLinkId} className="hover:bg-gray-50">
                          <td className="px-4 py-2 text-sm text-gray-700">
                            {new Date(link.createdAt).toLocaleString()}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700 uppercase">{link.planSlug}</td>
                          <td className="px-4 py-2 text-sm text-gray-700">
                            {link.currency} {Number(link.amount || 0).toLocaleString('en-IN')}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-700 uppercase">{link.status}</td>
                          <td className="px-4 py-2 text-sm">
                            <button
                              onClick={() => handleCopyLink(link.shortUrl)}
                              className="text-amber-700 hover:text-amber-800 flex items-center gap-1"
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
          </div>
        </div>
      </div>
    </div>
  );
}
