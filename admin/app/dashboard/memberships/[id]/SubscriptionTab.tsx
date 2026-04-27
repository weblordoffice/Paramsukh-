"use client";

import { useEffect, useMemo, useState } from "react";
import { Calendar, Crown, AlertCircle, Edit2 } from "lucide-react";
import MembershipModal from "../MembershipModal";
import { apiClient } from "@/lib/api/client";

interface User {
  _id: string;
  displayName: string;
  subscriptionPlan: string;
  subscriptionStatus: string;
  subscriptionStartDate?: string;
  subscriptionEndDate?: string;
  trialEndsAt?: string;
}

interface SubscriptionTabProps {
  user: User;
  onUpdate: () => void;
}

interface PlanInfo {
  slug: string;
  title: string;
  shortDescription?: string;
  validityDays?: number;
  pricing?: {
    oneTime?: {
      amount?: number;
    };
  };
  access?: {
    includedCategories?: string[];
    includedSubcategories?: string[];
    communityAccess?: boolean;
    counselingAccess?: boolean;
    eventAccess?: boolean;
    limits?: {
      maxCategories?: number | null;
      maxCoursesTotal?: number | null;
      perCategoryCourseLimit?: number | null;
    };
  };
}

const normalize = (value: string) => String(value || '').trim().toLowerCase();
const REFERENCE_NOW = Date.now();

