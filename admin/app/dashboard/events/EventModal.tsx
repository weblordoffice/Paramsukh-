'use client';

import { useState, useEffect } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { X } from 'lucide-react';

interface EventModalProps {
    isOpen: boolean;
    onClose: () => void;
    event: any | null;
    onSuccess: () => void;
}

export default function EventModal({ isOpen, onClose, event, onSuccess }: EventModalProps) {
    const [formData, setFormData] = useState({
        title: '',
        description: '',
        shortDescription: '',
        icon: 'calendar',
        color: '#8B5CF6',
        emoji: '📅',
        thumbnailUrl: '',
        bannerUrl: '',
        eventDate: '',
        eventTime: '',
        location: '',
        locationType: 'physical' as 'physical' | 'online' | 'hybrid',
        address: {
            street: '',
            city: '',
            state: '',
            zipCode: '',
            country: ''
        },
        onlineMeetingLink: '',
        category: '',
        tags: [] as string[],
        isPaid: false,
        price: 0,
        currency: 'INR',
        earlyBirdPrice: 0,
        maxAttendees: undefined as number | undefined,
        registrationRequired: false,
        organizer: '',
        requirements: [] as string[],
        whatToBring: [] as string[],
        additionalInfo: '',
        metaTitle: '',
        metaDescription: ''
    });
    const [submitting, setSubmitting] = useState(false);
    const [uploading, setUploading] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [requirementInput, setRequirementInput] = useState('');
    const [bringInput, setBringInput] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (event) {
                const eventDate = new Date(event.eventDate);
                const localDate = eventDate.toISOString().split('T')[0];

                setFormData({
                    title: event.title || '',
                    description: event.description || '',
                    shortDescription: event.shortDescription || '',
                    icon: event.icon || 'calendar',
                    color: event.color || '#8B5CF6',
                    emoji: event.emoji || '📅',
                    thumbnailUrl: event.thumbnailUrl || '',
                    bannerUrl: event.bannerUrl || '',
                    eventDate: localDate,
                    eventTime: event.eventTime || '',
                    location: event.location || '',
                    locationType: event.locationType || 'physical',
                    address: event.address || {
                        street: '',
                        city: '',
                        state: '',
                        zipCode: '',
                        country: ''
                    },
                    onlineMeetingLink: event.onlineMeetingLink || '',
                    category: event.category || '',
                    tags: event.tags || [],
                    isPaid: event.isPaid || false,
                    price: event.price || 0,
                    currency: event.currency || 'INR',
                    earlyBirdPrice: event.earlyBirdPrice || 0,
                    maxAttendees: event.maxAttendees,
                    registrationRequired: event.registrationRequired || false,
                    organizer: event.organizer || '',
                    requirements: event.requirements || [],
                    whatToBring: event.whatToBring || [],
                    additionalInfo: event.additionalInfo || '',
                    metaTitle: event.metaTitle || '',
                    metaDescription: event.metaDescription || ''
                });
            } else {
                // Reset form for new event
                setFormData({
                    title: '',
                    description: '',
                    shortDescription: '',
                    icon: 'calendar',
                    color: '#8B5CF6',
                    emoji: '📅',
                    thumbnailUrl: '',
                    bannerUrl: '',
                    eventDate: '',
                    eventTime: '',
                    location: '',
                    locationType: 'physical',
                    address: {
                        street: '',
                        city: '',
                        state: '',
                        zipCode: '',
                        country: ''
                    },
                    onlineMeetingLink: '',
                    category: '',
                    tags: [],
                    isPaid: false,
                    price: 0,
                    currency: 'INR',
                    earlyBirdPrice: 0,
                    maxAttendees: undefined,
                    registrationRequired: false,
                    organizer: '',
                    requirements: [],
                    whatToBring: [],
                    additionalInfo: '',
                    metaTitle: '',
                    metaDescription: ''
                });
            }
            setTagInput('');
            setRequirementInput('');
            setBringInput('');
        }
    }, [isOpen, event]);

    const addTag = () => {
        if (tagInput.trim() && !formData.tags.includes(tagInput.trim())) {
            setFormData({ ...formData, tags: [...formData.tags, tagInput.trim()] });
            setTagInput('');
        }
    };

    const removeTag = (tag: string) => {
        setFormData({ ...formData, tags: formData.tags.filter(t => t !== tag) });
    };

    const addRequirement = () => {
        if (requirementInput.trim()) {
            setFormData({ ...formData, requirements: [...formData.requirements, requirementInput.trim()] });
            setRequirementInput('');
        }
    };

    const removeRequirement = (index: number) => {
        setFormData({ ...formData, requirements: formData.requirements.filter((_, i) => i !== index) });
    };

    const addBring = () => {
        if (bringInput.trim()) {
            setFormData({ ...formData, whatToBring: [...formData.whatToBring, bringInput.trim()] });
            setBringInput('');
        }
    };

    const removeBring = (index: number) => {
        setFormData({ ...formData, whatToBring: formData.whatToBring.filter((_, i) => i !== index) });
    };

    const handleFileUpload = async (
        e: React.ChangeEvent<HTMLInputElement>,
        fieldName: 'thumbnailUrl' | 'bannerUrl',
        folder: string
    ) => {
        const file = e.target.files?.[0];
        if (!file) return;

        const uploadData = new FormData();
        uploadData.append('image', file);

        const toastId = toast.loading('Uploading image...');
        setUploading(true);

        try {
            const response = await apiClient.post(`/api/upload/image?folder=${encodeURIComponent(folder)}`, uploadData, {
                headers: {
                    'Content-Type': 'multipart/form-data',
                },
            });

            if (response.data.success) {
                setFormData((prev) => ({
                    ...prev,
                    [fieldName]: response.data.data.url
                }));
                toast.success('Image uploaded successfully!', { id: toastId });
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
            // Prepare data with proper date/time formatting
            const submitData = {
                ...formData,
                startTime: new Date(`${formData.eventDate}T${formData.eventTime}`).toISOString(),
                maxAttendees: formData.maxAttendees || null
            };

            if (event) {
                await apiClient.put(`/api/events/${event._id}`, submitData);
                toast.success('Event updated successfully');
            } else {
                await apiClient.post('/api/events/create', submitData);
                toast.success('Event created successfully');
            }
            onSuccess();
            onClose();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to save event');
            console.error(error);
        } finally {
            setSubmitting(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
            <div className="bg-white rounded-lg max-w-4xl w-full max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex justify-between items-center">
                    <h3 className="text-lg font-semibold text-gray-900">
                        {event ? 'Edit Event' : 'Create New Event'}
                    </h3>
                    <button
                        onClick={onClose}
                        className="text-gray-400 hover:text-gray-600"
                    >
                        <X className="w-6 h-6" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6">
                    <div className="space-y-6">
                        {/* Basic Information */}
                        <div>
                            <h4 className="text-md font-semibold text-gray-900 mb-3">Basic Information</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Event Title *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.title}
                                        onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                        placeholder="Morning Meditation Session"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Short Description
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.shortDescription}
                                        onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                        placeholder="Brief one-line description"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Full Description
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={4}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                        placeholder="Detailed event description..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Emoji
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.emoji}
                                        onChange={(e) => setFormData({ ...formData, emoji: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                        placeholder="📅"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Color (Hex)
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.color}
                                        onChange={(e) => setFormData({ ...formData, color: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                        placeholder="#8B5CF6"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Thumbnail URL
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="url"
                                            value={formData.thumbnailUrl}
                                            onChange={(e) => setFormData({ ...formData, thumbnailUrl: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                            placeholder="https://..."
                                        />
                                        <div className="relative">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handleFileUpload(e, 'thumbnailUrl', 'events/thumbnails')}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                disabled={uploading}
                                            />
                                            <button
                                                type="button"
                                                disabled={uploading}
                                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg border border-gray-300 text-sm font-medium transition whitespace-nowrap"
                                            >
                                                Upload
                                            </button>
                                        </div>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Banner URL
                                    </label>
                                    <div className="flex gap-2">
                                        <input
                                            type="url"
                                            value={formData.bannerUrl}
                                            onChange={(e) => setFormData({ ...formData, bannerUrl: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                            placeholder="https://..."
                                        />
                                        <div className="relative">
                                            <input
                                                type="file"
                                                accept="image/*"
                                                onChange={(e) => handleFileUpload(e, 'bannerUrl', 'events/banners')}
                                                className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                                                disabled={uploading}
                                            />
                                            <button
                                                type="button"
                                                disabled={uploading}
                                                className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg border border-gray-300 text-sm font-medium transition whitespace-nowrap"
                                            >
                                                Upload
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Date & Time */}
                        <div>
                            <h4 className="text-md font-semibold text-gray-900 mb-3">Date & Time</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Event Date *
                                    </label>
                                    <input
                                        type="date"
                                        required
                                        value={formData.eventDate}
                                        onChange={(e) => setFormData({ ...formData, eventDate: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Event Time *
                                    </label>
                                    <input
                                        type="time"
                                        required
                                        value={formData.eventTime}
                                        onChange={(e) => setFormData({ ...formData, eventTime: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Location */}
                        <div>
                            <h4 className="text-md font-semibold text-gray-900 mb-3">Location</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Location Type *
                                    </label>
                                    <select
                                        required
                                        value={formData.locationType}
                                        onChange={(e) => setFormData({ ...formData, locationType: e.target.value as any })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    >
                                        <option value="physical">Physical</option>
                                        <option value="online">Online</option>
                                        <option value="hybrid">Hybrid</option>
                                    </select>
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Location/Venue *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.location}
                                        onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                        placeholder="Venue name or Online"
                                    />
                                </div>

                                {(formData.locationType === 'online' || formData.locationType === 'hybrid') && (
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Online Meeting Link
                                        </label>
                                        <input
                                            type="url"
                                            value={formData.onlineMeetingLink}
                                            onChange={(e) => setFormData({ ...formData, onlineMeetingLink: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                            placeholder="Zoom/Meet link"
                                        />
                                    </div>
                                )}

                                {(formData.locationType === 'physical' || formData.locationType === 'hybrid') && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">City</label>
                                            <input
                                                type="text"
                                                value={formData.address.city}
                                                onChange={(e) => setFormData({ ...formData, address: { ...formData.address, city: e.target.value } })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">State</label>
                                            <input
                                                type="text"
                                                value={formData.address.state}
                                                onChange={(e) => setFormData({ ...formData, address: { ...formData.address, state: e.target.value } })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Category & Tags */}
                        <div>
                            <h4 className="text-md font-semibold text-gray-900 mb-3">Category & Tags</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Category *
                                    </label>
                                    <input
                                        type="text"
                                        required
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                        placeholder="Enter event category (e.g. Workshop, Retreat)"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Tags</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={tagInput}
                                            onChange={(e) => setTagInput(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addTag())}
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-500"
                                            placeholder="Add tag and press Enter"
                                        />
                                        <button
                                            type="button"
                                            onClick={addTag}
                                            className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300"
                                        >
                                            Add
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {formData.tags.map((tag, index) => (
                                            <span
                                                key={index}
                                                className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-sm flex items-center gap-2"
                                            >
                                                {tag}
                                                <button
                                                    type="button"
                                                    onClick={() => removeTag(tag)}
                                                    className="hover:text-blue-600"
                                                >
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Pricing */}
                        <div>
                            <h4 className="text-md font-semibold text-gray-900 mb-3">Pricing</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.isPaid}
                                            onChange={(e) => setFormData({ ...formData, isPaid: e.target.checked })}
                                            className="w-4 h-4 text-blue-600 rounded"
                                        />
                                        <span className="text-sm font-medium text-gray-700">This is a paid event</span>
                                    </label>
                                </div>

                                {formData.isPaid && (
                                    <>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Price
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.price}
                                                onChange={(e) => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Currency
                                            </label>
                                            <select
                                                value={formData.currency}
                                                onChange={(e) => setFormData({ ...formData, currency: e.target.value })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                            >
                                                <option value="INR">INR</option>
                                                <option value="USD">USD</option>
                                                <option value="EUR">EUR</option>
                                            </select>
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Capacity & Registration */}
                        <div>
                            <h4 className="text-md font-semibold text-gray-900 mb-3">Capacity & Registration</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Max Attendees (leave empty for unlimited)
                                    </label>
                                    <input
                                        type="number"
                                        min="1"
                                        value={formData.maxAttendees || ''}
                                        onChange={(e) => setFormData({ ...formData, maxAttendees: e.target.value ? parseInt(e.target.value) : undefined })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                        placeholder="Unlimited"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.registrationRequired}
                                            onChange={(e) => setFormData({ ...formData, registrationRequired: e.target.checked })}
                                            className="w-4 h-4 text-blue-600 rounded"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Registration required</span>
                                    </label>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Organizer Name
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.organizer}
                                        onChange={(e) => setFormData({ ...formData, organizer: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                        placeholder="Organizer name"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Additional Info */}
                        <div>
                            <h4 className="text-md font-semibold text-gray-900 mb-3">Additional Information</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Additional Info
                                    </label>
                                    <textarea
                                        value={formData.additionalInfo}
                                        onChange={(e) => setFormData({ ...formData, additionalInfo: e.target.value })}
                                        rows={3}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                        placeholder="Any other important information..."
                                    />
                                </div>
                            </div>
                        </div>
                    </div>

                    <div className="flex justify-end gap-3 mt-6 pt-6 border-t border-gray-200">
                        <button
                            type="button"
                            onClick={onClose}
                            className="px-6 py-2 text-gray-700 bg-gray-100 rounded-lg hover:bg-gray-200 transition-colors"
                        >
                            Cancel
                        </button>
                        <button
                            type="submit"
                            disabled={submitting}
                            className="px-6 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors disabled:opacity-50"
                        >
                            {submitting ? 'Saving...' : event ? 'Update Event' : 'Create Event'}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
