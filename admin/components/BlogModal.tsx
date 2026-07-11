'use client';

import { useState, useEffect } from 'react';
import { X, Upload, Loader2, Link as LinkIcon, Image as ImageIcon } from 'lucide-react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import Image from 'next/image';

interface Blog {
    _id?: string;
    title: string;
    content: string;
    imageUrl?: string;
    author: string;
}

interface BlogModalProps {
    isOpen: boolean;
    onClose: () => void;
    blog: Blog | null;
    onSuccess: () => void;
}

export default function BlogModal({ isOpen, onClose, blog, onSuccess }: BlogModalProps) {
    const [loading, setLoading] = useState(false);
    const [uploadingImage, setUploadingImage] = useState(false);
    const [imageUploadType, setImageUploadType] = useState<'url' | 'file'>('url');

    const [formData, setFormData] = useState<Blog>({
        title: '',
        content: '',
        imageUrl: '',
        author: 'Admin',
    });

    useEffect(() => {
        if (blog) {
            setFormData({
                title: blog.title || '',
                content: blog.content || '',
                imageUrl: blog.imageUrl || '',
                author: blog.author || 'Admin',
            });
            setImageUploadType('url');
        } else {
            setFormData({
                title: '',
                content: '',
                imageUrl: '',
                author: 'Admin',
            });
            setImageUploadType('file');
        }
    }, [blog, isOpen]);

    const handleFileUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        e.target.value = ''; // Reset input to allow uploading same file

        const formDataObj = new FormData();
        setUploadingImage(true);
        formDataObj.append('image', file);
        formDataObj.append('folder', 'blogs');

        try {
            const response = await apiClient.post('/api/upload/image', formDataObj, {
                headers: { 'Content-Type': 'multipart/form-data' }
            });

            if (response.data?.success) {
                setFormData(prev => ({
                    ...prev,
                    imageUrl: response.data.data.url
                }));
                toast.success('Image uploaded successfully');
            }
        } catch (error) {
            console.error('Image upload error:', error);
            toast.error('Failed to upload image');
        } finally {
            setUploadingImage(false);
        }
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            const payload = { ...formData };

            if (!payload.title.trim()) {
                toast.error('Title is required');
                setLoading(false);
                return;
            }

            if (!payload.content.trim()) {
                toast.error('Content is required');
                setLoading(false);
                return;
            }

            if (blog?._id) {
                await apiClient.put(`/api/blogs/admin/${blog._id}`, payload);
                toast.success('Blog updated successfully');
            } else {
                await apiClient.post('/api/blogs/admin/create', payload);
                toast.success('Blog created successfully');
            }
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error saving blog:', error);
            toast.error(error.response?.data?.message || 'Failed to save blog');
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
                        {blog ? 'Edit Blog Post' : 'Create New Blog Post'}
                    </h2>
                    <button
                        onClick={onClose}
                        className="p-2 hover:bg-gray-100 rounded-full transition-colors"
                    >
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="space-y-6">
                        {/* Title */}
                        <div>
                            <label className="block text-sm font-medium text-black mb-2">
                                Title *
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-black"
                                placeholder="Enter blog title"
                            />
                        </div>

                        {/* Author */}
                        <div>
                            <label className="block text-sm font-medium text-black mb-2">
                                Author *
                            </label>
                            <input
                                type="text"
                                required
                                value={formData.author}
                                onChange={(e) => setFormData({ ...formData, author: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-black"
                                placeholder="Author name"
                            />
                        </div>

                        {/* Image URL / Upload */}
                        <div>
                            <div className="flex items-center justify-between mb-2">
                                <label className="block text-sm font-medium text-black">
                                    Featured Image
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
                                            value={formData.imageUrl || ''}
                                            onChange={(e) => setFormData({ ...formData, imageUrl: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-black"
                                            placeholder="https://example.com/image.jpg"
                                        />
                                    ) : (
                                        <div className="border-2 border-dashed border-gray-300 rounded-lg p-4 hover:bg-gray-50 transition-colors text-center cursor-pointer relative h-[52px] flex items-center justify-center">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={handleFileUpload}
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
                                    {formData.imageUrl ? (
                                        <Image
                                            src={formData.imageUrl}
                                            alt="Preview"
                                            fill
                                            className="object-cover"
                                            unoptimized // skip warning/next-image domains in dev/prod config
                                        />
                                    ) : (
                                        <ImageIcon className="w-8 h-8 text-gray-300" />
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* Content */}
                        <div>
                            <label className="block text-sm font-medium text-black mb-2">
                                Blog Content *
                            </label>
                            <textarea
                                required
                                rows={8}
                                value={formData.content}
                                onChange={(e) => setFormData({ ...formData, content: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition resize-none text-black"
                                placeholder="Write blog content here..."
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
                            disabled={loading || uploadingImage}
                            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" />
                                    Saving...
                                </>
                            ) : (
                                'Save Blog'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
