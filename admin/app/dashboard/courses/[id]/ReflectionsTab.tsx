'use client';

import { useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, PenLine, X, Eye } from 'lucide-react';

interface Reflection {
    _id: string;
    title: string;
    prompt: string;
    guidance?: string;
    minWords?: number;
    order?: number;
    isRequired?: boolean;
}

interface ReflectionSubmission {
    _id: string;
    reflectionId?: string;
    response: string;
    submittedAt: string;
    userId?: { displayName?: string; email?: string; phone?: string } | null;
}

interface ReflectionsTabProps {
    courseId: string;
    reflections: Reflection[];
    onUpdate: () => void;
}

export default function ReflectionsTab({ courseId, reflections, onUpdate }: ReflectionsTabProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<Reflection | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [submissionsOpen, setSubmissionsOpen] = useState(false);
    const [submissions, setSubmissions] = useState<ReflectionSubmission[]>([]);
    const [loadingSubmissions, setLoadingSubmissions] = useState(false);
    const [formData, setFormData] = useState({
        title: '',
        prompt: '',
        guidance: '',
        minWords: 20,
        order: 0,
        isRequired: true,
    });

    const openModal = (reflection?: Reflection) => {
        if (reflection) {
            setEditing(reflection);
            setFormData({
                title: reflection.title,
                prompt: reflection.prompt,
                guidance: reflection.guidance || '',
                minWords: reflection.minWords || 20,
                order: reflection.order || 0,
                isRequired: reflection.isRequired !== false,
            });
        } else {
            setEditing(null);
            setFormData({
                title: '',
                prompt: '',
                guidance: '',
                minWords: 20,
                order: reflections.length,
                isRequired: true,
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditing(null);
    };

    const saveReflection = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!formData.title.trim() || !formData.prompt.trim()) {
            toast.error('Title and prompt are required');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                title: formData.title.trim(),
                prompt: formData.prompt.trim(),
                guidance: formData.guidance.trim(),
                minWords: Number(formData.minWords) || 20,
                order: Number(formData.order) || 0,
                isRequired: formData.isRequired,
            };

            if (editing) {
                await apiClient.put(`/api/courses/${courseId}/reflections/${editing._id}`, payload);
                toast.success('Reflection updated');
            } else {
                await apiClient.post(`/api/courses/${courseId}/reflections`, payload);
                toast.success('Reflection added');
            }
            onUpdate();
            closeModal();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to save reflection');
        } finally {
            setSubmitting(false);
        }
    };

    const deleteReflection = async (reflection: Reflection) => {
        if (!confirm(`Delete "${reflection.title}"?`)) return;
        setDeleting(reflection._id);
        try {
            await apiClient.delete(`/api/courses/${courseId}/reflections/${reflection._id}`);
            toast.success('Reflection deleted');
            onUpdate();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete reflection');
        } finally {
            setDeleting(null);
        }
    };

    const openSubmissions = async () => {
        setSubmissionsOpen(true);
        setLoadingSubmissions(true);
        try {
            const response = await apiClient.get(`/api/courses/${courseId}/reflections/submissions/admin`);
            setSubmissions(response.data.submissions || []);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to load submissions');
            setSubmissions([]);
        } finally {
            setLoadingSubmissions(false);
        }
    };

    const sorted = [...reflections].sort((a, b) => (a.order || 0) - (b.order || 0));

    return (
        <div className="space-y-6">
            <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                    <h3 className="text-lg font-bold text-secondary">Reflection Exercises</h3>
                    <p className="text-sm text-accent mt-1">Written prompts that count toward course completion.</p>
                </div>
                <div className="flex items-center gap-2">
                    <button onClick={openSubmissions} className="flex items-center gap-2 px-4 py-2.5 border border-gray-300 rounded-lg font-medium text-secondary hover:bg-gray-50">
                        <Eye className="w-4 h-4" /> Submissions
                    </button>
                    <button onClick={() => openModal()} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90">
                        <Plus className="w-5 h-5" /> Add Reflection
                    </button>
                </div>
            </div>

            {sorted.length === 0 ? (
                <div className="border border-dashed border-gray-300 rounded-xl p-10 text-center text-accent">
                    <PenLine className="w-12 h-12 mx-auto mb-3 text-accent/40" />
                    No reflection exercises yet.
                </div>
            ) : (
                <div className="space-y-3">
                    {sorted.map((reflection) => (
                        <div key={reflection._id} className="flex items-start justify-between gap-4 border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                    <PenLine className="w-5 h-5 text-primary" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-semibold text-secondary">{reflection.title}</p>
                                    <p className="text-sm text-accent mt-1 line-clamp-2">{reflection.prompt}</p>
                                    <p className="text-xs text-accent mt-1">
                                        Min {reflection.minWords || 20} words · Order {reflection.order || 0} {reflection.isRequired !== false ? '· Required' : '· Optional'}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => openModal(reflection)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="Edit">
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button onClick={() => deleteReflection(reflection)} disabled={deleting === reflection._id} className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50" title="Delete">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeModal}>
                    <form onSubmit={saveReflection} className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-between border-b px-6 py-4">
                            <h2 className="text-xl font-bold text-secondary">{editing ? 'Edit Reflection' : 'Add Reflection'}</h2>
                            <button type="button" onClick={closeModal} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="p-6 space-y-4">
                            <div>
                                <label className="block text-sm font-semibold text-secondary mb-2">Title</label>
                                <input value={formData.title} onChange={(event) => setFormData((prev) => ({ ...prev, title: event.target.value }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-secondary mb-2">Prompt</label>
                                <textarea value={formData.prompt} onChange={(event) => setFormData((prev) => ({ ...prev, prompt: event.target.value }))} rows={3} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-secondary mb-2">Guidance (optional)</label>
                                <textarea value={formData.guidance} onChange={(event) => setFormData((prev) => ({ ...prev, guidance: event.target.value }))} rows={2} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Minimum words</label>
                                    <input type="number" min={1} value={formData.minWords} onChange={(event) => setFormData((prev) => ({ ...prev, minWords: Number(event.target.value) }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Order</label>
                                    <input type="number" min={0} value={formData.order} onChange={(event) => setFormData((prev) => ({ ...prev, order: Number(event.target.value) }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                                </div>
                            </div>

                            <label className="flex items-center gap-2 text-sm font-medium text-secondary">
                                <input type="checkbox" checked={formData.isRequired} onChange={(event) => setFormData((prev) => ({ ...prev, isRequired: event.target.checked }))} className="w-4 h-4 accent-[#F1842D]" />
                                Required for completion
                            </label>

                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={closeModal} disabled={submitting} className="px-4 py-2.5 border border-gray-300 rounded-lg text-secondary font-medium hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                                <button type="submit" disabled={submitting} className="px-5 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50">
                                    {submitting ? 'Saving...' : editing ? 'Save Changes' : 'Add Reflection'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}

            {submissionsOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={() => setSubmissionsOpen(false)}>
                    <div className="bg-white rounded-xl shadow-2xl w-full max-w-2xl max-h-[85vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-between border-b px-6 py-4">
                            <h2 className="text-xl font-bold text-secondary">Reflection Submissions</h2>
                            <button onClick={() => setSubmissionsOpen(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                                <X className="w-5 h-5" />
                            </button>
                        </div>
                        <div className="p-6">
                            {loadingSubmissions ? (
                                <div className="flex justify-center py-10">
                                    <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                                </div>
                            ) : submissions.length === 0 ? (
                                <p className="text-sm text-accent text-center py-8">No submissions yet.</p>
                            ) : (
                                <div className="space-y-3">
                                    {submissions.map((submission) => (
                                        <div key={submission._id} className="border border-gray-100 rounded-lg p-4">
                                            <div className="flex items-center justify-between gap-3">
                                                <p className="text-sm font-semibold text-secondary">{submission.userId?.displayName || 'User'}</p>
                                                <p className="text-xs text-accent">{new Date(submission.submittedAt).toLocaleString()}</p>
                                            </div>
                                            <p className="text-xs text-accent mt-1">{submission.userId?.email || submission.userId?.phone || ''}</p>
                                            <p className="text-xs font-medium text-indigo-600 mt-2">
                                                {reflections.find((reflection: any) => String(reflection._id) === String(submission.reflectionId))?.title || 'Reflection'}
                                            </p>
                                            <p className="text-sm text-secondary mt-1 whitespace-pre-wrap">{submission.response}</p>
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
