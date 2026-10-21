'use client';

import { useRef, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Headphones, X, Upload } from 'lucide-react';

interface AudioLesson {
    _id: string;
    title: string;
    description?: string;
    audioUrl: string;
    duration?: string;
    durationInSeconds?: number;
    thumbnailUrl?: string | null;
    order?: number;
    isFree?: boolean;
}

interface AudioLessonsTabProps {
    courseId: string;
    audioLessons: AudioLesson[];
    onUpdate: () => void;
}

export default function AudioLessonsTab({ courseId, audioLessons, onUpdate }: AudioLessonsTabProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editing, setEditing] = useState<AudioLesson | null>(null);
    const [uploading, setUploading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        audioUrl: '',
        duration: '',
        order: 0,
        isFree: false,
    });
    const fileInputRef = useRef<HTMLInputElement>(null);

    const openModal = (lesson?: AudioLesson) => {
        if (lesson) {
            setEditing(lesson);
            setFormData({
                title: lesson.title,
                description: lesson.description || '',
                audioUrl: lesson.audioUrl,
                duration: lesson.duration || '',
                order: lesson.order || 0,
                isFree: lesson.isFree === true,
            });
        } else {
            setEditing(null);
            setFormData({
                title: '',
                description: '',
                audioUrl: '',
                duration: '',
                order: audioLessons.length,
                isFree: false,
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditing(null);
        setUploading(false);
        if (fileInputRef.current) fileInputRef.current.value = '';
    };

    const handleAudioUpload = async (event: React.ChangeEvent<HTMLInputElement>) => {
        const file = event.target.files?.[0];
        if (!file) return;
        if (!file.type.startsWith('audio/')) {
            toast.error('Please select an audio file');
            return;
        }

        setUploading(true);
        try {
            const form = new FormData();
            form.append('audio', file);
            const response = await apiClient.post('/api/upload/audio?folder=course-audio', form, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            const url = response.data?.data?.url;
            if (!url) throw new Error('Upload did not return a URL');
            setFormData((prev) => ({ ...prev, audioUrl: url }));
            toast.success('Audio uploaded');
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to upload audio');
        } finally {
            setUploading(false);
            event.target.value = '';
        }
    };

    const saveLesson = async (event: React.FormEvent) => {
        event.preventDefault();
        if (!formData.title.trim() || !formData.audioUrl.trim()) {
            toast.error('Title and audio file are required');
            return;
        }

        setSubmitting(true);
        try {
            const payload = {
                title: formData.title.trim(),
                description: formData.description.trim(),
                audioUrl: formData.audioUrl.trim(),
                duration: formData.duration.trim(),
                order: Number(formData.order) || 0,
                isFree: formData.isFree,
            };

            if (editing) {
                await apiClient.put(`/api/courses/${courseId}/audio-lessons/${editing._id}`, payload);
                toast.success('Audio lesson updated');
            } else {
                await apiClient.post(`/api/courses/${courseId}/audio-lessons`, payload);
                toast.success('Audio lesson added');
            }
            onUpdate();
            closeModal();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to save audio lesson');
        } finally {
            setSubmitting(false);
        }
    };

    const deleteLesson = async (lesson: AudioLesson) => {
        if (!confirm(`Delete "${lesson.title}"?`)) return;
        setDeleting(lesson._id);
        try {
            await apiClient.delete(`/api/courses/${courseId}/audio-lessons/${lesson._id}`);
            toast.success('Audio lesson deleted');
            onUpdate();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete audio lesson');
        } finally {
            setDeleting(null);
        }
    };

    const sorted = [...audioLessons].sort((a, b) => (a.order || 0) - (b.order || 0));

    return (
        <div className="space-y-6">
            <div className="flex items-center justify-between">
                <div>
                    <h3 className="text-lg font-bold text-secondary">Audio Meditations</h3>
                    <p className="text-sm text-accent mt-1">Guided audio lessons included in course progress.</p>
                </div>
                <button onClick={() => openModal()} className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg font-medium hover:bg-primary/90">
                    <Plus className="w-5 h-5" /> Add Audio Lesson
                </button>
            </div>

            {sorted.length === 0 ? (
                <div className="border border-dashed border-gray-300 rounded-xl p-10 text-center text-accent">
                    <Headphones className="w-12 h-12 mx-auto mb-3 text-accent/40" />
                    No audio lessons yet.
                </div>
            ) : (
                <div className="space-y-3">
                    {sorted.map((lesson) => (
                        <div key={lesson._id} className="flex items-start justify-between gap-4 border border-gray-200 rounded-lg p-4">
                            <div className="flex items-start gap-3 min-w-0">
                                <div className="w-10 h-10 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                                    <Headphones className="w-5 h-5 text-primary" />
                                </div>
                                <div className="min-w-0">
                                    <p className="font-semibold text-secondary">{lesson.title}</p>
                                    {lesson.description && <p className="text-sm text-accent mt-1">{lesson.description}</p>}
                                    <p className="text-xs text-accent mt-1">
                                        Order {lesson.order || 0} {lesson.duration ? `· ${lesson.duration}` : ''} {lesson.isFree ? '· Free preview' : ''}
                                    </p>
                                </div>
                            </div>
                            <div className="flex items-center gap-1 shrink-0">
                                <button onClick={() => openModal(lesson)} className="p-2 text-gray-600 hover:bg-gray-100 rounded-lg" title="Edit">
                                    <Edit className="w-4 h-4" />
                                </button>
                                <button onClick={() => deleteLesson(lesson)} disabled={deleting === lesson._id} className="p-2 text-red-600 hover:bg-red-50 rounded-lg disabled:opacity-50" title="Delete">
                                    <Trash2 className="w-4 h-4" />
                                </button>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {isModalOpen && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={closeModal}>
                    <form onSubmit={saveLesson} className="bg-white rounded-xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto" onClick={(event) => event.stopPropagation()}>
                        <div className="flex items-center justify-between border-b px-6 py-4">
                            <h2 className="text-xl font-bold text-secondary">{editing ? 'Edit Audio Lesson' : 'Add Audio Lesson'}</h2>
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
                                <label className="block text-sm font-semibold text-secondary mb-2">Description</label>
                                <textarea value={formData.description} onChange={(event) => setFormData((prev) => ({ ...prev, description: event.target.value }))} rows={2} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                            </div>

                            <div>
                                <label className="block text-sm font-semibold text-secondary mb-2">Audio file</label>
                                <div className="flex flex-wrap items-center gap-3">
                                    <label className={`inline-flex items-center gap-2 px-4 py-2 rounded-lg border border-gray-300 text-sm font-medium cursor-pointer hover:bg-gray-50 ${uploading ? 'opacity-60 pointer-events-none' : ''}`}>
                                        <Upload className="w-4 h-4" />
                                        {uploading ? 'Uploading...' : 'Upload audio'}
                                        <input ref={fileInputRef} type="file" accept="audio/*" className="hidden" onChange={handleAudioUpload} />
                                    </label>
                                    <input value={formData.audioUrl} onChange={(event) => setFormData((prev) => ({ ...prev, audioUrl: event.target.value }))} placeholder="Or paste audio URL" className="flex-1 min-w-[200px] px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                                </div>
                            </div>

                            <div className="grid grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Duration</label>
                                    <input value={formData.duration} onChange={(event) => setFormData((prev) => ({ ...prev, duration: event.target.value }))} placeholder="10:30" className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                                </div>
                                <div>
                                    <label className="block text-sm font-semibold text-secondary mb-2">Order</label>
                                    <input type="number" min={0} value={formData.order} onChange={(event) => setFormData((prev) => ({ ...prev, order: Number(event.target.value) }))} className="w-full px-3 py-2.5 border border-gray-300 rounded-lg text-sm" />
                                </div>
                            </div>

                            <label className="flex items-center gap-2 text-sm font-medium text-secondary">
                                <input type="checkbox" checked={formData.isFree} onChange={(event) => setFormData((prev) => ({ ...prev, isFree: event.target.checked }))} className="w-4 h-4 accent-[#F1842D]" />
                                Free preview
                            </label>

                            <div className="flex justify-end gap-3 pt-2">
                                <button type="button" onClick={closeModal} disabled={submitting} className="px-4 py-2.5 border border-gray-300 rounded-lg text-secondary font-medium hover:bg-gray-50 disabled:opacity-50">Cancel</button>
                                <button type="submit" disabled={submitting || uploading} className="px-5 py-2.5 bg-primary text-white rounded-lg font-semibold hover:bg-primary/90 disabled:opacity-50">
                                    {submitting ? 'Saving...' : editing ? 'Save Changes' : 'Add Lesson'}
                                </button>
                            </div>
                        </div>
                    </form>
                </div>
            )}
        </div>
    );
}
