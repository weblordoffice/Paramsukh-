import { create } from 'zustand';
import axios from 'axios';
import { API_URL } from '../config/api';
import { useAuthStore } from './authStore';

export interface EventPhoto {
    id: string;
    url: string;
    thumbnailUrl?: string;
    caption?: string;
}

export interface EventVideo {
    id: string;
    url: string;
    thumbnailUrl?: string; // YouTube thumbnail
    title?: string;
    description?: string;
    duration?: string;
}

export interface Event {
    _id: string;
    title: string;
    description: string;
    shortDescription?: string;
    icon: string;
    color: string;
    emoji: string;
    thumbnailUrl?: string;
    bannerUrl?: string;
    eventDate: string; // ISO string
    eventTime: string;
    startTime: string; // ISO string
    location: string;
    locationType?: 'physical' | 'online' | 'hybrid';
    address?: {
        street?: string;
        city?: string;
        state?: string;
        zipCode?: string;
        country?: string;
    };
    onlineMeetingLink?: string | null;
    category: string;
    isPaid: boolean;
    price: number;
    currency?: string;
    earlyBirdPrice?: number | null;
    earlyBirdEndDate?: string | null;
    attendees?: number; // mapped from currentAttendees
    currentAttendees: number;
    maxAttendees?: number | null;
    registrationRequired?: boolean;
    registrationDeadline?: string | null;
    status?: 'upcoming' | 'ongoing' | 'past' | 'cancelled';
    isActive?: boolean;
    organizer?: string | null;
    requirements?: string[];
    whatToBring?: string[];
    additionalInfo?: string;
    images: { _id?: string; url: string; caption: string }[];
    videos: { _id?: string; type?: 'youtube' | 'local'; url: string; title: string; description: string; thumbnailUrl: string }[];
    hasRecording: boolean;
    imageCount: number;
    notificationEnabled: boolean;
    isRegistered?: boolean;
    hasAttended?: boolean;
    // ... other fields as needed
}

export interface EventMeta {
    currentPrice: number;
    canRegister: boolean;
    isFull: boolean;
    spotsLeft: number | null;
}

interface EventState {
    events: Event[];
    currentEvent: Event | null;
    currentEventMeta: EventMeta | null;
    photos: EventPhoto[];
    videos: EventVideo[];
    isLoading: boolean;
    isCheckingRegistration: boolean;
    error: string | null;

