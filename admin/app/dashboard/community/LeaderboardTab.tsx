'use client';

import { useCallback, useEffect, useState } from 'react';
import apiClient from '@/lib/api/client';
import toast from 'react-hot-toast';
import { Trophy, RefreshCw, Activity, Users } from 'lucide-react';

type Period = 'weekly' | 'monthly' | 'all';

interface LeaderboardEntry {
    rank: number;
    userId: string;
    displayName: string;
    photoURL?: string | null;
    points: number;
    level: string;
}

interface PointEvent {
    _id: string;
    userId?: { displayName?: string; email?: string } | null;
    action: string;
    points: number;
    isActive: boolean;
    groupId?: { name?: string } | null;
    createdAt: string;
}

interface GroupOption {
    _id: string;
    name: string;
    groupType: string;
}

const ACTION_LABELS: Record<string, string> = {
    discussion_created: 'Discussion created',
    question_created: 'Question created',
    comment_created: 'Comment / answer',
    answer_accepted: 'Answer accepted',
    like_received: 'Like received',
    upvote_received: 'Upvote received',
};

export default function LeaderboardTab() {
    const [period, setPeriod] = useState<Period>('weekly');
    const [groupId, setGroupId] = useState('');
    const [groups, setGroups] = useState<GroupOption[]>([]);
    const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
    const [events, setEvents] = useState<PointEvent[]>([]);
    const [loading, setLoading] = useState(true);
    const [eventsLoading, setEventsLoading] = useState(false);
    const [eventPage, setEventPage] = useState(1);
    const [hasMoreEvents, setHasMoreEvents] = useState(false);

    useEffect(() => {
        const loadGroups = async () => {
            try {
                const response = await apiClient.get('/api/community/admin/groups');
                setGroups(response.data.data || []);
            } catch {
                // Non-blocking; the leaderboard still works globally.
            }
        };
        loadGroups();
    }, []);

    const loadLeaderboard = useCallback(async () => {
        setLoading(true);
        try {
            const params: Record<string, string | number> = { period, limit: 50 };
            if (groupId) params.groupId = groupId;
            const response = await apiClient.get('/api/community/admin/leaderboard', { params });
            setEntries(response.data.leaderboard || []);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to load leaderboard');
            setEntries([]);
        } finally {
            setLoading(false);
        }
    }, [period, groupId]);

    const loadEvents = useCallback(async (pageNum = 1, append = false) => {
        setEventsLoading(true);
        try {
            const params: Record<string, string | number> = { period, page: pageNum, limit: 10 };
            if (groupId) params.groupId = groupId;
            const response = await apiClient.get('/api/community/admin/leaderboard/events', { params });
            const nextEvents = response.data.events || [];
            setEvents((prev) => (append ? [...prev, ...nextEvents] : nextEvents));
            const totalPages = response.data.pagination?.totalPages || 0;
            setHasMoreEvents(pageNum < totalPages);
            setEventPage(pageNum);
        } catch (error: any) {
            toast.error(error.response?.data?.message || 'Failed to load point events');
            if (!append) setEvents([]);
        } finally {
            setEventsLoading(false);
        }
    }, [period, groupId]);

    useEffect(() => {
        loadLeaderboard();
        loadEvents(1, false);
    }, [loadLeaderboard, loadEvents]);

    const refresh = () => {
        loadLeaderboard();
        loadEvents(1, false);
    };

    return (
        <div className="space-y-6">
            <div className="bg-white rounded-xl p-4 shadow-md flex flex-wrap items-center justify-between gap-3">
                <div className="inline-flex rounded-lg bg-gray-50 p-1">
                    {(['weekly', 'monthly', 'all'] as Period[]).map((value) => (
                        <button
                            key={value}
                            onClick={() => setPeriod(value)}
                            className={`px-4 py-2 rounded-md text-sm font-semibold capitalize transition ${period === value ? 'bg-primary text-white' : 'text-accent hover:bg-white'}`}
                        >
                            {value === 'all' ? 'All Time' : value}
                        </button>
                    ))}
                </div>

                <div className="flex items-center gap-3">
                    <select
                        value={groupId}
                        onChange={(event) => setGroupId(event.target.value)}
                        className="px-3 py-2 border border-gray-300 rounded-lg text-sm text-secondary outline-none focus:ring-2 focus:ring-primary"
                    >
                        <option value="">Global leaderboard</option>
                        {groups.map((group) => (
                            <option key={group._id} value={group._id}>
                                {group.name}
                            </option>
                        ))}
                    </select>
                    <button
                        onClick={refresh}
                        className="flex items-center gap-2 px-4 py-2 bg-primary text-white rounded-lg hover:bg-primary/90 transition text-sm font-medium"
                    >
                        <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin' : ''}`} />
                        Refresh
                    </button>
                </div>
            </div>

            <div className="grid grid-cols-1 xl:grid-cols-2 gap-6">
                <div className="bg-white rounded-xl p-5 shadow-md">
                    <div className="flex items-center justify-between mb-4">
                        <div className="flex items-center gap-2">
                            <Trophy className="w-5 h-5 text-primary" />
                            <h2 className="text-lg font-bold text-secondary">Rankings</h2>
                        </div>
                        <span className="text-xs text-accent flex items-center gap-1">
                            <Users className="w-3.5 h-3.5" />
                            {entries.length} members
                        </span>
                    </div>

                    {loading ? (
                        <div className="flex justify-center py-12">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : entries.length === 0 ? (
                        <p className="text-center text-accent py-12">No points earned in this period yet.</p>
                    ) : (
                        <div className="space-y-2">
                            {entries.map((entry) => (
                                <div
                                    key={entry.userId}
                                    className={`flex items-center justify-between rounded-lg border p-3 ${entry.rank <= 3 ? 'border-primary/30 bg-primary/5' : 'border-gray-100'}`}
                                >
                                    <div className="flex items-center gap-3 min-w-0">
                                        <span className="w-9 text-center text-sm font-bold text-accent">#{entry.rank}</span>
                                        <div className="w-9 h-9 rounded-full bg-gray-100 overflow-hidden flex items-center justify-center text-xs font-bold text-primary">
                                            {entry.photoURL ? (
                                                <img src={entry.photoURL} alt="" className="w-full h-full object-cover" />
                                            ) : (
                                                (entry.displayName || 'U').charAt(0).toUpperCase()
                                            )}
                                        </div>
                                        <div className="min-w-0">
                                            <p className="text-sm font-semibold text-secondary truncate">{entry.displayName}</p>
                                            <p className="text-xs text-accent">{entry.level}</p>
                                        </div>
                                    </div>
                                    <span className="text-sm font-bold text-primary whitespace-nowrap">{entry.points} pts</span>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                <div className="bg-white rounded-xl p-5 shadow-md">
                    <div className="flex items-center gap-2 mb-4">
                        <Activity className="w-5 h-5 text-primary" />
                        <h2 className="text-lg font-bold text-secondary">Recent Point Events</h2>
                    </div>

                    {eventsLoading && events.length === 0 ? (
                        <div className="flex justify-center py-12">
                            <div className="w-8 h-8 border-4 border-primary border-t-transparent rounded-full animate-spin" />
                        </div>
                    ) : events.length === 0 ? (
                        <p className="text-center text-accent py-12">No point events in this period.</p>
                    ) : (
                        <div className="space-y-2">
                            {events.map((event) => (
                                <div key={event._id} className="flex items-start justify-between gap-3 rounded-lg border border-gray-100 p-3">
                                    <div className="min-w-0">
                                        <p className="text-sm font-semibold text-secondary truncate">
                                            {event.userId?.displayName || event.userId?.email || 'Unknown user'}
                                        </p>
                                        <p className="text-xs text-accent">
                                            {ACTION_LABELS[event.action] || event.action}
                                            {event.groupId?.name ? ` in ${event.groupId.name}` : ''}
                                        </p>
                                        <p className="text-[11px] text-gray-400 mt-1">
                                            {new Date(event.createdAt).toLocaleString()}
                                        </p>
                                    </div>
                                    <div className="text-right whitespace-nowrap">
                                        <span className={`text-sm font-bold ${event.isActive ? 'text-primary' : 'text-gray-400 line-through'}`}>
                                            +{event.points}
                                        </span>
                                        {!event.isActive && <p className="text-[10px] text-gray-400">revoked</p>}
                                    </div>
                                </div>
                            ))}

                            {hasMoreEvents && (
                                <button
                                    onClick={() => loadEvents(eventPage + 1, true)}
                                    disabled={eventsLoading}
                                    className="w-full py-2 text-sm font-medium text-primary hover:bg-primary/5 rounded-lg transition disabled:opacity-50"
                                >
                                    {eventsLoading ? 'Loading...' : 'Load more events'}
                                </button>
                            )}
                        </div>
                    )}
                </div>
            </div>
        </div>
    );
}
