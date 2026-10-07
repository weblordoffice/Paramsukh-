"use client";

import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import { AlertTriangle, Crown, Edit3, Plus, RefreshCw, Save, Search, Trash2, Upload } from "lucide-react";
import toast from "react-hot-toast";
import { apiClient } from "@/lib/api/client";

type PlanStatus = "draft" | "published" | "archived";
type EligibleCoursesMode = "all_published" | "specific" | "categories";

interface CourseSelection {
  enabled: boolean;
  maxSelectableCourses: number;
  eligibleCoursesMode: EligibleCoursesMode;
  eligibleCourseIds: string[];
  eligibleCategories: string[];
}

interface PreviewVideo {
  title: string;
  videoUrl: string;
  thumbnailUrl?: string | null;
  duration?: string;
}

interface PreviewVideoForm {
  id: string;
  title: string;
  videoUrl: string;
  thumbnailUrl: string;
  duration: string;
}

interface MembershipPlan {
  _id: string;
  title: string;
  slug: string;
  description?: string;
  status: PlanStatus;
  displayOrder: number;
  validityDays: number;
  isLifetime?: boolean;
  pricing: {
    oneTime: {
      amount: number;
      currency: string;
    };
  };
  access?: {
    courseSelection?: CourseSelection;
    communityAccess?: boolean;
    inheritedPlanIds?: string[];
  };
  planKind?: "standalone" | "tiered";
  tierLevel?: number;
  previewVideos?: PreviewVideo[];
  courseCount?: number;
}

interface PlanFormState {
  title: string;
  slug: string;
  description: string;
  status: PlanStatus;
  displayOrder: number;
  validityDays: number;
  isLifetime: boolean;
  amount: number;
  currency: string;
  courseSelectionEnabled: boolean;
  communityAccess: boolean;
  planKind: "standalone" | "tiered";
  tierLevel: number;
  inheritedPlanIds: string[];
  maxSelectableCourses: number;
  eligibleCoursesMode: EligibleCoursesMode;
  eligibleCourseIds: string[];
  eligibleCategoriesText: string;
  previewVideos: PreviewVideoForm[];
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
  description: "",
  status: "draft",
  displayOrder: 0,
  validityDays: 365,
  isLifetime: false,
  amount: 0,
  currency: "INR",
  courseSelectionEnabled: false,
  communityAccess: false,
  planKind: "standalone",
  tierLevel: 0,
  inheritedPlanIds: [],
  maxSelectableCourses: 3,
  eligibleCoursesMode: "all_published",
  eligibleCourseIds: [],
  eligibleCategoriesText: "",
  previewVideos: [],
};

