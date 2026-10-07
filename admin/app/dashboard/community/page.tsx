'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Search, MessageSquare, Heart, MessageCircle, Trash2, Pin, Plus, EyeOff, Eye, UserX, UserCheck } from 'lucide-react';
import CreatePostModal from './CreatePostModal';
import CommentsModal from './CommentsModal';
import GeneralCommunityCard from './GeneralCommunityCard';

interface Post {
    _id: string;
    userId: { _id?: string; displayName: string; communityPostingBlocked?: boolean } | null;
    content: string;
    images?: string[];
    groupId: { name: string };
    likeCount: number;
    commentCount: number;
    isPinned: boolean;
    isBlocked?: boolean;
    isAdminPost?: boolean;
    authorName?: string;
    createdAt: string;
}

export default function CommunityPage() {
    const [posts, setPosts] = useState<Post[]>([]);
    const [loading, setLoading] = useState(true);
    const [loadingMore, setLoadingMore] = useState(false);
    const [page, setPage] = useState(1);
    const [hasMore, setHasMore] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [pendingActionId, setPendingActionId] = useState<string | null>(null);
    const [showCommentsModal, setShowCommentsModal] = useState(false);
    const [commentsPostId, setCommentsPostId] = useState<string | null>(null);

    useEffect(() => {
        fetchPosts();
    }, []);

    const fetchPosts = async (pageNum = 1, append = false) => {
        try {
            if (append) setLoadingMore(true); else setLoading(true);
            const response = await apiClient.get('/api/community/all', { params: { page: pageNum, limit: 20 } });
            const data = response.data.data?.posts || response.data.posts || response.data || [];
            const postsData = Array.isArray(data) ? data : (data.posts || []);
            if (append) {
                setPosts(prev => [...prev, ...postsData]);
            } else {
                setPosts(postsData);
            }
            setHasMore(postsData.length === 20);
        } catch (error: any) {
            if (error.response?.status !== 404) {
                console.error('Error fetching community posts:', error);
                if (error.response?.status >= 500) {
                    toast.error('Server error. Please try again later.');
                }
            }
            if (!append) setPosts([]);
        } finally {
            setLoading(false);
            setLoadingMore(false);
        }
    };

    const handleDeletePost = async (postId: string) => {
        if (!confirm('Are you sure you want to delete this post?')) return;
        if (pendingActionId) return;
        setPendingActionId(postId);
        try {
            await apiClient.delete(`/api/community/posts/${postId}/admin`);
            toast.success('Post deleted successfully');
            setPosts(prev => prev.filter(p => p._id !== postId));
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete post');
        } finally {
            setPendingActionId(null);
        }
    };

    const handleTogglePin = async (postId: string, currentPinStatus: boolean) => {
        if (pendingActionId) return;
        setPendingActionId(postId);
        try {
            const response = await apiClient.patch(`/api/community/posts/${postId}/pin`);
            toast.success(response.data.message);
            setPosts(prev => prev.map(p => p._id === postId ? { ...p, isPinned: !currentPinStatus } : p));
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to update pin status');
        } finally {
            setPendingActionId(null);
        }
    };

    const handleToggleBlockPost = async (postId: string, currentBlocked: boolean) => {
        if (pendingActionId) return;
        setPendingActionId(postId);
        try {
            const response = await apiClient.patch(`/api/community/posts/${postId}/block`, { blocked: !currentBlocked });
            toast.success(response.data.message);
            setPosts(prev => prev.map(p => p._id === postId ? { ...p, isBlocked: !currentBlocked } : p));
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to update block status');
        } finally {
            setPendingActionId(null);
        }
    };

    const handleToggleBlockUser = async (userId: string, currentBlocked: boolean) => {
        if (pendingActionId) return;
        setPendingActionId(userId);
        try {
            const response = await apiClient.post(`/api/community/admin/users/${userId}/posting-block`, { blocked: !currentBlocked });
            toast.success(response.data.message);
            setPosts(prev => prev.map(p =>
                (p.userId?._id === userId)
                    ? { ...p, userId: { ...p.userId!, communityPostingBlocked: !currentBlocked } }
                    : p
            ));
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to update posting permission');
        } finally {
            setPendingActionId(null);
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
                <button
                    onClick={() => setShowCreateModal(true)}
                    className="flex items-center gap-2 px-4 py-2.5 bg-primary text-white rounded-lg hover:bg-primary/90 transition font-medium"
                >
                    <Plus className="w-5 h-5" />
                    Create Post
                </button>
            </div>

            <GeneralCommunityCard />

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
                        <p>{searchTerm ? 'No posts match your search' : 'No community posts found'}</p>
                    </div>
                ) : (
                    filteredPosts.map((post) => (
                        <div key={post._id} className={`bg-white rounded-xl p-6 shadow-md hover:shadow-lg transition-shadow ${post.isPinned ? 'border-l-4 border-primary' : ''}`}>
                            <div className="space-y-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center space-x-2 flex-wrap gap-y-1">
                                            <h3 className="font-bold text-secondary">{post.authorName || post.userId?.displayName || 'Unknown User'}</h3>
                                            {post.isPinned && (
                                                <span className="px-2 py-1 bg-primary/10 text-primary rounded text-xs font-medium flex items-center space-x-1">
                                                    <Pin className="w-3 h-3" />
                                                    <span>Pinned</span>
                                                </span>
                                            )}
                                            {post.isBlocked && (
                                                <span className="px-2 py-1 bg-red-50 text-red-600 rounded text-xs font-medium flex items-center space-x-1">
                                                    <EyeOff className="w-3 h-3" />
                                                    <span>Hidden</span>
                                                </span>
                                            )}
                                            {post.userId?.communityPostingBlocked && (
                                                <span className="px-2 py-1 bg-amber-50 text-amber-600 rounded text-xs font-medium flex items-center space-x-1">
                                                    <UserX className="w-3 h-3" />
                                                    <span>Posting blocked</span>
                                                </span>
                                            )}
                                        </div>
                                        <p className="text-sm text-accent">{post.groupId?.name || 'Unknown Group'}</p>
                                    </div>
                                    <div className="flex items-center space-x-2">
                                        <span className="text-sm text-accent">{new Date(post.createdAt).toLocaleDateString()}</span>
                                        <button
                                            onClick={() => {
                                                setCommentsPostId(post._id);
                                                setShowCommentsModal(true);
                                            }}
                                            className="p-2 rounded-lg transition text-gray-600 hover:bg-gray-100"
                                            title="View comments"
                                        >
                                            <MessageCircle className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleTogglePin(post._id, post.isPinned)}
                                            disabled={pendingActionId === post._id}
                                            className={`p-2 rounded-lg transition ${pendingActionId === post._id ? 'opacity-50 cursor-not-allowed' : ''} ${post.isPinned ? 'text-primary bg-primary/10 hover:bg-primary/20' : 'text-gray-600 hover:bg-gray-100'}`}
                                            title={post.isPinned ? 'Unpin post' : 'Pin post'}
                                        >
                                            <Pin className="w-4 h-4" />
                                        </button>
                                        <button
                                            onClick={() => handleToggleBlockPost(post._id, !!post.isBlocked)}
                                            disabled={pendingActionId === post._id}
                                            className={`p-2 rounded-lg transition ${pendingActionId === post._id ? 'opacity-50 cursor-not-allowed' : ''} ${post.isBlocked ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' : 'text-gray-600 hover:bg-gray-100'}`}
                                            title={post.isBlocked ? 'Unblock post (show to members)' : 'Block post (hide from members)'}
                                        >
                                            {post.isBlocked ? <Eye className="w-4 h-4" /> : <EyeOff className="w-4 h-4" />}
                                        </button>
                                        {post.userId?._id && (
                                            <button
                                                onClick={() => handleToggleBlockUser(post.userId!._id!, !!post.userId?.communityPostingBlocked)}
                                                disabled={pendingActionId === post.userId._id}
                                                className={`p-2 rounded-lg transition ${pendingActionId === post.userId._id ? 'opacity-50 cursor-not-allowed' : ''} ${post.userId?.communityPostingBlocked ? 'text-amber-600 bg-amber-50 hover:bg-amber-100' : 'text-gray-600 hover:bg-gray-100'}`}
                                                title={post.userId?.communityPostingBlocked ? 'Allow user to post again' : 'Block user from posting'}
                                            >
                                                {post.userId?.communityPostingBlocked ? <UserCheck className="w-4 h-4" /> : <UserX className="w-4 h-4" />}
                                            </button>
                                        )}
                                        <button
                                            onClick={() => handleDeletePost(post._id)}
                                            disabled={pendingActionId === post._id}
                                            className={`p-2 rounded-lg transition ${pendingActionId === post._id ? 'opacity-50 cursor-not-allowed' : 'text-red-600 hover:bg-red-50'}`}
                                            title="Delete post"
                                        >
                                            <Trash2 className="w-4 h-4" />
                                        </button>
                                    </div>
                                </div>
                                <p className="text-secondary">{post.content}</p>
                                {post.images && post.images.length > 0 && (
                                    <div className="flex flex-wrap gap-3">
                                        {post.images.map((url, i) => (
                                            <a
                                                key={i}
                                                href={url}
                                                target="_blank"
                                                rel="noopener noreferrer"
                                                className="block"
                                            >
                                                <img
                                                    src={url}
                                                    alt=""
                                                    className="w-32 h-32 object-cover rounded-lg border border-gray-200 hover:opacity-90 transition"
                                                />
                                            </a>
                                        ))}
                                    </div>
                                )}
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
                {hasMore && !loading && filteredPosts.length > 0 && (
                    <div className="flex justify-center mt-4">
                        <button
                            onClick={() => {
                                const nextPage = page + 1;
                                fetchPosts(nextPage, true);
                                setPage(nextPage);
                            }}
                            disabled={loadingMore}
                            className="px-6 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark transition disabled:opacity-50"
                        >
                            {loadingMore ? 'Loading...' : 'Load More'}
                        </button>
                    </div>
                )}
            </div>

            <CreatePostModal
                isOpen={showCreateModal}
                onClose={() => setShowCreateModal(false)}
                onSuccess={fetchPosts}
            />

            <CommentsModal
                isOpen={showCommentsModal}
                postId={commentsPostId}
                onClose={() => { setShowCommentsModal(false); setCommentsPostId(null); }}
            />
        </div>
    );
}


