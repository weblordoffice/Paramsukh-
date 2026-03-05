'use client';

import { useState, useEffect } from 'react';
import { X, Upload, Loader2, Link as LinkIcon, Image as ImageIcon, Video as VideoIcon } from 'lucide-react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import Image from 'next/image';

interface Podcast {
    _id?: string;
    title: string;
    description: string;
    host: string;
    videoUrl: string;
    thumbnailUrl: string;
    duration: string;
    category: string;
}

interface PodcastModalProps {
    isOpen: boolean;
    onClose: () => void;
    podcast: Podcast | null;
    onSuccess: () => void;
}

const CATEGORIES = ['Meditation', 'Discourse', 'Scripture', 'Mindfulness', 'Mantra', 'Other'];

export default function PodcastModal({ isOpen, onClose, podcast, onSuccess }: PodcastModalProps) {
    const [loading, setLoading] = useState(false);
    const [uploadingVideo, setUploadingVideo] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);

    // Upload types: 'url' or 'file'
    const [videoUploadType, setVideoUploadType] = useState<'url' | 'file'>('url');
    const [imageUploadType, setImageUploadType] = useState<'url' | 'file'>('url');

    const [formData, setFormData] = useState<Podcast>({
        title: '',
        description: '',
        host: '',
        videoUrl: '',
        thumbnailUrl: '',
        duration: '00:00',
        category: 'Meditation'
    });

    useEffect(() => {
        if (podcast) {
            setFormData(podcast);
            setVideoUploadType('url');
            setImageUploadType('url');
        } else {
            setFormData({
                title: '',
                description: '',
                host: '',
                videoUrl: '',
                thumbnailUrl: '',
                duration: '00:00',
                category: 'Meditation'
            });
            setVideoUploadType('file'); // Default to file upload for new podcasts
            setImageUploadType('file');
        }
    }, [podcast, isOpen]);

    const formatDuration = (seconds: number): string => {
        const minutes = Math.floor(seconds / 60);
        const remainingSeconds = Math.floor(seconds % 60);
        return `${minutes.toString().padStart(2, '0')}:${remainingSeconds.toString().padStart(2, '0')}`;
    };

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>, type: 'video' | 'image') => {
        const file = e.target.files?.[0];
        if (!file) return;

        // Reset input value to allow re-uploading same file if needed
        e.target.value = '';

        const formDataObj = new FormData();

        if (type === 'video') {
            setUploadingVideo(true);
            formDataObj.append('video', file);

            try {
                const response = await apiClient.post('/api/upload/video', formDataObj, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                if (response.data?.success) {
                    const { url, duration } = response.data.data;
                    setFormData(prev => ({
                        ...prev,
                        videoUrl: url,
                        duration: duration ? formatDuration(duration) : prev.duration
                    }));
                    toast.success('Video uploaded successfully');
                }
            } catch (error) {
                console.error('Video upload error:', error);
                toast.error('Failed to upload video');
            } finally {
                setUploadingVideo(false);
            }
        } else {
            setUploadingImage(true);
            formDataObj.append('image', file);
            formDataObj.append('folder', 'podcasts/thumbnails');

            try {
                const response = await apiClient.post('/api/upload/image', formDataObj, {
                    headers: { 'Content-Type': 'multipart/form-data' }
                });

                if (response.data?.success) {
                    setFormData(prev => ({
                        ...prev,
                        thumbnailUrl: response.data.data.url
                    }));
                    toast.success('Thumbnail uploaded successfully');
                }
            } catch (error) {
                console.error('Image upload error:', error);
                toast.error('Failed to upload thumbnail');
            } finally {
                setUploadingImage(false);
            }
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (podcast?._id) {
                await apiClient.put(`/api/podcasts/admin/${podcast._id}`, formData);
                toast.success('Podcast updated successfully');
            } else {
                await apiClient.post('/api/podcasts/admin/create', formData);
                toast.success('Podcast created successfully');
            }
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error saving podcast:', error);
            toast.error(error.response?.data?.message || 'Failed to save podcast');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
                    <h2 className="text-xl font-bold text-black">
                        {podcast ? 'Edit Podcast' : 'Create New Podcast'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Title */}
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-black mb-2">
                                Title *
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-black"
                                placeholder="Enter podcast title"
                            />
                        </div>

                        {/* Host */}
                        <div>
                            <label className="block text-sm font-medium text-black mb-2">
                                Host *
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.host}
                                onChange={(e) => setFormData({ ...formData, host: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-black"
                                placeholder="Host name"
                            />
                        </div>

                        {/* Category */}
                        <div>
                            <label className="block text-sm font-medium text-black mb-2">
                                Category *
                            </label>
                            <select
                                value={formData.category}
                                onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-black"
                            >
                                {CATEGORIES.map((cat) => (
                                    <option key={cat} value={cat}>
                                        {cat}
                                    </option>
                                ))}
                            </select>
                        </div>

                        {/* Duration */}
                        <div>
                            <label className="block text-sm font-medium text-black mb-2">
                                Duration (MM:SS)
                            </label>
                            <input
                                type="text"
                                value={formData.duration}
                                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-black"
                                placeholder="e.g. 15:30"
                            />
                            <p className="text-xs text-gray-500 mt-1">Auto-calculated if video is uploaded</p>
                        </div>

                        {/* Video URL / Upload */}
                        <div className="col-span-2">
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-black">
                                    Video/Audio Source *
                                </label>
                                <div className="flex bg-gray-100 rounded-lg p-1">
                                    <button
                                        type="button"
                                        onClick={() => setVideoUploadType('url')}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${videoUploadType === 'url' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'
                                            }`}
                                    >
                                        <div className="flex items-center gap-1"><LinkIcon size={12} /> URL Link</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setVideoUploadType('file')}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${videoUploadType === 'file' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'
                                            }`}
                                    >
                                        <div className="flex items-center gap-1"><Upload size={12} /> Upload File</div>
                                    </button>
                                </div>
                            </div>

                            {videoUploadType === 'url' ? (
                                <input
                                    type="url"
                                    required={!formData.videoUrl}
                                    value={formData.videoUrl}
                                    onChange={(e) => setFormData({ ...formData, videoUrl: e.target.value })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-black"
                                    placeholder="https://example.com/video.mp4"
                                />
                            ) : (
                                <div className="border-2 border-dashed border-gray-300 rounded-lg p-6 hover:bg-gray-50 transition-colors text-center cursor-pointer relative">
                                    <input
                                        type="file"
                                        accept="video/*,audio/*"
                                        onChange={(e) => handleFileUpload(e, 'video')}
                                        className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                        disabled={uploadingVideo}
                                    />
                                    {uploadingVideo ? (
                                        <div className="flex flex-col items-center justify-center text-blue-600">
                                            <Loader2 className="w-8 h-8 animate-spin mb-2" />
                                            <span className="text-sm font-medium">Uploading video... Please wait</span>
                                        </div>
                                    ) : formData.videoUrl ? (
                                        <div className="flex flex-col items-center justify-center text-green-600">
                                            <VideoIcon className="w-8 h-8 mb-2" />
                                            <span className="text-sm font-medium">Video uploaded successfully</span>
                                            <span className="text-xs text-gray-500 mt-1 break-all">{formData.videoUrl}</span>
                                            <span className="text-xs text-blue-500 mt-2">Click to replace</span>
                                        </div>
                                    ) : (
                                        <div className="flex flex-col items-center justify-center text-gray-500">
                                            <Upload className="w-8 h-8 mb-2" />
                                            <span className="text-sm font-medium">Click or drag video file here</span>
                                            <span className="text-xs mt-1">MP4, WebM (Max 1GB)</span>
                                        </div>
                                    )}
                                </div>
                            )}
                        </div>

                        {/* Thumbnail URL / Upload */}
                        <div className="col-span-2">
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-black">
                                    Thumbnail Image *
                                </label>
                                <div className="flex bg-gray-100 rounded-lg p-1">
                                    <button
                                        type="button"
                                        onClick={() => setImageUploadType('url')}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${imageUploadType === 'url' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'
                                            }`}
                                    >
                                        <div className="flex items-center gap-1"><LinkIcon size={12} /> URL Link</div>
                                    </button>
                                    <button
                                        type="button"
                                        onClick={() => setImageUploadType('file')}
                                        className={`px-3 py-1 text-xs font-medium rounded-md transition-all ${imageUploadType === 'file' ? 'bg-white shadow-sm text-blue-600' : 'text-gray-500'
                                            }`}
                                    >
                                        <div className="flex items-center gap-1"><Upload size={12} /> Upload File</div>
                                    </button>
                                </div>
                            </div>

                            <div className="flex flex-col md:flex-row gap-4">
                                <div className="flex-1">
                                    {imageUploadType === 'url' ? (
                                        <input
                                            type="url"
                                            required={!formData.thumbnailUrl}
                                            value={formData.thumbnailUrl}
                                            onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-black"
                                            placeholder="https://example.com/image.jpg"
                                        />
                                    ) : (
                                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:bg-gray-50 transition-colors text-center cursor-pointer relative h-[52px] flex items-center justify-center">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handleFileUpload(e, 'image')}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                disabled={uploadingImage}
                                            />
                                            {uploadingImage ? (
                                                <div className="flex items-center gap-2 text-blue-600">
                                                    <Loader2 className="w-4 h-4 animate-spin" />
                                                    <span className="text-sm">Uploading...</span>
                                                </div>
                                            ) : (
                                                <div className="flex items-center gap-2 text-gray-500">
                                                    <Upload className="w-4 h-4" />
                                                    <span className="text-sm">Choose Image File</span>
                                                </div>
                                            )}
                                        </div>
                                    )}
                                </div>

                                {/* Preview */}
                                <div className="w-24 h-24 relative rounded-lg overflow-hidden border border-gray-200 shrink-0 bg-gray-50 flex items-center justify-center">
                                    {formData.thumbnailUrl ? (
                                        <Image
                                            src={formData.thumbnailUrl}
                                            alt="Preview"
                                            fill
                                            className="object-cover"
                                            onError={(e) => (e.currentTarget.style.display = 'none')}
                                        />
                                    ) : (
                                        <ImageIcon className="w-8 h-8 text-gray-300" />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Description */}
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-black mb-2">
                                Description *
                            </label>
                            <textarea
                                required
                                rows={4}
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none text-black"
                                placeholder="Enter podcast description..."
                            />
                        </div>
                    </div>

                    <div className="flex items-center justify-end gap-3 pt-6 border-t border-gray-100">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 text-sm font-medium text-gray-700 hover:bg-gray-100 rounded-lg transition-colors"
                            disabled={loading}
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={loading || uploadingVideo || uploadingImage}
                            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save Podcast'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
