'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { X, Upload, Plus, Tag } from 'lucide-react';

interface Group {
    _id: string;
    name: string;
    groupType: string;
    memberCount: number;
}

interface CreatePostModalProps {
    isOpen: boolean;
    onClose: () => void;
    onSuccess: () => void;
}

export default function CreatePostModal({ isOpen, onClose, onSuccess }: CreatePostModalProps) {
    const [groups, setGroups] = useState<Group[]>([]);
    const [loading, setLoading] = useState(false);
    const [submitting, setSubmitting] = useState(false);
    const [content, setContent] = useState('');
    const [groupId, setGroupId] = useState('');
    const [images, setImages] = useState<string[]>([]);
    const [tags, setTags] = useState<string[]>([]);
    const [tagInput, setTagInput] = useState('');
    const [uploading, setUploading] = useState(false);

    useEffect(() => {
        if (isOpen) {
            fetchGroups();
            resetForm();
        }
    }, [isOpen]);

    const resetForm = () => {
        setContent('');
        setGroupId('');
        setImages([]);
        setTags([]);
        setTagInput('');
    };

    const fetchGroups = async () => {
        setLoading(true);
        try {
            const response = await apiClient.get('/api/community/admin/groups');
            setGroups(response.data.data || []);
        } catch {
            toast.error('Failed to load groups');
        } finally {
            setLoading(false);
        }
    };

    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const formData = new FormData();
        formData.append('image', file);

        setUploading(true);
        try {
            const response = await apiClient.post('/api/upload/image?folder=community', formData, {
                headers: { 'Content-Type': 'multipart/form-data' },
            });
            if (response.data.success) {
                setImages(prev => [...prev, response.data.data.url]);
                toast.success('Image uploaded');
            }
        } catch {
            toast.error('Failed to upload image');
        } finally {
            setUploading(false);
        }
    };

    const removeImage = (index: number) => {
        setImages(prev => prev.filter((_, i) => i !== index));
    };

    const addTag = () => {
        const tag = tagInput.trim().toLowerCase();
        if (tag && !tags.includes(tag)) {
            setTags(prev => [...prev, tag]);
            setTagInput('');
        }
    };

    const removeTag = (tag: string) => {
        setTags(prev => prev.filter(t => t !== tag));
    };

    const handleSubmit = async () => {
        if (!content.trim()) {
            toast.error('Content is required');
            return;
        }
        if (!groupId) {
            toast.error('Please select a group');
            return;
        }

        setSubmitting(true);
        try {
            await apiClient.post('/api/community/admin/posts', {
                content: content.trim(),
                groupId,
                images,
                tags,
            });
            toast.success('Post created successfully');
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to create post');
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="relative w-full max-w-2xl mx-4 bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl">
                    <h2 className="text-xl font-bold text-secondary">Create Community Post</h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-6">
                    {/* Group Selection */}
                    <div>
                        <label className="block text-sm font-medium text-secondary mb-2">
                            Select Group <span className="text-red-500">*</span>
                        </label>
                        {loading ? (
                            <div className="h-10 bg-gray-100 rounded-lg animate-pulse" />
                        ) : (
                            <select
                                value={groupId}
                                onChange={(e) => setGroupId(e.target.value)}
                                className="w-full px-4 py-2.5 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            >
                                <option value="">Choose a group...</option>
                                {groups.map((group) => (
                                    <option key={group._id} value={group._id}>
                                        {group.name} ({group.groupType} · {group.memberCount} members)
                                    </option>
                                ))}
                            </select>
                        )}
                    </div>

                    {/* Content */}
                    <div>
                        <label className="block text-sm font-medium text-secondary mb-2">
                            Content <span className="text-red-500">*</span>
                        </label>
                        <textarea
                            value={content}
                            onChange={(e) => setContent(e.target.value)}
                            rows={5}
                            maxLength={5000}
                            placeholder="Write your post content here..."
                            className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none resize-none"
                        />
                        <p className="text-xs text-accent mt-1 text-right">{content.length}/5000</p>
                    </div>

                    {/* Tags */}
                    <div>
                        <label className="block text-sm font-medium text-secondary mb-2">Tags</label>
                        <div className="flex gap-2">
                            <input
                                type="text"
                                value={tagInput}
                                onChange={(e) => setTagInput(e.target.value)}
                                onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addTag(); } }}
                                placeholder="Add a tag..."
                                className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                            />
                            <button
                                type="button"
                                onClick={addTag}
                                className="px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 flex items-center gap-1"
                            >
                                <Plus className="w-4 h-4" />
                                Add
                            </button>
                        </div>
                        {tags.length > 0 && (
                            <div className="flex flex-wrap gap-2 mt-3">
                                {tags.map((tag) => (
                                    <span key={tag} className="inline-flex items-center gap-1 px-3 py-1 bg-primary/10 text-primary rounded-full text-sm">
                                        <Tag className="w-3 h-3" />
                                        {tag}
                                        <button onClick={() => removeTag(tag)} className="ml-1 hover:text-red-500">
                                            <X className="w-3 h-3" />
                                        </button>
                                    </span>
                                ))}
                            </div>
                        )}
                    </div>

                    {/* Images */}
                    <div>
                        <label className="block text-sm font-medium text-secondary mb-2">Images</label>
                        <label className="inline-flex items-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-300 rounded-lg cursor-pointer hover:border-primary hover:bg-primary/5 transition">
                            <Upload className="w-4 h-4 text-accent" />
                            <span className="text-sm text-accent">{uploading ? 'Uploading...' : 'Upload Image'}</span>
                            <input
                                type="file"
                                accept="image/*"
                                onChange={handleImageUpload}
                                disabled={uploading}
                                className="hidden"
                            />
                        </label>
                        {images.length > 0 && (
                            <div className="flex flex-wrap gap-3 mt-3">
                                {images.map((url, index) => (
                                    <div key={index} className="relative group">
                                        <img src={url} alt="" className="w-24 h-24 object-cover rounded-lg" />
                                        <button
                                            onClick={() => removeImage(index)}
                                            className="absolute -top-2 -right-2 p-1 bg-red-500 text-white rounded-full opacity-0 group-hover:opacity-100 transition"
                                        >
                                            <X className="w-3 h-3" />
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                </div>

                <div className="sticky bottom-0 bg-white border-t px-6 py-4 flex justify-end gap-3 rounded-b-xl">
                    <button
                        onClick={onClose}
                        className="px-6 py-2.5 border border-gray-300 text-secondary rounded-lg hover:bg-gray-50"
                    >
                        Cancel
                    </button>
                    <button
                        onClick={handleSubmit}
                        disabled={submitting || !content.trim() || !groupId}
                        className="px-6 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        {submitting ? 'Creating...' : 'Create Post'}
                    </button>
                </div>
            </div>
        </div>
    );
}
