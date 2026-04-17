"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { AlertTriangle, Crown, Edit3, Plus, RefreshCw, Save, Search } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api/client";

type PlanStatus = "draft" | "published" | "archived";
type AccessMode = "entitlement_only" | "auto_enroll" | "hybrid";

interface MembershipPlan {
  _id: string;
  title: string;
  slug: string;
  shortDescription?: string;
  longDescription?: string;
  status: PlanStatus;
  displayOrder: number;
  validityDays: number;
  pricing: {
    oneTime: {
      amount: number;
      currency: string;
    };
  };
  access?: {
    includedCategories?: string[];
    inheritedPlanIds?: string[];
    accessMode?: AccessMode;
    communityAccess?: boolean;
    counselingAccess?: boolean;
    eventAccess?: boolean;
  };
  metadata?: {
    badgeColor?: string;
    icon?: string;
    popular?: boolean;
  };
}

interface PlanFormState {
  title: string;
  slug: string;
  shortDescription: string;
  longDescription: string;
  status: PlanStatus;
  displayOrder: number;
  validityDays: number;
  amount: number;
  currency: string;
  accessMode: AccessMode;
  inheritedPlanIds: string[];
  communityAccess: boolean;
  counselingAccess: boolean;
  eventAccess: boolean;
  badgeColor: string;
  icon: string;
  popular: boolean;
}

type FormErrors = Partial<Record<
  | "title"
  | "slug"
  | "amount"
  | "validityDays",
  string
>>;

const DEFAULT_FORM: PlanFormState = {
  title: "",
  slug: "",
  shortDescription: "",
  longDescription: "",
  status: "draft",
  displayOrder: 0,
  validityDays: 365,
  amount: 0,
  currency: "INR",
  accessMode: "entitlement_only",
  inheritedPlanIds: [],
  communityAccess: false,
  counselingAccess: false,
  eventAccess: false,
  badgeColor: "#64748B",
  icon: "✨",
  popular: false,
};

const toSlug = (value: string) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
};

