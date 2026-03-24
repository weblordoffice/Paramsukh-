"use client";

import { useEffect, useMemo, useState } from "react";
import { X, Crown, AlertCircle } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import toast from "react-hot-toast";

interface User {
  _id: string;
  displayName: string;
  email?: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
}

interface MembershipModalProps {
  user: User;
  onClose: () => void;
}

interface PlanOption {
  value: string;
  label: string;
  description: string;
  validityDays?: number;
  amount?: number;
  status?: string;
}

const FREE_PLAN: PlanOption = {
  value: 'free',
  label: 'Free',
  description: 'No paid courses',
  validityDays: 0,
  amount: 0,
  status: 'published',
};

export default function MembershipModal({ user, onClose }: MembershipModalProps) {
  const [formData, setFormData] = useState({
    subscriptionPlan: user.subscriptionPlan,
    subscriptionStatus: user.subscriptionStatus,
    subscriptionStartDate: user.subscriptionStartDate
      ? new Date(user.subscriptionStartDate).toISOString().split('T')[0]
      : new Date().toISOString().split('T')[0],
    subscriptionEndDate: user.subscriptionEndDate
      ? new Date(user.subscriptionEndDate).toISOString().split('T')[0]
      : new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
  });
  const [loading, setLoading] = useState(false);
  const [plansLoading, setPlansLoading] = useState(true);
  const [autoEnroll, setAutoEnroll] = useState(false);
  const [plans, setPlans] = useState<PlanOption[]>([FREE_PLAN]);

  const planLookup = useMemo(() => {
    return plans.reduce<Record<string, PlanOption>>((acc, plan) => {
      acc[plan.value] = plan;
      return acc;
    }, {});
  }, [plans]);

  const currentPlanLabel = planLookup[user.subscriptionPlan]?.label || user.subscriptionPlan.toUpperCase();

  useEffect(() => {
    const loadPlans = async () => {
      try {
        const response = await apiClient.get('/api/membership-plans');
        const apiPlans = response.data?.data;

        if (!Array.isArray(apiPlans) || apiPlans.length === 0) {
          setPlans([FREE_PLAN]);
          return;
        }

        const dynamicPlans: PlanOption[] = apiPlans
          .filter((plan: any) => String(plan?.status || 'draft') !== 'archived')
          .sort((a: any, b: any) => (Number(a?.displayOrder || 0) - Number(b?.displayOrder || 0)))
          .map((plan: any) => ({
            value: String(plan.slug || '').toLowerCase(),
            label: String(plan.title || plan.slug || '').trim(),
            description: plan.shortDescription || `${plan.validityDays || 365} days validity`,
            validityDays: Number(plan.validityDays || 365),
            amount: Number(plan?.pricing?.oneTime?.amount || 0),
            status: String(plan?.status || 'draft'),
          }))
          .filter((plan: PlanOption) => Boolean(plan.value));

        const freeFromApi = dynamicPlans.find((plan: PlanOption) => plan.value === 'free') || FREE_PLAN;
        const paidPlans = dynamicPlans.filter((plan: PlanOption) => plan.value !== 'free');

        setPlans([freeFromApi, ...paidPlans]);
      } catch (error) {
        setPlans([FREE_PLAN]);
      } finally {
        setPlansLoading(false);
      }
    };

    loadPlans();
  }, []);

  const statuses = [
    { value: 'active', label: 'Active', color: 'text-green-600' },
    { value: 'inactive', label: 'Inactive', color: 'text-gray-600' },
    { value: 'trial', label: 'Trial', color: 'text-blue-600' },
    { value: 'cancelled', label: 'Cancelled', color: 'text-red-600' },
  ];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);

    try {
      if (
        formData.subscriptionStatus === 'active'
        && formData.subscriptionStartDate
        && formData.subscriptionEndDate
        && new Date(formData.subscriptionEndDate) < new Date(formData.subscriptionStartDate)
      ) {
        toast.error('End date cannot be before start date');
        setLoading(false);
        return;
      }

      // Update membership via admin endpoint
      const response = await apiClient.patch(`/api/user/${user._id}/membership`, {
        subscriptionPlan: formData.subscriptionPlan,
        subscriptionStatus: formData.subscriptionStatus,
        subscriptionStartDate: formData.subscriptionStartDate,
        subscriptionEndDate: formData.subscriptionEndDate,
        autoEnroll
      });

      if (response.data.success) {
        toast.success("Membership updated successfully");
        onClose();
      }
    } catch (error: any) {
      console.error("Error updating membership:", error);
      toast.error(error.response?.data?.message || "Failed to update membership");
    } finally {
      setLoading(false);
    }
  };

  const handlePlanChange = (plan: string) => {
    const selectedPlan = planLookup[plan];

    setFormData((prev) => ({
      ...prev,
      subscriptionPlan: plan,
      subscriptionEndDate:
        plan === 'free'
          ? prev.subscriptionEndDate
          : new Date(Date.now() + Number(selectedPlan?.validityDays || 365) * 24 * 60 * 60 * 1000).toISOString().split('T')[0],
    }));

    // If upgrading from free to paid, suggest activation
    if (user.subscriptionPlan === 'free' && plan !== 'free') {
      setFormData(prev => ({ ...prev, subscriptionStatus: 'active' }));
      setAutoEnroll(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="flex items-center justify-between p-6 border-b border-gray-200 sticky top-0 bg-white">
          <div className="flex items-center gap-2">
            <Crown className="w-6 h-6 text-purple-500" />
            <div>
              <h2 className="text-xl font-bold text-gray-900">
                Edit Membership
              </h2>
              <p className="text-sm text-gray-600">{user.displayName}</p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="w-6 h-6" />
          </button>
        </div>

        {/* Form */}
        <form onSubmit={handleSubmit} className="p-6 space-y-6">
          {/* Current Info Alert */}
          <div className="bg-blue-50 border border-blue-200 rounded-lg p-4 flex gap-3">
            <AlertCircle className="w-5 h-5 text-blue-500 flex-shrink-0 mt-0.5" />
            <div className="text-sm">
              <p className="font-medium text-blue-900">Current Membership</p>
              <p className="text-blue-700 mt-1">
                Plan: <span className="font-semibold">{currentPlanLabel}</span>
                {' • '}
                Status: <span className="font-semibold">{user.subscriptionStatus.toUpperCase()}</span>
              </p>
            </div>
          </div>

          {/* Subscription Plan */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subscription Plan
            </label>
            <div className="space-y-2">
              {plansLoading && (
                <p className="text-sm text-gray-500">Loading plans...</p>
              )}
              {plans.map((plan) => (
                <label
                  key={plan.value}
                  className={`flex items-center justify-between p-3 border rounded-lg cursor-pointer transition-all ${formData.subscriptionPlan === plan.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <div className="flex items-center gap-3">
                    <input
                      type="radio"
                      name="plan"
                      value={plan.value}
                      checked={formData.subscriptionPlan === plan.value}
                      onChange={(e) => handlePlanChange(e.target.value)}
                      className="w-4 h-4 text-blue-600"
                    />
                    <div>
                      <p className="font-medium text-gray-900">{plan.label}</p>
                      <p className="text-xs text-gray-500">{plan.description}</p>
                      <p className="text-xs text-gray-400 mt-1">
                        {plan.value === 'free' ? 'Free tier' : `INR ${Number(plan.amount || 0).toLocaleString('en-IN')} • ${plan.validityDays || 365} days`}
                        {plan.status ? ` • ${plan.status}` : ''}
                      </p>
                    </div>
                  </div>
                  {formData.subscriptionPlan === plan.value && (
                    <Crown className="w-5 h-5 text-blue-500" />
                  )}
                </label>
              ))}
            </div>
          </div>

          {/* Subscription Status */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Subscription Status
            </label>
            <div className="grid grid-cols-2 gap-3">
              {statuses.map((status) => (
                <label
                  key={status.value}
                  className={`flex items-center justify-center p-3 border rounded-lg cursor-pointer transition-all ${formData.subscriptionStatus === status.value
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                    }`}
                >
                  <input
                    type="radio"
                    name="status"
                    value={status.value}
                    checked={formData.subscriptionStatus === status.value}
                    onChange={(e) => setFormData({ ...formData, subscriptionStatus: e.target.value })}
                    className="sr-only"
                  />
                  <span className={`font-medium ${status.color}`}>
                    {status.label}
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* Subscription Dates */}
          {formData.subscriptionStatus === 'active' && (
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Start Date
                </label>
                <input
                  type="date"
                  value={formData.subscriptionStartDate}
                  onChange={(e) => setFormData({ ...formData, subscriptionStartDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  End Date
                </label>
                <input
                  type="date"
                  value={formData.subscriptionEndDate}
                  onChange={(e) => setFormData({ ...formData, subscriptionEndDate: e.target.value })}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 text-black"
                />
              </div>
            </div>
          )}

          {/* Auto-enroll Option */}
          {formData.subscriptionPlan !== 'free' && (
            <div className="bg-gray-50 border border-gray-200 rounded-lg p-4">
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="checkbox"
                  checked={autoEnroll}
                  onChange={(e) => setAutoEnroll(e.target.checked)}
                  className="mt-1 w-4 h-4 text-blue-600 rounded"
                />
                <div>
                  <p className="font-medium text-gray-900">Auto-enroll in courses</p>
                  <p className="text-sm text-gray-600 mt-1">
                    Automatically enroll user in courses included with this plan and add them to community groups.
                  </p>
                </div>
              </label>
            </div>
          )}

          {/* Action Buttons */}
          <div className="flex gap-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={loading}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              {loading ? "Updating..." : "Update Membership"}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}
