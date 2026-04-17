"use client";

import { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import Image from "next/image";
import { ArrowLeft, Crown, User, BookOpen, CreditCard, Activity } from "lucide-react";
import { apiClient } from "@/lib/api/client";
import toast from "react-hot-toast";
import SubscriptionTab from "./SubscriptionTab";
import EnrollmentsTab from "./EnrollmentsTab";
import PaymentsTab from "./PaymentsTab";
import ActivityTab from "./ActivityTab";

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
  loginCount: number;
}

interface PlanInfo {
  slug: string;
  title: string;
  badgeColor?: string;
}

const normalize = (value: string) => String(value || '').trim().toLowerCase();
const isHexColor = (value: string) => /^#[0-9a-fA-F]{6}$/.test(value || '');

export default function MembershipDetailsPage() {
  const params = useParams();
  const router = useRouter();
  const userId = params.id as string;

  const [user, setUser] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<"subscription" | "enrollments" | "payments" | "activity">("subscription");
  const [planLookup, setPlanLookup] = useState<Record<string, PlanInfo>>({
    free: { slug: 'free', title: 'Free' },
  });

  const fetchUserDetails = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get(`/api/user/${userId}`);
      if (response.data.success) {
        setUser(response.data.user);
      }
    } catch (error: any) {
      console.error("Error fetching user details:", error);
      toast.error(error.response?.data?.message || "Failed to fetch user details");
    } finally {
      setLoading(false);
    }
  }, [userId]);

  useEffect(() => {
    if (userId) {
      fetchUserDetails();
    }
  }, [userId, fetchUserDetails]);

  const fetchPlans = async () => {
    try {
      const response = await apiClient.get('/api/membership-plans');
      const plans = Array.isArray(response.data?.data) ? response.data.data : [];
      const lookup: Record<string, PlanInfo> = {
        free: { slug: 'free', title: 'Free' },
      };

      plans
        .filter((plan: any) => String(plan?.status || 'draft') !== 'archived')
        .forEach((plan: any) => {
          const slug = normalize(plan.slug);
          if (!slug) return;
          lookup[slug] = {
            slug,
            title: String(plan.title || plan.slug || '').trim(),
            badgeColor: plan?.metadata?.badgeColor,
          };
        });

      setPlanLookup(lookup);
    } catch {
      setPlanLookup({ free: { slug: 'free', title: 'Free' } });
    }
  };

  useEffect(() => {
    fetchPlans();
  }, []);

  const getPlanLabel = (planSlug: string) => {
    const slug = normalize(planSlug || 'free');
    return planLookup[slug]?.title || slug.toUpperCase();
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

  if (!user) {
    return (
      <div className="p-6">
        <div className="text-center py-12">
          <User className="mx-auto h-12 w-12 text-gray-400" />
          <h3 className="mt-2 text-sm font-medium text-gray-900">User not found</h3>
          <div className="mt-6">
            <button
              onClick={() => router.push('/dashboard/memberships')}
              className="inline-flex items-center px-4 py-2 border border-transparent rounded-md shadow-sm text-sm font-medium text-white bg-blue-600 hover:bg-blue-700"
            >
              Back to Memberships
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      {/* Back Button */}
      <button
        onClick={() => router.push('/dashboard/memberships')}
        className="flex items-center gap-2 text-gray-600 hover:text-gray-900"
      >
        <ArrowLeft className="w-4 h-4" />
        Back to Memberships
      </button>

      {/* User Header */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 p-6">
        <div className="flex items-start justify-between">
          <div className="flex items-center gap-4">
            {user.photoURL ? (
              <div className="relative w-20 h-20 rounded-full overflow-hidden">
                <Image
                  src={user.photoURL}
                  alt={user.displayName}
                  fill
                  unoptimized
                  className="object-cover"
                />
              </div>
            ) : (
              <div className="w-20 h-20 rounded-full bg-gray-200 flex items-center justify-center">
                <span className="text-3xl text-gray-600 font-medium">
                  {user.displayName.charAt(0).toUpperCase()}
                </span>
              </div>
            )}
            <div>
              <h1 className="text-2xl font-bold text-gray-900">{user.displayName}</h1>
              <div className="mt-2 space-y-1">
                {user.email && (
                  <p className="text-sm text-gray-600">Email: {user.email}</p>
                )}
                {user.phone && (
                  <p className="text-sm text-gray-600">Phone: {user.phone}</p>
                )}
                <p className="text-sm text-gray-600">
                  Member since: {new Date(user.createdAt).toLocaleDateString()}
                </p>
              </div>
            </div>
          </div>
          <div className="flex flex-col items-end gap-2">
            <span
              className="px-4 py-2 inline-flex text-sm font-semibold rounded-full bg-gray-100 text-gray-700 border border-gray-200"
              style={getPlanBadgeStyle(user.subscriptionPlan)}
            >
              <Crown className="w-4 h-4 mr-2" />
              {getPlanLabel(user.subscriptionPlan)}
            </span>
            <span className={`px-4 py-2 inline-flex text-sm font-semibold rounded-full ${getStatusColor(user.subscriptionStatus)}`}>
              {user.subscriptionStatus.toUpperCase()}
            </span>
          </div>
        </div>

        {/* Quick Stats */}
        <div className="grid grid-cols-4 gap-4 mt-6 pt-6 border-t border-gray-200">
          <div className="text-center">
            <p className="text-sm text-gray-600">Status</p>
            <p className="text-lg font-semibold text-gray-900 capitalize">{user.subscriptionStatus}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Login Count</p>
            <p className="text-lg font-semibold text-gray-900">{user.loginCount}</p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Last Login</p>
            <p className="text-lg font-semibold text-gray-900">
              {user.lastLoginAt ? new Date(user.lastLoginAt).toLocaleDateString() : 'Never'}
            </p>
          </div>
          <div className="text-center">
            <p className="text-sm text-gray-600">Account Age</p>
            <p className="text-lg font-semibold text-gray-900">
              {Math.floor((Date.now() - new Date(user.createdAt).getTime()) / (1000 * 60 * 60 * 24))} days
            </p>
          </div>
        </div>
      </div>

      {/* Tabs */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200">
        {/* Tab Headers */}
        <div className="border-b border-gray-200">
          <nav className="flex -mb-px">
            <button
              onClick={() => setActiveTab("subscription")}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "subscription"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <Crown className="w-4 h-4" />
              Subscription
            </button>
            <button
              onClick={() => setActiveTab("enrollments")}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "enrollments"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <BookOpen className="w-4 h-4" />
              Enrollments
            </button>
            <button
              onClick={() => setActiveTab("payments")}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "payments"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <CreditCard className="w-4 h-4" />
              Payments
            </button>
            <button
              onClick={() => setActiveTab("activity")}
              className={`flex items-center gap-2 px-6 py-4 text-sm font-medium border-b-2 transition-colors ${
                activeTab === "activity"
                  ? "border-blue-500 text-blue-600"
                  : "border-transparent text-gray-500 hover:text-gray-700 hover:border-gray-300"
              }`}
            >
              <Activity className="w-4 h-4" />
              Activity
            </button>
          </nav>
        </div>

        {/* Tab Content */}
        <div className="p-6">
          {activeTab === "subscription" && <SubscriptionTab user={user} onUpdate={fetchUserDetails} />}
          {activeTab === "enrollments" && <EnrollmentsTab userId={userId} />}
          {activeTab === "payments" && (
            <PaymentsTab
              userId={userId}
              userInfo={{
                displayName: user.displayName,
                email: user.email,
                phone: user.phone,
                subscriptionPlan: user.subscriptionPlan,
              }}
            />
          )}
          {activeTab === "activity" && <ActivityTab userId={userId} />}
        </div>
      </div>
    </div>
  );
}
