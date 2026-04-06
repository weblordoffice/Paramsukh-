'use client';

import { useState } from 'react';
import Image from 'next/image';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Plus, Trash2, X, Image as ImageIcon } from 'lucide-react';

interface Photo {
    url: string;
    caption?: string;
    uploadedAt: string;
}

interface PhotosTabProps {
    eventId: string;
    photos: Photo[];
    onUpdate: () => void;
}

export default function PhotosTab({ eventId, photos, onUpdate }: PhotosTabProps) {
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [formData, setFormData] = useState({
        urls: [''],
        captions: ['']
    });
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [deleting, setDeleting] = useState<number | null>(null);

    const addUrlField = () => {
        setFormData({
            urls: [...formData.urls, ''],
            captions: [...formData.captions, '']
        });
    };

    const removeUrlField = (index: number) => {
        setFormData({
            urls: formData.urls.filter((_, i) => i !== index),
            captions: formData.captions.filter((_, i) => i !== index)
        });
    };

    const updateUrl = (index: number, value: string) => {
        const newUrls = [...formData.urls];
        newUrls[index] = value;
        setFormData({ ...formData, urls: newUrls });
    };

    const updateCaption = (index: number, value: string) => {
        const newCaptions = [...formData.captions];
        newCaptions[index] = value;
        setFormData({ ...formData, captions: newCaptions });
    };

    const handleLocalUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const files = Array.from(e.target.files || []);
        if (files.length === 0) return;

        const uploadData = new FormData();
        files.forEach((file) => uploadData.append('images', file));

        const toastId = toast.loading(`Uploading ${files.length} photo${files.length > 1 ? 's' : ''}...`);
        setUploading(true);

        try {
            const response = await apiClient.post(
                '/api/upload/images?folder=events/photos',
                uploadData,
                {
                    headers: {
                        'Content-Type': 'multipart/form-data',
                    },
                }
            );

            if (response.data.success) {
                const uploaded = response.data.data?.images || [];
                if (uploaded.length > 0) {
                    setFormData((prev) => ({
                        urls: [...prev.urls, ...uploaded.map((img: { url: string }) => img.url)],
                        captions: [...prev.captions, ...uploaded.map(() => '')],
                    }));
                }
                toast.success('Photos uploaded successfully!', { id: toastId });
            }
        } catch (error: any) {
            console.error('Upload error:', error);
            toast.error(error.response?.data?.message || 'Upload failed', { id: toastId });
        } finally {
            setUploading(false);
            e.target.value = '';
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setSubmitting(true);

        try {
            const images = formData.urls
                .filter(url => url.trim())
                .map((url, index) => ({
                    url: url.trim(),
                    caption: formData.captions[index] || ''
                }));

            if (images.length === 0) {
                toast.error('Please add at least one image URL');
                setSubmitting(false);
                return;
            }

            await apiClient.post(`/api/events/${eventId}/images`, { images });
            toast.success(`${images.length} photo(s) added successfully`);
            setIsModalOpen(false);
            setFormData({ urls: [''], captions: [''] });
            onUpdate();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to add photos');
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    const handleDelete = async (photoIndex: number) => {
        if (!confirm('Are you sure you want to delete this photo?')) return;

        setDeleting(photoIndex);
        try {
            // Note: Backend should support deleting by index or URL
            // Assuming we need to send updated images array
            const updatedImages = photos.filter((_, index) => index !== photoIndex);
            await apiClient.put(`/api/events/${eventId}`, { images: updatedImages });
            toast.success('Photo deleted successfully');
            onUpdate();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete photo');
            console.error(error);
        } finally {
            setDeleting(null);
        }
    };

    return (
        <div>
            {/* Header */}
            <div className="flex justify-between items-center mb-6">
                <div>
                    <h2 className="text-xl font-semibold text-gray-900">Event Photos</h2>
                    <p className="text-sm text-gray-600 mt-1">
                        Manage photo gallery for this event
                    </p>
                </div>
                <button
                    onClick={() => setIsModalOpen(true)}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    Add Photos
                </button>
            </div>

            {/* Photos Grid */}
            {photos.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <ImageIcon className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600 mb-4">No photos added yet</p>
                    <button
                        onClick={() => setIsModalOpen(true)}
                        className="text-blue-600 hover:underline"
                    >
                        Add your first photo
                    </button>
                </div>
            ) : (
                <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
                    {photos.map((photo, index) => (
                        <div
                            key={index}
                            className="relative group bg-white border border-gray-200 rounded-lg overflow-hidden hover:shadow-lg transition-shadow"
                        >
                            <div className="relative w-full h-48">
                                <Image
                                    src={photo.url}
                                    alt={photo.caption || `Photo ${index + 1}`}
                                    fill
                                    unoptimized
                                    className="object-cover"
                                />
                            </div>
                            {photo.caption && (
                                <div className="p-2 bg-white">
                                    <p className="text-xs text-gray-600 line-clamp-2">{photo.caption}</p>
                                </div>
                            )}
                            <button
                                onClick={() => handleDelete(index)}
                                disabled={deleting === index}
                                className="absolute top-2 right-2 p-2 bg-red-600 text-white rounded-full opacity-0 group-hover:opacity-100 transition-opacity hover:bg-red-700 disabled:opacity-50"
                            >
                                {deleting === index ? (
                                    <div className="w-4 h-4 border-2 border-white border-t-transparent rounded-full animate-spin" />
                                ) : (
                                    <Trash2 className="w-4 h-4" />
                                )}
                            </button>
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
                                Add Photos
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
                                <p className="text-sm text-gray-600">
                                    Upload from your computer or add photo URLs. Photos will be displayed in the event gallery.
                                </p>

                                <div className="flex items-center gap-3">
                                    <div className="relative">
                                        <input
                                            type="file"
                                            accept="image/*"
                                            multiple
                                            onChange={handleLocalUpload}
                                            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                            disabled={uploading}
                                        />
                                        <button
                                            type="button"
                                            disabled={uploading}
                                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg border border-gray-300 text-sm font-medium transition whitespace-nowrap"
                                        >
                                            {uploading ? 'Uploading...' : 'Upload Photos'}
                                        </button>
                                    </div>
                                    <span className="text-xs text-gray-500">or paste image URLs below</span>
                                </div>

                                {formData.urls.map((url, index) => (
                                    <div key={index} className="space-y-2 p-4 bg-gray-50 rounded-lg">
                                        <div className="flex justify-between items-center">
                                            <label className="text-sm font-medium text-gray-700">
                                                Photo {index + 1}
                                            </label>
                                            {formData.urls.length > 1 && (
                                                <button
                                                    type="button"
                                                    onClick={() => removeUrlField(index)}
                                                    className="text-red-600 hover:text-red-700 text-sm"
                                                >
                                                    Remove
                                                </button>
                                            )}
                                        </div>
                                        <input
                                            type="url"
                                            value={url}
                                            onChange={(e) => updateUrl(index, e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="https://example.com/image.jpg"
                                        />
                                        <input
                                            type="text"
                                            value={formData.captions[index]}
                                            onChange={(e) => updateCaption(index, e.target.value)}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                                            placeholder="Caption (optional)"
                                        />
                                    </div>
                                ))}

                                <button
                                    type="button"
                                    onClick={addUrlField}
                                    className="w-full py-2 border-2 border-dashed border-gray-300 rounded-lg text-gray-600 hover:border-blue-500 hover:text-blue-600 transition-colors"
                                >
                                    + Add Another Photo
                                </button>
                            </div>

                            <div className="flex justify-end gap-3 mt-6">
                                <button
                                    type="button"
                                    onClick={() => setIsModalOpen(false)}
                                    className="px-4 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    disabled={submitting}
                                    className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                                >
                                    {submitting ? 'Adding...' : 'Add Photos'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
