'use client';

import { useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, Calendar, Clock, ExternalLink, X, Video } from 'lucide-react';

interface LiveSession {
    _id: string;
    title: string;
    scheduledAt: string;
    meetingLink: string;
    durationInMinutes?: number;
    meetingPlatform?: 'zoom' | 'google-meet' | 'teams' | 'other';
    description?: string;
    status?: 'scheduled' | 'completed' | 'cancelled';
}

interface LiveSessionsTabProps {
    courseId: string;
    sessions: LiveSession[];
    onUpdate: () => void;
}

export default function LiveSessionsTab({ courseId, sessions, onUpdate }: LiveSessionsTabProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingSession, setEditingSession] = useState<LiveSession | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        scheduledAt: '',
        meetingLink: '',
        durationInMinutes: 60,
        meetingPlatform: 'other' as NonNullable<LiveSession['meetingPlatform']>,
        description: '',
        status: 'scheduled' as LiveSession['status'],
    });
    const [submitting, setSubmitting] = useState(false);
    const [deleting, setDeleting] = useState<string | null>(null);

    const sortedSessions = [...sessions].sort(
        (a, b) => new Date(a.scheduledAt).getTime() - new Date(b.scheduledAt).getTime()
    );

    const openModal = (session?: LiveSession) => {
        if (session) {
            setEditingSession(session);
            const date = new Date(session.scheduledAt);
            const localDateTime = new Date(date.getTime() - date.getTimezoneOffset() * 60000)
                .toISOString()
                .slice(0, 16);
            setFormData({
                title: session.title,
                scheduledAt: localDateTime,
                meetingLink: session.meetingLink,
                durationInMinutes: session.durationInMinutes || 60,
                meetingPlatform: session.meetingPlatform || 'other',
                description: session.description || '',
                status: session.status || 'scheduled',
            });
        } else {
            setEditingSession(null);
            setFormData({
                title: '',
                scheduledAt: '',
                meetingLink: '',
                durationInMinutes: 60,
                meetingPlatform: 'other',
                description: '',
                status: 'scheduled',
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingSession(null);
        setFormData({
            title: '',
            scheduledAt: '',
            meetingLink: '',
            durationInMinutes: 60,
            meetingPlatform: 'other',
            description: '',
            status: 'scheduled',
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const dataToSubmit = {
                ...formData,
                scheduledAt: new Date(formData.scheduledAt).toISOString(),
            };

            if (editingSession) {
                await apiClient.put(`/api/courses/${courseId}/livesessions/${editingSession._id}`, dataToSubmit);
                toast.success('Live session updated successfully');
            } else {
                await apiClient.post(`/api/courses/${courseId}/livesessions`, dataToSubmit);
                toast.success('Live session scheduled successfully');
            }
            closeModal();
            onUpdate();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to save live session');
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (sessionId: string) => {
        if (!confirm('Are you sure you want to delete this live session?')) return;

        setDeleting(sessionId);
        try {
            await apiClient.delete(`/api/courses/${courseId}/livesessions/${sessionId}`);
            toast.success('Live session deleted successfully');
            onUpdate();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete live session');
            console.error(error);
        } finally {
            setDeleting(null);
        }
    };

    const formatDate = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric',
        });
    };

    const formatTime = (dateString: string) => {
        const date = new Date(dateString);
        return date.toLocaleTimeString('en-US', {
            hour: '2-digit',
            minute: '2-digit',
        });
    };

    const getStatusColor = (status?: string) => {
        switch (status) {
            case 'completed':
                return 'bg-gray-100 text-gray-700';
            case 'cancelled':
                return 'bg-red-100 text-red-700';
            default:
                return 'bg-blue-100 text-blue-700';
        }
    };

    const isUpcoming = (dateString: string) => {
        return new Date(dateString) > new Date();
    };

    return (
        <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Live Sessions</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Schedule and manage live sessions for this course
                    </p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Schedule Session
                </button>
            </div>

            {/* Sessions List */}
            {sortedSessions.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Calendar className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 mb-4">No live sessions scheduled yet</p>
                    <button
                        onClick={() => openModal()}
                        className="text-blue-600 hover:underline"
                    >
                        Schedule your first session
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {sortedSessions.map((session) => {
                        const upcoming = isUpcoming(session.scheduledAt);
                        return (
                            <div
                                key={session._id}
                                className={`p-5 bg-white border rounded-lg hover:shadow-md transition-shadow ${
                                    upcoming ? 'border-blue-200' : 'border-gray-200'
                                }`}
                            >
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-3 mb-2">
                                            <h3 className="text-lg font-medium text-gray-900">
                                                {session.title}
                                            </h3>
                                            <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(session.status)}`}>
                                                {session.status || 'scheduled'}
                                            </span>
                                        </div>

                                        {session.description && (
                                            <p className="text-gray-600 mb-3">{session.description}</p>
                                        )}

                                        <div className="flex flex-wrap items-center gap-4 text-sm text-gray-600">
                                            <div className="flex items-center gap-2">
                                                <Calendar className="w-4 h-4" />
                                                <span>{formatDate(session.scheduledAt)}</span>
                                            </div>
                                            <div className="flex items-center gap-2">
                                                <Clock className="w-4 h-4" />
                                                <span>{formatTime(session.scheduledAt)}</span>
                                            </div>
                                            {session.durationInMinutes && (
                                                <div className="flex items-center gap-2">
                                                    <Video className="w-4 h-4" />
                                                    <span>{session.durationInMinutes} mins</span>
                                                </div>
                                            )}
                                        </div>

                                        <div className="flex items-center gap-2 mt-3">
                                            <a
                                                href={session.meetingLink}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="inline-flex items-center gap-2 px-4 py-2 text-sm text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                                            >
                                                <ExternalLink className="w-4 h-4" />
                                                Join Meeting
                                            </a>
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 ml-4">
                                        <button
                                            onClick={() => openModal(session)}
                                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(session._id)}
                                            disabled={deleting === session._id}
                                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        );
                    })}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-900">
                                {editingSession ? 'Edit Live Session' : 'Schedule Live Session'}
                            </h3>
                            <button
                                onClick={closeModal}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6">
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Session Title *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Live Q&A Session"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Scheduled Date & Time *
                                    </label>
                                    <input
                                        type="datetime-local"
                                        required
                                        value={formData.scheduledAt}
                                        onChange={(e) => setFormData({ ...formData, scheduledAt: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Meeting Link *
                                    </label>
                                    <input
                                        type="url"
                                        required
                                        value={formData.meetingLink}
                                        onChange={(e) => setFormData({ ...formData, meetingLink: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="https://zoom.us/j/... or https://meet.google.com/..."
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Zoom, Google Meet, or any video conferencing link
                                    </p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Duration (minutes)
                                    </label>
                                    <input
                                        type="number"
                                        min="15"
                                        step="15"
                                        value={formData.durationInMinutes}
                                        onChange={(e) => setFormData({ ...formData, durationInMinutes: parseInt(e.target.value) || 60 })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="60"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Meeting Platform
                                    </label>
                                    <select
                                        value={formData.meetingPlatform}
                                        onChange={(e) => setFormData({ ...formData, meetingPlatform: e.target.value as NonNullable<LiveSession['meetingPlatform']> })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="other">Other</option>
                                        <option value="zoom">Zoom</option>
                                        <option value="google-meet">Google Meet</option>
                                        <option value="teams">Microsoft Teams</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Status
                                    </label>
                                    <select
                                        value={formData.status}
                                        onChange={(e) => setFormData({ ...formData, status: e.target.value as LiveSession['status'] })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                    >
                                        <option value="scheduled">Scheduled</option>
                                        <option value="completed">Completed</option>
                                        <option value="cancelled">Cancelled</option>
                                    </select>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={3}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="What will be covered in this session..."
                                    />
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                    {submitting ? 'Saving...' : editingSession ? 'Update Session' : 'Schedule Session'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