    fetchEvents: (tab: 'upcoming' | 'past') => Promise<void>;
    fetchEventDetails: (eventId: string) => Promise<void>;
    fetchEventPhotos: (eventId: string) => Promise<void>;
    fetchEventVideos: (eventId: string) => Promise<void>;
    registerForEvent: (eventId: string, payload?: {
        name?: string;
        email?: string;
        phone?: string;
        notes?: string;
        simulatePayment?: boolean;
        paymentId?: string;
    }) => Promise<{
        success: boolean;
        message?: string;
        paymentRequired?: boolean;
        paymentAmount?: number;
    }>;
    createEventOrder: (eventId: string, payload: { name?: string; email?: string; phone?: string; notes?: string }) => Promise<{ success: boolean; data?: { registrationId: string; razorpay: { orderId: string; amount: number; currency: string; keyId: string } }; message?: string }>;
    createEventPaymentLink: (eventId: string, payload: { name?: string; email?: string; phone?: string; notes?: string }) => Promise<{ success: boolean; url?: string; paymentLinkId?: string; registrationId?: string; message?: string }>;
    confirmEventPaymentByLink: (eventId: string, paymentLinkId: string) => Promise<{ success: boolean; message?: string }>;
    confirmEventPayment: (eventId: string, paymentData: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => Promise<{ success: boolean; message?: string }>;
    cancelEventRegistration: (eventId: string) => Promise<boolean>;
    checkRegistrationStatus: (eventId: string) => Promise<boolean>;
}

export const useEventStore = create<EventState>((set, get) => ({
    events: [],
    currentEvent: null,
    currentEventMeta: null,
    photos: [],
    videos: [],
    isLoading: false,
    isCheckingRegistration: false,
    error: null,

    fetchEvents: async (tab: 'upcoming' | 'past') => {
        set({ isLoading: true, error: null });
        try {
            // Use the convenience endpoints from the backend
            const endpoint = tab === 'upcoming' ? `${API_URL}/events/upcoming` : `${API_URL}/events/past`;
            const response = await axios.get(endpoint);

            if (response.data && response.data.success) {
                let mappedEvents = response.data.events.map((e: any) => ({
                    ...e,
                    attendees: e.currentAttendees || 0,
                    id: e._id
                }));

                // Fetch user registrations to sync state globally
                const token = useAuthStore.getState().token;
                if (token) {
                    try {
                        const regResponse = await axios.get(`${API_URL}/events/my-registrations?${tab}=true`, {
                            headers: { Authorization: `Bearer ${token}` }
                        });
                        if (regResponse.data?.success) {
                            const registeredEventsMap = new Map();
                            regResponse.data.registrations.forEach((r: any) => {
                                const eId = r.eventId?._id || r.eventId;
                                registeredEventsMap.set(eId, r);
                            });
                            mappedEvents = mappedEvents.map((e: any) => {
                                const reg = registeredEventsMap.get(e._id);
                                return {
                                    ...e,
                                    isRegistered: !!reg,
                                    hasAttended: reg?.status === 'attended' || reg?.checkedIn === true
                                };
                            });
                        }
                    } catch (regError) {
                    }
                }

                set({ events: mappedEvents, isLoading: false });
            } else {
                set({ events: [], isLoading: false, error: null });
            }
        } catch (error: any) {
            // Don't show error to user, show empty list
            set({ events: [], isLoading: false, error: null });
        }
    },

    fetchEventDetails: async (eventId: string) => {
        set({ isLoading: true, error: null });
        try {
            const response = await axios.get(`${API_URL}/events/${eventId}`);
            if (response.data.success) {
                const event = response.data.event;
                const meta = response.data.meta || null;

                // Map images to EventPhoto interface
                const photos: EventPhoto[] = (event.images || []).map((img: any, index: number) => ({
                    id: img._id || `img-${index}`,
                    url: img.url,
                    thumbnailUrl: img.url,
                    caption: img.caption
                }));

                // Map videos to EventVideo interface
                const videos: EventVideo[] = (event.videos || []).map((vid: any, index: number) => ({
                    id: vid._id || `vid-${index}`,
                    url: vid.url,
                    title: vid.title,
                    description: vid.description,
                    thumbnailUrl: vid.thumbnailUrl
                }));

                // Preserve isRegistered state if we already know it from the list or a parallel check
                const state = get();
                const existingEventInList = state.events.find(e => e._id === eventId);
                const isAlreadyRegistered = state.currentEvent?._id === eventId 
                    ? state.currentEvent.isRegistered 
                    : (existingEventInList?.isRegistered || false);
                const hasAlreadyAttended = state.currentEvent?._id === eventId
                    ? state.currentEvent.hasAttended
                    : (existingEventInList?.hasAttended || false);

                if (isAlreadyRegistered) {
                    event.isRegistered = true;
                    event.hasAttended = hasAlreadyAttended;
                }

                set({ currentEvent: event, currentEventMeta: meta, photos, videos, isLoading: false });
            } else {
                set({ isLoading: false, error: 'Failed to fetch event details' });
            }
        } catch (error: any) {
            set({ isLoading: false, error: 'Failed to load event' });
        }
    },

    fetchEventPhotos: async (eventId: string) => {
        await get().fetchEventDetails(eventId);
    },

    fetchEventVideos: async (eventId: string) => {
        await get().fetchEventDetails(eventId);
    },

    registerForEvent: async (eventId: string, payload = {}) => {
        try {
            const token = useAuthStore.getState().token;
            if (!token) {
                return { success: false, message: 'Please sign in to register for events.' };
            }

            const response = await axios.post(
                `${API_URL}/events/${eventId}/register`,
                payload,
                { headers: { Authorization: `Bearer ${token}` } }
            );

            if (response.data?.success) {
                set((state) => ({
                    events: state.events.map((event) =>
                        event._id === eventId
                            ? {
                                ...event,
                                isRegistered: true,
                                currentAttendees: (event.currentAttendees || 0) + 1
                            }
                            : event
                    ),
                    currentEvent:
                        state.currentEvent?._id === eventId
                            ? {
                                ...state.currentEvent,
                                isRegistered: true,
                                currentAttendees: (state.currentEvent.currentAttendees || 0) + 1
                            }
                            : state.currentEvent
                }));

                return {
                    success: true,
                    message: response.data.message,
                    paymentRequired: response.data.paymentRequired,
                    paymentAmount: response.data.paymentAmount
                };
            }

            return { success: false, message: response.data?.message || 'Registration failed' };
        } catch (error: any) {
            return {
                success: false,
                message: error.response?.data?.message || 'Registration failed'
            };
        }
    },

    createEventOrder: async (eventId: string, payload: { name?: string; email?: string; phone?: string; notes?: string }) => {
        try {
            const token = useAuthStore.getState().token;
            if (!token) return { success: false, message: 'Please sign in to register.' };
            const response = await axios.post(
                `${API_URL}/events/${eventId}/register/order`,
                payload,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (response.data?.success && response.data?.data)
                return { success: true, data: response.data.data, message: response.data.message };
            return { success: false, message: response.data?.message || 'Failed to create order' };
        } catch (error: any) {
            return { success: false, message: error.response?.data?.message || 'Failed to create order' };
        }
    },

    confirmEventPayment: async (eventId: string, paymentData: { razorpay_payment_id: string; razorpay_order_id: string; razorpay_signature: string }) => {
        try {
            const token = useAuthStore.getState().token;
            if (!token) return { success: false, message: 'Please sign in.' };
            const response = await axios.post(
                `${API_URL}/events/${eventId}/register/confirm`,
                paymentData,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (response.data?.success) {
                set((state) => ({
                    events: state.events.map((e) => (e._id === eventId ? { ...e, isRegistered: true, currentAttendees: (e.currentAttendees || 0) + 1 } : e)),
                    currentEvent: state.currentEvent?._id === eventId
                        ? { ...state.currentEvent, isRegistered: true, currentAttendees: (state.currentEvent.currentAttendees || 0) + 1 }
                        : state.currentEvent
                }));
                return { success: true, message: response.data.message };
            }
            return { success: false, message: response.data?.message || 'Payment confirmation failed' };
        } catch (error: any) {
            return { success: false, message: error.response?.data?.message || 'Payment confirmation failed' };
        }
    },

    createEventPaymentLink: async (eventId: string, payload: { name?: string; email?: string; phone?: string; notes?: string }) => {
        try {
            const token = useAuthStore.getState().token;
            if (!token) return { success: false, message: 'Please sign in to register.' };
            const response = await axios.post(
                `${API_URL}/events/${eventId}/register/link`,
                payload,
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (response.data?.success && response.data?.data)
                return {
                    success: true,
                    url: response.data.data.url,
                    paymentLinkId: response.data.data.paymentLinkId,
                    registrationId: response.data.data.registrationId,
                };
            return { success: false, message: response.data?.message || 'Failed to create payment link' };
        } catch (error: any) {
            return { success: false, message: error.response?.data?.message || 'Failed to create payment link' };
        }
    },

    confirmEventPaymentByLink: async (eventId: string, paymentLinkId: string) => {
        try {
            const token = useAuthStore.getState().token;
            if (!token) return { success: false, message: 'Please sign in.' };
            const response = await axios.post(
                `${API_URL}/events/${eventId}/register/confirm-link`,
                { paymentLinkId },
                { headers: { Authorization: `Bearer ${token}` } }
            );
            if (response.data?.success) {
                set((state) => ({
                    events: state.events.map((e) => (e._id === eventId ? { ...e, isRegistered: true, currentAttendees: (e.currentAttendees || 0) + 1 } : e)),
                    currentEvent: state.currentEvent?._id === eventId
                        ? { ...state.currentEvent, isRegistered: true, currentAttendees: (state.currentEvent.currentAttendees || 0) + 1 }
                        : state.currentEvent
                }));
                return { success: true, message: response.data.message };
            }
            return { success: false, message: response.data?.message || 'Payment confirmation failed' };
        } catch (error: any) {
            return { success: false, message: error.response?.data?.message || 'Payment confirmation failed' };
        }
    },

    cancelEventRegistration: async (eventId: string) => {
        try {
            const token = useAuthStore.getState().token;
            if (!token) return false;

            const response = await axios.delete(`${API_URL}/events/${eventId}/register`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            if (response.data?.success) {
                set((state) => ({
                    events: state.events.map((event) =>
                        event._id === eventId
                            ? {
                                ...event,
                                isRegistered: false,
                                currentAttendees: Math.max(0, (event.currentAttendees || 0) - 1)
                            }
                            : event
                    ),
                    currentEvent:
                        state.currentEvent?._id === eventId
                            ? {
                                ...state.currentEvent,
                                isRegistered: false,
                                currentAttendees: Math.max(0, (state.currentEvent.currentAttendees || 0) - 1)
                            }
                            : state.currentEvent
                }));
                return true;
            }
            return false;
        } catch (error: any) {
            return false;
        }
    },

    checkRegistrationStatus: async (eventId: string) => {
        set({ isCheckingRegistration: true });
        try {
            const token = useAuthStore.getState().token;
            if (!token) {
                set({ isCheckingRegistration: false });
                return false;
            }

            const response = await axios.get(`${API_URL}/events/${eventId}/registration-status`, {
                headers: { Authorization: `Bearer ${token}` }
            });

            const isRegistered = !!response.data?.isRegistered;
            const regData = response.data?.registration;
            const hasAttended = regData?.status === 'attended' || regData?.checkedIn === true;

            set((state) => ({
                isCheckingRegistration: false,
                events: state.events.map((event) =>
                    event._id === eventId ? { ...event, isRegistered, hasAttended } : event
                ),
                currentEvent:
                    state.currentEvent?._id === eventId
                        ? { ...state.currentEvent, isRegistered, hasAttended }
                        : state.currentEvent
            }));
            return isRegistered;
        } catch (error: any) {
            set({ isCheckingRegistration: false });
            return false;
        }
    }
}));
