'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Search, MessageSquare, Heart, MessageCircle, Trash2, Pin } from 'lucide-react';

interface Post {
    _id: string;
    userId: { displayName: string };
    content: string;
    groupId: { name: string };
    likeCount: number;
    commentCount: number;
    isPinned: boolean;            
    createdAt: string;
}

export default function CommunityPage() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');

    useEffect(() => {
        fetchPosts();
    }, []);

    const fetchPosts = async () => {
        try {
            const response = await apiClient.get('/api/community/all');
            setPosts(response.data.data?.posts || response.data.posts || response.data || []);
        } catch (error: any) {
            // Only show error for server errors, not for empty data
            if (error.response?.status !== 404) {
                console.error('Error fetching community posts:', error);
                if (error.response?.status >= 500) {
                    toast.error('Server error. Please try again later.');
                }
            }
            setPosts([]);    
        } finally {
            setLoading(false);
        }
    };

    const handleDeletePost = async (postId: string) => {
        if (!confirm('Are you sure you want to delete this post? This action cannot be undone.')) {
            return;
        }

        try {
            await apiClient.delete(`/api/community/posts/${postId}/admin`);
            toast.success('Post deleted successfully');
            fetchPosts(); // Refresh the list
        } catch (error: any) {
            console.error('Error deleting post:', error);
            toast.error(error.response?.data?.message || 'Failed to delete post');
        }
    };

    const handleTogglePin = async (postId: string, currentPinStatus: boolean) => {
        try {
            const response = await apiClient.patch(`/api/community/posts/${postId}/pin`);
            toast.success(response.data.message);
            fetchPosts(); // Refresh the list
        } catch (error: any) {
            console.error('Error toggling pin:', error);
            toast.error(error.response?.data?.message || 'Failed to update pin status');
        }
    };

    const filteredPosts = posts.filter(post =>
        post.content?.toLowerCase().includes(searchTerm.toLowerCase()) ||
        post.userId?.displayName?.toLowerCase().includes(searchTerm.toLowerCase())
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
            <div className="flex items-center justify-between">
                <div>
                    <h1 className="text-3xl font-bold text-secondary">Community Management</h1>
                    <p className="text-accent mt-1">Manage posts, comments, and groups</p>
                </div>
            </div>

            <div className="bg-white rounded-xl p-4 shadow-md">
                <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-accent" />
                    <input
                        type="text"
                        placeholder="Search posts..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent outline-none"
                    />
                </div>
            </div>

            <div className="space-y-4">
                {filteredPosts.length === 0 ? (
                    <div className="bg-white rounded-xl p-12 text-center text-accent shadow-md">
                        <MessageSquare className="w-16 h-16 mx-auto mb-4 text-accent/30" />
                        <p>No community posts found</p>
                    </div>
                ) : (
                    filteredPosts.map((post) => (
                        <div key={post._id} className={`bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow ${post.isPinned ? 'border-l-4 border-primary' : ''}`}>
                            <div className="space-y-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2">
                                            <h3 className="font-bold text-secondary">{post.userId?.displayName || 'Unknown User'}</h3>
                                            {post.isPinned && (
                                                <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium flex items-center space-x-1">
                                                    <Pin className="w-3 h-3" />
                                                    <span>Pinned</span>
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-accent">{post.groupId?.name || 'Unknown Group'}</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm text-accent">{new Date(post.createdAt).toLocaleDateString()}</span>
                                        <button
                                            onClick={() => handleTogglePin(post._id, post.isPinned)}
                                            className={`p-2 rounded-lg transition ${post.isPinned ? 'text-primary bg-primary/10 hover:bg-primary/20' : 'text-gray-600 hover:bg-gray-100'}`}
                                            title={post.isPinned ? 'Unpin post' : 'Pin post'}
                                        >
                                            <Pin className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleDeletePost(post._id)}
                                            className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition"
                                            title="Delete post"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-secondary">{post.content}</p>
                                <div className="flex items-center space-x-6 pt-4 border-t text-sm text-accent">
                                    <div className="flex items-center space-x-2">
                                        <Heart className="w-4 h-4" />
                                        <span>{post.likeCount || 0} likes</span>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <MessageCircle className="w-4 h-4" />
                                        <span>{post.commentCount || 0} comments</span>
                                    </div>
                                </div>
                            </div>
                        </div>
                    ))
                )}
            </div>
        </div>
    );
}


