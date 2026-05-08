'use client';

import { useState } from 'react';
import Image from 'next/image';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, Play, ExternalLink } from 'lucide-react';

interface Video {
    url: string;
    type?: 'youtube' | 'local';
    title?: string;
    description?: string;
    thumbnailUrl?: string;
    addedAt: string;
}

interface VideosTabProps {
    eventId: string;
    videos: Video[];
    onUpdate: () => void;
}

export default function VideosTab({ eventId, videos, onUpdate }: VideosTabProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        type: 'youtube' as 'youtube' | 'local',
        url: '',
        title: '',
        description: '',
        thumbnailUrl: ''
    });
    const [videoFile, setVideoFile] = useState<File | null>(null);
    const [submitting, setSubmitting] = useState(false);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [deleting, setDeleting] = useState<number | null>(null);

    const resetForm = () => {
        setFormData({
            type: 'youtube',
            url: '',
            title: '',
            description: '',
            thumbnailUrl: ''
        });
        setVideoFile(null);
        setUploadProgress(0);
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            let finalUrl = formData.url;

            if (formData.type === 'local') {
                if (!videoFile) {
                    toast.error('Please select a video file');
                    setSubmitting(false);
                    return;
                }
                const uploadData = new FormData();
                uploadData.append('video', videoFile);
                const uploadRes = await apiClient.post('/api/upload/video?folder=events', uploadData, {
                    onUploadProgress: (progressEvent) => {
                        const percentCompleted = Math.round((progressEvent.loaded * 100) / (progressEvent.total || 100));
                        setUploadProgress(percentCompleted);
                    }
                });
                if (!uploadRes.data.success) throw new Error(uploadRes.data.message);
                finalUrl = uploadRes.data.data.url;
            }

            await apiClient.post(`/api/events/${eventId}/videos`, {
                type: formData.type,
                url: finalUrl,
                title: formData.title,
                description: formData.description,
                thumbnailUrl: formData.thumbnailUrl
            });
            toast.success('Video added successfully');
            setIsModalOpen(false);
            resetForm();
            onUpdate();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to add video');
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (videoIndex: number) => {
        if (!confirm('Are you sure you want to delete this video?')) return;

        setDeleting(videoIndex);
        try {
            // Assuming backend supports updating with new array
            const updatedVideos = videos.filter((_, index) => index !== videoIndex);
            await apiClient.put(`/api/events/${eventId}`, { videos: updatedVideos });
            toast.success('Video deleted successfully');
            onUpdate();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete video');
            console.error(error);
        } finally {
            setDeleting(null);
        }
    };

    const getYouTubeThumbnail = (url: string) => {
        // Extract video ID from YouTube URL
        const youtubeRegex = /(?:youtube\.com\/(?:[^\/]+\/.+\/|(?:v|e(?:mbed)?)\/|.*[?&]v=)|youtu\.be\/)([^"&?\/\s]{11})/;
        const match = url.match(youtubeRegex);
        if (match && match[1]) {
            return `https://img.youtube.com/vi/${match[1]}/hqdefault.jpg`;
        }
        return null;
    };

    return (
        <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Event Videos</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Manage videos for this event (recordings, highlights, etc.)
                    </p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Add Video
                </button>
            </div>

            {/* Videos Grid */}
            {videos.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Play className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 mb-4">No videos added yet</p>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="text-blue-600 hover:underline"
                    >
                        Add your first video
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {videos.map((video, index) => {
                        const isYouTube = video.type === 'youtube' || !video.type;
                        const thumbnail = video.thumbnailUrl || (isYouTube ? getYouTubeThumbnail(video.url) : null);
                        return (
                            <div
                                key={index}
                                className="bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                            >
                                <div className="relative">
                                    {thumbnail ? (
                                        <div className="relative w-full h-48">
                                            <Image
                                                src={thumbnail}
                                                alt={video.title || 'Video'}
                                                fill
                                                unoptimized
                                                className="object-cover"
                                            />
                                        </div>
                                    ) : (
                                        <div className="w-full h-48 bg-gray-200 flex flex-col items-center justify-center">
                                            <Play className="w-16 h-16 text-gray-400 mb-2" />
                                            {!isYouTube && <span className="text-xs text-gray-500 font-medium bg-white px-2 py-1 rounded">Local Video</span>}
                                        </div>
                                    )}
                                    <div className="absolute inset-0 bg-black bg-opacity-0 hover:bg-opacity-30 transition-all flex items-center justify-center">
                                        <a
                                            href={video.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="opacity-0 hover:opacity-100 transition-opacity"
                                        >
                                            <div className="bg-white rounded-full p-4">
                                                <Play className="w-8 h-8 text-blue-600" />
                                            </div>
                                        </a>
                                    </div>
                                </div>

                                <div className="p-4">
                                    <h3 className="font-medium text-gray-900 mb-2 line-clamp-2">
                                        {video.title || 'Untitled Video'}
                                    </h3>
                                    {video.description && (
                                        <p className="text-sm text-gray-600 mb-3 line-clamp-2">
                                            {video.description}
                                        </p>
                                    )}
                                    <p className="text-xs text-gray-500 mb-3">
                                        Added {new Date(video.addedAt).toLocaleDateString()}
                                    </p>

                                    <div className="flex items-center gap-2">
                                        <a
                                            href={video.url}
                                            target="_blank"
                                            rel="noopener noreferrer"
                                            className="flex-1 flex items-center justify-center gap-2 px-3 py-2 text-sm text-blue-600 bg-blue-50 rounded hover:bg-blue-100 transition-colors"
                                        >
                                            <ExternalLink className="w-4 h-4" />
                                            Watch
                                        </a>
                                        <button
                                            onClick={() => handleDelete(index)}
                                            disabled={deleting === index}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50"
                                        >
                                            {deleting === index ? (
                                                <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
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
                                Add Video
                            </h3>
                            <button
                                onClick={() => setIsModalOpen(false)}
                                className="text-gray-400 hover:text-gray-600"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <form onSubmit={handleSubmit} className="p-6">
                            <div className="space-y-4">
                                <div className="flex gap-4 mb-2">
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={formData.type === 'youtube'}
                                            onChange={() => setFormData({ ...formData, type: 'youtube' })}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700">YouTube URL</span>
                                    </label>
                                    <label className="flex items-center gap-2 cursor-pointer">
                                        <input
                                            type="radio"
                                            checked={formData.type === 'local'}
                                            onChange={() => setFormData({ ...formData, type: 'local' })}
                                            className="text-blue-600 focus:ring-blue-500"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Local Upload</span>
                                    </label>
                                </div>

                                {formData.type === 'youtube' ? (
                                    <div key="youtube-input-group">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            YouTube Video URL *
                                        </label>
                                        <input
                                            type="url"
                                            required
                                            value={formData.url || ''}
                                            onChange={(e) => setFormData({ ...formData, url: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="https://www.youtube.com/watch?v=..."
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Enter the full YouTube video URL
                                        </p>
                                    </div>
                                ) : (
                                    <div key="local-input-group">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Video File *
                                        </label>
                                        <input
                                            type="file"
                                            accept="video/*"
                                            required
                                            onChange={(e) => setVideoFile(e.target.files?.[0] || null)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Select an MP4 or compatible video file.
                                        </p>
                                    </div>
                                )}

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Video Title
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.title || ''}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Event Recording - Day 1"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        value={formData.description || ''}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={3}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="Brief description of the video content..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Custom Thumbnail URL (optional)
                                    </label>
                                    <input
                                        type="url"
                                        value={formData.thumbnailUrl || ''}
                                        onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                        placeholder="https://..."
                                    />
                                    <p className="text-xs text-gray-500 mt-1">
                                        Leave empty to auto-fetch from YouTube
                                    </p>
                                </div>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => {
                                        setIsModalOpen(false);
                                        resetForm();
                                    }}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50 relative overflow-hidden flex items-center justify-center min-w-[120px]"
                                >
                                    {submitting && formData.type === 'local' ? (
                                        <span className="z-10 relative">
                                            {uploadProgress === 100 ? 'Processing...' : `Uploading ${uploadProgress}%`}
                                        </span>
                                    ) : submitting ? (
                                        <span>Adding...</span>
                                    ) : (
                                        <span>Add Video</span>
                                    )}
                                    {submitting && formData.type === 'local' && (
                                        <div 
                                            className="absolute left-0 top-0 bottom-0 bg-blue-800 bg-opacity-30 transition-all duration-300"
                                            style={{ width: `${uploadProgress}%` }}
                                        />
                                    )}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