const makeRowId = () => `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

const toSlug = (value: string) => {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[^a-z0-9\s-]/g, "")
    .replace(/\s+/g, "-")
    .replace(/-+/g, "-");
};

const parseListInput = (value: string) => {
  return Array.from(
    new Set(
      String(value || "")
        .split(",")
        .map((item) => item.trim().toLowerCase())
        .filter(Boolean)
    )
  );
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
  const [allCourses, setAllCourses] = useState<{ _id: string; title: string }[]>([]);
  const [uploadingRow, setUploadingRow] = useState<string | null>(null);

  const selectedPlan = useMemo(
    () => plans.find((plan) => plan._id === selectedPlanId) || null,
    [plans, selectedPlanId]
  );

  const otherTieredPlans = useMemo(
    () => plans.filter((plan) => plan.planKind === "tiered" && plan._id !== selectedPlanId),
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
        (plan.description || "").toLowerCase().includes(query)
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
    fetchAllCourses();
  }, [loadPlans, loadPlanUsage]);

  useEffect(() => {
    if (!selectedPlan) {
      return;
    }

    setForm({
      title: selectedPlan.title || "",
      slug: selectedPlan.slug || "",
      description: selectedPlan.description || "",
      status: selectedPlan.status || "draft",
      displayOrder: selectedPlan.displayOrder ?? 0,
      validityDays: selectedPlan.validityDays ?? 365,
      isLifetime: !!selectedPlan.isLifetime,
      amount: selectedPlan.pricing?.oneTime?.amount ?? 0,
      currency: selectedPlan.pricing?.oneTime?.currency || "INR",
      courseSelectionEnabled: !!selectedPlan.access?.courseSelection?.enabled,
      communityAccess: !!selectedPlan.access?.communityAccess,
      planKind: selectedPlan.planKind === "tiered" ? "tiered" : "standalone",
      tierLevel: selectedPlan.tierLevel ?? 0,
      inheritedPlanIds: (selectedPlan.access?.inheritedPlanIds || []).map((id) => String(id)),
      maxSelectableCourses: selectedPlan.access?.courseSelection?.maxSelectableCourses ?? 3,
      eligibleCoursesMode: selectedPlan.access?.courseSelection?.eligibleCoursesMode || "all_published",
      eligibleCourseIds: (selectedPlan.access?.courseSelection?.eligibleCourseIds || []).map((id) => String(id)),
      eligibleCategoriesText: (selectedPlan.access?.courseSelection?.eligibleCategories || []).join(", "),
      previewVideos: (selectedPlan.previewVideos || []).map((video) => ({
        id: makeRowId(),
        title: video.title || "",
        videoUrl: video.videoUrl || "",
        thumbnailUrl: video.thumbnailUrl || "",
        duration: video.duration || "",
      })),
    });
  }, [selectedPlan]);

  const fetchAllCourses = useCallback(async () => {
    try {
      const response = await apiClient.get("/api/courses/all");
      const courses = response.data?.courses || [];
      setAllCourses(courses.map((c: any) => ({ _id: c._id, title: c.title })));
    } catch {
      // non-critical
    }
  }, []);

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

  const addPreviewVideo = () => {
    updateField("previewVideos", [
      ...form.previewVideos,
      { id: makeRowId(), title: "", videoUrl: "", thumbnailUrl: "", duration: "" },
    ]);
  };

  const updatePreviewVideo = (id: string, patch: Partial<PreviewVideoForm>) => {
    updateField(
      "previewVideos",
      form.previewVideos.map((video) => (video.id === id ? { ...video, ...patch } : video))
    );
  };

  const removePreviewVideo = (id: string) => {
    updateField("previewVideos", form.previewVideos.filter((video) => video.id !== id));
  };

  const uploadPreviewMedia = async (id: string, file: File, kind: "video" | "image") => {
    const formData = new FormData();
    formData.append(kind === "video" ? "video" : "image", file);

    setUploadingRow(id);
    try {
      const endpoint = kind === "video" ? "/api/upload/video" : "/api/upload/image";
      const response = await apiClient.post(endpoint, formData, { timeout: 30 * 60 * 1000 });
      const url = response.data?.data?.url;
      if (response.data?.success && url) {
        updatePreviewVideo(id, kind === "video" ? { videoUrl: url } : { thumbnailUrl: url });
        toast.success(kind === "video" ? "Video uploaded" : "Thumbnail uploaded");
      } else {
        toast.error("Upload failed");
      }
    } catch (error: any) {
      toast.error(error.response?.data?.message || "Upload failed");
    } finally {
      setUploadingRow(null);
    }
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

    return {
      title: form.title.trim(),
      slug,
      description: form.description.trim(),
      status: form.status,
      displayOrder: Number(form.displayOrder || 0),
      validityDays: Number(form.validityDays || 365),
      isLifetime: form.isLifetime,
      planKind: form.planKind,
      tierLevel: Number(form.tierLevel || 0),
      pricing: {
        oneTime: {
          amount: Number(form.amount || 0),
          currency: (form.currency || "INR").toUpperCase(),
        },
      },
      access: {
        includedCourseIds: [],
        limits: {
          maxCategories: null,
          maxCoursesTotal: null,
          perCategoryCourseLimit: null,
        },
        accessMode: "entitlement_only",
        communityAccess: form.communityAccess,
        counselingAccess: false,
        eventAccess: false,
        inheritedPlanIds: form.planKind === "tiered" ? form.inheritedPlanIds : [],
        courseSelection: {
          enabled: form.courseSelectionEnabled,
          maxSelectableCourses: Number(form.maxSelectableCourses || 3),
          eligibleCoursesMode: form.eligibleCoursesMode,
          eligibleCourseIds: form.eligibleCoursesMode === "specific"
            ? (form.eligibleCourseIds || []).filter(Boolean)
            : [],
          eligibleCategories: form.eligibleCoursesMode === "categories"
            ? parseListInput(form.eligibleCategoriesText)
            : [],
        },
      },
      previewVideos: form.previewVideos.map(({ id, ...video }) => video),
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
    const confirmed = window.confirm(
      `Delete "${plan.title}" permanently?\n\n` +
        `This removes all related records (course mappings, memberships and community groups) ` +
        `and resets affected users to the free plan. User accounts are kept.\n\n` +
        `This cannot be undone.`
    );
    if (!confirmed) {
      return;
    }

    try {
      setDeletingPlanId(plan._id);

      try {
        await apiClient.delete(`/api/membership-plans/${plan._id}`);
      } catch (error: any) {
        const data = error.response?.data;
        if (error.response?.status === 409 && data?.requiresConfirmation) {
          const proceed = window.confirm(`${data.message}\n\nDelete the plan and all related records now?`);
          if (!proceed) {
            return;
          }
          await apiClient.delete(`/api/membership-plans/${plan._id}`, {
            data: { force: true },
          });
        } else {
          throw error;
        }
      }

      toast.success("Plan deleted. User accounts were preserved.");

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
                <p className="text-xs mt-1">
                  {plan.planKind === "tiered" ? (
                    <span className="text-indigo-600 font-medium">Tier {plan.tierLevel ?? 0}</span>
                  ) : (
                    <span className="text-gray-400">Standalone</span>
                  )}
                  {(plan.access?.inheritedPlanIds?.length || 0) > 0 && (
                    <span className="text-gray-500"> · Includes {plan.access!.inheritedPlanIds!.length}</span>
                  )}
                </p>
                <p className="text-sm text-gray-700 mt-2">₹{(plan.pricing?.oneTime?.amount || 0).toLocaleString("en-IN")}</p>
                <p className="text-xs text-gray-500 mt-1">Users: {planUsage[plan.slug] || 0}</p>
                {plan.access?.courseSelection?.enabled && (
                  <p className="text-xs text-teal-600 mt-0.5 font-medium">
                    Course Selection: {plan.access.courseSelection.maxSelectableCourses} credits
                  </p>
                )}
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
              <label className="block text-sm font-medium text-gray-700 mb-1">One-time Price (INR)</label>
              <input
                type="number"
                value={form.amount || ""}
                onChange={(event) => updateField("amount", Number(event.target.value || 0))}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                placeholder="499"
              />
              {formErrors.amount && <p className="text-xs text-red-600 mt-1">{formErrors.amount}</p>}
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Validity</label>
              <div className="flex items-center gap-3">
                <input
                  type="number"
                  value={form.isLifetime ? "" : form.validityDays}
                  onChange={(event) => updateField("validityDays", Number(event.target.value || 365))}
                  disabled={form.isLifetime}
                  className="w-28 px-3 py-2 border border-gray-300 rounded-lg disabled:bg-gray-100 disabled:text-gray-400"
                  placeholder="365"
                />
                <span className="text-sm text-gray-500">days</span>
                <label className="flex items-center gap-2 text-sm text-gray-700 ml-4">
                  <input
                    type="checkbox"
                    checked={form.isLifetime}
                    onChange={(event) => {
                      updateField("isLifetime", event.target.checked);
                      if (event.target.checked) {
                        updateField("validityDays", 36500);
                      }
                    }}
                  />
                  Lifetime
                </label>
              </div>
              {formErrors.validityDays && <p className="text-xs text-red-600 mt-1">{formErrors.validityDays}</p>}
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Description</label>
            <textarea
              value={form.description}
              onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
              rows={3}
              placeholder="Shown on the plan card in the app"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg"
            />
          </div>

          <div className="border border-gray-200 rounded-lg p-4 space-y-4">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-semibold text-gray-900">Course Access</h3>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="checkbox"
                  checked={form.courseSelectionEnabled}
                  onChange={(event) => updateField("courseSelectionEnabled", event.target.checked)}
                />
                Limit course access
              </label>
            </div>
            <p className="text-xs text-gray-500">
              When enabled, users get limited credits to pick specific courses. When disabled, users access all courses tagged with this plan.
            </p>

            <div
              className="space-y-4 transition-opacity duration-200"
              style={{
                opacity: form.courseSelectionEnabled ? 1 : 0.5,
                pointerEvents: form.courseSelectionEnabled ? "auto" : "none",
              }}
            >
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Max Selectable Courses
                  </label>
                  <input
                    type="number"
                    min={1}
                    value={form.maxSelectableCourses}
                    onChange={(event) => updateField("maxSelectableCourses", Number(event.target.value || 1))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">How many courses the user can pick</p>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Eligible Courses
                  </label>
                  <select
                    value={form.eligibleCoursesMode}
                    onChange={(event) => setForm((prev) => ({ ...prev, eligibleCoursesMode: event.target.value as EligibleCoursesMode }))}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  >
                    <option value="all_published">All Published Courses</option>
                    <option value="specific">Specific Courses</option>
                    <option value="categories">By Categories</option>
                  </select>
                </div>
              </div>

              {form.eligibleCoursesMode === "specific" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">
                    Select Eligible Courses
                  </label>
                  <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 space-y-1.5">
                    {allCourses.length === 0 ? (
                      <p className="text-sm text-gray-500">No courses found.</p>
                    ) : (
                      allCourses.map((course) => (
                        <label key={course._id} className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5">
                          <input
                            type="checkbox"
                            checked={form.eligibleCourseIds.includes(course._id)}
                            onChange={(event) => {
                              const checked = event.target.checked;
                              setForm((prev) => ({
                                ...prev,
                                eligibleCourseIds: checked
                                  ? Array.from(new Set([...prev.eligibleCourseIds, course._id]))
                                  : prev.eligibleCourseIds.filter((id) => id !== course._id),
                              }));
                            }}
                          />
                          <span className="truncate">{course.title}</span>
                        </label>
                      ))
                    )}
                  </div>
                  <p className="text-xs text-gray-500 mt-1">
                    Selected: {form.eligibleCourseIds.length} course(s)
                  </p>
                </div>
              )}

              {form.eligibleCoursesMode === "categories" && (
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">
                    Eligible Categories
                  </label>
                  <input
                    value={form.eligibleCategoriesText}
                    onChange={(event) => setForm((prev) => ({ ...prev, eligibleCategoriesText: event.target.value }))}
                    placeholder="physical, mental, financial"
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Comma-separated category names</p>
                </div>
              )}
            </div>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 space-y-4">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-sm font-semibold text-gray-900">Preview videos</h3>
                <p className="text-xs text-gray-500 mt-1">
                  Free videos users can watch before buying this plan.
                </p>
              </div>
              <button
                type="button"
                onClick={addPreviewVideo}
                className="px-3 py-1.5 text-sm font-medium text-secondary border border-gray-300 rounded-lg hover:bg-gray-50 flex items-center gap-1"
              >
                <Plus className="w-4 h-4" /> Add video
              </button>
            </div>

            {form.previewVideos.length === 0 ? (
              <p className="text-sm text-gray-500">No preview videos yet.</p>
            ) : (
              <div className="space-y-3">
                {form.previewVideos.map((video) => (
                  <div key={video.id} className="border border-gray-200 rounded-lg p-3 space-y-3 bg-gray-50">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-600">Preview video</span>
                      <button
                        type="button"
                        onClick={() => removePreviewVideo(video.id)}
                        className="text-xs text-red-600 hover:text-red-700 flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" /> Remove
                      </button>
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Title</label>
                      <input
                        value={video.title}
                        onChange={(event) => updatePreviewVideo(video.id, { title: event.target.value })}
                        className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                        placeholder="Sample lesson"
                      />
                    </div>

                    <div>
                      <label className="block text-xs font-medium text-gray-600 mb-1">Video</label>
                      <div className="flex gap-2">
                        <input
                          type="url"
                          value={video.videoUrl}
                          onChange={(event) => updatePreviewVideo(video.id, { videoUrl: event.target.value })}
                          className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="https://... or upload"
                        />
                        <div className="relative">
                          <input
                            type="file"
                            accept="video/*"
                            disabled={uploadingRow === video.id}
                            onChange={(event) => {
                              const file = event.target.files?.[0];
                              if (file) uploadPreviewMedia(video.id, file, "video");
                              event.target.value = "";
                            }}
                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                          />
                          <button
                            type="button"
                            disabled={uploadingRow === video.id}
                            className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-sm text-secondary flex items-center gap-1 whitespace-nowrap"
                          >
                            <Upload className="w-4 h-4" />
                            {uploadingRow === video.id ? "Uploading..." : "Upload"}
                          </button>
                        </div>
                      </div>
                    </div>

                    <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                      <div className="md:col-span-2">
                        <label className="block text-xs font-medium text-gray-600 mb-1">Thumbnail URL</label>
                        <div className="flex gap-2">
                          <input
                            type="url"
                            value={video.thumbnailUrl}
                            onChange={(event) => updatePreviewVideo(video.id, { thumbnailUrl: event.target.value })}
                            className="flex-1 px-3 py-2 border border-gray-300 rounded-lg"
                            placeholder="https://..."
                          />
                          <div className="relative">
                            <input
                              type="file"
                              accept="image/*"
                              disabled={uploadingRow === video.id}
                              onChange={(event) => {
                                const file = event.target.files?.[0];
                                if (file) uploadPreviewMedia(video.id, file, "image");
                                event.target.value = "";
                              }}
                              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer disabled:cursor-not-allowed"
                            />
                            <button
                              type="button"
                              disabled={uploadingRow === video.id}
                              className="px-3 py-2 border border-gray-300 rounded-lg hover:bg-gray-100 text-sm text-secondary flex items-center gap-1 whitespace-nowrap"
                            >
                              <Upload className="w-4 h-4" /> Image
                            </button>
                          </div>
                          <p className="text-xs text-gray-400 mt-1">Recommended: 600 × 400 px (3:2 ratio)</p>
                        </div>
                      </div>
                      <div>
                        <label className="block text-xs font-medium text-gray-600 mb-1">Duration</label>
                        <input
                          value={video.duration}
                          onChange={(event) => updatePreviewVideo(video.id, { duration: event.target.value })}
                          className="w-full px-3 py-2 border border-gray-300 rounded-lg"
                          placeholder="5:30"
                        />
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">Community Access</h3>
            <label className="flex items-center gap-2 text-sm text-gray-700">
              <input
                type="checkbox"
                checked={form.communityAccess}
                onChange={(event) => updateField("communityAccess", event.target.checked)}
              />
              Enable community groups for this plan
            </label>
            <p className="text-xs text-gray-500">
              Users on this plan get access to plan-based community groups and category subgroups.
            </p>
          </div>

          <div className="border border-gray-200 rounded-lg p-4 space-y-4">
            <div>
              <h3 className="text-sm font-semibold text-gray-900">Plan relationships</h3>
              <p className="text-xs text-gray-500 mt-1">
                Standalone plans are buyable on their own. Tiered plans can include lower-tier plans so buyers of a
                higher tier are not offered the included plans again.
              </p>
            </div>

            <div className="flex flex-wrap gap-5">
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="planKind"
                  checked={form.planKind === "standalone"}
                  onChange={() => setForm((prev) => ({ ...prev, planKind: "standalone", inheritedPlanIds: [] }))}
                />
                Standalone
              </label>
              <label className="flex items-center gap-2 text-sm text-gray-700">
                <input
                  type="radio"
                  name="planKind"
                  checked={form.planKind === "tiered"}
                  onChange={() => updateField("planKind", "tiered")}
                />
                Part of a hierarchy (tiered)
              </label>
            </div>

            {form.planKind === "tiered" && (
              <>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Tier level</label>
                  <input
                    type="number"
                    min={0}
                    value={form.tierLevel}
                    onChange={(event) => updateField("tierLevel", Number(event.target.value || 0))}
                    className="w-32 px-3 py-2 border border-gray-300 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">
                    Lower number = lower tier (e.g. Bronze 1, Copper 2, Silver 3).
                  </p>
                </div>

                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-2">Includes plans</label>
                  {otherTieredPlans.length === 0 ? (
                    <p className="text-sm text-gray-500">
                      No other tiered plans yet. Mark lower tiers as &ldquo;Part of a hierarchy&rdquo; first.
                    </p>
                  ) : (
                    <div className="max-h-48 overflow-y-auto rounded-lg border border-gray-200 bg-white p-3 space-y-1.5">
                      {otherTieredPlans.map((plan) => (
                        <label
                          key={plan._id}
                          className="flex items-center gap-2 text-sm text-gray-700 cursor-pointer hover:bg-gray-50 rounded px-1 py-0.5"
                        >
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
                          <span className="truncate">{plan.title}</span>
                          <span className="ml-auto text-xs text-gray-400">Tier {plan.tierLevel ?? 0}</span>
                        </label>
                      ))}
                    </div>
                  )}
                  <p className="text-xs text-gray-500 mt-1">Selected: {form.inheritedPlanIds.length} plan(s)</p>
                </div>
              </>
            )}
          </div>

          <div className="border border-gray-200 rounded-lg p-4 space-y-3 bg-gray-50">
            <h3 className="text-sm font-semibold text-gray-900">Live Preview</h3>
            <div className="rounded-lg border border-gray-200 bg-white p-4">
              <div className="flex items-center justify-between">
                <p className="font-semibold text-gray-900">{form.title || "Untitled Plan"}</p>
                <span className={`text-xs px-2 py-1 rounded-full ${
                  form.status === "published"
                    ? "bg-green-100 text-green-700"
                    : form.status === "draft"
                      ? "bg-yellow-100 text-yellow-700"
                      : "bg-gray-100 text-gray-700"
                }`}>
                  {form.status}
                </span>
              </div>
              <p className="text-sm text-gray-600 mt-2">{form.description || "No description yet."}</p>
              <div className="mt-3 flex flex-wrap gap-2 text-xs">
                <span className="px-2 py-1 rounded bg-blue-50 text-blue-700">INR {Number(form.amount || 0).toLocaleString("en-IN")}</span>
                <span className="px-2 py-1 rounded bg-indigo-50 text-indigo-700">
                  {form.isLifetime ? "Lifetime" : `${Number(form.validityDays || 365)} days`}
                </span>
                {form.courseSelectionEnabled && (
                  <span className="px-2 py-1 rounded bg-teal-50 text-teal-700">
                    {form.maxSelectableCourses} course credits
                  </span>
                )}
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
