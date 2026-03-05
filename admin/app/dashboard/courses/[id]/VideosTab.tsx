'use client';

import { useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Plus, Edit, Trash2, GripVertical, Play, X } from 'lucide-react';

interface Video {
    _id: string;
    title: string;
    videoUrl?: string;
    url?: string;
    duration: number;
    thumbnailUrl?: string;
    order?: number;
    description?: string;
}

interface VideosTabProps {
    courseId: string;
    videos: Video[];
    onUpdate: () => void;
}

export default function VideosTab({ courseId, videos, onUpdate }: VideosTabProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [editingVideo, setEditingVideo] = useState<Video | null>(null);
    const [formData, setFormData] = useState({
        title: '',
        url: '',
        duration: 0,
        thumbnailUrl: '',
        description: '',
    });
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [deleting, setDeleting] = useState<string | null>(null);

    const sortedVideos = [...videos].sort((a, b) => (a.order || 0) - (b.order || 0));

    const formatMinutesToDuration = (minutesValue: number | string) => {
        const minutes = typeof minutesValue === 'string' ? parseFloat(minutesValue) : minutesValue;
        if (!Number.isFinite(minutes) || minutes <= 0) return '';

        const totalSeconds = Math.round(minutes * 60);
        const mins = Math.floor(totalSeconds / 60);
        const secs = totalSeconds % 60;
        return `${mins}:${secs.toString().padStart(2, '0')}`;
    };

    const getNextOrder = () => {
        if (!videos || videos.length === 0) return 1;
        const maxOrder = Math.max(...videos.map((video) => video.order ?? 0));
        return maxOrder + 1;
    };

    const openModal = (video?: Video) => {
        if (video) {
            setEditingVideo(video);
            setFormData({
                title: video.title ?? '',
                url: video.videoUrl ?? video.url ?? '',
                duration: video.duration ?? 0,
                thumbnailUrl: video.thumbnailUrl ?? '',
                description: video.description ?? '',
            });
        } else {
            setEditingVideo(null);
            setFormData({
                title: '',
                url: '',
                duration: 0,
                thumbnailUrl: '',
                description: '',
            });
        }
        setIsModalOpen(true);
    };

    const closeModal = () => {
        setIsModalOpen(false);
        setEditingVideo(null);
        setUploadProgress(0);
        setFormData({
            title: '',
            url: '',
            duration: 0,
            thumbnailUrl: '',
            description: '',
        });
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'image') => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Create form data
        const formData = new FormData();
        const fieldName = type === 'video' ? 'video' : 'image';
        formData.append(fieldName, file);


        setUploading(true);
        setUploadProgress(0);

        try {
            // Determine endpoint
            const endpoint = type === 'video' ? '/api/upload/video' : '/api/upload/image';

            // Track upload progress
            const response = await apiClient.post(endpoint, formData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
                onUploadProgress: (progressEvent) => {
                    if (progressEvent.total) {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / progressEvent.total);
                        setUploadProgress(percentCompleted);
                    }
                }
            });

            if (response.data.success) {
                if (type === 'video') {
                    const data = response.data?.data;
                    setFormData(prev => ({
                        ...prev,
                        url: data?.url ?? prev.url ?? '',
                        duration: data?.duration != null ? Math.round(Number(data.duration) / 60) : (prev.duration ?? 0)
                    }));
                } else {
                    setFormData(prev => ({
                        ...prev,
                        thumbnailUrl: response.data?.data?.url ?? prev.thumbnailUrl ?? ''
                    }));
                }
                toast.success(`${type} uploaded successfully!`);
            }
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error(error.response?.data?.message || 'Upload failed');
        } finally {
            setUploading(false);
            setUploadProgress(0);
            // Reset input value to allow re-uploading same file if needed
            e.target.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        const payload = {
            title: formData.title,
            description: formData.description,
            duration: formatMinutesToDuration(formData.duration),
            videoUrl: formData.url,
            thumbnailUrl: formData.thumbnailUrl,
            order: editingVideo?.order ?? getNextOrder(),
        };

        try {
            if (editingVideo) {
                await apiClient.put(`/api/courses/${courseId}/videos/${editingVideo._id}`, payload);
                toast.success('Video updated successfully');
            } else {
                await apiClient.post(`/api/courses/${courseId}/videos`, payload);
                toast.success('Video added successfully');
            }
            closeModal();
            onUpdate();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to save video');
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (videoId: string) => {
        if (!confirm('Are you sure you want to delete this video?')) return;

        setDeleting(videoId);
        try {
            await apiClient.delete(`/api/courses/${courseId}/videos/${videoId}`);
            toast.success('Video deleted successfully');
            onUpdate();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete video');
            console.error(error);
        } finally {
            setDeleting(null);
        }
    };

    const handleReorder = async (videoId: string, newOrder: number) => {
        try {
            await apiClient.put(`/api/courses/${courseId}/videos/${videoId}`, { order: newOrder });
            toast.success('Video order updated');
            onUpdate();
        } catch (error: any) {
            toast.error('Failed to reorder video');
            console.error(error);
        }
    };

    return (
        <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Course Videos</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Manage video content for this course
                    </p>
                </div>
                <button
                    onClick={() => openModal()}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Add Video
                </button>
            </div>

            {/* Videos List */}
            {sortedVideos.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Play className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 mb-4">No videos added yet</p>
                    <button
                        onClick={() => openModal()}
                        className="text-blue-600 hover:underline"
                    >
                        Add your first video
                    </button>
                </div>
            ) : (
                <div className="space-y-3">
                    {sortedVideos.map((video, index) => (
                        <div
                            key={video._id}
                            className="flex items-center gap-4 p-4 bg-white border border-gray-200 rounded-lg hover:shadow-md transition-shadow"
                        >
                            <button className="cursor-move text-gray-400 hover:text-gray-600">
                                <GripVertical className="w-5 h-5" />
                            </button>

                            {video.thumbnailUrl ? (
                                <img
                                    src={video.thumbnailUrl}
                                    alt={video.title}
                                    className="w-32 h-20 rounded object-cover"
                                />
                            ) : (
                                <div className="w-32 h-20 bg-gray-200 rounded flex items-center justify-center">
                                    <Play className="w-8 h-8 text-gray-400" />
                                </div>
                            )}

                            <div className="flex-1">
                                <div className="flex items-start justify-between">
                                    <div>
                                        <h3 className="font-medium text-gray-900">{video.title}</h3>
                                        {video.description && (
                                            <p className="text-sm text-gray-600 mt-1">{video.description}</p>
                                        )}
                                        <div className="flex items-center gap-4 mt-2 text-sm text-gray-500">
                                            <span>{video.duration} mins</span>
                                            <span>Order: {video.order || index + 1}</span>
                                        </div>
                                    </div>
                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => openModal(video)}
                                            className="p-2 text-gray-600 hover:text-blue-600 hover:bg-blue-50 rounded transition-colors"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(video._id)}
                                            disabled={deleting === video._id}
                                            className="p-2 text-gray-600 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            {/* Modal */}
            {isModalOpen && (
                <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
                    <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
                        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                            <h3 className="text-lg font-semibold text-gray-900">
                                {editingVideo ? 'Edit Video' : 'Add New Video'}
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
                                        Video Title *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title ?? ''}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-500"
                                        placeholder="Introduction to the Course"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Video
                                    </label>
                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <input
                                                type="url"
                                                required
                                                value={formData.url ?? ''}
                                                onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-500"
                                                placeholder="https://vimeo.com/..."
                                            />
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="file"
                                                accept="video/*"
                                                onChange={(e) => handleFileUpload(e, 'video')}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                disabled={uploading}
                                            />
                                            <button
                                                type="button"
                                                disabled={uploading}
                                                className={`px-4 py-2 rounded-lg border text-sm font-medium transition whitespace-nowrap flex items-center gap-2 ${uploading
                                                    ? 'bg-blue-50 text-blue-600 border-blue-200'
                                                    : 'bg-gray-100 hover:bg-gray-200 text-gray-700 border-gray-300'
                                                    }`}
                                            >
                                                {uploading ? (
                                                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Plus className="w-4 h-4" />
                                                )}
                                                {uploading && <span>{uploadProgress}%</span>}
                                                {!uploading && <span>Upload Video</span>}
                                            </button>
                                        </div>
                                    </div>
                                    {uploading && (
                                        <div className="w-full bg-gray-200 rounded-full h-1.5 mt-2 overflow-hidden">
                                            <div
                                                className="bg-blue-600 h-1.5 rounded-full transition-all duration-300"
                                                style={{ width: `${uploadProgress}%` }}
                                            />
                                        </div>
                                    )}
                                    <p className="text-xs text-gray-500 mt-1">Upload mp4, mov, avi (max 1GB)</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Duration (minutes) *
                                    </label>
                                    <input
                                        type="number"
                                        required
                                        min="0"
                                        step="0.1"
                                        value={formData.duration ?? ''}
                                        onChange={(e) => setFormData({ ...formData, duration: parseFloat(e.target.value) || 0 })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-500"
                                        placeholder="30"
                                    />
                                    <p className="text-xs text-gray-500 mt-1">Auto-calculated on video upload</p>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Thumbnail
                                    </label>

                                    {formData.thumbnailUrl && (
                                        <div className="mb-2 relative w-full h-32 bg-gray-100 rounded overflow-hidden">
                                            <img
                                                src={formData.thumbnailUrl}
                                                alt="Thumbnail preview"
                                                className="w-full h-full object-cover"
                                            />
                                            <button
                                                type="button"
                                                onClick={() => setFormData({ ...formData, thumbnailUrl: '' })}
                                                className="absolute top-2 right-2 p-1 bg-white/80 rounded-full hover:bg-white text-red-500"
                                            >
                                                <X size={16} />
                                            </button>
                                        </div>
                                    )}

                                    <div className="flex gap-2">
                                        <div className="flex-1">
                                            <input
                                                type="url"
                                                value={formData.thumbnailUrl ?? ''}
                                                onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-500"
                                                placeholder="https://example.com/image.jpg"
                                            />
                                        </div>
                                        <div className="relative">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handleFileUpload(e, 'image')}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                disabled={uploading}
                                            />
                                            <button
                                                type="button"
                                                disabled={uploading}
                                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg border border-gray-300 text-sm font-medium transition whitespace-nowrap flex items-center gap-2"
                                            >
                                                {uploading ? (
                                                    <div className="w-4 h-4 border-2 border-gray-600 border-t-transparent rounded-full animate-spin" />
                                                ) : (
                                                    <Plus className="w-4 h-4" />
                                                )}
                                                Upload Image
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        value={formData.description ?? ''}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={3}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-500"
                                        placeholder="Brief description of the video content..."
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
                                    {submitting ? 'Saving...' : editingVideo ? 'Update Video' : 'Add Video'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
