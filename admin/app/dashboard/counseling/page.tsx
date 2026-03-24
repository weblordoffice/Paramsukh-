'use client';

import { useState, useEffect } from 'react';
import { Plus, Search, Filter, MoreVertical, Calendar, Star, Edit, Trash2 } from 'lucide-react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import CounselingServiceModal from '@/components/CounselingServiceModal';

interface CounselingService {
    _id: string;
    title: string;
    description: string;
    duration: string;
    price: number;
    isFree: boolean;
    color: string;
    bgColor: string;
    icon: string;
    counselorName: string;
    isActive: boolean;
}

export default function CounselingPage() {
    const [services, setServices] = useState<CounselingService[]>([]);
    const [loading, setLoading] = useState(true);
    const [deletingId, setDeletingId] = useState<string | null>(null);
    const [searchQuery, setSearchQuery] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedService, setSelectedService] = useState<CounselingService | null>(null);

    const fetchServices = async () => {
        try {
            const response = await apiClient.get('/api/counseling/services');
            if (response.data.success) {
                setServices(response.data.data.services);
            }
        } catch (error) {
            console.error('Error fetching services:', error);
            toast.error('Failed to load counseling services');
        } finally {
            setLoading(false);
        }
    };

    useEffect(() => {
        fetchServices();
    }, []);

    const handleDelete = async (id: string) => {
        if (!id || deletingId === id) return;
        if (!confirm('Are you sure you want to delete this service?')) return;

        try {
            setDeletingId(id);
            const response = await apiClient.delete(`/api/counseling/admin/services/${id}`);
            toast.success('Service deleted successfully');
            fetchServices();
        } catch (error: any) {
            console.error('Error deleting service:', error);
            toast.error(error.response?.data?.message || 'Failed to delete service');
        } finally {
            setDeletingId(null);
        }
    };

    const toggleStatus = async (service: CounselingService) => {
        try {
            await apiClient.put(`/api/counseling/admin/services/${service._id}`, {
                isActive: !service.isActive
            });
            toast.success(`Service ${service.isActive ? 'deactivated' : 'activated'}`);
            fetchServices();
        } catch (error) {
            console.error('Error updating service status:', error);
            toast.error('Failed to update status');
        }
    };

    const filteredServices = services.filter(service =>
        service.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        service.counselorName.toLowerCase().includes(searchQuery.toLowerCase())
    );

    return (
        <div className="space-y-6">
            {/* Header */}
            <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Counseling Services</h1>
                    <p className="text-gray-500 mt-1">Manage counseling types and offerings</p>
                </div>
                <button
                    onClick={() => {
                        setSelectedService(null);
                        setIsModalOpen(true);
                    }}
                    className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
                >
                    <Plus className="w-5 h-5" />
                    <span>Add Service</span>
                </button>
            </div>

            {/* Filters */}
            <div className="flex flex-col md:flex-row gap-4 bg-white p-4 rounded-xl border border-gray-200 shadow-sm">
                <div className="relative flex-1">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search services..."
                        value={searchQuery}
                        onChange={(e) => setSearchQuery(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    />
                </div>
            </div>

            {/* Services Grid */}
            {loading ? (
                <div className="text-center py-12">
                    <div className="animate-spin w-8 h-8 border-4 border-blue-600 border-t-transparent rounded-full mx-auto mb-4"></div>
                    <p className="text-gray-500">Loading services...</p>
                </div>
            ) : filteredServices.length === 0 ? (
                <div className="text-center py-12 bg-white rounded-xl border border-gray-200 border-dashed">
                    <div className="w-16 h-16 bg-gray-50 rounded-full flex items-center justify-center mx-auto mb-4">
                        <MoreVertical className="w-8 h-8 text-gray-400 opacity-50" />
                    </div>
                    <h3 className="text-lg font-medium text-gray-900 mb-1">No services found</h3>
                    <p className="text-gray-500">Create your first counseling service to get started</p>
                </div>
            ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                    {filteredServices.map((service) => (
                        <div key={service._id} className="bg-white rounded-xl border border-gray-200 shadow-sm overflow-hidden hover:shadow-md transition-shadow group">
                            <div className="p-6">
                                <div className="flex justify-between items-start mb-4">
                                    <div
                                        className="w-12 h-12 rounded-xl flex items-center justify-center"
                                        style={{ backgroundColor: service.bgColor || '#EFF6FF' }}
                                    >
                                        <div className="text-2xl">{service.icon || '🧠'}</div>
                                        {/* If icon is Ionicons name, we can't easily render it here without a library mappings, but we can just show text or map common ones. For now, assuming simple text or maybe just render name if can't render icon. Actually, let's just show a generic icon if it's a string name */}
                                    </div>
                                    <div className="flex gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                        <button
                                            onClick={() => {
                                                setSelectedService(service);
                                                setIsModalOpen(true);
                                            }}
                                            className="p-2 hover:bg-gray-100 rounded-lg text-gray-600"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(service._id)}
                                            disabled={deletingId === service._id}
                                            className="p-2 hover:bg-red-50 rounded-lg text-red-600"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>

                                <h3 className="text-lg font-bold text-gray-900 mb-1">{service.title}</h3>
                                <p className="text-sm text-gray-500 mb-4 line-clamp-2">{service.description}</p>

                                <div className="flex items-center gap-4 text-sm text-gray-600 mb-4">
                                    <div className="flex items-center gap-1">
                                        <Calendar className="w-4 h-4" />
                                        <span>{service.duration}</span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                        <Star className="w-4 h-4" />
                                        <span>{service.counselorName}</span>
                                    </div>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-gray-100">
                                    <div className="font-semibold text-gray-900">
                                        {service.isFree ? 'Free' : `₹${service.price}`}
                                    </div>
                                    <button
                                        onClick={() => toggleStatus(service)}
                                        className={`px-3 py-1 rounded-full text-xs font-medium ${service.isActive
                                                ? 'bg-green-100 text-green-700'
                                                : 'bg-gray-100 text-gray-600'
                                            }`}
                                    >
                                        {service.isActive ? 'Active' : 'Inactive'}
                                    </button>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>
            )}

            <CounselingServiceModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                service={selectedService}
                onSuccess={fetchServices}
            />
        </div>
    );
}
