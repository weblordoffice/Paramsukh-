'use client';

import { useEffect, useState, useCallback } from 'react';
import { useParams, useRouter } from 'next/navigation';
import Image from 'next/image';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { ArrowLeft, Image as ImageIcon, Video, Users } from 'lucide-react';
import PhotosTab from './PhotosTab';
import VideosTab from './VideosTab';
import RegistrationsTab from './RegistrationsTab';

interface Event {
    _id: string;
    title: string;
    description: string;
    thumbnailUrl?: string;
    eventDate: string;
    eventTime: string;
    location: string;
    locationType: string;
    category: string;
    status: string;
    currentAttendees: number;
    maxAttendees?: number;
    images: any[];
    videos: any[];
}

type TabType = 'photos' | 'videos' | 'registrations';

export default function EventDetailsPage() {
    const params = useParams();
    const router = useRouter();
    const eventId = params.id as string;
    
    const [event, setEvent] = useState<Event | null>(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<TabType>('photos');

    const fetchEventDetails = useCallback(async () => {
        try {
            const response = await apiClient.get(`/api/events/${eventId}`);
            setEvent(response.data.event);
        } catch (error) {
            toast.error('Failed to fetch event details');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        if (eventId) {
            fetchEventDetails();
        }
    }, [eventId, fetchEventDetails]);

    const refreshEvent = () => {
        fetchEventDetails();
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center h-screen">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    if (!event) {
        return (
            <div className="p-6">
                <div className="text-center">
                    <p className="text-gray-600">Event not found</p>
                    <button
                        onClick={() => router.push('/dashboard/events')}
                        className="mt-4 text-blue-600 hover:underline"
                    >
                        Back to Events
                    </button>
                </div>
            </div>
        );
    }

    const formatDate = (dateString: string) => {
        return new Date(dateString).toLocaleDateString('en-US', {
            month: 'long',
            day: 'numeric',
            year: 'numeric'
        });
    };

    const tabs = [
        { id: 'photos' as TabType, label: 'Photos', icon: ImageIcon, count: event.images?.length || 0 },
        { id: 'videos' as TabType, label: 'Videos', icon: Video, count: event.videos?.length || 0 },
        { id: 'registrations' as TabType, label: 'Registrations', icon: Users, count: event.currentAttendees || 0 },
    ];

    return (
        <div className="p-6 max-w-7xl mx-auto">
            {/* Header */}
            <div className="mb-6">
                <button
                    onClick={() => router.push('/dashboard/events')}
                    className="flex items-center text-gray-600 hover:text-gray-900 mb-4"
                >
                    <ArrowLeft className="w-5 h-5 mr-2" />
                    Back to Events
                </button>

                <div className="bg-white rounded-lg shadow-sm p-6">
                    <div className="flex items-start gap-4">
                        {event.thumbnailUrl ? (
                            <div className="relative w-32 h-32 rounded-lg overflow-hidden">
                                <Image
                                    src={event.thumbnailUrl}
                                    alt={event.title}
                                    fill
                                    unoptimized
                                    className="object-cover"
                                />
                            </div>
                        ) : (
                            <div className="w-32 h-32 bg-gradient-to-br from-blue-500 to-purple-600 rounded-lg flex items-center justify-center">
                                <span className="text-5xl">📅</span>
                            </div>
                        )}
                        <div className="flex-1">
                            <h1 className="text-2xl font-bold text-gray-900 mb-2">{event.title}</h1>
                            <p className="text-gray-600 mb-3 line-clamp-2">{event.description}</p>
                            <div className="flex flex-wrap items-center gap-4 text-sm">
                                <span className="px-3 py-1 bg-blue-100 text-blue-700 rounded-full">
                                    {event.status}
                                </span>
                                <span className="px-3 py-1 bg-purple-100 text-purple-700 rounded-full">
                                    {event.locationType}
                                </span>
                                <span className="text-gray-500">
                                    📅 {formatDate(event.eventDate)} at {event.eventTime}
                                </span>
                                <span className="text-gray-500">
                                    📍 {event.location}
                                </span>
                                <span className="text-gray-500">
                                    🏷️ {event.category}
                                </span>
                                <span className="text-gray-500">
                                    👥 {event.currentAttendees || 0}
                                    {event.maxAttendees ? ` / ${event.maxAttendees}` : ''} attendees
                                </span>
                            </div>
                        </div>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="bg-white rounded-lg shadow-sm">
                <div className="border-b border-gray-200">
                    <div className="flex gap-8 px-6">
                        {tabs.map((tab) => {
                            const Icon = tab.icon;
                            return (
                                <button
                                    key={tab.id}
                                    onClick={() => setActiveTab(tab.id)}
                                    className={`flex items-center gap-2 py-4 border-b-2 transition-colors ${
                                        activeTab === tab.id
                                            ? 'border-blue-600 text-blue-600'
                                            : 'border-transparent text-gray-600 hover:text-gray-900'
                                    }`}
                                >
                                    <Icon className="w-5 h-5" />
                                    <span className="font-medium">{tab.label}</span>
                                    <span className={`px-2 py-0.5 rounded-full text-xs ${
                                        activeTab === tab.id
                                            ? 'bg-blue-100 text-blue-700'
                                            : 'bg-gray-100 text-gray-600'
                                    }`}>
                                        {tab.count}
                                    </span>
                                </button>
                            );
                        })}
                    </div>
                </div>

                {/* Tab Content */}
                <div className="p-6">
                    {activeTab === 'photos' && (
                        <PhotosTab eventId={eventId} photos={event.images || []} onUpdate={refreshEvent} />
                    )}
                    {activeTab === 'videos' && (
                        <VideosTab eventId={eventId} videos={event.videos || []} onUpdate={refreshEvent} />
                    )}
                    {activeTab === 'registrations' && (
                        <RegistrationsTab eventId={eventId} />
                    )}
                </div>
            </div>
        </div>
    );
}
