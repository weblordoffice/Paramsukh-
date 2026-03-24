'use client';

import { useState, useEffect } from 'react';
import { X, Loader2, Check } from 'lucide-react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';

interface BusinessHour {
    start: string;
    end: string;
    isActive: boolean;
}

interface BusinessHours {
    monday: BusinessHour;
    tuesday: BusinessHour;
    wednesday: BusinessHour;
    thursday: BusinessHour;
    friday: BusinessHour;
    saturday: BusinessHour;
    sunday: BusinessHour;
}

interface CounselingService {
    _id?: string;
    title: string;
    description: string;
    duration: string;
    price: number;
    isFree: boolean;
    color: string;
    bgColor: string;
    icon: string;
    counselorName: string;
    intervalMinutes: number;
    businessHours: BusinessHours;
}

interface ServiceModalProps {
    isOpen: boolean;
    onClose: () => void;
    service: CounselingService | null;
    onSuccess: () => void;
}

const DAYS: (keyof BusinessHours)[] = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'];

const DEFAULT_HOURS: BusinessHour = { start: '09:00', end: '18:00', isActive: true };
const INITIAL_BUSINESS_HOURS: BusinessHours = {
    monday: { ...DEFAULT_HOURS },
    tuesday: { ...DEFAULT_HOURS },
    wednesday: { ...DEFAULT_HOURS },
    thursday: { ...DEFAULT_HOURS },
    friday: { ...DEFAULT_HOURS },
    saturday: { ...DEFAULT_HOURS },
    sunday: { ...DEFAULT_HOURS, isActive: false },
};

const COLORS = [
    { name: 'Blue', color: '#3B82F6', bg: '#EFF6FF' },
    { name: 'Purple', color: '#8B5CF6', bg: '#F5F3FF' },
    { name: 'Green', color: '#10B981', bg: '#ECFDF5' },
    { name: 'Pink', color: '#EC4899', bg: '#FDF2F8' },
    { name: 'Yellow', color: '#F59E0B', bg: '#FFFBEB' },
    { name: 'Indigo', color: '#6366F1', bg: '#EEF2FF' },
    { name: 'Red', color: '#EF4444', bg: '#FEF2F2' },
    { name: 'Orange', color: '#F97316', bg: '#FFF7ED' },
];

const ICONS = ['help-buoy', 'heart', 'briefcase', 'people', 'school', 'medical', 'star', 'chatbubbles'];

