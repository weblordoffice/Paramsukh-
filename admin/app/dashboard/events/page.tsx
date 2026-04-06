'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter } from 'next/navigation';
import Image from 'next/image';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Search, Plus, Edit, Trash2, Calendar as CalendarIcon, MapPin, Users, DollarSign, FolderOpen } from 'lucide-react';
import EventModal from './EventModal';

interface Event {
    _id: string;
    title: string;
    description: string;
    shortDescription: string;
    thumbnailUrl?: string;
    bannerUrl?: string;
    eventDate: string;
    eventTime: string;
    startTime: string;
    endTime?: string;
    location: string;
    locationType: 'physical' | 'online' | 'hybrid';
    category: string;
    tags: string[];
    isPaid: boolean;
    price: number;
    currency: string;
    maxAttendees?: number;
    currentAttendees: number;
    status: 'upcoming' | 'ongoing' | 'past' | 'cancelled';
    isActive: boolean;
    icon?: string;
    color?: string;
    emoji?: string;
}

export default function EventsPage() {
    const router = useRouter();
    const [events, setEvents] = useState<Event[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');
    const [filterCategory, setFilterCategory] = useState<string>('all');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedEvent, setSelectedEvent] = useState<Event | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);

    const fetchEvents = useCallback(async () => {
        try {
            const params: any = {};
            if (filterStatus !== 'all') params.status = filterStatus;
            if (filterCategory !== 'all') params.category = filterCategory;
            
            const response = await apiClient.get('/api/events/all', { params });
            setEvents(response.data.events || []);
        } catch (error: any) {
            // Only show error for server errors, not for empty data
            if (error.response?.status !== 404) {
                console.error('Error fetching events:', error);
                if (error.response?.status >= 500) {
                    toast.error('Server error. Please try again later.');
                }
            }
            setEvents([]);
        } finally {
            setLoading(false);
        }
    }, [filterStatus, filterCategory]);

    useEffect(() => {
        fetchEvents();
    }, [filterStatus, filterCategory, fetchEvents]);

    const handleCreate = () => {
        setSelectedEvent(null);
        setIsModalOpen(true);
    };

    const handleEdit = (event: Event) => {
        setSelectedEvent(event);
        setIsModalOpen(true);
    };

    const handleDelete = async (eventId: string) => {
        if (!confirm('Are you sure you want to delete this event?')) return;

        setDeleting(eventId);
        try {
            await apiClient.delete(`/api/events/${eventId}`);
            toast.success('Event deleted successfully');
            fetchEvents();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete event');
            console.error(error);
        } finally {
            setDeleting(null);
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'upcoming': return 'bg-blue-100 text-blue-800';
            case 'ongoing': return 'bg-green-100 text-green-800';
            case 'past': return 'bg-gray-100 text-gray-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getLocationTypeColor = (type: string) => {
        switch (type) {
            case 'physical': return 'bg-purple-100 text-purple-800';
            case 'online': return 'bg-cyan-100 text-cyan-800';
            case 'hybrid': return 'bg-orange-100 text-orange-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'short',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const filteredEvents = events.filter(event =>
        event.title?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.description?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        event.location?.toLowerCase().includes(searchTerm.toLowerCase())
    );

    if (loading) {
        return (
            <div className="flex items-center justify-center h-full">
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin" />
            </div>
        );
    }

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-secondary">Events Management</h1>
                    <p className="text-gray-900 mt-1">Manage all events and registrations</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center space-x-2 px-6 py-3 bg-primary hover:bg-primary-dark text-white rounded-lg transition duration-200 font-medium"
                >
                    <Plus className="w-5 h-5" />
                    <span>Create Event</span>
                </button>
            </div>

            {/* Filters & Search */}
            <div className="bg-white rounded-xl p-4 shadow-md space-y-4">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-900" />
                    <input
                        type="text"
                        placeholder="Search events by title, description or location..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none text-gray-900 placeholder:text-gray-500"
                    />
                </div>

                <div className="flex gap-4">
                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-900 mb-1">Status</label>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none text-gray-900 bg-white"
                        >
                            <option value="all">All Status</option>
                        <option value="upcoming">Upcoming</option>
                            <option value="ongoing">Ongoing</option>
                            <option value="past">Past</option>
                            <option value="cancelled">Cancelled</option>
                        </select>
                    </div>

                    <div className="flex-1">
                        <label className="block text-sm font-medium text-gray-900 mb-1">Category</label>
                        <select
                            value={filterCategory}
                            onChange={(e) => setFilterCategory(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary outline-none text-gray-900 bg-white"
                        >
                            <option value="all">All Categories</option>
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
                </div>
            </div>

            {/* Events Grid */}
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                {filteredEvents.length === 0 ? (
                    <div className="col-span-full text-center py-12 text-gray-900">
                        No events found
                    </div>
                ) : (
                    filteredEvents.map((event) => (
                        <div
                            key={event._id}
                            className="bg-white rounded-xl shadow-md hover:shadow-xl transition-shadow overflow-hidden"
                        >
                            {/* Event Banner/Thumbnail */}
                            <div className="relative h-48 bg-gradient-to-br from-primary to-primary-dark">
                                {event.thumbnailUrl ? (
                                    <Image
                                        src={event.thumbnailUrl}
                                        alt={event.title}
                                        fill
                                        unoptimized
                                        className="object-cover"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full">
                                        <span className="text-6xl">{event.emoji || '📅'}</span>
                                    </div>
                                )}
                                <div className="absolute top-3 right-3 flex gap-2">
                                    <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${getStatusColor(event.status)}`}>
                                        {event.status}
                                    </span>
                                    <span className={`px-2 py-1 rounded text-xs font-semibold uppercase ${getLocationTypeColor(event.locationType)}`}>
                                        {event.locationType}
                                    </span>
                                </div>
                            </div>

                            {/* Event Content */}
                            <div className="p-6 space-y-4">
                                <div>
                                    <h3 className="text-xl font-bold text-secondary mb-2 line-clamp-1">
                                        {event.title}
                                    </h3>
                                    <p className="text-gray-900 text-sm line-clamp-2">
                                        {event.shortDescription || event.description}
                                    </p>
                                </div>

                                <div className="space-y-2 text-sm">
                                    <div className="flex items-center space-x-2 text-gray-900">
                                        <CalendarIcon className="w-4 h-4" />
                                        <span>{formatDate(event.eventDate)} at {event.eventTime}</span>
                                    </div>
                                    <div className="flex items-center space-x-2 text-gray-900">
                                        <MapPin className="w-4 h-4" />
                                        <span className="line-clamp-1">{event.location}</span>
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-2 text-gray-900">
                                            <Users className="w-4 h-4" />
                                            <span>
                                                {event.currentAttendees || 0}
                                                {event.maxAttendees ? ` / ${event.maxAttendees}` : ''} attendees
                                            </span>
                                        </div>
                                        {event.isPaid && (
                                            <div className="flex items-center space-x-1 text-green-600 font-semibold">
                                                <DollarSign className="w-4 h-4" />
                                                <span>{event.currency} {event.price}</span>
                                            </div>
                                        )}
                                    </div>
                                </div>

                                <div className="flex flex-wrap gap-2">
                                    <span className="px-2 py-0.5 bg-gray-100 text-gray-900 rounded text-xs">
                                        {event.category}
                                    </span>
                                    {event.tags?.slice(0, 2).map((tag, index) => (
                                        <span key={index} className="px-2 py-0.5 bg-blue-50 text-blue-600 rounded text-xs">
                                            {tag}
                                        </span>
                                    ))}
                                </div>

                                {/* Actions */}
                                <div className="flex items-center gap-2 pt-4 border-t border-gray-100">
                                    <button
                                        onClick={() => router.push(`/dashboard/events/${event._id}`)}
                                        className="flex-1 flex items-center justify-center gap-2 px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition text-sm font-medium"
                                    >
                                        <FolderOpen className="w-4 h-4" />
                                        Manage
                                    </button>
                                    <button
                                        onClick={() => handleEdit(event)}
                                        className="p-2 text-green-600 hover:bg-green-50 rounded-lg transition"
                                        title="Edit event"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(event._id)}
                                        disabled={deleting === event._id}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                                        title="Delete event"
                                    >
                                        {deleting === event._id ? (
                                            <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                                        ) : (
                                            <Trash2 className="w-4 h-4" />
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            {/* Event Modal */}
            <EventModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                event={selectedEvent}
                onSuccess={fetchEvents}
            />
        </div>
    );
}
