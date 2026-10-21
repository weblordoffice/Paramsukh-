'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import {
    Video,
    Plus,
    Pencil,
    Trash2,
    Upload,
    X,
    Calendar,
    Clock,
    Link2,
    Users,
    CheckCircle2,
} from 'lucide-react';

interface LiveSession {
    _id: string;
    title: string;
    description?: string;
    scheduledAt: string;
    durationInMinutes: number;
    meetingPlatform: 'zoom' | 'google-meet' | 'teams' | 'other';
    meetingLink: string;
    meetingPassword?: string | null;
    zoomMeetingId?: string | null;
    capacity?: number | null;
    registrationCount?: number;
    audienceType: 'all' | 'plans';
    planSlugs: string[];
    recordingUrl?: string | null;
    status: 'scheduled' | 'completed' | 'cancelled';
}

interface SessionRegistration {
    _id: string;
    registeredAt: string;
    userId?: {
        _id?: string;
        displayName?: string;
        email?: string;
        phone?: string;
    } | null;
}

interface MembershipPlan {
    _id: string;
    title: string;
    slug: string;
    isActive?: boolean;
}

interface FormState {
    title: string;
    description: string;
    scheduledAt: string;
    durationInMinutes: number;
    meetingPlatform: LiveSession['meetingPlatform'];
    meetingLink: string;
    capacity: string;
    autoCreateZoomMeeting: boolean;
    audienceType: LiveSession['audienceType'];
    planSlugs: string[];
    recordingUrl: string;
    status: LiveSession['status'];
}

const emptyForm: FormState = {
    title: '',
    description: '',
    scheduledAt: '',
    durationInMinutes: 60,
    meetingPlatform: 'zoom',
    meetingLink: '',
    capacity: '',
    autoCreateZoomMeeting: false,
    audienceType: 'all',
    planSlugs: [],
    recordingUrl: '',
    status: 'scheduled',
};

const toLocalInputValue = (iso: string) => {
    const date = new Date(iso);
    if (Number.isNaN(date.getTime())) return '';
    const local = new Date(date.getTime() - date.getTimezoneOffset() * 60000);
    return local.toISOString().slice(0, 16);
};

