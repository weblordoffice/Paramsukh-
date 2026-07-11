'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Search, Plus, Edit, Trash2, FileText, Calendar, User } from 'lucide-react';
import Image from 'next/image';
import BlogModal from '@/components/BlogModal';

interface Blog {
    _id: string;
    title: string;
    content: string;
    imageUrl?: string;
    author: string;
    createdAt: string;
}

export default function BlogsPage() {
    const [blogs, setBlogs] = useState<Blog[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [isModalOpen, setIsModalOpen] = useState(false);
    const [selectedBlog, setSelectedBlog] = useState<Blog | null>(null);
    const [deleting, setDeleting] = useState<string | null>(null);

    useEffect(() => {
        fetchBlogs();
    }, []);

    const fetchBlogs = async () => {
        try {
            const response = await apiClient.get('/api/blogs');
            if (response.data && response.data.success) {
                setBlogs(response.data.data.blogs || []);
            }
        } catch (error) {
            console.error('Error fetching blogs:', error);
            toast.error('Failed to fetch blogs');
        } finally {
            setLoading(false);
        }
    };

    const handleCreate = () => {
        setSelectedBlog(null);
        setIsModalOpen(true);
    };

    const handleEdit = (blog: Blog) => {
        setSelectedBlog(blog);
        setIsModalOpen(true);
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this blog post?')) return;

        setDeleting(id);
        try {
            await apiClient.delete(`/api/blogs/admin/${id}`);
            toast.success('Blog deleted successfully');
            fetchBlogs();
        } catch (error: any) {
            console.error('Error deleting blog:', error);
            toast.error(error.response?.data?.message || 'Failed to delete blog');
        } finally {
            setDeleting(null);
        }
    };

    const filteredBlogs = blogs.filter(blog =>
        blog.title.toLowerCase().includes(searchTerm.toLowerCase()) ||
        blog.author.toLowerCase().includes(searchTerm.toLowerCase())
    );

    const formatDate = (dateStr: string) => {
        try {
            return new Date(dateStr).toLocaleDateString('en-US', {
                year: 'numeric',
                month: 'short',
                day: 'numeric'
            });
        } catch {
            return dateStr;
        }
    };

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
                    <h1 className="text-3xl font-bold text-gray-800">Blogs Management</h1>
                    <p className="text-gray-500 mt-1">Write and publish articles for the home tab</p>
                </div>
                <button
                    onClick={handleCreate}
                    className="flex items-center gap-2 px-6 py-3 bg-blue-600 hover:bg-blue-700 text-white rounded-lg transition duration-200 font-medium shadow-md"
                >
                    <Plus className="w-5 h-5" />
                    <span>Create Blog Post</span>
                </button>
            </div>

            {/* Search Bar */}
            <div className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search blogs by title or author..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-200 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition text-black"
                    />
                </div>
            </div>

            {/* Blogs List/Grid */}
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {filteredBlogs.length === 0 ? (
                    <div className="col-span-full flex flex-col items-center justify-center py-16 text-gray-400 bg-white rounded-2xl border border-dashed border-gray-200">
                        <FileText className="w-16 h-16 mb-4 opacity-50" />
                        <p className="text-lg font-medium">No blogs found</p>
                        <p className="text-sm">Write a new blog post to publish it</p>
                    </div>
                ) : (
                    filteredBlogs.map((blog) => (
                        <div
                            key={blog._id}
                            className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden hover:shadow-md transition-shadow duration-300 flex flex-col justify-between"
                        >
                            <div>
                                {/* Cover Image */}
                                <div className="relative h-48 bg-gray-100 w-full">
                                    {blog.imageUrl ? (
                                        <Image
                                            src={blog.imageUrl}
                                            alt={blog.title}
                                            fill
                                            className="object-cover"
                                            unoptimized
                                        />
                                    ) : (
                                        <div className="flex items-center justify-center h-full bg-slate-100 text-slate-400">
                                            <FileText className="w-12 h-12" />
                                        </div>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="p-5">
                                    <h3 className="text-lg font-bold text-gray-800 mb-2 line-clamp-1">{blog.title}</h3>
                                    
                                    <div className="flex items-center gap-4 text-xs text-gray-500 mb-3">
                                        <span className="flex items-center gap-1.5 font-medium">
                                            <User className="w-3.5 h-3.5" />
                                            {blog.author}
                                        </span>
                                        <span className="flex items-center gap-1.5">
                                            <Calendar className="w-3.5 h-3.5" />
                                            {formatDate(blog.createdAt)}
                                        </span>
                                    </div>

                                    <p className="text-gray-600 text-sm line-clamp-3 min-h-[60px] whitespace-pre-line">
                                        {blog.content}
                                    </p>
                                </div>
                            </div>

                            {/* Actions */}
                            <div className="p-5 pt-0">
                                <div className="flex items-center justify-end gap-2 border-t border-gray-50 pt-4">
                                    <button
                                        onClick={() => handleEdit(blog)}
                                        className="p-2 text-blue-600 hover:bg-blue-50 rounded-lg transition-colors border border-transparent hover:border-blue-100"
                                        title="Edit"
                                    >
                                        <Edit className="w-4 h-4" />
                                    </button>
                                    <button
                                        onClick={() => handleDelete(blog._id)}
                                        disabled={deleting === blog._id}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition-colors border border-transparent hover:border-red-100"
                                        title="Delete"
                                    >
                                        {deleting === blog._id ? (
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

            <BlogModal
                isOpen={isModalOpen}
                onClose={() => setIsModalOpen(false)}
                blog={selectedBlog}
                onSuccess={fetchBlogs}
            />
        </div>
    );
}
