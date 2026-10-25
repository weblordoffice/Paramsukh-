'use client';

import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { BadgeCheck, Eye, RefreshCw, X, CalendarClock, Award } from 'lucide-react';

interface VivaApplication {
    _id: string;
    status: string;
    notes?: string;
    appliedAt?: string;
    scheduledAt?: string;
    completedAt?: string;
    meetingPlatform?: string;
    meetingLink?: string;
    result?: { status?: string; remarks?: string; feedback?: string };
    user?: { _id: string; displayName?: string; email?: string; phone?: string };
    course?: { _id: string; title?: string };
    assessmentAttempt?: { _id: string; attemptNumber?: number; percentage?: number; passed?: boolean };
    statusHistory?: Array<{ from?: string; to: string; note?: string; at: string }>;
}

const statusStyles: Record<string, string> = {
    applied: 'bg-blue-100 text-blue-700',
    under_review: 'bg-amber-100 text-amber-700',
    scheduled: 'bg-purple-100 text-purple-700',
    completed: 'bg-indigo-100 text-indigo-700',
    passed: 'bg-green-100 text-green-700',
    failed: 'bg-red-100 text-red-700',
    cancelled: 'bg-gray-100 text-gray-600',
    no_show: 'bg-amber-100 text-amber-700',
};

const nextActions: Record<string, Array<{ status: string; label: string }>> = {
    applied: [
        { status: 'under_review', label: 'Start Review' },
        { status: 'cancelled', label: 'Cancel' },
    ],
    under_review: [
        { status: 'scheduled', label: 'Schedule Viva' },
        { status: 'cancelled', label: 'Cancel' },
    ],
    scheduled: [
        { status: 'completed', label: 'Mark Completed' },
        { status: 'no_show', label: 'Mark No Show' },
        { status: 'cancelled', label: 'Cancel' },
    ],
    no_show: [
        { status: 'scheduled', label: 'Reschedule Viva' },
        { status: 'cancelled', label: 'Cancel' },
    ],
    completed: [
        { status: 'passed', label: 'Pass' },
        { status: 'failed', label: 'Fail' },
    ],
};

const formatDate = (value?: string) =>
    value ? new Date(value).toLocaleString('en-IN', { dateStyle: 'medium', timeStyle: 'short' }) : '—';

