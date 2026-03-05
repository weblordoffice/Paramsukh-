'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Search, Plus, Edit, Trash2, Mic, PlayCircle } from 'lucide-react';
import Image from 'next/image';
import PodcastModal from '@/components/PodcastModal';

interface Podcast {
    _id: string;
    title: string;
    description: string;
    host: string;
    videoUrl: string;
    thumbnailUrl: string;
    duration: string;
    category: string;
    createdAt: string;
}

export default function PodcastsPage() {
    const [podcasts, setPodcasts] = useState<Podcast[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedPodcast, setSelectedPodcast] = useState<Podcast | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);

    useEffect(() => {
        fetchPodcasts();
    }, []);

    const fetchPodcasts = async () => {
        try {
            const response = await apiClient.get('/api/podcasts');
            if (response.data && response.data.success) {
                setPodcasts(response.data.data.podcasts || []);
            }
        } catch (error) {
            console.error('Error fetching podcasts:', error);
            toast.error('Failed to fetch podcasts');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setSelectedPodcast(null);
        setIsModalOpen(true);
    };

    const handleEdit = (podcast: Podcast) => {
        setSelectedPodcast(podcast);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this podcast?')) return;

        setDeleting(id);
        try {
            await apiClient.delete(`/api/podcasts/admin/${id}`);
            toast.success('Podcast deleted successfully');
            fetchPodcasts();
        } catch (error: any) {
            console.error('Error deleting podcast:', error);
            toast.error(error.response?.data?.message || 'Failed to delete podcast');
        } finally {
            setDeleting(null);
        }
    };

    const filteredPodcasts = podcasts.filter(podcast =>
        podcast.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        podcast.host.toLowerCase().includes(searchTerm.toLowerCase())
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
                    <h1 className="text-3xl font-bold text-gray-800">Podcasts Management</h1>
                    <p className="text-gray-500 mt-1">Manage audio content and meditations</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition duration-200 font-medium shadow-md"
                >
                    <Plus className="w-5 h-5" />
                    <span>Create Podcast</span>
                </button>
            </div>

            {/* Search Bar */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search podcasts by title or host..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition"
                    />
                </div>
            </div>

            {/* Podcasts Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredPodcasts.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                        <Mic className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-lg font-medium">No podcasts found</p>
                        <p className="text-sm">Create a new podcast to get started</p>
                    </div>
                ) : (
                    filteredPodcasts.map((podcast) => (
                        <div
                            key={podcast._id}
                            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-300 group"
                        >
                            {/* Thumbnail */}
                            <div className="relative h-48 bg-gray-100">
                                {podcast.thumbnailUrl ? (
                                    <Image
                                        src={podcast.thumbnailUrl}
                                        alt={podcast.title}
                                        fill
                                        className="object-cover group-hover:scale-105 transition-transform duration-500"
                                    />
                                ) : (
                                    <div className="flex items-center justify-center h-full bg-slate-100 text-slate-400">
                                        <Mic className="w-12 h-12" />
                                    </div>
                                )}
                                <div className="absolute inset-0 bg-black/0 group-hover:bg-black/10 transition-colors duration-300" />
                                <div className="absolute top-3 right-3">
                                    <span className="px-2 py-1 rounded text-xs font-semibold bg-white/90 text-gray-800 shadow-sm backdrop-blur-sm">
                                        {podcast.category}
                                    </span>
                                </div>
                            </div>

                            {/* Content */}
                            <div className="p-5">
                                <div className="mb-4">
                                    <h3 className="text-lg font-bold text-gray-800 mb-1 line-clamp-1">{podcast.title}</h3>
                                    <p className="text-sm text-gray-500 font-medium mb-2">{podcast.host}</p>
                                    <p className="text-gray-600 text-sm line-clamp-2 min-h-[40px]">{podcast.description}</p>
                                </div>

                                <div className="flex items-center justify-between pt-4 border-t border-gray-50">
                                    <div className="flex items-center gap-1.5 text-xs text-gray-500 font-medium bg-gray-50 px-2 py-1 rounded">
                                        <PlayCircle className="w-3.5 h-3.5" />
                                        {podcast.duration}
                                    </div>

                                    <div className="flex items-center gap-2">
                                        <button
                                            onClick={() => handleEdit(podcast)}
                                            className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                            title="Edit"
                                        >
                                            <Edit className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDelete(podcast._id)}
                                            disabled={deleting === podcast._id}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                            title="Delete"
                                        >
                                            {deleting === podcast._id ? (
                                                <div className="w-4 h-4 border-2 border-red-600 border-t-transparent rounded-full animate-spin" />
                                            ) : (
                                                <Trash2 className="w-4 h-4" />
                                            )}
                                        </button>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>

            <PodcastModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                podcast={selectedPodcast}
                onSuccess={fetchPodcasts}
            />
        </div>
    );
}
