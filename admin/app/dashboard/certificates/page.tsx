'use client';

import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/lib/api/client';
import { API_BASE_URL } from '@/lib/api/config';
import toast from 'react-hot-toast';
import { Award, Ban, ExternalLink, RefreshCw, X } from 'lucide-react';

interface Certificate {
    _id: string;
    certificateId: string;
    type?: string;
    title?: string;
    status?: string;
    issuedTo?: string;
    issuedAt?: string;
    planName?: string;
    isRevoked?: boolean;
    revokedAt?: string;
    revocationReason?: string;
    user?: { _id: string; displayName?: string; email?: string; phone?: string };
    course?: { _id: string; title?: string };
    verificationUrl?: string;
    viewUrl?: string;
}

const typeLabels: Record<string, string> = {
    course_participation: 'Course Participation',
    course_assessment: 'Course Assessment',
    membership: 'Membership',
};

const typeStyles: Record<string, string> = {
    course_participation: 'bg-blue-100 text-blue-700',
    course_assessment: 'bg-purple-100 text-purple-700',
    membership: 'bg-amber-100 text-amber-700',
};

const formatDate = (value?: string) =>
    value ? new Date(value).toLocaleDateString('en-IN', { dateStyle: 'medium' }) : '—';

export default function CertificatesPage() {
    const [certificates, setCertificates] = useState<Certificate[]>([]);
    const [loading, setLoading] = useState(true);
    const [typeFilter, setTypeFilter] = useState('');
    const [statusFilter, setStatusFilter] = useState('');
    const [page, setPage] = useState(1);
    const [pagination, setPagination] = useState({ total: 0, pages: 1 });
    const [revokeTarget, setRevokeTarget] = useState<Certificate | null>(null);
    const [revokeReason, setRevokeReason] = useState('');
    const [revoking, setRevoking] = useState(false);

    const fetchCertificates = useCallback(async () => {
        try {
            setLoading(true);
            const response = await apiClient.get('/api/admin/certificates', {
                params: {
                    page,
                    limit: 20,
                    type: typeFilter || undefined,
                    status: statusFilter || undefined,
                },
            });
            setCertificates(response.data?.certificates || []);
            setPagination({
                total: response.data?.pagination?.total || 0,
                pages: response.data?.pagination?.pages || 1,
            });
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to load certificates');
        } finally {
            setLoading(false);
        }
    }, [page, typeFilter, statusFilter]);

    useEffect(() => {
        fetchCertificates();
    }, [fetchCertificates]);

    const revokeCertificate = async () => {
        if (!revokeTarget) return;
        if (!revokeReason.trim()) {
            toast.error('Enter a reason for revoking the certificate');
            return;
        }
        setRevoking(true);
        try {
            await apiClient.post(`/api/admin/certificates/${revokeTarget._id}/revoke`, {
                reason: revokeReason.trim(),
            });
            toast.success('Certificate revoked');
            setRevokeTarget(null);
            setRevokeReason('');
            fetchCertificates();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to revoke certificate');
        } finally {
            setRevoking(false);
        }
    };

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Certificates</h1>
                    <p className="text-sm text-gray-500">
                        Membership, course participation, and assessment certificates.
                    </p>
                </div>
                <div className="flex flex-wrap items-center gap-2">
                    <select
                        value={typeFilter}
                        onChange={(event) => {
                            setTypeFilter(event.target.value);
                            setPage(1);
                        }}
                        className="rounded-lg border bg-white px-3 py-2 text-sm"
                    >
                        <option value="">All types</option>
                        <option value="course_participation">Course Participation</option>
                        <option value="course_assessment">Course Assessment</option>
                        <option value="membership">Membership</option>
                    </select>
                    <select
                        value={statusFilter}
                        onChange={(event) => {
                            setStatusFilter(event.target.value);
                            setPage(1);
                        }}
                        className="rounded-lg border bg-white px-3 py-2 text-sm"
                    >
                        <option value="">All statuses</option>
                        <option value="issued">Active</option>
                        <option value="revoked">Revoked</option>
                    </select>
                    <button
                        onClick={fetchCertificates}
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
                ) : certificates.length === 0 ? (
                    <div className="py-16 text-center">
                        <Award className="mx-auto mb-3 text-gray-300" size={44} />
                        <p className="text-gray-500">No certificates found.</p>
                    </div>
                ) : (
                    <div className="divide-y">
                        {certificates.map((certificate) => {
                            const isRevoked = certificate.status === 'revoked' || certificate.isRevoked;
                            const type = certificate.type || 'course_participation';
                            return (
                                <div key={certificate._id} className="flex flex-wrap items-center gap-4 p-4">
                                    <div className="flex-1">
                                        <div className="flex flex-wrap items-center gap-2">
                                            <span className="font-semibold text-gray-900">
                                                {certificate.user?.displayName || certificate.issuedTo || 'Learner'}
                                            </span>
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                typeStyles[type] || 'bg-gray-100 text-gray-600'
                                            }`}>
                                                {typeLabels[type] || type}
                                            </span>
                                            <span className={`rounded-full px-2 py-0.5 text-xs font-semibold ${
                                                isRevoked ? 'bg-red-100 text-red-700' : 'bg-green-100 text-green-700'
                                            }`}>
                                                {isRevoked ? 'Revoked' : 'Active'}
                                            </span>
                                        </div>
                                        <p className="mt-1 text-sm text-gray-600">
                                            {certificate.course?.title || certificate.planName || certificate.title || 'Certificate'}
                                        </p>
                                        <p className="text-xs text-gray-500">
                                            {certificate.certificateId} · Issued {formatDate(certificate.issuedAt)}
                                            {certificate.user?.email ? ` · ${certificate.user.email}` : ''}
                                        </p>
                                        {isRevoked && certificate.revocationReason && (
                                            <p className="mt-1 text-xs text-red-600">
                                                Reason: {certificate.revocationReason}
                                            </p>
                                        )}
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <a
                                            href={certificate.verificationUrl
                                                || `${API_BASE_URL}/api/certificates/verify/${certificate.certificateId}`}
                                            target="_blank"
                                            rel="noreferrer"
                                            className="inline-flex items-center gap-2 rounded-lg border px-3 py-2 text-sm font-medium text-gray-700 hover:bg-gray-50"
                                        >
                                            <ExternalLink size={16} /> Verify
                                        </a>
                                        {!isRevoked && (
                                            <button
                                                onClick={() => {
                                                    setRevokeTarget(certificate);
                                                    setRevokeReason('');
                                                }}
                                                className="inline-flex items-center gap-2 rounded-lg border border-red-200 px-3 py-2 text-sm font-medium text-red-600 hover:bg-red-50"
                                            >
                                                <Ban size={16} /> Revoke
                                            </button>
                                        )}
                                    </div>
                                </div>
                            );
                        })}
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

            {revokeTarget && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4">
                    <div className="w-full max-w-md rounded-xl bg-white p-5 shadow-xl">
                        <div className="mb-3 flex items-center justify-between">
                            <h3 className="text-lg font-semibold text-gray-900">Revoke certificate</h3>
                            <button
                                onClick={() => setRevokeTarget(null)}
                                className="rounded p-1 text-gray-500 hover:bg-gray-100"
                            >
                                <X size={20} />
                            </button>
                        </div>
                        <p className="text-sm text-gray-600">
                            {revokeTarget.certificateId} · {revokeTarget.user?.displayName || revokeTarget.issuedTo}
                        </p>
                        <label className="mt-4 block">
                            <span className="mb-1 block text-sm font-medium text-gray-700">Reason (required)</span>
                            <textarea
                                value={revokeReason}
                                onChange={(event) => setRevokeReason(event.target.value)}
                                rows={3}
                                className="w-full rounded-lg border px-3 py-2 text-sm"
                                placeholder="Explain why this certificate is being revoked"
                            />
                        </label>
                        <div className="mt-4 flex justify-end gap-2">
                            <button
                                onClick={() => setRevokeTarget(null)}
                                className="rounded-lg border px-4 py-2 text-sm font-medium"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={revokeCertificate}
                                disabled={revoking}
                                className="rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white hover:bg-red-700 disabled:opacity-60"
                            >
                                {revoking ? 'Revoking...' : 'Revoke'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
