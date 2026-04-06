'use client';

import { useEffect, useState, useCallback } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Search, Users, CheckCircle, XCircle, Clock, Download, Mail, Phone } from 'lucide-react';

interface Registration {
    _id: string;
    participantName?: string;
    participantEmail?: string;
    participantPhone?: string;
    userId?: {
        _id: string;
        displayName?: string;
        email?: string;
        phone?: string;
    };
    status: 'confirmed' | 'pending' | 'cancelled' | 'attended' | 'no-show';
    checkedIn?: boolean;
    checkedInAt?: string;
    paymentStatus?: 'completed' | 'pending' | 'failed' | 'refunded';
    paymentAmount?: number;
    registeredAt: string;
}

interface RegistrationsTabProps {
    eventId: string;
}

export default function RegistrationsTab({ eventId }: RegistrationsTabProps) {
    const [registrations, setRegistrations] = useState<Registration[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    const fetchRegistrations = useCallback(async () => {
        try {
            const response = await apiClient.get(`/api/events/${eventId}/registrations`);
            setRegistrations(response.data.registrations || []);
        } catch (error) {
            toast.error('Failed to fetch registrations');
            console.error(error);
        } finally {
            setLoading(false);
        }
    }, [eventId]);

    useEffect(() => {
        fetchRegistrations();
    }, [eventId, fetchRegistrations]);

    const handleCheckIn = async (registrationId: string) => {
        try {
            await apiClient.patch(`/api/events/${eventId}/registrations/${registrationId}/checkin`);
            toast.success('User checked in successfully');
            fetchRegistrations();
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to check in user');
            console.error(error);
        }
    };

    const exportToCSV = () => {
        const headers = ['Name', 'Email', 'Phone', 'Status', 'Payment Status', 'Attended', 'Registered At', 'Check-in Time'];
        const rows = filteredRegistrations.map(reg => [
            reg.participantName || reg.userId?.displayName || 'N/A',
            reg.participantEmail || reg.userId?.email || 'N/A',
            reg.participantPhone || reg.userId?.phone || 'N/A',
            reg.status,
            reg.paymentStatus || 'N/A',
            reg.checkedIn || reg.status === 'attended' ? 'Yes' : 'No',
            new Date(reg.registeredAt).toLocaleString(),
            reg.checkedInAt ? new Date(reg.checkedInAt).toLocaleString() : 'N/A'
        ]);

        const csvContent = [
            headers.join(','),
            ...rows.map(row => row.map(cell => `\"${cell}\"`).join(','))
        ].join('\n');

        const blob = new Blob([csvContent], { type: 'text/csv' });
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = `event-registrations-${eventId}.csv`;
        a.click();
        window.URL.revokeObjectURL(url);
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'confirmed': return 'bg-green-100 text-green-800';
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'cancelled': return 'bg-red-100 text-red-800';
            case 'attended': return 'bg-blue-100 text-blue-800';
            case 'no-show': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getPaymentStatusColor = (status?: string) => {
        switch (status) {
            case 'completed': return 'bg-green-100 text-green-800';
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'failed': return 'bg-red-100 text-red-800';
            case 'refunded': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const filteredRegistrations = registrations.filter(reg => {
        const matchesSearch = 
            reg.participantName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            reg.participantEmail?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            reg.userId?.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
            reg.userId?.email?.toLowerCase().includes(searchTerm.toLowerCase());
        
        const matchesStatus = filterStatus === 'all' || reg.status === filterStatus;

        return matchesSearch && matchesStatus;
    });

    const stats = {
        total: registrations.length,
        confirmed: registrations.filter(r => r.status === 'confirmed').length,
        attended: registrations.filter(r => r.checkedIn || r.status === 'attended').length,
        pending: registrations.filter(r => r.status === 'pending').length
    };

    if (loading) {
        return (
            <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
            </div>
        );
    }

    return (
        <div>
            {/* Header with Stats */}
            <div className="mb-6">
                <div className="flex justify-between items-center mb-4">
                    <div>
                        <h2 className="text-xl font-semibold text-gray-900">Event Registrations</h2>
                        <p className="text-sm text-gray-600 mt-1">
                            Manage attendee registrations and check-ins
                        </p>
                    </div>
                    <button
                        onClick={exportToCSV}
                        disabled={filteredRegistrations.length === 0}
                        className="flex items-center gap-2 px-4 py-2 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                        <Download className="w-4 h-4" />
                        Export CSV
                    </button>
                </div>

                {/* Stats Cards */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                    <div className="bg-blue-50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-blue-600 font-medium">Total</p>
                                <p className="text-2xl font-bold text-blue-900">{stats.total}</p>
                            </div>
                            <Users className="w-8 h-8 text-blue-600" />
                        </div>
                    </div>

                    <div className="bg-green-50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-green-600 font-medium">Confirmed</p>
                                <p className="text-2xl font-bold text-green-900">{stats.confirmed}</p>
                            </div>
                            <CheckCircle className="w-8 h-8 text-green-600" />
                        </div>
                    </div>

                    <div className="bg-purple-50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-purple-600 font-medium">Attended</p>
                                <p className="text-2xl font-bold text-purple-900">{stats.attended}</p>
                            </div>
                            <CheckCircle className="w-8 h-8 text-purple-600" />
                        </div>
                    </div>

                    <div className="bg-yellow-50 rounded-lg p-4">
                        <div className="flex items-center justify-between">
                            <div>
                                <p className="text-sm text-yellow-600 font-medium">Pending</p>
                                <p className="text-2xl font-bold text-yellow-900">{stats.pending}</p>
                            </div>
                            <Clock className="w-8 h-8 text-yellow-600" />
                        </div>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="bg-white rounded-lg border border-gray-200 p-4 mb-6">
                <div className="flex flex-col md:flex-row gap-4">
                    <div className="flex-1 relative">
                        <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search by name or email..."
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        />
                    </div>
                    <div className="w-full md:w-48">
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
                        >
                            <option value="all">All Status</option>
                            <option value="confirmed">Confirmed</option>
                            <option value="pending">Pending</option>
                            <option value="cancelled">Cancelled</option>
                            <option value="attended">Attended</option>
                            <option value="no-show">No-Show</option>
                        </select>
                    </div>
                </div>
            </div>

            {/* Registrations List */}
            {filteredRegistrations.length === 0 ? (
                <div className="text-center py-12 bg-gray-50 rounded-lg">
                    <Users className="w-12 h-12 text-gray-400 mx-auto mb-3" />
                    <p className="text-gray-600">No registrations found</p>
                </div>
            ) : (
                <div className="bg-white rounded-lg border border-gray-200 overflow-hidden">
                    <div className="overflow-x-auto">
                        <table className="w-full">
                            <thead className="bg-gray-50 border-b border-gray-200">
                                <tr>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Attendee
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Contact
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Status
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Payment
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Registered
                                    </th>
                                    <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                                        Actions
                                    </th>
                                </tr>
                            </thead>
                            <tbody className="bg-white divide-y divide-gray-200">
                                {filteredRegistrations.map((registration) => (
                                    <tr key={registration._id} className="hover:bg-gray-50">
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <div className="flex items-center">
                                                <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                                                    <span className="text-blue-600 font-semibold">
                                                        {(registration.participantName || registration.userId?.displayName || 'U')?.charAt(0).toUpperCase()}
                                                    </span>
                                                </div>
                                                <div className="ml-4">
                                                    <div className="text-sm font-medium text-gray-900">
                                                        {registration.participantName || registration.userId?.displayName || 'Unknown'}
                                                    </div>
                                                    {(registration.checkedIn || registration.status === 'attended') && (
                                                        <div className="text-xs text-green-600 flex items-center gap-1">
                                                            <CheckCircle className="w-3 h-3" />
                                                            Checked In
                                                        </div>
                                                    )}
                                                </div>
                                            </div>
                                        </td>
                                        <td className="px-6 py-4">
                                            <div className="text-sm text-gray-900 flex items-center gap-2">
                                                <Mail className="w-4 h-4 text-gray-400" />
                                                {registration.participantEmail || registration.userId?.email || 'N/A'}
                                            </div>
                                            {(registration.participantPhone || registration.userId?.phone) && (
                                                <div className="text-sm text-gray-500 flex items-center gap-2 mt-1">
                                                    <Phone className="w-4 h-4 text-gray-400" />
                                                    {registration.participantPhone || registration.userId?.phone}
                                                </div>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getStatusColor(registration.status)}`}>
                                                {registration.status}
                                            </span>
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap">
                                            {registration.paymentAmount === 0 || registration.paymentAmount === undefined ? (
                                                <span className="text-sm text-gray-500">Free</span>
                                            ) : registration.paymentStatus ? (
                                                <span className={`px-2 py-1 inline-flex text-xs leading-5 font-semibold rounded-full ${getPaymentStatusColor(registration.paymentStatus)}`}>
                                                    {registration.paymentStatus}
                                                </span>
                                            ) : (
                                                <span className="text-sm text-gray-500">Free</span>
                                            )}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm text-gray-500">
                                            {new Date(registration.registeredAt).toLocaleDateString()}
                                        </td>
                                        <td className="px-6 py-4 whitespace-nowrap text-sm">
                                            {!(registration.checkedIn || registration.status === 'attended') && registration.status === 'confirmed' && (
                                                <button
                                                    onClick={() => handleCheckIn(registration._id)}
                                                    className="text-blue-600 hover:text-blue-900 font-medium"
                                                >
                                                    Check In
                                                </button>
                                            )}
                                        </td>
                                    </tr>
                                ))}
                            </tbody>
                        </table>
                    </div>
                </div>
            )}
        </div>
    );
}
