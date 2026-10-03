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
        thumbnailUrl: '',
        bannerUrl: '',
        eventDate: '',
        eventTime: '',
        endTime: '',
        timezone: 'Asia/Kolkata',
        location: '',
        locationType: 'physical' as 'physical' | 'online',
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
    const [showAdvanced, setShowAdvanced] = useState(false);
    const [tagInput, setTagInput] = useState('');
    const [requirementInput, setRequirementInput] = useState('');
    const [bringInput, setBringInput] = useState('');

    useEffect(() => {
        if (isOpen) {
            if (event) {
                const eventDate = new Date(event.eventDate);
                // Use local date (not UTC) to avoid timezone offset shifting the displayed date
                const localDate = eventDate.toLocaleDateString('en-CA'); // YYYY-MM-DD in local timezone

                setFormData({
                    title: event.title || '',
                    description: event.description || '',
                    shortDescription: event.shortDescription || '',
                    thumbnailUrl: event.thumbnailUrl || '',
                    bannerUrl: event.bannerUrl || '',
                    eventDate: localDate,
                    eventTime: event.eventTime || '',
                    endTime: event.endTime ? new Date(event.endTime).toTimeString().slice(0, 5) : '',
                    timezone: event.timezone || 'Asia/Kolkata',
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
                    thumbnailUrl: '',
                    bannerUrl: '',
                    eventDate: '',
                    eventTime: '',
                    endTime: '',
                    timezone: 'Asia/Kolkata',
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

    const handleLocationTypeChange = (next: 'physical' | 'online') => {
        setFormData((prev) => {
            let location = prev.location;
            if (next === 'online' && (!location.trim() || location.trim().toLowerCase() === 'online')) {
                location = 'Online';
            } else if (next !== 'online' && location.trim().toLowerCase() === 'online') {
                location = '';
            }
            return {
                ...prev,
                locationType: next,
                location,
                // Clear a stale meeting link when the event is no longer online.
                onlineMeetingLink: next === 'physical' ? '' : prev.onlineMeetingLink,
            };
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();

        const meetingLinkRequired = formData.locationType === 'online';
        const trimmedLink = formData.onlineMeetingLink.trim();

        if (meetingLinkRequired && !trimmedLink) {
            toast.error('Please add the meeting link for online events');
            return;
        }
        if (meetingLinkRequired && !/^https?:\/\//i.test(trimmedLink)) {
            toast.error('Meeting link must start with http:// or https://');
            return;
        }
        if (formData.endTime && formData.eventTime && formData.endTime <= formData.eventTime) {
            toast.error('End time must be after the start time');
            return;
        }

        // Frontend validation before API call
        if (!formData.title.trim()) {
            toast.error('Event title is required');
            return;
        }
        if (!formData.category) {
            toast.error('Category is required');
            return;
        }
        if (!formData.eventDate) {
            toast.error('Event date is required');
            return;
        }
        if (!formData.eventTime) {
            toast.error('Event time is required');
            return;
        }
        if (formData.locationType !== 'online' && !formData.location.trim()) {
            toast.error('Please add the venue for in-person events');
            return;
        }

        setSubmitting(true);

        try {
            // Prepare data with proper date/time formatting
            const submitData = {
                ...formData,
                location:
                    formData.locationType === 'online' && !formData.location.trim()
                        ? 'Online'
                        : formData.location.trim(),
                onlineMeetingLink: formData.locationType === 'physical' ? null : (trimmedLink || null),
                startTime: new Date(`${formData.eventDate}T${formData.eventTime}`).toISOString(),
                endTime: formData.endTime ? new Date(`${formData.eventDate}T${formData.endTime}`).toISOString() : null,
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
            const data = error.response?.data;
            const fieldErrors = Array.isArray(data?.errors)
                ? data.errors.map((e: any) => e?.msg || e?.message).filter(Boolean)
                : [];
            const message = fieldErrors.length > 0
                ? fieldErrors.join(' • ')
                : data?.message || 'Failed to save event';
            toast.error(message);
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
                            <h4 className="text-md font-semibold text-gray-900 mb-3">Event details</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Event name *
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
                                        Short summary
                                    </label>
                                    <input
                                        type="text"
                                        value={formData.shortDescription}
                                        onChange={(e) => setFormData({ ...formData, shortDescription: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                        placeholder="One line about the event"
                                    />
                                </div>

                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Description
                                    </label>
                                    <textarea
                                        value={formData.description}
                                        onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                        rows={4}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                        placeholder="Tell people what this event is about..."
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Event image
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
                                        <p className="text-xs text-gray-400 mt-1">Recommended: 800 × 450 px (16:9 ratio)</p>
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Banner image
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
                                        <p className="text-xs text-gray-400 mt-1">Recommended: 1600 × 400 px (4:1 wide banner ratio)</p>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* Date & Time */}
                        <div>
                            <h4 className="text-md font-semibold text-gray-900 mb-3">When is it?</h4>
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
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white [color-scheme:light]"
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
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white [color-scheme:light]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        End Time
                                    </label>
                                    <input
                                        type="time"
                                        value={formData.endTime}
                                        onChange={(e) => setFormData({ ...formData, endTime: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 bg-white [color-scheme:light]"
                                    />
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Time zone
                                    </label>
                                    <select
                                        value={formData.timezone}
                                        onChange={(e) => setFormData({ ...formData, timezone: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    >
                                        <option value="Asia/Kolkata">Asia/Kolkata (IST)</option>
                                        <option value="Asia/Dubai">Asia/Dubai</option>
                                        <option value="Europe/London">Europe/London</option>
                                        <option value="America/New_York">America/New_York</option>
                                        <option value="America/Los_Angeles">America/Los_Angeles</option>
                                        <option value="UTC">UTC</option>
                                    </select>
                                </div>
                            </div>
                        </div>

                        {/* Location */}
                        <div>
                            <h4 className="text-md font-semibold text-gray-900 mb-3">Location</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        How will people attend? *
                                    </label>
                                    <select
                                        required
                                        value={formData.locationType}
                                        onChange={(e) => handleLocationTypeChange(e.target.value as 'physical' | 'online')}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    >
                                        <option value="physical">In person (at a venue)</option>
                                        <option value="online">Online</option>
                                    </select>
                                </div>

                                {formData.locationType !== 'online' && (
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Venue name *
                                        </label>
                                        <input
                                            type="text"
                                            required
                                            value={formData.location}
                                            onChange={(e) => setFormData({ ...formData, location: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                            placeholder="e.g. Community Hall, Delhi"
                                        />
                                    </div>
                                )}

                                {formData.locationType === 'online' && (
                                    <div className="md:col-span-2">
                                        <label className="block text-sm font-medium text-gray-700 mb-1">
                                            Meeting link *
                                        </label>
                                        <input
                                            type="url"
                                            required
                                            value={formData.onlineMeetingLink}
                                            onChange={(e) => setFormData({ ...formData, onlineMeetingLink: e.target.value })}
                                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                            placeholder="https://meet.google.com/... or https://zoom.us/j/..."
                                        />
                                        <p className="text-xs text-gray-500 mt-1">
                                            Attendees who register will see this link.
                                        </p>
                                    </div>
                                )}

                                {formData.locationType === 'physical' && (
                                    <>
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Street Address</label>
                                            <input
                                                type="text"
                                                value={formData.address.street}
                                                onChange={(e) => setFormData({ ...formData, address: { ...formData.address, street: e.target.value } })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                            />
                                        </div>
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
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Zip / Postal Code</label>
                                            <input
                                                type="text"
                                                value={formData.address.zipCode}
                                                onChange={(e) => setFormData({ ...formData, address: { ...formData.address, zipCode: e.target.value } })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                            />
                                        </div>
                                        <div>
                                            <label className="block text-sm font-medium text-gray-700 mb-1">Country</label>
                                            <input
                                                type="text"
                                                value={formData.address.country}
                                                onChange={(e) => setFormData({ ...formData, address: { ...formData.address, country: e.target.value } })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Category & Tags */}
                        <div>
                            <h4 className="text-md font-semibold text-gray-900 mb-3">Category &amp; tags</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Category *
                                    </label>
                                    <select
                                        required
                                        value={formData.category}
                                        onChange={(e) => setFormData({ ...formData, category: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                    >
                                        <option value="">Select category...</option>
                                        <option value="Meditation">Meditation</option>
                                        <option value="Discourse">Discourse</option>
                                        <option value="Wellness">Wellness</option>
                                        <option value="Devotional">Devotional</option>
                                        <option value="Festival">Festival</option>
                                        <option value="Workshop">Workshop</option>
                                        <option value="Healing">Healing</option>
                                        <option value="Yoga">Yoga</option>
                                        <option value="Other">Other</option>
                                    </select>
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
                            <h4 className="text-md font-semibold text-gray-900 mb-3">Tickets &amp; pricing</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div className="md:col-span-2">
                                    <label className="flex items-center gap-2">
                                        <input
                                            type="checkbox"
                                            checked={formData.isPaid}
                                            onChange={(e) => setFormData({ ...formData, isPaid: e.target.checked })}
                                            className="w-4 h-4 text-blue-600 rounded"
                                        />
                                        <span className="text-sm font-medium text-gray-700">Charge for tickets</span>
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
                                        <div className="md:col-span-2">
                                            <label className="block text-sm font-medium text-gray-700 mb-1">
                                                Early bird price
                                            </label>
                                            <input
                                                type="number"
                                                min="0"
                                                value={formData.earlyBirdPrice}
                                                onChange={(e) => setFormData({ ...formData, earlyBirdPrice: parseFloat(e.target.value) || 0 })}
                                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                                placeholder="0 = no early bird pricing"
                                            />
                                        </div>
                                    </>
                                )}
                            </div>
                        </div>

                        {/* Capacity & Registration */}
                        <div>
                            <h4 className="text-md font-semibold text-gray-900 mb-3">Capacity &amp; sign-up</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Maximum attendees (leave empty for unlimited)
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
                                        <span className="text-sm font-medium text-gray-700">Sign-up required</span>
                                    </label>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Organizer
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

                        <button
                            type="button"
                            onClick={() => setShowAdvanced((v) => !v)}
                            className="w-full flex items-center justify-between px-4 py-3 bg-gray-50 border border-gray-200 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-100"
                        >
                            <span>{showAdvanced ? 'Hide extra options' : 'Add extra options (requirements, search listing, notes)'}</span>
                            <span className="text-lg leading-none">{showAdvanced ? '−' : '+'}</span>
                        </button>

                        {showAdvanced && (
                        <>
                        {/* Requirements & What to Bring */}
                        <div>
                            <h4 className="text-md font-semibold text-gray-900 mb-3">Requirements &amp; what to bring</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Requirements</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={requirementInput}
                                            onChange={(e) => setRequirementInput(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addRequirement())}
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-500"
                                            placeholder="e.g. Open to all ages"
                                        />
                                        <button type="button" onClick={addRequirement} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">
                                            Add
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {formData.requirements.map((item, index) => (
                                            <span key={index} className="px-3 py-1 bg-amber-100 text-amber-800 rounded-full text-sm flex items-center gap-2">
                                                {item}
                                                <button type="button" onClick={() => removeRequirement(index)} className="hover:text-amber-600">
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>

                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">What to Bring</label>
                                    <div className="flex gap-2">
                                        <input
                                            type="text"
                                            value={bringInput}
                                            onChange={(e) => setBringInput(e.target.value)}
                                            onKeyPress={(e) => e.key === 'Enter' && (e.preventDefault(), addBring())}
                                            className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-gray-900 placeholder:text-gray-500"
                                            placeholder="e.g. Water bottle"
                                        />
                                        <button type="button" onClick={addBring} className="px-4 py-2 bg-gray-200 rounded-lg hover:bg-gray-300">
                                            Add
                                        </button>
                                    </div>
                                    <div className="flex flex-wrap gap-2 mt-2">
                                        {formData.whatToBring.map((item, index) => (
                                            <span key={index} className="px-3 py-1 bg-emerald-100 text-emerald-800 rounded-full text-sm flex items-center gap-2">
                                                {item}
                                                <button type="button" onClick={() => removeBring(index)} className="hover:text-emerald-600">
                                                    ×
                                                </button>
                                            </span>
                                        ))}
                                    </div>
                                </div>
                            </div>
                        </div>

                        {/* SEO */}
                        <div>
                            <h4 className="text-md font-semibold text-gray-900 mb-3">Search listing</h4>
                            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Search title</label>
                                    <input
                                        type="text"
                                        value={formData.metaTitle}
                                        onChange={(e) => setFormData({ ...formData, metaTitle: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                        placeholder="Title shown in search results"
                                    />
                                </div>
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">Search description</label>
                                    <input
                                        type="text"
                                        value={formData.metaDescription}
                                        onChange={(e) => setFormData({ ...formData, metaDescription: e.target.value })}
                                        className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-black"
                                        placeholder="Short text shown in search results"
                                    />
                                </div>
                            </div>
                        </div>

                        {/* Additional Info */}
                        <div>
                            <h4 className="text-md font-semibold text-gray-900 mb-3">More information</h4>
                            <div className="space-y-4">
                                <div>
                                    <label className="block text-sm font-medium text-gray-700 mb-1">
                                        Extra notes
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
                        </>
                        )}
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