export default function CounselingServiceModal({ isOpen, onClose, service, onSuccess }: ServiceModalProps) {
    const [loading, setLoading] = useState(false);

    const [formData, setFormData] = useState<CounselingService>({
        title: '',
        description: '',
        duration: '60 mins',
        price: 999,
        isFree: false,
        color: '#3B82F6',
        bgColor: '#EFF6FF',
        icon: 'help-buoy',
        counselorName: 'Expert Counselor',
        intervalMinutes: 60,
        businessHours: INITIAL_BUSINESS_HOURS
    });

    useEffect(() => {
        if (service) {
            setFormData({
                ...service,
                intervalMinutes: service.intervalMinutes || 60,
                businessHours: service.businessHours || INITIAL_BUSINESS_HOURS
            });
        } else {
            setFormData({
                title: '',
                description: '',
                duration: '60 mins',
                price: 999,
                isFree: false,
                color: '#3B82F6',
                bgColor: '#EFF6FF',
                icon: 'help-buoy',
                counselorName: 'Expert Counselor',
                intervalMinutes: 60,
                businessHours: INITIAL_BUSINESS_HOURS
            });
        }
    }, [service, isOpen]);

    const handleColorSelect = (colorObj: typeof COLORS[0]) => {
        setFormData({ ...formData, color: colorObj.color, bgColor: colorObj.bg });
    };

    const toggleDay = (day: keyof BusinessHours) => {
        setFormData({
            ...formData,
            businessHours: {
                ...formData.businessHours,
                [day]: { ...formData.businessHours[day], isActive: !formData.businessHours[day].isActive }
            }
        });
    };

    const updateTime = (day: keyof BusinessHours, field: 'start' | 'end', value: string) => {
        setFormData({
            ...formData,
            businessHours: {
                ...formData.businessHours,
                [day]: { ...formData.businessHours[day], [field]: value }
            }
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        setLoading(true);

        try {
            if (service?._id) {
                await apiClient.put(`/api/counseling/admin/services/${service._id}`, formData);
                toast.success('Service updated successfully');
            } else {
                await apiClient.post('/api/counseling/admin/services', formData);
                toast.success('Service created successfully');
            }
            onSuccess();
            onClose();
        } catch (error: any) {
            console.error('Error saving service:', error);
            toast.error(error.response?.data?.message || 'Failed to save service');
        } finally {
            setLoading(false);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm p-4">
            <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
                <div className="flex items-center justify-between p-6 border-b border-gray-100 sticky top-0 bg-white z-10">
                    <h2 className="text-xl font-bold text-gray-900">
                        {service ? 'Edit Service' : 'Add New Service'}
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-full transition-colors">
                        <X className="w-5 h-5 text-gray-500" />
                    </button>
                </div>

                <form onSubmit={handleSubmit} className="p-6 space-y-6">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
                        {/* Title */}
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Title *</label>
                            <input
                                type="text"
                                required
                                value={formData.title}
                                onChange={(e) => setFormData({ ...formData, title: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-gray-900 placeholder:text-gray-500"
                                placeholder="e.g. Relationship Counseling"
                            />
                        </div>

                        {/* Counselor Name */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Counselor Name</label>
                            <input
                                type="text"
                                value={formData.counselorName}
                                onChange={(e) => setFormData({ ...formData, counselorName: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-gray-900 placeholder:text-gray-500"
                                placeholder="e.g. Dr. Sharma"
                            />
                        </div>

                        {/* Duration */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Duration</label>
                            <input
                                type="text"
                                required
                                value={formData.duration}
                                onChange={(e) => setFormData({ ...formData, duration: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-gray-900 placeholder:text-gray-500"
                                placeholder="e.g. 60 mins"
                            />
                        </div>

                        {/* Price & Free Toggle */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Price (₹)</label>
                            <div className="relative">
                                <input
                                    type="number"
                                    min="0"
                                    disabled={formData.isFree}
                                    value={formData.price}
                                    onChange={(e) => setFormData({ ...formData, price: Number(e.target.value) })}
                                    className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-gray-900 placeholder:text-gray-500 disabled:bg-gray-100 disabled:text-gray-500"
                                />
                            </div>
                        </div>

                        {/* Interval Minutes */}
                        <div>
                            <label className="block text-sm font-medium text-gray-700 mb-2">Slot Interval (mins)</label>
                            <input
                                type="number"
                                min="15"
                                step="15"
                                required
                                value={formData.intervalMinutes}
                                onChange={(e) => setFormData({ ...formData, intervalMinutes: Number(e.target.value) })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition text-gray-900 placeholder:text-gray-500"
                            />
                        </div>

                        <div className="flex items-center pt-8">
                            <input
                                type="checkbox"
                                id="isFree"
                                checked={formData.isFree}
                                onChange={(e) => setFormData({ ...formData, isFree: e.target.checked, price: e.target.checked ? 0 : formData.price || 999 })}
                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                            />
                            <label htmlFor="isFree" className="ml-2 block text-sm text-gray-900 font-medium">
                                Mark as Free Service
                            </label>
                        </div>

                        {/* Business Hours */}
                        <div className="col-span-2">
                            <label className="block text-sm font-bold text-gray-800 mb-4 border-t pt-4">Counselor Working Hours</label>
                            <div className="space-y-4">
                                {DAYS.map((day) => (
                                    <div key={day} className="flex flex-col md:flex-row md:items-center gap-4 bg-gray-50 p-3 rounded-xl border border-gray-100">
                                        <div className="w-32 flex items-center gap-3">
                                            <input
                                                type="checkbox"
                                                id={`check-${day}`}
                                                checked={formData.businessHours[day].isActive}
                                                onChange={() => toggleDay(day)}
                                                className="w-4 h-4 text-blue-600 border-gray-300 rounded focus:ring-blue-500"
                                            />
                                            <label htmlFor={`check-${day}`} className="text-sm font-semibold capitalize text-gray-700">
                                                {day}
                                            </label>
                                        </div>
                                        
                                        {formData.businessHours[day].isActive ? (
                                            <div className="flex items-center gap-3 flex-1">
                                                <input
                                                    type="time"
                                                    value={formData.businessHours[day].start}
                                                    onChange={(e) => updateTime(day, 'start', e.target.value)}
                                                    className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                                                />
                                                <span className="text-gray-400 text-sm">to</span>
                                                <input
                                                    type="time"
                                                    value={formData.businessHours[day].end}
                                                    onChange={(e) => updateTime(day, 'end', e.target.value)}
                                                    className="px-2 py-1.5 border border-gray-300 rounded-lg text-sm bg-white text-gray-900"
                                                />
                                            </div>
                                        ) : (
                                            <div className="flex-1 flex items-center">
                                                <span className="text-xs font-medium px-2 py-1 bg-gray-200 text-gray-500 rounded-md">CLOSED</span>
                                            </div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>

                        {/* Colors */}
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-3">Theme Color</label>
                            <div className="flex flex-wrap gap-3">
                                {COLORS.map((c) => (
                                    <button
                                        key={c.name}
                                        type="button"
                                        onClick={() => handleColorSelect(c)}
                                        className={`w-8 h-8 rounded-full flex items-center justify-center transition-transform hover:scale-110 ${formData.color === c.color ? 'ring-2 ring-offset-2 ring-gray-400' : ''}`}
                                        style={{ backgroundColor: c.color }}
                                        title={c.name}
                                    >
                                        {formData.color === c.color && <Check className="w-4 h-4 text-white" />}
                                    </button>
                                ))}
                            </div>
                        </div>

                        {/* Icons */}
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-3">Icon (Ionicons)</label>
                            <div className="flex flex-wrap gap-2">
                                {ICONS.map((icon) => (
                                    <button
                                        key={icon}
                                        type="button"
                                        onClick={() => setFormData({ ...formData, icon })}
                                        className={`px-3 py-1 text-xs border rounded-full transition-colors ${formData.icon === icon ? 'bg-black text-white border-black' : 'bg-white text-gray-600 border-gray-300 hover:bg-gray-50'}`}
                                    >
                                        {icon}
                                    </button>
                                ))}
                                <input
                                    type="text"
                                    placeholder="Custom Icon Name"
                                    value={formData.icon}
                                    onChange={(e) => setFormData({ ...formData, icon: e.target.value })}
                                    className="px-3 py-1 text-xs border border-gray-300 rounded-full w-32 focus:outline-none focus:border-blue-500 ml-2 text-gray-900 placeholder:text-gray-500"
                                />
                            </div>
                        </div>

                        {/* Description */}
                        <div className="col-span-2">
                            <label className="block text-sm font-medium text-gray-700 mb-2">Description *</label>
                            <textarea
                                required
                                rows={4}
                                value={formData.description}
                                onChange={(e) => setFormData({ ...formData, description: e.target.value })}
                                className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none transition resize-none text-gray-900 placeholder:text-gray-500"
                                placeholder="Describe what this session covers..."
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
                            disabled={loading}
                            className="flex items-center gap-2 px-6 py-2 text-sm font-medium text-white bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors disabled:opacity-50"
                        >
                            {loading ? (
                                <>
                                    <Loader2 className="w-4 h-4 animate-spin" /> saving...
                                </>
                            ) : (
                                service ? 'Update Service' : 'Create Service'
                            )}
                        </button>
                    </div>
                </form>
            </div>
        </div>
    );
}