export default function MembershipPlansPage() {
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [deletingPlanId, setDeletingPlanId] = useState<string | null>(null);
  const [plans, setPlans] = useState<MembershipPlan[]>([]);
  const [selectedPlanId, setSelectedPlanId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [form, setForm] = useState<PlanFormState>(DEFAULT_FORM);
  const [formErrors, setFormErrors] = useState<FormErrors>({});
  const [planUsage, setPlanUsage] = useState<Record<string, number>>({});
  const hasInitializedSelection = useRef(false);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan._id === selectedPlanId) || null,
    [plans, selectedPlanId]
  );

  const filteredPlans = useMemo(() => {
    const query = searchTerm.trim().toLowerCase();
    if (!query) {
      return plans;
    }
    return plans.filter(
      (plan) =>
        plan.title.toLowerCase().includes(query) ||
        plan.slug.toLowerCase().includes(query) ||
        (plan.shortDescription || "").toLowerCase().includes(query)
    );
  }, [plans, searchTerm]);

  const loadPlans = useCallback(async () => {
    try {
      setLoading(true);
      const response = await apiClient.get("/api/membership-plans");
      const apiPlans: MembershipPlan[] = response.data?.data || [];
      setPlans(apiPlans);
      setSelectedPlanId((prevSelectedPlanId) => {
        if (prevSelectedPlanId) {
          const existingPlan = apiPlans.find((plan) => plan._id === prevSelectedPlanId);
          return existingPlan ? prevSelectedPlanId : (apiPlans[0]?._id || null);
        }

        if (!hasInitializedSelection.current && apiPlans.length > 0) {
          hasInitializedSelection.current = true;
          return apiPlans[0]._id;
        }

        return prevSelectedPlanId;
      });
    } catch (error: any) {
      console.error("Error loading membership plans:", error);
      toast.error(error.response?.data?.message || "Failed to load plans");
    } finally {
      setLoading(false);
    }
  }, []);

  const loadPlanUsage = useCallback(async () => {
    try {
      const response = await apiClient.get("/api/user/all");
      const users = response.data?.users || [];
      const usage: Record<string, number> = { free: 0 };

      users.forEach((user: any) => {
        const slug = String(user?.subscriptionPlan || "free").toLowerCase().trim();
        usage[slug] = (usage[slug] || 0) + 1;
      });

      setPlanUsage(usage);
    } catch {
      setPlanUsage({});
    }
  }, []);

  useEffect(() => {
    loadPlans();
    loadPlanUsage();
  }, [loadPlans, loadPlanUsage]);

  useEffect(() => {
    if (!selectedPlan) {
      return;
    }

    setForm({
      title: selectedPlan.title || "",
      slug: selectedPlan.slug || "",
      shortDescription: selectedPlan.shortDescription || "",
      longDescription: selectedPlan.longDescription || "",
      status: selectedPlan.status || "draft",
      displayOrder: selectedPlan.displayOrder ?? 0,
      validityDays: selectedPlan.validityDays ?? 365,
      amount: selectedPlan.pricing?.oneTime?.amount ?? 0,
      currency: selectedPlan.pricing?.oneTime?.currency || "INR",
      accessMode: selectedPlan.access?.accessMode || "entitlement_only",
      inheritedPlanIds: (selectedPlan.access?.inheritedPlanIds || []).map((id) => String(id)),
      communityAccess: !!selectedPlan.access?.communityAccess,
      counselingAccess: !!selectedPlan.access?.counselingAccess,
      eventAccess: !!selectedPlan.access?.eventAccess,
      badgeColor: selectedPlan.metadata?.badgeColor || "#64748B",
      icon: selectedPlan.metadata?.icon || "✨",
      popular: !!selectedPlan.metadata?.popular,
    });
  }, [selectedPlan]);

  const handleCreateNew = () => {
    setSelectedPlanId(null);
    setForm(DEFAULT_FORM);
    setFormErrors({});
  };

  const updateField = <K extends keyof PlanFormState>(field: K, value: PlanFormState[K]) => {
    setForm((prev) => ({ ...prev, [field]: value }));
    setFormErrors((prev) => {
      const next = { ...prev };
      if (field in next) {
        delete next[field as keyof FormErrors];
      }
      return next;
    });
  };

  const validateForm = () => {
    const errors: FormErrors = {};

    const title = form.title.trim();
    const slug = toSlug(form.slug || form.title);
    const amount = Number(form.amount);
    const validityDays = Number(form.validityDays);

    if (!title) {
      errors.title = "Title is required";
    }
    if (!slug) {
      errors.slug = "Slug is required";
    }
    if (Number.isNaN(amount) || amount < 0) {
      errors.amount = "Price must be non-negative";
    }
    if (Number.isNaN(validityDays) || validityDays < 1) {
      errors.validityDays = "Validity days must be at least 1";
    }

    return errors;
  };

  const buildPayload = () => {
    const slug = toSlug(form.slug || form.title);
    const inheritedPlanIds = (form.inheritedPlanIds || []).filter(Boolean);

    return {
      title: form.title.trim(),
      slug,
      shortDescription: form.shortDescription.trim(),
      longDescription: form.longDescription.trim(),
      status: form.status,
      displayOrder: Number(form.displayOrder || 0),
      validityDays: Number(form.validityDays || 365),
      pricing: {
        oneTime: {
          amount: Number(form.amount || 0),
          currency: (form.currency || "INR").toUpperCase(),
        },
      },
      access: {
        includedCategories: [],
        inheritedPlanIds,
        includedCourseIds: [],
        limits: {
          maxCategories: null,
          maxCoursesTotal: null,
          perCategoryCourseLimit: null,
        },
        accessMode: form.accessMode,
        communityAccess: form.communityAccess,
        counselingAccess: form.counselingAccess,
        eventAccess: form.eventAccess,
      },
      metadata: {
        badgeColor: form.badgeColor,
        icon: form.icon,
        popular: form.popular,
      },
    };
  };

  const handleSave = async () => {
    const errors = validateForm();
    setFormErrors(errors);
    if (Object.keys(errors).length > 0) {
      toast.error("Please fix the highlighted fields");
      return;
    }

    if (selectedPlan && selectedPlan.status === "published" && ["draft", "archived"].includes(form.status)) {
      const usageCount = planUsage[selectedPlan.slug] || 0;
      if (usageCount > 0) {
        const confirmed = window.confirm(
          `${usageCount} user(s) currently have this plan. Move to ${form.status} anyway?`
        );
        if (!confirmed) {
          return;
        }
      }
    }

    try {
      setSaving(true);
      const payload = buildPayload();

      if (selectedPlanId) {
        await apiClient.patch(`/api/membership-plans/${selectedPlanId}`, payload);
        toast.success("Plan updated");
      } else {
        const response = await apiClient.post("/api/membership-plans", payload);
        const createdId = response.data?.data?._id;
        toast.success("Plan created");
        if (createdId) {
          setSelectedPlanId(createdId);
        }
      }

      await Promise.all([loadPlans(), loadPlanUsage()]);
    } catch (error: any) {
      console.error("Error saving plan:", error);
      toast.error(error.response?.data?.message || "Failed to save plan");
    } finally {
      setSaving(false);
    }
  };

  const handleQuickStatus = async (planId: string, status: PlanStatus) => {
    try {
      const targetPlan = plans.find((plan) => plan._id === planId);
      if (!targetPlan) {
        return;
      }

      const usageCount = planUsage[targetPlan.slug] || 0;
      if (targetPlan.status === "published" && ["draft", "archived"].includes(status) && usageCount > 0) {
        const confirmed = window.confirm(
          `${usageCount} user(s) currently have ${targetPlan.title}. Move to ${status} anyway?`
        );
        if (!confirmed) {
          return;
        }
      }

      await apiClient.patch(`/api/membership-plans/${planId}/status`, { status });
      toast.success(`Plan moved to ${status}`);
      await Promise.all([loadPlans(), loadPlanUsage()]);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to update status");
    }
  };

  const handleDeletePlan = async (plan: MembershipPlan) => {
    const usageCount = planUsage[plan.slug] || 0;
    if (usageCount > 0) {
      toast.error(`Cannot delete ${plan.title}. ${usageCount} user(s) are currently assigned.`);
      return;
    }

    const confirmed = window.confirm(
      `Delete "${plan.title}" permanently?\n\nThis removes plan mappings and cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    try {
      setDeletingPlanId(plan._id);
      await apiClient.delete(`/api/membership-plans/${plan._id}`);
      toast.success("Plan deleted");

      if (selectedPlanId === plan._id) {
        setSelectedPlanId(null);
        setForm(DEFAULT_FORM);
      }

      await Promise.all([loadPlans(), loadPlanUsage()]);
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Failed to delete plan");
    } finally {
      setDeletingPlanId(null);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-gray-900" />
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-3xl font-bold text-gray-900 flex items-center gap-2">
            <Crown className="w-8 h-8" />
            Membership Plans
          </h1>
          <p className="text-gray-600 mt-1">Create and manage dynamic plans, pricing, and access behavior.</p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={() => {
              loadPlans();
              loadPlanUsage();
            }}
            className="px-4 py-2 border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" /> Refresh
          </button>
          <button
            onClick={handleCreateNew}
            className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 flex items-center gap-2"
          >
            <Plus className="w-4 h-4" /> New Plan
          </button>
        </div>
      </div>

      <div className="grid grid-cols-1 xl:grid-cols-3 gap-6">
        <div className="xl:col-span-1 bg-white border border-gray-200 rounded-xl p-4 space-y-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 w-4 h-4" />
            <input
              value={searchTerm}
              onChange={(event) => setSearchTerm(event.target.value)}
              placeholder="Search plans..."
              className="w-full pl-9 pr-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div className="space-y-2 max-h-[580px] overflow-y-auto">
            {filteredPlans.map((plan) => (
              <div
                key={plan._id}
                role="button"
                tabIndex={0}
                onClick={() => setSelectedPlanId(plan._id)}
                className={`cursor-pointer w-full text-left border rounded-lg p-3 transition-colors ${
                  selectedPlanId === plan._id ? "border-blue-500 bg-blue-50" : "border-gray-200 hover:border-gray-300"
                }`}
              >
                <div className="flex items-center justify-between">
                  <p className="font-semibold text-gray-900">{plan.title}</p>
                  <span className={`text-xs px-2 py-1 rounded-full ${
                    plan.status === "published"
                      ? "bg-green-100 text-green-700"
                      : plan.status === "draft"
                        ? "bg-yellow-100 text-yellow-700"
                        : "bg-gray-100 text-gray-700"
                  }`}>
                    {plan.status}
                  </span>
                </div>
                <p className="text-xs text-gray-500 mt-1">slug: {plan.slug}</p>
                <p className="text-sm text-gray-700 mt-2">₹{(plan.pricing?.oneTime?.amount || 0).toLocaleString("en-IN")}</p>
                <p className="text-xs text-gray-500 mt-1">Users: {planUsage[plan.slug] || 0}</p>
                <div className="mt-2 flex flex-wrap gap-2">
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      setSelectedPlanId(plan._id);
                    }}
                    className="text-xs px-2 py-1 border border-blue-200 text-blue-700 hover:bg-blue-50 rounded"
                  >
                    Edit
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleDeletePlan(plan);
                    }}
                    disabled={deletingPlanId === plan._id}
                    className="text-xs px-2 py-1 border border-red-200 text-red-700 hover:bg-red-50 rounded disabled:opacity-50"
                  >
                    {deletingPlanId === plan._id ? "Deleting..." : "Delete"}
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleQuickStatus(plan._id, "published");
                    }}
                    className="text-xs px-2 py-1 border border-green-200 text-green-700 hover:bg-green-50 rounded"
                  >
                    Publish
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleQuickStatus(plan._id, "draft");
                    }}
                    className="text-xs px-2 py-1 border border-yellow-200 text-yellow-700 hover:bg-yellow-50 rounded"
                  >
                    Draft
                  </button>
                  <button
                    onClick={(event) => {
                      event.stopPropagation();
                      handleQuickStatus(plan._id, "archived");
                    }}
                    className="text-xs px-2 py-1 border border-gray-300 text-gray-700 hover:bg-gray-50 rounded"
                  >
                    Archive
                  </button>
                </div>
              </div>
            ))}

            {filteredPlans.length === 0 && (
              <p className="text-sm text-gray-500 p-2">No plans found.</p>
            )}
          </div>
        </div>

        <div className="xl:col-span-2 bg-white border border-gray-200 rounded-xl p-6 space-y-5">
          <div className="flex items-center justify-between">
            <h2 className="text-xl font-semibold text-gray-900 flex items-center gap-2">
              <Edit3 className="w-5 h-5" />
              {selectedPlanId ? "Edit Plan" : "Create Plan"}
            </h2>
            <button
              onClick={handleSave}
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 flex items-center gap-2"
            >
              <Save className="w-4 h-4" />
              {saving ? "Saving..." : "Save Plan"}
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Title</label>
              <input
                value={form.title}
                onChange={(event) => updateField("title", event.target.value)}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="Silver"
              />
              {formErrors.title && <p className="text-xs text-red-600 mt-1">{formErrors.title}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Slug</label>
              <input
                value={form.slug}
                onChange={(event) => updateField("slug", toSlug(event.target.value))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="silver"
              />
              {formErrors.slug && <p className="text-xs text-red-600 mt-1">{formErrors.slug}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
              <select
                value={form.status}
                onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as PlanStatus }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              >
                <option value="draft">Draft</option>
                <option value="published">Published</option>
                <option value="archived">Archived</option>
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Display Order</label>
              <input
                type="number"
                value={form.displayOrder}
                onChange={(event) => setForm((prev) => ({ ...prev, displayOrder: Number(event.target.value || 0) }))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">One-time Price (INR)</label>
              <input
                type="number"
                value={form.amount}
                onChange={(event) => updateField("amount", Number(event.target.value || 0))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              {formErrors.amount && <p className="text-xs text-red-600 mt-1">{formErrors.amount}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Validity Days</label>
              <input
                type="number"
                value={form.validityDays}
                onChange={(event) => updateField("validityDays", Number(event.target.value || 365))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
              />
              {formErrors.validityDays && <p className="text-xs text-red-600 mt-1">{formErrors.validityDays}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Short Description</label>
            <input
              value={form.shortDescription}
              onChange={(event) => setForm((prev) => ({ ...prev, shortDescription: event.target.value }))}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Long Description</label>
            <textarea
              value={form.longDescription}
              onChange={(event) => setForm((prev) => ({ ...prev, longDescription: event.target.value }))}
              rows={3}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div className="border border-gray-200 rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Access Rules</h3>
            <div className="grid grid-cols-1 md:grid-cols-1 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Access Mode</label>
                <select
                  value={form.accessMode}
                  onChange={(event) => setForm((prev) => ({ ...prev, accessMode: event.target.value as AccessMode }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                >
                  <option value="entitlement_only">Entitlement only</option>
                  <option value="auto_enroll">Auto enroll</option>
                  <option value="hybrid">Hybrid</option>
                </select>
              </div>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">Inherits From Plans</label>
              <div className="space-y-2 max-h-44 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3">
                {plans.filter((plan) => plan._id !== selectedPlanId).length === 0 ? (
                  <p className="text-sm text-gray-500">No other plans available to inherit.</p>
                ) : (
                  plans
                    .filter((plan) => plan._id !== selectedPlanId)
                    .map((plan) => (
                      <label key={plan._id} className="flex items-center gap-2 text-sm text-gray-700">
                        <input
                          type="checkbox"
                          checked={form.inheritedPlanIds.includes(plan._id)}
                          onChange={(event) => {
                            const checked = event.target.checked;
                            setForm((prev) => ({
                              ...prev,
                              inheritedPlanIds: checked
                                ? Array.from(new Set([...prev.inheritedPlanIds, plan._id]))
                                : prev.inheritedPlanIds.filter((id) => id !== plan._id),
                            }));
                          }}
                        />
                        <span className="font-medium text-gray-900">{plan.title}</span>
                        <span className="text-xs text-gray-500">({plan.slug})</span>
                      </label>
                    ))
                )}
              </div>
              <p className="text-xs text-gray-500 mt-2">
                Inherited plans contribute their categories and courses to this plan. Users on this plan receive access to all inherited content.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.communityAccess}
                  onChange={(event) => setForm((prev) => ({ ...prev, communityAccess: event.target.checked }))}
                />
                Community Access
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.counselingAccess}
                  onChange={(event) => setForm((prev) => ({ ...prev, counselingAccess: event.target.checked }))}
                />
                Counseling Access
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.eventAccess}
                  onChange={(event) => setForm((prev) => ({ ...prev, eventAccess: event.target.checked }))}
                />
                Event Access
              </label>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 space-y-4">
            <h3 className="text-sm font-semibold text-gray-900">Display Metadata</h3>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Badge Color</label>
                <input
                  type="color"
                  value={form.badgeColor}
                  onChange={(event) => setForm((prev) => ({ ...prev, badgeColor: event.target.value }))}
                  className="w-full h-10 border border-gray-300 rounded-lg"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">Icon/Emoji</label>
                <input
                  value={form.icon}
                  onChange={(event) => setForm((prev) => ({ ...prev, icon: event.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                />
              </div>
              <label className="flex items-center gap-2 text-sm text-gray-700 mt-7">
                <input
                  type="checkbox"
                  checked={form.popular}
                  onChange={(event) => setForm((prev) => ({ ...prev, popular: event.target.checked }))}
                />
                Mark as popular
              </label>
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">Live Preview</h3>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-2">
                  <span className="text-lg">{form.icon || "✨"}</span>
                  <p className="font-semibold text-gray-900">{form.title || "Untitled Plan"}</p>
                </div>
                <span
                  className="text-xs px-2 py-1 rounded-full border"
                  style={{
                    color: form.badgeColor || "#64748B",
                    borderColor: `${form.badgeColor || "#64748B"}66`,
                    backgroundColor: `${form.badgeColor || "#64748B"}1A`,
                  }}
                >
                  {form.status}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-2">{form.shortDescription || "No short description yet."}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-blue-50 text-blue-700">INR {Number(form.amount || 0).toLocaleString("en-IN")}</span>
                <span className="px-2 py-1 rounded bg-indigo-50 text-indigo-700">{Number(form.validityDays || 365)} days</span>
                <span className="px-2 py-1 rounded bg-gray-100 text-gray-700">{form.accessMode}</span>
                {form.communityAccess && <span className="px-2 py-1 rounded bg-green-50 text-green-700">Community</span>}
                {form.counselingAccess && <span className="px-2 py-1 rounded bg-emerald-50 text-emerald-700">Counseling</span>}
                {form.eventAccess && <span className="px-2 py-1 rounded bg-orange-50 text-orange-700">Events</span>}
              </div>
            </div>
            {(selectedPlan && selectedPlan.status === "published" && ["draft", "archived"].includes(form.status) && (planUsage[selectedPlan.slug] || 0) > 0) && (
              <div className="flex items-start gap-2 rounded-lg border border-yellow-200 bg-yellow-50 p-3 text-yellow-800 text-sm">
                <AlertTriangle className="w-4 h-4 mt-0.5" />
                <p>
                  {planUsage[selectedPlan.slug]} user(s) currently use this plan. Changing status may impact assignment and future purchases.
                </p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
