'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { X, Trash2, MessageCircle } from 'lucide-react';

interface Comment {
    _id: string;
    userId: { displayName: string; email?: string };
    content: string;
    parentCommentId?: string | null;
    replyCount?: number;
    likeCount?: number;
    createdAt: string;
}

interface CommentsModalProps {
    isOpen: boolean;
    postId: string | null;
    onClose: () => void;
}

export default function CommentsModal({ isOpen, postId, onClose }: CommentsModalProps) {
    const [comments, setComments] = useState<Comment[]>([]);
    const [loading, setLoading] = useState(false);
    const [deletingId, setDeletingId] = useState<string | null>(null);

    useEffect(() => {
        if (isOpen && postId) {
            fetchComments();
        }
    }, [isOpen, postId]);

    const fetchComments = async () => {
        if (!postId) return;
        setLoading(true);
        try {
            const response = await apiClient.get(`/api/community/admin/posts/${postId}/comments`);
            setComments(response.data.data || []);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to load comments');
        } finally {
            setLoading(false);
        }
    };

    const handleDelete = async (commentId: string) => {
        if (!confirm('Delete this comment?')) return;
        setDeletingId(commentId);
        try {
            await apiClient.delete(`/api/community/comments/${commentId}/admin`);
            toast.success('Comment deleted');
            setComments(prev => prev.filter(c => c._id !== commentId));
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to delete comment');
        } finally {
            setDeletingId(null);
        }
    };

    if (!isOpen) return null;

    return (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
            <div className="relative w-full max-w-2xl mx-4 bg-white rounded-xl shadow-2xl max-h-[90vh] overflow-y-auto">
                <div className="sticky top-0 bg-white border-b px-6 py-4 flex items-center justify-between rounded-t-xl">
                    <h2 className="text-xl font-bold text-secondary flex items-center gap-2">
                        <MessageCircle className="w-5 h-5" />
                        Comments ({comments.length})
                    </h2>
                    <button onClick={onClose} className="p-2 hover:bg-gray-100 rounded-lg">
                        <X className="w-5 h-5" />
                    </button>
                </div>

                <div className="p-6 space-y-4">
                    {loading ? (
                        <div className="text-center py-8 text-accent">Loading comments...</div>
                    ) : comments.length === 0 ? (
                        <div className="text-center py-8 text-accent">No comments yet</div>
                    ) : (
                        comments.map((comment) => (
                            <div key={comment._id} className="border border-gray-200 rounded-lg p-4">
                                <div className="flex items-start justify-between">
                                    <div className="flex-1">
                                        <div className="flex items-center gap-2">
                                            <span className="font-semibold text-secondary">
                                                {comment.userId?.displayName || 'Unknown User'}
                                            </span>
                                            {comment.parentCommentId && (
                                                <span className="text-xs bg-gray-100 text-accent px-2 py-0.5 rounded">Reply</span>
                                            )}
                                        </div>
                                        <p className="text-sm text-accent mt-0.5">
                                            {new Date(comment.createdAt).toLocaleString()}
                                        </p>
                                        <p className="text-secondary mt-2">{comment.content}</p>
                                        <div className="flex items-center gap-4 mt-2 text-xs text-accent">
                                            <span>{comment.likeCount || 0} likes</span>
                                            <span>{comment.replyCount || 0} replies</span>
                                        </div>
                                    </div>
                                    <button
                                        onClick={() => handleDelete(comment._id)}
                                        disabled={deletingId === comment._id}
                                        className="p-2 text-red-600 hover:bg-red-50 rounded-lg transition disabled:opacity-50"
                                        title="Delete comment"
                                    >
                                        <Trash2 className="w-4 h-4" />
                                    </button>
                                </div>
                            </div>
                        ))
                    )}
                </div>
            </div>
        </div>
    );
}