export default function LiveSessionsPage() {
    const [sessions, setSessions] = useState<LiveSession[]>([]);
    const [plans, setPlans] = useState<MembershipPlan[]>([]);
    const [loading, setLoading] = useState(true);
    const [saving, setSaving] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [pendingId, setPendingId] = useState<string | null>(null);
    const [showModal, setShowModal] = useState(false);
    const [editing, setEditing] = useState<LiveSession | null>(null);
    const [form, setForm] = useState<FormState>(emptyForm);
    const [zoomConfigured, setZoomConfigured] = useState(false);
    const [registrationsSession, setRegistrationsSession] = useState<LiveSession | null>(null);
    const [registrations, setRegistrations] = useState<SessionRegistration[]>([]);
    const [loadingRegistrations, setLoadingRegistrations] = useState(false);

    const loadSessions = useCallback(async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/api/live-sessions/admin/all');
            setSessions(response.data.data || []);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to load live sessions');
            setSessions([]);
        } finally {
            setLoading(false);
        }
    }, []);

    useEffect(() => {
        loadSessions();

        const loadPlans = async () => {
            try {
                const response = await apiClient.get('/api/membership-plans');
                setPlans((response.data?.data || []).filter((plan: MembershipPlan) => plan.isActive !== false));
            } catch {
                // Non-blocking; all-audience sessions still work.
            }
        };

        const loadConfig = async () => {
            try {
                const response = await apiClient.get('/api/live-sessions/admin/config');
                setZoomConfigured(response.data?.zoomConfigured === true);
            } catch {
                setZoomConfigured(false);
            }
        };

        loadPlans();
        loadConfig();
    }, [loadSessions]);

    const planTitleBySlug = useMemo(() => {
        const map = new Map<string, string>();
        plans.forEach((plan) => map.set(plan.slug, plan.title));
        return map;
    }, [plans]);

    const openCreate = () => {
        setEditing(null);
        setForm(emptyForm);
        setShowModal(true);
    };

    const openEdit = (session: LiveSession) => {
        setEditing(session);
        setForm({
            title: session.title,
            description: session.description || '',
            scheduledAt: toLocalInputValue(session.scheduledAt),
            durationInMinutes: session.durationInMinutes || 60,
            meetingPlatform: session.meetingPlatform || 'zoom',
            meetingLink: session.meetingLink || '',
            capacity: session.capacity != null ? String(session.capacity) : '',
            autoCreateZoomMeeting: false,
            audienceType: session.audienceType || 'all',
            planSlugs: session.planSlugs || [],
            recordingUrl: session.recordingUrl || '',
            status: session.status || 'scheduled',
        });
        setShowModal(true);
    };

    const openRegistrations = async (session: LiveSession) => {
        setRegistrationsSession(session);
        setLoadingRegistrations(true);
        try {
            const response = await apiClient.get(`/api/live-sessions/admin/${session._id}/registrations`);
            setRegistrations(response.data.registrations || []);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to load registrations');
            setRegistrations([]);
        } finally {
            setLoadingRegistrations(false);
        }
    };

    const togglePlan = (slug: string) => {
        setForm((prev) => ({
            ...prev,
            planSlugs: prev.planSlugs.includes(slug)
                ? prev.planSlugs.filter((item) => item !== slug)
                : [...prev.planSlugs, slug],
        }));
    };

    const uploadRecording = async (file: File | null) => {
        if (!file) return;
        setUploading(true);
        try {
            const formData = new FormData();
            formData.append('video', file);
            const response = await apiClient.post('/api/upload/video?folder=live_sessions', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const url = response.data?.data?.url;
            if (!url) throw new Error('Upload did not return a URL');
            setForm((prev) => ({ ...prev, recordingUrl: url }));
            toast.success('Recording uploaded');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to upload recording');
        } finally {
            setUploading(false);
        }
    };

    const saveSession = async () => {
        if (!form.title.trim()) {
            toast.error('Title is required');
            return;
        }
        if (!form.scheduledAt) {
            toast.error('Date and time are required');
            return;
        }
        const usingAutoZoom = form.autoCreateZoomMeeting && form.meetingPlatform === 'zoom';
        if (!form.meetingLink.trim() && !usingAutoZoom) {
            toast.error('Meeting link is required');
            return;
        }
        if (form.audienceType === 'plans' && form.planSlugs.length === 0) {
            toast.error('Select at least one membership plan');
            return;
        }

        setSaving(true);
        try {
            const payload = {
                title: form.title.trim(),
                description: form.description.trim(),
                scheduledAt: new Date(form.scheduledAt).toISOString(),
                durationInMinutes: Number(form.durationInMinutes) || 60,
                meetingPlatform: form.meetingPlatform,
                meetingLink: form.meetingLink.trim(),
                capacity: form.capacity ? Number(form.capacity) : null,
                autoCreateZoomMeeting: usingAutoZoom,
                audienceType: form.audienceType,
                planSlugs: form.audienceType === 'plans' ? form.planSlugs : [],
                recordingUrl: form.recordingUrl.trim() || null,
                status: form.status,
            };

            if (editing) {
                await apiClient.patch(`/api/live-sessions/admin/${editing._id}`, payload);
                toast.success('Live session updated');
            } else {
                await apiClient.post('/api/live-sessions/admin', payload);
                toast.success('Live session created');
            }

            setShowModal(false);
            setEditing(null);
            setForm(emptyForm);
            await loadSessions();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to save live session');
        } finally {
            setSaving(false);
        }
    };

    const deleteSession = async (session: LiveSession) => {
        if (!confirm(`Delete "${session.title}"?`)) return;
        setPendingId(session._id);
        try {
            await apiClient.delete(`/api/live-sessions/admin/${session._id}`);
            toast.success('Live session deleted');
            await loadSessions();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete live session');
        } finally {
            setPendingId(null);
        }
    };

    const formatDateTime = (iso: string) => {
        const date = new Date(iso);
        if (Number.isNaN(date.getTime())) return '—';
        return date.toLocaleString(undefined, {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-3xl font-bold text-secondary">Live Sessions</h1>
                    <p className="text-accent mt-1">Create coaching sessions for all members or selected plans.</p>
                </div>
                <button
                    onClick={openCreate}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition font-medium"
                >
                    <Plus className="w-5 h-5" />
                    Create Session
                </button>
            </div>

            {loading ? (
                <div className="flex justify-center py-16">
                    <div className="w-10 h-10 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                </div>
            ) : sessions.length === 0 ? (
                <div className="bg-white rounded-xl p-12 text-center text-accent shadow-md">
                    <Video className="w-16 h-16 mx-auto mb-4 text-accent/30" />
                    <p>No live sessions yet. Create your first session.</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 xl:grid-cols-2 gap-4">
                    {sessions.map((session) => (
                        <div key={session._id} className="bg-white rounded-xl p-5 shadow-md">
                            <div className="flex items-start justify-between gap-3">
                                <div className="min-w-0">
                                    <div className="flex items-center gap-2 flex-wrap">
                                        <h2 className="text-lg font-bold text-secondary">{session.title}</h2>
                                        <span className={`text-[10px] font-bold px-2 py-0.5 rounded ${session.status === 'cancelled'
                                            ? 'bg-red-50 text-red-700'
                                            : session.status === 'completed'
                                                ? 'bg-gray-100 text-gray-700'
                                                : 'bg-blue-50 text-blue-700'
                                            }`}>
                                            {session.status}
                                        </span>
                                        {session.recordingUrl && (
                                            <span className="text-[10px] font-bold px-2 py-0.5 rounded bg-green-50 text-green-700 flex items-center gap-1">
                                                <CheckCircle2 className="w-3 h-3" /> Recording
                                            </span>
                                        )}
                                    </div>
                                    {!!session.description && (
                                        <p className="text-sm text-accent mt-1 line-clamp-2">{session.description}</p>
                                    )}
                                </div>
                                <div className="flex items-center gap-1 shrink-0">
                                    <button
                                        onClick={() => openEdit(session)}
                                        className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition"
                                        title="Edit session"
                                    >
                                        <Pencil className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => deleteSession(session)}
                                        disabled={pendingId === session._id}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                                        title="Delete session"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>

                            <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 gap-2 text-sm text-accent">
                                <span className="flex items-center gap-2">
                                    <Calendar className="w-4 h-4" />
                                    {formatDateTime(session.scheduledAt)}
                                </span>
                                <span className="flex items-center gap-2">
                                    <Clock className="w-4 h-4" />
                                    {session.durationInMinutes} mins
                                </span>
                                <span className="flex items-center gap-2">
                                    <Users className="w-4 h-4" />
                                    {session.audienceType === 'all'
                                        ? 'All members'
                                        : `${session.planSlugs?.length || 0} plan(s)`}
                                </span>
                                <button
                                    onClick={() => openRegistrations(session)}
                                    className="flex items-center gap-2 text-primary hover:underline text-left"
                                >
                                    <Users className="w-4 h-4 shrink-0" />
                                    {session.registrationCount || 0} registered
                                    {session.capacity ? ` / ${session.capacity}` : ''}
                                </button>
                                <a
                                    href={session.meetingLink}
                                    target="_blank"
                                    rel="noopener noreferrer"
                                    className="flex items-center gap-2 text-primary hover:underline truncate sm:col-span-2"
                                >
                                    <Link2 className="w-4 h-4 shrink-0" />
                                    <span className="truncate">{session.meetingLink}</span>
                                </a>
                            </div>

                            {session.audienceType === 'plans' && (session.planSlugs || []).length > 0 && (
                                <div className="mt-3 flex flex-wrap gap-1.5">
                                    {(session.planSlugs || []).map((slug) => (
                                        <span key={slug} className="px-2 py-1 rounded bg-primary/5 text-xs text-primary">
                                            {planTitleBySlug.get(slug) || slug}
                                        </span>
                                    ))}
                                </div>
                            )}
                        </div>
                    ))}
                </div>
            )}

            {showModal && (
                <div
                    className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
                    onClick={() => !saving && setShowModal(false)}
                >
                    <div
                        className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto"
                        onClick={(event) => event.stopPropagation()}
                    >
                        <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl">
                            <h2 className="text-xl font-bold text-secondary">
                                {editing ? 'Edit Live Session' : 'Create Live Session'}
                            </h2>
                            <button
                                onClick={() => !saving && setShowModal(false)}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                                title="Close"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-5">
                            <div>
                                <label className="block text-sm font-semibold text-secondary mb-2">
                                    Title <span className="text-red-500">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={form.title}
                                    onChange={(event) => setForm((prev) => ({ ...prev, title: event.target.value }))}
                                    placeholder="e.g. Weekly Mindfulness Coaching"
                                    maxLength={200}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-secondary mb-2">Description</label>
                                <textarea
                                    value={form.description}
                                    onChange={(event) => setForm((prev) => ({ ...prev, description: event.target.value }))}
                                    placeholder="What will this session cover?"
                                    rows={3}
                                    maxLength={5000}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                                />
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">
                                        Date and time <span className="text-red-500">*</span>
                                    </label>
                                    <input
                                        type="datetime-local"
                                        value={form.scheduledAt}
                                        onChange={(event) => setForm((prev) => ({ ...prev, scheduledAt: event.target.value }))}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Duration (minutes)</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={form.durationInMinutes}
                                        onChange={(event) => setForm((prev) => ({ ...prev, durationInMinutes: Number(event.target.value) }))}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Platform</label>
                                    <select
                                        value={form.meetingPlatform}
                                        onChange={(event) => setForm((prev) => ({ ...prev, meetingPlatform: event.target.value as FormState['meetingPlatform'] }))}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                                    >
                                        <option value="zoom">Zoom</option>
                                        <option value="google-meet">Google Meet</option>
                                        <option value="teams">Teams</option>
                                        <option value="other">Other</option>
                                    </select>
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">
                                        Meeting link {!form.autoCreateZoomMeeting && <span className="text-red-500">*</span>}
                                    </label>
                                    <input
                                        type="url"
                                        value={form.meetingLink}
                                        onChange={(event) => setForm((prev) => ({ ...prev, meetingLink: event.target.value }))}
                                        placeholder={form.autoCreateZoomMeeting ? 'Generated automatically by Zoom' : 'https://zoom.us/j/...'}
                                        disabled={form.autoCreateZoomMeeting}
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary disabled:bg-gray-50"
                                    />
                                </div>
                            </div>

                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Capacity</label>
                                    <input
                                        type="number"
                                        min={1}
                                        value={form.capacity}
                                        onChange={(event) => setForm((prev) => ({ ...prev, capacity: event.target.value }))}
                                        placeholder="Unlimited"
                                        className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                {form.meetingPlatform === 'zoom' && zoomConfigured && (
                                    <label className="flex items-center gap-2 text-sm font-medium text-secondary md:mt-8">
                                        <input
                                            type="checkbox"
                                            checked={form.autoCreateZoomMeeting}
                                            onChange={(event) => setForm((prev) => ({ ...prev, autoCreateZoomMeeting: event.target.checked }))}
                                            className="w-4 h-4 accent-[#F1842D]"
                                        />
                                        Create Zoom meeting automatically
                                    </label>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-secondary mb-2">Audience</label>
                                <div className="flex flex-wrap gap-4">
                                    <label className="flex items-center gap-2 text-sm text-secondary">
                                        <input
                                            type="radio"
                                            checked={form.audienceType === 'all'}
                                            onChange={() => setForm((prev) => ({ ...prev, audienceType: 'all' }))}
                                            className="accent-[#F1842D]"
                                        />
                                        All members
                                    </label>
                                    <label className="flex items-center gap-2 text-sm text-secondary">
                                        <input
                                            type="radio"
                                            checked={form.audienceType === 'plans'}
                                            onChange={() => setForm((prev) => ({ ...prev, audienceType: 'plans' }))}
                                            className="accent-[#F1842D]"
                                        />
                                        Specific membership plans
                                    </label>
                                </div>

                                {form.audienceType === 'plans' && (
                                    <div className="mt-3 max-h-44 overflow-y-auto border border-gray-200 rounded-lg divide-y">
                                        {plans.length === 0 ? (
                                            <p className="p-3 text-sm text-accent">No membership plans found.</p>
                                        ) : (
                                            plans.map((plan) => {
                                                const checked = form.planSlugs.includes(plan.slug);
                                                return (
                                                    <label
                                                        key={plan._id}
                                                        className={`flex items-center gap-3 px-3 py-2 text-sm cursor-pointer ${checked ? 'bg-primary/5' : 'hover:bg-gray-50'}`}
                                                    >
                                                        <input
                                                            type="checkbox"
                                                            checked={checked}
                                                            onChange={() => togglePlan(plan.slug)}
                                                            className="w-4 h-4 accent-[#F1842D]"
                                                        />
                                                        <span className="text-secondary">{plan.title}</span>
                                                        <span className="text-xs text-accent ml-auto">{plan.slug}</span>
                                                    </label>
                                                );
                                            })
                                        )}
                                    </div>
                                )}
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-secondary mb-2">Recording</label>
                                <div className="flex flex-wrap items-center gap-3">
                                    <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium cursor-pointer hover:bg-gray-50 ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                                        <Upload className="w-4 h-4" />
                                        {uploading ? 'Uploading...' : 'Upload video'}
                                        <input
                                            type="file"
                                            accept="video/*"
                                            className="hidden"
                                            onChange={(event) => uploadRecording(event.target.files?.[0] || null)}
                                        />
                                    </label>
                                    <input
                                        type="url"
                                        value={form.recordingUrl}
                                        onChange={(event) => setForm((prev) => ({ ...prev, recordingUrl: event.target.value }))}
                                        placeholder="Or paste a recording URL"
                                        className="flex-1 min-w-[220px] px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                                    />
                                </div>
                                <p className="text-xs text-accent mt-2">Optional. Users will see “Watch Recording” after the session.</p>
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-secondary mb-2">Status</label>
                                <select
                                    value={form.status}
                                    onChange={(event) => setForm((prev) => ({ ...prev, status: event.target.value as FormState['status'] }))}
                                    className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm outline-none focus:ring-2 focus:ring-primary"
                                >
                                    <option value="scheduled">Scheduled</option>
                                    <option value="completed">Completed</option>
                                    <option value="cancelled">Cancelled</option>
                                </select>
                            </div>

                            <div className="flex items-center justify-end gap-3 pt-2">
                                <button
                                    onClick={() => setShowModal(false)}
                                    disabled={saving}
                                    className="px-4 py-2.5 border border-gray-300 rounded-lg text-secondary font-medium hover:bg-gray-50 transition disabled:opacity-50"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={saveSession}
                                    disabled={saving || uploading}
                                    className="px-5 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition font-semibold disabled:opacity-50"
                                >
                                    {saving ? 'Saving...' : editing ? 'Save Changes' : 'Create Session'}
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}

            {registrationsSession && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setRegistrationsSession(null)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-xl max-h-[85vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
                        <div className="sticky top-0 z-10 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl">
                            <div>
                                <h2 className="text-xl font-bold text-secondary">Registrations</h2>
                                <p className="text-sm text-accent">{registrationsSession.title}</p>
                            </div>
                            <button onClick={() => setRegistrationsSession(null)} className="p-2 hover:bg-gray-100 rounded-lg" title="Close">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            {loadingRegistrations ? (
                                <div className="flex justify-center py-10">
                                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : registrations.length === 0 ? (
                                <p className="text-sm text-accent text-center py-8">No registrations yet.</p>
                            ) : (
                                <div className="space-y-2">
                                    {registrations.map((registration) => (
                                        <div key={registration._id} className="flex items-center justify-between gap-3 rounded-lg border border-gray-100 px-3 py-2">
                                            <div className="min-w-0">
                                                <p className="text-sm font-semibold text-secondary">
                                                    {registration.userId?.displayName || 'User'}
                                                </p>
                                                <p className="text-xs text-accent truncate">
                                                    {registration.userId?.email || registration.userId?.phone || 'No contact'}
                                                </p>
                                            </div>
                                            <span className="text-xs text-accent whitespace-nowrap">
                                                {new Date(registration.registeredAt).toLocaleDateString()}
                                            </span>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
