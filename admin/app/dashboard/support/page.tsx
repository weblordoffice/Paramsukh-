'use client';

import { useEffect, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Search, Loader2, MessageSquare, CheckCircle, Clock, AlertCircle, XCircle, Send, Eye, Trash2 } from 'lucide-react';

interface SupportMessage {
    _id: string;
    user?: {
        _id: string;
        displayName?: string;
        email?: string;
        phone?: string;
    };
    message: string;
    status: 'pending' | 'in_progress' | 'resolved' | 'closed';
    priority: 'low' | 'medium' | 'high' | 'urgent';
    category: string;
    adminReply?: {
        message: string;
        repliedAt: string;
        repliedBy?: {
            name: string;
        };
    };
    createdAt: string;
    updatedAt: string;
}

export default function SupportPage() {
    const [messages, setMessages] = useState<SupportMessage[]>([]);
    const [loading, setLoading] = useState(true);
    const [searchTerm, setSearchTerm] = useState('');
    const [statusFilter, setStatusFilter] = useState('all');
    const [stats, setStats] = useState({ total: 0, pending: 0, inProgress: 0, resolved: 0 });
    
    const [selectedMessage, setSelectedMessage] = useState<SupportMessage | null>(null);
    const [replyText, setReplyText] = useState('');
    const [sendingReply, setSendingReply] = useState(false);

    useEffect(() => {
        fetchMessages();
    }, [statusFilter]);

    const normalizeMessage = (message: Partial<SupportMessage>): SupportMessage => ({
        _id: message._id || '',
        user: message.user
            ? {
                _id: message.user._id || '',
                displayName: message.user.displayName || 'Unknown User',
                email: message.user.email || '',
                phone: message.user.phone || '',
            }
            : undefined,
        message: message.message || '',
        status: (message.status as SupportMessage['status']) || 'pending',
        priority: (message.priority as SupportMessage['priority']) || 'medium',
        category: message.category || 'general',
        adminReply: message.adminReply,
        createdAt: message.createdAt || new Date(0).toISOString(),
        updatedAt: message.updatedAt || new Date(0).toISOString(),
    });

    const fetchMessages = async () => {
        try {
            setLoading(true);
            const params = new URLSearchParams();
            if (statusFilter !== 'all') params.append('status', statusFilter);
            
            const res = await apiClient.get(`/api/admin/support/messages?${params}`);
            if (res.data.success) {
                const nextMessages = Array.isArray(res.data.messages)
                    ? res.data.messages.map(normalizeMessage)
                    : [];
                setMessages(nextMessages);
                setStats({
                    total: res.data.stats?.total || nextMessages.length,
                    pending: res.data.stats?.pending || 0,
                    inProgress: res.data.stats?.inProgress || 0,
                    resolved: res.data.stats?.resolved || 0,
                });
            }
        } catch (error) {
            console.error('Error fetching messages:', error);
            toast.error('Failed to load messages');
        } finally {
            setLoading(false);
        }
    };

    const handleOpenMessage = async (id: string) => {
        try {
            const res = await apiClient.get(`/api/admin/support/messages/${id}`);
            if (res.data.success && res.data.message) {
                setSelectedMessage(normalizeMessage(res.data.message));
                return;
            }
        } catch (error) {
            console.error('Error fetching message details:', error);
            toast.error('Failed to load message details');
            return;
        }
    };

    const handleReply = async () => {
        if (!replyText.trim() || !selectedMessage) return;
        
        try {
            setSendingReply(true);
            const res = await apiClient.post(`/api/admin/support/messages/${selectedMessage._id}/reply`, {
                message: replyText.trim(),
                status: 'in_progress'
            });
            
            if (res.data.success) {
                toast.success('Reply sent successfully');
                setReplyText('');
                setSelectedMessage(null);
                fetchMessages();
            }
        } catch (error) {
            console.error('Error sending reply:', error);
            toast.error('Failed to send reply');
        } finally {
            setSendingReply(false);
        }
    };

    const handleStatusChange = async (id: string, newStatus: string) => {
        try {
            await apiClient.put(`/api/admin/support/messages/${id}/status`, { status: newStatus });
            setSelectedMessage((current) => current && current._id === id
                ? { ...current, status: newStatus as SupportMessage['status'] }
                : current
            );
            toast.success('Status updated');
            fetchMessages();
        } catch (error) {
            console.error('Error updating status:', error);
            toast.error('Failed to update status');
        }
    };

    const handleDelete = async (id: string) => {
        if (!confirm('Are you sure you want to delete this message?')) return;
        
        try {
            await apiClient.delete(`/api/admin/support/messages/${id}`);
            toast.success('Message deleted');
            fetchMessages();
        } catch (error) {
            console.error('Error deleting message:', error);
            toast.error('Failed to delete message');
        }
    };

    const filteredMessages = messages.filter((m) => {
        const query = searchTerm.trim().toLowerCase();
        if (!query) return true;

        const name = m.user?.displayName?.toLowerCase() || '';
        const email = m.user?.email?.toLowerCase() || '';
        const body = m.message?.toLowerCase() || '';

        return name.includes(query) || email.includes(query) || body.includes(query);
    });

    const getStatusIcon = (status: string) => {
        switch (status) {
            case 'pending': return <AlertCircle className="w-4 h-4 text-yellow-500" />;
            case 'in_progress': return <Clock className="w-4 h-4 text-blue-500" />;
            case 'resolved': return <CheckCircle className="w-4 h-4 text-green-500" />;
            case 'closed': return <XCircle className="w-4 h-4 text-gray-500" />;
            default: return null;
        }
    };

    const getStatusColor = (status: string) => {
        switch (status) {
            case 'pending': return 'bg-yellow-100 text-yellow-800';
            case 'in_progress': return 'bg-blue-100 text-blue-800';
            case 'resolved': return 'bg-green-100 text-green-800';
            case 'closed': return 'bg-gray-100 text-gray-800';
            default: return 'bg-gray-100 text-gray-800';
        }
    };

    const getPriorityColor = (priority: string) => {
        switch (priority) {
            case 'urgent': return 'text-red-600';
            case 'high': return 'text-orange-600';
            case 'medium': return 'text-yellow-600';
            case 'low': return 'text-green-600';
            default: return 'text-gray-600';
        }
    };

    return (
        <div className="p-6">
            <div className="flex items-center justify-between mb-6">
                <div>
                    <h1 className="text-2xl font-bold text-gray-900">Support Tickets</h1>
                    <p className="text-gray-500 mt-1">Manage user support requests</p>
                </div>
                <div className="flex items-center gap-3">
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-yellow-50 rounded-lg">
                        <AlertCircle className="w-4 h-4 text-yellow-600" />
                        <span className="text-sm font-medium text-yellow-800">{stats.pending} Pending</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-blue-50 rounded-lg">
                        <Clock className="w-4 h-4 text-blue-600" />
                        <span className="text-sm font-medium text-blue-800">{stats.inProgress} In Progress</span>
                    </div>
                    <div className="flex items-center gap-2 px-3 py-1.5 bg-green-50 rounded-lg">
                        <CheckCircle className="w-4 h-4 text-green-600" />
                        <span className="text-sm font-medium text-green-800">{stats.resolved} Resolved</span>
                    </div>
                </div>
            </div>

            {/* Filters */}
            <div className="flex items-center gap-4 mb-6">
                <div className="relative flex-1 max-w-md">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        placeholder="Search messages..."
                        value={searchTerm}
                        onChange={(e) => setSearchTerm(e.target.value)}
                        className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                    />
                </div>
                <select
                    value={statusFilter}
                    onChange={(e) => setStatusFilter(e.target.value)}
                    className="px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary"
                >
                    <option value="all">All Status</option>
                    <option value="pending">Pending</option>
                    <option value="in_progress">In Progress</option>
                    <option value="resolved">Resolved</option>
                    <option value="closed">Closed</option>
                </select>
            </div>

            {/* Messages List */}
            <div className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <Loader2 className="w-8 h-8 text-primary animate-spin" />
                    </div>
                ) : filteredMessages.length === 0 ? (
                    <div className="flex flex-col items-center justify-center py-20">
                        <MessageSquare className="w-12 h-12 text-gray-300 mb-4" />
                        <p className="text-gray-500">No support messages found</p>
                    </div>
                ) : (
                    <table className="w-full">
                        <thead className="bg-gray-50 border-b border-gray-200">
                            <tr>
                                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">User</th>
                                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Message</th>
                                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Category</th>
                                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Priority</th>
                                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Status</th>
                                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Date</th>
                                <th className="text-left px-6 py-3 text-sm font-medium text-gray-500">Actions</th>
                            </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-200">
                            {filteredMessages.map((msg) => (
                                <tr key={msg._id} className="hover:bg-gray-50">
                                    <td className="px-6 py-4">
                                        <div>
                                            <p className="font-medium text-gray-900">{msg.user?.displayName || 'Unknown'}</p>
                                            <p className="text-sm text-gray-500">{msg.user?.email}</p>
                                        </div>
                                    </td>
                                    <td className="px-6 py-4">
                                        <p className="text-gray-900 line-clamp-2 max-w-xs">{msg.message}</p>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className="px-2 py-1 text-xs font-medium bg-gray-100 text-gray-700 rounded capitalize">
                                            {msg.category}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`text-sm font-medium capitalize ${getPriorityColor(msg.priority)}`}>
                                            {msg.priority}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4">
                                        <span className={`inline-flex items-center gap-1 px-2 py-1 text-xs font-medium rounded ${getStatusColor(msg.status)}`}>
                                            {getStatusIcon(msg.status)}
                                            {msg.status.replace('_', ' ')}
                                        </span>
                                    </td>
                                    <td className="px-6 py-4 text-sm text-gray-500">
                                        {new Date(msg.createdAt).toLocaleDateString()}
                                    </td>
                                    <td className="px-6 py-4">
                                        <div className="flex items-center gap-2">
                                            <button
                                                onClick={() => handleOpenMessage(msg._id)}
                                                className="p-2 text-gray-500 hover:text-primary hover:bg-primary/10 rounded-lg transition-colors"
                                                title="View & Reply"
                                            >
                                                <Eye className="w-4 h-4" />
                                            </button>
                                            <button
                                                onClick={() => handleDelete(msg._id)}
                                                className="p-2 text-gray-500 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
                                                title="Delete"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    </td>
                                </tr>
                            ))}
                        </tbody>
                    </table>
                )}
            </div>

            {/* Reply Modal */}
            {selectedMessage && (
                <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
                    <div className="bg-white rounded-xl shadow-xl w-full max-w-2xl max-h-[90vh] overflow-hidden">
                        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-200">
                            <div>
                                <h2 className="text-lg font-bold text-gray-900">Support Message</h2>
                                <p className="text-sm text-gray-500">From {selectedMessage.user?.displayName}</p>
                            </div>
                            <button
                                onClick={() => { setSelectedMessage(null); setReplyText(''); }}
                                className="p-2 hover:bg-gray-100 rounded-lg"
                            >
                                <XCircle className="w-5 h-5 text-gray-500" />
                            </button>
                        </div>
                        <div className="p-6 overflow-y-auto max-h-[50vh]">
                            <div className="mb-4">
                                <p className="text-sm text-gray-500 mb-1">User Message</p>
                                <div className="bg-gray-50 p-4 rounded-lg">
                                    <p className="text-gray-900 whitespace-pre-wrap">{selectedMessage.message}</p>
                                </div>
                            </div>
                            {selectedMessage.adminReply && (
                                <div className="mb-4">
                                    <p className="text-sm text-gray-500 mb-1">Admin Reply</p>
                                    <div className="bg-blue-50 p-4 rounded-lg">
                                        <p className="text-gray-900 whitespace-pre-wrap">{selectedMessage.adminReply.message}</p>
                                        <p className="text-sm text-gray-500 mt-2">
                                            Replied by {selectedMessage.adminReply.repliedBy?.name || 'Admin'} on{' '}
                                            {new Date(selectedMessage.adminReply.repliedAt).toLocaleString()}
                                        </p>
                                    </div>
                                </div>
                            )}
                            <div>
                                <p className="text-sm text-gray-500 mb-2">Send Reply</p>
                                <textarea
                                    value={replyText}
                                    onChange={(e) => setReplyText(e.target.value)}
                                    placeholder="Type your reply..."
                                    rows={4}
                                    className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-primary focus:border-transparent"
                                />
                            </div>
                        </div>
                        <div className="flex items-center justify-between px-6 py-4 border-t border-gray-200 bg-gray-50">
                            <select
                                value={selectedMessage.status}
                                onChange={(e) => handleStatusChange(selectedMessage._id, e.target.value)}
                                className="px-3 py-2 border border-gray-300 rounded-lg"
                            >
                                <option value="pending">Pending</option>
                                <option value="in_progress">In Progress</option>
                                <option value="resolved">Resolved</option>
                                <option value="closed">Closed</option>
                            </select>
                            <div className="flex items-center gap-3">
                                <button
                                    onClick={() => { setSelectedMessage(null); setReplyText(''); }}
                                    className="px-4 py-2 text-gray-600 hover:bg-gray-100 rounded-lg"
                                >
                                    Cancel
                                </button>
                                <button
                                    onClick={handleReply}
                                    disabled={!replyText.trim() || sendingReply}
                                    className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary-dark disabled:opacity-50"
                                >
                                    {sendingReply ? (
                                        <Loader2 className="w-4 h-4 animate-spin" />
                                    ) : (
                                        <Send className="w-4 h-4" />
                                    )}
                                    Send Reply
                                </button>
                            </div>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