export default function SubscriptionTab({ user, onUpdate }: SubscriptionTabProps) {
  const [showModal, setShowModal] = useState(false);
  const [planLookup, setPlanLookup] = useState<Record<string, PlanInfo>>({
    free: { slug: 'free', title: 'Free', shortDescription: 'No paid courses' },
  });

  useEffect(() => {
    const fetchPlans = async () => {
      try {
        const response = await apiClient.get('/api/membership-plans');
        const plans = Array.isArray(response.data?.data) ? response.data.data : [];
        const lookup: Record<string, PlanInfo> = {
          free: { slug: 'free', title: 'Free', shortDescription: 'No paid courses' },
        };

        plans
          .filter((plan: any) => String(plan?.status || 'draft') !== 'archived')
          .forEach((plan: any) => {
            const slug = normalize(plan.slug);
            if (!slug) return;
            lookup[slug] = {
              slug,
              title: String(plan.title || plan.slug || '').trim(),
              shortDescription: plan.shortDescription,
              validityDays: Number(plan.validityDays || 365),
              pricing: plan.pricing,
              access: plan.access,
            };
          });

        setPlanLookup(lookup);
      } catch {
        setPlanLookup({
          free: { slug: 'free', title: 'Free', shortDescription: 'No paid courses' },
        });
      }
    };

    fetchPlans();
  }, []);

  const handleModalClose = () => {
    setShowModal(false);
    onUpdate();
  };

  const selectedPlan = planLookup[normalize(user.subscriptionPlan)] || planLookup.free;
  const planTitle = selectedPlan?.title || user.subscriptionPlan.toUpperCase();
  const planCourseSummary = useMemo(() => {
    if (normalize(user.subscriptionPlan) === 'free') {
      return 'No paid courses';
    }

    const maxCoursesTotal = selectedPlan?.access?.limits?.maxCoursesTotal;
    if (maxCoursesTotal === null || maxCoursesTotal === undefined) {
      return 'Unlimited courses';
    }
    return `${maxCoursesTotal} total courses`;
  }, [selectedPlan, user.subscriptionPlan]);

  const planFeatures = useMemo(() => {
    if (!selectedPlan) {
      return ['Plan details not available'];
    }

    const features: string[] = [];

    if (selectedPlan.shortDescription) {
      features.push(selectedPlan.shortDescription);
    }
    if (selectedPlan.access?.communityAccess) {
      features.push('Community access enabled');
    }
    if (selectedPlan.access?.counselingAccess) {
      features.push('Counseling access enabled');
    }
    if (selectedPlan.access?.eventAccess) {
      features.push('Event access enabled');
    }
    const includedCategoriesCount = Array.isArray(selectedPlan.access?.includedCategories)
      ? selectedPlan.access?.includedCategories.length
      : 0;
    if (includedCategoriesCount > 0) {
      features.push(`Included categories: ${includedCategoriesCount}`);
    }
    const includedSubcategoriesCount = Array.isArray(selectedPlan.access?.includedSubcategories)
      ? selectedPlan.access?.includedSubcategories.length
      : 0;
    if (includedSubcategoriesCount > 0) {
      features.push(`Included subcategories: ${includedSubcategoriesCount}`);
    }

    const limits = selectedPlan.access?.limits;
    if (limits?.maxCategories !== null && limits?.maxCategories !== undefined) {
      features.push(`Category limit: ${limits.maxCategories}`);
    }
    if (limits?.perCategoryCourseLimit !== null && limits?.perCategoryCourseLimit !== undefined) {
      features.push(`Per-category course cap: ${limits.perCategoryCourseLimit}`);
    }
    if (selectedPlan.validityDays) {
      features.push(`Validity: ${selectedPlan.validityDays} days`);
    }
    if (selectedPlan.pricing?.oneTime?.amount) {
      features.push(`One-time price: INR ${Number(selectedPlan.pricing.oneTime.amount).toLocaleString('en-IN')}`);
    }

    if (features.length === 0) {
      features.push('No additional features configured');
    }

    return features;
  }, [selectedPlan]);

  const isActive = user.subscriptionStatus === 'active';
  const daysRemaining = user.subscriptionEndDate 
    ? Math.floor((new Date(user.subscriptionEndDate).getTime() - REFERENCE_NOW) / (1000 * 60 * 60 * 24))
    : null;

  return (
    <div className="space-y-6">
      {/* Current Plan */}
      <div className="bg-gradient-to-r from-blue-50 to-indigo-50 rounded-lg p-6 border border-blue-200">
        <div className="flex items-start justify-between">
          <div>
            <div className="flex items-center gap-2 mb-2">
              <Crown className="w-6 h-6 text-blue-600" />
              <h3 className="text-lg font-semibold text-gray-900">Current Plan</h3>
            </div>
            <p className="text-3xl font-bold text-blue-600 mb-2">
              {planTitle}
            </p>
            <p className="text-sm text-gray-700 mb-4">{planCourseSummary}</p>
            <div className="space-y-1">
              {planFeatures.map((feature, index) => (
                <div key={index} className="flex items-center gap-2 text-sm text-gray-700">
                  <div className="w-1.5 h-1.5 bg-blue-600 rounded-full"></div>
                  {feature}
                </div>
              ))}
            </div>
          </div>
          <button
            onClick={() => setShowModal(true)}
            className="px-4 py-2 bg-white text-blue-600 rounded-lg hover:bg-blue-50 transition-colors border border-blue-200 flex items-center gap-2"
          >
            <Edit2 className="w-4 h-4" />
            Edit Plan
          </button>
        </div>
      </div>

      {/* Status Alert */}
      {isActive && daysRemaining !== null && daysRemaining < 30 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4 flex gap-3">
          <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium text-yellow-900">Subscription Expiring Soon</p>
            <p className="text-sm text-yellow-700 mt-1">
              This subscription will expire in {daysRemaining} days on{' '}
              {new Date(user.subscriptionEndDate!).toLocaleDateString()}.
            </p>
          </div>
        </div>
      )}

      {/* Subscription Details */}
      <div className="grid grid-cols-2 gap-6">
        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <h4 className="font-medium text-gray-900">Subscription Status</h4>
          </div>
          <p className="text-2xl font-bold text-gray-900 capitalize">
            {user.subscriptionStatus}
          </p>
        </div>

        <div className="bg-white p-4 rounded-lg border border-gray-200">
          <div className="flex items-center gap-2 mb-2">
            <Calendar className="w-5 h-5 text-gray-400" />
            <h4 className="font-medium text-gray-900">Plan Type</h4>
          </div>
          <p className="text-2xl font-bold text-gray-900 uppercase">
            {planTitle}
          </p>
        </div>

        {user.subscriptionStartDate && (
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">Start Date</h4>
            <p className="text-lg text-gray-700">
              {new Date(user.subscriptionStartDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
          </div>
        )}

        {user.subscriptionEndDate && (
          <div className="bg-white p-4 rounded-lg border border-gray-200">
            <h4 className="font-medium text-gray-900 mb-2">End Date</h4>
            <p className="text-lg text-gray-700">
              {new Date(user.subscriptionEndDate).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'long',
                day: 'numeric'
              })}
            </p>
            {daysRemaining !== null && (
              <p className="text-sm text-gray-500 mt-1">
                {daysRemaining > 0 ? `${daysRemaining} days remaining` : 'Expired'}
              </p>
            )}
          </div>
        )}
      </div>

      {/* Membership Modal */}
      {showModal && (
        <MembershipModal
          user={user}
          onClose={handleModalClose}
        />
      )}
    </div>
  );
}