export default function VivaApplicationsPage() {
    const [applications, setApplications] = useState<VivaApplication[]>([]);
    const [loading, setLoading] = useState(true);
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1 });
    const [selected, setSelected] = useState<VivaApplication | null>(null);
    const [detailLoading, setDetailLoading] = useState(false);
    const [transitioning, setTransitioning] = useState(false);
    const [issueTarget, setIssueTarget] = useState<VivaApplication | null>(null);
    const [issueLoading, setIssueLoading] = useState(false);

    const [scheduleForm, setScheduleForm] = useState({
        scheduledAt: '',
        meetingPlatform: '',
        meetingLink: '',
        notes: '',
    });
    const [resultForm, setResultForm] = useState({ remarks: '', feedback: '', note: '' });

    const fetchApplications = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiClient.get('/api/admin/viva-applications', {
                params: { page, limit: 20, status: statusFilter || undefined },
            });
            setApplications(response.data?.applications || []);
            setPagination({
                total: response.data?.pagination?.total || 0,
                pages: response.data?.pagination?.pages || 1,
            });
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to load viva applications');
        } finally {
            setLoading(false);
        }
    }, [page, statusFilter]);

    useEffect(() => {
        fetchApplications();
    }, [fetchApplications]);

    const openApplication = async (id: string) => {
        setDetailLoading(true);
        setSelected(null);
        try {
            const response = await apiClient.get(`/api/admin/viva-applications/${id}`);
            const application = response.data?.application;
            setSelected(application);
            setScheduleForm({
                scheduledAt: application?.scheduledAt
                    ? new Date(application.scheduledAt).toISOString().slice(0, 16)
                    : '',
                meetingPlatform: application?.meetingPlatform || '',
                meetingLink: application?.meetingLink || '',
                notes: application?.notes || '',
            });
            setResultForm({ remarks: '', feedback: '', note: '' });
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to load application');
        } finally {
            setDetailLoading(false);
        }
    };

    const transition = async (nextStatus: string) => {
        if (!selected) return;
        const payload: Record<string, any> = { status: nextStatus };
        if (nextStatus === 'scheduled') {
            if (!scheduleForm.scheduledAt) {
                toast.error('Choose a date and time for the viva');
                return;
            }
            payload.scheduledAt = new Date(scheduleForm.scheduledAt).toISOString();
            payload.meetingPlatform = scheduleForm.meetingPlatform;
            payload.meetingLink = scheduleForm.meetingLink;
            payload.notes = scheduleForm.notes;
        }
        if (nextStatus === 'completed') {
            payload.notes = scheduleForm.notes;
        }
        if (nextStatus === 'passed' || nextStatus === 'failed') {
            if (!resultForm.remarks.trim()) {
                toast.error('Add a brief remark for the result');
                return;
            }
            payload.remarks = resultForm.remarks;
            payload.feedback = resultForm.feedback;
        }
        if (nextStatus === 'cancelled' && resultForm.note.trim()) {
            payload.note = resultForm.note;
        }

        setTransitioning(true);
        try {
            await apiClient.patch(`/api/admin/viva-applications/${selected._id}/status`, payload);
            toast.success(`Viva marked ${nextStatus.replace('_', ' ')}`);
            setSelected(null);
            fetchApplications();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to update viva');
        } finally {
            setTransitioning(false);
        }
    };

    const issueCertificate = async () => {
        if (!issueTarget?.user?._id || !issueTarget?.course?._id) return;
        setIssueLoading(true);
        try {
            await apiClient.post('/api/admin/certificates/assessment', {
                userId: issueTarget.user._id,
                courseId: issueTarget.course._id,
                vivaApplicationId: issueTarget._id,
            });
            toast.success('Assessment certificate issued');
            setIssueTarget(null);
            fetchApplications();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to issue certificate');
        } finally {
            setIssueLoading(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Viva Applications</h1>
                    <p className="text-sm text-gray-500">
                        Review assessment passes, schedule vivas, and record outcomes.
                    </p>
                </div>
                <div className="flex items-center gap-2">
                    <select
                        value={statusFilter}
                        onChange={(event) => {
                            setStatusFilter(event.target.value);
                            setPage(1);
                        }}
                        className="rounded-lg border bg-white px-3 py-2 text-sm"
                    >
                        <option value="">All statuses</option>
                        <option value="applied">Applied</option>
                        <option value="under_review">Under review</option>
                        <option value="scheduled">Scheduled</option>
                        <option value="completed">Completed</option>
                        <option value="passed">Passed</option>
                        <option value="failed">Failed</option>
                        <option value="cancelled">Cancelled</option>
                        <option value="no_show">No show</option>
                    </select>
                    <button
                        onClick={fetchApplications}
                        className="inline-flex items-center gap-2 rounded-lg border bg-white px-3 py-2 text-sm font-medium hover:bg-gray-50"
                    >
                        <RefreshCw size={16} /> Refresh
                    </button>
                </div>
            </div>

            <div className="overflow-hidden rounded-xl border bg-white shadow-sm">
                {loading ? (
                    <div className="flex items-center justify-center py-16">
                        <div className="animate-spin rounded-full h-10 w-10 border-b-2 border-blue-600" />
                    </div>
                ) : applications.length === 0 ? (
                    <div className="py-16 text-center">
                        <BadgeCheck className="mx-auto mb-3 text-gray-300" size={44} />
                        <p className="text-gray-500">No viva applications found.</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {applications.map((application) => (
                            <div key={application._id} className="flex flex-wrap items-center gap-4 p-4">
                                <div className="min-w-0 flex-1">
                                    <div className="flex flex-wrap items-center gap-2">
                                        <span className="font-semibold text-gray-900">
                                            {application.user?.displayName || 'Learner'}
                                        </span>
                                        <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                            statusStyles[application.status] || 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {application.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <p className="mt-1 truncate text-sm text-gray-600">
                                        {application.course?.title || 'Course'} · attempted{' '}
                                        {formatDate(application.appliedAt)}
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        {application.user?.email || application.user?.phone || 'No contact'}
                                        {application.assessmentAttempt?.percentage !== undefined
                                            ? ` · Assessment ${application.assessmentAttempt.percentage}%`
                                            : ''}
                                    </p>
                                </div>
                                <div className="flex items-center gap-2">
                                    <button
                                        onClick={() => openApplication(application._id)}
                                        className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                    >
                                        <Eye size={16} /> Review
                                    </button>
                                    {application.status === 'passed' && (
                                        <button
                                            onClick={() => setIssueTarget(application)}
                                            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-3 py-2 text-sm font-medium text-white hover:bg-green-700"
                                        >
                                            <Award size={16} /> Issue Certificate
                                        </button>
                                    )}
                                </div>
                            </div>
                        ))}
                    </div>
                )}

                {pagination.pages > 1 && (
                    <div className="flex items-center justify-between border-t px-4 py-3 text-sm">
                        <button
                            onClick={() => setPage((prev) => Math.max(1, prev - 1))}
                            disabled={page <= 1}
                            className="rounded border px-3 py-1.5 disabled:opacity-40"
                        >
                            Previous
                        </button>
                        <span className="text-gray-500">
                            Page {page} of {pagination.pages} · {pagination.total} total
                        </span>
                        <button
                            onClick={() => setPage((prev) => Math.min(pagination.pages, prev + 1))}
                            disabled={page >= pagination.pages}
                            className="rounded border px-3 py-1.5 disabled:opacity-40"
                        >
                            Next
                        </button>
                    </div>
                )}
            </div>

            {(selected || detailLoading) && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="max-h-[90vh] w-full max-w-2xl overflow-y-auto rounded-xl bg-white p-5 shadow-xl">
                        <div className="mb-4 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">Viva Review</h3>
                            <button onClick={() => setSelected(null)} className="rounded p-1 text-gray-500 hover:bg-gray-100">
                                <X size={20} />
                            </button>
                        </div>

                        {detailLoading || !selected ? (
                            <div className="flex items-center justify-center py-10">
                                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600" />
                            </div>
                        ) : (
                            <div className="space-y-4">
                                <div className="grid gap-3 rounded-lg bg-gray-50 p-4 text-sm sm:grid-cols-2">
                                    <div>
                                        <p className="text-gray-500">Learner</p>
                                        <p className="font-medium text-gray-900">{selected.user?.displayName || 'Learner'}</p>
                                        <p className="text-gray-600">{selected.user?.email || selected.user?.phone || 'No contact'}</p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Course</p>
                                        <p className="font-medium text-gray-900">{selected.course?.title || 'Course'}</p>
                                        <p className="text-gray-600">
                                            Applied {formatDate(selected.appliedAt)}
                                        </p>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Current status</p>
                                        <span className={`mt-1 inline-block rounded-full px-2 py-0.5 text-xs font-semibold ${
                                            statusStyles[selected.status] || 'bg-gray-100 text-gray-600'
                                        }`}>
                                            {selected.status.replace('_', ' ')}
                                        </span>
                                    </div>
                                    <div>
                                        <p className="text-gray-500">Assessment result</p>
                                        <p className="font-medium text-gray-900">
                                            {selected.assessmentAttempt?.percentage ?? 0}% ·{' '}
                                            {selected.assessmentAttempt?.passed ? 'Passed' : 'Not passed'}
                                        </p>
                                    </div>
                                </div>

                                {selected.notes && (
                                    <div className="rounded-lg border p-3 text-sm">
                                        <p className="mb-1 font-medium text-gray-700">Learner note</p>
                                        <p className="text-gray-600">{selected.notes}</p>
                                    </div>
                                )}

                                {(selected.status === 'under_review' || selected.status === 'no_show') && (
                                    <div className="space-y-3 rounded-lg border p-4">
                                        <p className="flex items-center gap-2 text-sm font-semibold text-gray-900">
                                            <CalendarClock size={16} /> Schedule viva
                                        </p>
                                        <div className="grid gap-3 sm:grid-cols-2">
                                            <label className="block">
                                                <span className="mb-1 block text-xs font-medium text-gray-600">Date & time</span>
                                                <input
                                                    type="datetime-local"
                                                    value={scheduleForm.scheduledAt}
                                                    onChange={(event) => setScheduleForm((prev) => ({ ...prev, scheduledAt: event.target.value }))}
                                                    className="w-full rounded-lg border px-3 py-2 text-sm"
                                                />
                                            </label>
                                            <label className="block">
                                                <span className="mb-1 block text-xs font-medium text-gray-600">Platform</span>
                                                <input
                                                    value={scheduleForm.meetingPlatform}
                                                    onChange={(event) => setScheduleForm((prev) => ({ ...prev, meetingPlatform: event.target.value }))}
                                                    placeholder="Zoom, Google Meet..."
                                                    className="w-full rounded-lg border px-3 py-2 text-sm"
                                                />
                                            </label>
                                        </div>
                                        <label className="block">
                                            <span className="mb-1 block text-xs font-medium text-gray-600">Meeting link</span>
                                            <input
                                                value={scheduleForm.meetingLink}
                                                onChange={(event) => setScheduleForm((prev) => ({ ...prev, meetingLink: event.target.value }))}
                                                className="w-full rounded-lg border px-3 py-2 text-sm"
                                                placeholder="https://..."
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="mb-1 block text-xs font-medium text-gray-600">Notes for learner</span>
                                            <textarea
                                                value={scheduleForm.notes}
                                                onChange={(event) => setScheduleForm((prev) => ({ ...prev, notes: event.target.value }))}
                                                rows={2}
                                                className="w-full rounded-lg border px-3 py-2 text-sm"
                                            />
                                        </label>
                                    </div>
                                )}

                                {selected.status === 'completed' && (
                                    <div className="space-y-3 rounded-lg border p-4">
                                        <p className="text-sm font-semibold text-gray-900">Record viva result</p>
                                        <label className="block">
                                            <span className="mb-1 block text-xs font-medium text-gray-600">Remarks (required)</span>
                                            <input
                                                value={resultForm.remarks}
                                                onChange={(event) => setResultForm((prev) => ({ ...prev, remarks: event.target.value }))}
                                                className="w-full rounded-lg border px-3 py-2 text-sm"
                                            />
                                        </label>
                                        <label className="block">
                                            <span className="mb-1 block text-xs font-medium text-gray-600">Feedback for learner (optional)</span>
                                            <textarea
                                                value={resultForm.feedback}
                                                onChange={(event) => setResultForm((prev) => ({ ...prev, feedback: event.target.value }))}
                                                rows={2}
                                                className="w-full rounded-lg border px-3 py-2 text-sm"
                                            />
                                        </label>
                                    </div>
                                )}

                                {selected.status === 'scheduled' && (
                                    <div className="rounded-lg border bg-purple-50 p-3 text-sm">
                                        <p className="font-medium text-gray-800">Scheduled {formatDate(selected.scheduledAt)}</p>
                                        {selected.meetingPlatform && <p className="text-gray-600">{selected.meetingPlatform}</p>}
                                        {selected.meetingLink && (
                                            <a
                                                href={selected.meetingLink}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="text-indigo-600 underline"
                                            >
                                                Join meeting link
                                            </a>
                                        )}
                                    </div>
                                )}

                                {selected.status === 'no_show' && (
                                    <div className="rounded-lg border bg-amber-50 p-3 text-sm">
                                        <p className="font-medium text-amber-800">Marked as no-show</p>
                                        <p className="text-amber-700">
                                            The learner missed the scheduled viva. You can reschedule it or cancel it.
                                        </p>
                                    </div>
                                )}

                                {selected.result?.remarks && (
                                    <div className="rounded-lg border bg-green-50 p-3 text-sm">
                                        <p className="font-medium text-gray-800">Result: {selected.result.status}</p>
                                        <p className="text-gray-600">{selected.result.remarks}</p>
                                        {selected.result.feedback && <p className="mt-1 text-gray-600">{selected.result.feedback}</p>}
                                    </div>
                                )}

                                {selected.statusHistory && selected.statusHistory.length > 0 && (
                                    <div>
                                        <p className="mb-2 text-sm font-semibold text-gray-900">History</p>
                                        <div className="space-y-1 text-xs text-gray-600">
                                            {selected.statusHistory.map((entry, index) => (
                                                <p key={index}>
                                                    {formatDate(entry.at)} — {entry.from ? `${entry.from} → ` : ''}{entry.to}
                                                    {entry.note ? ` · ${entry.note}` : ''}
                                                </p>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {(nextActions[selected.status] || []).length > 0 && (
                                    <div className="space-y-3 border-t pt-4">
                                        {selected.status === 'applied' && (
                                            <label className="block">
                                                <span className="mb-1 block text-xs font-medium text-gray-600">Note (optional)</span>
                                                <input
                                                    value={resultForm.note}
                                                    onChange={(event) => setResultForm((prev) => ({ ...prev, note: event.target.value }))}
                                                    className="w-full rounded-lg border px-3 py-2 text-sm"
                                                />
                                            </label>
                                        )}
                                        <div className="flex flex-wrap justify-end gap-2">
                                            {nextActions[selected.status].map((action) => (
                                                <button
                                                    key={action.status}
                                                    onClick={() => transition(action.status)}
                                                    disabled={transitioning}
                                                    className={`rounded-lg px-4 py-2 text-sm font-medium text-white disabled:opacity-60 ${
                                                        action.status === 'failed' || action.status === 'cancelled'
                                                            ? 'bg-red-600 hover:bg-red-700'
                                                            : action.status === 'passed'
                                                                ? 'bg-green-600 hover:bg-green-700'
                                                                : 'bg-indigo-600 hover:bg-indigo-700'
                                                    }`}
                                                >
                                                    {action.label}
                                                </button>
                                            ))}
                                        </div>
                                    </div>
                                )}

                                {selected.status === 'passed' && (
                                    <div className="border-t pt-4 text-right">
                                        <button
                                            onClick={() => setIssueTarget(selected)}
                                            className="inline-flex items-center gap-2 rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700"
                                        >
                                            <Award size={16} /> Issue Assessment Certificate
                                        </button>
                                    </div>
                                )}
                            </div>
                        )}
                    </div>
                </div>
            )}

            {issueTarget && (
                <div className="fixed inset-0 z-[60] flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
                        <h3 className="text-lg font-semibold text-gray-900">Issue assessment certificate?</h3>
                        <p className="mt-2 text-sm text-gray-600">
                            This will issue a course assessment certificate for{' '}
                            <span className="font-medium">{issueTarget.user?.displayName || 'the learner'}</span> in{' '}
                            <span className="font-medium">{issueTarget.course?.title || 'this course'}</span>.
                        </p>
                        <div className="mt-5 flex justify-end gap-2">
                            <button
                                onClick={() => setIssueTarget(null)}
                                className="rounded-lg border px-4 py-2 text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={issueCertificate}
                                disabled={issueLoading}
                                className="rounded-lg bg-green-600 px-4 py-2 text-sm font-medium text-white hover:bg-green-700 disabled:opacity-60"
                            >
                                {issueLoading ? 'Issuing...' : 'Issue Certificate'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
